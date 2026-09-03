/**
 * Adversarial Verification Harness
 *
 * Deterministically tests and intercepts 8 hostile attack vectors:
 * 1. Fake memory claims with unverified provenance
 * 2. Forged receipt payload hashes
 * 3. Stale / bypassed model qualification receipts
 * 4. Malformed tool calls with directory traversal / drive escapes
 * 5. Poisoned context packets with prompt injection / unverified artifacts
 * 6. Unsafe git patch paths (.env, .gitmodules, sanitization failures)
 * 7. Contradictory model verdicts (tally vs vote contradictions)
 * 8. Unavailable or fallback-enabled routes assigned to private packets
 *
 * Schema: dizzy.adversarial_verification.v1
 * Authority: Deterministic machine-enforced verification
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const ADVERSARIAL_VERIFICATION_SCHEMA = "dizzy.adversarial_verification.v1";

export class AdversarialVerificationHarness {
  constructor(options = {}) {
    this.fixturesPath = options.fixturesPath || path.resolve(process.cwd(), "scripts/fixtures/adversarial_verification_fixtures.json");
  }

  loadFixtures() {
    if (!fs.existsSync(this.fixturesPath)) {
      throw new Error(`Adversarial fixtures file not found at: ${this.fixturesPath}`);
    }
    const raw = fs.readFileSync(this.fixturesPath, "utf8");
    return JSON.parse(raw);
  }

  evaluateScenario(scenario) {
    const { id, attack_vector, payload, expected_gate, expected_rejection_reason } = scenario;
    let intercepted = false;
    let interceptingGate = null;
    let rejectionReason = null;

    switch (attack_vector) {
      case "fake_memory_claim": {
        interceptingGate = "provenance_verifier";
        if (!payload.verified_in_ledger || !payload.provenance_hash) {
          intercepted = true;
          rejectionReason = "UNVERIFIED_PROVENANCE_CLAIM";
        }
        break;
      }

      case "forged_receipt_hash": {
        interceptingGate = "cryptographic_hash_verifier";
        const computedSha = crypto.createHash("sha256").update(payload.actual_content || "").digest("hex");
        if (computedSha !== payload.declared_payload_sha256) {
          intercepted = true;
          rejectionReason = "PAYLOAD_DIGEST_MISMATCH";
        }
        break;
      }

      case "stale_qualification": {
        interceptingGate = "model_qualification_gate";
        const allGatesPassed = Boolean(
          payload.benign_control_passed &&
          payload.grounded_bug_passed &&
          payload.exact_line_quote_verified &&
          payload.json_schema_conformity
        );
        const isFresh = payload.status === "REVIEW_USABLE_FRESH";
        const isExpired = payload.expires_at <= payload.evaluated_at;

        if (!allGatesPassed || !isFresh || isExpired) {
          intercepted = true;
          rejectionReason = "QUALIFICATION_GATES_FAILED";
        }
        break;
      }

      case "malformed_tool_call": {
        interceptingGate = "path_confinement_sandbox";
        const params = payload.parameters || {};
        const allPaths = Object.values(params).filter(v => typeof v === "string");
        const hasEscape = allPaths.some(p => 
          /^[a-zA-Z]:[\\/]/.test(p) || 
          p.includes("../") || 
          p.includes("..\\")
        );
        if (hasEscape) {
          intercepted = true;
          rejectionReason = "PATH_TRAVERSAL_DETECTED";
        }
        break;
      }

      case "poisoned_context_packet": {
        interceptingGate = "context_hygiene_and_provenance";
        if (payload.sensitivity_tier === "PUBLIC_SAFE" && (payload.unverified_private_artifacts || 0) > 0) {
          intercepted = true;
          rejectionReason = "UNVERIFIED_ARTIFACTS_IN_PUBLIC_PACKET";
        } else if (payload.raw_text && /SYSTEM OVERRIDE|bypass.*verification/i.test(payload.raw_text)) {
          intercepted = true;
          rejectionReason = "PROMPT_INJECTION_AUTHORITY_OVERRIDE";
        }
        break;
      }

      case "unsafe_patch_path": {
        interceptingGate = "patch_sanitizer";
        const forbiddenPatterns = [".env", ".gitmodules", ".git/", "id_rsa", "credentials"];
        const touchesForbidden = (payload.target_files || []).some(f => 
          forbiddenPatterns.some(p => f.includes(p))
        );
        if (touchesForbidden || payload.sanitization_passed === false) {
          intercepted = true;
          rejectionReason = "FORBIDDEN_TARGET_FILE_MODIFICATION";
        }
        break;
      }

      case "contradictory_model_verdict": {
        interceptingGate = "council_ballot_tally_verifier";
        const votes = payload.actual_votes || [];
        const actualApprovals = votes.filter(v => v.decision === "approve").length;
        const requiredApprovals = Math.ceil((2.0 * (payload.quorum_size || 3)) / 3.0);
        const supermajorityAchieved = actualApprovals >= requiredApprovals;

        if (actualApprovals !== payload.declared_approvals || (payload.final_verdict === "APPROVED" && !supermajorityAchieved)) {
          intercepted = true;
          rejectionReason = "SUPERMAJORITY_TALLY_VIOLATION";
        }
        break;
      }

      case "unavailable_route_marked_usable": {
        interceptingGate = "route_compliance_attestation_gate";
        const isPrivate = payload.compliance_tier in { "HOSTED_NO_TRAIN": 1, "LOCAL_ONLY_VERIFIED": 1, "APEX_PAID": 1 } ||
                          payload.packet_sensitivity !== "PUBLIC_SAFE";
        if (isPrivate && payload.fallbacks_allowed) {
          intercepted = true;
          rejectionReason = "PRIVATE_ROUTE_CANNOT_ALLOW_FALLBACKS";
        }
        break;
      }

      default: {
        throw new Error(`Unknown attack vector: ${attack_vector}`);
      }
    }

    return {
      scenario_id: id,
      attack_vector,
      deterministic_intercepted: intercepted,
      intercepting_gate: interceptingGate,
      rejection_reason: rejectionReason,
      expected_gate: expected_gate,
      expected_rejection_reason: expected_rejection_reason,
      outcome: intercepted ? "VERIFIED_BLOCKED" : "CRITICAL_BYPASS_DETECTED"
    };
  }

  runDrill() {
    const fixtureData = this.loadFixtures();
    const scenarios = fixtureData.scenarios || [];
    const results = scenarios.map(s => this.evaluateScenario(s));

    const total = results.length;
    const blocked = results.filter(r => r.deterministic_intercepted).length;
    const bypasses = total - blocked;

    const receipt = {
      schema: ADVERSARIAL_VERIFICATION_SCHEMA,
      timestamp: Math.floor(Date.now() / 1000),
      scenarios_tested: total,
      deterministic_blocks: blocked,
      bypasses_allowed: bypasses,
      who_caught_what: results,
      verdict: bypasses === 0 ? "ADVERSARIAL_VERIFICATION_PASSED" : "ADVERSARIAL_VERIFICATION_FAILED"
    };

    return receipt;
  }
}
