export const PROVIDER_CAPABILITY_MATRIX_SCHEMA = "dizzy.provider_capability_matrix.v1";

export const PROVIDER_CAPABILITY_PROFILES = Object.freeze({
  // Local Ollama Models
  "gemma3:4b": {
    model_id: "gemma3:4b",
    provider: "ollama",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "local_cpu_slow",
    preferred_lens: ["local/offline sanity", "governance bounds", "regression triage"],
    avoid_for: ["large diff review", "high-token council waves"],
    provider_boundary: "private_self",
  },
  "gemma3:12b": {
    model_id: "gemma3:12b",
    provider: "ollama",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "local_cpu_very_slow",
    preferred_lens: ["deeper local synthesis"],
    avoid_for: ["fast loop rotation", "large council waves"],
    provider_boundary: "private_self",
  },
  "qwen2.5-coder:7b": {
    model_id: "qwen2.5-coder:7b",
    provider: "ollama",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "local_cpu_slow",
    preferred_lens: ["implementation review", "fixture adequacy", "small diff critique"],
    avoid_for: ["broad governance synthesis"],
    provider_boundary: "private_self",
  },
  "llama-audit:latest": {
    model_id: "llama-audit:latest",
    provider: "ollama",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "local_cpu_slow",
    preferred_lens: ["security review", "policy/risk matrix", "adversarial checks"],
    avoid_for: ["long-context synthesis"],
    provider_boundary: "private_self",
  },
  "mistral:latest": {
    model_id: "mistral:latest",
    provider: "ollama",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "local_cpu_slow",
    preferred_lens: ["instruction following", "wording sanity", "small review packets"],
    avoid_for: ["deep code proof"],
    provider_boundary: "private_self",
  },
  "deepseek-r1:7b": {
    model_id: "deepseek-r1:7b",
    provider: "ollama",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "local_cpu_very_slow",
    preferred_lens: ["reasoning adapter critique", "step-by-step logic review"],
    avoid_for: ["fast loop rotation", "large council waves"],
    provider_boundary: "private_self",
  },
  "deepseek-r1:1.5b": {
    model_id: "deepseek-r1:1.5b",
    provider: "ollama",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "local_cpu_medium",
    preferred_lens: ["small reasoning smoke tests"],
    avoid_for: ["authoritative proof review", "large diff review"],
    provider_boundary: "private_self",
  },
  "glm4:latest": {
    model_id: "glm4:latest",
    provider: "ollama",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "local_cpu_slow",
    preferred_lens: ["alternate local synthesis", "general critique"],
    avoid_for: ["unverified release gates"],
    provider_boundary: "private_self",
  },

  // Groq Cloud Models
  "llama-3.1-8b-instant": {
    model_id: "llama-3.1-8b-instant",
    provider: "groq",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "groq_fast",
    preferred_lens: ["fast JSON review", "triage", "small-diff sanity"],
    avoid_for: ["deep architecture proof", "long-context synthesis"],
    provider_boundary: "trusted_collaborator",
  },
  "llama-3.3-70b-versatile": {
    model_id: "llama-3.3-70b-versatile",
    provider: "groq",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "groq_fast_to_medium",
    preferred_lens: ["broad critique", "policy/risk matrix", "alternate reasoning"],
    avoid_for: ["private-self local-only review"],
    provider_boundary: "trusted_collaborator",
  },
  "qwen/qwen3.6-27b": {
    model_id: "qwen/qwen3.6-27b",
    provider: "groq",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "groq_fast_to_medium",
    preferred_lens: ["implementation review", "fixture adequacy", "code-path critique"],
    avoid_for: ["private-self local-only review"],
    provider_boundary: "trusted_collaborator",
  },
  "openai/gpt-oss-20b": {
    model_id: "openai/gpt-oss-20b",
    provider: "groq",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "groq_fast",
    preferred_lens: ["fast generalist review", "governance wording", "small-diff critique"],
    avoid_for: ["private-self local-only review"],
    provider_boundary: "trusted_collaborator",
  },
  "openai/gpt-oss-120b": {
    model_id: "openai/gpt-oss-120b",
    provider: "groq",
    installed: false,
    callable: true,
    returns_normal_content: true,
    returns_auxiliary_only: false,
    json_review_usable: true,
    expected_latency_band: "groq_medium",
    preferred_lens: ["deeper open-weight review", "reasoning checks"],
    avoid_for: ["private-self local-only review", "low-latency loops"],
    provider_boundary: "trusted_collaborator",
  },

  // OpenRouter Free Models (Probe Targets)
  "nvidia/llama-3.1-nemotron-70b-instruct:free": {
    model_id: "nvidia/llama-3.1-nemotron-70b-instruct:free",
    provider: "openrouter",
    installed: false,
    callable: false,
    returns_normal_content: false,
    returns_auxiliary_only: false,
    json_review_usable: false,
    expected_latency_band: "openrouter_free_variable",
    preferred_lens: ["security review", "policy/risk matrix"],
    avoid_for: ["private-self local-only review", "strict SLAs"],
    provider_boundary: "public_free",
    availability_status: "unproven_requires_probe",
    evidence_source: "openrouter_free_slug_probe_required",
  },
  "liquid/lqc-3b-v0.1:free": {
    model_id: "liquid/lqc-3b-v0.1:free",
    provider: "openrouter",
    installed: false,
    callable: false,
    returns_normal_content: false,
    returns_auxiliary_only: false,
    json_review_usable: false,
    expected_latency_band: "openrouter_free_variable",
    preferred_lens: ["fast light review", "syntax check"],
    avoid_for: ["deep reasoning", "private-self local-only review"],
    provider_boundary: "public_free",
    availability_status: "unproven_requires_probe",
    evidence_source: "openrouter_free_slug_probe_required",
  },
  "thudm/glm-4-9b-chat:free": {
    model_id: "thudm/glm-4-9b-chat:free",
    provider: "openrouter",
    installed: false,
    callable: false,
    returns_normal_content: false,
    returns_auxiliary_only: false,
    json_review_usable: false,
    expected_latency_band: "openrouter_free_variable",
    preferred_lens: ["multilingual synthesis", "general critique"],
    avoid_for: ["private-self local-only review"],
    provider_boundary: "public_free",
    availability_status: "unproven_requires_probe",
    evidence_source: "openrouter_free_slug_probe_required",
  },
  "moonshotai/kimi-k2.7-code:batch": {
    model_id: "moonshotai/kimi-k2.7-code:batch",
    provider: "openrouter",
    installed: false,
    callable: false,
    returns_normal_content: false,
    returns_auxiliary_only: false,
    json_review_usable: false,
    expected_latency_band: "openrouter_free_variable",
    preferred_lens: ["long-context code critique", "document review"],
    avoid_for: ["private-self local-only review", "real-time interactive loops"],
    provider_boundary: "public_free",
    availability_status: "unproven_requires_probe",
    evidence_source: "openrouter_free_slug_probe_required",
  },
  "qwen/qwen-2.5-coder-32b-instruct:free": {
    model_id: "qwen/qwen-2.5-coder-32b-instruct:free",
    provider: "openrouter",
    installed: false,
    callable: false,
    returns_normal_content: false,
    returns_auxiliary_only: false,
    json_review_usable: false,
    expected_latency_band: "openrouter_free_variable",
    preferred_lens: ["implementation review", "fixture adequacy", "code-path critique"],
    avoid_for: ["private-self local-only review", "strict SLAs"],
    provider_boundary: "public_free",
    availability_status: "unproven_requires_probe",
    evidence_source: "openrouter_free_slug_probe_required",
  },

  // Cerebras Models (Candidate Ultra-fast OSS Cloud)
  "cerebras/qwen-2.5-coder-32b": {
    model_id: "cerebras/qwen-2.5-coder-32b",
    provider: "cerebras",
    installed: false,
    callable: false,
    returns_normal_content: false,
    returns_auxiliary_only: false,
    json_review_usable: false,
    expected_latency_band: "cerebras_ultra_fast",
    preferred_lens: ["ultra-fast code review", "high-throughput pass"],
    avoid_for: ["private-self local-only review"],
    provider_boundary: "trusted_collaborator",
    availability_status: "unproven_requires_adapter_and_key",
    evidence_source: "cerebras_lane_not_yet_wired",
  },
});

