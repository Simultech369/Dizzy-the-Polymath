/**
 * Verification Test Suite for HITL Approval Gateway & Immutable Audit Log
 *
 * Verifies:
 * 1. Checkpoint creation, immutable state freezing, and HMAC resume token generation
 * 2. Operator approval workflow (with and without payload modification)
 * 3. Operator rejection workflow
 * 4. Fail-closed token verification (mismatched payloads, pending state, tampering)
 * 5. Time-based token expiration
 * 6. Cryptographic hash-chain audit log verification and tamper detection
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  HITL_CHECKPOINT_SCHEMA,
  HITL_RESOLUTION_SCHEMA,
  HITL_AUDIT_ENTRY_SCHEMA,
  HitlApprovalGateway,
  sha256Hex,
} from "../lib/hitl_approval_gateway.mjs";

console.log("==================================================");
console.log("   HITL Approval Gateway & Audit Log Suite        ");
console.log("==================================================\n");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-hitl-test-"));

try {
  const fixedNow = new Date("2026-10-01T12:00:00.000Z");
  const gateway = new HitlApprovalGateway({
    ledgerDir: tempDir,
    secret: "test-secret-salt-super-secure-32b",
    now: () => fixedNow,
  });

  // TEST 1: Checkpoint creation & state freezing
  console.log("[Test 1] Checkpoint creation and HMAC token generation...");
  const actionPayload = {
    action: "pbm_rebate_settlement",
    batch_id: "batch_2026_10_01",
    amount_usd: 125000,
    recipient: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  };

  const { checkpoint, resume_token, receipt } = gateway.createCheckpoint({
    actionType: "outbound_fiduciary_settlement",
    actionPayload,
    context: {
      trust_zone: "private_self",
      consistency_class: "LOCAL_RECEIPT_VERIFIED",
      risk_score: 0.95,
      confidence: 0.65,
    },
    expiresAfterSec: 3600,
    highStakes: true,
  });

  assert.equal(checkpoint.schema_version, HITL_CHECKPOINT_SCHEMA);
  assert.equal(checkpoint.state, "PENDING_APPROVAL");
  assert.ok(resume_token.startsWith("hitl_tok_"));
  assert.equal(receipt.state, "PENDING_APPROVAL");
  assert.ok(receipt.receipt_sha256);
  assert.ok(receipt.audit_entry_hash);

  const pendingList = gateway.listPending({ now: fixedNow });
  assert.equal(pendingList.length, 1);
  assert.equal(pendingList[0].checkpoint_id, checkpoint.checkpoint_id);
  console.log("  [PASS] Test 1: Checkpoint created with frozen state and pending audit entry");

  // TEST 2: Verification fails before approval
  console.log("\n[Test 2] Verification fails while in PENDING_APPROVAL...");
  const preApprovalCheck = gateway.verifyResumeToken(resume_token, actionPayload, { now: fixedNow });
  assert.equal(preApprovalCheck.valid, false);
  assert.equal(preApprovalCheck.reason, "checkpoint_state_pending_approval");
  console.log("  [PASS] Test 2: Resume token correctly rejected before operator approval");

  // TEST 3: Operator approval workflow
  console.log("\n[Test 3] Operator approval workflow...");
  const approvalResult = gateway.resolveCheckpoint({
    resumeToken: resume_token,
    action: "APPROVE",
    approverId: "operator_alice",
    signature: "sig_ed25519_alice_approval_token",
    reason: "Dual-control signoff verified against treasury batch ledger",
    now: fixedNow,
  });

  assert.equal(approvalResult.ok, true);
  assert.equal(approvalResult.state, "APPROVED");
  assert.equal(approvalResult.resolution_receipt.schema_version, HITL_RESOLUTION_SCHEMA);
  assert.equal(approvalResult.resolution_receipt.state, "APPROVED");
  assert.equal(approvalResult.resolution_receipt.actor_id, "operator_alice");
  assert.equal(approvalResult.resolution_receipt.modified, false);
  assert.ok(approvalResult.resolution_receipt.resolution_sha256);

  // Now verifyResumeToken must succeed
  const postApprovalCheck = gateway.verifyResumeToken(resume_token, actionPayload, { now: fixedNow });
  assert.equal(postApprovalCheck.valid, true);
  assert.equal(postApprovalCheck.state, "APPROVED");
  assert.equal(postApprovalCheck.approver_id, "operator_alice");
  console.log("  [PASS] Test 3: Operator approval succeeds and unlocks execution token");

  // TEST 4: Payload mismatch detection (tampered payload verification)
  console.log("\n[Test 4] Tampered payload verification fail-closed...");
  const tamperedPayload = { ...actionPayload, amount_usd: 999999 };
  const tamperedCheck = gateway.verifyResumeToken(resume_token, tamperedPayload, { now: fixedNow });
  assert.equal(tamperedCheck.valid, false);
  assert.equal(tamperedCheck.reason, "action_payload_hash_mismatch");
  console.log("  [PASS] Test 4: Token cannot be used to execute an altered payload");

  // TEST 5: Operator approval with payload modification
  console.log("\n[Test 5] Approval with modification (fiduciary override)...");
  const cp2 = gateway.createCheckpoint({
    actionType: "outbound_fiduciary_settlement",
    actionPayload: { batch_id: "batch_2", amount_usd: 50000 },
    expiresAfterSec: 3600,
    now: fixedNow,
  });

  const modifiedPayload = { batch_id: "batch_2", amount_usd: 35000, override_note: "clamped by risk officer" };
  const modApproval = gateway.resolveCheckpoint({
    resumeToken: cp2.resume_token,
    action: "APPROVE",
    approverId: "risk_officer_bob",
    modifiedPayload,
    reason: "Approved with lowered cap",
    now: fixedNow,
  });

  assert.equal(modApproval.ok, true);
  assert.equal(modApproval.resolution_receipt.modified, true);
  assert.deepEqual(modApproval.resolved_payload, modifiedPayload);

  // Verification against modified payload succeeds, original fails
  assert.equal(gateway.verifyResumeToken(cp2.resume_token, modifiedPayload, { now: fixedNow }).valid, true);
  assert.equal(gateway.verifyResumeToken(cp2.resume_token, { batch_id: "batch_2", amount_usd: 50000 }, { now: fixedNow }).valid, false);
  console.log("  [PASS] Test 5: Approval with modification tracks provenance and updates valid execution hash");

  // TEST 6: Operator rejection workflow
  console.log("\n[Test 6] Operator rejection workflow...");
  const cp3 = gateway.createCheckpoint({
    actionType: "model_cascade_override",
    actionPayload: { prompt: "dangerous raw execution" },
    expiresAfterSec: 3600,
    now: fixedNow,
  });

  const rejectionResult = gateway.resolveCheckpoint({
    resumeToken: cp3.resume_token,
    action: "REJECT",
    approverId: "security_auditor_eve",
    reason: "Potential prompt injection in payload",
    now: fixedNow,
  });

  assert.equal(rejectionResult.ok, true);
  assert.equal(rejectionResult.state, "REJECTED");
  assert.equal(rejectionResult.resolution_receipt.state, "REJECTED");

  const rejectCheck = gateway.verifyResumeToken(cp3.resume_token, null, { now: fixedNow });
  assert.equal(rejectCheck.valid, false);
  assert.equal(rejectCheck.reason, "checkpoint_state_rejected");
  console.log("  [PASS] Test 6: Rejection permanently invalidates checkpoint and records auditor reason");

  // TEST 7: Expiration handling
  console.log("\n[Test 7] Expiration handling...");
  const cp4 = gateway.createCheckpoint({
    actionType: "timed_settlement",
    actionPayload: { id: "timed_1" },
    expiresAfterSec: 10,
    now: fixedNow,
  });

  const futureNow = new Date("2026-10-01T12:01:00.000Z"); // 60s later
  assert.throws(
    () => gateway.resolveCheckpoint({ resumeToken: cp4.resume_token, action: "APPROVE", approverId: "alice", now: futureNow }),
    /expired/i
  );
  console.log("  [PASS] Test 7: Expired checkpoints cannot be approved");

  // TEST 8: Audit log cryptographic hash-chain verification
  console.log("\n[Test 8] Audit log cryptographic hash-chain verification...");
  const auditVerification = gateway.verifyAuditLog();
  assert.equal(auditVerification.valid, true);
  assert.ok(auditVerification.entry_count >= 6);
  assert.match(auditVerification.head_hash, /^[a-f0-9]{64}$/i);
  console.log(`  [PASS] Test 8: Audit log verified (${auditVerification.entry_count} entries chained from genesis)`);

  // TEST 9: Audit log tamper detection
  console.log("\n[Test 9] Audit log tamper detection...");
  const auditPath = path.join(tempDir, "audit_log.jsonl");
  const rawAudit = fs.readFileSync(auditPath, "utf8");
  const lines = rawAudit.split(/\r?\n/).filter(Boolean);
  
  // Tamper with the details of the first entry
  const entry0 = JSON.parse(lines[0]);
  entry0.details.action_type = "MALICIOUSLY_ALTERED_TYPE";
  lines[0] = JSON.stringify(entry0);
  fs.writeFileSync(auditPath, lines.join("\n") + "\n", "utf8");

  assert.throws(
    () => gateway.verifyAuditLog(),
    /Audit log entry tamper/i,
    "Gateway must detect tampered audit log entry"
  );
  console.log("  [PASS] Test 9: Tamper detection catches modified audit log entries");

  console.log("\n[test:hitl-gateway] ALL 9 TESTS PASSED CLEANLY.\n");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
