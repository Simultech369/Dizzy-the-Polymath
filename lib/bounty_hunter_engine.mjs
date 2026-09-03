import crypto from "node:crypto";
import { createA2AMessage } from "./a2a_mailbox_bridge.mjs";
import {
  exportStateMRunbook,
  executeStateMFsm,
  ALLOWED_VERIFICATION_COMMANDS,
  DEFAULT_VERIFICATION_COMMAND,
} from "./statem_runbook_bridge.mjs";

export const BOUNTY_TASK_SCHEMA = "dizzy.bounty_task.v1";
export const BOUNTY_A2A_INGEST_SCHEMA = "dizzy.bounty_a2a_ingest.v1";
export const BOUNTY_TRIAGE_RECEIPT_SCHEMA = "dizzy.bounty_triage_receipt.v1";
export const BOUNTY_SOLVE_RECEIPT_SCHEMA = "dizzy.bounty_solve_receipt.v1";
export const BOUNTY_VULNERABILITY_RECEIPT_SCHEMA = "dizzy.bounty_vulnerability_receipt.v1";
export const BOUNTY_INGEST_JOB_RESULT_SCHEMA = "dizzy.bounty_ingest_job_result.v1";

export const VALID_CLAIMABILITY_STATES = Object.freeze([
  "unverified",
  "open_unassigned",
  "open_needs_assignment",
  "assigned_elsewhere",
  "closed",
  "monitor_only",
]);

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

function cleanList(values, { maxItems = 32, maxChars = 240 } = {}) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => value.slice(0, maxChars))
    .slice(0, maxItems);
}

