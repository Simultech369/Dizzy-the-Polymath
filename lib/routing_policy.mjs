import crypto from "node:crypto";

export const ROUTING_POLICY_SCHEMA = "dizzy.capability_routing_policy.v1";
export const ROUTING_PLAN_SCHEMA = "dizzy.capability_routing_plan.v1";
export const ROUTING_EXECUTION_SCHEMA = "dizzy.capability_routing_execution.v1";
export const ROUTING_DELTA_RECEIPT_SCHEMA = "dizzy.routing_delta_receipt.v1";

export const TIER_ORDER = Object.freeze(["T0", "T1", "T2", "T3"]);
export const EFFORT_TO_TIER = Object.freeze({
  none: "T0",
  low: "T1",
  standard: "T2",
  medium: "T2",
  high: "T3",
});

export const TIER_ESTIMATED_COST_PER_1K = Object.freeze({
  T0: 0.0,
  T1: 0.0002, // ~$0.20 per 1M tokens (local / flash tier)
  T2: 0.003,  // ~$3.00 per 1M tokens (standard models)
  T3: 0.015,  // ~$15.00 per 1M tokens (frontier reasoning models)
});

export const TIER_INPUT_COST_PER_1K = Object.freeze({
  T0: 0.0,
  T1: 0.00015, // $0.15 / 1M tokens
  T2: 0.0020,  // $2.00 / 1M tokens
  T3: 0.0050,  // $5.00 / 1M tokens
});

export const TIER_OUTPUT_COST_PER_1K = Object.freeze({
  T0: 0.0,
  T1: 0.0006,  // $0.60 / 1M tokens
  T2: 0.0080,  // $8.00 / 1M tokens
  T3: 0.0250,  // $25.00 / 1M tokens (frontier reasoning)
});

export const TIER_BASELINE_LATENCY_MS = Object.freeze({
  T0: 10,   // deterministic in-process handler
  T1: 250,  // local / flash fast tier
  T2: 1200, // standard model tier
  T3: 4500, // frontier reasoning tier
});

export function calculateAsymmetricCostUsd({ tier = "T2", inputTokens = 0, outputTokens = 0 } = {}) {
  const inRate = TIER_INPUT_COST_PER_1K[tier] ?? 0.0020;
  const outRate = TIER_OUTPUT_COST_PER_1K[tier] ?? 0.0080;
  const cost = (Math.max(0, Number(inputTokens) || 0) / 1000) * inRate +
               (Math.max(0, Number(outputTokens) || 0) / 1000) * outRate;
  return Number(cost.toFixed(6));
}

export const EASY_TASK_CLASSES = Object.freeze(new Set([
  "deterministic_status",
  "extraction",
  "utility",
  "chat",
]));

export const THINKING_BUDGET_BY_EFFORT = Object.freeze({
  none: 0,
  low: 1024,
  standard: 4096,
  medium: 4096,
  high: 16384,
});

export const DEFAULT_ROUTING_POLICY = Object.freeze({
  schema: ROUTING_POLICY_SCHEMA,
  version: "routing_policy.v1",
  max_provider_attempts: 2,
  cache: {
    mode: "exact_only",
    require_all_bindings: true,
  },
  task_classes: {
    deterministic_status: {
      minimum_tier: "T0",
      maximum_tier: "T0",
      minimum_effort: "none",
      maximum_effort: "none",
      required_capabilities: ["deterministic_handler"],
      response_contract: "status.v1",
      cache_allowed: false,
      allow_cloud: false,
      require_authorization_for_t3: false,
    },
    extraction: {
      minimum_tier: "T1",
      maximum_tier: "T2",
      minimum_effort: "low",
      maximum_effort: "standard",
      required_capabilities: ["extract"],
      response_contract: "text.v1",
      cache_allowed: true,
      allow_cloud: true,
      require_authorization_for_t3: false,
    },
    chat: {
      minimum_tier: "T1",
      maximum_tier: "T2",
      minimum_effort: "low",
      maximum_effort: "standard",
      required_capabilities: ["chat"],
      response_contract: "text.v1",
      cache_allowed: false,
      allow_cloud: true,
      require_authorization_for_t3: false,
    },
    utility: {
      minimum_tier: "T1",
      maximum_tier: "T2",
      minimum_effort: "low",
      maximum_effort: "standard",
      required_capabilities: ["utility"],
      response_contract: "text.v1",
      cache_allowed: false,
      allow_cloud: true,
      require_authorization_for_t3: false,
    },
    code_review: {
      minimum_tier: "T2",
      maximum_tier: "T3",
      minimum_effort: "standard",
      maximum_effort: "high",
      required_capabilities: ["code_review"],
      response_contract: "review.v1",
      cache_allowed: true,
      allow_cloud: true,
      require_authorization_for_t3: true,
    },
    code_synthesis: {
      minimum_tier: "T2",
      maximum_tier: "T3",
      minimum_effort: "standard",
      maximum_effort: "high",
      required_capabilities: ["code_synthesis"],
      response_contract: "patch_candidate.v1",
      cache_allowed: false,
      allow_cloud: false,
      require_authorization_for_t3: true,
    },
    security_review: {
      minimum_tier: "T2",
      maximum_tier: "T3",
      minimum_effort: "standard",
      maximum_effort: "high",
      required_capabilities: ["security_review"],
      response_contract: "finding_review.v1",
      cache_allowed: false,
      allow_cloud: false,
      require_authorization_for_t3: true,
    },
  },
});

const HARD_MAX_PROVIDER_ATTEMPTS = 2;
const LOCAL_BOUNDARIES = new Set(["private_self", "local_machine", "private_lan", "internal_only"]);
const CLOUD_ADAPTERS = new Set(["openai", "openai_compat", "openrouter", "gemini", "anthropic", "groq"]);
const LOCAL_ADAPTERS = new Set(["ollama", "deterministic", "local", "node_local"]);
const ROUTING_PLAN_AUTHORITY = Symbol("dizzy.routing.plan.authority");
const AUTHORIZED_ROUTING_PLANS = new WeakSet();

