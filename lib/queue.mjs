import { createClient } from "redis";
import crypto from "crypto";
import path from "path";
import { durableAppendJsonl, redactSecretMaterial } from "./durable_write_policy.mjs";

const DEFAULT_PREFIX = "dizzy";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_ATTEMPTS = DEFAULT_MAX_RETRIES + 1; // 1 initial + N retries
const DEFAULT_DLQ_DIR = path.join("runtime", "dlq");
const WORKER_INSTANCE_ID = `${process.pid}-${crypto.randomUUID()}`;

function sanitizeKeySegment(value, fallback = "local") {
  const sanitized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return sanitized || fallback;
}

function nowMs() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendJsonl(filePath, obj) {
  durableAppendJsonl(filePath, obj);
}

export function makeQueueKeys(prefix = DEFAULT_PREFIX) {
  return {
    ready: `${prefix}:queue:ready`,
    processing: `${prefix}:queue:processing`,
    delayed: `${prefix}:queue:delayed`,
    dlq: `${prefix}:queue:dlq`,
    notify: (channel = "local") => `${prefix}:queue:notify:${sanitizeKeySegment(channel, "local")}`,
    job: (id) => `${prefix}:job:${id}`,
    idempotency: (key) => {
      const hash = crypto.createHash("sha256").update(String(key)).digest("hex");
      return `${prefix}:queue:idempotency:${hash}`;
    },
  };
}

export async function connectRedis(redisUrl) {
  const connectTimeout = Math.max(250, Number(process.env.DIZZY_REDIS_CONNECT_TIMEOUT_MS || 2000) || 2000);
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout,
      // Fail fast: if Redis is down/misconfigured, don't hang the whole runtime on reconnect loops.
      reconnectStrategy: false,
    },
  });
  client.on("error", () => {
    // Avoid noisy logs here; caller decides how to surface connectivity.
  });
  await client.connect();
  return client;
}

const ENQUEUE_JOB_SCRIPT = `
  local ready_key = KEYS[1]
  local job_key = KEYS[2]
  local idem_key = KEYS[3]
  local has_idem = ARGV[1] == '1'
  local job_id = ARGV[2]
  local expire_seconds = tonumber(ARGV[3])

  if #ARGV < 3 or (#ARGV - 3) % 2 ~= 0 then
    return redis.error_reply("ERR Invalid ARGV structure")
  end

  if has_idem then
    local existing_id = redis.call('GET', idem_key)
    if existing_id then
      return {existing_id, 0}
    end
  end

  redis.call('HSET', job_key, unpack(ARGV, 4))
  redis.call('LPUSH', ready_key, job_id)

  if has_idem then
    redis.call('SET', idem_key, job_id, 'EX', expire_seconds)
  end

  return {job_id, 1}
`;

export async function enqueueJob(redis, keys, payload, opts = {}) {
  const id = opts.id ?? crypto.randomUUID();
  const createdAt = String(nowMs());
  const jobKey = keys.job(id);

  const maxRetries = Number.isFinite(Number(opts.maxRetries)) ? Number(opts.maxRetries) : DEFAULT_MAX_RETRIES;
  const computedMaxAttempts = Math.max(1, maxRetries + 1);
  const maxAttempts = Number.isFinite(Number(opts.maxAttempts)) ? Number(opts.maxAttempts) : computedMaxAttempts;

  const job = {
    id,
    status: "queued",
    type: opts.type ?? "tool",
    tool: opts.tool ?? "",
    effect: String(opts.effect ?? "READ").toUpperCase(),
    // Canonical state: attempts counts total executions (initial + retries).
    attempts: "0",
    max_attempts: String(maxAttempts),
    // Retry policy: 3 retries with 1s/4s/16s backoff by default.
    retry_count: "0",
    max_retries: String(maxRetries),
    created_at_ms: createdAt,
    updated_at_ms: createdAt,
    started_at_ms: "",
    finished_at_ms: "",
    payload_json: JSON.stringify(payload ?? {}),
    notify_json: opts.notify ? JSON.stringify(opts.notify) : "",
    last_error: "",
    last_error_at_ms: "",
    last_retry_reason: "",
    result_json: "",
    next_retry_at_ms: "",
    dead_letter_path: "",
  };

  const idempotencyKey = opts.idempotencyKey ? String(opts.idempotencyKey) : "";

  if (idempotencyKey && typeof redis.eval === "function") {
    let expireSeconds = 86400;
    if (opts.idempotencyExpiry !== undefined) {
      const exp = Number(opts.idempotencyExpiry);
      if (Number.isInteger(exp) && exp > 0) {
        expireSeconds = exp;
      } else {
        throw new Error("idempotencyExpiry must be a positive integer");
      }
    }
    const idemKey = keys.idempotency(idempotencyKey);
    const flatFields = Object.entries(job).flat().map((v) => String(v ?? ""));
    const result = await redis.eval(ENQUEUE_JOB_SCRIPT, {
      keys: [keys.ready, jobKey, idemKey],
      arguments: ["1", id, String(expireSeconds), ...flatFields],
    });
    return result;
  }

  await redis.hSet(jobKey, job);
  await redis.lPush(keys.ready, id);
  return id;
}

