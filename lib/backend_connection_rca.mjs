import {
  isLoopbackHost,
  isPrivateLanHost,
  isRemoteCloudBackend,
} from "./model_router.mjs";
import {
  redactReviewLoopText,
  summarizeHarnessOutput,
} from "./review_cycle_runner.mjs";

export const BACKEND_CONNECTION_RCA_SCHEMA = "dizzy.backend_connection_rca.v1";
export const BACKEND_CONNECTION_RCA_AUTHORITY = "diagnostic_evidence_not_authority";

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function safeString(value = "") {
  return redactReviewLoopText(String(value ?? ""));
}

function errorText(error) {
  if (!error) return "";
  if (typeof error === "string") return safeString(error);
  const parts = [
    error.name,
    error.code,
    error.status || error.statusCode,
    error.message,
    error.cause?.code,
    error.cause?.message,
  ].filter(Boolean);
  return safeString(parts.join(" "));
}

export function safeBaseUrlHost(baseUrl = "") {
  try {
    return new URL(String(baseUrl || "").trim()).host;
  } catch {
    return "";
  }
}

function hostInfo(baseUrl = "") {
  try {
    const url = new URL(String(baseUrl || "").trim());
    const host = url.hostname;
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    return {
      ok: true,
      host,
      port,
      origin: url.origin,
      is_loopback: isLoopbackHost(host),
      is_private_lan: isPrivateLanHost(host),
    };
  } catch {
    return {
      ok: false,
      host: "",
      port: "",
      origin: "",
      is_loopback: false,
      is_private_lan: false,
    };
  }
}

function hasHttpStatus(text = "") {
  return /\b(?:HTTP\s*)?[45]\d\d\b|status(?:Code)?\s*[:=]\s*[45]\d\d/i.test(text);
}

function likelyHttpStatus(text = "") {
  const match = String(text || "").match(/\b(?:HTTP\s*)?([45]\d\d)\b|status(?:Code)?\s*[:=]\s*([45]\d\d)/i);
  return match ? (match[1] || match[2] || "") : "";
}

function classifyRootCause({ backend, baseUrl, allowCloud, isLocalIsolationRequired, probes, text }) {
  const info = hostInfo(baseUrl);
  const backendName = String(backend || "").trim().toLowerCase();
  const combined = safeString([
    text,
    probes?.logEvidence,
    probes?.stderr,
    probes?.stdout,
  ].filter(Boolean).join("\n"));
  const remote = baseUrl
    ? isRemoteCloudBackend(backendName === "ollama" ? "openai_compat" : backendName, baseUrl)
    : (backendName === "gemini" || backendName === "openai_compat");
  const localTarget = Boolean(info.is_loopback || info.is_private_lan || backendName === "ollama" || (isLocalIsolationRequired && !remote));

  if (!String(baseUrl || "").trim() && (backendName === "openai_compat" || backendName === "ollama" || backendName === "gemini")) {
    return "missing_base_url";
  }
  if (remote && !allowCloud) {
    return "cloud_blocked_by_policy";
  }
  if (/failed to create server log|failed to remove older logs|access is denied/i.test(combined) && /ollama|app\.log|server\.log/i.test(combined)) {
    return "ollama_log_permission_denied";
  }
  if (/\b401\b|\b403\b|unauthorized|forbidden|api[_ -]?key|invalid key|authentication/i.test(combined)) {
    return "auth_missing_or_invalid";
  }
  if (/AbortError|ETIMEDOUT|TIMEOUT|timed out|timeout/i.test(combined)) {
    return "local_backend_timeout";
  }
  if (localTarget && (
    probes?.tcpReachable === false ||
    probes?.httpReachable === false ||
    /ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|fetch failed|Unable to connect|connect/i.test(combined)
  )) {
    return "local_backend_unreachable";
  }
  if (hasHttpStatus(combined)) {
    return "provider_http_error";
  }
  return "unknown_connection_failure";
}

