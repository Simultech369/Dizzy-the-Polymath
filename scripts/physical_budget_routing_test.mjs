/**
 * Physical Budget Routing & System 1 Decision Layer Tests (W-0155)
 *
 * Verifies that the model router and routing policy:
 * 1. Clamps tiers under physical memory pressure (BOAR cascade) to protect edge devices
 * 2. Enforces interactive latency SLAs (< 350ms) by downgrading heavy models to fast paths
 * 3. Enforces zero-cost floors ($0.00) for deterministic triage tasks
 * 4. Projects Jev-style System 1 typed decision objects (Choice, Score, Noul) in plans & receipts
 * 5. Enforces dual-control HITL gates on low-confidence high-stakes operations
 * 6. Binds physical budgets and System 1 decisions cryptographically into Route Delta Receipts
 */

import assert from "node:assert/strict";
import {
  planRouting,
  executeRoutingPlan,
  resolveRequirements,
  buildRouteDeltaReceipt,
  DEFAULT_MEMORY_BUDGET_MB,
  DEFAULT_INTERACTIVE_LATENCY_BUDGET_MS,
  DEFAULT_HITL_CONFIDENCE_THRESHOLD,
  TIER_BASELINE_LATENCY_MS,
} from "../lib/routing_policy.mjs";

console.log("=== W-0155 Physical Budget Routing & System 1 Decision Test Suite ===\n");

const now = new Date("2026-09-28T12:00:00.000Z");
const future = "2026-09-28T13:00:00.000Z";

const context = {
  prompt_pack_version: "pack.v1",
  full_prompt_sha256: "a".repeat(64),
  context_sha256: "b".repeat(64),
  sources_sha256: "c".repeat(64),
  authorization_scope_sha256: "d".repeat(64),
  client_service_conversation_partition: "client:partition",
  response_contract_sha256: "e".repeat(64),
  rendered_bytes: 512,
  trust_zone: "trusted_collaborator",
  sensitivity: "public",
  surface_id: "desktop",
};

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
    priority: 10,
    ...overrides,
  };
}