function stableJson(value) {
  if (Array.isArray(value)) {
    if (value.length !== Object.keys(value).length) {
      throw new Error("sparse arrays cannot be canonicalized");
    }
    return "[" + value.map((item) => stableJson(item)).join(",") + "]";
  }
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }
  if (value === undefined) throw new Error("undefined cannot be canonicalized");
  return JSON.stringify(value);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function hashCanonical(value) {
  return sha256Hex(stableJson(value));
}

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeToken(item)).filter(Boolean))];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneForPlan(value) {
  if (Array.isArray(value)) return value.map((item) => cloneForPlan(item));
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = cloneForPlan(value[key]);
    }
    return out;
  }
  return value;
}

function deepFreeze(value) {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return value;
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    const child = value[key];
    if (child && (typeof child === "object" || typeof child === "function") && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

function tierIndex(tier) {
  const idx = TIER_ORDER.indexOf(String(tier || "").trim().toUpperCase());
  return idx >= 0 ? idx : -1;
}

function clampTier(tier, minTier, maxTier) {
  const wanted = tierIndex(tier);
  const min = tierIndex(minTier);
  const max = tierIndex(maxTier);
  if (wanted < 0 || min < 0 || max < 0 || min > max) {
    return { ok: false, reason: "invalid_tier_policy" };
  }
  if (wanted < min) return { ok: true, tier: TIER_ORDER[min], adjusted: "raised_to_minimum_tier" };
  if (wanted > max) return { ok: true, tier: TIER_ORDER[max], adjusted: "lowered_to_maximum_tier" };
  return { ok: true, tier: TIER_ORDER[wanted], adjusted: null };
}

function t3AuthorizationRequired(rule) {
  return tierIndex(rule.minimum_tier) >= tierIndex("T3")
    || tierIndex(rule.maximum_tier) >= tierIndex("T3")
    || rule.require_authorization_for_t3 === true;
}

function mergeTaskRule(defaultRule, incomingRule) {
  const base = isPlainObject(defaultRule) ? defaultRule : {};
  const incoming = isPlainObject(incomingRule) ? incomingRule : {};
  const merged = { ...base, ...incoming };
  if (Array.isArray(base.required_capabilities) || Array.isArray(incoming.required_capabilities)) {
    merged.required_capabilities = Array.isArray(incoming.required_capabilities)
      ? incoming.required_capabilities
      : base.required_capabilities;
  }
  if (base.require_authorization_for_t3 === true || t3AuthorizationRequired(merged)) {
    merged.require_authorization_for_t3 = true;
  }
  return merged;
}

function policyWithDefaults(policy = {}) {
  const incoming = isPlainObject(policy) ? policy : {};
  const taskClasses = {};
  for (const [taskClass, defaultRule] of Object.entries(DEFAULT_ROUTING_POLICY.task_classes)) {
    taskClasses[taskClass] = mergeTaskRule(defaultRule, incoming.task_classes?.[taskClass]);
  }
  if (isPlainObject(incoming.task_classes)) {
    for (const [taskClass, rule] of Object.entries(incoming.task_classes)) {
      if (!taskClasses[taskClass]) taskClasses[taskClass] = mergeTaskRule({}, rule);
    }
  }
  return {
    ...DEFAULT_ROUTING_POLICY,
    ...incoming,
    cache: { ...DEFAULT_ROUTING_POLICY.cache, ...(incoming.cache || {}) },
    max_provider_attempts: Math.max(1, Math.min(
      HARD_MAX_PROVIDER_ATTEMPTS,
      Number(incoming.max_provider_attempts || DEFAULT_ROUTING_POLICY.max_provider_attempts)
    )),
    task_classes: taskClasses,
  };
}

function taskRuleFor(policy, taskClass) {
  return policy.task_classes[taskClass] || null;
}

function parsePositiveInt(value, name, violations, { allowZero = false } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1)) {
    violations.push(`${name}_invalid`);
    return null;
  }
  return n;
}

