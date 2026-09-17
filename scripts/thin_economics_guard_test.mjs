import assert from "node:assert/strict";
import {
  planRouting,
  resolveRequirements,
  executeRoutingPlan,
  buildRoutingReceipt,
  TIER_ESTIMATED_COST_PER_1K,
  EASY_TASK_CLASSES,
  THINKING_BUDGET_BY_EFFORT,
} from "../lib/routing_policy.mjs";

console.log("=== W-0149 Thin Economics & Route Guardrails Test Suite ===");

const now = new Date("2026-09-17T12:00:00.000Z");
const future = "2026-09-17T12:10:00.000Z";

const context = {
  prompt_pack_version: "pack.v1",
  full_prompt_sha256: "a".repeat(64),
  context_sha256: "b".repeat(64),
  sources_sha256: "c".repeat(64),
  authorization_scope_sha256: "d".repeat(64),
  client_service_conversation_partition: "client:partition",
  response_contract_sha256: "e".repeat(64),
  rendered_bytes: 256,
};

function sampleRoute(overrides = {}) {
  return {
    route_id: "local:qwen-coder",
    model_id: "qwen-coder:7b",
    adapter: "ollama",
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
    provider_boundary: "private_self",
    priority: 10,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// Test 1: Easy Task Reasoning Token Clamping
// -----------------------------------------------------------------------------
console.log("-> Test 1: Reasoning budget clamping on easy tasks...");

// Easy task (extraction) with requested high effort should clamp thinking budget
const easyExtraction = resolveRequirements({
  task_class: "extraction",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "high",
  budget_bytes: 4096,
  budget_tokens: 2000,
  surface_id: "desktop",
}, { surface_id: "desktop", now });

assert.equal(easyExtraction.ok, true);
assert.equal(easyExtraction.reasoning_clamped, true, "Extraction with high effort must be clamped");
assert.equal(easyExtraction.max_thinking_tokens, 1024, "Clamped thinking tokens should be 1024");

// Deterministic status task should have max_thinking_tokens: 0
const easyDeterministic = resolveRequirements({
  task_class: "deterministic_status",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "high",
  budget_bytes: 4096,
  budget_tokens: 500,
  surface_id: "desktop",
}, { surface_id: "desktop", now });

assert.equal(easyDeterministic.ok, true);
assert.equal(easyDeterministic.reasoning_clamped, true);
assert.equal(easyDeterministic.max_thinking_tokens, 0, "Deterministic status must burn zero thinking tokens");

// Complex task (code_review) with high effort must NOT be clamped
const complexCodeReview = resolveRequirements({
  task_class: "code_review",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "high",
  budget_bytes: 8192,
  budget_tokens: 4000,
  surface_id: "desktop",
}, { surface_id: "desktop", now, t3_authorized: true });

assert.equal(complexCodeReview.ok, true);
assert.equal(complexCodeReview.reasoning_clamped, false, "Code review should not have reasoning clamped");
assert.equal(complexCodeReview.max_thinking_tokens, 16384, "High effort complex task gets full thinking budget");

// -----------------------------------------------------------------------------
// Test 2: Per-Run Cost Budget Kill Switch
// -----------------------------------------------------------------------------
console.log("-> Test 2: Per-run cost budget kill switch...");

// Request that exceeds max_cost_usd must fail closed immediately
const budgetBlocked = resolveRequirements({
  task_class: "code_review",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "standard",
  budget_bytes: 4096,
  budget_tokens: 50000, // 50k tokens at T2 ($0.003/1k) = $0.15
  max_cost_usd: 0.05,  // Allowed limit $0.05
  surface_id: "desktop",
}, { surface_id: "desktop", now });

assert.equal(budgetBlocked.ok, false);
assert.equal(budgetBlocked.reason, "cost_budget_exceeded");
assert.ok(budgetBlocked.violations[0].includes("cost_budget_exceeded"));
assert.equal(budgetBlocked.estimated_cost_usd, 0.15);
assert.equal(budgetBlocked.max_cost_usd, 0.05);

// Plan routing on cost-exceeded input seals a BLOCKED plan
const blockedCostPlan = planRouting({
  task_class: "code_review",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "standard",
  budget_bytes: 4096,
  budget_tokens: 50000,
  max_cost_usd: 0.01,
  surface_id: "desktop",
}, { now, surface_id: "desktop", context, route_evidence: [sampleRoute()] });

assert.equal(blockedCostPlan.selected_tier, "BLOCKED");
assert.equal(blockedCostPlan.fail_closed_reason, "cost_budget_exceeded");

// Negative max_cost_usd fails validation
const invalidCostReq = resolveRequirements({
  task_class: "chat",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "low",
  budget_bytes: 1024,
  budget_tokens: 100,
  max_cost_usd: -0.5,
  surface_id: "desktop",
}, { surface_id: "desktop", now });

assert.equal(invalidCostReq.ok, false);
assert.equal(invalidCostReq.reason, "max_cost_usd_invalid");

// Valid cost budget passes and projects through plan and receipt
const allowedPlan = planRouting({
  task_class: "chat",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "low",
  budget_bytes: 2048,
  budget_tokens: 2000,
  max_cost_usd: 0.10,
  surface_id: "desktop",
}, { now, surface_id: "desktop", context, route_evidence: [sampleRoute()] });

assert.equal(allowedPlan.selected_tier, "T1");
assert.equal(allowedPlan.fail_closed_reason, null);
assert.equal(allowedPlan.max_cost_usd, 0.10);
assert.ok(typeof allowedPlan.estimated_cost_usd === "number");
assert.ok(allowedPlan.estimated_cost_usd <= 0.10);
assert.equal(allowedPlan.routing_receipt.max_cost_usd, 0.10);
assert.equal(allowedPlan.routing_receipt.estimated_cost_usd, allowedPlan.estimated_cost_usd);
assert.equal(allowedPlan.routing_receipt.reasoning_clamped, false); // low effort chat is not clamped (already low)
assert.equal(allowedPlan.planned_chain[0].max_thinking_tokens, allowedPlan.max_thinking_tokens);

// -----------------------------------------------------------------------------
// Test 3: Latency & TTFT Observability in executeRoutingPlan
// -----------------------------------------------------------------------------
console.log("-> Test 3: Latency & TTFT observability in executeRoutingPlan...");

let clockMs = 1000;
const executionReceipt = await executeRoutingPlan(allowedPlan, {
  now: () => {
    clockMs += 25;
    return clockMs;
  },
  invokeRoute: async ({ route }) => {
    return {
      text: "Chat response here",
      sent_model: route.model_id,
      reported_model: route.model_id,
      ttft_ms: 18,
      usage: { input_tokens: 50, output_tokens: 20, ttft_ms: 18 },
    };
  },
});

assert.equal(executionReceipt.status, "SUCCEEDED");
assert.ok(executionReceipt.duration_ms >= 25, "Execution duration must be captured");
assert.equal(executionReceipt.ttft_ms, 18, "TTFT must be propagated to receipt");
assert.ok(executionReceipt.attempts[0].duration_ms >= 25, "Attempt duration must be captured");
assert.equal(executionReceipt.attempts[0].ttft_ms, 18, "Attempt TTFT must be captured");

// Deterministic T0 execution latency
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
    route_id: "status_checker",
  }],
});

