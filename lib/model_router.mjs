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