function normalizeSlug(value, fallback) {
  const slug = String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

function normalizeClaimabilityState(value) {
  const state = normalizeSlug(value, "unverified");
  return VALID_CLAIMABILITY_STATES.includes(state) ? state : "unverified";
}

/**
 * Sanitizes untrusted text from external bounty / job board descriptions,
 * stripping adversarial prompt overrides, hidden instructions, and shell injections.
 */
export function sanitizeBountyText(text) {
  if (!text || typeof text !== "string") return "";
  let clean = text
    .replace(/<system_prompt_override>[\s\S]*?<\/system_prompt_override>/gi, "[REDACTED_OVERRIDE]")
    .replace(/ignore\s+all\s+previous\s+instructions/gi, "[REDACTED_INSTRUCTION]")
    .replace(/\brm\s+-rf\b/gi, "[BLOCKED_COMMAND]")
    .replace(/`([^`]*[\$\&\|\;][^`]*)`/g, "[BLOCKED_SHELL_EXPANSION]")
    .replace(/javascript:/gi, "[BLOCKED_URI]")
    .trim();
  return clean;
}

/**
 * Parses and validates an external bounty or SWE-bench problem description.
 */
export function parseBountyTask({
  id,
  title,
  description,
  platform = "swe_bench",
  repository,
  sourceUrl = "",
  roleType = "bounty",
  claimabilityState = "unverified",
  proofRequirements = [],
  requiredStack = [],
  testCommand,
  payoutUsd = 0,
  difficulty = "medium",
  files = [],
} = {}) {
  const safeId = String(id || `bounty_${Date.now()}`).trim();
  const safeTitle = String(title || "Untitled Bounty").trim().slice(0, 200);
  const cleanDescription = sanitizeBountyText(description || "");
  const safePlatform = normalizeSlug(platform, "swe_bench");
  const safeRepo = String(repository || "unknown/repo").trim();
  const safeSourceUrl = String(sourceUrl || "").trim().slice(0, 500);
  const safeRoleType = normalizeSlug(roleType, "bounty");
  const safeClaimabilityState = normalizeClaimabilityState(claimabilityState);
  const safeProofRequirements = cleanList(proofRequirements);
  const safeRequiredStack = cleanList(requiredStack);
  const safeTestCmd = String(testCommand || "npm test").trim();
  const safePayout = Number.isFinite(Number(payoutUsd)) ? Math.max(0, Number(payoutUsd)) : 0;
  const safeFiles = cleanList(files, { maxItems: 64, maxChars: 260 });

  const payloadSha256 = sha256Hex(JSON.stringify({
    id: safeId,
    title: safeTitle,
    description: cleanDescription,
    platform: safePlatform,
    repository: safeRepo,
    sourceUrl: safeSourceUrl,
    roleType: safeRoleType,
    claimabilityState: safeClaimabilityState,
    proofRequirements: safeProofRequirements,
    requiredStack: safeRequiredStack,
    testCommand: safeTestCmd,
    payoutUsd: safePayout,
    difficulty,
    files: safeFiles,
  }));

  return {
    schema_version: BOUNTY_TASK_SCHEMA,
    bounty_id: safeId,
    title: safeTitle,
    sanitized_description: cleanDescription,
    platform: safePlatform,
    repository: safeRepo,
    source_url: safeSourceUrl,
    role_type: safeRoleType,
    claimability_state: safeClaimabilityState,
    proof_requirements: safeProofRequirements,
    required_stack: safeRequiredStack,
    test_command: safeTestCmd,
    payout_usd: safePayout,
    difficulty,
    target_files: safeFiles,
    payload_sha256: payloadSha256,
    parsed_at: new Date().toISOString(),
  };
}

/**
 * Calculates the Expected Value (EV) for triaging incoming bounties.
 * EV = P(solve) * payout - compute_cost
 */
export function calculateBountyEv({
  payoutUsd = 0,
  difficulty = "medium",
  hasReproductionTests = true,
  estimatedTokens = 50_000,
  tokenCostPer1k = 0.003, // blended average
} = {}) {
  const payout = Math.max(0, Number(payoutUsd) || 0);
  const estimatedCost = (Number(estimatedTokens) / 1000) * Number(tokenCostPer1k);

  // Baseline solve probability by difficulty
  let baseProb = 0.65;
  if (difficulty === "easy") baseProb = 0.85;
  if (difficulty === "hard") baseProb = 0.40;
  if (difficulty === "critical" || difficulty === "complex") baseProb = 0.25;

  // Bonus for clear reproduction tests
  const prob = hasReproductionTests ? Math.min(0.95, baseProb * 1.2) : baseProb * 0.7;
  const evUsd = (prob * payout) - estimatedCost;

  let recommendation = "DISPATCH";
  if (evUsd <= 0 && payout > 0) recommendation = "REJECT_NEGATIVE_EV";
  else if (prob < 0.30) recommendation = "PARK_HIGH_RISK";
  else if (payout === 0) recommendation = "EVAL_BENCHMARK_ONLY"; // SWE-bench evaluation run

  return {
    schema_version: BOUNTY_TRIAGE_RECEIPT_SCHEMA,
    payout_usd: payout,
    difficulty,
    has_reproduction_tests: Boolean(hasReproductionTests),
    solve_probability: Number(prob.toFixed(3)),
    estimated_cost_usd: Number(estimatedCost.toFixed(4)),
    expected_value_usd: Number(evUsd.toFixed(2)),
    recommendation,
    triaged_at: new Date().toISOString(),
  };
}

/**
 * Creates a specialized 4-phase StateM runbook tailored for solving coding bounties.
 */
export function createBountyStateMRunbook(bountyTask) {
  const name = `bounty-solve-${bountyTask.bounty_id || "task"}`;
  const rawCommand = String(bountyTask.test_command || "").trim();
  const isAllowed = rawCommand && rawCommand.split(/\s*(?:&&|;)\s*/g).every((c) => ALLOWED_VERIFICATION_COMMANDS.includes(c.trim()));
  const verificationCommand = isAllowed ? rawCommand : (ALLOWED_VERIFICATION_COMMANDS[0] || DEFAULT_VERIFICATION_COMMAND);
  const proofRequirements = Array.isArray(bountyTask.proof_requirements) && bountyTask.proof_requirements.length > 0
    ? bountyTask.proof_requirements.join(", ")
    : "local deterministic verification receipt";

  const customPrompts = {
    plan: `Isolate root cause in repository '${bountyTask.repository}'. Confirm claimability '${bountyTask.claimability_state || "unverified"}', reproduce the issue, and identify the minimal code change required.`,
    execute: `Implement minimal clean-room fix in target files: [${bountyTask.target_files.join(", ")}]. Enforce zero license contamination.`,
    verify: `Execute allowed verification command: '${verificationCommand}'. Required proof: ${proofRequirements}. Target original command: '${rawCommand || "none"}'. Assert 100% test pass and zero regressions before handoff.`,
    handoff: `Package git diff patch, verification receipts, clean-room notes, and draft summary. Public submission or maintainer outreach requires explicit operator approval.`,
  };

  return exportStateMRunbook({
    name,
    verificationCommand,
    customPrompts,
  });
}

/**
 * Creates the sealed A2A bounty-ingest contract used by board scanners
 * to hand qualified opportunities into the council / StateM queue.
 */
export function createBountyA2AIngestEnvelope({
  bountyTask,
  triageReceipt = null,
  fromAgent = "subagent_researcher",
  toAgent = "oss_council",
  trustZone = "trusted_collaborator",
  priority = "high",
  parentTaskId = null,
  notes = "",
  now = () => new Date(),
} = {}) {
  if (!bountyTask || bountyTask.schema_version !== BOUNTY_TASK_SCHEMA) {
    throw new Error("Bounty A2A ingest requires a parsed dizzy.bounty_task.v1 payload");
  }

  const payload = {
    schema_version: BOUNTY_A2A_INGEST_SCHEMA,
    bounty_task: bountyTask,
    triage_receipt: triageReceipt,
    state_machine: {
      recommended_runbook_name: `bounty-solve-${bountyTask.bounty_id || "task"}`,
      lifecycle: ["plan", "execute", "verify", "handoff"],
      execute_verify_repair_loop: true,
      verify_before_handoff: true,
      max_auto_repair_cycles: 3,
    },
    council_directives: {
      economic_triage: "required_before_expensive_model_dispatch",
      asymmetric_deliberation: {
        builder_lane: "minimal_clean_room_patch",
        breaker_lane: "hostile_edge_case_and_regression_tests",
      },
      ingress_scrubbing: "sanitize_untrusted_text_before_context_entry",
      clean_room_sealing: "required_before_submission_packet",
    },
    proof_boundaries: [
      "board_scan_is_not_live_coverage_without_current_scan_receipt",
      "handoff_is_blocked_until_verification_passes",
      "public_submission_requires_operator_approval",
      "private_memory_must_not_enter_public_packets",
    ],
    operator_approval_required_for: [
      "public_submission",
      "claiming_bounty",
      "maintainer_outreach",
      "external_broadcast",
    ],
    notes: String(notes || "").trim(),
  };

  const payloadString = JSON.stringify(payload);
  if (String(trustZone || "").toLowerCase() === "outside_contact" && /private_memory|credential|secret|api[_-]?key/i.test(payloadString)) {
    throw new Error("Bounty A2A boundary violation: outside_contact ingest cannot contain private memory or credentials");
  }

  const envelope = createA2AMessage({
    id: `a2a_bounty_ingest_${bountyTask.bounty_id || "task"}`,
    senderId: fromAgent,
    recipientId: toAgent,
    messageType: "bounty_alert",
    payload,
    trustZone,
    priority,
    parentTaskId: parentTaskId || bountyTask.bounty_id,
    now,
  });

  return {
    schema_version: BOUNTY_A2A_INGEST_SCHEMA,
    envelope,
    payload_sha256: envelope.payload_sha256,
    ingest_contract_sha256: sha256Hex(JSON.stringify(envelope)),
    created_at: envelope.created_at,
  };
}

/**
 * Scans code snippets for common vulnerability patterns (smart contract and backend).
 */
export function scanAdversarialVulnerabilities(codeSnippet, { targetType = "smart_contract" } = {}) {
  const code = String(codeSnippet || "");
  const findings = [];

  if (targetType === "smart_contract" || targetType === "solidity") {
    // 1. Reentrancy check: state change alongside external call without nonReentrant guard
    if (/\.call\{value:|\.transfer\(|\.send\(/.test(code) && /balances\[|msg\.sender\]\s*=|owner\s*=/.test(code) && !/nonReentrant|reentrancyGuard/i.test(code)) {
      findings.push({
        type: "REENTRANCY_RISK",
        severity: "HIGH",
        description: "External value transfer detected alongside state mutation without nonReentrant guard.",
      });
    }

    // 2. Unchecked return value
    if (/\.call\(|\.delegatecall\(/.test(code) && !/require\(|if\s*\(!/.test(code)) {
      findings.push({
        type: "UNCHECKED_LOW_LEVEL_CALL",
        severity: "MEDIUM",
        description: "Low-level call return value is not explicitly validated.",
      });
    }

    // 3. tx.origin authorization
    if (/tx\.origin/.test(code)) {
      findings.push({
        type: "TX_ORIGIN_AUTHENTICATION",
        severity: "HIGH",
        description: "Use of tx.origin for authentication is vulnerable to phishing attacks. Use msg.sender.",
      });
    }
  }

  // Backend / General
  if (/child_process\.exec\s*\(|eval\s*\(/.test(code)) {
    findings.push({
      type: "UNSAFE_CODE_EXECUTION",
      severity: "CRITICAL",
      description: "Direct use of exec() or eval() without shell-less argument arrays exposes command injection.",
    });
  }

  const receipt = {
    schema_version: BOUNTY_VULNERABILITY_RECEIPT_SCHEMA,
    target_type: targetType,
    findings_count: findings.length,
    findings,
    clean: findings.length === 0,
    snippet_sha256: sha256Hex(code),
    scanned_at: new Date().toISOString(),
  };

  return receipt;
}

/**
 * Processes a bounty ingest queue job or sealed A2A envelope,
 * performing schema validation, EV triage, StateM runbook compilation,
 * and optional immediate FSM execution.
 */
export async function processBountyIngestJob(jobPayload, {
  executeImmediately = false,
  now = () => new Date(),
} = {}) {
  const payload = typeof jobPayload === "string" ? JSON.parse(jobPayload) : (jobPayload || {});

  // 1. Resolve bounty task from A2A envelope, ingest wrapper, or raw payload
  let bountyTask = null;
  let existingTriage = null;

  if (payload.envelope && payload.envelope.payload) {
    bountyTask = payload.envelope.payload.bounty_task;
    existingTriage = payload.envelope.payload.triage_receipt;
  } else if (payload.schema_version === BOUNTY_A2A_INGEST_SCHEMA) {
    bountyTask = payload.bounty_task;
    existingTriage = payload.triage_receipt;
  } else if (payload.schema_version === BOUNTY_TASK_SCHEMA) {
    bountyTask = payload;
  } else {
    // Attempt parse
    bountyTask = parseBountyTask(payload);
  }

  if (!bountyTask || bountyTask.schema_version !== BOUNTY_TASK_SCHEMA) {
    throw new Error("Invalid bounty payload: missing or malformed dizzy.bounty_task.v1");
  }

  // 2. Perform or verify EV triage
  const triageReceipt = existingTriage || calculateBountyEv({
    payoutUsd: bountyTask.payout_usd,
    difficulty: bountyTask.difficulty,
    hasReproductionTests: Boolean(bountyTask.test_command),
  });

  // 3. Check qualification recommendations
  const isDispatchable = triageReceipt.recommendation === "DISPATCH" || triageReceipt.recommendation === "EVAL_BENCHMARK_ONLY";

  if (!isDispatchable) {
    return {
      schema_version: BOUNTY_INGEST_JOB_RESULT_SCHEMA,
      bounty_id: bountyTask.bounty_id,
      qualified: false,
      status: "REJECTED",
      reason: `Triage recommendation '${triageReceipt.recommendation}' prevents automated dispatch`,
      triage_receipt: triageReceipt,
      runbook: null,
      fsm_receipt: null,
      processed_at: now().toISOString(),
    };
  }

  // 4. Generate StateM 4-phase Runbook
  const runbook = createBountyStateMRunbook(bountyTask);

  let fsmReceipt = null;
  if (executeImmediately) {
    const fsmExec = await executeStateMFsm({
      runbookName: runbook.receipt.runbook_name,
      verificationCommand: runbook.receipt.verification_command,
      maxVerificationRetries: 2,
    });
    fsmReceipt = fsmExec.receipt;
  }

  return {
    schema_version: BOUNTY_INGEST_JOB_RESULT_SCHEMA,
    bounty_id: bountyTask.bounty_id,
    qualified: true,
    status: executeImmediately && fsmReceipt ? (fsmReceipt.status === "PASSED" ? "COMPLETED" : "FAILED") : "QUALIFIED_AND_ROUTED",
    triage_receipt: triageReceipt,
    runbook,
    fsm_receipt: fsmReceipt,
    processed_at: now().toISOString(),
  };
}
