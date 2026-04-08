function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function parseBool(name, fallback = false) {
  const raw = String(env(name, fallback ? "1" : "0")).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function normalizeHost(host) {
  return String(host || "").trim().toLowerCase();
}

export function isLoopbackHost(host) {
  const h = normalizeHost(host);
  return h === "127.0.0.1" || h === "localhost" || h === "::1";
}

export function getRuntimeSafetyConfig() {
  return {
    bindHost: String(env("DIZZY_BIND_HOST", "127.0.0.1")),
    authTokenConfigured: String(env("DIZZY_AUTH_TOKEN", "")).trim().length > 0,
    chatBackend: String(env("DIZZY_CHAT_BACKEND", "")).trim().toLowerCase(),
    toolMode: String(env("DIZZY_TOOL_MODE", "auto")).trim().toLowerCase(),
    allowRemoteMutations: parseBool("DIZZY_ALLOW_REMOTE_MUTATIONS", false),
    allowSelfModify: parseBool("DIZZY_ALLOW_SELF_MODIFY", false),
    telegramStartupMessage: parseBool("TELEGRAM_SEND_STARTUP_MESSAGE", false),
  };
}

export function validateRuntimeSafetyConfig(config = getRuntimeSafetyConfig()) {
  const errors = [];
  const warnings = [];

  if (!["", "auto", "inline", "queue"].includes(config.toolMode)) {
    errors.push(`Invalid DIZZY_TOOL_MODE='${config.toolMode}'. Use auto, inline, or queue.`);
  }

  if (!["", "gemini", "openai_compat", "openrouter"].includes(config.chatBackend)) {
    errors.push(`Invalid DIZZY_CHAT_BACKEND='${config.chatBackend}'. Use gemini or openai_compat.`);
  }

  if (!isLoopbackHost(config.bindHost) && !config.authTokenConfigured) {
    errors.push("DIZZY_AUTH_TOKEN is required when DIZZY_BIND_HOST is not loopback.");
  }

  if (config.allowRemoteMutations) {
    warnings.push("Remote file-mutating chat commands are enabled.");
  }

  if (config.allowSelfModify) {
    warnings.push("Self-modification commands are enabled.");
  }

  if (config.telegramStartupMessage) {
    warnings.push("Telegram relay startup messages are enabled.");
  }

  return { errors, warnings };
}

export function assertRuntimeSafetyConfig(config = getRuntimeSafetyConfig()) {
  const result = validateRuntimeSafetyConfig(config);
  if (result.errors.length) {
    throw new Error(result.errors.join(" "));
  }
  return result;
}
