import assert from "node:assert/strict";
import {
  buildRoutingReceipt,
  buildExactCacheEligibility,
  executeRoutingPlan,
  planRouting,
  resolveRequirements,
} from "../lib/routing_policy.mjs";

console.log("=== W-0130 Capability-First Routing Policy Test Suite ===");

const now = new Date("2026-09-12T12:00:00.000Z");
const future = "2026-09-12T12:05:00.000Z";
const past = "2026-09-12T11:00:00.000Z";

const context = {
  prompt_pack_version: "pack.v1",
  full_prompt_sha256: "a".repeat(64),
  context_sha256: "b".repeat(64),
  sources_sha256: "c".repeat(64),
  authorization_scope_sha256: "d".repeat(64),
  client_service_conversation_partition: "client:conversation",
  response_contract_sha256: "e".repeat(64),
  rendered_bytes: 512,
};

function baseRequest(overrides = {}) {
  return {
    task_class: "code_review",
    trust_zone: "trusted_collaborator",
    sensitivity: "public",
    effort_hint: "standard",
    budget_bytes: 4096,
    budget_tokens: 1200,
    surface_id: "desktop",
    request: "review this small diff",
    ...overrides,
  };
}

function localRoute(overrides = {}) {
  return {
    route_id: "ollama:qwen2.5-coder:7b",
    model_id: "qwen2.5-coder:7b",
    adapter: "ollama",
    surface_id: "desktop",
    callable: true,
    evidence_expires_at: future,
    capabilities: ["code_review", "code_synthesis", "extract"],
    task_classes: ["code_review", "code_synthesis", "extraction"],
    trust_zones: ["private_self", "trusted_collaborator"],
    sensitivity_classes: ["public", "internal"],
    efforts: ["low", "standard"],
    tiers: ["T1", "T2"],
    enforceable_limits: true,
    provider_boundary: "private_self",
    priority: 1,
    ...overrides,
  };
}

function cloudRoute(overrides = {}) {
  return {
    route_id: "openrouter:auto",
    model_id: "openrouter/auto",
    adapter: "openai_compat",
    surface_id: "desktop",
    callable: true,
    evidence_expires_at: future,
    capabilities: ["code_review", "extract"],
    task_classes: ["code_review", "extraction"],
    trust_zones: ["trusted_collaborator"],
    sensitivity_classes: ["public"],
    efforts: ["low", "standard", "high"],
    tiers: ["T1", "T2", "T3"],
    enforceable_limits: true,
    provider_boundary: "trusted_collaborator",
    priority: 5,
    ...overrides,
  };
}

const resolved = resolveRequirements(baseRequest(), { surface_id: "desktop", now });
assert.equal(resolved.ok, true);
assert.equal(resolved.selected_tier, "T2");
assert.ok(resolved.policy_sha256);

const missing = resolveRequirements({ task_class: "code_review" }, { surface_id: "desktop" });
assert.equal(missing.ok, false);
assert.ok(missing.violations.includes("trust_zone_required"));
assert.ok(missing.violations.includes("sensitivity_required"));
assert.ok(missing.violations.includes("budget_bytes_invalid"));

const cacheEligible = buildExactCacheEligibility(resolved, context);
assert.equal(cacheEligible.eligible, true);
assert.ok(cacheEligible.key);

const cacheChanged = buildExactCacheEligibility(
  resolveRequirements(baseRequest({ sensitivity: "internal" }), { surface_id: "desktop" }),
  context
);
assert.notEqual(cacheChanged.key, cacheEligible.key, "Sensitivity must bind the exact cache key");

const cacheMissing = buildExactCacheEligibility(resolved, { ...context, prompt_pack_version: "" });
assert.equal(cacheMissing.eligible, false);
assert.equal(cacheMissing.reason, "missing_cache_bindings");
assert.ok(cacheMissing.missing_bindings.includes("prompt_pack_version"));

const noCache = buildExactCacheEligibility(
  resolveRequirements(baseRequest({ task_class: "security_review" }), {
    surface_id: "desktop",
    t3_authorized: true,
  }),
  context
);
assert.equal(noCache.eligible, false);
assert.equal(noCache.reason, "task_cache_disabled");

const deterministicPlan = planRouting(
  baseRequest({
    task_class: "deterministic_status",
    trust_zone: "private_self",
    sensitivity: "internal",
    effort_hint: "none",
    budget_tokens: 0,
  }),
  {
    now,
    surface_id: "desktop",
    context,
    deterministic_handlers: [{ task_class: "deterministic_status", trust_zone: "private_self", response_contract: "status.v1", route_id: "deterministic:status" }],
  }
);
assert.equal(deterministicPlan.selected_tier, "T0");
assert.equal(deterministicPlan.selected_model_or_route, "deterministic:status");
assert.equal(deterministicPlan.fail_closed_reason, null);