let t0Clock = 5000;
const t0Execution = await executeRoutingPlan(t0Plan, {
  now: () => {
    t0Clock += 15;
    return t0Clock;
  },
  deterministicHandlers: {
    status_checker: () => ({ text: "ok", payload: { healthy: true } }),
  },
});

assert.equal(t0Execution.status, "SUCCEEDED");
assert.equal(t0Execution.provider_invoked, false);
assert.ok(t0Execution.duration_ms >= 15, "T0 duration must be tracked");
assert.equal(t0Execution.ttft_ms, null, "T0 has no TTFT");

// -----------------------------------------------------------------------------
// Test 4: Boundary Chaos & Latency Fallback
// -----------------------------------------------------------------------------
console.log("-> Test 4: Boundary chaos & fallback under provider timeout...");

const primaryRoute = sampleRoute({
  route_id: "local:primary",
  model_id: "deepseek-v3",
  adapter: "ollama",
  provider_boundary: "private_self",
  priority: 100,
});

const fallbackRoute = sampleRoute({
  route_id: "local:backup",
  model_id: "qwen-coder:7b",
  adapter: "ollama",
  provider_boundary: "private_self",
  priority: 50,
});

const chaosPlan = planRouting({
  task_class: "code_review",
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  effort_hint: "standard",
  budget_bytes: 4096,
  budget_tokens: 1000,
  surface_id: "desktop",
}, {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [primaryRoute, fallbackRoute],
});