export async function getJob(redis, keys, id) {
  const jobKey = keys.job(id);
  const job = await redis.hGetAll(jobKey);
  if (!job || Object.keys(job).length === 0) return null;
  return job;
}

export function classifyRetry(err) {
  const msg = (err && (err.message || String(err))) || "";
  const code = err && err.code ? String(err.code) : "";
  const status = err && (err.status || err.statusCode) ? Number(err.status || err.statusCode) : null;

  if (status && status >= 400 && status < 500 && status !== 429) {
    return { retry: false, reason: `http_${status}` };
  }
  if (status === 429) return { retry: true, reason: "http_429" };
  if (status && status >= 500) return { retry: true, reason: `http_${status}` };

  if (code) {
    if (["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ENOTFOUND"].includes(code)) {
      return { retry: true, reason: code.toLowerCase() };
    }
    return { retry: false, reason: code.toLowerCase() };
  }

  if (/timeout/i.test(msg)) return { retry: true, reason: "timeout" };

  return { retry: false, reason: "unknown" };
}

export function computeBackoffMs(retryNumber) {
  // Exponential backoff: 1s / 4s / 16s for retry 1/2/3.
  const n = Math.max(1, Number(retryNumber || 1));
  return 1000 * (4 ** (n - 1));
}

export async function moveDueDelayed(redis, keys, limit = 50) {
  const now = nowMs();
  const maxCount = Math.max(1, Number(limit) || 50);

  if (typeof redis.eval === "function") {
    const moved = await redis.eval(
      `
      local delayed = KEYS[1]
      local ready = KEYS[2]
      local now = tonumber(ARGV[1])
      local max_count = tonumber(ARGV[2])
      local ids = redis.call("ZRANGEBYSCORE", delayed, "-inf", now, "LIMIT", 0, max_count)
      if #ids == 0 then
        return 0
      end
      redis.call("ZREM", delayed, unpack(ids))
      redis.call("LPUSH", ready, unpack(ids))
      return #ids
      `,
      {
        keys: [keys.delayed, keys.ready],
        arguments: [String(now), String(maxCount)],
      },
    );
    return Number(moved) || 0;
  }

  const ids = await redis.zRangeByScore(keys.delayed, 0, now, { LIMIT: { offset: 0, count: maxCount } });
  if (!ids || ids.length === 0) return 0;
  await redis.zRem(keys.delayed, ids);
  await redis.lPush(keys.ready, ...ids);
  return ids.length;
}

export async function markJob(redis, keys, id, patch) {
  const jobKey = keys.job(id);
  const updatedAt = String(nowMs());
  await redis.hSet(jobKey, { ...patch, updated_at_ms: updatedAt });
}

export async function pushDlq(redis, keys, id) {
  await redis.lPush(keys.dlq, id);
}

async function acknowledgeClaim(redis, keys, id) {
  if (!keys.processing || typeof redis.lRem !== "function") return;
  await redis.lRem(keys.processing, 1, id);
}

