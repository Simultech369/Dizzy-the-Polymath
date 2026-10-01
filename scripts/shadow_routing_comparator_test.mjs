import assert from "node:assert/strict";
import {
  ShadowRoutingComparator,
  verifyShadowRoutingComparatorReceipt,
  SHADOW_ROUTING_COMPARATOR_RECEIPT_SCHEMA,
} from "../lib/shadow_routing_comparator.mjs";

console.log("[SHADOW_ROUTING_COMPARATOR_TEST] Starting test suite...");

const comparator = new ShadowRoutingComparator({
  minConfidenceThreshold: 0.80,
  now: () => new Date("2026-10-01T12:00:00.000Z"),
});

// Test 1: Single comparison - Equivalent routes
{
  const res = comparator.compareSingle({
    queryId: "q1",
    primaryRoute: { tier: "T2", model: "claude-3-5-sonnet", estimatedCostUsd: 0.003, estimatedLatencyMs: 1200, confidence: 0.95 },
    candidateRoute: { tier: "T2", model: "claude-3-5-sonnet", estimatedCostUsd: 0.003, estimatedLatencyMs: 1200, confidence: 0.95 },
  });

  assert.equal(res.same_tier, true);
  assert.equal(res.same_model, true);
  assert.equal(res.classification, "EQUIVALENT");
  assert.equal(res.regression_detected, false);
  console.log("  [PASS] Test 1: Equivalent route comparison");
}

// Test 2: Optimization candidate (cheaper tier with high confidence)
{
  const res = comparator.compareSingle({
    queryId: "q2",
    primaryRoute: { tier: "T2", model: "gpt-4o", estimatedCostUsd: 0.003, estimatedLatencyMs: 1200, confidence: 0.90 },
    candidateRoute: { tier: "T1", model: "gemini-2.0-flash", estimatedCostUsd: 0.0002, estimatedLatencyMs: 250, confidence: 0.92 },
  });

  assert.equal(res.deltas.tier_delta, -1);
  assert.equal(res.classification, "OPTIMIZATION_CANDIDATE");
  assert.equal(res.regression_detected, false);
  console.log("  [PASS] Test 2: Optimization candidate (cost/latency reduction)");
}

// Test 3: Regression risk (cheaper tier but low confidence)
{
  const res = comparator.compareSingle({
    queryId: "q3",
    primaryRoute: { tier: "T2", model: "gpt-4o", estimatedCostUsd: 0.003, estimatedLatencyMs: 1200, confidence: 0.90 },
    candidateRoute: { tier: "T1", model: "gemini-2.0-flash", estimatedCostUsd: 0.0002, estimatedLatencyMs: 250, confidence: 0.65 },
  });

  assert.equal(res.classification, "REGRESSION_RISK");
  assert.equal(res.regression_detected, true);
  console.log("  [PASS] Test 3: Regression risk caught on low-confidence demotion");
}

// Test 4: Escalation candidate on high-stakes query
{
  const res = comparator.compareSingle({
    queryId: "q4",
    primaryRoute: { tier: "T2", model: "gpt-4o", estimatedCostUsd: 0.003, estimatedLatencyMs: 1200, confidence: 0.70 },
    candidateRoute: { tier: "T3", model: "o1-preview", estimatedCostUsd: 0.015, estimatedLatencyMs: 4500, confidence: 0.98, requiresEscalation: true },
  });

  assert.equal(res.classification, "ESCALATION_CANDIDATE");
  assert.equal(res.regression_detected, false);
  console.log("  [PASS] Test 4: Justified high-stakes escalation candidate");
}

// Test 5: Batch evaluation - Promotion pass
{
  const evalSet = [
    {
      queryId: "bench_1",
      primaryRoute: { tier: "T2", model: "claude-3-5-sonnet", estimatedCostUsd: 0.003, confidence: 0.95 },
      candidateRoute: { tier: "T2", model: "claude-3-5-sonnet", estimatedCostUsd: 0.003, confidence: 0.95 },
    },
    {
      queryId: "bench_2",
      primaryRoute: { tier: "T2", model: "claude-3-5-sonnet", estimatedCostUsd: 0.003, confidence: 0.95 },
      candidateRoute: { tier: "T2", model: "claude-3-5-sonnet", estimatedCostUsd: 0.003, confidence: 0.95 },
    },
    {
      queryId: "bench_3",
      primaryRoute: { tier: "T1", model: "flash-lite", estimatedCostUsd: 0.0002, confidence: 0.90 },
      candidateRoute: { tier: "T1", model: "flash-lite", estimatedCostUsd: 0.0002, confidence: 0.90 },
    },
  ];

  const batchRes = comparator.evaluateBatch({
    benchmarkId: "golden_eval_v1",
    evalSet,
  });

  assert.equal(batchRes.ok, true);
  assert.equal(batchRes.verdict, "PROMOTE");
  assert.equal(batchRes.receipt.schema_version, SHADOW_ROUTING_COMPARATOR_RECEIPT_SCHEMA);
  assert.equal(batchRes.receipt.concordance_rate, 1.0);
  assert.equal(batchRes.receipt.regressions_count, 0);
  assert.equal(verifyShadowRoutingComparatorReceipt(batchRes.receipt), true);
  console.log("  [PASS] Test 5: Golden benchmark promotion verdict validated");
}

// Test 6: Batch evaluation - Regression rejection
{
  const evalSetWithRegressions = [
    {
      queryId: "reg_1",
      primaryRoute: { tier: "T2", model: "gpt-4o", estimatedCostUsd: 0.003, confidence: 0.90 },
      candidateRoute: { tier: "T1", model: "weak-model", estimatedCostUsd: 0.0002, confidence: 0.50 }, // regression
    },
    {
      queryId: "reg_2",
      primaryRoute: { tier: "T1", model: "flash", estimatedCostUsd: 0.0002, confidence: 0.90 },
      candidateRoute: { tier: "T3", model: "expensive-model", estimatedCostUsd: 0.015, confidence: 0.90, requiresEscalation: false }, // unjustified cost inflation
    },
  ];

  const batchRes = comparator.evaluateBatch({
    benchmarkId: "failing_eval_v1",
    evalSet: evalSetWithRegressions,
  });

  assert.equal(batchRes.ok, false);
  assert.equal(batchRes.verdict, "REJECT");
  assert.equal(batchRes.receipt.regressions_count, 2);
  assert.equal(verifyShadowRoutingComparatorReceipt(batchRes.receipt), true);
  console.log("  [PASS] Test 6: Route regressions fail closed with REJECT verdict");
}

// Test 7: Cryptographic tamper resistance
{
  const evalSet = [
    {
      queryId: "t1",
      primaryRoute: { tier: "T2", model: "m1", estimatedCostUsd: 0.003, confidence: 0.90 },
      candidateRoute: { tier: "T2", model: "m1", estimatedCostUsd: 0.003, confidence: 0.90 },
    },
  ];

  const { receipt } = comparator.evaluateBatch({ evalSet });
  assert.equal(verifyShadowRoutingComparatorReceipt(receipt), true);

  const tampered1 = { ...receipt, verdict: "REJECT" };
  assert.equal(verifyShadowRoutingComparatorReceipt(tampered1), false);

  const tampered2 = { ...receipt, evidence_sha256: "bad".repeat(21) + "0" };
  assert.equal(verifyShadowRoutingComparatorReceipt(tampered2), false);

  console.log("  [PASS] Test 7: Receipt cryptographic tamper resistance validated");
}

console.log("[SHADOW_ROUTING_COMPARATOR_TEST] All 7 tests passed successfully.");
