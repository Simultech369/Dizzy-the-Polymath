import { createLifecycleHookManager } from "./lifecycle_hooks.mjs";

function parseBoolValue(value, fallback = false) {
  const raw = String(value ?? (fallback ? "1" : "0")).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function clampNonNegative(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function normalizeIp(ip) {
  if (!ip) return "";
  let s = String(ip).trim().toLowerCase();
  if (s.startsWith("::ffff:")) {
    s = s.substring(7);
  }
  if (s === "::1") return "127.0.0.1";
  if (s === "localhost") return "127.0.0.1";
  return s;
}

export function normalizeTrustedProxies(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return values.map(normalizeIp).filter(Boolean);
}

export function getRateLimitConfig(opts = {}, envObj = process.env) {
  const enabled = opts.rateLimitEnabled !== undefined
    ? Boolean(opts.rateLimitEnabled)
    : parseBoolValue(envObj.DIZZY_RATE_LIMIT_ENABLED, false);
  return {
    enabled,
    windowMs: parsePositiveInt(opts.rateLimitWindowMs ?? envObj.DIZZY_RATE_LIMIT_WINDOW_MS, 60000),
    max: parsePositiveInt(opts.rateLimitMax ?? envObj.DIZZY_RATE_LIMIT_MAX, 120),
  };
}

export function getIngressBudgetConfig(opts = {}, envObj = process.env) {
  const enabled = opts.ingressBudgetEnabled !== undefined
    ? Boolean(opts.ingressBudgetEnabled)
    : parseBoolValue(envObj.DIZZY_INGRESS_BUDGET_ENABLED, false);
  return {
    enabled,
    windowMs: parsePositiveInt(opts.ingressBudgetWindowMs ?? envObj.DIZZY_INGRESS_BUDGET_WINDOW_MS, 60000),
    max: parsePositiveInt(opts.ingressBudgetMax ?? envObj.DIZZY_INGRESS_BUDGET_MAX, 600),
    requestCost: parsePositiveInt(opts.ingressBudgetRequestCost ?? envObj.DIZZY_INGRESS_BUDGET_REQUEST_COST, 1),
  };
}

export function getIngressGatewayConfig(opts = {}, envObj = process.env) {
  return {
    rateLimit: getRateLimitConfig(opts, envObj),
    budget: getIngressBudgetConfig(opts, envObj),
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

export function rateLimitClientKey(req, { deploymentMode, trustedProxies = [] } = {}) {
  const remote = normalizeIp(req.socket?.remoteAddress || req.ip);
  if (["proxied", "hosted"].includes(deploymentMode) && trustedProxies.includes(remote)) {
    return forwardedClientIp(req, trustedProxies) || remote || "unknown";
  }
  return remote || normalizeIp(req.ip) || "unknown";
}

export function reserveFixedWindowQuota(buckets, key, config, now = Date.now()) {
  const windowMs = parsePositiveInt(config?.windowMs, 60000);
  const max = parsePositiveInt(config?.max, 120);
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + windowMs };

  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, max - bucket.count);
  return {
    allowed: bucket.count <= max,
    limit: max,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterMs: Math.max(0, bucket.resetAt - now),
    count: bucket.count,
  };
}

export function reserveTokenBudget(buckets, key, config, now = Date.now()) {
  const capacity = parsePositiveInt(config?.max, 600);
  const windowMs = parsePositiveInt(config?.windowMs, 60000);
  const cost = parsePositiveInt(config?.requestCost ?? config?.cost, 1);
  const refillPerMs = capacity / windowMs;
  const current = buckets.get(key);
  const bucket = current || { tokens: capacity, updatedAt: now };
  const elapsedMs = Math.max(0, now - Number(bucket.updatedAt ?? now));
  bucket.tokens = Math.min(capacity, clampNonNegative(bucket.tokens, capacity) + elapsedMs * refillPerMs);
  bucket.updatedAt = now;

  const allowed = bucket.tokens >= cost;
  if (allowed) {
    bucket.tokens -= cost;
  }
  buckets.set(key, bucket);

  const missing = Math.max(0, cost - bucket.tokens);
  const retryAfterMs = allowed ? 0 : Math.ceil(missing / refillPerMs);
  return {
    allowed,
    limit: capacity,
    remaining: Math.max(0, Math.floor(bucket.tokens)),
    retryAfterMs,
    cost,
  };
}

export function createIngressGatewayMiddleware(config = {}, trust = {}) {
  const rateBuckets = new Map();
  const budgetBuckets = new Map();
  let nextPruneAt = 0;
  const rateLimit = config.rateLimit || {};
  const budget = config.budget || {};
  const lifecycleHooks = trust.lifecycleHooks || config.lifecycleHooks || createLifecycleHookManager();
  let lifecycleSessionCounter = 0;

  return function ingressGateway(req, res, next) {
    if (req.path === "/health") return next();

    const now = Date.now();
    const key = rateLimitClientKey(req, trust);
    const lifecycleSessionId = `ingress_${now}_${lifecycleSessionCounter += 1}`;
    const sessionStartedAtMs = now;
    lifecycleHooks.sessionStart({
      req,
      session_id: lifecycleSessionId,
      actor_id: "ingress_gateway",
      method: req.method,
      trust_zone: req.body?.runtime_context?.trust_zone || "unclassified",
    });
    res.once?.("finish", () => {
      lifecycleHooks.stop({
        req,
        res,
        session_id: lifecycleSessionId,
        actor_id: "ingress_gateway",
        status_code: res.statusCode,
        outcome: res.statusCode >= 400 ? "failed" : "completed",
        started_at_ms: sessionStartedAtMs,
      });
    });

    if (rateLimit.enabled) {
      if (now >= nextPruneAt) {
        pruneExpiredRateLimitBuckets(rateBuckets, now);
        nextPruneAt = now + parsePositiveInt(rateLimit.windowMs, 60000);
      }

      const quota = reserveFixedWindowQuota(rateBuckets, key, rateLimit, now);
      const resetSeconds = Math.ceil(quota.resetAt / 1000);
      res.setHeader("RateLimit-Limit", String(quota.limit));
      res.setHeader("RateLimit-Remaining", String(quota.remaining));
      res.setHeader("RateLimit-Reset", String(resetSeconds));

      if (!quota.allowed) {
        res.setHeader("Retry-After", String(Math.ceil(quota.retryAfterMs / 1000)));
        return res.status(429).json({
          ok: false,
          error: "Rate limit exceeded",
          retry_after_ms: quota.retryAfterMs,
        });
      }
    }

    if (budget.enabled) {
      const reservation = reserveTokenBudget(budgetBuckets, key, budget, now);
      res.setHeader("X-Dizzy-Ingress-Budget-Limit", String(reservation.limit));
      res.setHeader("X-Dizzy-Ingress-Budget-Remaining", String(reservation.remaining));

      if (!reservation.allowed) {
        res.setHeader("Retry-After", String(Math.ceil(reservation.retryAfterMs / 1000)));
        return res.status(429).json({
          ok: false,
          error: "Ingress budget exhausted",
          retry_after_ms: reservation.retryAfterMs,
        });
      }
    }

    return next();
  };
}

export function createProviderCircuitBreaker(opts = {}) {
  const failureThreshold = parsePositiveInt(opts.failureThreshold, 3);
  const cooldownMs = parsePositiveInt(opts.cooldownMs, 30000);
  const halfOpenSuccessThreshold = parsePositiveInt(opts.halfOpenSuccessThreshold, 1);
  const nowFn = typeof opts.nowFn === "function" ? opts.nowFn : () => Date.now();
  const states = new Map();

  function read(provider) {
    const key = String(provider || "unknown").trim().toLowerCase() || "unknown";
    const state = states.get(key) || {
      provider: key,
      state: "closed",
      failures: 0,
      successes: 0,
      openedAt: 0,
      lastFailureAt: 0,
    };
    if (state.state === "open" && nowFn() - state.openedAt >= cooldownMs) {
      state.state = "half_open";
      state.successes = 0;
      states.set(key, state);
    }
    return state;
  }

  function snapshot(provider) {
    return { ...read(provider) };
  }

  function canRequest(provider) {
    return read(provider).state !== "open";
  }

  function recordSuccess(provider) {
    const state = read(provider);
    state.failures = 0;
    state.successes += 1;
    if (state.state === "half_open" && state.successes >= halfOpenSuccessThreshold) {
      state.state = "closed";
      state.successes = 0;
      state.openedAt = 0;
    }
    states.set(state.provider, state);
    return snapshot(state.provider);
  }

  function recordFailure(provider) {
    const state = read(provider);
    state.failures += 1;
    state.successes = 0;
    state.lastFailureAt = nowFn();
    if (state.failures >= failureThreshold || state.state === "half_open") {
      state.state = "open";
      state.openedAt = state.lastFailureAt;
    }
    states.set(state.provider, state);
    return snapshot(state.provider);
  }

  function reset(provider) {
    const key = String(provider || "unknown").trim().toLowerCase() || "unknown";
    states.delete(key);
    return snapshot(key);
  }

  return {
    canRequest,
    recordSuccess,
    recordFailure,
    reset,
    snapshot,
  };
}

export function selectProviderWithCircuit({ circuit, primary, fallback, allowFallback = true } = {}) {
  const primaryKey = String(primary || "").trim().toLowerCase();
  const fallbackKey = String(fallback || "").trim().toLowerCase();
  if (!primaryKey) {
    return { provider: fallbackKey || "", usedFallback: Boolean(fallbackKey), reason: "missing_primary" };
  }
  if (!circuit || circuit.canRequest(primaryKey)) {
    return { provider: primaryKey, usedFallback: false, reason: "primary_available" };
  }
  if (allowFallback && fallbackKey) {
    return { provider: fallbackKey, usedFallback: true, reason: "primary_circuit_open" };
  }
  return { provider: "", usedFallback: false, reason: "primary_circuit_open_no_fallback" };
}