async function claimReadyJob(redis, keys, opts = {}) {
  if (typeof redis.eval !== "function") {
    throw new Error("Atomic queue claims require Redis EVAL support");
  }
  const workerId = String(opts.workerId || WORKER_INSTANCE_ID);
  const leaseMs = Math.max(10_000, Number(opts.leaseMs || process.env.DIZZY_JOB_LEASE_MS || 300_000) || 300_000);
  const claimedAt = nowMs();
  const result = await redis.eval(
    `
    local id = redis.call("RPOP", KEYS[1])
    if not id then return nil end
    local job_key = ARGV[1] .. id
    if redis.call("HGET", job_key, "status") ~= "queued" then
      return nil
    end
    redis.call("LPUSH", KEYS[2], id)
    redis.call("HSET", job_key,
      "claim_owner", ARGV[2],
      "claim_started_at_ms", ARGV[3],
      "claim_expires_at_ms", ARGV[4])
    return id
    `,
    {
      keys: [keys.ready, keys.processing],
      arguments: [keys.job(""), workerId, String(claimedAt), String(claimedAt + leaseMs)],
    },
  );
  return result ? String(result) : null;
}

async function renewClaimLease(redis, keys, id, workerId, leaseMs) {
  if (typeof redis.eval !== "function") return false;
  const renewed = await redis.eval(
    `
    if redis.call("HGET", KEYS[1], "claim_owner") ~= ARGV[1] then return 0 end
    redis.call("HSET", KEYS[1], "claim_expires_at_ms", ARGV[2])
    return 1
    `,
    {
      keys: [keys.job(id)],
      arguments: [workerId, String(nowMs() + leaseMs)],
    },
  );
  return Number(renewed) === 1;
}

export async function recoverClaimedJobs(redis, keys, opts = {}) {
  if (!keys.processing || typeof redis.lRange !== "function") return { recovered: 0, dead: 0, cleared: 0 };
  const now = Number(opts.nowMs ?? nowMs());
  const ids = await redis.lRange(keys.processing, 0, -1);
  const summary = { recovered: 0, dead: 0, cleared: 0 };
  for (const id of ids || []) {
    const job = await getJob(redis, keys, id);
    if (!job || job.status === "succeeded" || job.status === "dead") {
      await acknowledgeClaim(redis, keys, id);
      summary.cleared += 1;
      continue;
    }
    const claimExpiresAt = Number(job.claim_expires_at_ms || 0);
    if (claimExpiresAt > now) continue;
    if (job.status === "retry_scheduled" && job.next_retry_at_ms) {
      await redis.zAdd(keys.delayed, [{ score: Number(job.next_retry_at_ms), value: id }]);
      await acknowledgeClaim(redis, keys, id);
      summary.recovered += 1;
      continue;
    }

    const effect = String(job.effect || "READ").toUpperCase();
    if (effect === "READ") {
      await markJob(redis, keys, id, {
        status: "queued",
        last_retry_reason: "worker_recovery",
        next_retry_at_ms: "",
        claim_owner: "",
        claim_started_at_ms: "",
        claim_expires_at_ms: "",
      });
      await redis.lPush(keys.ready, id);
      await acknowledgeClaim(redis, keys, id);
      summary.recovered += 1;
      continue;
    }

    await markJob(redis, keys, id, {
      status: "dead",
      last_error: "Worker interrupted during non-READ job; effect is unknown and automatic replay is blocked.",
      last_error_at_ms: String(nowMs()),
      last_retry_reason: "worker_interrupted_unknown_effect",
      next_retry_at_ms: "",
      finished_at_ms: String(nowMs()),
      claim_owner: "",
      claim_started_at_ms: "",
      claim_expires_at_ms: "",
    });
    await pushDlq(redis, keys, id);
    try {
      const jobAfter = await getJob(redis, keys, id);
      if (jobAfter) await notifyJobDeath(redis, keys, jobAfter, { recovered_after_worker_interruption: true });
    } catch {
      // Best-effort notification; the dead status remains authoritative.
    }
    await acknowledgeClaim(redis, keys, id);
    summary.dead += 1;
  }
  return summary;
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const SENSITIVE_FIELD_PATTERN = /(?:authorization|cookie|password|passwd|secret|token|api[_-]?key|credential)/i;

export function redactPersistedValue(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactSecretMaterial(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[REDACTED_CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactPersistedValue(item, seen));

  const sanitized = {};
  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_FIELD_PATTERN.test(key)
      ? "[REDACTED]"
      : redactPersistedValue(item, seen);
  }
  return sanitized;
}

function deadLetterFilePath(atMs = nowMs()) {
  const dt = new Date(atMs);
  const y = String(dt.getFullYear());
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const dlqDir = path.resolve(process.env.DIZZY_DLQ_DIR || DEFAULT_DLQ_DIR);
  return path.join(dlqDir, `dlq-${y}-${m}-${d}.jsonl`);
}

async function notifyJobDeath(redis, keys, job, extra = {}) {
  const notify = redactPersistedValue(safeJsonParse(job.notify_json));
  const channel = notify?.channel || "local";
  const message = {
    notification_id: crypto.randomUUID(),
    kind: "job_dead",
    channel,
    at_ms: nowMs(),
    job: {
      id: job.id,
      type: job.type,
      tool: job.tool,
      effect: job.effect || "READ",
      attempts: Number(job.attempts || "0"),
      max_attempts: Number(job.max_attempts || "0"),
      retry_count: Number(job.retry_count || "0"),
      max_retries: Number(job.max_retries || "0"),
      last_error: job.last_error || "",
      last_retry_reason: job.last_retry_reason || "",
      dead_letter_path: job.dead_letter_path || "",
    },
    notify,
    ...extra,
  };

  await redis.rPush(keys.notify(channel), JSON.stringify(message));
}

export async function acknowledgeNotifications(redis, key, receipts) {
  const expected = Array.isArray(receipts)
    ? receipts.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 200)
    : [];
  if (!expected.length) return 0;

  // Redis scripts execute atomically: either the observed prefix matches every receipt
  // and is trimmed, or no list mutation occurs.
  // Receives expected hashes directly as arguments (no cjson dependency).
  const script = `
    local expected_count = #ARGV
    if expected_count == 0 then return 0 end
    local items = redis.call('LRANGE', KEYS[1], 0, expected_count - 1)
    if #items ~= expected_count then return -1 end
    for i = 1, expected_count do
      if redis.sha1hex(items[i]) ~= ARGV[i] then return -2 end
    end
    redis.call('LTRIM', KEYS[1], expected_count, -1)
    return expected_count
  `;
  const acknowledged = Number(await redis.eval(script, {
    keys: [key],
    arguments: expected,
  }));
  if (acknowledged < 0) {
    const error = new Error("Notification acknowledgement conflict; queue head changed");
    error.code = "NOTIFY_ACK_CONFLICT";
    throw error;
  }
  return acknowledged;
}