async function runTests() {
  // ----------------------------------------------------
  // Test 1: BOAR-Style Memory Pressure Cascading
  // ----------------------------------------------------
  console.log("Test 1: Testing BOAR-Style Memory Pressure Cascading...");

  // High RSS memory pressure (1350 MB / 1400 MB = 96.4% pressure)
  const memoryConstrainedReq = {
    task_class: "chat",
    trust_zone: "trusted_collaborator",
    sensitivity: "public",
    effort_hint: "standard", // normally T2
    budget_bytes: 4096,
    budget_tokens: 2000,
    memory_budget_mb: 1400,
    current_rss_mb: 1350,
  };

  const resolvedMemory = resolveRequirements(memoryConstrainedReq, { surface_id: "desktop", now });
  assert.equal(resolvedMemory.ok, true);
  assert.equal(resolvedMemory.selected_tier, "T1", "High memory pressure must clamp requested T2 down to T1");
  assert.equal(resolvedMemory.effort_adjustment, "lowered_due_to_memory_pressure");
  assert.equal(resolvedMemory.physical_budgets.memory_pressure_ratio > 0.9, true);
  assert.equal(resolvedMemory.system1_decisions.memory_pressure_score.exceeds_threshold, true);
  assert.equal(resolvedMemory.system1_decisions.tier_choice.selected, "T1");

  // Also verify code_review with effort_hint: high (normally T3) clamps to T2 (its minimum_tier)
  const codeReviewHighMemory = resolveRequirements({
    task_class: "code_review",
    trust_zone: "trusted_collaborator",
    sensitivity: "public",
    effort_hint: "high", // normally T3
    budget_bytes: 4096,
    budget_tokens: 2000,
    memory_budget_mb: 1400,
    current_rss_mb: 1350,
  }, { surface_id: "desktop", now, t3_authorized: true });
  assert.equal(codeReviewHighMemory.selected_tier, "T2", "High memory pressure clamps T3 down to task minimum tier T2");
  assert.equal(codeReviewHighMemory.effort_adjustment, "lowered_due_to_memory_pressure");

  console.log("✓ Memory pressure correctly clamped tier to on-device lightweight T1 and respected minimum tier.");

  // ----------------------------------------------------
  // Test 2: Interactive Latency SLA Enforcement (< 350ms)
  // ----------------------------------------------------
  console.log("\nTest 2: Testing Interactive Latency SLA Enforcement...");

  const interactiveReq = {
    task_class: "chat",
    trust_zone: "trusted_collaborator",
    sensitivity: "public",
    effort_hint: "standard", // normally T2 (baseline latency 1200ms)
    budget_bytes: 2048,
    budget_tokens: 1000,
    interactive: true, // triggers default 350ms SLA
    current_rss_mb: 400,
  };

  const resolvedInteractive = resolveRequirements(interactiveReq, { surface_id: "desktop", now });
  assert.equal(resolvedInteractive.ok, true);
  assert.equal(resolvedInteractive.selected_tier, "T1", "Interactive SLA must clamp tier to meet < 350ms baseline");
  assert.equal(resolvedInteractive.effort_adjustment, "lowered_due_to_latency_budget");
  assert.equal(resolvedInteractive.physical_budgets.interactive, true);
  assert.equal(resolvedInteractive.physical_budgets.max_latency_ms, DEFAULT_INTERACTIVE_LATENCY_BUDGET_MS);
  assert.equal(resolvedInteractive.system1_decisions.latency_sla_noul.predicate, true);

  console.log("✓ Interactive latency SLA enforced: clamped to fast path T1 (250ms < 350ms SLA).");

  // ----------------------------------------------------
  // Test 3: Zero-Cost Floor Enforcement ($0.00 T0)
  // ----------------------------------------------------
  console.log("\nTest 3: Testing Zero-Cost Floor Enforcement...");

  const zeroCostReq = {
    task_class: "deterministic_status",
    trust_zone: "trusted_collaborator",
    sensitivity: "public",
    effort_hint: "none",
    budget_bytes: 1024,
    budget_tokens: 500,
    zero_cost_required: true,
  };

  const resolvedZeroCost = resolveRequirements(zeroCostReq, { surface_id: "desktop", now });
  assert.equal(resolvedZeroCost.ok, true);
  assert.equal(resolvedZeroCost.selected_tier, "T0");
  assert.equal(resolvedZeroCost.estimated_cost_usd, 0.0);
  assert.equal(resolvedZeroCost.system1_decisions.within_budget_noul.predicate, true);

  console.log("✓ Zero-cost floor verified: strictly locked to T0 ($0.00).");

  // ----------------------------------------------------
  // Test 4: Jev-Style TypeSafe System 1 Decision Primitives
  // ----------------------------------------------------
  console.log("\nTest 4: Verifying TypeSafe System 1 Decision Primitives...");

  const nominalReq = {
    task_class: "extraction",
    trust_zone: "trusted_collaborator",
    sensitivity: "public",
    effort_hint: "low",
    budget_bytes: 2048,
    budget_tokens: 800,
    current_rss_mb: 500,
    memory_budget_mb: 1400,
  };

  const resolvedNominal = resolveRequirements(nominalReq, { surface_id: "desktop", now });
  const s1 = resolvedNominal.system1_decisions;

  // Choice verification
  assert.equal(s1.tier_choice.type, "Choice");
  assert.equal(s1.tier_choice.selected, "T1");
  assert.deepEqual(s1.tier_choice.allowlist, ["T0", "T1", "T2", "T3", "human_triage"]);

  // Score verification
  assert.equal(s1.memory_pressure_score.type, "Score");
  assert.equal(s1.memory_pressure_score.metric, "rss_memory_pressure");
  assert.equal(s1.memory_pressure_score.exceeds_threshold, false);

  // Noul verification
  assert.equal(s1.latency_sla_noul.type, "Noul");
  assert.equal(s1.latency_sla_noul.predicate, true);
  assert.equal(s1.within_budget_noul.type, "Noul");
  assert.equal(s1.within_budget_noul.predicate, true);

  console.log("✓ System 1 Choice, Score, and Noul primitives correctly projected and typed.");

  // ----------------------------------------------------
  // Test 5: Dual-Control High-Stakes HITL Gate
  // ----------------------------------------------------
  console.log("\nTest 5: Testing Dual-Control High-Stakes HITL Gate...");

  // High-stakes request with low confidence (0.65 < 0.85 threshold)
  const highStakesReq = {
    task_class: "code_review",
    trust_zone: "trusted_collaborator",
    sensitivity: "public",
    effort_hint: "standard",
    budget_bytes: 4096,
    budget_tokens: 1500,
    is_high_stakes: true,
    confidence: 0.65,
    hitl_confidence_threshold: 0.85,
  };

  const planHighStakes = planRouting(highStakesReq, {
    now,
    surface_id: "desktop",
    context,
    route_evidence: [sampleRoute()],
  });

  assert.equal(planHighStakes.hitl_escalation_required, true);
  assert.equal(planHighStakes.system1_decisions.tier_choice.selected, "human_triage");

  // Attempting execution without operator approval must fail closed
  const executionWithoutApproval = await executeRoutingPlan(planHighStakes, {
    now,
    invokeRoute: async () => ({ text: "should not run" }),
    hitl_approved: false,
  });

  assert.equal(executionWithoutApproval.status, "BLOCKED");
  assert.equal(executionWithoutApproval.fail_closed_reason, "hitl_approval_required");
  assert.equal(executionWithoutApproval.physical_budgets.hitl_escalation_required, true);

  // Executing WITH operator approval proceeds
  const executionWithApproval = await executeRoutingPlan(planHighStakes, {
    now,
    invokeRoute: async () => ({
      text: "Code review completed with operator dual-control sign-off",
      usage: { input_tokens: 1000, output_tokens: 200 },
    }),
    hitl_approved: true,
  });

  assert.equal(executionWithApproval.status, "SUCCEEDED");
  assert.equal(executionWithApproval.provider_invoked, true);

  console.log("✓ Dual-control HITL gate blocks unapproved execution and permits operator-approved run.");

  // ----------------------------------------------------
  // Test 6: Route Delta Receipt Custody
  // ----------------------------------------------------
  console.log("\nTest 6: Verifying Route Delta Receipt Custody with System 1 Decisions...");

  const deltaReceipt = buildRouteDeltaReceipt({
    plan: planHighStakes,
    executionReceipt: executionWithApproval,
  });

  assert.ok(deltaReceipt.receipt_sha256);
  assert.ok(deltaReceipt.physical_budgets);
  assert.ok(deltaReceipt.system1_decisions);
  assert.equal(deltaReceipt.physical_budgets.is_high_stakes, true);
  assert.equal(deltaReceipt.system1_decisions.tier_choice.type, "Choice");

  console.log("✓ Route delta receipt cryptographically binds physical budgets and System 1 decisions.");

  console.log("\n==================================================");
  console.log("   ALL PHYSICAL BUDGET ROUTING TESTS PASSED!      ");
  console.log("==================================================\n");
}

runTests().catch((err) => {
  console.error("\n[FATAL] Test failed:", err);
  process.exit(1);
});