export function resolveRequirements(input = {}, env = {}) {
  const policy = policyWithDefaults(env.policy);
  const violations = [];
  if (!isPlainObject(input)) {
    return { ok: false, reason: "malformed_request", violations: ["request_must_be_object"] };
  }

  const taskClass = normalizeToken(input.task_class);
  const trustZone = normalizeToken(input.trust_zone);
  const sensitivity = normalizeToken(input.sensitivity);
  const effortHint = normalizeToken(input.effort_hint || "standard");
  const surfaceId = normalizeToken(input.surface_id || env.surface_id || "default");
  const requestedModel = String(input.requested_model || input.requested_route || "").trim();

  if (!taskClass) violations.push("task_class_required");
  if (!trustZone) violations.push("trust_zone_required");
  if (!sensitivity) violations.push("sensitivity_required");
  const rule = taskClass ? taskRuleFor(policy, taskClass) : null;
  if (taskClass && !rule) violations.push("unknown_task_class");

  const budgetBytes = parsePositiveInt(input.budget_bytes, "budget_bytes", violations);
  const budgetTokens = parsePositiveInt(input.budget_tokens ?? input.compute_tokens ?? 1, "budget_tokens", violations, { allowZero: true });
  const maxCostUsd = input.max_cost_usd !== undefined && input.max_cost_usd !== null
    ? Number(input.max_cost_usd)
    : null;
  if (maxCostUsd !== null && (!Number.isFinite(maxCostUsd) || maxCostUsd < 0)) {
    violations.push("max_cost_usd_invalid");
  }
  if (violations.length) {
    return { ok: false, reason: violations[0], violations };
  }

  const requestedTier = EFFORT_TO_TIER[effortHint] || EFFORT_TO_TIER[rule.minimum_effort] || rule.minimum_tier;
  const clamped = clampTier(requestedTier, rule.minimum_tier, rule.maximum_tier);
  if (!clamped.ok) return { ok: false, reason: clamped.reason, violations: [clamped.reason] };

  const selectedEffort = clamped.tier === "T0" ? "none" : clamped.tier === "T1" ? "low" : clamped.tier === "T2" ? "standard" : "high";
  if (clamped.tier === "T3" && rule.require_authorization_for_t3 && env.t3_authorized !== true) {
    return { ok: false, reason: "t3_authorization_required", violations: ["t3_authorization_required"] };
  }

  let reasoningClamped = false;
  let maxThinkingTokens = THINKING_BUDGET_BY_EFFORT[selectedEffort] ?? 4096;
  if (EASY_TASK_CLASSES.has(taskClass)) {
    if (effortHint === "high" || effortHint === "medium") {
      reasoningClamped = true;
      maxThinkingTokens = taskClass === "deterministic_status" ? 0 : 1024;
    } else if (taskClass === "deterministic_status") {
      maxThinkingTokens = 0;
    }
  }

  const estimatedCostPer1k = TIER_ESTIMATED_COST_PER_1K[clamped.tier] ?? 0;
  const estimatedCostUsd = Number(((budgetTokens / 1000) * estimatedCostPer1k).toFixed(6));
  const asymmetricEstimatedCostUsd = calculateAsymmetricCostUsd({
    tier: clamped.tier,
    inputTokens: Math.max(0, budgetTokens - maxThinkingTokens),
    outputTokens: maxThinkingTokens,
  });

  if (maxCostUsd !== null && estimatedCostUsd > maxCostUsd) {
    return {
      ok: false,
      reason: "cost_budget_exceeded",
      violations: [`cost_budget_exceeded: estimated $${estimatedCostUsd} > max $${maxCostUsd}`],
      estimated_cost_usd: estimatedCostUsd,
      asymmetric_estimated_cost_usd: asymmetricEstimatedCostUsd,
      max_cost_usd: maxCostUsd,
    };
  }

  return {
    ok: true,
    policy,
    policy_sha256: hashCanonical(policy),
    task_class: taskClass,
    trust_zone: trustZone,
    sensitivity,
    effort_hint: effortHint,
    selected_effort: selectedEffort,
    selected_tier: clamped.tier,
    effort_adjustment: clamped.adjusted,
    budget_bytes: budgetBytes,
    budget_tokens: budgetTokens,
    estimated_cost_usd: estimatedCostUsd,
    asymmetric_estimated_cost_usd: asymmetricEstimatedCostUsd,
    max_cost_usd: maxCostUsd,
    reasoning_clamped: reasoningClamped,
    max_thinking_tokens: maxThinkingTokens,
    surface_id: surfaceId,
    requested_model: requestedModel || null,
    response_contract: input.response_contract || rule.response_contract,
    rule,
    request_sha256: hashCanonical({
      task_class: taskClass,
      trust_zone: trustZone,
      sensitivity,
      effort_hint: effortHint,
      budget_bytes: budgetBytes,
      budget_tokens: budgetTokens,
      surface_id: surfaceId,
      requested_model: requestedModel || null,
      response_contract: input.response_contract || rule.response_contract,
      request: input.request ?? input.prompt ?? input.text ?? null,
    }),
  };
}

function requiredCacheBindings(requirements, context = {}) {
  return {
    schema: "dizzy.exact_response_cache.v2",
    trust_zone: requirements.trust_zone,
    sensitivity: requirements.sensitivity,
    task_class: requirements.task_class,
    prompt_pack_version: context.prompt_pack_version,
    full_prompt_sha256: context.full_prompt_sha256,
    exact_request_sha256: requirements.request_sha256,
    context_sha256: context.context_sha256,
    sources_sha256: context.sources_sha256,
    policy_sha256: requirements.policy_sha256,
    authorization_scope_sha256: context.authorization_scope_sha256,
    client_service_conversation_partition: context.client_service_conversation_partition,
    response_contract_sha256: context.response_contract_sha256 || sha256Hex(requirements.response_contract),
  };
}

export function buildExactCacheEligibility(requirements, context = {}) {
  if (!requirements?.ok) {
    return { eligible: false, reason: "invalid_requirements", missing_bindings: [] };
  }
  if (requirements.rule.cache_allowed !== true) {
    return { eligible: false, reason: "task_cache_disabled", missing_bindings: [] };
  }
  const bindings = requiredCacheBindings(requirements, context);
  const missing = Object.entries(bindings)
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === "")
    .map(([key]) => key);
  if (missing.length) {
    return { eligible: false, reason: "missing_cache_bindings", missing_bindings: missing };
  }
  return {
    eligible: true,
    mode: "exact_only",
    key: hashCanonical(bindings),
    bindings,
  };
}

function routeBoundaryAllowed(route, requirements) {
  if (!isPlainObject(route)) return false;
  const adapter = normalizeToken(route.adapter || route.provider || "");
  const provider = normalizeToken(route.provider || "");
  const boundary = normalizeToken(route.provider_boundary || route.data_boundary || route.boundary || "");
  const knownAdapter = CLOUD_ADAPTERS.has(adapter) || LOCAL_ADAPTERS.has(adapter);
  if (!knownAdapter) return false;
  if (provider && provider !== adapter) return false;
  if (!boundary) return false;
  if (CLOUD_ADAPTERS.has(adapter) && LOCAL_BOUNDARIES.has(boundary)) return false;
  if (LOCAL_ADAPTERS.has(adapter) && !LOCAL_BOUNDARIES.has(boundary) && requirements.trust_zone === "private_self") return false;
  if (requirements.trust_zone === "private_self") {
    return LOCAL_BOUNDARIES.has(boundary);
  }
  if (requirements.rule.allow_cloud === false) {
    return LOCAL_BOUNDARIES.has(boundary);
  }
  return true;
}

function evidenceFresh(route, nowMs) {
  if (!isPlainObject(route)) return { ok: false, reason: "malformed_route_evidence" };
  if (route.callable !== true) return { ok: false, reason: "route_not_callable" };
  const expiresAt = route.evidence_expires_at || route.fresh_until || route.probed_expires_at;
  if (!expiresAt) return { ok: false, reason: "route_evidence_missing_expiry" };
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) return { ok: false, reason: "route_evidence_bad_expiry" };
  if (expiryMs <= nowMs) return { ok: false, reason: "route_evidence_stale" };
  return { ok: true };
}

