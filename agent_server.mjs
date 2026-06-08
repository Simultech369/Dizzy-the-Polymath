import express from "express";
import fs from "fs";
import path from "path";

import { connectRedis, enqueueJob, getJob, makeQueueKeys } from "./lib/queue.mjs";
import { buildCapabilityReceipt, getTrustZoneCapabilities, handleIncomingMessage } from "./lib/dispatch.mjs";
import { buildClientConversationKey, deleteClientContinuity, executionHistoryPath, pruneExpiredClientContinuity } from "./lib/client_continuity.mjs";
import { getCachedChatSystemPrompt } from "./lib/prompt_bundle.mjs";
import { getMemoryGraph, getRelevantMemoryGraphContext } from "./lib/memory_graph.mjs";
import { assertRuntimeSafetyConfig, getRuntimeSafetyConfig, isLoopbackHost } from "./lib/runtime_config.mjs";

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

function parseBool(value, fallback = false) {
  const raw = String(value ?? (fallback ? "1" : "0")).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
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

function createRateLimitMiddleware(config) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    if (!config.enabled || req.path === "/health") return next();

    const now = Date.now();
    const key = String(req.ip || req.socket?.remoteAddress || "unknown");
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

export function redactTextPayload(text) {
  if (!text) return "";
  let t = String(text);
  t = t.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED_EMAIL]");
  t = t.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[REDACTED_PHONE]");
  t = t.replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]");
  return t;
}

function filterPrivateKeys(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(filterPrivateKeys);
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.includes("#private") || key.includes("#private_self")) {
      continue;
    }
    result[key] = filterPrivateKeys(value);
  }
  return result;
}

export function loadStateConfig(zone) {
  const statePath = path.resolve(process.cwd(), "state.json");
  if (!fs.existsSync(statePath)) return {};
  const raw = fs.readFileSync(statePath, "utf8");
  const parsed = JSON.parse(raw);

  if (zone === "public") {
    return filterPrivateKeys(parsed);
  }
  return parsed;
}

