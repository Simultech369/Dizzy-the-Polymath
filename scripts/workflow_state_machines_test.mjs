/**
 * Phase 0.5 Verification Suite: Explicit Workflow State Machines, Crash-Safe Resume,
 * and Illegal Transition Rejection.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  WORKFLOW_CATALOG,
  HUMAN_APPROVAL_STATES,
  STREAMING_STATES,
  IllegalWorkflowTransitionError,
  createHumanApprovalStateMachine,
  createStreamStateMachine,
} from "../lib/workflow_state_machines.mjs";
import { HitlApprovalGateway } from "../lib/hitl_approval_gateway.mjs";
import { StreamingLatencyTracker } from "../lib/sse_stream.mjs";

console.log("=== Phase 0.5: Explicit Workflow State Machines & Crash Resume Suite ===");

// 1. Verify Complete Workflow Catalog
console.log("[Test 1] Verifying staged workflow catalog completeness...");
assert.ok(WORKFLOW_CATALOG.length >= 12, "Expected complete staged workflow catalog");
const requiredIds = [
  "human_approval",
  "streaming_response",
  "statem_runbook",
  "cognitive_memory_lifecycle",
  "tool_execution_guardrails",
  "a2a_mailbox_delivery",
  "model_routing_fallback",
  "context_assembly_budget",
  "dashboard_ui_lifecycle",
];
for (const id of requiredIds) {
  const entry = WORKFLOW_CATALOG.find((item) => item.id === id);
  assert.ok(entry, `Missing required workflow '${id}' in WORKFLOW_CATALOG`);
  assert.ok(Array.isArray(entry.states) && entry.states.length >= 3, `Workflow '${id}' must declare named states`);
  assert.ok(entry.test_command, `Workflow '${id}' must declare its verification test command`);
}
console.log(`  [PASS] ${WORKFLOW_CATALOG.length} staged workflows inventoried with named states & test commands.`);

// 2. Human-Approval Crash-Resumable Happy Path + Illegal Jump Failures
console.log("[Test 2] Verifying crash-safe human-approval lifecycle and illegal jump failures...");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-phase05-hitl-"));

try {
  const t0 = new Date("2026-11-25T20:00:00.000Z");
  const secret = "phase05-crash-safe-hitl-secret-32bytes";

  // Instance 1: Start run, save multi-step progress, then pause for human approval
  const gw1 = new HitlApprovalGateway({ ledgerDir: tempDir, secret, now: () => t0 });
  const started = gw1.startRun({
    runId: "run_crash_test_001",
    actionType: "council_promotion_gate",
    actionPayload: { candidate_id: "W-0200", target_env: "local_verified" },
    context: { trust_zone: "private_self" },
    initialProgress: { step_index: 1, step_name: "plan_verified", completed_steps: ["plan"] },
  });
  assert.equal(started.workflow_state, HUMAN_APPROVAL_STATES.RUNNING);

  // Illegal jump check: running -> approved or running -> resumed MUST fail
  assert.throws(
    () => gw1.transitionRunState("run_crash_test_001", HUMAN_APPROVAL_STATES.APPROVED),
    (err) => err instanceof IllegalWorkflowTransitionError && err.code === "ILLEGAL_STATE_TRANSITION"
  );
  assert.throws(
    () => gw1.transitionRunState("run_crash_test_001", HUMAN_APPROVAL_STATES.RESUMED),
    (err) => err instanceof IllegalWorkflowTransitionError && err.code === "ILLEGAL_STATE_TRANSITION"
  );

  // Save step 2 progress before pausing at sensitive boundary
  gw1.saveProgress("run_crash_test_001", {
    step_index: 2,
    step_name: "tests_passed_awaiting_signoff",
    completed_steps: ["plan", "execute", "verify"],
    partial_outputs: { diff_sha256: "abc123def456", suites_passed: 91 },
  });

  const requested = gw1.requestApproval("run_crash_test_001", {
    reason: "Promotion requires human operator approval",
  });
  assert.equal(requested.run.workflow_state, HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL);
  const resumeToken = requested.resume_token;

  // Illegal jump check: waiting_for_approval -> resumed MUST fail (cannot skip approval!)
  assert.throws(
    () => gw1.resumeCheckpoint({ resumeToken, runId: "run_crash_test_001" }),
    (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "waiting_for_approval" && err.toState === "resumed"
  );

  // --- SIMULATE PROCESS CRASH #1 (discard gw1, boot fresh gw2 from disk) ---
  const t1 = new Date("2026-11-25T20:05:00.000Z");
  const gw2 = new HitlApprovalGateway({ ledgerDir: tempDir, secret, now: () => t1 });
  const recoverable = gw2.listRecoverableRuns();
  assert.equal(recoverable.length, 1);
  assert.equal(recoverable[0].run_id, "run_crash_test_001");
  assert.equal(recoverable[0].workflow_state, HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL);
  assert.equal(recoverable[0].saved_progress.step_index, 2);

  // Operator approves on recovered gateway
  const approved = gw2.resolveCheckpoint({
    resumeToken,
    action: "APPROVE",
    approverId: "operator_josh",
    reason: "Verified council audit receipt",
    now: t1,
  });
  assert.equal(approved.workflow_state, HUMAN_APPROVAL_STATES.APPROVED);

  // Illegal jump check: approved -> rejected MUST fail
  assert.throws(
    () => gw2.resolveCheckpoint({ resumeToken, action: "REJECT", approverId: "rogue", now: t1 }),
    (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "approved" && err.toState === "rejected"
  );

  // --- SIMULATE PROCESS CRASH #2 BEFORE WORKER RESUMES (discard gw2, boot fresh gw3) ---
  const t2 = new Date("2026-11-25T20:06:00.000Z");
  const gw3 = new HitlApprovalGateway({ ledgerDir: tempDir, secret, now: () => t2 });
  const resumed = gw3.resumeCheckpoint({
    resumeToken,
    runId: "run_crash_test_001",
    actorId: "worker_recovered",
    now: t2,
  });

  assert.equal(resumed.ok, true);
  assert.equal(resumed.workflow_state, HUMAN_APPROVAL_STATES.RESUMED);
  assert.equal(resumed.saved_progress.step_index, 2);
  assert.equal(resumed.saved_progress.step_name, "tests_passed_awaiting_signoff");
  assert.deepEqual(resumed.saved_progress.completed_steps, ["plan", "execute", "verify"]);
  assert.equal(resumed.saved_progress.partial_outputs.suites_passed, 91);

  // Illegal jump checks after terminal `resumed`: double-resume and cancel after resume MUST fail
  assert.throws(
    () => gw3.resumeCheckpoint({ resumeToken, runId: "run_crash_test_001", now: t2 }),
    (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "resumed" && err.toState === "resumed"
  );
  assert.throws(
    () => gw3.cancelRun({ runId: "run_crash_test_001", now: t2 }),
    (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "resumed" && err.toState === "cancelled"
  );

  // Rejection -> Cancelled path & illegal rejected -> resumed jump
  const r2 = gw3.startRun({
    runId: "run_reject_test_002",
    actionType: "external_broadcast",
    actionPayload: { target: "public" },
  });
  assert.equal(r2.workflow_state, "running");
  const req2 = gw3.requestApproval("run_reject_test_002");
  const rej2 = gw3.resolveCheckpoint({
    resumeToken: req2.resume_token,
    action: "REJECT",
    approverId: "operator_josh",
    reason: "Blocked external broadcast",
  });
  assert.equal(rej2.workflow_state, HUMAN_APPROVAL_STATES.REJECTED);

  // Illegal jump: rejected -> resumed MUST fail!
  assert.throws(
    () => gw3.resumeCheckpoint({ resumeToken: req2.resume_token, runId: "run_reject_test_002" }),
    (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "rejected" && err.toState === "resumed"
  );

  // Legal transition: rejected -> cancelled succeeds; cancelled -> running fails
  const cancelled = gw3.cancelRun({ runId: "run_reject_test_002", reason: "Cleaned up rejected run" });
  assert.equal(cancelled.workflow_state, HUMAN_APPROVAL_STATES.CANCELLED);
  assert.throws(
    () => gw3.transitionRunState("run_reject_test_002", HUMAN_APPROVAL_STATES.RUNNING),
    (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "cancelled"
  );

  // Verify hash-chained audit log across all 3 crash-recovered gateway instances!
  const auditCheck = gw3.verifyAuditLog();
  assert.equal(auditCheck.valid, true);
  assert.ok(auditCheck.entry_count >= 9);
  console.log("  [PASS] Crash-safe checkpoint/resume and illegal transition rejection verified.");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// 3. Streaming State Machine: open -> streaming -> stalled -> completed | aborted
console.log("[Test 3] Verifying explicit streaming state machine and illegal jump failures...");
const tracker = new StreamingLatencyTracker({
  streamId: "stream_test_01",
  stallThresholdMs: 1000,
  stallAbortMs: 5000,
});
assert.equal(tracker.getWorkflowState(), STREAMING_STATES.OPEN);

const f1 = tracker.recordFrame(1000);
assert.equal(f1.workflow_state, STREAMING_STATES.STREAMING);

// Stall detected at +1500ms -> transitions to `stalled`
const f2 = tracker.recordFrame(2500);
assert.equal(f2.stalled, true);
assert.equal(f2.workflow_state, STREAMING_STATES.STALLED);

// Fast frame at +200ms -> recovers `stalled -> streaming`
const f3 = tracker.recordFrame(2700);
assert.equal(f3.stalled, false);
assert.equal(f3.workflow_state, STREAMING_STATES.STREAMING);

// Complete stream -> `completed`
tracker.complete(2800);
assert.equal(tracker.getWorkflowState(), STREAMING_STATES.COMPLETED);

// Illegal jumps after `completed`: cannot emit frames, abort, or reopen!
assert.throws(
  () => tracker.recordFrame(2900),
  (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "completed"
);
assert.throws(
  () => tracker.abort("late_abort", 2950),
  (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "completed" && err.toState === "aborted"
);

const sm = createStreamStateMachine({ streamId: "stream_test_02" });
sm.transition(STREAMING_STATES.STREAMING);
assert.throws(
  () => sm.transition(STREAMING_STATES.OPEN),
  (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "streaming" && err.toState === "open"
);
sm.transition(STREAMING_STATES.ABORTED);
assert.throws(
  () => sm.transition(STREAMING_STATES.COMPLETED),
  (err) => err instanceof IllegalWorkflowTransitionError && err.fromState === "aborted" && err.toState === "completed"
);

const hm = createHumanApprovalStateMachine({ runId: "hm_unit_01" });
assert.equal(hm.state, "running");
assert.deepEqual(hm.getAllowedNextStates(), ["waiting_for_approval", "cancelled"]);
console.log("  [PASS] Streaming state machine transitions and illegal jump guards verified.");

console.log("\nWORKFLOW_STATE_MACHINES_TESTS_OK\n");