function routeSatisfiesRequirements(route, requirements, nowMs) {
  const reasons = [];
  if (!isPlainObject(route)) {
    return { ok: false, reasons: ["malformed_route_evidence"] };
  }
  if (!String(route.route_id || route.model_id || "").trim()) reasons.push("route_id_required");
  if (!String(route.adapter || route.provider || "").trim()) reasons.push("adapter_required");
  if (!String(route.provider_boundary || route.data_boundary || route.boundary || "").trim()) reasons.push("provider_boundary_required");
  const freshness = evidenceFresh(route, nowMs);
  if (!freshness.ok) reasons.push(freshness.reason);
  if (route.surface_id && normalizeToken(route.surface_id) !== requirements.surface_id) reasons.push("surface_mismatch");
  if (requirements.requested_model) {
    const model = String(route.model_id || route.model || route.route_id || "").trim();
    const routeId = String(route.route_id || "").trim();
    if (model !== requirements.requested_model && routeId !== requirements.requested_model) reasons.push("requested_model_unavailable");
  }
  const capabilities = normalizeList(route.capabilities || route.supported_capabilities || route.task_capabilities);
  if (!capabilities.length) reasons.push("capabilities_required");
  for (const capability of requirements.rule.required_capabilities || []) {
    if (!capabilities.includes(normalizeToken(capability))) reasons.push(`missing_capability:${capability}`);
  }
  const taskClasses = normalizeList(route.task_classes || route.supported_task_classes);
  if (!taskClasses.length) reasons.push("task_classes_required");
  if (taskClasses.length && !taskClasses.includes(requirements.task_class)) reasons.push("task_class_not_supported");
  const trustZones = normalizeList(route.trust_zones || route.allowed_trust_zones);
  if (!trustZones.length) reasons.push("trust_zones_required");
  if (trustZones.length && !trustZones.includes(requirements.trust_zone)) reasons.push("trust_zone_not_supported");
  const sensitivityClasses = normalizeList(route.sensitivity_classes || route.allowed_sensitivity);
  if (!sensitivityClasses.length) reasons.push("sensitivity_classes_required");
  if (sensitivityClasses.length && !sensitivityClasses.includes(requirements.sensitivity)) reasons.push("sensitivity_not_supported");
  const tiers = normalizeList(route.tiers || route.supported_tiers).map((tier) => tier.toUpperCase());
  if (!tiers.length) reasons.push("tiers_required");
  if (tiers.length && !tiers.includes(requirements.selected_tier)) reasons.push("tier_not_supported");
  const efforts = normalizeList(route.efforts || route.supported_efforts);
  if (!efforts.length) reasons.push("efforts_required");
  if (efforts.length && !efforts.includes(requirements.selected_effort)) reasons.push("effort_not_supported");
  if (route.enforceable_limits !== true && requirements.budget_tokens > 0) reasons.push("limits_not_enforceable");
  if (!routeBoundaryAllowed(route, requirements)) reasons.push("boundary_not_allowed");
  return { ok: reasons.length === 0, reasons };
}

function routeRank(route, requirements) {
  const boundary = normalizeToken(route.provider_boundary || route.data_boundary || route.boundary || "");
  const localScore = LOCAL_BOUNDARIES.has(boundary) ? 100 : 0;
  const tierScore = tierIndex(requirements.selected_tier) * 10;
  const priority = Number.isFinite(Number(route.priority)) ? Number(route.priority) : 0;
  return localScore + tierScore + priority;
}

export function buildRoutingReceipt(plan) {
  const body = {
    schema: ROUTING_PLAN_SCHEMA,
    created_at: plan.created_at,
    surface_id: plan.surface_id,
    task_class: plan.task_class,
    trust_zone: plan.trust_zone,
    sensitivity: plan.sensitivity,
    requested_model: plan.requested_model,
    selected_tier: plan.selected_tier,
    selected_model_or_route: plan.selected_model_or_route,
    fallback_chain: plan.fallback_chain,
    cache_eligibility: plan.cache_eligibility?.eligible ? {
      eligible: true,
      key: plan.cache_eligibility.key,
    } : {
      eligible: false,
      reason: plan.cache_eligibility?.reason || "none",
    },
    downgrade_reason: plan.downgrade_reason,
    fail_closed_reason: plan.fail_closed_reason,
    policy_sha256: plan.policy_sha256,
    request_sha256: plan.request_sha256,
    context_sha256: plan.context?.context_sha256 || null,
    route_evidence_sha256: plan.route_evidence_sha256,
    planned_chain: (plan.planned_chain || []).map((route) => ({
      route_id: route.route_id || null,
      model_id: route.model_id || null,
      adapter: route.adapter || null,
      callable: route.callable === true,
      evidence_expires_at: route.evidence_expires_at || null,
      surface_id: route.surface_id || null,
      provider_boundary: route.provider_boundary || null,
      tier: route.tier || null,
      effort: route.effort || null,
      max_thinking_tokens: route.max_thinking_tokens ?? null,
      selection: route.selection || null,
    })),
    compute_budget: plan.compute_budget || null,
    rejected_route_count: Array.isArray(plan.rejected_routes) ? plan.rejected_routes.length : 0,
    estimated_cost_usd: plan.estimated_cost_usd ?? null,
    max_cost_usd: plan.max_cost_usd ?? null,
    reasoning_clamped: plan.reasoning_clamped === true,
    max_thinking_tokens: plan.max_thinking_tokens ?? null,
    selection: plan.selection || null,
  };
  return {
    ...body,
    receipt_sha256: hashCanonical(body),
  };
}

function routingReceiptMatches(plan) {
  if (!isPlainObject(plan?.routing_receipt) || !plan.routing_receipt.receipt_sha256) return false;
  try {
    return buildRoutingReceipt(plan).receipt_sha256 === plan.routing_receipt.receipt_sha256;
  } catch {
    return false;
  }
}

