/**
 * Unit Test Suite for RouteCircuitBreaker
 * Tests state transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED), threshold trips, and failure receipts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RouteCircuitBreaker, CIRCUIT_BREAKER_SCHEMA, ROUTE_FAILURE_SCHEMA } from "../lib/circuit_breaker.mjs";

console.log("[Circuit Breaker Suite] Testing route failure thresholds and state machines...");

const breaker = new RouteCircuitBreaker({ failureThreshold: 3, cooldownSec: 1 });
const routeId = "siliconflow_tier1_cloud";

// 1. Initial state is CLOSED
let check = breaker.canAttempt(routeId);
assert.equal(check.allowed, true);
assert.equal(check.state, "CLOSED");

// 2. Record 2 failures -> Still CLOSED
breaker.recordFailure(routeId, { reason: "HTTP_500", httpCode: 500 });
breaker.recordFailure(routeId, { reason: "HTTP_504_TIMEOUT", httpCode: 504 });
check = breaker.canAttempt(routeId);
assert.equal(check.allowed, true);
assert.equal(check.state, "CLOSED");

// 3. Record 3rd failure -> Trips to OPEN
const failReceipt = breaker.recordFailure(routeId, { reason: "HTTP_429_RATE_LIMITED", httpCode: 429 });
assert.equal(failReceipt.schema, ROUTE_FAILURE_SCHEMA);
assert.equal(failReceipt.circuit_state, "OPEN");
assert.equal(failReceipt.state_tripped_to_open, true);
assert.ok(failReceipt.receipt_sha256, "Must emit SHA-256 bound receipt");

check = breaker.canAttempt(routeId);
assert.equal(check.allowed, false, "Must block attempt when breaker is OPEN");
assert.equal(check.state, "OPEN");

// 4. Test recovery after cooldown -> transitions to HALF_OPEN
const record = breaker.getRouteState(routeId);
record.last_state_change_at = Math.floor(Date.now() / 1000) - 2; // Simulate cooldown elapsed

check = breaker.canAttempt(routeId);
assert.equal(check.allowed, true, "Must allow probe in HALF_OPEN state");
assert.equal(check.state, "HALF_OPEN");

// 5. Successful probe resets breaker to CLOSED
breaker.recordSuccess(routeId);
check = breaker.canAttempt(routeId);
assert.equal(check.allowed, true);
assert.equal(check.state, "CLOSED");
assert.equal(breaker.getRouteState(routeId).consecutive_failures, 0);

const receiptPath = path.resolve(process.cwd(), "reviews/circuit_breaker_latest.json");
fs.writeFileSync(receiptPath, JSON.stringify(failReceipt, null, 2), "utf8");
console.log(`[PASS] Circuit Breaker Suite cleanly verified route state transitions! Saved to: ${receiptPath}`);
