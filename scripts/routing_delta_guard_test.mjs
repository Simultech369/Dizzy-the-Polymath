/**
 * Live Routing Quality/Cost/Latency Deltas & Asymmetric Economics Tests (W-0153)
 *
 * Verifies that the model router and routing policy:
 * 1. Accurately calculate asymmetric input vs. reasoning/thinking token pricing
 * 2. Project routing_deltas in execution receipts (actual_cost_usd, cost_delta_usd, latency_delta_ms)
 * 3. Track tier latency baselines across T0, T1, T2, and T3
 * 4. Record fallback quality deltas (nominal vs fallback_degraded vs exhausted_blocked)
 * 5. Emit verifiable cryptographic route delta receipts (dizzy.routing_delta_receipt.v1)
 */

import assert from "node:assert/strict";
import {
  planRouting,
  executeRoutingPlan,
  resolveRequirements,
  calculateAsymmetricCostUsd,
  buildRouteDeltaReceipt,
  TIER_INPUT_COST_PER_1K,
  TIER_OUTPUT_COST_PER_1K,
  TIER_BASELINE_LATENCY_MS,
  ROUTING_DELTA_RECEIPT_SCHEMA,
} from "../lib/routing_policy.mjs";

console.log("=== W-0153 Live Routing Deltas & Asymmetric Economics Test Suite ===\n");

const now = new Date("2026-09-17T12:00:00.000Z");
const context = {
  prompt_pack_version: "pack.v1",
  full_prompt_sha256: "a".repeat(64),
  context_sha256: "b".repeat(64),
  sources_sha256: "c".repeat(64),
  authorization_scope_sha256: "d".repeat(64),
  client_service_conversation_partition: "client:partition",
  response_contract_sha256: "e".repeat(64),
  rendered_bytes: 256,
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  surface_id: "desktop",
};

const future = "2026-09-17T13:00:00.000Z";

