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
    capabilities: ["chat", "utility", "code_review", "code_synthesis", "extract"],
    task_classes: ["chat", "utility", "code_review", "code_synthesis", "extraction"],
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

const chatPlan = planRouting(baseRequest({
  task_class: "chat",
  requested_model: "gemma3:4b",
  response_contract: "text.v1",
  request: "hello",
}), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [localRoute({
    route_id: "openai_compat:gemma3:4b",
    model_id: "gemma3:4b",
  })],
});
assert.equal(chatPlan.selected_tier, "T2");
assert.equal(chatPlan.selected_model_or_route, "openai_compat:gemma3:4b");
assert.equal(chatPlan.fail_closed_reason, null);

const utilityPlan = planRouting(baseRequest({
  task_class: "utility",
  effort_hint: "low",
  requested_model: "gemma3:4b",
  response_contract: "text.v1",
  request: "summarize this",
}), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [localRoute({
    route_id: "openai_compat:gemma3:4b",
    model_id: "gemma3:4b",
  })],
});
assert.equal(utilityPlan.selected_tier, "T1");
assert.equal(utilityPlan.selected_model_or_route, "openai_compat:gemma3:4b");
assert.equal(utilityPlan.fail_closed_reason, null);

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

const unknownAdapterCannotClaimPrivate = planRouting(baseRequest({
  trust_zone: "private_self",
  sensitivity: "internal",
}), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [localRoute({
    route_id: "corp-proxy:private-claim",
    adapter: "corp_proxy",
    provider_boundary: "private_self",
  })],
});
assert.equal(unknownAdapterCannotClaimPrivate.fail_closed_reason, "no_eligible_route");
assert.equal(
  unknownAdapterCannotClaimPrivate.rejected_routes[0].reasons.includes("boundary_not_allowed"),
  true,
  "Unknown adapters must not self-declare private_self boundaries"
);

const conflictingAdapterProviderBlocked = planRouting(baseRequest({
  trust_zone: "private_self",
  sensitivity: "internal",
}), {
  now,
  surface_id: "desktop",
  context,
  route_evidence: [localRoute({
    route_id: "conflict:adapter-provider",
    adapter: "ollama",
    provider: "openai",
    provider_boundary: "private_self",
  })],
});
assert.equal(conflictingAdapterProviderBlocked.fail_closed_reason, "no_eligible_route");
assert.equal(
  conflictingAdapterProviderBlocked.rejected_routes[0].reasons.includes("boundary_not_allowed"),
  true,
  "Conflicting adapter/provider identity fields must not be eligible"
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

const t2CannotBecomeT0 = planRouting(baseRequest(), {
  now,
  surface_id: "desktop",
  context,
  deterministic_handlers: [{ task_class: "code_review", trust_zone: "trusted_collaborator", response_contract: "review.v1", route_id: "deterministic:review" }],
});
assert.equal(t2CannotBecomeT0.selected_tier, "BLOCKED");
assert.equal(t2CannotBecomeT0.fail_closed_reason, "no_eligible_route", "T2 requests must not downshift to T0 deterministic handlers");

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
assert.equal(Object.isFrozen(twoAttemptPlan), true, "Sealed routing plan root must be immutable");
assert.equal(Object.isFrozen(twoAttemptPlan.planned_chain[0]), true, "Sealed routing plan routes must be immutable");
assert.equal(Object.isFrozen(twoAttemptPlan.routing_receipt), true, "Sealed routing plan receipt must be immutable");
assert.throws(() => {
  Object.assign(twoAttemptPlan.planned_chain[0], {
    adapter: "openai",
    model_id: "gpt-5.5",
    provider_boundary: "trusted_collaborator",
  });
}, TypeError, "Authorized plan routes must not remain mutable under a frozen root");
assert.equal(twoAttemptPlan.planned_chain[0].adapter, "ollama");
assert.equal(twoAttemptPlan.planned_chain[0].provider_boundary, "private_self");

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

for (const usage of [
  {},
  { total_tokens: 100 },
  { input_tokens: 12 },
  { input_tokens: 12, output_tokens: 4, cached_tokens: 13 },
  { input_tokens: "", output_tokens: 4 },
  { input_tokens: false, output_tokens: 4 },
  { input_tokens: 1.5, output_tokens: 4 },
  // Malformed authoritative aliases fail closed instead of falling back.
  { input_tokens: false, prompt_tokens: 1000, output_tokens: 4 },
  { input_tokens: "", prompt_tokens: 1000, output_tokens: 4 },
  // Cached token null fallthrough: explicit null in one alias must not fall through to another
  { input_tokens: 10, output_tokens: 5, prompt_tokens_details: { cached_tokens: null }, cached_tokens: 0 },
  { input_tokens: 10, output_tokens: 5, cached_tokens: null, prompt_cache_hit_tokens: 0 },
]) {
  const incompleteUsageExecution = await executeRoutingPlan(twoAttemptPlan, {
    now: () => now.getTime(),
    invokeRoute: async ({ route }) => ({
      text: "ok",
      sent_model: route.model_id,
      reported_model: route.model_id,
      usage,
    }),
  });
  assert.equal(incompleteUsageExecution.status, "SUCCEEDED");
  assert.equal(incompleteUsageExecution.attempts[0].usage_known, false, `Usage ${JSON.stringify(usage)} must remain unknown`);
  assert.equal(incompleteUsageExecution.routing_deltas.actual_cost_usd, null, `Usage ${JSON.stringify(usage)} must not fabricate a cost`);
}

// Authoritative aliases: input_tokens/output_tokens win when present.
const authoritativeAliasExecution = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => ({
    text: "ok",
    usage: { input_tokens: 0, prompt_tokens: 1000, output_tokens: 4, completion_tokens: 8 },
  }),
});
assert.equal(authoritativeAliasExecution.attempts[0].usage_known, true, "Authoritative aliases must yield known usage");
assert.equal(authoritativeAliasExecution.attempts[0].usage.input_tokens, 0);
assert.equal(authoritativeAliasExecution.attempts[0].usage.output_tokens, 4);
assert.equal(authoritativeAliasExecution.routing_deltas.actual_cost_usd, 0.000032);

