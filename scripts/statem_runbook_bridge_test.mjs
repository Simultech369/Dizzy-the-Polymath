import assert from "node:assert/strict";
import {
  exportStateMRunbook,
  executeStateMFsm,
  validateRunbookYaml,
  parseVerificationCommandPlan,
  STATEM_RUNBOOK_RECEIPT_SCHEMA,
  STATEM_RUNBOOK_EXECUTION_SCHEMA,
  REQUIRED_NODES,
  REQUIRED_EDGES,
} from "../lib/statem_runbook_bridge.mjs";

console.log("[test:statem-runbook-bridge] Starting StateM runbook bridge test suite...");

// Test 1: Export default runbook and check structure + receipt
{
  const { yaml, receipt } = exportStateMRunbook();
  assert.ok(typeof yaml === "string" && yaml.length > 50, "YAML must be a non-empty string");
  assert.equal(receipt.schema_version, STATEM_RUNBOOK_RECEIPT_SCHEMA);
  assert.equal(receipt.runbook_name, "dizzy-agent-implementation-loop");
  assert.equal(receipt.node_count, 4);
  assert.equal(receipt.edge_count, 4);
  assert.equal(receipt.initial_state, "plan");
  assert.ok(receipt.runbook_sha256 && receipt.runbook_sha256.length === 64);
  assert.ok(receipt.lifecycle_hooked === true);
  console.log("  [PASS] Test 1: Export default runbook and receipt validation");
}

// Test 2: Custom runbook export
{
  const { yaml, receipt } = exportStateMRunbook({
    name: "custom-a2a-task",
    verificationCommand: "npm run check:docs",
    customPrompts: {
      plan: "Custom plan instructions",
      execute: "Custom execute instructions",
    },
  });
  assert.equal(receipt.runbook_name, "custom-a2a-task");
  assert.equal(receipt.verification_command, "npm run check:docs");
  assert.ok(yaml.includes("Custom plan instructions"));
  assert.ok(yaml.includes("Custom execute instructions"));
  console.log("  [PASS] Test 2: Custom runbook export");
}

// Test 3: Verification command plans are exact allowlists, not shell strings
{
  const plan = parseVerificationCommandPlan("npm run check:next && npm run check:docs");
  assert.equal(plan.length, 2);
  assert.deepEqual(plan.map((step) => step.label), ["npm run check:next", "npm run check:docs"]);
  assert.ok(plan.every((step) => step.command === "npm.cmd" || step.command === "npm"));
  assert.ok(plan.every((step) => Array.isArray(step.args) && step.args.length === 2));

  assert.throws(
    () => parseVerificationCommandPlan("npm run check:docs && echo w0100_shell_escape"),
    /Unsupported StateM verification command/,
  );
  assert.throws(
    () => exportStateMRunbook({ verificationCommand: "node -e \"console.log('unsafe')\"" }),
    /Unsupported StateM verification command/,
  );
  console.log("  [PASS] Test 3: Verification command allowlist rejects shell strings");
}

// Test 4: Validation fails on corrupted runbook YAML
{
  assert.throws(() => {
    validateRunbookYaml("name: invalid\nnodes:\n  plan:\n");
  }, /missing required structure/);
  console.log("  [PASS] Test 4: Corrupted runbook YAML rejected");
}

// Test 5: Clean FSM execution pass
{
  let planCalled = false;
  let execCalled = false;
  let verifyCalled = false;
  let handoffCalled = false;

  const result = await executeStateMFsm({
    runbookName: "clean-run",
    planHandler: async () => { planCalled = true; return { ok: true }; },
    executeHandler: async () => { execCalled = true; return { ok: true }; },
    verifyHandler: async () => { verifyCalled = true; return { ok: true }; },
    handoffHandler: async () => { handoffCalled = true; return { ok: true }; },
  });

  assert.equal(result.ok, true);
  assert.equal(result.receipt.status, "PASSED");
  assert.equal(result.receipt.terminal_state, "COMPLETED");
  assert.equal(result.receipt.verification_passed, true);
  assert.equal(result.receipt.verification_attempts, 1);
  assert.equal(planCalled, true);
  assert.equal(execCalled, true);
  assert.equal(verifyCalled, true);
  assert.equal(handoffCalled, true);

  // Check transitions
  const states = result.receipt.transitions.map(t => t.to);
  assert.deepEqual(states, ["plan", "execute", "verify", "handoff", "COMPLETED"]);
  console.log("  [PASS] Test 5: Clean FSM execution pass");
}

// Test 6: FSM execution with 1 verification failure and successful retry
{
  let execAttempts = 0;
  let verifyAttempts = 0;
  let handoffCalled = false;

  const result = await executeStateMFsm({
    runbookName: "retry-run",
    maxVerificationRetries: 3,
    planHandler: async () => ({ ok: true }),
    executeHandler: async () => { execAttempts++; return { ok: true }; },
    verifyHandler: async ({ attempt }) => {
      verifyAttempts++;
      if (attempt === 1) return { ok: false, error: "Test failure simulated" };
      return { ok: true };
    },
    handoffHandler: async () => { handoffCalled = true; return { ok: true }; },
  });

  assert.equal(result.ok, true);
  assert.equal(result.receipt.status, "PASSED");
  assert.equal(result.receipt.verification_attempts, 2);
  assert.equal(execAttempts, 2);
  assert.equal(verifyAttempts, 2);
  assert.equal(handoffCalled, true);

  // Check transition path: plan -> execute -> verify -> execute -> verify -> handoff -> COMPLETED
  const transitions = result.receipt.transitions.map(t => `${t.from}->${t.to}`);
  assert.ok(transitions.includes("verify->execute"), "Must include verify->execute retry transition");
  assert.ok(transitions.includes("verify->handoff"), "Must include verify->handoff transition");
  console.log("  [PASS] Test 6: FSM execution with verification retry");
}

// Test 7: Hard barrier enforcement - Handoff NEVER reached if verification fails completely
{
  let handoffReached = false;

  const result = await executeStateMFsm({
    runbookName: "fail-closed-run",
    maxVerificationRetries: 2,
    planHandler: async () => ({ ok: true }),
    executeHandler: async () => ({ ok: true }),
    verifyHandler: async () => ({ ok: false, error: "Permanent test failure" }),
    handoffHandler: async () => { handoffReached = true; return { ok: true }; },
  });

  assert.equal(result.ok, false);
  assert.equal(result.receipt.status, "FAILED");
  assert.equal(result.receipt.terminal_state, "FAILED");
  assert.equal(result.receipt.verification_passed, false);
  assert.equal(result.receipt.verification_attempts, 2);
  assert.equal(handoffReached, false, "CRITICAL: handoff must NEVER be reached if verification fails");
  assert.ok(result.receipt.error.includes("Verification barrier failed"));
  console.log("  [PASS] Test 7: Hard barrier enforcement - failed verification blocks handoff");
}

// Test 8: Plan failure aborts before execute
{
  let executeReached = false;

  const result = await executeStateMFsm({
    runbookName: "plan-abort-run",
    planHandler: async () => ({ ok: false, error: "Scope exceeded constraints" }),
    executeHandler: async () => { executeReached = true; return { ok: true }; },
  });

  assert.equal(result.ok, false);
  assert.equal(result.receipt.status, "FAILED");
  assert.equal(executeReached, false, "Execute must not be reached if plan fails");
  console.log("  [PASS] Test 8: Plan failure aborts before execute");
}

console.log("\n[test:statem-runbook-bridge] ALL 8 TESTS PASSED CLEANLY.\n");