assert.equal(chaosPlan.planned_chain.length, 2);
assert.equal(chaosPlan.planned_chain[0].route_id, "local:primary");
assert.equal(chaosPlan.planned_chain[1].route_id, "local:backup");

let chaosClock = 10000;
const chaosExecution = await executeRoutingPlan(chaosPlan, {
  now: () => {
    chaosClock += 50;
    return chaosClock;
  },
  invokeRoute: async ({ route }) => {
    if (route.route_id === "local:primary") {
      // Simulate timeout / network spike chaos
      const err = new Error("Gateway timeout: provider unresponsive after 5000ms");
      err.code = "GATEWAY_TIMEOUT";
      err.status = 504;
      throw err;
    }
    return {
      text: "Fallback review completed successfully",
      sent_model: route.model_id,
      reported_model: route.model_id,
      ttft_ms: 45,
      usage: { input_tokens: 80, output_tokens: 30 },
    };
  },
  permitFallback: ({ error, route }) => {
    return error.code === "GATEWAY_TIMEOUT";
  },
});

assert.equal(chaosExecution.status, "SUCCEEDED");
assert.equal(chaosExecution.selected_model_or_route, "local:backup");
assert.equal(chaosExecution.attempts.length, 2);
assert.equal(chaosExecution.attempts[0].status, "FAILED");
assert.equal(chaosExecution.attempts[0].error_code, "gateway_timeout");
assert.equal(chaosExecution.attempts[0].status_code, 504);
assert.ok(chaosExecution.attempts[0].duration_ms >= 50);

assert.equal(chaosExecution.attempts[1].status, "SUCCEEDED");
assert.equal(chaosExecution.attempts[1].route_id, "local:backup");
assert.equal(chaosExecution.attempts[1].ttft_ms, 45);
assert.equal(chaosExecution.ttft_ms, 45);
assert.ok(chaosExecution.duration_ms >= 100);

// Exhausted attempts fail closed
let exhaustedClock = 20000;
const exhaustedExecution = await executeRoutingPlan(chaosPlan, {
  now: () => {
    exhaustedClock += 10;
    return exhaustedClock;
  },
  invokeRoute: async () => {
    const err = new Error("General service outage");
    err.code = "SERVICE_UNAVAILABLE";
    throw err;
  },
  permitFallback: () => false, // Do not permit fallback
});

assert.equal(exhaustedExecution.status, "BLOCKED");
assert.equal(exhaustedExecution.fail_closed_reason, "eligible_attempts_exhausted");
assert.equal(exhaustedExecution.attempts.length, 1);
assert.equal(exhaustedExecution.attempts[0].status, "FAILED");
assert.ok(exhaustedExecution.duration_ms >= 10);

console.log("[PASS] All thin economics, clamping, and boundary chaos guardrail tests passed.");
console.log("THIN_ECONOMICS_GUARD_TESTS_OK");