function validateRouteResult(result, route) {
  const violations = [];
  if (!isPlainObject(result)) {
    violations.push("malformed_route_result");
    return violations;
  }
  const hasText = typeof result.text === "string" && result.text.trim().length > 0;
  const hasPayload = payloadIsMeaningful(result.payload);
  if (!hasText && !hasPayload) violations.push("response_payload_missing");
  if (result.sent_model && route.model_id && String(result.sent_model) !== String(route.model_id)) {
    violations.push("sent_model_mismatch");
  }
  if (result.usage !== undefined && !isPlainObject(result.usage)) violations.push("usage_malformed");
  return violations;
}

const RESPONSE_CONTENT_KEYS = new Set([
  "text",
  "content",
  "message",
  "messages",
  "output",
  "answer",
  "summary",
  "body",
  "result",
  "response",
]);
const RESPONSE_METADATA_KEYS = new Set([
  "id",
  "type",
  "role",
  "model",
  "object",
  "created",
  "created_at",
  "finish_reason",
  "index",
  "metadata",
  "usage",
  "provider",
  "route_id",
  "status",
]);

function payloadIsMeaningful(payload, keyHint = "") {
  if (payload === undefined || payload === null) return false;
  if (typeof payload === "string") return payload.trim().length > 0;
  if (typeof payload === "number") return Number.isFinite(payload) && payload !== 0;
  if (typeof payload === "boolean") return payload === true;
  if (Array.isArray(payload)) return payload.some((item) => payloadIsMeaningful(item, keyHint));
  if (isPlainObject(payload)) {
    const entries = Object.entries(payload);
    const contentEntries = entries.filter(([key]) => RESPONSE_CONTENT_KEYS.has(normalizeToken(key)));
    if (contentEntries.length) {
      return contentEntries.some(([key, value]) => payloadIsMeaningful(value, key));
    }
    return entries.some(([key, value]) =>
      !RESPONSE_METADATA_KEYS.has(normalizeToken(key)) && payloadIsMeaningful(value, key)
    );
  }
  return false;
}

function sealRoutingPlan(plan) {
  const body = cloneForPlan(plan);
  const sealed = { ...body, routing_receipt: buildRoutingReceipt(body) };
  Object.defineProperty(sealed, ROUTING_PLAN_AUTHORITY, {
    value: true,
    enumerable: false,
  });
  AUTHORIZED_ROUTING_PLANS.add(sealed);
  return deepFreeze(sealed);
}

export function planRouting(input = {}, env = {}) {
  const now = env.now instanceof Date ? env.now : new Date(env.now || Date.now());
  const nowMs = now.getTime();
  const requirements = resolveRequirements(input, env);
  if (!requirements.ok) {
    const plan = {
      created_at: now.toISOString(),
      surface_id: normalizeToken(input?.surface_id || env.surface_id || "default"),
      task_class: normalizeToken(input?.task_class),
      trust_zone: normalizeToken(input?.trust_zone),
      sensitivity: normalizeToken(input?.sensitivity),
      requested_model: input?.requested_model || null,
      selected_tier: "BLOCKED",
      selected_model_or_route: null,
      fallback_chain: [],
      cache_eligibility: { eligible: false, reason: "invalid_requirements" },
      downgrade_reason: null,
      fail_closed_reason: requirements.reason,
      policy_sha256: null,
      request_sha256: null,
      context: null,
      route_evidence_sha256: hashCanonical(env.route_evidence || []),
      rejected_routes: [],
      estimated_cost_usd: null,
      max_cost_usd: null,
      reasoning_clamped: false,
      max_thinking_tokens: null,
    };
    return sealRoutingPlan(plan);
  }

  const context = isPlainObject(env.context) ? env.context : {};
  const contextSize = Number(context.rendered_bytes ?? context.budget_bytes_used ?? 0);
  const contextOverflow = Number.isFinite(contextSize) && contextSize > requirements.budget_bytes;
  const deterministicHandlers = Array.isArray(env.deterministic_handlers) ? env.deterministic_handlers : [];
  const deterministic = deterministicHandlers.find((handler) =>
    handler &&
    normalizeToken(handler.task_class) === requirements.task_class &&
    normalizeToken(handler.trust_zone || requirements.trust_zone) === requirements.trust_zone &&
    String(handler.response_contract || requirements.response_contract) === String(requirements.response_contract)
  );

  const cacheEligibility = buildExactCacheEligibility(requirements, context);
  const routeEvidence = Array.isArray(env.route_evidence) ? env.route_evidence : [];
  const rejectedRoutes = [];

  if (contextOverflow) {
    const plan = {
      created_at: now.toISOString(),
      surface_id: requirements.surface_id,
      task_class: requirements.task_class,
      trust_zone: requirements.trust_zone,
      sensitivity: requirements.sensitivity,
      requested_model: requirements.requested_model,
      selected_tier: "BLOCKED",
      selected_model_or_route: null,
      fallback_chain: [],
      cache_eligibility: cacheEligibility,
      downgrade_reason: requirements.effort_adjustment,
      fail_closed_reason: "context_budget_exceeded",
      policy_sha256: requirements.policy_sha256,
      request_sha256: requirements.request_sha256,
      context,
      route_evidence_sha256: hashCanonical(routeEvidence),
      rejected_routes: [],
      estimated_cost_usd: requirements.estimated_cost_usd,
      max_cost_usd: requirements.max_cost_usd,
      reasoning_clamped: requirements.reasoning_clamped,
      max_thinking_tokens: requirements.max_thinking_tokens,
    };
    return sealRoutingPlan(plan);
  }

  if (requirements.selected_tier === "T0" && deterministic) {
    const routeId = deterministic.route_id || `deterministic:${requirements.task_class}`;
    const plan = {
      created_at: now.toISOString(),
      surface_id: requirements.surface_id,
      task_class: requirements.task_class,
      trust_zone: requirements.trust_zone,
      sensitivity: requirements.sensitivity,
      requested_model: requirements.requested_model,
      selected_tier: "T0",
      selected_model_or_route: routeId,
      fallback_chain: [],
      cache_eligibility: cacheEligibility,
      downgrade_reason: requirements.effort_adjustment,
      fail_closed_reason: null,
      policy_sha256: requirements.policy_sha256,
      request_sha256: requirements.request_sha256,
      context,
      deterministic,
      route_evidence_sha256: hashCanonical(routeEvidence),
      rejected_routes: [],
      estimated_cost_usd: requirements.estimated_cost_usd,
      max_cost_usd: requirements.max_cost_usd,
      reasoning_clamped: requirements.reasoning_clamped,
      max_thinking_tokens: requirements.max_thinking_tokens,
    };
    return sealRoutingPlan(plan);
  }

  const eligibleRoutes = [];
  for (const route of routeEvidence) {
    const verdict = routeSatisfiesRequirements(route, requirements, nowMs);
    if (verdict.ok) eligibleRoutes.push(route);
    else rejectedRoutes.push({
      route_id: isPlainObject(route) ? route.route_id || route.model_id || "unknown" : "unknown",
      reasons: verdict.reasons,
    });
  }

  eligibleRoutes.sort((a, b) => routeRank(b, requirements) - routeRank(a, requirements) || String(a.route_id || a.model_id).localeCompare(String(b.route_id || b.model_id)));
  const maxAttempts = Math.max(1, Math.min(
    HARD_MAX_PROVIDER_ATTEMPTS,
    Number(requirements.policy.max_provider_attempts || DEFAULT_ROUTING_POLICY.max_provider_attempts)
  ));
  const chain = eligibleRoutes.slice(0, maxAttempts).map((route) => ({
    route_id: route.route_id || route.model_id,
    model_id: route.model_id || route.model || null,
    adapter: route.adapter || route.provider || null,
    callable: route.callable === true,
    evidence_expires_at: route.evidence_expires_at || route.fresh_until || route.probed_expires_at || null,
    surface_id: route.surface_id || requirements.surface_id,
    provider_boundary: route.provider_boundary || route.data_boundary || route.boundary || null,
    tier: requirements.selected_tier,
    effort: requirements.selected_effort,
    max_thinking_tokens: requirements.max_thinking_tokens,
    selection: route.selection || null,
  }));

  const selected = chain[0] || null;
  const plan = {
    created_at: now.toISOString(),
    surface_id: requirements.surface_id,
    task_class: requirements.task_class,
    trust_zone: requirements.trust_zone,
    sensitivity: requirements.sensitivity,
    requested_model: requirements.requested_model,
    selected_tier: selected ? requirements.selected_tier : "BLOCKED",
    selected_model_or_route: selected?.route_id || null,
    fallback_chain: chain.slice(1),
    planned_chain: chain,
    cache_eligibility: cacheEligibility,
    downgrade_reason: requirements.effort_adjustment,
    fail_closed_reason: selected ? null : "no_eligible_route",
    policy_sha256: requirements.policy_sha256,
    request_sha256: requirements.request_sha256,
    context,
    route_evidence_sha256: hashCanonical(routeEvidence),
    rejected_routes: rejectedRoutes,
    compute_budget: {
      budget_tokens: requirements.budget_tokens,
      max_attempts: maxAttempts,
    },
    estimated_cost_usd: requirements.estimated_cost_usd,
    max_cost_usd: requirements.max_cost_usd,
    reasoning_clamped: requirements.reasoning_clamped,
    max_thinking_tokens: requirements.max_thinking_tokens,
    selection: isPlainObject(input.selection) ? input.selection : null,
  };
  return sealRoutingPlan(plan);
}

