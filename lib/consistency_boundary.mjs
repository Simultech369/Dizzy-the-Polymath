/**
 * Consistency & Fiduciary Boundary Enforcement Bridge.
 *
 * Formalizes the 3 Consistency Classes across Dizzy, Council, and PBM:
 * 1. [SYNTHETIC_REHEARSAL]: Local generation / dry-run simulation (0 authority)
 * 2. [LOCAL_RECEIPT_VERIFIED]: Deterministic local evidence with SHA-256 hashes (bounded authority)
 * 3. [GLOBAL_CONSENSUS_FINALIZED]: Settled on-chain transaction / consensus (fiduciary authority)
 *
 * Enforces transition invariants (no leapfrogging) and fail-closed circuit breakers.
 */

import crypto from "node:crypto";

export const CONSISTENCY_CLAIM_SCHEMA = "dizzy.consistency_claim.v1";
export const CONSISTENCY_CIRCUIT_BREAKER_SCHEMA = "dizzy.consistency_circuit_breaker.v1";

export const CONSISTENCY_CLASSES = Object.freeze({
  SYNTHETIC_REHEARSAL: "SYNTHETIC_REHEARSAL",
  LOCAL_RECEIPT_VERIFIED: "LOCAL_RECEIPT_VERIFIED",
  GLOBAL_CONSENSUS_FINALIZED: "GLOBAL_CONSENSUS_FINALIZED",
});

export const CONSISTENCY_BADGES = Object.freeze({
  [CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL]: "[SYNTHETIC_REHEARSAL]",
  [CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED]: "[LOCAL_RECEIPT_VERIFIED]",
  [CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED]: "[GLOBAL_CONSENSUS_FINALIZED]",
});

export const CONSISTENCY_AUTHORITY_RULES = Object.freeze({
  [CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL]: Object.freeze({
    promotion_authority: false,
    fiduciary_authority: false,
    description: "Synthetic rehearsal / dry-run simulation / unverified model proposal. Zero external authority.",
  }),
  [CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED]: Object.freeze({
    promotion_authority: true,
    fiduciary_authority: false,
    description: "Deterministically verified by offline 5-surface guardrails, tests, and SHA-256 evidence receipt. Bounded local authority.",
  }),
  [CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED]: Object.freeze({
    promotion_authority: true,
    fiduciary_authority: true,
    description: "Settled on-chain transaction or decentralized consensus. Full fiduciary authority.",
  }),
});

function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Validates whether a state transition between two consistency classes is legal.
 * Forbids leapfrogging directly from SYNTHETIC_REHEARSAL to GLOBAL_CONSENSUS_FINALIZED.
 */
export function validateConsistencyTransition(fromClass, toClass, evidence = {}) {
  const validClasses = Object.values(CONSISTENCY_CLASSES);
  if (!validClasses.includes(fromClass)) {
    return {
      ok: false,
      reason: `invalid_from_consistency_class: '${fromClass}' is not recognized`,
      allowed: false,
    };
  }
  if (!validClasses.includes(toClass)) {
    return {
      ok: false,
      reason: `invalid_to_consistency_class: '${toClass}' is not recognized`,
      allowed: false,
    };
  }

  // Idempotent transition is always allowed
  if (fromClass === toClass) {
    return { ok: true, allowed: true, reason: "idempotent_transition" };
  }

  // 1. SYNTHETIC_REHEARSAL -> LOCAL_RECEIPT_VERIFIED
  if (fromClass === CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL && toClass === CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED) {
    const evidenceSha = String(evidence.evidence_sha256 || evidence.receipt_sha256 || "").trim();
    if (!/^[a-f0-9]{64}$/i.test(evidenceSha)) {
      return {
        ok: false,
        allowed: false,
        reason: "missing_or_invalid_evidence_sha256: local receipt verification requires a valid 64-char SHA-256 digest",
      };
    }
    if (evidence.verdict !== "VERIFIED_PASSED") {
      return {
        ok: false,
        allowed: false,
        reason: `invalid_evidence_verdict: expected 'VERIFIED_PASSED', got '${evidence.verdict}'`,
      };
    }
    if (Number(evidence.orchestration_faults || 0) > 0) {
      return {
        ok: false,
        allowed: false,
        reason: `orchestration_faults_present: ${evidence.orchestration_faults} fault(s) detected`,
      };
    }
    return { ok: true, allowed: true, reason: "local_receipt_verified_promoted" };
  }

  // 2. LOCAL_RECEIPT_VERIFIED -> GLOBAL_CONSENSUS_FINALIZED
  if (fromClass === CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED && toClass === CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED) {
    const hasTxProof = Boolean(
      evidence.tx_hash ||
      evidence.algorand_round !== undefined ||
      evidence.block_number !== undefined ||
      evidence.settlement_id
    );
    if (!hasTxProof) {
      return {
        ok: false,
        allowed: false,
        reason: "missing_settlement_proof: global consensus finalization requires tx_hash, algorand_round, or block_number",
      };
    }
    if (!evidence.dual_control_approved) {
      return {
        ok: false,
        allowed: false,
        reason: "missing_dual_control_approval: global consensus finalization requires operator dual-control sign-off",
      };
    }
    return { ok: true, allowed: true, reason: "global_consensus_finalized_promoted" };
  }

  // 3. SYNTHETIC_REHEARSAL -> GLOBAL_CONSENSUS_FINALIZED (FORBIDDEN LEAPFROG)
  if (fromClass === CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL && toClass === CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED) {
    return {
      ok: false,
      allowed: false,
      reason: "forbidden_leapfrog_transition: cannot leapfrog LOCAL_RECEIPT_VERIFIED directly to GLOBAL_CONSENSUS_FINALIZED",
    };
  }

  // 4. Downgrade paths (e.g. demotion due to circuit breaker trip or test failure)
  if (evidence.downgrade_reason) {
    return {
      ok: true,
      allowed: true,
      reason: `downgrade_permitted: ${evidence.downgrade_reason}`,
    };
  }

  return {
    ok: false,
    allowed: false,
    reason: `unauthorized_consistency_downgrade: explicit downgrade_reason required to transition from ${fromClass} to ${toClass}`,
  };
}

