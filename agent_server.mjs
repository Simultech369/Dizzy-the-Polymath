import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import { acknowledgeNotifications, connectRedis, enqueueJob, getJob, makeQueueKeys } from "./lib/queue.mjs";
import { buildCapabilityReceipt, getTrustZoneCapabilities, handleIncomingMessage } from "./lib/dispatch.mjs";
import { buildClientConversationKey, conversationPathForKey, deleteClientContinuity, executionHistoryPath, exportClientContinuity, pruneExpiredClientContinuity } from "./lib/client_continuity.mjs";
import { getCachedChatSystemPrompt } from "./lib/prompt_bundle.mjs";
import { getMemoryGraph, getRelevantMemoryGraphContext } from "./lib/memory_graph.mjs";
import { assertRuntimeSafetyConfig, getRuntimeSafetyConfig, isLoopbackHost } from "./lib/runtime_config.mjs";
import { durableAppendJsonl } from "./lib/durable_write_policy.mjs";
import { securityHeaders } from "./lib/security_headers.mjs";

function isMainModule() {
  try {
    const mainPath = process.argv?.[1] || "";
    return new URL(import.meta.url).pathname.endsWith(mainPath.replace(/\\/g, "/"));
  } catch {
    return false;
  }
}

function isLoopbackRemoteAddress(address) {
  const value = String(address ?? "").trim().toLowerCase();
  if (!value) return false;
  return value === "127.0.0.1"
    || value === "::1"
    || value === "::ffff:127.0.0.1";
}

function normalizeIp(ip) {
  if (!ip) return "";
  let s = String(ip).trim().toLowerCase();
  if (s.startsWith("::ffff:")) {
    s = s.substring(7);
  }
  if (s === "::1") return "127.0.0.1";
  if (s === "localhost") return "127.0.0.1";
  return s;
}

