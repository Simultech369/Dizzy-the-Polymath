import assert from "node:assert/strict";
import {
  RunawayExecutionWatchdog,
  verifyRunawaySpinReceipt,
  RUNAWAY_SPIN_RECEIPT_SCHEMA,
} from "../lib/runaway_execution_watchdog.mjs";
import { HitlApprovalGateway } from "../lib/hitl_approval_gateway.mjs";

console.log("[RUNAWAY_WATCHDOG_TEST] Starting test suite...");

// Test 1: Normal progressing trajectory
{
  const watchdog = new RunawayExecutionWatchdog({
    maxSteps: 10,
    maxConsecutiveIdenticalActions: 3,
    maxStagnantSteps: 4,
  });

  const res1 = watchdog.recordStep({ tool: "read_file", args: { path: "spec.md" }, stateDelta: { read: true } });
  assert.equal(res1.ok, true);
  assert.equal(res1.step_count, 1);

  const res2 = watchdog.recordStep({ tool: "search_code", args: { query: "router" }, stateDelta: { found: 2 } });
  assert.equal(res2.ok, true);
  assert.equal(res2.step_count, 2);

  const res3 = watchdog.recordStep({ tool: "write_file", args: { path: "out.txt" }, stateDelta: { written: true } });
  assert.equal(res3.ok, true);
  assert.equal(res3.step_count, 3);

  console.log("  [PASS] Test 1: Normal progressing trajectory succeeds");
}

// Test 2: Consecutive identical action spin (repeated calls)
{
  const watchdog = new RunawayExecutionWatchdog({
    maxConsecutiveIdenticalActions: 3,
  });

  watchdog.recordStep({ tool: "check_status", args: { id: 1 }, stateDelta: { s: 1 } });
  watchdog.recordStep({ tool: "check_status", args: { id: 1 }, stateDelta: { s: 1 } });
  const tripRes = watchdog.recordStep({ tool: "check_status", args: { id: 1 }, stateDelta: { s: 1 } });

  assert.equal(tripRes.ok, false);
  assert.equal(tripRes.status, "TRIPPED");
  assert.equal(tripRes.trip_reason, "REPEATED_IDENTICAL_ACTION_SPIN");
  assert.equal(tripRes.receipt.schema_version, RUNAWAY_SPIN_RECEIPT_SCHEMA);
  assert.equal(verifyRunawaySpinReceipt(tripRes.receipt), true);

  // Subsequent call while tripped fails immediately
  const postTrip = watchdog.recordStep({ tool: "other_tool" });
  assert.equal(postTrip.ok, false);
  assert.match(postTrip.error, /watchdog_tripped/);

  console.log("  [PASS] Test 2: Repeated identical action spin detection");
}

// Test 3: Cyclic oscillation detection (period 2)
{
  const watchdog = new RunawayExecutionWatchdog({
    maxConsecutiveIdenticalActions: 3,
  });

  watchdog.recordStep({ tool: "tool_alpha", args: { x: 1 }, stateDelta: { step: 1 } });
  watchdog.recordStep({ tool: "tool_beta", args: { y: 2 }, stateDelta: { step: 2 } });
  watchdog.recordStep({ tool: "tool_alpha", args: { x: 1 }, stateDelta: { step: 3 } });
  const cycleRes = watchdog.recordStep({ tool: "tool_beta", args: { y: 2 }, stateDelta: { step: 4 } });

  assert.equal(cycleRes.ok, false);
  assert.equal(cycleRes.status, "TRIPPED");
  assert.equal(cycleRes.trip_reason, "CYCLIC_ACTION_OSCILLATION");
  assert.equal(verifyRunawaySpinReceipt(cycleRes.receipt), true);

  console.log("  [PASS] Test 3: Cyclic tool alternation detected");
}

// Test 4: Zero progress stagnation (4 consecutive steps without state delta)
{
  const watchdog = new RunawayExecutionWatchdog({
    maxStagnantSteps: 4,
  });

  watchdog.recordStep({ tool: "tool_a", stateDelta: {} });
  watchdog.recordStep({ tool: "tool_b", stateDelta: null });
  watchdog.recordStep({ tool: "tool_c" }); // no delta
  const stagRes = watchdog.recordStep({ tool: "tool_d", stateDelta: {} });

  assert.equal(stagRes.ok, false);
  assert.equal(stagRes.status, "TRIPPED");
  assert.equal(stagRes.trip_reason, "ZERO_PROGRESS_STAGNATION");
  assert.equal(verifyRunawaySpinReceipt(stagRes.receipt), true);

  console.log("  [PASS] Test 4: Zero progress stagnation detected");
}

