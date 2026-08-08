import crypto from "crypto";
import net from "net";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function normalizeBackend(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "openrouter") return "openai_compat";
  if (raw === "gemini" || raw === "openai_compat") return raw;
  return "";
}

function hostnameForBaseUrl(baseUrl) {
  try {
    return new URL(String(baseUrl || "").trim()).hostname;
  } catch {
    return "";
  }
}

function hostMatches(host, suffix) {
  const h = String(host || "").trim().toLowerCase();
  const s = String(suffix || "").trim().toLowerCase();
  return h === s || h.endsWith(`.${s}`);
}

export const VALID_DATA_BOUNDARIES = Object.freeze([
  "google_gemini_api",
  "openai_compatible_api",
  "local_machine",
  "private_lan",
  "internal_only",
  "filtered_carryover",
  "none",
]);

export const VALID_COST_BANDS = Object.freeze([
  "free_local",
  "free",
  "low",
  "standard",
  "unknown",
]);

export const VALID_MODEL_ORIGIN_RISKS = Object.freeze([
  "low",
  "medium",
  "high",
  "unknown",
]);

export const VALID_BLOCKED_REASONS = Object.freeze([
  "local_offline_cloud_blocked",
  "private_zone_cloud_disallowed",
  "redirect_to_cloud_disallowed",
  "provider_network_offline",
  "provider_http_error",
  "chat_backend_not_configured",
  "no_model_execution",
  "tool_only_no_model",
  "provider_call_failed",
  "provider_execution_failed",
  "post_model_parse_failed",
  "post_model_policy_failed",
  "post_model_write_failed",
  "invalid_configuration",
  "fallback_paused_global_limit",
  "fallback_paused_conversation_limit",
  "invalid_url_format",
  "trust_zone_blocks_repo_retrieval",
  "security_exception_non_loopback",
  "security_exception_non_private_lan",
  "other",
]);

/**
 * 8-division router roster. This is route metadata, not operator authority.
 */