function tokensEqual(candidate, expected) {
  if (!candidate || !expected) return false;
  const left = Buffer.from(String(candidate));
  const right = Buffer.from(String(expected));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const DASHBOARD_SESSION_COOKIE = "dizzy_dashboard_session";

function readCookie(req, name) {
  const raw = String(req.headers?.cookie || "");
  for (const pair of raw.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return "";
}

function isDashboardRoute(pathname) {
  return pathname === "/dashboard"
    || pathname === "/dashboard/login"
    || pathname === "/dashboard/session"
    || pathname === "/dashboard/logout"
    || pathname === "/assets/dashboard.js"
    || pathname === "/assets/dashboard-login.js"
    || pathname === "/api/dashboard-data"
    || pathname === "/api/dashboard-query"
    || pathname === "/api/operator-continuity"
    || pathname === "/api/operator-continuity/export"
    || pathname === "/api/operator-continuity/audit"
    || pathname === "/api/operator-continuity/delete"
    || pathname.startsWith("/api/operator/")
    || pathname === "/api/operator-execute";
}

function parseBool(value, fallback = false) {
  const raw = String(value ?? (fallback ? "1" : "0")).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function registerDashboardFallbackRoutes(app, { enabled } = {}) {
  for (const route of ["/dashboard", "/assets/dashboard.js", "/assets/dashboard-login.js", "/api/dashboard-data", "/api/dashboard-query", "/api/operator-continuity", "/api/operator-continuity/export", "/api/operator-continuity/audit"]) {
    app.get(route, (req, res) => {
      if (!enabled) return res.status(404).json({ ok: false, error: "Dashboard disabled" });
      return res.status(503).json({
        ok: false,
        error: "Dashboard unavailable",
      });
    });
  }
  app.get("/dashboard/login", (req, res) => {
    if (!enabled) return res.status(404).json({ ok: false, error: "Dashboard disabled" });
    return res.status(503).json({ ok: false, error: "Dashboard unavailable" });
  });
  for (const route of ["/dashboard/session", "/dashboard/logout"]) {
    app.post(route, (req, res) => {
      if (!enabled) return res.status(404).json({ ok: false, error: "Dashboard disabled" });
      return res.status(503).json({ ok: false, error: "Dashboard unavailable" });
    });
  }
  for (const route of ["/api/operator-execute", "/api/operator-continuity/delete"]) {
    app.post(route, (req, res) => {
      if (!enabled) return res.status(404).json({ ok: false, error: "Dashboard disabled" });
      return res.status(503).json({ ok: false, error: "Dashboard unavailable" });
    });
  }
}

function getRateLimitConfig(opts = {}) {
  const enabled = opts.rateLimitEnabled !== undefined
    ? Boolean(opts.rateLimitEnabled)
    : parseBool(process.env.DIZZY_RATE_LIMIT_ENABLED, false);
  return {
    enabled,
    windowMs: parsePositiveInt(opts.rateLimitWindowMs ?? process.env.DIZZY_RATE_LIMIT_WINDOW_MS, 60000),
    max: parsePositiveInt(opts.rateLimitMax ?? process.env.DIZZY_RATE_LIMIT_MAX, 120),
  };
}

export function pruneExpiredRateLimitBuckets(buckets, now = Date.now()) {
  let removed = 0;
  for (const [key, bucket] of buckets.entries()) {
    if (!bucket || Number(bucket.resetAt) <= now) {
      buckets.delete(key);
      removed += 1;
    }
  }
  return removed;
}

function forwardedClientIp(req, trustedProxies = []) {
  const forwardedFor = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map(normalizeIp)
    .filter(Boolean);
  for (let i = forwardedFor.length - 1; i >= 0; i -= 1) {
    if (!trustedProxies.includes(forwardedFor[i])) return forwardedFor[i];
  }
  if (forwardedFor.length > 0) return forwardedFor[0];
  return normalizeIp(req.headers?.["x-real-ip"]);
}

function rateLimitClientKey(req, { deploymentMode, trustedProxies = [] } = {}) {
  const remote = normalizeIp(req.socket?.remoteAddress || req.ip);
  if (["proxied", "hosted"].includes(deploymentMode) && trustedProxies.includes(remote)) {
    return forwardedClientIp(req, trustedProxies) || remote || "unknown";
  }
  return remote || normalizeIp(req.ip) || "unknown";
}

function createRateLimitMiddleware(config, trust = {}) {
  const buckets = new Map();
  let nextPruneAt = 0;

  return function rateLimit(req, res, next) {
    if (!config.enabled || req.path === "/health") return next();

    const now = Date.now();
    if (now >= nextPruneAt) {
      pruneExpiredRateLimitBuckets(buckets, now);
      nextPruneAt = now + config.windowMs;
    }
    const key = rateLimitClientKey(req, trust);
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + config.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, config.max - bucket.count);
    const resetSeconds = Math.ceil(bucket.resetAt / 1000);
    res.setHeader("RateLimit-Limit", String(config.max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (bucket.count > config.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({
        ok: false,
        error: "Rate limit exceeded",
        retry_after_ms: Math.max(0, bucket.resetAt - now),
      });
    }

    return next();
  };
}

function normalizeAllowedOrigins(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  const origins = new Set();
  for (const raw of values) {
    const candidate = String(raw || "").trim();
    if (!candidate) continue;
    try {
      origins.add(new URL(candidate).origin.toLowerCase());
    } catch {
      // Invalid allowlist entries never widen browser access.
    }
  }
  return origins;
}

function createProxyExposureGuard({ authToken, deploymentMode, trustedProxies = [] }) {
  return function proxyExposureGuard(req, res, next) {
    const proxyHeaders = ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip"];
    const forwarded = proxyHeaders.some((name) => String(req.headers?.[name] ?? "").trim() !== "");
    if (forwarded && deploymentMode === "direct_local") {
      return res.status(403).json({
        ok: false,
        error: "Forwarded requests are disabled in direct_local mode",
      });
    }
    if (forwarded) {
      const remote = normalizeIp(req.socket?.remoteAddress || req.ip);
      if (trustedProxies.length === 0 || !trustedProxies.includes(remote)) {
        return res.status(403).json({ ok: false, error: "Forwarded request from untrusted proxy" });
      }
    }
    if (forwarded && !authToken) return res.status(403).json({ ok: false, error: "Forwarded requests require DIZZY_AUTH_TOKEN" });
    return next();
  };
}

function createBrowserOriginGuard({ bindHost, allowedOrigins }) {
  const allowlist = normalizeAllowedOrigins(allowedOrigins);
  const loopbackBinding = isLoopbackHost(bindHost);

  return function browserOriginGuard(req, res, next) {
    const rawOrigin = String(req.headers?.origin || "").trim();
    if (!rawOrigin) return next();

    let origin;
    try {
      origin = new URL(rawOrigin);
    } catch {
      return res.status(403).json({ ok: false, error: "Browser origin rejected" });
    }

    const normalizedOrigin = origin.origin.toLowerCase();
    const allowed = allowlist.has(normalizedOrigin)
      || (loopbackBinding && isLoopbackHost(origin.hostname));

    if (!allowed) {
      return res.status(403).json({ ok: false, error: "Browser origin rejected" });
    }
    return next();
  };
}

export function redactTextPayload(text) {
  if (!text) return "";
  let t = String(text);
  t = t.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED_EMAIL]");
  t = t.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[REDACTED_PHONE]");
  t = t.replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]");
  t = t.replace(/\b(\d{6,}):([A-Za-z0-9_-]{20,})\b/g, "[REDACTED_TELEGRAM_TOKEN]");
  t = t.replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[REDACTED_API_KEY]");
  t = t.replace(/\b([A-Z0-9_]{2,64}(?:API|TOKEN|SECRET|KEY)[A-Z0-9_]{0,64})=([^\s]{6,})\b/g, "$1=[REDACTED]");
  return t;
}

function redactAuditValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return "[REDACTED_DEPTH]";
  if (typeof value === "string") return redactTextPayload(value).slice(0, 1000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactAuditValue(item, depth + 1));
  if (typeof value !== "object") return String(value);

  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const k = String(key);
    const lower = k.toLowerCase();
    if (
      lower.includes("authorization")
      || lower.includes("cookie")
      || lower.includes("token")
      || lower.includes("secret")
      || lower.includes("password")
      || lower.includes("api_key")
      || lower.includes("apikey")
      || lower.includes("#private")
      || lower.includes("#private_self")
    ) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = redactAuditValue(raw, depth + 1);
  }
  return out;
}

function buildBoundaryViolationReceipt({ reason, req, zone }) {
  return {
    t: new Date().toISOString(),
    type: "boundary_violation",
    reason,
    zone,
    ip: req.socket?.remoteAddress,
    method: req.method,
    path: req.path,
    headers: redactAuditValue(req.headers),
    body: redactAuditValue(req.body),
  };
}