const exhaustedNoUsageExecution = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => {
    throw new Error("provider failed before usage metadata");
  },
  permitFallback: () => true,
});
assert.equal(exhaustedNoUsageExecution.status, "BLOCKED");
assert.equal(exhaustedNoUsageExecution.provider_invoked, true);
assert.equal(exhaustedNoUsageExecution.routing_deltas.actual_cost_usd, null, "Exhausted invoked attempts without usage must not fabricate zero cost");
assert.equal(exhaustedNoUsageExecution.routing_deltas.cost_delta_usd, null);

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
assert.equal(tamperedExecution.fail_closed_reason, "invalid_plan_authority");
assert.equal(tamperedExecution.attempts.length, 0);
assert.equal(invalidPlanInvoked, false);

let forgedPlanInvoked = false;
const forgedPlan = {
  ...twoAttemptPlan,
  planned_chain: [cloudRoute({
    route_id: "forged:private-openai",
    adapter: "openai_compat",
    provider_boundary: "private_self",
    trust_zones: ["private_self"],
    sensitivity_classes: ["internal", "public"],
  })],
  selected_model_or_route: "forged:private-openai",
  compute_budget: { ...twoAttemptPlan.compute_budget, max_attempts: 1 },
};
forgedPlan.routing_receipt = buildRoutingReceipt(forgedPlan);
const forgedExecution = await executeRoutingPlan(forgedPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => {
    forgedPlanInvoked = true;
    return { text: "must not run" };
  },
});
assert.equal(forgedExecution.status, "BLOCKED");
assert.equal(forgedExecution.fail_closed_reason, "invalid_plan_authority");
assert.equal(forgedPlanInvoked, false, "A recomputed public receipt must not grant execution authority");

let inheritedAuthorityInvoked = false;
const inheritedAuthorityPlan = Object.create(twoAttemptPlan);
Object.defineProperties(inheritedAuthorityPlan, {
  selected_tier: { value: "T0", enumerable: true, configurable: true },
  selected_model_or_route: { value: "deterministic:forged", enumerable: true, configurable: true },
  planned_chain: { value: [], enumerable: true, configurable: true },
  fallback_chain: { value: [], enumerable: true, configurable: true },
});
Object.defineProperty(inheritedAuthorityPlan, "routing_receipt", {
  value: buildRoutingReceipt(inheritedAuthorityPlan),
  enumerable: true,
  configurable: true,
});
const inheritedAuthorityExecution = await executeRoutingPlan(inheritedAuthorityPlan, {
  now: () => now.getTime(),
  deterministicHandlers: {
    "deterministic:forged": () => {
      inheritedAuthorityInvoked = true;
      return { text: "must not run" };
    },
  },
});
assert.equal(inheritedAuthorityExecution.status, "BLOCKED");
assert.equal(inheritedAuthorityExecution.fail_closed_reason, "invalid_plan_authority");
assert.equal(inheritedAuthorityInvoked, false, "Inherited routing authority must not grant execution");

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

const emptyTextExecution = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => ({ text: "" }),
});
assert.equal(emptyTextExecution.status, "BLOCKED");
assert.equal(emptyTextExecution.attempts[0].error, "response_payload_missing");

