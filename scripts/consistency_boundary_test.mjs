/**
 * Consistency & Fiduciary Boundary Enforcement Bridge Test Suite.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  CONSISTENCY_CLASSES,
  CONSISTENCY_BADGES,
  CONSISTENCY_AUTHORITY_RULES,
  CONSISTENCY_CLAIM_SCHEMA,
  CONSISTENCY_CIRCUIT_BREAKER_SCHEMA,
  validateConsistencyTransition,
  evaluateCircuitBreaker,
  createConsistencyClaim,
  createConsistencyExportVoucher,
  verifyConsistencyExportVoucher,
  CONSISTENCY_EXPORT_VOUCHER_SCHEMA,
} from "../lib/consistency_boundary.mjs";

import {
  createTrajectoryContractReceipt,
} from "../lib/trajectory_contract.mjs";

console.log("=== [Consistency & Fiduciary Boundary Bridge Test Suite] ===");

// 1. Truth Classes & Authority Rules
console.log("\nTest 1: Truth Classes & Negative Guarantees...");
assert.equal(CONSISTENCY_BADGES[CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL], "[SYNTHETIC_REHEARSAL]");
assert.equal(CONSISTENCY_BADGES[CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED], "[LOCAL_RECEIPT_VERIFIED]");
assert.equal(CONSISTENCY_BADGES[CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED], "[GLOBAL_CONSENSUS_FINALIZED]");

// Negative guarantees on synthetic rehearsal
assert.equal(CONSISTENCY_AUTHORITY_RULES[CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL].promotion_authority, false);
assert.equal(CONSISTENCY_AUTHORITY_RULES[CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL].fiduciary_authority, false);

// Bounded local authority on receipt-verified
assert.equal(CONSISTENCY_AUTHORITY_RULES[CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED].promotion_authority, true);
assert.equal(CONSISTENCY_AUTHORITY_RULES[CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED].fiduciary_authority, false);

// Full fiduciary authority on global consensus
assert.equal(CONSISTENCY_AUTHORITY_RULES[CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED].promotion_authority, true);
assert.equal(CONSISTENCY_AUTHORITY_RULES[CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED].fiduciary_authority, true);
console.log("✓ Truth classes, badges, and negative authority guarantees strictly enforced.");

// 2. Transition Invariant Enforcement & Leapfrog Protection
console.log("\nTest 2: Transition Invariant Barriers & Leapfrog Protection...");

// A. Forbidden leapfrog: SYNTHETIC -> FINALIZED
const leapfrogAttempt = validateConsistencyTransition(
  CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL,
  CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED,
  { tx_hash: "0x123", dual_control_approved: true }
);
assert.equal(leapfrogAttempt.allowed, false);
assert(leapfrogAttempt.reason.includes("forbidden_leapfrog_transition"), "Leapfrog must be strictly forbidden");

// B. Synthetic -> Local Receipt Verified (Missing evidence digest fails)
const badSyntheticToLocal = validateConsistencyTransition(
  CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL,
  CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED,
  { evidence_sha256: "not-a-sha256", verdict: "VERIFIED_PASSED" }
);
assert.equal(badSyntheticToLocal.allowed, false);

// C. Synthetic -> Local Receipt Verified (Valid receipt passes)
const validSyntheticToLocal = validateConsistencyTransition(
  CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL,
  CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED,
  { evidence_sha256: "a".repeat(64), verdict: "VERIFIED_PASSED", orchestration_faults: 0 }
);
assert.equal(validSyntheticToLocal.allowed, true);

// D. Local Receipt Verified -> Global Consensus Finalized (Missing dual control fails)
const noDualControl = validateConsistencyTransition(
  CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED,
  CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED,
  { algorand_round: 65458070, tx_hash: "0xabc", dual_control_approved: false }
);
assert.equal(noDualControl.allowed, false);
assert(noDualControl.reason.includes("missing_dual_control_approval"));

// E. Local Receipt Verified -> Global Consensus Finalized (Algorand round + dual control passes)
const validSettlement = validateConsistencyTransition(
  CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED,
  CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED,
  { algorand_round: 65458070, tx_hash: "0xabc", dual_control_approved: true }
);
assert.equal(validSettlement.allowed, true);

// F. Autonomous inbound on-chain settlement passes without dual-control block
const validInboundSettlement = validateConsistencyTransition(
  CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED,
  CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED,
  { algorand_round: 65458070, tx_hash: "VRHCPC467JZ5NXTWQIERMGVF6U6KRXMGJIOFUXPYJG73OF4MGKBQ", inbound_settlement: true }
);
assert.equal(validInboundSettlement.allowed, true);
console.log("✓ Transition barriers prevent leapfrogging and require cryptographic custody + dual-control.");

// 3. Fail-Closed Circuit Breaker
console.log("\nTest 3: Fail-Closed Circuit Breaker Evaluation...");

// A. Healthy matching balances
const healthyCheck = evaluateCircuitBreaker({
  localProjection: { balance: 1500.50, state_root: "0xroot1" },
  rpcState: { balance: 1500.50, state_root: "0xroot1" },
  tolerance: 0.01,
});
assert.equal(healthyCheck.status, "HEALTHY");
assert.equal(healthyCheck.tripped, false);
assert.equal(healthyCheck.consistency_class, CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED);
assert.equal(healthyCheck.promotion_authority, true);

// B. State divergence exceeding tolerance -> Tripped circuit breaker
const divergedCheck = evaluateCircuitBreaker({
  localProjection: { balance: 1500.50, state_root: "0xroot1" },
  rpcState: { balance: 1200.00, state_root: "0xroot2" },
  tolerance: 0.01,
  claimId: "claim_pbm_dispute_1",
});
assert.equal(divergedCheck.status, "CIRCUIT_BREAKER_TRIGGERED");
assert.equal(divergedCheck.tripped, true);
assert.equal(divergedCheck.promotion_authority, false, "Promotion authority must be revoked on breaker trip");
assert.equal(divergedCheck.fiduciary_authority, false, "Fiduciary authority must be revoked on breaker trip");
assert.equal(divergedCheck.consistency_class, CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL);
assert.equal(divergedCheck.action_required, "OPERATOR_DUAL_CONTROL_SIGN_OFF");
assert.match(divergedCheck.evidence_sha256, /^[a-f0-9]{64}$/);
console.log(`✓ Circuit breaker tripped on divergence (diff=${divergedCheck.metrics.divergence}) and failed closed.`);

// 4. Consistency Claim Generation
console.log("\nTest 4: Consistency Claim Creation...");
const claim = createConsistencyClaim({
  claimId: "claim_algorand_round_65458070",
  consistencyClass: CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED,
  evidenceDigest: "e".repeat(64),
  settlementMeta: {
    network: "algorand_mainnet",
    round: 65458070,
    tx_hash: "0xalgo_tx_receipt_verified",
  },
});
assert.equal(claim.schema_version, CONSISTENCY_CLAIM_SCHEMA);
assert.equal(claim.badge, "[GLOBAL_CONSENSUS_FINALIZED]");
assert.equal(claim.promotion_authority, true);
assert.equal(claim.fiduciary_authority, true);
assert.match(claim.claim_sha256, /^[a-f0-9]{64}$/);
console.log(`✓ Consistency claim created with SHA-256 hash: ${claim.claim_sha256.slice(0, 16)}...`);

// 5. Integration with Trajectory Contract Receipts
console.log("\nTest 5: Trajectory Contract Receipt Integration...");
const mockStepResult = {
  contract_id: "step_coder_1",
  role: "coder",
  status: "PASSED",
  duration_ms: 120,
  ok: true,
  fault: null,
  evidence_sha256: "d".repeat(64),
};

const contractReceipt = createTrajectoryContractReceipt({
  trajectoryId: "traj_council_band_run",
  executionResults: [mockStepResult],
});

assert.equal(contractReceipt.verdict, "VERIFIED_PASSED");
assert.equal(contractReceipt.consistency_class, CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED);
assert.equal(contractReceipt.consistency_badge, "[LOCAL_RECEIPT_VERIFIED]");
assert.equal(contractReceipt.promotion_authority, true);
assert.match(contractReceipt.evidence_digest, /^[a-f0-9]{64}$/);
console.log(`✓ Trajectory contract receipt bound with ${contractReceipt.consistency_badge} (${contractReceipt.evidence_digest.slice(0, 16)}...)`);

// 6. Consistency Export Vouchers & Offline Verification
console.log("\nTest 6: Consistency Export Vouchers & Offline Verification...");
const sampleExportPayload = {
  exporter: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  claims: [{ id: "c1", amount_wei: "500000" }],
  merkle_root: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
};

// A. Synthetic Rehearsal Voucher
const synthVoucher = createConsistencyExportVoucher({
  consistencyClass: CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL,
  exporterAddress: sampleExportPayload.exporter,
  exportPayload: sampleExportPayload,
  summary: { total_claims: 1 },
});
assert.equal(synthVoucher.schema_version, CONSISTENCY_EXPORT_VOUCHER_SCHEMA);
assert.equal(synthVoucher.badge, "[SYNTHETIC_REHEARSAL]");
assert.equal(synthVoucher.fiduciary_authority, false);
assert.equal(synthVoucher.promotion_authority, false);
assert.match(synthVoucher.public_truth_disclaimer, /Zero fiduciary authority/);
assert.equal(verifyConsistencyExportVoucher(synthVoucher, sampleExportPayload), true);

// B. Global Consensus Finalized Voucher
const finalizedVoucher = createConsistencyExportVoucher({
  consistencyClass: CONSISTENCY_CLASSES.GLOBAL_CONSENSUS_FINALIZED,
  exporterAddress: sampleExportPayload.exporter,
  exportPayload: sampleExportPayload,
  summary: { total_claims: 1 },
});
assert.equal(finalizedVoucher.badge, "[GLOBAL_CONSENSUS_FINALIZED]");
assert.equal(finalizedVoucher.fiduciary_authority, true);
assert.equal(finalizedVoucher.promotion_authority, true);
assert.equal(verifyConsistencyExportVoucher(finalizedVoucher, sampleExportPayload), true);

// C. Tamper detection on payload mismatch
const modifiedPayload = { ...sampleExportPayload, claims: [] };
assert.equal(verifyConsistencyExportVoucher(finalizedVoucher, modifiedPayload), false, "Voucher must reject modified payload");

// D. Tamper detection on voucher property
const tamperedVoucher = { ...finalizedVoucher, consistency_class: CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL };
assert.equal(verifyConsistencyExportVoucher(tamperedVoucher, sampleExportPayload), false, "Tampered voucher properties must fail");

console.log("✓ Consistency export vouchers sealed with cryptographic offline verification.");

console.log("\n==================================================");
console.log("   ALL CONSISTENCY BOUNDARY TESTS PASSED!        ");
console.log("==================================================");