function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function projectPublicState(state) {
  const governance = state?.governance ?? {};
  const transparency = governance.transparency ?? {};
  const principles = governance.principles ?? {};
  const productKernel = state?.product_kernel ?? {};
  const constitutionalKernel = state?.constitutional_kernel ?? {};
  return {
    schema_version: state?.schema_version,
    updated_at: state?.updated_at,
    canonical_source: state?.canonical_source,
    docs: {
      primary: state?.docs?.primary,
      constitutional_kernel: state?.docs?.constitutional_kernel,
      constitutional_expansion: state?.docs?.constitutional_expansion,
    },
    governance: {
      anchors: cloneJsonValue(governance.anchors ?? []),
      transparency: {
        structural_transparency: Boolean(transparency.structural_transparency),
        operational_confidentiality: Boolean(transparency.operational_confidentiality),
        public_docs: cloneJsonValue(transparency.public_docs ?? []),
      },
      principles: {
        benkler: cloneJsonValue(principles.benkler ?? []),
        waldron: cloneJsonValue(principles.waldron ?? []),
      },
    },
    product_kernel: {
      value: productKernel.value,
      positive_primitives: cloneJsonValue(productKernel.positive_primitives ?? []),
      day_1: productKernel.day_1,
      week_2: productKernel.week_2,
      month_3: productKernel.month_3,
      acceptance_checks: cloneJsonValue(productKernel.acceptance_checks ?? []),
    },
    constitutional_kernel: {
      file: constitutionalKernel.file,
      expansion_file: constitutionalKernel.expansion_file,
      non_negotiables: cloneJsonValue(constitutionalKernel.non_negotiables ?? []),
    },
  };
}

export function loadStateConfig(zone) {
  const statePath = path.resolve(process.cwd(), "state.json");
  if (!fs.existsSync(statePath)) return {};
  const raw = fs.readFileSync(statePath, "utf8");
  const parsed = JSON.parse(raw);

  if (zone === "public") {
    return projectPublicState(parsed);
  }
  return parsed;
}

function requestBoundaryAuditGuard(req, res, next) {
  const text = String(req.body?.brief || req.body?.text || "").toLowerCase();
  const rawZone = req.headers?.["x-dizzy-zone"] || req.body?.zone || "public";
  const zone = rawZone === "private" ? "private" : "public";
  const isLocal = isLoopbackRemoteAddress(req.socket?.remoteAddress);

  let violation = false;
  let reason = "";

  if (zone === "private" && !isLocal) {
    violation = true;
    reason = "untrusted_host_claimed_private_zone";
  }

  // Phrase detection is defense-in-depth telemetry, not semantic authorization.
  // Trust-zone capability checks remain the boundary for retrieval and mutation.
  if (zone === "public" || !isLocal) {
    if (
      text.includes("override trust_zone") ||
      text.includes("system prompt override") ||
      text.includes("ignore boundaries") ||
      text.includes("trust_zone=private_self") ||
      text.includes("trust_zone: private_self") ||
      text.includes("#private")
    ) {
      violation = true;
      reason = "adversarial_prompt_injection_trust_zone_bypass";
    }
  }

  if (violation) {
    const receiptPath = path.resolve(process.cwd(), "runtime", "audit", "boundary_violations.jsonl");
    const receipt = buildBoundaryViolationReceipt({ reason, req, zone });
    durableAppendJsonl(receiptPath, receipt);
    return res.status(403).json({
      ok: false,
      error: "Boundary violation detected",
      receipt,
    });
  }

  if (zone === "public") {
    if (req.body?.brief) {
      req.body.brief = redactTextPayload(req.body.brief);
    }
    if (req.body?.text) {
      req.body.text = redactTextPayload(req.body.text);
    }
  }

  next();
}

function buildRuntimeContext(req) {
  return {
    trusted_local: isLoopbackRemoteAddress(req.socket?.remoteAddress),
    request_path: String(req.path || ""),
  };
}

function normalizeIdentifier(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function normalizeFreeText(value, maxChars = 20_000) {
  return String(value ?? "").trim().slice(0, Math.max(1, Number(maxChars) || 20_000));
}

function countJsonlRows(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    return raw ? raw.split(/\r?\n/).length : 0;
  } catch {
    return 0;
  }
}