export async function executeRoutingPlan(plan, runtime = {}) {
  const attempts = [];
  const startedMsRaw = runtime.now?.() ?? Date.now();
  const startedMs = startedMsRaw instanceof Date ? startedMsRaw.getTime() : Number(startedMsRaw);
  const startedAt = new Date(Number.isFinite(startedMs) ? startedMs : Date.now()).toISOString();
  if (!plan || plan.fail_closed_reason) {
    return {
      schema: ROUTING_EXECUTION_SCHEMA,
      started_at: startedAt,
      status: "BLOCKED",
      fail_closed_reason: plan?.fail_closed_reason || "invalid_plan",
      duration_ms: 0,
      ttft_ms: null,
      attempts,
      routing_receipt_sha256: plan?.routing_receipt?.receipt_sha256 || null,
    };
  }
  if (
    !Object.prototype.hasOwnProperty.call(plan, ROUTING_PLAN_AUTHORITY)
    || plan[ROUTING_PLAN_AUTHORITY] !== true
    || !AUTHORIZED_ROUTING_PLANS.has(plan)
  ) {
    return {
      schema: ROUTING_EXECUTION_SCHEMA,
      started_at: startedAt,
      status: "BLOCKED",
      fail_closed_reason: "invalid_plan_authority",
      duration_ms: 0,
      ttft_ms: null,
      attempts,
      routing_receipt_sha256: plan?.routing_receipt?.receipt_sha256 || null,
    };
  }
  if (!routingReceiptMatches(plan)) {
    return {
      schema: ROUTING_EXECUTION_SCHEMA,
      started_at: startedAt,
      status: "BLOCKED",
      fail_closed_reason: "invalid_routing_receipt",
      duration_ms: 0,
      ttft_ms: null,
      attempts,
      routing_receipt_sha256: plan?.routing_receipt?.receipt_sha256 || null,
    };
  }

  if (plan.selected_tier === "T0") {
    const handlers = isPlainObject(runtime.deterministicHandlers) ? runtime.deterministicHandlers : {};
    const handler = Object.prototype.hasOwnProperty.call(handlers, plan.selected_model_or_route)
      ? handlers[plan.selected_model_or_route]
      : undefined;
    if (typeof handler !== "function") {
      return {
        schema: ROUTING_EXECUTION_SCHEMA,
        started_at: startedAt,
        status: "BLOCKED",
        fail_closed_reason: "missing_deterministic_handler",
        selected_tier: "T0",
        selected_model_or_route: plan.selected_model_or_route,
        provider_invoked: false,
        duration_ms: 0,
        ttft_ms: null,
        attempts,
        routing_receipt_sha256: plan.routing_receipt.receipt_sha256,
      };
    }
    const handlerStartedMsRaw = runtime.now?.() ?? Date.now();
    const handlerStartedMs = handlerStartedMsRaw instanceof Date ? handlerStartedMsRaw.getTime() : Number(handlerStartedMsRaw);
    const result = await handler(plan);
    const handlerEndedMsRaw = runtime.now?.() ?? Date.now();
    const handlerEndedMs = handlerEndedMsRaw instanceof Date ? handlerEndedMsRaw.getTime() : Number(handlerEndedMsRaw);
    const handlerDurationMs = Math.max(0, handlerEndedMs - handlerStartedMs);

    const baselineLatencyMs = TIER_BASELINE_LATENCY_MS["T0"] ?? 10;
    const latencyDeltaMs = handlerDurationMs - baselineLatencyMs;
    const t0Deltas = {
      actual_cost_usd: 0.0,
      cost_delta_usd: plan.estimated_cost_usd !== null ? Number((0.0 - plan.estimated_cost_usd).toFixed(6)) : 0.0,
      baseline_latency_ms: baselineLatencyMs,
      latency_delta_ms: latencyDeltaMs,
      fallback_occurred: false,
      fallback_attempts_count: 0,
      quality_delta: "nominal",
    };

    const responseViolations = validateRouteResult(result, { model_id: null });
    if (responseViolations.length) {
      return {
        schema: ROUTING_EXECUTION_SCHEMA,
        started_at: startedAt,
        status: "BLOCKED",
        fail_closed_reason: responseViolations.join(","),
        selected_tier: "T0",
        selected_model_or_route: plan.selected_model_or_route,
        provider_invoked: false,
        duration_ms: handlerDurationMs,
        ttft_ms: null,
        routing_deltas: t0Deltas,
        attempts,
        routing_receipt_sha256: plan.routing_receipt.receipt_sha256,
      };
    }
    return {
      schema: ROUTING_EXECUTION_SCHEMA,
      started_at: startedAt,
      status: "SUCCEEDED",
      selected_tier: "T0",
      selected_model_or_route: plan.selected_model_or_route,
      provider_invoked: false,
      duration_ms: handlerDurationMs,
      ttft_ms: null,
      routing_deltas: t0Deltas,
      attempts,
      result,
      routing_receipt_sha256: plan.routing_receipt.receipt_sha256,
    };
  }

  const chain = Array.isArray(plan.planned_chain) ? plan.planned_chain : [plan.selected_model_or_route, ...(plan.fallback_chain || [])].filter(Boolean);
  const maxAttempts = Math.max(1, Math.min(
    HARD_MAX_PROVIDER_ATTEMPTS,
    Number(plan.compute_budget?.max_attempts || DEFAULT_ROUTING_POLICY.max_provider_attempts)
  ));
  const invoke = runtime.invokeRoute;
  if (typeof invoke !== "function") {
    return {
      schema: ROUTING_EXECUTION_SCHEMA,
      started_at: startedAt,
      status: "BLOCKED",
      fail_closed_reason: "missing_route_invoker",
      duration_ms: 0,
      ttft_ms: null,
      attempts,
      routing_receipt_sha256: plan.routing_receipt.receipt_sha256,
    };
  }

  for (const route of chain.slice(0, maxAttempts)) {
    const routeId = typeof route === "string" ? route : route.route_id;
    const attempt = {
      route_id: routeId,
      model_id: typeof route === "string" ? null : route.model_id,
      adapter: typeof route === "string" ? null : route.adapter || null,
      provider_boundary: typeof route === "string" ? null : route.provider_boundary || null,
      selection: typeof route === "string" ? null : route.selection || null,
      status: "PENDING",
      adapter_invoked: false,
      transport_started: false,
      usage_known: false,
      duration_ms: 0,
      ttft_ms: null,
    };
    attempts.push(attempt);
    const attemptNowRaw = runtime.now?.() ?? Date.now();
    const attemptNow = attemptNowRaw instanceof Date ? attemptNowRaw.getTime() : Number(attemptNowRaw);
    const freshness = typeof route === "string"
      ? { ok: false, reason: "route_evidence_missing_at_execution" }
      : evidenceFresh(route, Number.isFinite(attemptNow) ? attemptNow : Date.now());
    if (!freshness.ok) {
      attempt.status = "BLOCKED";
      attempt.error = freshness.reason;
      attempt.duration_ms = 0;
      if (runtime.permitFallback && runtime.permitFallback({ error: new Error(freshness.reason), route, plan, attempt }) === true) {
        continue;
      }
      break;
    }
    const attemptStartedMs = attemptNow;
    try {
      attempt.adapter_invoked = true;
      attempt.transport_started = true;
      const result = await invoke({ route, plan, attempt_index: attempts.length - 1 });
      const attemptEndedMsRaw = runtime.now?.() ?? Date.now();
      const attemptEndedMs = attemptEndedMsRaw instanceof Date ? attemptEndedMsRaw.getTime() : Number(attemptEndedMsRaw);
      attempt.duration_ms = Math.max(0, attemptEndedMs - attemptStartedMs);

      const responseViolations = validateRouteResult(result, route);
      if (responseViolations.length) {
        attempt.status = "BLOCKED";
        attempt.error = responseViolations.join(",");
        if (runtime.permitFallback && runtime.permitFallback({ error: new Error(attempt.error), route, plan, attempt }) === true) {
          continue;
        }
        break;
      }
      attempt.status = "SUCCEEDED";
      attempt.sent_model = result?.sent_model || route.model_id || null;
      attempt.reported_model = result?.reported_model || null;
      attempt.usage = result?.usage || null;
      attempt.usage_known = Boolean(result?.usage);
      if (result?.ttft_ms !== undefined && Number.isFinite(Number(result.ttft_ms))) {
        attempt.ttft_ms = Number(result.ttft_ms);
      } else if (result?.usage?.ttft_ms !== undefined && Number.isFinite(Number(result.usage.ttft_ms))) {
        attempt.ttft_ms = Number(result.usage.ttft_ms);
      }
      const totalEndedMsRaw = runtime.now?.() ?? Date.now();
      const totalEndedMs = totalEndedMsRaw instanceof Date ? totalEndedMsRaw.getTime() : Number(totalEndedMsRaw);
      const totalDurationMs = Math.max(0, totalEndedMs - startedMs);
      const baselineLatencyMs = TIER_BASELINE_LATENCY_MS[plan.selected_tier] ?? 1200;
      const latencyDeltaMs = totalDurationMs - baselineLatencyMs;

      let actualCostUsd = null;
      let costDeltaUsd = null;
      if (attempt.usage) {
        const inputTokens = Number(attempt.usage.input_tokens || attempt.usage.prompt_tokens || 0);
        const outputTokens = Number(attempt.usage.output_tokens || attempt.usage.completion_tokens || 0);
        actualCostUsd = calculateAsymmetricCostUsd({
          tier: plan.selected_tier,
          inputTokens,
          outputTokens,
        });
        if (plan.estimated_cost_usd !== null && Number.isFinite(plan.estimated_cost_usd)) {
          costDeltaUsd = Number((actualCostUsd - plan.estimated_cost_usd).toFixed(6));
        }
      }

      const fallbackOccurred = attempts.length > 1;
      const fallbackAttemptsCount = Math.max(0, attempts.length - 1);
      const qualityDelta = fallbackOccurred ? "fallback_degraded" : "nominal";

      const routingDeltas = {
        actual_cost_usd: actualCostUsd,
        cost_delta_usd: costDeltaUsd,
        baseline_latency_ms: baselineLatencyMs,
        latency_delta_ms: latencyDeltaMs,
        fallback_occurred: fallbackOccurred,
        fallback_attempts_count: fallbackAttemptsCount,
        quality_delta: qualityDelta,
      };

      return {
        schema: ROUTING_EXECUTION_SCHEMA,
        started_at: startedAt,
        status: "SUCCEEDED",
        selected_tier: plan.selected_tier,
        selected_model_or_route: routeId,
        provider_invoked: true,
        duration_ms: totalDurationMs,
        ttft_ms: attempt.ttft_ms ?? null,
        routing_deltas: routingDeltas,
        attempts,
        result,
        routing_receipt_sha256: plan.routing_receipt.receipt_sha256,
      };
    } catch (err) {
      const attemptEndedMsRaw = runtime.now?.() ?? Date.now();
      const attemptEndedMs = attemptEndedMsRaw instanceof Date ? attemptEndedMsRaw.getTime() : Number(attemptEndedMsRaw);
      attempt.duration_ms = Math.max(0, attemptEndedMs - attemptStartedMs);
      attempt.status = "FAILED";
      attempt.error = normalizeToken(err?.blocked_reason || err?.code || err?.message || err) || "route_invocation_failed";
      attempt.error_code = normalizeToken(err?.code || "");
      attempt.error_message = String(err?.message || err || "").slice(0, 400);
      const status = Number(err?.status ?? 0) || 0;
      if (status > 0) attempt.status_code = status;
      if (runtime.permitFallback && runtime.permitFallback({ error: err, route, plan, attempt }) !== true) {
        break;
      }
    }
  }

  const finalEndedMsRaw = runtime.now?.() ?? Date.now();
  const finalEndedMs = finalEndedMsRaw instanceof Date ? finalEndedMsRaw.getTime() : Number(finalEndedMsRaw);
  const totalDurationMs = Math.max(0, finalEndedMs - startedMs);
  const baselineLatencyMs = TIER_BASELINE_LATENCY_MS[plan.selected_tier] ?? 1200;
  const routingDeltas = {
    actual_cost_usd: 0.0,
    cost_delta_usd: plan.estimated_cost_usd !== null ? Number((0.0 - plan.estimated_cost_usd).toFixed(6)) : 0.0,
    baseline_latency_ms: baselineLatencyMs,
    latency_delta_ms: totalDurationMs - baselineLatencyMs,
    fallback_occurred: attempts.length > 1,
    fallback_attempts_count: Math.max(0, attempts.length - 1),
    quality_delta: "exhausted_blocked",
  };

  return {
    schema: ROUTING_EXECUTION_SCHEMA,
    started_at: startedAt,
    status: "BLOCKED",
    fail_closed_reason: "eligible_attempts_exhausted",
    selected_tier: plan.selected_tier,
    selected_model_or_route: plan.selected_model_or_route,
    provider_invoked: attempts.some((attempt) => attempt.adapter_invoked === true || attempt.transport_started === true || attempt.status === "FAILED" || attempt.status === "SUCCEEDED"),
    duration_ms: totalDurationMs,
    ttft_ms: null,
    routing_deltas: routingDeltas,
    attempts,
    routing_receipt_sha256: plan.routing_receipt.receipt_sha256,
  };
}