export const EIGHT_DIVISIONS_ROSTER = Object.freeze({
  DIV_I: {
    id: "DIV_I",
    name: "Division I: Non-Transformer & Continuous Dynamics",
    roles: {
      liquid_dynamics_critic: {
        primary: "liquid-ai/lfm-40b",
        fallbacks: ["gemma3:4b"],
        description: "Continuous-time state and sequence dynamics modeling",
      },
    },
  },
  DIV_II: {
    id: "DIV_II",
    name: "Division II: Program Synthesis & Code Foundations",
    roles: {
      program_synthesis_specialist: { primary: "poolside/laguna", fallbacks: ["qwen-2.5-coder-32b", "qwen2.5-coder:7b"], description: "Execution-guided program synthesis" },
      code_synthesizer_32b: { primary: "qwen-2.5-coder-32b", fallbacks: ["codestral-22b", "qwen2.5-coder:7b"], description: "Massive multi-file code synthesis" },
      devstral_specialist: { primary: "codestral-22b", fallbacks: ["yi-coder", "qwen2.5-coder:7b"], description: "Codebase refactoring and bug hunting" },
      repository_ingestor: { primary: "yi-coder", fallbacks: ["magic-dev", "qwen2.5-coder:7b"], description: "128k long-context cross-file dependency mapping" },
      technical_search_engineer: { primary: "phind-34b", fallbacks: ["starcoder2-15b"], description: "Technical Q&A and algorithm synthesis" },
      python_script_automator: { primary: "wizardcoder-34b", fallbacks: ["qwen2.5-coder:7b"], description: "Python and automation script specialist" },
      bigcode_foundation: { primary: "starcoder2-15b", fallbacks: ["codegemma-7b"], description: "Open-community code generation foundation" },
      local_code_probe: { primary: "codegemma-7b", fallbacks: ["qwen2.5-coder:7b"], description: "Lightweight Google open code model probe" },
      junsong_hf_specialist: { primary: "junsong-hf", fallbacks: ["codegemma-7b"], description: "Fine-tuned open-source code & reasoning checkpoints" },
    },
  },
  DIV_III: {
    id: "DIV_III",
    name: "Division III: Adversarial & Security Red-Team",
    roles: {
      adversarial_critic: { primary: "x-ai/grok-2", fallbacks: ["nvidia/nemotron-70b", "llama-audit:latest"], description: "Unfiltered edge-case hunting and security auditing" },
      redteam_security_harness: { primary: "promptfoo", fallbacks: ["llama-audit:latest"], description: "Automated prompt injection & schema drift security fuzzer" },
      deepgrove_code_auditor: { primary: "deepgrove", fallbacks: ["llama-audit:latest"], description: "Codebase vulnerability detection" },
      inclusion_audit_critic: { primary: "inclusion-ai", fallbacks: ["llama-audit:latest"], description: "Governance and financial security auditor" },
      "alignment_&_reward_critic": { primary: "nvidia/nemotron-70b", fallbacks: ["llama-audit:latest"], description: "RLHF alignment & safety reward critic" },
      local_security_auditor: { primary: "llama-audit:latest", fallbacks: ["gemma3:4b"], description: "Custom local audit Modelfile" },
    },
  },
  DIV_IV: {
    id: "DIV_IV",
    name: "Division IV: Chain-of-Thought & Logic",
    roles: {
      chain_of_thought_critic: { primary: "deepseek-r1", fallbacks: ["deepseek-r1:7b"], description: "Deep math & algorithmic reasoning" },
      deliberate_reasoning_probe: { primary: "openai/o3-mini", fallbacks: ["openai/o1", "deepseek-r1:7b"], description: "Multi-step reasoning probes" },
      moe_logic_titan: { primary: "deepseek-v3", fallbacks: ["deepseek-r1"], description: "671B MoE universal logic" },
    },
  },
  DIV_V: {
    id: "DIV_V",
    name: "Division V: Multimodal & Asian Frontier Labs",
    roles: {
      tencent_hy3_synthesizer: { primary: "hy3", fallbacks: ["yi-zero"], description: "Multi-task code & math synthesis" },
      multimodal_step_reasoner: { primary: "stepfun-step-2", fallbacks: ["mimo"], description: "Multi-step visual & procedural reasoning" },
      mimo_edge_reasoner: { primary: "mimo", fallbacks: ["gemma3:4b"], description: "Compact edge & multimodal reasoning" },
      zero_foundation_model: { primary: "yi-zero", fallbacks: ["kimi-128k"], description: "01.AI Zero foundation model series" },
      minimax_long_context: { primary: "minimax-abab6.5t", fallbacks: ["kimi-128k"], description: "High-speed long-context reasoning" },
      kimi_128k_reasoner: { primary: "moonshot-k2", fallbacks: ["minimax-abab6.5t"], description: "128k long-context reasoning" },
    },
  },
  DIV_VI: {
    id: "DIV_VI",
    name: "Division VI: Systems Architects & High-Judgment Judges",
    roles: {
      systems_architect: { primary: "claude-3-7-sonnet", fallbacks: ["gpt-4o", "gemma3:4b"], description: "Gold standard architecture and code hygiene" },
      universal_judge: { primary: "gpt-4o", fallbacks: ["claude-3-7-sonnet", "gemma3:4b"], description: "Universal execution judge" },
      context_grounding_judge: { primary: "gemini-2.5-pro", fallbacks: ["gemini-2.0-flash"], description: "Long-context retrieval & system prompt grounding" },
      open_weights_titan: { primary: "llama-3.1-405b", fallbacks: ["llama-3.3-70b"], description: "Heavyweight open-weights consensus titan" },
      schema_compliance_auditor: { primary: "command-r-plus", fallbacks: ["gpt-4o"], description: "Structured JSON schema & RAG auditor" },
      abacus_reasoning_judge: { primary: "smaug-72b", fallbacks: ["deepseek-r1"], description: "Fine-tuned reasoning champion" },
      long_context_architect: { primary: "magic-dev", fallbacks: ["gemini-2.5-pro"], description: "100M token context code architect" },
    },
  },
  DIV_VII: {
    id: "DIV_VII",
    name: "Division VII: Local Offline Resident Ensemble",
    roles: {
      gemma3_local: { primary: "gemma3:4b", fallbacks: ["gemma3:12b"], description: "Default local synthesizer and judge" },
      qwen_local: { primary: "qwen2.5-coder:7b", fallbacks: ["gemma3:4b"], description: "Fast local code synthesizer" },
      r1_local: { primary: "deepseek-r1:7b", fallbacks: ["deepseek-r1:1.5b"], description: "Local chain-of-thought logic critic" },
      mistral_local: { primary: "mistral:latest", fallbacks: ["gemma3:4b"], description: "Local instruction follower" },
    },
  },
  DIV_VIII: {
    id: "DIV_VIII",
    name: "Division VIII: Operator-Gated Developer Tool Frameworks",
    roles: {
      git_diff_engine: { primary: "aider", fallbacks: ["qwen2.5-coder:7b"], description: "Surgical multi-file diff generation & clean commit formatting" },
      prompt_compiler: { primary: "dspy", fallbacks: ["systems_architect"], description: "Operator-reviewed prompt compilation from execution traces" },
      github_issue_resolver: { primary: "swe-agent", fallbacks: ["devstral_specialist"], description: "Repo navigation & test suite execution" },
      sandbox_executor: { primary: "openhands", fallbacks: ["mistral:latest"], description: "Isolated container/loopback sandbox execution engine" },
    },
  },
});