function persistMissingExecuteTranscript({ conversationKey, beforeRows, brief, out }) {
  const conversationPath = conversationPathForKey(conversationKey);
  const rowsWritten = countJsonlRows(conversationPath) - beforeRows;
  const nowIso = new Date().toISOString();

  if (rowsWritten <= 0) {
    durableAppendJsonl(conversationPath, {
      t: nowIso,
      role: "user",
      text: redactTextPayload(normalizeFreeText(brief)),
      source: "agent_execute",
    });
  }

  if (rowsWritten < 2) {
    const replyText = normalizeFreeText(out?.text || (out?.kind ? `Result kind: ${out.kind}` : "No textual response."));
    durableAppendJsonl(conversationPath, {
      t: new Date().toISOString(),
      role: "assistant",
      text: redactTextPayload(replyText),
      source: "agent_execute",
    });
  }
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function normalizeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildExecuteConversationKey(body = {}) {
  const continuityMode = String(body?.continuity_mode ?? "").trim().toLowerCase();

  if (continuityMode === "client") {
    const key = buildClientConversationKey({ client_id: body?.client_id, service_id: body?.service_id });
    if (key) return key;
  }

  return `execute_req_${Date.now()}_${randomSuffix()}`;
}

function buildIncomingMessage(body, req, defaults = {}) {
  // HTTP normalization is an operator-safety boundary for machine-facing surfaces.
  // It exists to keep queue keys, logs, and transport payloads sane, not to shape voice.
  return {
    channel: normalizeIdentifier(body?.channel ?? defaults.channel ?? "local", defaults.channel ?? "local"),
    from: body?.from == null ? (defaults.from ?? null) : normalizeIdentifier(body?.from, "anon"),
    text: normalizeFreeText(
      body?.text ?? defaults.text ?? "",
      Math.max(1_000, Number(process.env.DIZZY_HTTP_MESSAGE_MAX_CHARS || 20_000) || 20_000),
    ),
    meta: normalizeMeta(body?.meta ?? defaults.meta ?? {}),
    runtime_context: {
      ...buildRuntimeContext(req),
      ...(defaults.runtime_context && typeof defaults.runtime_context === "object" ? defaults.runtime_context : {}),
    },
  };
}

function shapeJobForResponse(job) {
  const result = job.result_json ? JSON.parse(job.result_json) : null;
  const maxErrorChars = Math.max(200, Number(process.env.DIZZY_HTTP_JOB_ERROR_MAX_CHARS || 1000) || 1000);
  return {
    id: job.id,
    status: job.status,
    type: job.type,
    tool: job.tool,
    effect: job.effect,
    attempts: Number(job.attempts || "0"),
    max_attempts: Number(job.max_attempts || "0"),
    retry_count: Number(job.retry_count || "0"),
    max_retries: Number(job.max_retries || "0"),
    created_at_ms: job.created_at_ms,
    updated_at_ms: job.updated_at_ms,
    started_at_ms: job.started_at_ms,
    finished_at_ms: job.finished_at_ms,
    next_retry_at_ms: job.next_retry_at_ms,
    last_retry_reason: job.last_retry_reason,
    // Bound machine-surface payloads without altering assistant reply style.
    last_error: job.last_error ? String(job.last_error).slice(0, maxErrorChars) : "",
    dead_letter_path: job.dead_letter_path,
    result,
  };
}

export async function createRuntime(opts = {}) {
  const port = Number(opts.port ?? process.env.PORT ?? 3000);
  const bindHost = String(opts.bindHost ?? process.env.DIZZY_BIND_HOST ?? "127.0.0.1");
  const authToken = String(opts.authToken ?? process.env.DIZZY_AUTH_TOKEN ?? "").trim();
  const redisUrl = String(opts.redisUrl ?? process.env.REDIS_URL ?? "");
  const queuePrefix = String(opts.queuePrefix ?? process.env.DIZZY_QUEUE_PREFIX ?? "dizzy");
  const rateLimit = getRateLimitConfig(opts);
  const allowedOrigins = opts.allowedOrigins ?? process.env.DIZZY_ALLOWED_ORIGINS ?? "";
  const deploymentMode = String(opts.deploymentMode ?? process.env.DIZZY_DEPLOYMENT_MODE ?? "direct_local").trim().toLowerCase();
  const publicSurfaceMode = String(opts.publicSurfaceMode ?? process.env.DIZZY_PUBLIC_SURFACES ?? "closed").trim().toLowerCase();
  const dashboardEnabled = opts.dashboardEnabled !== undefined
    ? Boolean(opts.dashboardEnabled)
    : parseBool(process.env.DIZZY_DASHBOARD_ENABLED, false);
  const memoryGraphEnabled = opts.memoryGraphEnabled !== undefined
    ? Boolean(opts.memoryGraphEnabled)
    : parseBool(process.env.DIZZY_MEMORY_GRAPH_ENABLED, false);
  const enforceIdentityHeaders = opts.enforceIdentityHeaders !== undefined
    ? Boolean(opts.enforceIdentityHeaders)
    : parseBool(process.env.DIZZY_ENFORCE_IDENTITY_HEADERS, false);
  const executeToken = String(opts.executeToken ?? process.env.DIZZY_EXECUTE_TOKEN ?? "").trim();
  const notifyToken = String(opts.notifyToken ?? process.env.DIZZY_NOTIFY_TOKEN ?? "").trim();
  const trustedProxiesInput = opts.trustedProxies ?? process.env.DIZZY_TRUSTED_PROXIES ?? "";
  const trustedProxies = String(trustedProxiesInput)
    .split(",")
    .map(normalizeIp)
    .filter(Boolean);

  const verifiedHttps = opts.verifiedHttps ?? parseBool(process.env.DIZZY_VERIFIED_HTTPS, false);

  const runtimeSafety = getRuntimeSafetyConfig();
  const safetyDiagnostics = assertRuntimeSafetyConfig({
    ...runtimeSafety,
    bindHost,
    authTokenConfigured: Boolean(authToken),
    authTokenLength: authToken.length,
    deploymentMode,
    publicSurfaceMode,
    verifiedHttps,
  });

  if (authToken && authToken.length < 32) {
    console.warn(`[WARNING] DIZZY_AUTH_TOKEN is only ${authToken.length} characters long. A minimum length of 32 characters is highly recommended for security.`);
  }
  if (executeToken && executeToken.length < 16) {
    console.warn(`[WARNING] DIZZY_EXECUTE_TOKEN is only ${executeToken.length} characters long. A minimum length of 16 characters is highly recommended for security.`);
  }
  if (notifyToken && notifyToken.length < 16) {
    console.warn(`[WARNING] DIZZY_NOTIFY_TOKEN is only ${notifyToken.length} characters long. A minimum length of 16 characters is highly recommended for security.`);
  }

  const app = express();
  app.use(securityHeaders({ verifiedHttps }));
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  app.use(createProxyExposureGuard({ authToken, deploymentMode, trustedProxies }));
  app.use(createBrowserOriginGuard({ bindHost, allowedOrigins }));
  app.use(createRateLimitMiddleware(rateLimit, { deploymentMode, trustedProxies }));

  if (enforceIdentityHeaders && deploymentMode !== "proxied") {
    throw new Error("DIZZY_ENFORCE_IDENTITY_HEADERS=1 requires DIZZY_DEPLOYMENT_MODE=proxied.");
  }
  if (enforceIdentityHeaders && trustedProxies.length === 0) {
    throw new Error("DIZZY_ENFORCE_IDENTITY_HEADERS=1 requires DIZZY_TRUSTED_PROXIES.");
  }
  if ((executeToken || notifyToken) && !authToken) {
    throw new Error("DIZZY_AUTH_TOKEN is required when scoped API tokens are configured.");
  }

  const pruneClientContinuity = opts.pruneClientContinuity || pruneExpiredClientContinuity;
  const clientContinuityPruneIntervalMs = parsePositiveInt(
    opts.clientContinuityPruneIntervalMs ?? process.env.DIZZY_CLIENT_CONTINUITY_PRUNE_INTERVAL_MS,
    60 * 1000,
  );
  let nextClientContinuityPruneAt = 0;
  let clientContinuityPruneScheduled = false;

  function scheduleClientContinuityPrune(nowMs = Date.now()) {
    if (clientContinuityPruneScheduled || nowMs < nextClientContinuityPruneAt) return false;
    nextClientContinuityPruneAt = nowMs + clientContinuityPruneIntervalMs;
    clientContinuityPruneScheduled = true;
    const timer = setTimeout(async () => {
      try {
        await pruneClientContinuity();
      } catch (error) {
        const message = redactTextPayload(String(error?.message ?? error)).slice(0, 300);
        console.warn(`[client_continuity] prune_failed=${message}`);
      } finally {
        clientContinuityPruneScheduled = false;
      }
    }, 0);
    if (typeof timer.unref === "function") timer.unref();
    return true;
  }

  const dashboardSessionTtlMs = parsePositiveInt(
    opts.dashboardSessionTtlMs ?? process.env.DIZZY_DASHBOARD_SESSION_TTL_MS,
    60 * 60 * 1000,
  );
  let dashboardSessionToken = "";
  let dashboardSessionExpiresAt = 0;
  const hasDashboardSession = (req) => {
    if (!dashboardSessionToken || Date.now() >= dashboardSessionExpiresAt) return false;
    return tokensEqual(readCookie(req, DASHBOARD_SESSION_COOKIE), dashboardSessionToken);
  };
  const createDashboardSession = (candidate) => {
    if (!tokensEqual(String(candidate || ""), authToken)) return null;
    dashboardSessionToken = crypto.randomBytes(32).toString("base64url");
    dashboardSessionExpiresAt = Date.now() + dashboardSessionTtlMs;
    return {
      token: dashboardSessionToken,
      maxAgeSeconds: Math.max(1, Math.floor(dashboardSessionTtlMs / 1000)),
    };
  };
  const clearDashboardSession = () => {
    dashboardSessionToken = "";
    dashboardSessionExpiresAt = 0;
  };

  const hasAnyToken = Boolean(authToken || executeToken || notifyToken);
  if (hasAnyToken) {
    const anonymousDiscoveryRoutes = new Set([
      "/agent/profile",
      "/agent/services",
      "/agent/portfolio",
      "/assets/logo",
      "/governance",
    ]);
    app.use((req, res, next) => {
      // Health can remain open only on loopback bindings.
      if (req.path === "/health" && isLoopbackHost(bindHost)) return next();
      if (publicSurfaceMode === "discovery" && anonymousDiscoveryRoutes.has(req.path)) return next();
      if (dashboardEnabled && ["/dashboard/login", "/dashboard/session", "/assets/dashboard-login.js"].includes(req.path)) return next();
      if (dashboardEnabled && isDashboardRoute(req.path) && hasDashboardSession(req)) return next();

      const auth = String(req.headers?.authorization ?? "");
      const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice("bearer ".length).trim() : "";
      const headerToken = bearer || String(req.headers?.["x-dizzy-token"] ?? "").trim();

      if (!headerToken) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      // Check master authToken first (gives full access to everything)
      if (tokensEqual(headerToken, authToken)) return next();

      // Check scoped /agent/execute token
      if (req.path === "/agent/execute" && tokensEqual(headerToken, executeToken)) {
        return next();
      }

      // Check scoped /notify routes token (accepts /notify/... or /notify/.../ack)
      const isNotifyRoute = req.path === "/notify" || req.path.startsWith("/notify/");
      if (isNotifyRoute && tokensEqual(headerToken, notifyToken)) {
        return next();
      }

      res.status(401).json({ ok: false, error: "Unauthorized" });
    });
  }

  let redis = null;
  let queueKeys = makeQueueKeys(queuePrefix);
  let redisReady = false;

  async function initRedis() {
    if (!redisUrl) return;
    try {
      redis = await connectRedis(redisUrl);
      queueKeys = makeQueueKeys(queuePrefix);
      redisReady = true;
    } catch {
      redis = null;
      redisReady = false;
    }
  }

  await initRedis();

  app.get("/health", async (req, res) => {
    const out = {
      ok: true,
      service: "dizzy-agent-server",
      port,
      bind_host: bindHost,
      auth: {
        configured: Boolean(authToken),
        scheme: authToken ? "bearer" : "none",
        health_exempted: Boolean(authToken) ? isLoopbackHost(bindHost) : true,
      },
      deployment: {
        mode: deploymentMode,
        public_surfaces: publicSurfaceMode,
      },
      browser_origin_guard: {
        enabled: true,
        external_allowlist_configured: normalizeAllowedOrigins(allowedOrigins).size > 0,
      },
      redis: {
        configured: Boolean(redisUrl),
        ready: redisReady,
        prefix: queuePrefix,
      },
      safety: {
        warnings: safetyDiagnostics.warnings,
        remote_mutations_enabled: runtimeSafety.allowRemoteMutations,
        self_modify_enabled: runtimeSafety.allowSelfModify,
      },
      rate_limit: {
        enabled: rateLimit.enabled,
        window_ms: rateLimit.windowMs,
        max: rateLimit.max,
        health_exempted: true,
      },
    };

    if (redisReady) {
      try {
        await redis.ping();
        out.redis.ping = "ok";
      } catch {
        out.redis.ready = false;
        out.redis.ping = "failed";
        out.ok = false;
      }
    }

    res.json(out);
  });

  app.get("/state", (req, res, next) => {
    const rawZone = req.headers?.["x-dizzy-zone"] || req.query?.zone || "public";
    const zone = rawZone === "private" ? "private" : "public";
    const isLocal = isLoopbackRemoteAddress(req.socket?.remoteAddress);

    const directLocalPrivateAccess = deploymentMode === "direct_local" && isLocal;
    const authenticatedDeployment = ["proxied", "hosted"].includes(deploymentMode) && Boolean(authToken);
    if (zone === "private" && !directLocalPrivateAccess && !authenticatedDeployment) {
      return res.status(403).json({ ok: false, error: "Access denied to private state" });
    }

    try {
      const stateConfig = loadStateConfig(zone);
      res.json({ ok: true, state: stateConfig });
    } catch (e) {
      next(e);
    }
  });


  app.get("/governance", async (req, res, next) => {
    try {
      const docPath = path.resolve(process.cwd(), "INTERACTION_NORMS.md");
      if (!fs.existsSync(docPath)) {
        return res.status(404).type("text/plain").send("Missing INTERACTION_NORMS.md");
      }
      const text = fs.readFileSync(docPath, "utf8");
      res.setHeader("Cache-Control", "no-store");
      res.type("text/markdown").send(text);
    } catch (e) {
      next(e);
    }
  });

  if (!dashboardEnabled) {
    registerDashboardFallbackRoutes(app, { enabled: false });
  } else {
    const dashboardLoader = opts.dashboardModuleLoader || (() => import("./lib/dashboard.mjs"));
    try {
      const dashboard = await dashboardLoader();
      dashboard.registerDashboardRoutes(app, {
        authToken,
        normalizeIp,
        isLoopbackHost,
        assetPath: opts.dashboardAssetPath,
        scriptAssetPath: opts.dashboardScriptAssetPath,
        loginScriptAssetPath: opts.dashboardLoginScriptAssetPath,
        verifiedHttps,
        createDashboardSession,
        clearDashboardSession,
        requestBoundaryAuditGuard,
        operatorExecute: runAgentExecute,
      });
    } catch (error) {
      console.warn(`[dashboard] initialization_failed=${String(error?.message ?? error)}`);
      registerDashboardFallbackRoutes(app, {
        enabled: true,
      });
    }
  }

  app.get("/prompt", async (req, res, next) => {
    try {
      const trustZone = String(req.query?.trust_zone ?? "").trim().toLowerCase();
      const { sources } = getCachedChatSystemPrompt({ trustZone });
      const totalBytes = sources.reduce((sum, s) => sum + Number(s.bytes || 0), 0);
      const constitutionalCount = sources.filter((s) => s.role === "constitutional").length;
      const out = {
        ok: true,
        chat_backend: String(process.env.DIZZY_CHAT_BACKEND ?? "").trim() || "",
        gemini_model: String(process.env.GEMINI_MODEL ?? "").trim() || "",
        prompt_pack: String(process.env.DIZZY_PROMPT_PACK ?? "").trim() || "",
        effective_trust_zone: trustZone || "",
        prompt_modes: {
          brevity: String(process.env.DIZZY_BREVITY_MODE ?? "lite").trim() || "lite",
          affect: String(process.env.DIZZY_AFFECT_MODE ?? "attuned").trim() || "attuned",
          reinforcement: String(process.env.DIZZY_REINFORCEMENT_MODE ?? "gold_star").trim() || "gold_star",
        },
        rag: {
          enabled: String(process.env.DIZZY_RAG_ENABLED ?? "1") === "1",
          top_k: Number(process.env.DIZZY_RAG_TOP_K ?? 4) || 4,
        },
        prompt_budget: {
          files: sources.length,
          constitutional_files: constitutionalCount,
          supplemental_files: Math.max(0, sources.length - constitutionalCount),
          total_bytes: totalBytes,
          truncated_files: sources.filter((s) => s.truncated).length,
        },
        prompt_files: sources.map((s) => ({
          path: s.path,
          role: s.role,
          exists: s.exists,
          bytes: s.bytes,
          sha256: s.sha256,
          truncated: s.truncated,
        })),
      };
      res.setHeader("Cache-Control", "no-store");
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  function memoryGraphAccessGuard(req, res, next) {
    if (!memoryGraphEnabled) return res.status(404).json({ ok: false, error: "Memory graph disabled" });
    if (!isLoopbackRemoteAddress(req.socket?.remoteAddress) && !authToken) {
      return res.status(403).json({ ok: false, error: "Memory graph requires local access or authentication" });
    }
    return next();
  }

  app.get("/memory/graph", memoryGraphAccessGuard, async (req, res, next) => {
    try {
      const query = String(req.query.q ?? "").trim();
      if (query) {
        const graph = getRelevantMemoryGraphContext(query, {
          k: Math.max(1, Math.min(10, Number(req.query.k ?? 3) || 3)),
        });
        return res.json({
          ok: true,
          query,
          mode: "query",
          graph: {
            ...graph,
            docs: graph.docs.map(({ excerpt: _excerpt, ...doc }) => doc),
          },
        });
      }
      const graph = getMemoryGraph();
      return res.json({
        ok: true,
        mode: "summary",
        built_at: graph.built_at,
        counts: graph.counts,
        docs: graph.docs.slice(0, 20).map((d) => ({
          path: d.path,
          title: d.title,
          kind: d.kind,
          keywords: d.keywords.slice(0, 6),
          entities: d.entities.slice(0, 6),
        })),
        entities: graph.entities.slice(0, 20),
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/assets/logo", (req, res) => {
    const logoPath = path.resolve(process.cwd(), "dizzylogofull.png");
    if (!fs.existsSync(logoPath)) {
      return res.status(404).json({ ok: false, error: "Missing dizzylogofull.png" });
    }
    return res.sendFile(logoPath);
  });

  function absoluteUrl(req, routePath) {
    return `${req.protocol}://${req.get("host")}${routePath}`;
  }

  // GET /agent/profile
  app.get("/agent/profile", (req, res) => {
    res.json({
      name: "Dizzy",
      description: "Operator-mediated public surface for bounded visuals and analysis",
      avatar_url: absoluteUrl(req, "/assets/logo"),
      capabilities: ["image_gen", "bounded_analysis"],
      governance: { doc_path: "/governance" },
      delivery_mode: "operator_mediated",
    });
  });

  // GET /agent/services
  app.get("/agent/services", (req, res) => {
    res.json({
      services: [
        { id: "dizzy_image_gen", title: "Narrative Visual", pricing: "informal_quote", category: "image_gen" },
        { id: "dizzy_visual_pack", title: "Visual Pack", pricing: "informal_quote", category: "image_gen" },
      ],
    });
  });

  // GET /agent/portfolio
  app.get("/agent/portfolio", (req, res) => {
    res.json({
      works: [],
    });
  });

  async function enqueueTool({ tool, payload, effect, notify, idempotencyKey }) {
    if (!redisReady) {
      throw new Error("Redis not ready. Set REDIS_URL and run Redis.");
    }
    const maxRetries = Number(process.env.DIZZY_MAX_RETRIES || 3);
    const result = await enqueueJob(redis, queueKeys, payload, {
      type: "tool",
      tool,
      effect,
      maxRetries,
      notify,
      idempotencyKey,
    });
    if (Array.isArray(result)) {
      return { jobId: result[0], deduplicated: result[1] === 0 };
    }
    return { jobId: result, deduplicated: false };
  }

  // Single dispatch path (Telegram/model wiring can call this later).
  app.post("/dispatch/incoming", requestBoundaryAuditGuard, async (req, res, next) => {
    try {
      const rawIdempotencyKey = req.header("idempotency-key");
      let idempotencyKey = undefined;
      if (rawIdempotencyKey !== undefined) {
        const trimmed = rawIdempotencyKey.trim();
        if (!trimmed || trimmed.length > 128 || !/^[!-~]{1,128}$/.test(trimmed)) {
          return res.status(400).json({ ok: false, error: "Invalid Idempotency-Key header format" });
        }
        const channel = normalizeIdentifier(req.body?.channel ?? "local", "local");
        const from = req.body?.from != null ? normalizeIdentifier(req.body.from, "anon") : "anon";
        idempotencyKey = `route:/dispatch/incoming|channel:${channel}|from:${from}|key:${trimmed}`;
      }

      const message = buildIncomingMessage(req.body, req, { channel: "local" });

      const out = await handleIncomingMessage({
        message,
        enqueue: ({ tool, payload, effect, notify }) =>
          enqueueTool({ tool, payload, effect, notify, idempotencyKey }),
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      next(e);
    }
  });

  // Job status endpoint
  app.get("/jobs/:id", async (req, res, next) => {
    try {
      if (!redisReady) return res.status(503).json({ ok: false, error: "Redis not ready" });
      const job = await getJob(redis, queueKeys, req.params.id);
      if (!job) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, job: shapeJobForResponse(job) });
    } catch (e) {
      next(e);
    }
  });

  // Notification reads are non-destructive; clients acknowledge exact receipts after delivery.
  app.get("/notify/:channel", async (req, res, next) => {
    try {
      if (!redisReady) return res.status(503).json({ ok: false, error: "Redis not ready" });
      const channel = normalizeIdentifier(req.params.channel || "local", "local");
      const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
      const key = queueKeys.notify(channel);
      const items = await redis.lRange(key, 0, limit - 1);

      const notifications = items.map((s) => {
        const ackReceipt = crypto.createHash("sha1").update(s).digest("hex");
        try {
          return { ...JSON.parse(s), ack_receipt: ackReceipt };
        } catch {
          return { kind: "raw", raw: s, ack_receipt: ackReceipt };
        }
      });

      res.json({ ok: true, channel, notifications });
    } catch (e) {
      next(e);
    }
  });

  app.post("/notify/:channel/ack", async (req, res, next) => {
    try {
      if (!redisReady) return res.status(503).json({ ok: false, error: "Redis not ready" });
      const channel = normalizeIdentifier(req.params.channel || "local", "local");
      const receipts = Array.isArray(req.body?.receipts) ? req.body.receipts : [];
      const key = queueKeys.notify(channel);
      const acknowledged = await acknowledgeNotifications(redis, key, receipts);
      res.json({ ok: true, channel, acknowledged });
    } catch (e) {
      if (e?.code === "NOTIFY_ACK_CONFLICT") {
        return res.status(409).json({ ok: false, error: String(e.message) });
      }
      next(e);
    }
  });

  async function runAgentExecute(req, body = req.body ?? {}) {
    const { brief } = body ?? {};
    let client_id = body?.client_id;
    let service_id = body?.service_id;

    if (enforceIdentityHeaders) {
      const clientIp = normalizeIp(req.socket?.remoteAddress || req.ip);
      const headersTrusted = trustedProxies.includes(clientIp);
      if (headersTrusted) {
        client_id = req.header("x-dizzy-client-id");
        service_id = req.header("x-dizzy-service-id");
      } else {
        client_id = undefined;
        service_id = undefined;
      }
    }

    const continuityMode = String(body?.continuity_mode ?? "ephemeral").trim().toLowerCase();
    const continuityAllowed = continuityMode === "client";
    if (continuityAllowed && (!String(client_id ?? "").trim() || !String(service_id ?? "").trim())) {
      return { status: 400, body: { ok: false, error: "continuity_mode=client requires client_id and service_id" } };
    }
    const conversationKey = buildExecuteConversationKey({ ...body, client_id, service_id });
    const runtimeContext = {
      trust_zone: "paid_public",
      continuity_mode: continuityAllowed ? "client" : "ephemeral",
      conversation_key: conversationKey,
    };
    const rawIdempotencyKey = req.header("idempotency-key");
    let idempotencyKey = undefined;
    if (rawIdempotencyKey !== undefined) {
      const trimmed = rawIdempotencyKey.trim();
      if (!trimmed || trimmed.length > 128 || !/^[!-~]{1,128}$/.test(trimmed)) {
        return { status: 400, body: { ok: false, error: "Invalid Idempotency-Key header format" } };
      }
      const clientId = client_id ? client_id : "anon";
      const serviceId = service_id ? service_id : "none";
      idempotencyKey = `route:/agent/execute|client:${clientId}|service:${serviceId}|key:${trimmed}`;
    }

    scheduleClientContinuityPrune();
    const message = buildIncomingMessage(
      { text: brief, meta: { service_id, client_id } },
      req,
      {
        channel: "execute",
        from: client_id ? `client:${normalizeIdentifier(client_id, "anon")}` : null,
        runtime_context: runtimeContext,
      },
    );
    const capabilities = getTrustZoneCapabilities(message, "paid_public");
    const beforeConversationRows = capabilities.retention_scope !== "ephemeral"
      ? countJsonlRows(conversationPathForKey(conversationKey))
      : 0;
    const out = await handleIncomingMessage({
      message,
      enqueue: ({ tool, payload, effect, notify }) =>
        enqueueTool({ tool, payload, effect, notify, idempotencyKey }),
    });
    const capabilityReceipt = out?.capability_receipt || buildCapabilityReceipt(message);
    if (capabilities.retention_scope !== "ephemeral") {
      persistMissingExecuteTranscript({ conversationKey, beforeRows: beforeConversationRows, brief, out });
      durableAppendJsonl(executionHistoryPath(), {
        t: new Date().toISOString(),
        route: "/agent/execute",
        trust_zone: "paid_public",
        service_id: service_id == null ? null : normalizeIdentifier(service_id, "service"),
        client_id: client_id == null ? null : normalizeIdentifier(client_id, "client"),
        continuity_mode: capabilities.continuity_mode === "client" ? "client" : "ephemeral",
        retention_scope: capabilities.retention_scope,
        repo_retrieval_allowed: capabilities.repo_retrieval_allowed,
        durable_memory_allowed: capabilities.durable_memory_allowed,
        capability_receipt: capabilityReceipt,
        conversation_key: conversationKey,
        result_kind: out?.kind || "",
      });
    }

    return {
      status: 200,
      body: {
        ok: true,
        service_id: service_id ?? null,
        continuity_mode: capabilities.continuity_mode === "client" ? "client" : "ephemeral",
        retention_scope: capabilities.retention_scope,
        expiry_policy: capabilities.expiry_policy,
        repo_retrieval_allowed: capabilities.repo_retrieval_allowed,
        durable_memory_allowed: capabilities.durable_memory_allowed,
        capability_receipt: capabilityReceipt,
        conversation_key: conversationKey,
        ...out,
      },
    };
  }

  // POST /agent/execute delegates to dispatch for now.
  app.post("/agent/execute", requestBoundaryAuditGuard, async (req, res, next) => {
    try {
      const result = await runAgentExecute(req);
      return res.status(result.status).json(result.body);
    } catch (e) {
      return next(e);
    }
  });

  app.delete("/agent/continuity", async (req, res, next) => {
    try {
      const result = await deleteClientContinuity({
        client_id: req.body?.client_id,
        service_id: req.body?.service_id,
        conversation_key: req.body?.conversation_key,
        reason: "operator_delete",
      });
      if (!result.ok) return res.status(400).json(result);
      return res.json(result);
    } catch (e) {
      return next(e);
    }
  });

  app.get("/agent/continuity/export", async (req, res, next) => {
    try {
      const result = exportClientContinuity({
        client_id: req.query?.client_id,
        service_id: req.query?.service_id,
        conversation_key: req.query?.conversation_key,
      });
      if (!result.ok) return res.status(400).json(result);
      res.setHeader("Cache-Control", "no-store");
      return res.json(result);
    } catch (e) {
      return next(e);
    }
  });

  app.post("/agent/continuity/prune", async (req, res, next) => {
    try {
      const result = await pruneClientContinuity();
      return res.json(result);
    } catch (e) {
      return next(e);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ ok: false, error: "Not found" });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    const errMsg = String(err?.message ?? err).slice(0, 500);
    const redacted = redactTextPayload(errMsg);
    console.error(`[Server Error] ${redacted}`);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  });

  return { app, port, bindHost, redisReady, queuePrefix, redisUrl, authConfigured: Boolean(authToken), rateLimit };
}

export async function startServer(opts = {}) {
  const rt = await createRuntime(opts);
  const bindHost = String(opts.bindHost ?? process.env.DIZZY_BIND_HOST ?? "127.0.0.1");
  const server = rt.app.listen(rt.port, bindHost);
  await new Promise((resolve) => server.once("listening", resolve));
  const addr = server.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : rt.port;

  return {
    ...rt,
    server,
    boundPort,
    stop: async () => new Promise((resolve) => server.close(() => resolve())),
  };
}

if (isMainModule()) {
  const started = await startServer({});
  console.log(`Dizzy agent server listening on ${process.env.DIZZY_BIND_HOST ?? "127.0.0.1"}:${started.boundPort}`);
  console.log(`[health] http://127.0.0.1:${started.boundPort}/health`);
}
