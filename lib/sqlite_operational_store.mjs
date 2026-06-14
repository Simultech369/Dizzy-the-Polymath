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

export function openOperationalStore(filePath) {
  const resolved = filePath === ":memory:" ? ":memory:" : path.resolve(filePath);
  if (resolved !== ":memory:") fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new DatabaseSync(resolved);
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("PRAGMA busy_timeout=5000");
  if (resolved !== ":memory:") db.exec("PRAGMA journal_mode=WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
    INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, '${nowIso()}');

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
      created_at TEXT NOT NULL
    ) STRICT;
  `);

  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* transaction already closed */ }
      throw error;
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
    const timestamp = nowIso();
    return transaction(() => {
      db.prepare("INSERT INTO jobs(job_id, status, effect, version, created_at, updated_at) VALUES (?, 'queued', ?, 0, ?, ?)")
        .run(id, normalizedEffect, timestamp, timestamp);
      db.prepare("INSERT INTO job_events(job_id, from_status, to_status, reason, idempotency_key, created_at) VALUES (?, NULL, 'queued', 'created', ?, ?)")
        .run(id, idempotencyKey || null, timestamp);
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
    const timestamp = nowIso();
    return transaction(() => {
      if (idempotencyKey) {
        const existing = db.prepare("SELECT job_id FROM job_events WHERE idempotency_key=?").get(idempotencyKey);
        if (existing && existing.job_id !== id) {
          throw new Error(`Idempotency key conflict: ${idempotencyKey}`);
        }
        if (existing) return getJob(id);
      }
      const update = db.prepare(`
        UPDATE jobs SET status=?, version=version+1, updated_at=?
        WHERE job_id=? AND status=?
      `).run(to, timestamp, id, from);
      if (Number(update.changes) !== 1) throw new Error(`Job transition conflict for ${id}: expected ${from}`);
      db.prepare("INSERT INTO job_events(job_id, from_status, to_status, reason, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, from, to, String(reason), idempotencyKey || null, timestamp);
      return getJob(id);
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

  return {
    db,
    transaction,
    appendConversationExchange,
    createJob,
    transitionJob,
    getJob,
    getConversationEvents,
    integrityCheck,
    close: () => db.close(),
  };
}