function providerForUnknownModel(modelId = "") {
  const raw = String(modelId || "").trim();
  if (raw.includes("/") && raw.includes(":free")) return "openrouter";
  if (raw.includes("/") && raw.toLowerCase().includes("cerebras")) return "cerebras";
  if (raw.includes("/")) return "openrouter";
  return "ollama";
}

function normalizeAvailabilityStatus(result = {}) {
  result = result || {};
  const status = String(result.status || "").trim();
  if (!status) return "";
  return status;
}

function isAvailabilityCallable(result = {}) {
  result = result || {};
  const status = normalizeAvailabilityStatus(result);
  return result.runnable === true || status === "available" || status === "content_parse_warning";
}

function isAvailabilityJsonUsable(result = {}) {
  result = result || {};
  const status = normalizeAvailabilityStatus(result);
  return result.json_usable === true || result.parse_result === "json_valid" || status === "available";
}

function availabilityResultMap(results = []) {
  const out = new Map();
  for (const result of Array.isArray(results) ? results : []) {
    const model = String(result?.model || result?.model_id || "").trim();
    if (model) out.set(model, result);
  }
  return out;
}

export function getProviderCapabilityProfile(modelId = "", installedModels = new Set(), availabilityResult = null) {
  const raw = String(modelId || "").trim();
  const base = PROVIDER_CAPABILITY_PROFILES[raw] || {
    model_id: raw,
    provider: providerForUnknownModel(raw),
    installed: false,
    callable: false,
    returns_normal_content: false,
    returns_auxiliary_only: false,
    json_review_usable: false,
    expected_latency_band: raw.includes("/") ? "cloud_unknown" : "local_cpu_unknown",
    preferred_lens: ["general review"],
    avoid_for: raw.includes("/") ? ["private-self local-only review"] : [],
    provider_boundary: raw.includes("/") ? "public_free" : "private_self",
    availability_status: "unknown_model_requires_probe",
    evidence_source: "none",
  };
  const installed = base.provider === "ollama"
    ? installedModels.has(raw)
    : false;
  const availabilityStatus = normalizeAvailabilityStatus(availabilityResult);
  const availabilityCallable = availabilityResult ? isAvailabilityCallable(availabilityResult) : false;
  const callable = base.provider === "ollama"
    ? Boolean((installed || availabilityCallable) && base.callable)
    : Boolean(availabilityCallable || (base.provider === "groq" && base.callable));
  const returnsNormalContent = Boolean(callable && (availabilityResult ? !availabilityResult.returns_auxiliary_only : base.returns_normal_content));
  const returnsAuxiliaryOnly = Boolean(callable && (availabilityResult?.returns_auxiliary_only || base.returns_auxiliary_only));
  const jsonReviewUsable = Boolean(callable && (availabilityResult ? isAvailabilityJsonUsable(availabilityResult) : base.json_review_usable));

  return {
    ...base,
    installed,
    callable,
    returns_normal_content: returnsNormalContent,
    returns_auxiliary_only: returnsAuxiliaryOnly,
    json_review_usable: jsonReviewUsable,
    availability_status: availabilityStatus || base.availability_status || (callable ? "profile_configured" : "unproven"),
    evidence_source: availabilityResult ? "availability_receipt" : (base.evidence_source || "profile_metadata"),
  };
}