function sampleRoute(overrides = {}) {
  return {
    route_id: "openrouter:primary",
    model_id: "qwen/qwen-2.5-coder-32b-instruct",
    adapter: "openrouter",
    surface_id: "desktop",
    callable: true,
    evidence_expires_at: future,
    capabilities: ["chat", "utility", "code_review", "extract"],
    task_classes: ["chat", "utility", "code_review", "extraction", "deterministic_status"],
    trust_zones: ["private_self", "trusted_collaborator"],
    sensitivity_classes: ["public", "internal"],
    efforts: ["low", "standard", "high"],
    tiers: ["T0", "T1", "T2", "T3"],
    enforceable_limits: true,
    provider_boundary: "trusted_collaborator",
    cost_band: "low",
    priority: 100,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// Test 1: Asymmetric Token Pricing Calculations
// -----------------------------------------------------------------------------
console.log("-> Test 1: Testing asymmetric input vs reasoning token pricing...");

// T3 reasoning task with 10k input tokens and 4k thinking tokens
const t3AsymmetricCost = calculateAsymmetricCostUsd({
  tier: "T3",
  inputTokens: 10000,
  outputTokens: 4000,
});
// 10k input * $0.0050/1k = $0.05
// 4k output * $0.0250/1k = $0.10
// Total = $0.15
assert.equal(t3AsymmetricCost, 0.15, "T3 asymmetric cost must reflect 5x multiplier on reasoning tokens");

// T1 local/flash task
const t1Cost = calculateAsymmetricCostUsd({
  tier: "T1",
  inputTokens: 20000,
  outputTokens: 1000,
});
// 20k * 0.00015 = 0.003
// 1k * 0.0006 = 0.0006
// Total = 0.0036
assert.equal(t1Cost, 0.0036);

// T0 deterministic handler
const t0Cost = calculateAsymmetricCostUsd({
  tier: "T0",
  inputTokens: 50000,
  outputTokens: 10000,
});
assert.equal(t0Cost, 0.0, "T0 deterministic handler must have zero token cost");

console.log("  [PASS] Test 1: Asymmetric token pricing correctly calculates input and reasoning rates");

// -----------------------------------------------------------------------------
// Test 2: Nominal Execution with Cost and Latency Deltas
// -----------------------------------------------------------------------------
console.log("-> Test 2: Verifying routing_deltas in nominal execution receipt...");

const plan = planRouting({
  task_class: "code_review",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "standard",
  budget_bytes: 4096,
  budget_tokens: 10000, // estimated at T2: 10k * $0.003/1k = $0.03
  surface_id: "desktop",
}, { now, surface_id: "desktop", context, route_evidence: [sampleRoute()] });

assert.equal(plan.selected_tier, "T2");
assert.equal(plan.estimated_cost_usd, 0.03);

let clock = 100000;
let calls = 0;
const execution = await executeRoutingPlan(plan, {
  now: () => {
    calls++;
    if (calls > 1) clock = 100600;
    return clock;
  },
  invokeRoute: async ({ route }) => {
    return {
      text: "Code review passes with no findings.",
      sent_model: route.model_id,
      reported_model: route.model_id,
      ttft_ms: 85,
      usage: {
        input_tokens: 3000,  // 3k * $0.002 = $0.006
        output_tokens: 1000, // 1k * $0.008 = $0.008
        // Total actual = $0.014
      },
    };
  },
});

assert.equal(execution.status, "SUCCEEDED");
assert.ok(execution.routing_deltas, "Execution receipt must include routing_deltas");

const deltas = execution.routing_deltas;
assert.equal(deltas.actual_cost_usd, 0.014, "Actual cost must match asymmetric token billing");
assert.equal(deltas.cost_delta_usd, -0.016, "Cost delta must reflect savings under budget ($0.014 - $0.03 = -$0.016)");
assert.equal(deltas.baseline_latency_ms, TIER_BASELINE_LATENCY_MS["T2"]);
assert.equal(deltas.latency_delta_ms, -600, "Latency delta must reflect speedup vs baseline (600 - 1200 = -600ms)");
assert.equal(deltas.fallback_occurred, false);
assert.equal(deltas.fallback_attempts_count, 0);
assert.equal(deltas.quality_delta, "nominal");

console.log("  [PASS] Test 2: Nominal execution deltas recorded (cost savings -$0.016, latency -600ms)");

// -----------------------------------------------------------------------------
// Test 3: Fallback Execution with Quality Degradation Tracking
// -----------------------------------------------------------------------------
console.log("-> Test 3: Fallback execution and degraded quality delta tracking...");

const primaryRoute = sampleRoute({
  route_id: "cloud:primary",
  model_id: "deepseek/deepseek-r1",
  tier: "T2",
  priority: 100,
});
const fallbackRoute = sampleRoute({
  route_id: "local:ollama",
  model_id: "qwen2.5-coder:7b",
  tier: "T1",
  priority: 50,
});

const fallbackPlan = planRouting({
  task_class: "code_review",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "standard",
  budget_bytes: 4096,
  budget_tokens: 5000,
  surface_id: "desktop",
}, { now, surface_id: "desktop", context, route_evidence: [primaryRoute, fallbackRoute] });

let fallbackClock = 200000;
const fallbackExecution = await executeRoutingPlan(fallbackPlan, {
  now: () => {
    fallbackClock += 900;
    return fallbackClock;
  },
  invokeRoute: async ({ route }) => {
    if (route.route_id === "cloud:primary") {
      const err = new Error("Rate limit exceeded 429");
      err.code = "RATE_LIMITED";
      err.status = 429;
      throw err;
    }
    return {
      text: "Fallback local review completed.",
      sent_model: route.model_id,
      reported_model: route.model_id,
      ttft_ms: 120,
      usage: { input_tokens: 2000, output_tokens: 500 },
    };
  },
  permitFallback: () => true,
});

assert.equal(fallbackExecution.status, "SUCCEEDED");
assert.equal(fallbackExecution.selected_model_or_route, "local:ollama");
assert.equal(fallbackExecution.attempts.length, 2);

const fallbackDeltas = fallbackExecution.routing_deltas;
assert.equal(fallbackDeltas.fallback_occurred, true, "Must flag that fallback occurred");
assert.equal(fallbackDeltas.fallback_attempts_count, 1, "Must record 1 fallback transition");
assert.equal(fallbackDeltas.quality_delta, "fallback_degraded", "Must record fallback quality degradation");
assert.ok(typeof fallbackDeltas.actual_cost_usd === "number");

console.log("  [PASS] Test 3: Fallback execution correctly flagged fallback_degraded with attempt chain");

// -----------------------------------------------------------------------------
// Test 4: Cryptographic Route Delta Receipt Verification
// -----------------------------------------------------------------------------
console.log("-> Test 4: Generating and verifying cryptographic Route Delta Receipt...");

const deltaReceipt = buildRouteDeltaReceipt({
  plan: fallbackPlan,
  executionReceipt: fallbackExecution,
});

assert.equal(deltaReceipt.schema, ROUTING_DELTA_RECEIPT_SCHEMA);
assert.equal(deltaReceipt.schema, "dizzy.routing_delta_receipt.v1");
assert.equal(deltaReceipt.task_class, "code_review");
assert.equal(deltaReceipt.selected_tier, "T2");
assert.equal(deltaReceipt.selected_model_or_route, "local:ollama");
assert.equal(deltaReceipt.execution_status, "SUCCEEDED");
assert.equal(deltaReceipt.attempts_count, 2);
assert.ok(deltaReceipt.plan_receipt_sha256);
assert.ok(deltaReceipt.execution_receipt_sha256);
assert.ok(deltaReceipt.receipt_sha256 && deltaReceipt.receipt_sha256.length === 64);
assert.equal(deltaReceipt.routing_deltas.fallback_occurred, true);

console.log("  [PASS] Test 4: Route Delta Receipt generated with verifiable SHA-256 digest");

// -----------------------------------------------------------------------------
// Test 5: T0 Deterministic Execution Deltas
// -----------------------------------------------------------------------------
console.log("-> Test 5: Verifying T0 deterministic execution deltas...");

const t0Plan = planRouting({
  task_class: "deterministic_status",
  trust_zone: "private_self",
  sensitivity: "internal",
  effort_hint: "none",
  budget_bytes: 1024,
  budget_tokens: 0,
  surface_id: "desktop",
}, {
  now,
  surface_id: "desktop",
  context,
  deterministic_handlers: [{
    task_class: "deterministic_status",
    trust_zone: "private_self",
    response_contract: "status.v1",
    route_id: "health_evaluator",
  }],
});

let t0Clock = 300000;
const t0Execution = await executeRoutingPlan(t0Plan, {
  now: () => {
    t0Clock += 5;
    return t0Clock;
  },
  deterministicHandlers: {
    health_evaluator: () => ({ text: "ok", payload: { healthy: true } }),
  },
});

assert.equal(t0Execution.status, "SUCCEEDED");
const t0Deltas = t0Execution.routing_deltas;
assert.equal(t0Deltas.actual_cost_usd, 0.0);
assert.equal(t0Deltas.baseline_latency_ms, 10);
assert.ok(t0Deltas.latency_delta_ms <= 0, "Fast T0 handler should beat 10ms baseline");
assert.equal(t0Deltas.fallback_occurred, false);
assert.equal(t0Deltas.quality_delta, "nominal");

console.log("  [PASS] Test 5: T0 deterministic deltas verified cleanly ($0 cost, nominal quality)");

console.log("\n[PASS] All live routing delta and asymmetric economics tests passed cleanly!");
console.log("ROUTING_DELTA_GUARD_TESTS_OK\n");
