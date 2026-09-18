/**
 * Trajectory Regression Gate Test Suite (W-0152)
 *
 * Verifies that the trajectory regression gate:
 * 1. Validates unit fixture conformance (catches regressions in positive/negative fixtures)
 * 2. Runs golden benchmark batch evaluation (enforces 100% pass rate floor)
 * 3. Enforces cryptographic and schema validation on the batch receipt
 * 4. Fails closed when pass rate or violation thresholds are breached
 * 5. Integrates with eval gate promotion floors
 */

import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  runTrajectoryRegressionGate,
  evaluateTrajectoryPromotion,
  TRAJECTORY_REGRESSION_GATE_SCHEMA,
  DEFAULT_TRAJECTORY_GATE_THRESHOLDS,
} from "../lib/trajectory_regression_gate.mjs";

console.log("=== W-0152 Trajectory Regression Gate Test Suite ===\n");

// -----------------------------------------------------------------------------
// Test 1: Production Golden Gate Evaluation
// -----------------------------------------------------------------------------
console.log("-> Test 1: Running production golden trajectory regression gate...");

const prodResult = runTrajectoryRegressionGate();

assert.equal(prodResult.schema_version, TRAJECTORY_REGRESSION_GATE_SCHEMA);
assert.equal(prodResult.status, "passed");
assert.equal(prodResult.ok, true);
assert.equal(prodResult.fixture_conformance.mismatched, 0, "All unit fixtures must match expectations");
assert.ok(prodResult.fixture_conformance.matched >= 3, "At least 3 unit fixtures checked");
assert.equal(prodResult.metrics.failed_golden, 0, "Zero golden trajectories may fail");
assert.equal(prodResult.metrics.total_violations, 0, "Zero violations in golden benchmark");
assert.equal(prodResult.metrics.pass_rate_pct, 100.0, "Golden pass rate must be 100%");
assert.ok(prodResult.metrics.total_golden >= 3, "Must have at least 3 golden trajectories");
assert.equal(prodResult.receipt_validation.ok, true, "Batch receipt must validate cleanly");

console.log("  [PASS] Test 1: Production golden trajectory gate passed cleanly (100% pass rate, 0 violations)");

// -----------------------------------------------------------------------------
// Test 2: Promotion Floor Projector
// -----------------------------------------------------------------------------
console.log("-> Test 2: Evaluating promotion floor projection...");

const promotionCheck = evaluateTrajectoryPromotion(prodResult);

assert.equal(promotionCheck.id, "golden-trajectory");
assert.equal(promotionCheck.status, "passed");
assert.equal(promotionCheck.metrics.pass_rate_pct, 100.0);
assert.equal(promotionCheck.metrics.total_violations, 0);
assert.equal(promotionCheck.metrics.fixture_mismatches, 0);

console.log("  [PASS] Test 2: Promotion floor correctly projected passed status");

// -----------------------------------------------------------------------------
// Test 3: Fixture Regression Detection (Negative Invariant)
// -----------------------------------------------------------------------------
console.log("-> Test 3: Testing regression detection on compromised fixture...");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-traj-gate-test-"));
const brokenFixturesPath = path.join(tempDir, "broken_fixtures.json");

// Create a fixture that expects PASSED but actually contains banned keyword slop
fs.writeFileSync(
  brokenFixturesPath,
  JSON.stringify({
    trajectories: [
      {
        id: "compromised_positive_fixture",
        expected_status: "PASSED",
        steps: [
          { actor: "agent", content: "Leaking user_private_key here", status: "success" }
        ]
      }
    ]
  }),
  "utf8"
);

const brokenFixtureGate = runTrajectoryRegressionGate({
  fixturesPath: brokenFixturesPath,
});

assert.equal(brokenFixtureGate.ok, false);
assert.equal(brokenFixtureGate.status, "failed");
assert.equal(brokenFixtureGate.fixture_conformance.mismatched, 1);
assert.ok(
  brokenFixtureGate.violations.some((v) => v.includes("FIXTURE_REGRESSION")),
  "Must flag fixture regression"
);

const brokenPromotion = evaluateTrajectoryPromotion(brokenFixtureGate);
assert.equal(brokenPromotion.status, "failed");

console.log("  [PASS] Test 3: Compromised fixture correctly failed closed with regression flag");

// -----------------------------------------------------------------------------
// Test 4: Golden Benchmark Quality Drop Detection
// -----------------------------------------------------------------------------
console.log("-> Test 4: Testing threshold breach on failing golden trajectory...");

const brokenGoldenPath = path.join(tempDir, "broken_golden.json");

// Create a golden benchmark that flounders
fs.writeFileSync(
  brokenGoldenPath,
  JSON.stringify({
    trajectories: [
      {
        id: "floundering_golden",
        description: "Floundering workflow",
        steps: [
          { actor: "agent", tool: "api", status: "error" },
          { actor: "agent", tool: "api", status: "error" },
          { actor: "agent", tool: "api", status: "error" },
          { actor: "agent", tool: "api", status: "error" },
        ]
      }
    ]
  }),
  "utf8"
);

const brokenGoldenGate = runTrajectoryRegressionGate({
  goldenPath: brokenGoldenPath,
});

assert.equal(brokenGoldenGate.ok, false);
assert.equal(brokenGoldenGate.status, "failed");
assert.ok(brokenGoldenGate.metrics.failed_golden > 0);
assert.ok(
  brokenGoldenGate.violations.some((v) => v.includes("TRAJECTORY_PASS_RATE_FLOOR_BREACH")),
  "Must flag pass rate floor breach"
);

const brokenGoldenPromotion = evaluateTrajectoryPromotion(brokenGoldenGate);
assert.equal(brokenGoldenPromotion.status, "failed");

// Cleanup
fs.rmSync(tempDir, { recursive: true, force: true });

console.log("  [PASS] Test 4: Failing golden trajectory correctly breached promotion floor");

console.log("\n[PASS] All trajectory regression gate tests passed cleanly!");
console.log("TRAJECTORY_REGRESSION_GATE_TESTS_OK\n");
