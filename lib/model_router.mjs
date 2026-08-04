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

export function getModelRoute(role = "chat") {
  const r = String(role || "chat").trim().toLowerCase();
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
  if (route?.role === "utility") {
    return String(env("DIZZY_UTILITY_OPENAI_COMPAT_MODEL", env("OPENAI_COMPAT_MODEL", ""))).trim();
  }
  return String(env("OPENAI_COMPAT_MODEL", "")).trim();
}

export function getGeminiModelForRoute(route) {
  if (route?.role === "utility") {
    return String(env("DIZZY_UTILITY_GEMINI_MODEL", env("GEMINI_MODEL", "gemini-1.5-flash"))).trim();
  }
  return String(env("GEMINI_MODEL", "gemini-1.5-flash")).trim();
}

export function getChosenModelString(role = "chat") {
  const route = getModelRoute(role);
  if (String(env("DIZZY_CHAT_BACKEND", "")).trim().toLowerCase() === "local") {
    const localModel = String(env("OLLAMA_MODEL", "gemma3:4b")).trim();
    return `openai_compat:${localModel}`;
  }
  if (!route.backend) return "none:chat_backend_not_configured";
  if (route.backend === "gemini") {
    return `gemini:${getGeminiModelForRoute(route)}`;
  }
  if (route.backend === "openai_compat") {
    return `openai_compat:${getOpenAICompatModelForRoute(route)}`;
  }
  return "unknown:default";
}
