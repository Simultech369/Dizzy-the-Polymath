import assert from "node:assert/strict";
import {
  DEFAULT_THRESHOLDS,
  evaluateRetrievalPromotion,
  findGeneratedReceiptMaterial,
  isGeneratedReceiptArtifact,
  runEvalGatePolicy,
} from "./eval_gate_policy_check.mjs";

console.log("=== W-0074 Eval Gate Policy Test Suite ===");

assert.equal(isGeneratedReceiptArtifact("reviews/retrieval_eval_latest.json"), true);
assert.equal(isGeneratedReceiptArtifact("reviews/oss_council_verdict_latest.json"), true);
assert.equal(isGeneratedReceiptArtifact("reviews/review_cycle_history.json"), true);
assert.equal(isGeneratedReceiptArtifact("runtime/router_receipts.jsonl"), true);
assert.equal(isGeneratedReceiptArtifact("reviews/openrouter_free_review.md"), false);
assert.equal(isGeneratedReceiptArtifact("scripts/retrieval_eval.mjs"), false);

const leaked = findGeneratedReceiptMaterial({
  paths: [
    "scripts/eval_gate_policy_check.mjs",
    "reviews/retrieval_eval_latest.json",
    "runtime/router_receipts.jsonl",
  ],
});
assert.equal(leaked.ok, true);
assert.deepEqual(leaked.paths, ["reviews/retrieval_eval_latest.json", "runtime/router_receipts.jsonl"]);

const strongRetrieval = evaluateRetrievalPromotion({
  ok: true,
  receipt: {
    metrics: {
      hit_rate_top_3_pct: 90,
      mrr: 0.75,
    },
  },
});
assert.equal(strongRetrieval.status, "passed");

const weakRetrieval = evaluateRetrievalPromotion({
  ok: true,
  receipt: {
    metrics: {
      hit_rate_top_3_pct: DEFAULT_THRESHOLDS.retrieval_hit_rate_top_3_pct - 0.1,
      mrr: 0.75,
    },
  },
});
assert.equal(weakRetrieval.status, "failed");

const noHarnessReport = await runEvalGatePolicy({
  runHarnesses: false,
  receiptPaths: [],
  logger: {
    log() {},
    error() {},
  },
});
assert.equal(noHarnessReport.schema_version, "dizzy.eval_gate_policy.v1");
assert.equal(noHarnessReport.status, "passed");
assert.equal(noHarnessReport.checks.some((check) => check.id === "golden-retrieval"), true);
assert.equal(noHarnessReport.checks.some((check) => check.id === "generated-receipt-material"), true);

const receiptLeakReport = await runEvalGatePolicy({
  runHarnesses: false,
  receiptPaths: ["reviews/model_review_batch_latest.json"],
  logger: {
    log() {},
    error() {},
  },
});
assert.equal(receiptLeakReport.status, "failed");
assert.deepEqual(
  receiptLeakReport.checks.find((check) => check.id === "generated-receipt-material").paths,
  ["reviews/model_review_batch_latest.json"],
);

console.log("EVAL_GATE_POLICY_TESTS_OK");
