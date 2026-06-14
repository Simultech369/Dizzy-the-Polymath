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
    deploymentMode: String(env("DIZZY_DEPLOYMENT_MODE", "direct_local")).trim().toLowerCase(),
    publicSurfaceMode: String(env("DIZZY_PUBLIC_SURFACES", "closed")).trim().toLowerCase(),
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
  const deploymentMode = String(config.deploymentMode || "direct_local").trim().toLowerCase();
  const publicSurfaceMode = String(config.publicSurfaceMode || "closed").trim().toLowerCase();

  if (!["", "auto", "inline", "queue"].includes(config.toolMode)) {
    errors.push(`Invalid DIZZY_TOOL_MODE='${config.toolMode}'. Use auto, inline, or queue.`);
  }

  if (!["", "gemini", "openai_compat", "openrouter"].includes(config.chatBackend)) {
    errors.push(`Invalid DIZZY_CHAT_BACKEND='${config.chatBackend}'. Use gemini or openai_compat.`);
  }

  if (!["direct_local", "proxied", "hosted"].includes(deploymentMode)) {
    errors.push(`Invalid DIZZY_DEPLOYMENT_MODE='${deploymentMode}'. Use direct_local, proxied, or hosted.`);
  }

  if (!["closed", "discovery"].includes(publicSurfaceMode)) {
    errors.push(`Invalid DIZZY_PUBLIC_SURFACES='${publicSurfaceMode}'. Use closed or discovery.`);
  }

  if (deploymentMode === "direct_local" && !isLoopbackHost(config.bindHost)) {
    errors.push("DIZZY_DEPLOYMENT_MODE=direct_local requires a loopback DIZZY_BIND_HOST.");
  }

  if (["proxied", "hosted"].includes(deploymentMode) && !config.authTokenConfigured) {
    errors.push(`DIZZY_AUTH_TOKEN is required when DIZZY_DEPLOYMENT_MODE=${deploymentMode}.`);
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

  if (publicSurfaceMode === "discovery") {
    warnings.push("Anonymous discovery surfaces are enabled.");
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
