import crypto from "crypto";
import path from "path";
import { durableAppendJsonl, redactSecretMaterial } from "./durable_write_policy.mjs";

export const LIFECYCLE_HOOK_SCHEMA_VERSION = "dizzy.lifecycle_hook.v1";

const DEFAULT_TOOL_ALLOWLIST = Object.freeze([
  "http_get",
  "cheerio_extract",
  "read_contract",
]);

const BLOCKED_TOOL_NAME_RE = /\b(shell|bash|powershell|cmd|cookie|cookies|chrome|browser_session|credential|credentials|secret|token_dump)\b/i;
const SENSITIVE_PAYLOAD_KEY_RE = /(^|_|\b)(authorization|cookie|cookies|credential|credentials|password|passwd|secret|session|token|api_?key|apikey)($|_|\b)/i;
const SECRET_VALUE_RE = /\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|glpat-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/-]{8,}={0,2})\b/i;

function parseBoolValue(value, fallback = true) {
  const raw = String(value ?? (fallback ? "1" : "0")).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function stableNormalize(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return null;
  if (depth > 12) return "[DEPTH_LIMIT]";
  if (typeof value === "string") return redactSecretMaterial(value).slice(0, 4096);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((item) => stableNormalize(item, depth + 1, seen));
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CYCLE]";
  seen.add(value);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const normalizedKey = String(key);
    if (SENSITIVE_PAYLOAD_KEY_RE.test(normalizedKey)) {
      out[normalizedKey] = "[REDACTED_KEY]";
    } else {
      out[normalizedKey] = stableNormalize(value[key], depth + 1, seen);
    }
  }
  seen.delete(value);
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableNormalize(value));
}

function hashPayload(value) {
  return sha256(stableStringify(value));
}

function routePath(reqOrRoute) {
  if (typeof reqOrRoute === "string") {
    try {
      return new URL(reqOrRoute, "http://local.invalid").pathname || "/";
    } catch {
      return String(reqOrRoute || "").split("?")[0] || "/";
    }
  }
  return String(reqOrRoute?.path || reqOrRoute?.route || reqOrRoute?.originalUrl || "").split("?")[0] || "/";
}

function nowParts(nowFn) {
  const raw = nowFn();
  const ms = raw instanceof Date ? raw.getTime() : Number(raw);
  const safeMs = Number.isFinite(ms) ? ms : Date.now();
  return { now_ms: safeMs, t: new Date(safeMs).toISOString() };
}

function payloadHasSensitiveMaterial(value, key = "", depth = 0, seen = new WeakSet()) {
  if (key && SENSITIVE_PAYLOAD_KEY_RE.test(key)) return true;
  if (value === null || value === undefined || depth > 10) return false;
  if (typeof value === "string") return SECRET_VALUE_RE.test(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value);
  return entries.some(([childKey, childValue]) => payloadHasSensitiveMaterial(childValue, childKey, depth + 1, seen));
}

function inspectToolJob(job = {}, allowlist = DEFAULT_TOOL_ALLOWLIST) {
  const type = String(job.type || "tool").trim().toLowerCase();
  const tool = String(job.tool || "").trim();
  if (type && type !== "tool") return { allowed: false, reason: "invalid_job_type", tool };
  if (!tool) return { allowed: false, reason: "missing_tool", tool };
  if (BLOCKED_TOOL_NAME_RE.test(tool)) return { allowed: false, reason: "blocked_tool_name", tool };
  if (!allowlist.has(tool)) return { allowed: false, reason: "tool_not_allowlisted", tool };
  if (payloadHasSensitiveMaterial(job.payload || {})) return { allowed: false, reason: "sensitive_payload_material", tool };
  return { allowed: true, reason: "allowed", tool };
}

export class LifecycleHookError extends Error {
  constructor(code, message, receipt = null) {
    super(message);
    this.name = "LifecycleHookError";
    this.code = code;
    this.receipt = receipt;
  }
}