function nextActionsFor(rootCause) {
  switch (rootCause) {
    case "missing_base_url":
      return [
        "Set the backend base URL explicitly before executing reviewer models.",
        "For Ollama, verify OLLAMA_BASE_URL points at the local /v1 endpoint.",
      ];
    case "cloud_blocked_by_policy":
      return [
        "Keep the review skipped unless Simul explicitly approves cloud execution.",
        "Use a local reviewer or rerun after an explicit cost and trust-zone gate.",
      ];
    case "ollama_log_permission_denied":
      return [
        "Close stale Ollama processes and inspect the Ollama log directory permissions.",
        "Repair or clear the locked log files, then restart Ollama and probe /api/tags.",
      ];
    case "auth_missing_or_invalid":
      return [
        "Check the configured API key in the local environment without logging it.",
        "Retry with a minimal non-sensitive prompt after the key path is confirmed.",
      ];
    case "local_backend_timeout":
      return [
        "Check whether the local model is still loading or overloaded.",
        "Reduce reviewer concurrency or raise the local timeout for large models.",
      ];
    case "local_backend_unreachable":
      return [
        "Start the local backend and verify the expected host and port are listening.",
        "Probe the backend health endpoint before counting the reviewer as available.",
      ];
    case "provider_http_error":
      return [
        "Inspect the provider status code and response body after redaction.",
        "Confirm the model slug, account access, and endpoint path.",
      ];
    default:
      return [
        "Capture the exact command, endpoint host, stderr tail, and process state.",
        "Add a narrower classifier once the repeated failure signature is known.",
      ];
  }
}

export function classifyConnectionFailure({
  error = "",
  baseUrl = "",
  backend = "",
  model = "",
  trustZone = "private_self",
  allowCloud = false,
  isLocalIsolationRequired = false,
  probes = {},
  now = new Date(),
} = {}) {
  const info = hostInfo(baseUrl);
  const text = errorText(error);
  const likelyRootCause = classifyRootCause({
    backend,
    baseUrl,
    allowCloud,
    isLocalIsolationRequired,
    probes,
    text,
  });
  const evidence = [
    `backend=${safeString(backend || "unknown")}`,
    `base_url_host=${safeBaseUrlHost(baseUrl) || "missing"}`,
    `model=${safeString(model || "unknown")}`,
    `trust_zone=${safeString(trustZone || "unknown")}`,
    `allow_cloud=${Boolean(allowCloud)}`,
  ];
  if (text) evidence.push(`error=${summarizeHarnessOutput(text, 700)}`);
  if (Object.prototype.hasOwnProperty.call(probes, "tcpReachable")) evidence.push(`tcp_reachable=${Boolean(probes.tcpReachable)}`);
  if (Object.prototype.hasOwnProperty.call(probes, "httpReachable")) evidence.push(`http_reachable=${Boolean(probes.httpReachable)}`);
  if (Object.prototype.hasOwnProperty.call(probes, "processObserved")) evidence.push(`process_observed=${Boolean(probes.processObserved)}`);
  if (probes?.httpStatus) evidence.push(`http_status=${safeString(probes.httpStatus)}`);
  if (probes?.tcpError) evidence.push(`tcp_error=${summarizeHarnessOutput(probes.tcpError, 240)}`);
  if (probes?.httpError) evidence.push(`http_error=${summarizeHarnessOutput(probes.httpError, 240)}`);
  if (probes?.logEvidence) evidence.push(`log_evidence=${summarizeHarnessOutput(probes.logEvidence, 700)}`);

  return {
    schema_version: BACKEND_CONNECTION_RCA_SCHEMA,
    created_at: nowIso(now),
    backend: safeString(backend || "unknown").slice(0, 80),
    base_url_host: safeBaseUrlHost(baseUrl),
    base_url_origin: info.origin,
    model: safeString(model || "").slice(0, 160),
    trust_zone: safeString(trustZone || "unknown").slice(0, 80),
    allow_cloud: Boolean(allowCloud),
    status: "diagnosed",
    likely_root_cause: likelyRootCause,
    http_status: likelyHttpStatus(text),
    host_classification: {
      is_loopback: info.is_loopback,
      is_private_lan: info.is_private_lan,
      is_local_isolation_required: Boolean(isLocalIsolationRequired),
    },
    evidence,
    next_actions: nextActionsFor(likelyRootCause),
    authority: BACKEND_CONNECTION_RCA_AUTHORITY,
  };
}
