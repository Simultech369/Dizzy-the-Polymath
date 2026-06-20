import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const JOB_STATUSES = new Set(["queued", "running", "retry_scheduled", "succeeded", "dead"]);
const ALLOWED_TRANSITIONS = new Map([
  ["queued", new Set(["running", "dead"])],
  ["running", new Set(["retry_scheduled", "succeeded", "dead"])],
  ["retry_scheduled", new Set(["running", "dead"])],
  ["succeeded", new Set()],
  ["dead", new Set()],
]);

function normalizeKey(value, fallback) {
  const out = String(value ?? "").trim().slice(0, 200);
  return out || fallback;
}

function nowIso() {
  return new Date().toISOString();
}

export function openOperationalStore(filePath, opts = {}) {
  const resolved = filePath === ":memory:" ? ":memory:" : path.resolve(filePath);
  if (resolved !== ":memory:") fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new DatabaseSync(resolved);
  try {
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(`PRAGMA busy_timeout=${Math.max(1, Number(opts.busyTimeoutMs || 5000) || 5000)}`);
    if (resolved !== ":memory:") {
      db.exec("PRAGMA journal_mode=WAL");
      db.exec("PRAGMA synchronous=NORMAL");
      db.exec(`PRAGMA wal_autocheckpoint=${Math.max(1, Number(opts.walAutocheckpoint || 1000) || 1000)}`);
      db.exec(`PRAGMA journal_size_limit=${Math.max(1024 * 1024, Number(opts.journalSizeLimitBytes || 16777216) || 16777216)}`);
    }
    db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_key TEXT PRIMARY KEY,
      next_sequence INTEGER NOT NULL DEFAULT 1 CHECK(next_sequence >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS conversation_events (
      id INTEGER PRIMARY KEY,
      conversation_key TEXT NOT NULL REFERENCES conversations(conversation_key) ON DELETE CASCADE,
      sequence INTEGER NOT NULL CHECK(sequence >= 1),
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(conversation_key, sequence)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'retry_scheduled', 'succeeded', 'dead')),
      effect TEXT NOT NULL CHECK(effect IN ('READ', 'WRITE')),
      version INTEGER NOT NULL DEFAULT 0 CHECK(version >= 0),
      claim_owner TEXT,
      claim_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS job_events (
      id INTEGER PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      idempotency_key TEXT UNIQUE,
      operation_fingerprint TEXT,
      created_at TEXT NOT NULL
    ) STRICT;
    `);
    db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, ?)").run(nowIso());

    // Check if jobs table needs migration (v2)
    const tableInfo = db.prepare("PRAGMA table_info(jobs)").all();
    const hasClaimOwner = tableInfo.some(col => col.name === "claim_owner");
    if (!hasClaimOwner) {
      db.exec(`
        ALTER TABLE jobs ADD COLUMN claim_owner TEXT;
        ALTER TABLE jobs ADD COLUMN claim_expires_at TEXT;
      `);
      db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (2, ?)").run(nowIso());
    }
    const eventTableInfo = db.prepare("PRAGMA table_info(job_events)").all();
    const hasOperationFingerprint = eventTableInfo.some(col => col.name === "operation_fingerprint");
    if (!hasOperationFingerprint) {
      db.exec("ALTER TABLE job_events ADD COLUMN operation_fingerprint TEXT");
    }
    db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (3, ?)").run(nowIso());
  } catch (error) {
    try { db.close(); } catch { /* best effort after failed initialization */ }
    throw error;
  }

  let inTransaction = false;
  function transaction(fn) {
    if (typeof fn !== "function") throw new TypeError("transaction callback must be a function");
    if (fn.constructor?.name === "AsyncFunction") throw new TypeError("transaction callback must be synchronous");
    if (inTransaction) {
      throw new Error("Nested transactions are not supported");
    }
    inTransaction = true;
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      if (result && typeof result.then === "function") throw new TypeError("transaction callback must be synchronous");
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* transaction already closed */ }
      throw error;
    } finally {
      inTransaction = false;
    }
  }

  function appendConversationExchange({ conversationKey, userText, assistantText }) {
    const key = normalizeKey(conversationKey, "conversation_unknown");
    const timestamp = nowIso();
    return transaction(() => {
      db.prepare(`
        INSERT INTO conversations(conversation_key, next_sequence, created_at, updated_at)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(conversation_key) DO UPDATE SET updated_at=excluded.updated_at
      `).run(key, timestamp, timestamp);
      const row = db.prepare("SELECT next_sequence FROM conversations WHERE conversation_key=?").get(key);
      const sequence = Number(row.next_sequence);
      const insert = db.prepare(`
        INSERT INTO conversation_events(conversation_key, sequence, role, text, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      insert.run(key, sequence, "user", String(userText ?? ""), timestamp);
      insert.run(key, sequence + 1, "assistant", String(assistantText ?? ""), timestamp);
      db.prepare("UPDATE conversations SET next_sequence=?, updated_at=? WHERE conversation_key=?")
        .run(sequence + 2, timestamp, key);
      return { conversation_key: key, user_sequence: sequence, assistant_sequence: sequence + 1 };
    });
  }

  function createJob({ jobId, effect = "READ", idempotencyKey = "" }) {
    const id = normalizeKey(jobId, "job_unknown");
    const normalizedEffect = String(effect).toUpperCase() === "WRITE" ? "WRITE" : "READ";
    const operationFingerprint = JSON.stringify({ operation: "createJob", job_id: id, effect: normalizedEffect });
    const timestamp = nowIso();
    return transaction(() => {
      if (idempotencyKey) {
        const existing = db.prepare(`
          SELECT e.job_id, e.from_status, e.to_status, e.operation_fingerprint, j.effect
          FROM job_events e JOIN jobs j ON j.job_id=e.job_id
          WHERE e.idempotency_key=?
        `).get(idempotencyKey);
        if (existing && existing.job_id !== id) {
          throw new Error(`Idempotency key conflict: ${idempotencyKey}`);
        }
        if (existing && existing.operation_fingerprint && existing.operation_fingerprint !== operationFingerprint) {
          throw new Error(`Idempotency request conflict: ${idempotencyKey}`);
        }
        if (existing && !existing.operation_fingerprint
          && (existing.from_status !== null || existing.to_status !== "queued" || existing.effect !== normalizedEffect)) {
          throw new Error(`Idempotency request conflict: ${idempotencyKey}`);
        }
        if (existing) return getJob(id);
      }
      db.prepare("INSERT INTO jobs(job_id, status, effect, version, created_at, updated_at) VALUES (?, 'queued', ?, 0, ?, ?)")
        .run(id, normalizedEffect, timestamp, timestamp);
      db.prepare("INSERT INTO job_events(job_id, from_status, to_status, reason, idempotency_key, operation_fingerprint, created_at) VALUES (?, NULL, 'queued', 'created', ?, ?, ?)")
        .run(id, idempotencyKey || null, operationFingerprint, timestamp);
      return getJob(id);
    });
  }

  function transitionJob({ jobId, fromStatus, toStatus, reason = "", idempotencyKey = "" }) {
    const id = normalizeKey(jobId, "job_unknown");
    const from = String(fromStatus || "").trim();
    const to = String(toStatus || "").trim();
    if (!JOB_STATUSES.has(from) || !JOB_STATUSES.has(to) || !ALLOWED_TRANSITIONS.get(from)?.has(to)) {
      throw new Error(`Invalid job transition: ${from} -> ${to}`);
    }
    const normalizedReason = String(reason);
    const operationFingerprint = JSON.stringify({ operation: "transitionJob", job_id: id, from, to });
    const timestamp = nowIso();
    return transaction(() => {
      if (idempotencyKey) {
        const existing = db.prepare("SELECT job_id, from_status, to_status, reason, operation_fingerprint FROM job_events WHERE idempotency_key=?").get(idempotencyKey);
        if (existing && existing.job_id !== id) {
          throw new Error(`Idempotency key conflict: ${idempotencyKey}`);
        }
        if (existing && existing.operation_fingerprint && existing.operation_fingerprint !== operationFingerprint) {
          throw new Error(`Idempotency request conflict: ${idempotencyKey}`);
        }
        if (existing && !existing.operation_fingerprint
          && (existing.from_status !== from || existing.to_status !== to)) {
          throw new Error(`Idempotency request conflict: ${idempotencyKey}`);
        }
        if (existing) return getJob(id);
      }
      const update = db.prepare(`
        UPDATE jobs SET status=?, version=version+1, updated_at=?
        WHERE job_id=? AND status=?
      `).run(to, timestamp, id, from);
      if (Number(update.changes) !== 1) throw new Error(`Job transition conflict for ${id}: expected ${from}`);
      db.prepare("INSERT INTO job_events(job_id, from_status, to_status, reason, idempotency_key, operation_fingerprint, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(id, from, to, normalizedReason, idempotencyKey || null, operationFingerprint, timestamp);
      return getJob(id);
    });
  }

  function claimNextJob({ workerId, leaseMs = 300000 }) {
    if (!workerId) throw new Error("workerId is required to claim a job");
    const now = nowIso();
    const expiresAt = new Date(Date.now() + leaseMs).toISOString();
    return transaction(() => {
      while (true) {
        const job = db.prepare(`
          SELECT job_id, status, effect FROM jobs
          WHERE status = 'queued'
             OR (status = 'running' AND claim_expires_at IS NOT NULL AND claim_expires_at < ?)
          ORDER BY created_at ASC LIMIT 1
        `).get(now);

        if (!job) return null;

        if (job.status === "running") {
          // Expired job lease safety: check effect
          if (job.effect !== "READ") {
            // Fail-closed for WRITE effect: mark dead immediately
            db.prepare(`
              UPDATE jobs
              SET status = 'dead',
                  version = version + 1,
                  updated_at = ?
              WHERE job_id = ? AND status = 'running'
            `).run(now, job.job_id);

            db.prepare(`
              INSERT INTO job_events(job_id, from_status, to_status, reason, created_at)
              VALUES (?, 'running', 'dead', 'worker interrupted during non-READ job; automatic replay blocked', ?)
            `).run(job.job_id, now);

            continue; // Loop to find another job
          }
        }

        const fromStatus = job.status;
        const update = db.prepare(`
          UPDATE jobs
          SET status = 'running',
              claim_owner = ?,
              claim_expires_at = ?,
              version = version + 1,
              updated_at = ?
          WHERE job_id = ? AND status = ?
        `).run(workerId, expiresAt, now, job.job_id, fromStatus);

        if (Number(update.changes) !== 1) {
          continue; // Concurrent update, try again
        }

        db.prepare(`
          INSERT INTO job_events(job_id, from_status, to_status, reason, created_at)
          VALUES (?, ?, 'running', ?, ?)
        `).run(job.job_id, fromStatus, `claimed by ${workerId}`, now);

        return getJob(job.job_id);
      }
    });
  }

  function getJob(jobId) {
    return db.prepare("SELECT * FROM jobs WHERE job_id=?").get(normalizeKey(jobId, "job_unknown")) ?? null;
  }

  function getConversationEvents(conversationKey) {
    return db.prepare(`
      SELECT conversation_key, sequence, role, text, created_at
      FROM conversation_events WHERE conversation_key=? ORDER BY sequence
    `).all(normalizeKey(conversationKey, "conversation_unknown"));
  }

  function integrityCheck() {
    return db.prepare("PRAGMA integrity_check").get().integrity_check;
  }

  function checkpoint(mode = "PASSIVE") {
    const normalized = ["PASSIVE", "FULL", "RESTART", "TRUNCATE"].includes(String(mode).toUpperCase())
      ? String(mode).toUpperCase()
      : "PASSIVE";
    return db.prepare(`PRAGMA wal_checkpoint(${normalized})`).get();
  }

  return {
    db,
    transaction,
    appendConversationExchange,
    createJob,
    transitionJob,
    claimNextJob,
    getJob,
    getConversationEvents,
    integrityCheck,
    checkpoint,
    close: () => db.close(),
  };
}