export function createLifecycleHookManager(opts = {}) {
  const enabled = opts.enabled !== undefined
    ? Boolean(opts.enabled)
    : parseBoolValue(process.env.DIZZY_LIFECYCLE_HOOKS_ENABLED, true);
  const receiptPath = path.resolve(
    process.cwd(),
    opts.receiptPath || process.env.DIZZY_LIFECYCLE_RECEIPT_PATH || "runtime/lifecycle_hooks.jsonl",
  );
  const nowFn = typeof opts.nowFn === "function" ? opts.nowFn : () => Date.now();
  const writer = typeof opts.writer === "function" ? opts.writer : (receipt) => durableAppendJsonl(receiptPath, receipt);
  const toolAllowlist = new Set(opts.allowedTools || DEFAULT_TOOL_ALLOWLIST);
  let previousReceiptSha256 = "";
  let receiptCounter = 0;

  function emit(input = {}) {
    if (!enabled) return null;
    const { now_ms, t } = nowParts(nowFn);
    const startedAtMs = Number(input.started_at_ms);
    const durationMs = Number.isFinite(startedAtMs) ? Math.max(0, now_ms - startedAtMs) : 0;
    const base = {
      schema_version: LIFECYCLE_HOOK_SCHEMA_VERSION,
      phase: String(input.phase || "UNKNOWN").trim().toUpperCase(),
      hook_id: `hook_${now_ms}_${receiptCounter += 1}`,
      t,
      session_id: String(input.session_id || "").trim().slice(0, 160) || `session_${now_ms}`,
      actor_id: String(input.actor_id || "node_runtime").trim().slice(0, 160),
      route: routePath(input.route || input.req || ""),
      method: String(input.method || input.req?.method || "").trim().toUpperCase(),
      tool: String(input.tool || "").trim(),
      job_id: String(input.job_id || "").trim().slice(0, 160),
      effect: String(input.effect || "").trim().toUpperCase(),
      decision: String(input.decision || "allowed").trim().toLowerCase(),
      outcome: String(input.outcome || "").trim().toLowerCase(),
      status_code: Number.isFinite(Number(input.status_code)) ? Number(input.status_code) : null,
      error_code: redactSecretMaterial(String(input.error_code || "")).slice(0, 160),
      reason: redactSecretMaterial(String(input.reason || "")).slice(0, 240),
      duration_ms: durationMs,
      input_sha256: input.input_sha256 || "",
      output_sha256: input.output_sha256 || "",
      previous_receipt_sha256: previousReceiptSha256,
    };
    const receiptSha256 = sha256(stableStringify(base));
    const receipt = { ...base, receipt_sha256: receiptSha256 };
    writer(receipt);
    previousReceiptSha256 = receiptSha256;
    return receipt;
  }

  function sessionStart(ctx = {}) {
    return emit({
      ...ctx,
      phase: "SESSION_START",
      actor_id: ctx.actor_id || "ingress_gateway",
      input_sha256: ctx.input_sha256 || hashPayload({
        route: routePath(ctx.req || ctx.route || ""),
        method: ctx.method || ctx.req?.method || "",
        trust_zone: ctx.trust_zone || ctx.req?.body?.runtime_context?.trust_zone || "unclassified",
      }),
    });
  }

  function stop(ctx = {}) {
    return emit({
      ...ctx,
      phase: "STOP",
      actor_id: ctx.actor_id || "ingress_gateway",
      output_sha256: ctx.output_sha256 || hashPayload({
        route: routePath(ctx.req || ctx.route || ""),
        status_code: ctx.status_code ?? ctx.res?.statusCode ?? null,
        outcome: ctx.outcome || "completed",
      }),
    });
  }

  function preToolUse(ctx = {}) {
    const job = ctx.job || {};
    const inspection = inspectToolJob(job, toolAllowlist);
    const receipt = emit({
      ...ctx,
      phase: "PRE_TOOL_USE",
      actor_id: ctx.actor_id || "tool_runner",
      tool: inspection.tool,
      job_id: job.id || ctx.job_id || "",
      effect: job.effect || ctx.effect || "",
      decision: inspection.allowed ? "allowed" : "rejected",
      reason: inspection.reason,
      input_sha256: hashPayload({
        type: job.type || "tool",
        tool: inspection.tool,
        effect: job.effect || "",
        payload: job.payload || {},
      }),
    });
    if (!inspection.allowed) {
      throw new LifecycleHookError(
        "LIFECYCLE_PRE_TOOL_REJECTED",
        `pre-tool hook rejected ${inspection.tool || "tool"}: ${inspection.reason}`,
        receipt,
      );
    }
    return receipt;
  }

  function postToolUse(ctx = {}) {
    const error = ctx.error || null;
    return emit({
      ...ctx,
      phase: "POST_TOOL_USE",
      actor_id: ctx.actor_id || "tool_runner",
      tool: ctx.tool || ctx.job?.tool || "",
      job_id: ctx.job?.id || ctx.job_id || "",
      effect: ctx.job?.effect || ctx.effect || "",
      outcome: error ? "failed" : "succeeded",
      error_code: error?.code || error?.name || "",
      reason: error ? String(error?.message || error) : "completed",
      output_sha256: hashPayload(error ? { error: error?.code || error?.name || "error" } : (ctx.result || {})),
      started_at_ms: ctx.started_at_ms,
    });
  }

  return {
    enabled,
    receiptPath,
    sessionStart,
    stop,
    preToolUse,
    postToolUse,
  };
}

export async function runWithToolLifecycle(job, runner, opts = {}) {
  const hooks = opts.lifecycleHooks || createLifecycleHookManager();
  const actorId = opts.actorId || "tool_runner";
  const sessionId = opts.sessionId || `tool_${job?.id || "inline"}`;
  const startedAtMs = Date.now();
  hooks.preToolUse({ job, actor_id: actorId, session_id: sessionId });
  try {
    const result = await runner(job);
    hooks.postToolUse({ job, result, actor_id: actorId, session_id: sessionId, started_at_ms: startedAtMs });
    return result;
  } catch (error) {
    hooks.postToolUse({ job, error, actor_id: actorId, session_id: sessionId, started_at_ms: startedAtMs });
    throw error;
  }
}