/**
 * Fail-Closed Circuit Breaker.
 * Compares local projected fiduciary state against RPC / chain state.
 * If divergence exceeds tolerance, trips circuit breaker, fails closed,
 * and strips all promotion and fiduciary authorities.
 */
export function evaluateCircuitBreaker({
  localProjection = null,
  rpcState = null,
  tolerance = 0,
  claimId = "",
} = {}) {
  const timestamp = new Date().toISOString();
  const effectiveClaimId = String(claimId || `breaker_${Date.now()}`);

  if (!localProjection || !rpcState) {
    const payload = {
      schema_version: CONSISTENCY_CIRCUIT_BREAKER_SCHEMA,
      claim_id: effectiveClaimId,
      timestamp,
      status: "CIRCUIT_BREAKER_TRIGGERED",
      tripped: true,
      reason: "missing_projection_or_rpc_state",
      promotion_authority: false,
      fiduciary_authority: false,
      consistency_class: CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL,
      action_required: "OPERATOR_DUAL_CONTROL_SIGN_OFF",
    };
    return Object.freeze({
      ...payload,
      evidence_sha256: sha256Hex(stableJson(payload)),
    });
  }

  // Numerical balance divergence check
  const localBalance = Number(localProjection.balance ?? 0);
  const rpcBalance = Number(rpcState.balance ?? 0);
  const divergence = Math.abs(localBalance - rpcBalance);

  // Hash / state root comparison if provided
  const rootsMismatch = Boolean(
    localProjection.state_root &&
    rpcState.state_root &&
    localProjection.state_root !== rpcState.state_root
  );

  const isTripped = divergence > tolerance || rootsMismatch;

  if (isTripped) {
    const payload = {
      schema_version: CONSISTENCY_CIRCUIT_BREAKER_SCHEMA,
      claim_id: effectiveClaimId,
      timestamp,
      status: "CIRCUIT_BREAKER_TRIGGERED",
      tripped: true,
      reason: rootsMismatch ? "state_root_mismatch" : "balance_divergence_exceeded_tolerance",
      metrics: {
        local_balance: localBalance,
        rpc_balance: rpcBalance,
        divergence,
        tolerance,
        roots_mismatch: rootsMismatch,
      },
      promotion_authority: false,
      fiduciary_authority: false,
      consistency_class: CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL,
      action_required: "OPERATOR_DUAL_CONTROL_SIGN_OFF",
    };
    return Object.freeze({
      ...payload,
      evidence_sha256: sha256Hex(stableJson(payload)),
    });
  }

  // Healthy within tolerance
  const payload = {
    schema_version: CONSISTENCY_CIRCUIT_BREAKER_SCHEMA,
    claim_id: effectiveClaimId,
    timestamp,
    status: "HEALTHY",
    tripped: false,
    reason: "state_within_tolerance",
    metrics: {
      local_balance: localBalance,
      rpc_balance: rpcBalance,
      divergence,
      tolerance,
      roots_mismatch: false,
    },
    promotion_authority: true,
    fiduciary_authority: true,
    consistency_class: CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED,
    action_required: "NONE",
  };

  return Object.freeze({
    ...payload,
    evidence_sha256: sha256Hex(stableJson(payload)),
  });
}

/**
 * Builds a frozen consistency claim object.
 */
export function createConsistencyClaim({
  claimId,
  consistencyClass = CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL,
  evidenceDigest = "",
  settlementMeta = {},
  metadata = {},
} = {}) {
  const effectiveClass = CONSISTENCY_CLASSES[consistencyClass] || CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL;
  const authority = CONSISTENCY_AUTHORITY_RULES[effectiveClass];
  const badge = CONSISTENCY_BADGES[effectiveClass];

  const payload = {
    schema_version: CONSISTENCY_CLAIM_SCHEMA,
    claim_id: String(claimId || `claim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`),
    consistency_class: effectiveClass,
    badge,
    promotion_authority: authority.promotion_authority,
    fiduciary_authority: authority.fiduciary_authority,
    evidence_digest: String(evidenceDigest || ""),
    settlement_meta: { ...settlementMeta },
    metadata: { ...metadata },
    timestamp: new Date().toISOString(),
  };

  const claimSha256 = sha256Hex(stableJson(payload));

  return Object.freeze({
    ...payload,
    claim_sha256: claimSha256,
  });
}
