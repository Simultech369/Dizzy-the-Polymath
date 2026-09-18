/**
 * Trajectory Regression Gate Engine (W-0152)
 *
 * Implements CI regression gates for trajectory evaluation:
 * 1. Unit fixture conformance (confirms known positive & negative patterns hold)
 * 2. Golden benchmark batch evaluation (evaluates production canonical trajectories)
 * 3. Formal receipt schema and cryptographic integrity verification
 * 4. Promotion floor assessment (enforces zero violations and 100% pass rate floor)
 *
 * Schema: dizzy.trajectory_regression_gate.v1
 * Authority: promotion_gate_blocks_only_simul_approves_push
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  evaluateTrajectory,
  evaluateBatch,
  validateTrajectoryEvalReceipt,
  DEFAULT_THRESHOLDS as EVAL_DEFAULT_THRESHOLDS,
} from "./trajectory_evaluator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

export const TRAJECTORY_REGRESSION_GATE_SCHEMA = "dizzy.trajectory_regression_gate.v1";

export const DEFAULT_TRAJECTORY_GATE_THRESHOLDS = Object.freeze({
  min_pass_rate_pct: 100.0,
  max_violations: 0,
  require_non_empty_batch: true,
  min_golden_trajectories: 3,
});

/**
 * Runs the complete trajectory regression gate audit.
 */
export function runTrajectoryRegressionGate({
  rootDir = ROOT_DIR,
  goldenPath = null,
  fixturesPath = null,
  thresholds = DEFAULT_TRAJECTORY_GATE_THRESHOLDS,
  evalThresholds = EVAL_DEFAULT_THRESHOLDS,
  logger = console,
} = {}) {
  const effectiveThresholds = { ...DEFAULT_TRAJECTORY_GATE_THRESHOLDS, ...(thresholds || {}) };
  const effectiveGoldenPath = goldenPath || path.join(rootDir, "scripts/fixtures/golden_trajectories.json");
  const effectiveFixturesPath = fixturesPath || path.join(rootDir, "scripts/fixtures/trajectory_eval_fixtures.json");

  const results = {
    schema_version: TRAJECTORY_REGRESSION_GATE_SCHEMA,
    timestamp: new Date().toISOString(),
    ok: false,
    fixture_conformance: {
      total: 0,
      matched: 0,
      mismatched: 0,
      details: [],
    },
    golden_benchmark: null,
    receipt_validation: null,
    metrics: {
      total_golden: 0,
      passed_golden: 0,
      failed_golden: 0,
      total_violations: 0,
      pass_rate_pct: 0,
    },
    status: "failed",
    violations: [],
  };

  // 1. Fixture conformance check (unit positive and negative regression guards)
  if (fs.existsSync(effectiveFixturesPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(effectiveFixturesPath, "utf8"));
      const fixtures = Array.isArray(raw.trajectories) ? raw.trajectories : [];
      results.fixture_conformance.total = fixtures.length;

      for (const fixture of fixtures) {
        const evalResult = evaluateTrajectory(fixture, evalThresholds);
        const match = evalResult.status === fixture.expected_status;
        if (match) {
          results.fixture_conformance.matched++;
        } else {
          results.fixture_conformance.mismatched++;
          results.violations.push(
            `FIXTURE_REGRESSION: ${fixture.id} expected ${fixture.expected_status} but got ${evalResult.status}`
          );
        }
        results.fixture_conformance.details.push({
          id: fixture.id,
          expected: fixture.expected_status,
          actual: evalResult.status,
          match,
          violations: evalResult.violations,
        });
      }
    } catch (err) {
      results.violations.push(`FIXTURES_LOAD_ERROR: ${err.message}`);
    }
  } else {
    results.violations.push(`FIXTURES_FILE_NOT_FOUND: ${effectiveFixturesPath}`);
  }

  // 2. Golden benchmark batch evaluation
  if (fs.existsSync(effectiveGoldenPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(effectiveGoldenPath, "utf8"));
      const goldenTrajectories = Array.isArray(raw.trajectories) ? raw.trajectories : [];

      const batchReceipt = evaluateBatch(goldenTrajectories, evalThresholds);
      results.golden_benchmark = batchReceipt;

      const total = batchReceipt.total_trajectories;
      const passed = batchReceipt.passed_trajectories;
      const failed = batchReceipt.failed_trajectories;
      const violationsCount = batchReceipt.total_violations;
      const passRate = total > 0 ? (passed / total) * 100.0 : 0.0;

      results.metrics = {
        total_golden: total,
        passed_golden: passed,
        failed_golden: failed,
        total_violations: violationsCount,
        pass_rate_pct: passRate,
      };

      // 3. Receipt cryptographic and schema validation
      const receiptValid = validateTrajectoryEvalReceipt(batchReceipt);
      results.receipt_validation = receiptValid;
      if (!receiptValid.ok) {
        for (const v of receiptValid.violations) {
          results.violations.push(`RECEIPT_VALIDATION_FAILED: ${v}`);
        }
      }

      // Check against promotion thresholds
      if (total < effectiveThresholds.min_golden_trajectories) {
        results.violations.push(
          `INSUFFICIENT_GOLDEN_TRAJECTORIES: Found ${total}, required >= ${effectiveThresholds.min_golden_trajectories}`
        );
      }
      if (passRate < effectiveThresholds.min_pass_rate_pct) {
        results.violations.push(
          `TRAJECTORY_PASS_RATE_FLOOR_BREACH: ${passRate.toFixed(1)}% < ${effectiveThresholds.min_pass_rate_pct}%`
        );
      }
      if (violationsCount > effectiveThresholds.max_violations) {
        results.violations.push(
          `TRAJECTORY_VIOLATIONS_EXCEEDED: ${violationsCount} > ${effectiveThresholds.max_violations}`
        );
      }
      if (batchReceipt.overall_status !== "TRAJECTORY_SUITE_PASSED") {
        results.violations.push(
          `BATCH_OVERALL_STATUS_FAILED: ${batchReceipt.overall_status}`
        );
      }
    } catch (err) {
      results.violations.push(`GOLDEN_EVAL_ERROR: ${err.message}`);
    }
  } else {
    results.violations.push(`GOLDEN_FILE_NOT_FOUND: ${effectiveGoldenPath}`);
  }

  // 4. Overall gate status
  results.ok = results.violations.length === 0 && results.fixture_conformance.mismatched === 0;
  results.status = results.ok ? "passed" : "failed";

  return results;
}

