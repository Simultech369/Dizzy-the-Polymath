import assert from "node:assert/strict";
import { buildReviewCoverageReport } from "../lib/review_cycle_coverage.mjs";

console.log("=== W-0068 Review Cycle Coverage Test Suite ===");

const packageJson = {
  scripts: {
    test: "node ./scripts/safety_checks.mjs",
    "test:router": "node ./scripts/dynamic_router_test.mjs",
    "check:council": "node ./scripts/oss_council_audit.mjs",
    "eval:retrieval-golden": "node ./scripts/retrieval_eval.mjs",
  },
};
const history = {
  reviewers: {
    qwen_local: { runs: 2, confirmed_findings: 3, useful_disagreements: 1, false_positive_findings: 0 },
    universal_judge: { runs: 2, confirmed_findings: 0, useful_disagreements: 0, false_positive_findings: 4 },
  },
  harnesses: {
    "test:router": { runs: 3, passes: 3, failures: 0, total_duration_ms: 9000, last_status: "passed" },
    "eval:retrieval-golden": { runs: 2, passes: 1, failures: 1, total_duration_ms: 240000, last_status: "failed" },
  },
};

const report = buildReviewCoverageReport({
  history,
  packageJson,
  maxItems: 3,
  now: new Date("2026-08-09T00:00:00.000Z"),
});

assert.equal(report.schema_version, "dizzy.review_cycle_coverage.v1");
assert.equal(report.authority, "coverage_informs_rotation_only");
assert.equal(report.reviewers.total, 40);
assert.equal(report.reviewers.touched, 2);
assert.equal(report.reviewers.untouched, 38);
assert.equal(report.reviewers.high_signal[0].role_key, "qwen_local");
assert.equal(report.reviewers.needs_recheck[0].role_key, "universal_judge");
assert.equal(report.reviewers.next_rotation.length, 3);
assert.equal(report.harnesses.total, 4);
assert.equal(report.harnesses.touched, 2);
assert.equal(report.harnesses.high_signal[0].script, "test:router");
assert.equal(report.harnesses.unstable[0].script, "eval:retrieval-golden");

console.log("REVIEW_CYCLE_COVERAGE_TESTS_OK");