export function isLoopbackHost(host) {
  const raw = String(host || "").trim().toLowerCase();
  const h = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
  if (h === "localhost") return true;
  const ipVer = net.isIP(h);
  if (ipVer === 4) return h === "127.0.0.1";
  if (ipVer === 6) return h === "::1";
  return false;
}

export function isPrivateLanHost(host) {
  const raw = String(host || "").trim().toLowerCase();
  const h = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
  const ipVer = net.isIP(h);
  if (ipVer === 4) {
    if (h.startsWith("10.")) return true;
    if (h.startsWith("192.168.")) return true;
    if (h.startsWith("169.254.")) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
    return false;
  }
  if (ipVer === 6) {
    if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true;
    if (/^fe[89ab][0-9a-f]:/i.test(h)) return true;
    return false;
  }
  return false;
}

export function isRemoteCloudBackend(backend, baseUrl = "") {
  const b = String(backend || "").trim().toLowerCase();
  if (b === "gemini") return true;
  if (b === "openai_compat" || b === "openrouter") {
    const urlStr = String(baseUrl || "").trim();
    if (!urlStr) return true;
    try {
      const urlObj = new URL(urlStr);
      const host = urlObj.hostname;
      return !isLoopbackHost(host) && !isPrivateLanHost(host);
    } catch {
      return true;
    }
  }
  return false;
}

export function classifyOpenAICompatBaseUrl(baseUrl = "") {
  const raw = String(baseUrl || "").trim();
  const host = hostnameForBaseUrl(raw);
  if (!host) {
    return { provider: "unknown", host: "", isLocalHost: false };
  }

  const lowerHost = host.toLowerCase();
  const isLocalHost = isLoopbackHost(lowerHost) || isPrivateLanHost(lowerHost);
  if (isLocalHost) {
    return { provider: "ollama", host: lowerHost, isLocalHost };
  }
  if (hostMatches(lowerHost, "openrouter.ai")) {
    return { provider: "openrouter", host: lowerHost, isLocalHost };
  }
  if (hostMatches(lowerHost, "groq.com")) {
    return { provider: "groq", host: lowerHost, isLocalHost };
  }
  return { provider: "generic", host: lowerHost, isLocalHost };
}

