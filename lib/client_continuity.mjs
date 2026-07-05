import fs from "fs";
import path from "path";
import { logAutomationReceipt, redactSecretMaterial } from "./durable_write_policy.mjs";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
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

function normalizeConversationKeyPart(value, fallback = "") {
  return normalizeIdentifier(value, fallback).slice(0, 40);
}

function safeRelative(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { malformed: true, raw: line };
      }
    });
}

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const body = rows.length ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  fs.writeFileSync(filePath, body, "utf8");
}

function appendJsonl(filePath, row) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

export function executionHistoryPath() {
  return path.resolve(process.cwd(), env("DIZZY_EXECUTION_HISTORY_PATH", "runtime/execution_history.jsonl"));
}

export function conversationDir() {
  return path.resolve(process.cwd(), env("DIZZY_CONVERSATION_DIR", "runtime/conversations"));
}

export function deletionLogPath() {
  return path.resolve(process.cwd(), env("DIZZY_CLIENT_CONTINUITY_DELETION_LOG", "runtime/client_continuity_deletions.jsonl"));
}

export function clientContinuityExpiryMs() {
  const days = Number(env("DIZZY_CLIENT_CONTINUITY_EXPIRY_DAYS", "7"));
  const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
  return Math.floor(safeDays * 24 * 60 * 60 * 1000);
}

export function buildClientConversationKey({ client_id, service_id } = {}) {
  const clientId = normalizeConversationKeyPart(client_id, "");
  const serviceId = normalizeConversationKeyPart(service_id, "");
  if (!clientId || !serviceId) return "";
  return `execute_client_${clientId}_${serviceId}`;
}

export function conversationPathForKey(conversationKey, dir = conversationDir()) {
  const key = normalizeIdentifier(conversationKey, "");
  if (!key) return "";
  return path.resolve(dir, `${key}.jsonl`);
}

function isClientContinuityRow(row) {
  return row
    && row.route === "/agent/execute"
    && row.trust_zone === "paid_public"
    && row.retention_scope === "conversation_only"
    && String(row.conversation_key || "").startsWith("execute_client_");
}

function removeClientContinuityRows(conversationKey, historyPath = executionHistoryPath()) {
  const rows = readJsonl(historyPath);
  const kept = [];
  let removed = 0;

  for (const row of rows) {
    if (!row.malformed && row.conversation_key === conversationKey && isClientContinuityRow(row)) {
      removed += 1;
      continue;
    }
    kept.push(row);
  }

  if (removed > 0) writeJsonl(historyPath, kept);
  return removed;
}

function readConversationRows(conversationKey, conversationsDir = conversationDir()) {
  const convoPath = conversationPathForKey(conversationKey, conversationsDir);
  if (!convoPath || !fs.existsSync(convoPath)) return [];
  return readJsonl(convoPath).filter((row) => !row.malformed);
}

function listClientConversationFiles(conversationsDir = conversationDir()) {
  if (!fs.existsSync(conversationsDir)) return [];
  return fs.readdirSync(conversationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^execute_client_[a-z0-9_-]+\.jsonl$/.test(entry.name))
    .map((entry) => {
      const filePath = path.resolve(conversationsDir, entry.name);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
      return {
        conversation_key: entry.name.replace(/\.jsonl$/, ""),
        filePath,
        mtimeMs: stat.mtimeMs,
      };
    })
    .filter(Boolean);
}

function isSensitiveExportKey(key) {
  const lower = String(key || "").toLowerCase();
  return lower === "authorization"
    || lower === "cookie"
    || lower === "credential"
    || lower === "credentials"
    || lower === "password"
    || lower === "passwd"
    || lower === "secret"
    || lower === "token"
    || lower === "api_key"
    || lower === "apikey"
    || lower.endsWith("authorization")
    || lower.endsWith("cookie")
    || lower.endsWith("credential")
    || lower.endsWith("credentials")
    || lower.endsWith("password")
    || lower.endsWith("passwd")
    || lower.endsWith("secret")
    || lower.endsWith("token")
    || lower.endsWith("apikey")
    || lower.endsWith("_api_key")
    || lower.endsWith("-api-key");
}

function scrubExportValue(value, key = "", depth = 0) {
  if (value == null) return value;
  if (isSensitiveExportKey(key)) return "[REDACTED]";
  if (depth > 12) return "[REDACTED_DEPTH]";
  if (typeof value === "string") return redactSecretMaterial(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => scrubExportValue(item, "", depth + 1));
  if (typeof value !== "object") return String(value);

  const out = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    out[childKey] = scrubExportValue(childValue, childKey, depth + 1);
  }
  return out;
}