export function buildProviderCapabilityMatrixReceipt({
  installedModels = [],
  testedModels = [],
  availabilityResults = [],
  now = new Date(),
} = {}) {
  const installedSet = new Set(installedModels.map((m) => typeof m === "string" ? m : m.name || m.model_id));
  const testedSet = new Set(testedModels.map((m) => typeof m === "string" ? m : m.name || m.model_id));
  const availabilityMap = availabilityResultMap(availabilityResults);
  const allModelKeys = Array.from(new Set([
    ...Object.keys(PROVIDER_CAPABILITY_PROFILES),
    ...installedSet,
    ...testedSet,
    ...availabilityMap.keys(),
  ])).sort();

  const profiles = allModelKeys.map((key) => {
    const base = PROVIDER_CAPABILITY_PROFILES[key];
    const testedAvailability = testedSet.has(key)
      ? { model: key, status: "tested_available", runnable: true, json_usable: base?.json_review_usable === true }
      : null;
    return getProviderCapabilityProfile(key, installedSet, availabilityMap.get(key) || testedAvailability);
  });

  return {
    schema_version: PROVIDER_CAPABILITY_MATRIX_SCHEMA,
    created_at: now.toISOString(),
    model_count: profiles.length,
    installed_model_count: installedSet.size,
    tested_model_count: testedSet.size,
    profiles,
    authority: "capability_matrix_evidence_not_authority",
  };
}