export function normalizeOpenAICompatModelForBaseUrl({ baseUrl = "", model = "", localFallbackModel = "gemma3:4b" } = {}) {
  const m = String(model || "").trim();
  if (!m) return "";

  const { provider } = classifyOpenAICompatBaseUrl(baseUrl);
  if (provider === "ollama") {
    if (
      m.includes("/") ||
      m.toLowerCase().includes("openrouter") ||
      m.toLowerCase().includes("gemini") ||
      m.toLowerCase().includes("groq")
    ) {
      return String(localFallbackModel || "gemma3:4b").trim() || "gemma3:4b";
    }
    return m;
  }

  if (provider === "openrouter") {
    if (m === "qwen/qwen-2.5-coder-32b-instruct" || m === "qwen/qwen3-32b" || m === "qwen3-32b") {
      return "openrouter/auto";
    }
    return m;
  }

  if (provider === "groq") {
    if (m === "qwen/qwen-2.5-coder-32b-instruct" || m === "qwen/qwen3-32b" || m === "qwen3-32b") {
      return "qwen-2.5-coder-32b";
    }
    if (m.startsWith("qwen/")) return m.replace(/^qwen\//, "");
    return m;
  }

  if (m === "qwen/qwen3-32b" || m === "qwen3-32b") {
    return "qwen/qwen-2.5-coder-32b-instruct";
  }
  return m;
}

export function resolveOpenAICompatTimeoutMs({ baseUrl = "", timeoutMs, remoteDefaultMs = 20000, localDefaultMs = 120000 } = {}) {
  const requested = Number(timeoutMs);
  const { isLocalHost } = classifyOpenAICompatBaseUrl(baseUrl);
  const fallback = isLocalHost ? localDefaultMs : remoteDefaultMs;
  const floor = isLocalHost ? 10000 : 1000;
  return Math.max(floor, Number.isFinite(requested) && requested > 0 ? requested : fallback);
}

export function computePromptPrefixHash(systemPrompt) {
  const prefix = String(systemPrompt || "").slice(0, 512).trim();
  if (!prefix) return "none";
  return crypto.createHash("sha256").update(prefix).digest("hex").slice(0, 16);
}

export function evaluateLocalIsolationPolicy({ trustZone, dataBoundary, isLocalBackend }) {
  const isPrivateZone = trustZone === "private_self";
  const isInternalBoundary = dataBoundary === "internal_only" || dataBoundary === "local_machine" || dataBoundary === "private_lan";
  const isLocal = Boolean(isLocalBackend) || String(env("DIZZY_CHAT_BACKEND", "")).trim().toLowerCase() === "local";

  const isLocalIsolationRequired = isLocal || isPrivateZone || isInternalBoundary;

  return {
    isLocalIsolationRequired,
    allowCloudFallback: !isLocalIsolationRequired,
    blockedReason: isLocalIsolationRequired ? "local_offline_cloud_blocked" : "",
  };
}

export function getDivisionForRole(roleKey) {
  const r = String(roleKey || "").trim().toLowerCase();
  for (const [divKey, divInfo] of Object.entries(EIGHT_DIVISIONS_ROSTER)) {
    if (divInfo.roles[r] || divInfo.roles[roleKey]) {
      return {
        division_key: divKey,
        division_name: divInfo.name,
        role_key: roleKey,
        role_info: divInfo.roles[r] || divInfo.roles[roleKey],
      };
    }
  }
  return null;
}

export function resolveDivisionModelRoute(roleKey, options = {}) {
  const divMatch = getDivisionForRole(roleKey);
  if (!divMatch) {
    // Fallback to legacy chat/utility route
    const legacyRoute = getModelRoute(roleKey);
    return {
      ok: false,
      role: roleKey,
      division: "DIV_VII",
      primary_model: "gemma3:4b",
      fallbacks: ["qwen2.5-coder:7b"],
      backend: legacyRoute.backend || "openai_compat",
      data_boundary: "local_machine",
    };
  }

  const roleInfo = divMatch.role_info;
  const primaryModel = roleInfo.primary;
  const fallbacks = roleInfo.fallbacks || [];

  let backend = "openai_compat";
  let dataBoundary = "openai_compatible_api";

  if (primaryModel.includes("gemini")) {
    backend = "gemini";
    dataBoundary = "google_gemini_api";
  } else if (primaryModel.includes(":latest") || primaryModel.includes(":4b") || primaryModel.includes(":7b") || primaryModel.includes(":12b")) {
    backend = "ollama";
    dataBoundary = "local_machine";
  } else if (["aider", "dspy", "swe-agent", "openhands", "promptfoo"].includes(primaryModel.toLowerCase())) {
    backend = "framework";
    dataBoundary = "local_machine";
  }

  return {
    ok: true,
    role: divMatch.role_key,
    division_key: divMatch.division_key,
    division_name: divMatch.division_name,
    primary_model: primaryModel,
    fallbacks,
    description: roleInfo.description,
    backend,
    data_boundary: dataBoundary,
  };
}

export function getModelRoute(role = "chat") {
  const r = String(role || "chat").trim().toLowerCase();

  // Check if role is an 8-Division specialized role
  const divMatch = getDivisionForRole(r);
  if (divMatch) {
    const route = resolveDivisionModelRoute(r);
    return {
      role: r,
      division: divMatch.division_key,
      backend: route.backend,
      primary_model: route.primary_model,
      reason: `division:${divMatch.division_key}`,
      log: `${r}:${route.backend}:division:${divMatch.division_key}`,
    };
  }

  const normalizedRole = r === "utility" ? "utility" : "chat";
  if (String(env("DIZZY_CHAT_BACKEND", "")).trim().toLowerCase() === "local") {
    return {
      role: normalizedRole,
      backend: "openai_compat",
      reason: "local_backend_mapped_to_ollama",
      log: `${normalizedRole}:openai_compat:local_backend_mapped_to_ollama`,
    };
  }

  const chatBackend = normalizeBackend(env("DIZZY_CHAT_BACKEND", ""));
  const utilityBackend = normalizeBackend(env("DIZZY_UTILITY_BACKEND", "")) || chatBackend;
  const backend = normalizedRole === "utility" ? utilityBackend : chatBackend;
  const reason = normalizedRole === "utility"
    ? (utilityBackend === chatBackend ? "utility_uses_chat_backend" : "utility_backend_override")
    : "chat_backend";

  return {
    role: normalizedRole,
    backend,
    reason: `cloud:${reason}`,
    log: `${normalizedRole}:${backend || "none"}:cloud:${reason}`,
  };
}

export function getOpenAICompatModelForRoute(route) {
  if (route?.primary_model) return route.primary_model;
  if (route?.role === "utility") {
    return String(env("DIZZY_UTILITY_OPENAI_COMPAT_MODEL", env("OPENAI_COMPAT_MODEL", ""))).trim();
  }
  return String(env("OPENAI_COMPAT_MODEL", "")).trim();
}

export function getGeminiModelForRoute(route) {
  if (route?.primary_model && route.primary_model.includes("gemini")) return route.primary_model;
  if (route?.role === "utility") {
    return String(env("DIZZY_UTILITY_GEMINI_MODEL", env("GEMINI_MODEL", "gemini-1.5-flash"))).trim();
  }
  return String(env("GEMINI_MODEL", "gemini-1.5-flash")).trim();
}

export function getChosenModelString(role = "chat") {
  const route = getModelRoute(role);
  if (route.primary_model) return `${route.backend}:${route.primary_model}`;
  if (String(env("DIZZY_CHAT_BACKEND", "")).trim().toLowerCase() === "local") {
    const localModel = String(env("OLLAMA_MODEL", "gemma3:4b")).trim();
    return `openai_compat:${localModel}`;
  }
  if (!route.backend) return "none:chat_backend_not_configured";
  if (route.backend === "gemini") {
    return `gemini:${getGeminiModelForRoute(route)}`;
  }
  if (route.backend === "openai_compat") {
    const baseUrl = String(env("DIZZY_CHAT_BACKEND", "")).trim().toLowerCase() === "local"
      ? env("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1")
      : env("OPENAI_COMPAT_BASE_URL", "");
    const model = normalizeOpenAICompatModelForBaseUrl({
      baseUrl,
      model: getOpenAICompatModelForRoute(route),
      localFallbackModel: env("OLLAMA_MODEL", "gemma3:4b"),
    });
    return `openai_compat:${model}`;
  }
  return "unknown:default";
}

export function getAllDivisions() {
  return EIGHT_DIVISIONS_ROSTER;
}

export function getAllRoles() {
  const allRoles = {};
  for (const divInfo of Object.values(EIGHT_DIVISIONS_ROSTER)) {
    Object.assign(allRoles, divInfo.roles);
  }
  return allRoles;
}