/**
 * Builds a verifiable route delta receipt binding plan, execution, quality, cost, and latency deltas.
 */
export function buildRouteDeltaReceipt({ plan, executionReceipt } = {}) {
  if (!plan) throw new Error("plan is required");
  if (!executionReceipt) throw new Error("executionReceipt is required");

  const deltas = executionReceipt.routing_deltas || {
    actual_cost_usd: null,
    cost_delta_usd: null,
    baseline_latency_ms: null,
    latency_delta_ms: null,
    fallback_occurred: false,
    fallback_attempts_count: 0,
    quality_delta: "unknown",
  };

  const receipt = {
    schema: ROUTING_DELTA_RECEIPT_SCHEMA,
    timestamp: new Date().toISOString(),
    task_class: plan.task_class || "unknown",
    selected_tier: plan.selected_tier,
    selected_model_or_route: executionReceipt.selected_model_or_route || null,
    execution_status: executionReceipt.status,
    planned_estimated_cost_usd: plan.estimated_cost_usd ?? null,
    planned_max_cost_usd: plan.max_cost_usd ?? null,
    duration_ms: executionReceipt.duration_ms ?? 0,
    ttft_ms: executionReceipt.ttft_ms ?? null,
    routing_deltas: deltas,
    attempts_count: Array.isArray(executionReceipt.attempts) ? executionReceipt.attempts.length : 0,
    plan_receipt_sha256: plan.routing_receipt?.receipt_sha256 || null,
    execution_receipt_sha256: hashCanonical(executionReceipt),
  };

  receipt.receipt_sha256 = hashCanonical(receipt);
  return receipt;
}