const staleBlocked = planRouting(baseRequest(), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [localRoute({ evidence_expires_at: past })],
});
assert.equal(staleBlocked.selected_tier, "BLOCKED");
assert.equal(staleBlocked.fail_closed_reason, "no_eligible_route");
assert.equal(staleBlocked.rejected_routes[0].reasons.includes("route_evidence_stale"), true);

const installedButUnprobedBlocked = planRouting(baseRequest(), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [localRoute({ callable: false })],
});
assert.equal(installedButUnprobedBlocked.fail_closed_reason, "no_eligible_route");
assert.equal(installedButUnprobedBlocked.rejected_routes[0].reasons.includes("route_not_callable"), true);

const privatePrefersLocal = planRouting(baseRequest({
  trust_zone: "private_self",
  sensitivity: "internal",
}), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [
    cloudRoute({ trust_zones: ["private_self", "trusted_collaborator"], sensitivity_classes: ["internal", "public"] }),
    localRoute({ priority: 0 }),
  ],
});
assert.equal(privatePrefersLocal.selected_model_or_route, "ollama:qwen2.5-coder:7b");
assert.equal(
  privatePrefersLocal.rejected_routes.some((route) => route.reasons.includes("boundary_not_allowed")),
  true
);

const requestedModelBlocked = planRouting(baseRequest({ requested_model: "gpt-5.5" }), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [localRoute()],
});
assert.equal(requestedModelBlocked.fail_closed_reason, "no_eligible_route");
assert.equal(requestedModelBlocked.rejected_routes[0].reasons.includes("requested_model_unavailable"), true);

const t3Denied = planRouting(baseRequest({ task_class: "security_review", effort_hint: "high" }), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [localRoute({ capabilities: ["security_review"], task_classes: ["security_review"], tiers: ["T3"], efforts: ["high"] })],
});
assert.equal(t3Denied.fail_closed_reason, "t3_authorization_required");

const t3RequestFlagDenied = planRouting(baseRequest({ task_class: "security_review", effort_hint: "high", t3_authorized: true }), {
  now,
  surface_id: "desktop",
  context,
  t3_authorized: false,
  route_evidence: [localRoute({ capabilities: ["security_review"], task_classes: ["security_review"], tiers: ["T3"], efforts: ["high"] })],
});
assert.equal(t3RequestFlagDenied.fail_closed_reason, "t3_authorization_required", "Request payload must not self-authorize T3");

const t3PolicyCannotWeaken = planRouting(baseRequest({ task_class: "security_review", effort_hint: "high" }), {
  now,
  surface_id: "desktop",
  context,
  policy: {
    task_classes: {
      security_review: { require_authorization_for_t3: false },
    },
  },
  route_evidence: [localRoute({ capabilities: ["security_review"], task_classes: ["security_review"], tiers: ["T3"], efforts: ["high"] })],
});
assert.equal(t3PolicyCannotWeaken.fail_closed_reason, "t3_authorization_required", "Runtime policy overrides must not weaken default T3 authorization");

const t3Allowed = planRouting(baseRequest({ task_class: "security_review", effort_hint: "high" }), {
  now,
  surface_id: "desktop",
  context,
  t3_authorized: true,
  route_evidence: [localRoute({ capabilities: ["security_review"], task_classes: ["security_review"], tiers: ["T3"], efforts: ["high"] })],
});
assert.equal(t3Allowed.selected_tier, "T3");
assert.equal(t3Allowed.fail_closed_reason, null);

const cloudCannotClaimPrivateBoundary = planRouting(baseRequest({
  trust_zone: "private_self",
  sensitivity: "internal",
}), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [cloudRoute({
    route_id: "openai-compat:spoofed-local",
    provider_boundary: "private_self",
    trust_zones: ["private_self"],
    sensitivity_classes: ["internal"],
  })],
});
assert.equal(cloudCannotClaimPrivateBoundary.fail_closed_reason, "no_eligible_route");
assert.equal(
  cloudCannotClaimPrivateBoundary.rejected_routes[0].reasons.includes("boundary_not_allowed"),
  true,
  "Cloud adapters must not self-declare private_self provider boundaries"
);

const nullEvidenceBlocked = planRouting(baseRequest(), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [null],
});
assert.equal(nullEvidenceBlocked.fail_closed_reason, "no_eligible_route");
assert.equal(nullEvidenceBlocked.rejected_routes[0].reasons.includes("malformed_route_evidence"), true);

const incompleteRoute = localRoute();
delete incompleteRoute.task_classes;
const incompleteMetadataBlocked = planRouting(baseRequest(), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [incompleteRoute],
});
assert.equal(incompleteMetadataBlocked.fail_closed_reason, "no_eligible_route");
assert.equal(incompleteMetadataBlocked.rejected_routes[0].reasons.includes("task_classes_required"), true);

const twoAttemptPlan = planRouting(baseRequest(), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [
    localRoute({ route_id: "local:first", priority: 3 }),
    localRoute({ route_id: "local:second", priority: 2 }),
    localRoute({ route_id: "local:third", priority: 1 }),
  ],
});
assert.equal(twoAttemptPlan.planned_chain.length, 2, "Default provider attempts must be capped at two");

