import { getHardwareState } from "./hardware_monitor.mjs";

const LOCAL_MODEL_VRAM_REQUIREMENTS_GB = {
  "full-power": 16,
  "speculative-decoding": 10,
  "quantized-mistral": 4,
};

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

export function getModelRoute(role = "chat") {
  const hardwareState = getHardwareState();
  const { free_memory_gb } = hardwareState;

  const chatBackendVal = env("DIZZY_CHAT_BACKEND", "");
  const useLocal = chatBackendVal === "local" || chatBackendVal === "";

  // Prioritize local models if hardware allows
  if (useLocal && free_memory_gb >= LOCAL_MODEL_VRAM_REQUIREMENTS_GB["full-power"]) {
    return { role, backend: "local", reason: "local:full-power", log: `${role}:local:full-power` };
  }
  if (useLocal && free_memory_gb >= LOCAL_MODEL_VRAM_REQUIREMENTS_GB["speculative-decoding"]) {
    return { role, backend: "local", reason: "local:speculative-decoding", log: `${role}:local:speculative-decoding` };
  }
  if (useLocal && free_memory_gb >= LOCAL_MODEL_VRAM_REQUIREMENTS_GB["quantized-mistral"]) {
    return { role, backend: "local", reason: "local:quantized-mistral", log: `${role}:local:quantized-mistral` };
  }

  // Fallback to cloud API routing
  const r = String(role || "chat").trim().toLowerCase();
  const chatBackend = normalizeBackend(env("DIZZY_CHAT_BACKEND", ""));
  const utilityBackend = normalizeBackend(env("DIZZY_UTILITY_BACKEND", "")) || chatBackend;
  const backend = r === "utility" ? utilityBackend : chatBackend;
  const reason = r === "utility"
    ? (utilityBackend === chatBackend ? "utility_uses_chat_backend" : "utility_backend_override")
    : "chat_backend";

  return {
    role: r === "utility" ? "utility" : "chat",
    backend,
    reason: `cloud:${reason}`,
    log: `${r === "utility" ? "utility" : "chat"}:${backend || "none"}:cloud:${reason}`,
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