/**
 * Projects trajectory gate results into the formal eval gate policy check format.
 */
export function evaluateTrajectoryPromotion(gateResult, thresholds = DEFAULT_TRAJECTORY_GATE_THRESHOLDS) {
  const minPassRate = Number(thresholds.min_pass_rate_pct ?? DEFAULT_TRAJECTORY_GATE_THRESHOLDS.min_pass_rate_pct);
  const maxViolations = Number(thresholds.max_violations ?? DEFAULT_TRAJECTORY_GATE_THRESHOLDS.max_violations);

  const metrics = gateResult?.metrics || {};
  const passRate = Number(metrics.pass_rate_pct ?? 0);
  const violations = Number(metrics.total_violations ?? 999);
  const totalGolden = Number(metrics.total_golden ?? 0);
  const mismatched = Number(gateResult?.fixture_conformance?.mismatched ?? 999);

  const ok = Boolean(gateResult?.ok)
    && gateResult?.status === "passed"
    && totalGolden >= (thresholds.min_golden_trajectories ?? DEFAULT_TRAJECTORY_GATE_THRESHOLDS.min_golden_trajectories)
    && passRate >= minPassRate
    && violations <= maxViolations
    && mismatched === 0;

  return {
    id: "golden-trajectory",
    label: "Golden Trajectory Promotion Floor",
    status: ok ? "passed" : "failed",
    metrics: {
      total_golden: totalGolden,
      passed_golden: Number(metrics.passed_golden ?? 0),
      failed_golden: Number(metrics.failed_golden ?? 0),
      pass_rate_pct: passRate,
      total_violations: violations,
      fixture_mismatches: mismatched,
    },
    thresholds: {
      min_pass_rate_pct: minPassRate,
      max_violations: maxViolations,
      min_golden_trajectories: thresholds.min_golden_trajectories ?? DEFAULT_TRAJECTORY_GATE_THRESHOLDS.min_golden_trajectories,
    },
    violations: gateResult?.violations || [],
  };
}
