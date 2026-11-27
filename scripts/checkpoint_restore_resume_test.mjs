/**
 * Phase 3a & 3b Checkpoint Save, Crash/Long-Wait Restore, and Snapshot Failover Suite.
 *
 * Verifies:
 * 1. Saving a multi-step StateM checkpoint, simulating process restart, and resuming work to `handoff`.
 * 2. Surviving a corrupted/truncated crash write or tampered tail snapshot by automatically failing
 *    over to the most recent SHA-256 verified snapshot and emitting a failover receipt.
 * 3. Surviving a multi-hour human wait (`waiting_for_approval -> approved -> resumed`) across restarts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { StateMCheckpointEngine, STATEM_FAILOVER_RESTORE_SCHEMA } from "../lib/statem_checkpoint.mjs";
import { executeStateMFsm } from "../lib/statem_runbook_bridge.mjs";
import { HitlApprovalGateway } from "../lib/hitl_approval_gateway.mjs";

console.log("=== Phase 3a/3b: Checkpoint Restore, Long Human Wait & Snapshot Failover Suite ===");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-ckpt-restore-"));

try {
  const ckptPath = path.join(tempDir, "statem.jsonl");
  const failoverPath = path.join(tempDir, "statem_failover.jsonl");

  // 1. Save checkpoint mid-flight (`execute` -> suspend), restart engine, and resume to `handoff`
  let phase1Crashed = false;
  const engine1 = new StateMCheckpointEngine(ckptPath, { failoverLogPath: failoverPath });
  const run1 = await executeStateMFsm({
    jobId: "job_restore_001",
    checkpointEngine: engine1,
    runbookName: "restore-runbook",
    planHandler: async () => ({ ok: true }),
    executeHandler: async () => {
      if (!phase1Crashed) {
        phase1Crashed = true;
        throw new Error("SUSPEND");
      }
      return { ok: true };
    },
    verifyHandler: async () => ({ ok: true }),
    handoffHandler: async () => ({ ok: true }),
  });
  assert.equal(run1.ok, false);
  assert.equal(run1.receipt.terminal_state, "execute");

  // Simulate truncated crash line + tampered snapshot appended on disk
  const validLine = fs.readFileSync(ckptPath, "utf8").trim().split("\n").pop();
  const tamperedObj = JSON.parse(validLine);
  tamperedObj.state = "handoff"; // forged jump without updating payload_sha256!
  fs.appendFileSync(ckptPath, `${JSON.stringify(tamperedObj)}\n{"job_id":"job_restore_001",TRUNCATED_CRASH\n`, "utf8");

  // Fresh engine instance restores last valid snapshot (`execute`), logs failover, and finishes runbook!
  const engine2 = new StateMCheckpointEngine(ckptPath, { failoverLogPath: failoverPath });
  const restored = engine2.readLatestCheckpoint("job_restore_001");
  assert.ok(restored);
  assert.equal(restored.state, "execute");

  const failovers = engine2.getFailoverRecords();
  assert.equal(failovers.length, 1);
  assert.equal(failovers[0].schema_version, STATEM_FAILOVER_RESTORE_SCHEMA);
  assert.equal(failovers[0].status, "RESTORED_FROM_LAST_VALID_SNAPSHOT");
  assert.ok(failovers[0].skipped_corrupted_or_tampered_records >= 2);

  const run2 = await executeStateMFsm({
    jobId: "job_restore_001",
    checkpointEngine: engine2,
    runbookName: "restore-runbook",
    planHandler: async () => {
      throw new Error("plan_must_not_re_execute_after_checkpoint_restore");
    },
    executeHandler: async () => ({ ok: true }),
    verifyHandler: async () => ({ ok: true }),
    handoffHandler: async () => ({ ok: true }),
  });
  assert.equal(run2.ok, true);
  assert.equal(run2.receipt.terminal_state, "COMPLETED");
  console.log("  [PASS] Restored valid StateM snapshot after corrupted/tampered tail and resumed to COMPLETED.");

  // 2. Long human wait (18 hours) + restart recovery
  const hitlDir = path.join(tempDir, "hitl");
  const tStart = new Date("2026-11-26T00:00:00.000Z");
  const tAfter18Hours = new Date("2026-11-26T18:00:00.000Z");

  const gwBoot1 = new HitlApprovalGateway({ ledgerDir: hitlDir, secret: "long-wait-secret-key-32-characters!", now: () => tStart });
  gwBoot1.startRun({
    runId: "long_wait_run_01",
    actionType: "promote_verified_patch",
    initialProgress: { step_index: 3, step_name: "council_checks_green", artifacts: ["patch.diff"] },
  });
  const req = gwBoot1.requestApproval("long_wait_run_01", { expiresAfterSec: 86400 });

  // 18 hours later on a freshly booted server process:
  const gwBoot2 = new HitlApprovalGateway({ ledgerDir: hitlDir, secret: "long-wait-secret-key-32-characters!", now: () => tAfter18Hours });
  gwBoot2.resolveCheckpoint({
    resumeToken: req.resume_token,
    action: "APPROVE",
    approverId: "operator_morning_shift",
    now: tAfter18Hours,
  });
  const resumed = gwBoot2.resumeCheckpoint({
    resumeToken: req.resume_token,
    runId: "long_wait_run_01",
    now: tAfter18Hours,
  });
  assert.equal(resumed.workflow_state, "resumed");
  assert.equal(resumed.saved_progress.step_index, 3);
  assert.deepEqual(resumed.saved_progress.artifacts, ["patch.diff"]);
  console.log("  [PASS] Long 18-hour human approval wait restored and resumed cleanly across process restarts.");

  console.log("CHECKPOINT_RESTORE_RESUME_TESTS_OK");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