const nullPayloadExecution = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => ({ payload: null }),
});
assert.equal(nullPayloadExecution.status, "BLOCKED");
assert.equal(nullPayloadExecution.attempts[0].error, "response_payload_missing");

const emptyPayloadCases = ["", [], {}, false, 0];
for (const payload of emptyPayloadCases) {
  const payloadExecution = await executeRoutingPlan(twoAttemptPlan, {
    now: () => now.getTime(),
    invokeRoute: async () => ({ payload }),
  });
  assert.equal(payloadExecution.status, "BLOCKED", `Empty payload ${JSON.stringify(payload)} must fail closed`);
  assert.equal(payloadExecution.attempts[0].error, "response_payload_missing");
}

const nestedEmptyPayloadCases = [
  [null],
  { text: "" },
  { choices: [] },
  { content: [{ type: "text", text: "" }] },
  { message: { role: "assistant", content: "" } },
  { choices: [], response_metadata: { model: "local:first", finish_reason: "stop" } },
];
for (const payload of nestedEmptyPayloadCases) {
  const payloadExecution = await executeRoutingPlan(twoAttemptPlan, {
    now: () => now.getTime(),
    invokeRoute: async () => ({ payload }),
  });
  assert.equal(payloadExecution.status, "BLOCKED", `Nested empty payload ${JSON.stringify(payload)} must fail closed`);
  assert.equal(payloadExecution.attempts[0].error, "response_payload_missing");
}

const nestedMeaningfulPayload = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => ({ payload: { choices: [{ text: "review complete" }] } }),
});
assert.equal(nestedMeaningfulPayload.status, "SUCCEEDED", "Structured payloads with meaningful nested text remain valid");

const malformedTotalUsageCases = [null, false, "", 1.5, [], {}, 10];
for (const badTotal of malformedTotalUsageCases) {
  const res = await executeRoutingPlan(twoAttemptPlan, {
    now: () => now.getTime(),
    invokeRoute: async () => ({
      text: "ok",
      usage: { input_tokens: 12, output_tokens: 4, total_tokens: badTotal },
    }),
  });
  assert.equal(res.status, "SUCCEEDED");
  assert.equal(res.attempts[0].usage_known, false, `Total ${JSON.stringify(badTotal)} must not yield known usage`);
  assert.equal(res.routing_deltas.actual_cost_usd, null, `Total ${JSON.stringify(badTotal)} must not yield calculated cost`);

  const resGemini = await executeRoutingPlan(twoAttemptPlan, {
    now: () => now.getTime(),
    invokeRoute: async () => ({
      text: "ok",
      usage: { input_tokens: 12, output_tokens: 4, totalTokenCount: badTotal },
    }),
  });
  assert.equal(resGemini.status, "SUCCEEDED");
  assert.equal(resGemini.attempts[0].usage_known, false, `TotalTokenCount ${JSON.stringify(badTotal)} must not yield known usage`);
  assert.equal(resGemini.routing_deltas.actual_cost_usd, null, `TotalTokenCount ${JSON.stringify(badTotal)} must not yield calculated cost`);
}

const safeIntegerSumOverflow = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => ({
    text: "ok",
    usage: { input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: 2 },
  }),
});
assert.equal(safeIntegerSumOverflow.attempts[0].usage_known, false, "MAX_SAFE_INTEGER + 2 sum overflow must not yield known usage");
assert.equal(safeIntegerSumOverflow.routing_deltas.actual_cost_usd, null);

const authoritativeInputAlias = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => ({
    text: "ok",
    usage: { input_tokens: 0, prompt_tokens: "1e308", output_tokens: 4 },
  }),
});
assert.equal(authoritativeInputAlias.attempts[0].usage_known, true, "input_tokens remains authoritative over malformed prompt_tokens");
assert.equal(authoritativeInputAlias.attempts[0].usage.input_tokens, 0);
assert.equal(authoritativeInputAlias.routing_deltas.actual_cost_usd, 0.000032);

const overflowUsage = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => ({
    text: "ok",
    usage: { input_tokens: "1e308", output_tokens: "4" },
  }),
});
assert.equal(overflowUsage.attempts[0].usage_known, false, "Overflowing usage string must not yield known usage");
assert.equal(overflowUsage.routing_deltas.actual_cost_usd, null, "Overflowing usage string must not yield calculated cost");

const validTotalUsage = await executeRoutingPlan(twoAttemptPlan, {
  now: () => now.getTime(),
  invokeRoute: async () => ({
    text: "ok",
    usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
  }),
});
assert.equal(validTotalUsage.attempts[0].usage_known, true);
assert.notEqual(validTotalUsage.routing_deltas.actual_cost_usd, null);

console.log("[PASS] Capability-first routing policy tests passed.");
console.log("ROUTING_POLICY_TESTS_OK");
