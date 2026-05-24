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
    reason,
    log: `${r === "utility" ? "utility" : "chat"}:${backend || "none"}:${reason}`,
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