export function exportClientContinuity({
  client_id,
  service_id,
  conversation_key,
  historyPath = executionHistoryPath(),
  conversationsDir = conversationDir(),
} = {}) {
  const conversationKey = conversation_key
    ? normalizeIdentifier(conversation_key, "")
    : buildClientConversationKey({ client_id, service_id });
  if (!conversationKey) {
    return { ok: false, error: "client_id and service_id, or conversation_key, are required" };
  }

  const historyRows = readJsonl(historyPath)
    .filter((row) => !row.malformed && row.conversation_key === conversationKey && isClientContinuityRow(row));
  const conversationRows = readConversationRows(conversationKey, conversationsDir);

  return scrubExportValue({
    ok: true,
    schema_version: "dizzy.client_continuity.export.v1",
    exported_at: new Date().toISOString(),
    conversation_key: conversationKey,
    scope: "client_continuity",
    format: "json",
    redaction: {
      excludes: [
        "private_self memory",
        "repo retrieval context",
        "credentials",
        "authorization headers",
        "cookies",
        "deleted continuity records",
      ],
    },
    counts: {
      history_rows: historyRows.length,
      conversation_rows: conversationRows.length,
    },
    history: historyRows,
    conversation: conversationRows,
  });
}

export function deleteClientContinuity({
  client_id,
  service_id,
  conversation_key,
  reason = "operator_delete",
  now = new Date(),
  historyPath = executionHistoryPath(),
  conversationsDir = conversationDir(),
  deletionPath = deletionLogPath(),
} = {}) {
  const conversationKey = conversation_key
    ? normalizeIdentifier(conversation_key, "")
    : buildClientConversationKey({ client_id, service_id });
  if (!conversationKey) {
    return { ok: false, error: "client_id and service_id, or conversation_key, are required" };
  }

  const convoPath = conversationPathForKey(conversationKey, conversationsDir);
  const hadConversationFile = Boolean(convoPath && fs.existsSync(convoPath));
  if (hadConversationFile) fs.rmSync(convoPath, { force: true });

  const removedHistoryRows = removeClientContinuityRows(conversationKey, historyPath);
  const deleted = hadConversationFile || removedHistoryRows > 0;
  const row = {
    t: now.toISOString(),
    reason,
    conversation_key: conversationKey,
    removed_conversation_file: hadConversationFile,
    removed_history_rows: removedHistoryRows,
  };
  if (deleted) appendJsonl(deletionPath, row);

  return {
    ok: true,
    deleted,
    conversation_key: conversationKey,
    removed_conversation_file: hadConversationFile,
    removed_history_rows: removedHistoryRows,
    deletion_log_path: safeRelative(deletionPath),
  };
}

export function pruneExpiredClientContinuity({
  nowMs = Date.now(),
  historyPath = executionHistoryPath(),
  conversationsDir = conversationDir(),
  deletionPath = deletionLogPath(),
  expiryMs = clientContinuityExpiryMs(),
  automationReceiptPath = path.resolve(process.cwd(), env("DIZZY_AUTOMATION_RECEIPT_PATH", "runtime/automation_receipts.jsonl")),
} = {}) {
  const rows = readJsonl(historyPath);
  const lastSeen = new Map();

  for (const row of rows) {
    if (row.malformed || !isClientContinuityRow(row)) continue;
    const t = Date.parse(row.t || "");
    if (!Number.isFinite(t)) continue;
    const key = String(row.conversation_key || "");
    lastSeen.set(key, Math.max(lastSeen.get(key) || 0, t));
  }

  const expired = [];
  for (const [conversationKey, lastSeenMs] of lastSeen.entries()) {
    if (nowMs - lastSeenMs > expiryMs) expired.push(conversationKey);
  }

  const orphaned = [];
  for (const file of listClientConversationFiles(conversationsDir)) {
    if (lastSeen.has(file.conversation_key)) continue;
    if (nowMs - file.mtimeMs > expiryMs) orphaned.push(file.conversation_key);
  }

  const deleted = [];
  for (const conversationKey of [...new Set([...expired, ...orphaned])].sort()) {
    const result = deleteClientContinuity({
      conversation_key: conversationKey,
      reason: lastSeen.has(conversationKey) ? "expired" : "expired_orphan",
      now: new Date(nowMs),
      historyPath,
      conversationsDir,
      deletionPath,
    });
    if (result.deleted) deleted.push(result);
  }

  if (deleted.length > 0) {
    logAutomationReceipt({
      action: "prune_expired_client_continuity",
      reason: `Deleted ${deleted.length} expired client continuity record(s) older than ${Math.floor(expiryMs / 86400000)} day(s).`,
      veto_command: "Increase DIZZY_CLIENT_CONTINUITY_EXPIRY_DAYS or disable scheduled pruning before the next run.",
      filePath: automationReceiptPath,
      now: new Date(nowMs),
    });
  }

  return {
    ok: true,
    checked: lastSeen.size,
    expired: expired.length,
    orphaned: orphaned.length,
    deleted: deleted.length,
    deleted_conversation_keys: deleted.map((item) => item.conversation_key),
  };
}