function boundaryGuard(req, res, next) {
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
    const auditDir = path.resolve(process.cwd(), "runtime", "audit");
    fs.mkdirSync(auditDir, { recursive: true });
    const receiptPath = path.join(auditDir, "boundary_violations.jsonl");
    const receipt = {
      t: new Date().toISOString(),
      type: "boundary_violation",
      reason,
      ip: req.socket?.remoteAddress,
      headers: req.headers,
      body: req.body,
    };
    fs.appendFileSync(receiptPath, `${JSON.stringify(receipt)}\n`, "utf8");
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

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function normalizeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function appendJsonl(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, "utf8");
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

  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use(createRateLimitMiddleware(rateLimit));

  const runtimeSafety = getRuntimeSafetyConfig();
  const safetyDiagnostics = assertRuntimeSafetyConfig({ ...runtimeSafety, bindHost, authTokenConfigured: Boolean(authToken) });

  if (authToken) {
    app.use((req, res, next) => {
      // Health can remain open only on loopback bindings.
      if (req.path === "/health" && isLoopbackHost(bindHost)) return next();

      const auth = String(req.headers?.authorization ?? "");
      const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice("bearer ".length).trim() : "";
      const headerToken = bearer || String(req.headers?.["x-dizzy-token"] ?? "").trim();

      if (headerToken && headerToken === authToken) return next();
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

  app.get("/state", (req, res) => {
    const rawZone = req.headers?.["x-dizzy-zone"] || req.query?.zone || "public";
    const zone = rawZone === "private" ? "private" : "public";
    const isLocal = isLoopbackRemoteAddress(req.socket?.remoteAddress);

    if (zone === "private" && !isLocal) {
      return res.status(403).json({ ok: false, error: "Access denied to private state" });
    }

    try {
      const stateConfig = loadStateConfig(zone);
      res.json({ ok: true, state: stateConfig });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get("/governance", async (req, res) => {
    try {
      const docPath = path.resolve(process.cwd(), "GOVERNANCE.md");
      if (!fs.existsSync(docPath)) {
        return res.status(404).type("text/plain").send("Missing GOVERNANCE.md");
      }
      const text = fs.readFileSync(docPath, "utf8");
      res.setHeader("Cache-Control", "no-store");
      res.type("text/markdown").send(text);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get("/prompt", async (req, res) => {
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
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get("/memory/graph", async (req, res) => {
    try {
      const query = String(req.query.q ?? "").trim();
      if (query) {
        return res.json({
          ok: true,
          query,
          mode: "query",
          graph: getRelevantMemoryGraphContext(query, {
            k: Math.max(1, Math.min(10, Number(req.query.k ?? 3) || 3)),
          }),
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
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
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

  async function enqueueTool({ tool, payload, effect, notify }) {
    if (!redisReady) {
      throw new Error("Redis not ready. Set REDIS_URL and run Redis.");
    }
    const maxRetries = Number(process.env.DIZZY_MAX_RETRIES || 3);
    return enqueueJob(redis, queueKeys, payload, { type: "tool", tool, effect, maxRetries, notify });
  }

  // Single dispatch path (Telegram/model wiring can call this later).
  app.post("/dispatch/incoming", boundaryGuard, async (req, res) => {
    try {
      const message = buildIncomingMessage(req.body, req, { channel: "local" });

      const out = await handleIncomingMessage({
        message,
        enqueue: enqueueTool,
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // Job status endpoint
  app.get("/jobs/:id", async (req, res) => {
    try {
      if (!redisReady) return res.status(503).json({ ok: false, error: "Redis not ready" });
      const job = await getJob(redis, queueKeys, req.params.id);
      if (!job) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, job: shapeJobForResponse(job) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // Notifications endpoint (best-effort). Clients can poll and deliver to the messaging surface.
  app.get("/notify/:channel", async (req, res) => {
    try {
      if (!redisReady) return res.status(503).json({ ok: false, error: "Redis not ready" });
      const channel = normalizeIdentifier(req.params.channel || "local", "local");
      const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
      const key = queueKeys.notify(channel);

      const items = await redis.lRange(key, 0, limit - 1);
      if (items.length) {
        await redis.lTrim(key, items.length, -1);
      }

      const notifications = items.map((s) => {
        try {
          return JSON.parse(s);
        } catch {
          return { kind: "raw", raw: s };
        }
      });

      res.json({ ok: true, channel, notifications });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // POST /agent/execute delegates to dispatch for now.
  app.post("/agent/execute", boundaryGuard, async (req, res) => {
    const { brief, service_id, client_id } = req.body ?? {};
    const continuityMode = String(req.body?.continuity_mode ?? "ephemeral").trim().toLowerCase();
    const continuityAllowed = continuityMode === "client";
    if (continuityAllowed && (!String(client_id ?? "").trim() || !String(service_id ?? "").trim())) {
      return res.status(400).json({
        ok: false,
        error: "continuity_mode=client requires client_id and service_id",
      });
    }
    const conversationKey = buildExecuteConversationKey(req.body ?? {});
    const runtimeContext = {
      trust_zone: "paid_public",
      continuity_mode: continuityAllowed ? "client" : "ephemeral",
      conversation_key: conversationKey,
    };
    try {
      pruneExpiredClientContinuity();
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
      const out = await handleIncomingMessage({
        message,
        enqueue: enqueueTool,
      });
      const capabilityReceipt = out?.capability_receipt || buildCapabilityReceipt(message);
      if (capabilities.retention_scope !== "ephemeral") {
        appendJsonl(executionHistoryPath(), {
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
      res.json({
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
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.delete("/agent/continuity", async (req, res) => {
    try {
      const result = deleteClientContinuity({
        client_id: req.body?.client_id,
        service_id: req.body?.service_id,
        conversation_key: req.body?.conversation_key,
        reason: "operator_delete",
      });
      if (!result.ok) return res.status(400).json(result);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.post("/agent/continuity/prune", async (req, res) => {
    try {
      const result = pruneExpiredClientContinuity();
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
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