let attempts = 0;
const execution = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async ({ route }) => {
    attempts++;
    if (route.route_id === "local:first") throw new Error("temporary failure");
    return {
      text: "ok",
      sent_model: route.model_id,
      reported_model: route.model_id,
      usage: { input_tokens: 10, output_tokens: 4 },
      response_kind: "review",
    };
  },
  permitFallback: () => true,
});
assert.equal(execution.status, "SUCCEEDED");
assert.equal(attempts, 2);
assert.equal(execution.attempts[0].status, "FAILED");
assert.equal(execution.attempts[1].status, "SUCCEEDED");

const t0Execution = await executeRoutingPlan(deterministicPlan, {
  now: () => now.getTime(),
  deterministicHandlers: {
    "deterministic:status": () => ({ text: "status-ok", response_kind: "deterministic" }),
  },
});
assert.equal(t0Execution.status, "SUCCEEDED");
assert.equal(t0Execution.provider_invoked, false);
assert.equal(t0Execution.attempts.length, 0);

const missingT0Handler = await executeRoutingPlan(deterministicPlan, {
  now: () => now.getTime(),
  deterministicHandlers: {},
});
assert.equal(missingT0Handler.status, "BLOCKED");
assert.equal(missingT0Handler.fail_closed_reason, "missing_deterministic_handler");

const inheritedT0Plan = planRouting(
  baseRequest({
    task_class: "deterministic_status",
    trust_zone: "private_self",
    sensitivity: "internal",
    effort_hint: "none",
    budget_tokens: 0,
  }),
  {
    now,
    surface_id: "desktop",
    context,
    deterministic_handlers: [{ task_class: "deterministic_status", trust_zone: "private_self", response_contract: "status.v1", route_id: "toString" }],
  }
);
const inheritedT0Execution = await executeRoutingPlan(inheritedT0Plan, {
  now: () => now.getTime(),
  deterministicHandlers: {},
});
assert.equal(inheritedT0Execution.status, "BLOCKED");
assert.equal(inheritedT0Execution.fail_closed_reason, "missing_deterministic_handler");

let staleInvoked = false;
const delayedExecution = await executeRoutingPlan(twoAttemptPlan, {
  now: () => new Date("2026-09-12T12:06:00.000Z").getTime(),
  invokeRoute: async () => {
    staleInvoked = true;
    return { text: "should not run" };
  },
});
assert.equal(delayedExecution.status, "BLOCKED");
assert.equal(delayedExecution.fail_closed_reason, "eligible_attempts_exhausted");
assert.equal(delayedExecution.attempts[0].status, "BLOCKED");
assert.equal(delayedExecution.attempts[0].error, "route_evidence_stale");
assert.equal(staleInvoked, false, "Expired route evidence must be rechecked before invocation");

let invalidPlanInvoked = false;
const tamperedPlan = {
  ...twoAttemptPlan,
  planned_chain: [
    ...twoAttemptPlan.planned_chain,
    localRoute({ route_id: "local:fourth" }),
    localRoute({ route_id: "local:fifth" }),
  ],
  compute_budget: { ...twoAttemptPlan.compute_budget, max_attempts: 4 },
};
const tamperedExecution = await executeRoutingPlan(tamperedPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => {
    invalidPlanInvoked = true;
    return { text: "must not run" };
  },
});
assert.equal(tamperedExecution.status, "BLOCKED");
assert.equal(tamperedExecution.fail_closed_reason, "invalid_routing_receipt");
assert.equal(tamperedExecution.attempts.length, 0);
assert.equal(invalidPlanInvoked, false);

const excessivePolicyPlan = planRouting(baseRequest(), {
  now,
  surface_id: "desktop",
  context,
  policy: { max_provider_attempts: 4 },
  route_evidence: [
    localRoute({ route_id: "local:p1", priority: 4 }),
    localRoute({ route_id: "local:p2", priority: 3 }),
    localRoute({ route_id: "local:p3", priority: 2 }),
    localRoute({ route_id: "local:p4", priority: 1 }),
  ],
});
assert.equal(excessivePolicyPlan.planned_chain.length, 2, "Policy input must not raise the hard attempt ceiling");
assert.equal(buildRoutingReceipt(excessivePolicyPlan).receipt_sha256, excessivePolicyPlan.routing_receipt.receipt_sha256);

const malformedResultExecution = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => ({ usage: { input_tokens: 1 } }),
});
assert.equal(malformedResultExecution.status, "BLOCKED");
assert.equal(malformedResultExecution.attempts[0].status, "BLOCKED");
assert.equal(malformedResultExecution.attempts[0].error, "response_payload_missing");

console.log("[PASS] Capability-first routing policy tests passed.");
console.log("ROUTING_POLICY_TESTS_OK");