export async function runWorkerCycle(redis, keys, runJob, opts = {}) {
  await moveDueDelayed(redis, keys);

  const claimed = await claimReadyJob(redis, keys, opts);
  if (!claimed) {
    return { kind: "idle" };
  }

  const jobId = String(claimed);
  const job = await getJob(redis, keys, jobId);
  if (!job) {
    await acknowledgeClaim(redis, keys, jobId);
    return { kind: "missing", jobId };
  }
  if (job.status === "succeeded" || job.status === "dead") {
    await acknowledgeClaim(redis, keys, jobId);
    return { kind: "skipped", jobId, status: job.status };
  }

  const attemptsBefore = Number(job.attempts || "0");
  const attemptsNow = attemptsBefore + 1;
  const maxAttempts = Number(job.max_attempts || String(DEFAULT_MAX_ATTEMPTS));
  const retryCountBefore = Number(job.retry_count || "0");
  const maxRetries = Number(job.max_retries || String(DEFAULT_MAX_RETRIES));

  const startedAtMs = job.started_at_ms || String(nowMs());
  const workerId = String(opts.workerId || WORKER_INSTANCE_ID);
  const leaseMs = Math.max(10_000, Number(opts.leaseMs || process.env.DIZZY_JOB_LEASE_MS || 300_000) || 300_000);
  await markJob(redis, keys, jobId, {
    status: "running",
    attempts: String(attemptsNow),
    started_at_ms: startedAtMs,
    next_retry_at_ms: "",
  });
  const heartbeat = setInterval(() => {
    renewClaimLease(redis, keys, jobId, workerId, leaseMs).catch(() => {});
  }, Math.max(1000, Math.floor(leaseMs / 3)));
  heartbeat.unref?.();

  try {
    const payload = JSON.parse(job.payload_json || "{}");
    const result = await runJob({ id: jobId, type: job.type, tool: job.tool, payload });
    await markJob(redis, keys, jobId, {
      status: "succeeded",
      result_json: JSON.stringify(redactPersistedValue(result ?? null)),
      last_error: "",
      last_error_at_ms: "",
      last_retry_reason: "",
      next_retry_at_ms: "",
      finished_at_ms: String(nowMs()),
      claim_owner: "",
      claim_started_at_ms: "",
      claim_expires_at_ms: "",
    });
    clearInterval(heartbeat);
    await acknowledgeClaim(redis, keys, jobId);
    return { kind: "succeeded", jobId };
  } catch (err) {
    clearInterval(heartbeat);
    const klass = classifyRetry(err);
    const errMsg = redactSecretMaterial((err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err));
    const errorAtMs = nowMs();
    const effect = String(job.effect || "READ").toUpperCase();
    const retryAllowed = effect === "READ";

    const outOfAttempts = attemptsNow >= maxAttempts;
    const outOfRetries = retryCountBefore >= maxRetries;

    if (!klass.retry || !retryAllowed || outOfAttempts || outOfRetries) {
      let dlqPath = "";
      try {
        dlqPath = deadLetterFilePath(errorAtMs);
        appendJsonl(dlqPath, {
          at_ms: errorAtMs,
          job_id: jobId,
          status: "dead",
          type: job.type,
          tool: job.tool,
          effect,
          attempts: attemptsNow,
          max_attempts: maxAttempts,
          retry_count: retryCountBefore,
          max_retries: maxRetries,
          retryable: Boolean(klass.retry) && retryAllowed,
          retry_reason: klass.reason,
          last_error: errMsg,
          payload: redactPersistedValue(safeJsonParse(job.payload_json)),
          notify: redactPersistedValue(safeJsonParse(job.notify_json)),
        });
      } catch {
        dlqPath = "";
      }

      await markJob(redis, keys, jobId, {
        status: "dead",
        last_error: errMsg,
        last_error_at_ms: String(errorAtMs),
        last_retry_reason: klass.reason,
        next_retry_at_ms: "",
        dead_letter_path: dlqPath,
        finished_at_ms: String(nowMs()),
        claim_owner: "",
        claim_started_at_ms: "",
        claim_expires_at_ms: "",
      });
      await pushDlq(redis, keys, jobId);
      await acknowledgeClaim(redis, keys, jobId);

      try {
        const jobAfter = await getJob(redis, keys, jobId);
        if (jobAfter) await notifyJobDeath(redis, keys, jobAfter);
      } catch {
        // best-effort notification
      }
      return { kind: "dead", jobId, reason: klass.reason };
    }

    const retryNumber = retryCountBefore + 1;
    const backoff = computeBackoffMs(retryNumber);
    const nextAt = nowMs() + backoff;
    await markJob(redis, keys, jobId, {
      status: "retry_scheduled",
      retry_count: String(retryNumber),
      last_error: errMsg,
      last_error_at_ms: String(errorAtMs),
      last_retry_reason: klass.reason,
      next_retry_at_ms: String(nextAt),
      claim_owner: "",
      claim_started_at_ms: "",
      claim_expires_at_ms: "",
    });
    await redis.zAdd(keys.delayed, [{ score: nextAt, value: jobId }]);
    await acknowledgeClaim(redis, keys, jobId);
    return { kind: "retry_scheduled", jobId, reason: klass.reason, nextAt };
  }
}

export async function workerLoop(redis, keys, runJob, opts = {}) {
  const pollMs = opts.pollMs ?? 500;
  const maxCycles = Number.isFinite(Number(opts.maxCycles)) ? Number(opts.maxCycles) : Infinity;
  let cycles = 0;
  await recoverClaimedJobs(redis, keys);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (cycles >= maxCycles) return { cycles };
    cycles += 1;
    try {
      const cycle = await runWorkerCycle(redis, keys, runJob, opts);
      if (cycle.kind === "idle") {
        await sleep(pollMs);
      }
    } catch {
      // If Redis is flaky, don't tight-loop.
      await sleep(1000);
    }
  }
}
