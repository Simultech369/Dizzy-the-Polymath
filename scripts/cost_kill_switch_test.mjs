/**
 * Verification Test Suite for Light Cost Kill-Switch Middleware
 *
 * Verifies:
 * 1. Preflight budget clearance under normal operating limits
 * 2. Per-request ceiling enforcement and fail-closed trip
 * 3. Session budget exhaustion and subsequent request blocking
 * 4. Rolling hourly window expenditure tracking
 * 5. Cryptographic receipt integrity and state telemetry
 * 6. Authorized operator reset workflows
 */

import assert from "node:assert/strict";

import {
  COST_KILL_SWITCH_SCHEMA,
  COST_KILL_SWITCH_RECEIPT_SCHEMA,
  CostKillSwitch,
} from "../lib/cost_kill_switch.mjs";

console.log("==================================================");
console.log("   Cost Kill-Switch Middleware Test Suite         ");
console.log("==================================================\n");

const fixedNow = new Date("2026-10-01T12:00:00.000Z");

// TEST 1: Normal operation within budget limits
console.log("[Test 1] Preflight and cost recording within bounds...");
const killSwitch = new CostKillSwitch({
  maxCostPerRequestUsd: 0.10,
  maxCostPerSessionUsd: 0.50,
  maxCostPerHourUsd: 2.00,
  now: () => fixedNow,
});

const preflight1 = killSwitch.checkPreflight({
  estimatedCostUsd: 0.02,
  sessionId: "session_alpha",
});
assert.equal(preflight1.allowed, true);
assert.equal(preflight1.state, "ACTIVE");
assert.equal(preflight1.session_remaining_usd, 0.50);

const record1 = killSwitch.recordExecutionCost({
  actualCostUsd: 0.018,
  sessionId: "session_alpha",
  promptTokens: 1500,
  completionTokens: 300,
});
assert.equal(record1.status, "RECORDED");
assert.equal(record1.circuit_state, "ACTIVE");
assert.equal(record1.session_total_usd, 0.018);
assert.equal(record1.receipt.schema_version, COST_KILL_SWITCH_RECEIPT_SCHEMA);
assert.ok(record1.receipt.receipt_sha256);
console.log("  [PASS] Test 1: Requests within budget allowed and tracked accurately");

// TEST 2: Single-request ceiling trip
console.log("\n[Test 2] Single-request ceiling trip (fail-closed)...");
const preflightExorbitant = killSwitch.checkPreflight({
  estimatedCostUsd: 0.25, // Exceeds 0.10 request ceiling
  sessionId: "session_alpha",
});
assert.equal(preflightExorbitant.allowed, false);
assert.equal(preflightExorbitant.state, "TRIPPED");
assert.match(preflightExorbitant.reason, /request_cost_limit_exceeded/);
assert.equal(preflightExorbitant.receipt.status, "TRIPPED");
assert.ok(preflightExorbitant.receipt.receipt_sha256);

// Subsequent preflight calls must fail closed immediately
const subsequentBlocked = killSwitch.checkPreflight({
  estimatedCostUsd: 0.001,
  sessionId: "session_alpha",
});
assert.equal(subsequentBlocked.allowed, false);
assert.equal(subsequentBlocked.state, "TRIPPED");
console.log("  [PASS] Test 2: Single exorbitant request tripped circuit breaker to fail-closed state");

// TEST 3: Authorized operator reset
console.log("\n[Test 3] Authorized operator reset...");
assert.throws(
  () => killSwitch.reset({ authorizationKey: "short" }),
  /requires a valid operator authorizationKey/
);

const resetReceipt = killSwitch.reset({
  authorizationKey: "operator_master_key_32_characters_long",
});
assert.equal(resetReceipt.status, "RESET");
assert.equal(killSwitch.state, "ACTIVE");
console.log("  [PASS] Test 3: Authorized reset restored breaker to ACTIVE state");

// TEST 4: Cumulative session budget exhaustion
console.log("\n[Test 4] Cumulative session budget exhaustion...");
// Session limit is 0.50. Let's record costs that push it over.
killSwitch.recordExecutionCost({ actualCostUsd: 0.25, sessionId: "session_beta" });
assert.equal(killSwitch.state, "ACTIVE");

killSwitch.recordExecutionCost({ actualCostUsd: 0.24, sessionId: "session_beta" });
assert.equal(killSwitch.state, "ACTIVE");

// Next execution of 0.05 pushes session_beta to 0.54 (> 0.50)
const breachRecord = killSwitch.recordExecutionCost({ actualCostUsd: 0.05, sessionId: "session_beta" });
assert.equal(breachRecord.status, "TRIPPED");
assert.equal(killSwitch.state, "TRIPPED");
assert.match(killSwitch.tripReason, /session_cost_limit_breached/);

// Any subsequent preflight is blocked
const sessionBlocked = killSwitch.checkPreflight({ estimatedCostUsd: 0.01, sessionId: "session_beta" });
assert.equal(sessionBlocked.allowed, false);
console.log("  [PASS] Test 4: Cumulative session spend strictly capped at threshold");

// TEST 5: Rolling hourly window tracking
console.log("\n[Test 5] Rolling hourly window tracking...");
const hourlySwitch = new CostKillSwitch({
  maxCostPerRequestUsd: 1.00,
  maxCostPerSessionUsd: 10.00,
  maxCostPerHourUsd: 1.00, // $1.00 per hour limit
  now: () => fixedNow,
});

// Spend 0.90 in hour 1
hourlySwitch.recordExecutionCost({ actualCostUsd: 0.90, sessionId: "s1" });
assert.equal(hourlySwitch.state, "ACTIVE");

// Preflight requesting 0.20 would push hourly total to 1.10 (> 1.00)
const hourlyOver = hourlySwitch.checkPreflight({ estimatedCostUsd: 0.20, sessionId: "s2" });
assert.equal(hourlyOver.allowed, false);
assert.equal(hourlyOver.state, "TRIPPED");
assert.match(hourlyOver.reason, /hourly_cost_limit_exceeded/);
console.log("  [PASS] Test 5: Rolling hourly budget limit enforced across multiple sessions");

// TEST 6: State telemetry snapshot
console.log("\n[Test 6] State telemetry snapshot...");
const state = hourlySwitch.getState();
assert.equal(state.schema_version, COST_KILL_SWITCH_SCHEMA);
assert.equal(state.state, "TRIPPED");
assert.equal(state.limits.max_cost_per_hour_usd, 1.00);
assert.ok(state.lifetime_cost_usd >= 0.90);
console.log("  [PASS] Test 6: State telemetry snapshot rendered cleanly");

console.log("\n[test:cost-kill-switch] ALL 6 TESTS PASSED CLEANLY.\n");