// Test 5: Hard step budget ceiling
{
  const watchdog = new RunawayExecutionWatchdog({
    maxSteps: 5,
  });

  for (let i = 1; i <= 5; i++) {
    const res = watchdog.recordStep({ tool: `tool_${i}`, stateDelta: { idx: i } });
    assert.equal(res.ok, true);
  }

  const budgetTrip = watchdog.recordStep({ tool: "tool_6", stateDelta: { idx: 6 } });
  assert.equal(budgetTrip.ok, false);
  assert.equal(budgetTrip.trip_reason, "MAX_STEPS_EXCEEDED");
  assert.equal(verifyRunawaySpinReceipt(budgetTrip.receipt), true);

  console.log("  [PASS] Test 5: Hard step budget ceiling enforced");
}

// Test 6: HITL escalation integration
{
  const hitlGateway = new HitlApprovalGateway({ hmacSecret: "test-secret-12345" });
  const watchdog = new RunawayExecutionWatchdog({
    maxConsecutiveIdenticalActions: 2,
    hitlGateway,
    escalateToHitl: true,
  });

  watchdog.recordStep({ tool: "retry_query", args: { q: "unresolved" }, stateDelta: { a: 1 } });
  const tripRes = watchdog.recordStep({ tool: "retry_query", args: { q: "unresolved" }, stateDelta: { a: 2 } });

  assert.equal(tripRes.ok, false);
  assert.equal(tripRes.status, "ESCALATED_HITL");
  assert.equal(tripRes.trip_reason, "REPEATED_IDENTICAL_ACTION_SPIN");
  assert.ok(tripRes.hitl_resume_token, "Must return HITL resume token");
  assert.equal(tripRes.receipt.escalated_to_hitl, true);
  assert.ok(tripRes.receipt.hitl_checkpoint_id);
  assert.equal(verifyRunawaySpinReceipt(tripRes.receipt), true);

  console.log("  [PASS] Test 6: Escalation to HITL checkpoint confirmed");
}

// Test 7: Operator reset and resumption
{
  const watchdog = new RunawayExecutionWatchdog({
    maxSteps: 3,
  });

  for (let i = 1; i <= 4; i++) {
    watchdog.recordStep({ tool: `step_${i}`, stateDelta: { step: i } });
  }
  assert.equal(watchdog.status, "TRIPPED");

  const resetRes = watchdog.reset({ authorization: "security_lead", reason: "manual_override" });
  assert.equal(resetRes.ok, true);
  assert.equal(resetRes.status, "CLEARED");
  assert.equal(verifyRunawaySpinReceipt(resetRes.receipt), true);

  // Can execute steps again
  const nextStep = watchdog.recordStep({ tool: "resumed_step", stateDelta: { fresh: true } });
  assert.equal(nextStep.ok, true);
  assert.equal(nextStep.step_count, 1);

  console.log("  [PASS] Test 7: Operator reset clears watchdog");
}

// Test 8: Tamper resistance of receipts
{
  const watchdog = new RunawayExecutionWatchdog({ maxSteps: 2 });
  watchdog.recordStep({ tool: "s1", stateDelta: { x: 1 } });
  watchdog.recordStep({ tool: "s2", stateDelta: { x: 2 } });
  const tripRes = watchdog.recordStep({ tool: "s3", stateDelta: { x: 3 } });

  assert.equal(verifyRunawaySpinReceipt(tripRes.receipt), true);

  const tampered1 = { ...tripRes.receipt, total_steps: 999 };
  assert.equal(verifyRunawaySpinReceipt(tampered1), false);

  const tampered2 = { ...tripRes.receipt, evidence_sha256: "badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad" };
  assert.equal(verifyRunawaySpinReceipt(tampered2), false);

  console.log("  [PASS] Test 8: Receipt cryptographic tamper resistance validated");
}

console.log("[RUNAWAY_WATCHDOG_TEST] All 8 tests passed successfully.");
