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

export function isClientContinuityRow(row) {
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

function countJsonlLines(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const text = fs.readFileSync(filePath, "utf8").trim();
    return text ? text.split(/\r?\n/).length : 0;
  } catch {
    return 0;
  }
}

export function listClientConversationFiles(conversationsDir = conversationDir()) {
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
        path: safeRelative(filePath),
        size_bytes: stat.size,
        line_count: countJsonlLines(filePath),
        modified_at: new Date(stat.mtimeMs).toISOString(),
        mtimeMs: stat.mtimeMs,
      };
    })
    .filter(Boolean);
}

function latestHistoryByConversationKey(historyPath = executionHistoryPath()) {
  const out = new Map();
  for (const row of readJsonl(historyPath)) {
    if (row.malformed || !isClientContinuityRow(row)) continue;
    const key = String(row.conversation_key || "");
    const t = Date.parse(row.t || "");
    const existing = out.get(key) || { rows: 0, last_seen_ms: 0, last_row: null };
    existing.rows += 1;
    if (Number.isFinite(t) && t >= existing.last_seen_ms) {
      existing.last_seen_ms = t;
      existing.last_row = row;
    } else if (!existing.last_row) {
      existing.last_row = row;
    }
    out.set(key, existing);
  }
  return out;
}

function continuityExpirySummary({ file, history, expiryMs, nowMs }) {
  const basisMs = history?.last_seen_ms || file?.mtimeMs || 0;
  if (!basisMs) {
    return {
      basis: "unknown",
      expires_at: null,
      expired: false,
      remaining_ms: null,
      remaining_hours: null,
    };
  }

  const remainingMs = basisMs + expiryMs - nowMs;
  return {
    basis: history?.last_seen_ms ? "history_last_seen" : "file_mtime",
    expires_at: new Date(basisMs + expiryMs).toISOString(),
    expired: remainingMs <= 0,
    remaining_ms: remainingMs,
    remaining_hours: Math.max(0, Math.floor(remainingMs / 3600000)),
  };
}

export function buildContinuityReport({ nowMs = Date.now() } = {}) {
  const files = new Map(listClientConversationFiles().map((file) => [file.conversation_key, file]));
  const history = latestHistoryByConversationKey();
  const expiryMs = clientContinuityExpiryMs();
  const keys = [...new Set([...files.keys(), ...history.keys()])].sort();
  const records = keys.map((key) => {
    const file = files.get(key) || null;
    const h = history.get(key) || null;
    const row = h?.last_row || {};
    return {
      conversation_key: key,
      client_id: row.client_id || null,
      service_id: row.service_id || null,
      ownership_source: row.client_id || row.service_id ? "execution_history" : "unresolved",
      file: file ? {
        exists: true,
        path: file.path,
        size_bytes: file.size_bytes,
        line_count: file.line_count,
        modified_at: file.modified_at,
      } : { exists: false },
      history: {
        rows: h?.rows || 0,
        last_seen_at: h?.last_seen_ms ? new Date(h.last_seen_ms).toISOString() : null,
      },
      expiry: continuityExpirySummary({ file, history: h, expiryMs, nowMs }),
    };
  });

  return {
    ok: true,
    schema_version: "dizzy.operator_continuity.list.v1",
    generated_at: new Date(nowMs).toISOString(),
    history_path: safeRelative(executionHistoryPath()),
    conversation_dir: safeRelative(conversationDir()),
    deletion_log_path: safeRelative(deletionLogPath()),
    expiry_days: Math.floor(expiryMs / 86400000),
    counts: {
      records: records.length,
      with_files: records.filter((record) => record.file.exists).length,
      with_history: records.filter((record) => record.history.rows > 0).length,
      expired: records.filter((record) => record.expiry.expired).length,
    },
    records,
  };
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

function addStrings(target, values) {
  const list = Array.isArray(values) ? values : [values];
  for (const value of list) {
    const item = String(value || "").trim();
    if (item) target.add(item);
  }
}

function addFilteredItems(target, values) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    const pathValue = String(value?.path || value?.id || "").trim();
    const reason = String(value?.reason || "").trim();
    if (!pathValue || !reason) continue;
    const details = String(value?.details || "").trim();
    target.set(`${pathValue}\u0000${reason}\u0000${details}`, {
      path: pathValue,
      reason,
      details,
    });
  }
}

function addSkillManifests(target, values) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    const name = String(value?.name || "").trim();
    if (!name) continue;
    target.set(name, {
      name,
      version: String(value?.version || "").trim(),
      provides: String(value?.provides || "").trim(),
      required_tools: Array.isArray(value?.required_tools) ? value.required_tools.map(String).map((item) => item.trim()).filter(Boolean) : [],
      permissions: String(value?.permissions || "").trim(),
      external_services: String(value?.external_services || "").trim(),
      validation_path: String(value?.validation_path || "").trim(),
      rollback_path: String(value?.rollback_path || "").trim(),
      receipt_fields: Array.isArray(value?.receipt_fields) ? value.receipt_fields.map(String).map((item) => item.trim()).filter(Boolean) : [],
    });
  }
}

export function buildContinuityAudit({
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

  const exported = exportClientContinuity({
    conversation_key: conversationKey,
    historyPath,
    conversationsDir,
  });
  if (!exported.ok) return exported;

  const historyRows = Array.isArray(exported.history) ? exported.history : [];
  const conversationRows = Array.isArray(exported.conversation) ? exported.conversation : [];
  const trustZones = new Set();
  const retentionScopes = new Set();
  const continuityModes = new Set();
  const blockedContext = new Set();
  const retrievedFiles = new Set();
  const trajectoryIds = new Set();
  const filteredFiles = new Map();
  const loadedSkills = new Set();
  const skillManifests = new Map();
  let durableMemoryAllowed = false;
  let repoRetrievalAllowed = false;
  let privateMemoryAccess = false;

  for (const row of historyRows) {
    const receipt = row?.capability_receipt && typeof row.capability_receipt === "object" ? row.capability_receipt : {};
    const retrievalAudit = receipt?.retrieval_audit && typeof receipt.retrieval_audit === "object" ? receipt.retrieval_audit : {};
    const boundaryCrossing = receipt?.boundary_crossing && typeof receipt.boundary_crossing === "object" ? receipt.boundary_crossing : {};
    const skills = receipt?.skills && typeof receipt.skills === "object" ? receipt.skills : {};

    addStrings(trustZones, [row?.trust_zone, receipt.trust_zone]);
    addStrings(retentionScopes, [row?.retention_scope, receipt.retention_scope, boundaryCrossing.retention_scope]);
    addStrings(continuityModes, [row?.continuity_mode, receipt.continuity_mode]);
    addStrings(blockedContext, row?.blocked_context);
    addStrings(blockedContext, receipt.blocked_context);
    addStrings(blockedContext, boundaryCrossing.blocked_context);
    addStrings(retrievedFiles, row?.retrieved_files);
    addStrings(retrievedFiles, receipt.retrieved_files);
    addStrings(retrievedFiles, retrievalAudit.rag?.files);
    addStrings(retrievedFiles, retrievalAudit.memory_graph?.files);
    addStrings(trajectoryIds, retrievalAudit.trajectories?.ids);
    addFilteredItems(filteredFiles, retrievalAudit.rag?.filtered);
    addStrings(loadedSkills, skills.loaded);
    addSkillManifests(skillManifests, skills.manifests);

    durableMemoryAllowed = durableMemoryAllowed || Boolean(row?.durable_memory_allowed || receipt.durable_memory_allowed);
    repoRetrievalAllowed = repoRetrievalAllowed || Boolean(row?.repo_retrieval_allowed || receipt.repo_retrieval_allowed || retrievalAudit.allowed);
    privateMemoryAccess = privateMemoryAccess || Boolean(receipt.private_memory_access);
  }

  const conversationPath = conversationPathForKey(conversationKey, conversationsDir);
  return scrubExportValue({
    ok: true,
    schema_version: "dizzy.client_continuity.audit.v1",
    generated_at: new Date().toISOString(),
    conversation_key: conversationKey,
    source: {
      history_path: safeRelative(historyPath),
      conversation_path: conversationPath ? safeRelative(conversationPath) : null,
      conversation_file_exists: Boolean(conversationPath && fs.existsSync(conversationPath)),
    },
    counts: {
      history_rows: historyRows.length,
      conversation_rows: conversationRows.length,
      trust_zones: trustZones.size,
      blocked_context: blockedContext.size,
      retrieved_files: retrievedFiles.size,
      trajectory_ids: trajectoryIds.size,
      filtered_files: filteredFiles.size,
      loaded_skills: loadedSkills.size,
      skill_manifests: skillManifests.size,
    },
    boundary: {
      trust_zones: [...trustZones].sort(),
      continuity_modes: [...continuityModes].sort(),
      retention_scopes: [...retentionScopes].sort(),
      durable_memory_allowed: durableMemoryAllowed,
      repo_retrieval_allowed: repoRetrievalAllowed,
      private_memory_access: privateMemoryAccess,
      blocked_context: [...blockedContext].sort(),
    },
    retrieval: {
      retrieved_files: [...retrievedFiles].sort(),
      trajectory_ids: [...trajectoryIds].sort(),
      filtered_files: [...filteredFiles.values()].sort((a, b) => {
        if (a.path !== b.path) return a.path < b.path ? -1 : 1;
        if (a.reason !== b.reason) return a.reason < b.reason ? -1 : 1;
        return a.details < b.details ? -1 : a.details > b.details ? 1 : 0;
      }),
    },
    skills: {
      loaded: [...loadedSkills].sort(),
      manifests: [...skillManifests.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    },
    conversation: {
      rows: conversationRows.length,
      roles: [...new Set(conversationRows.map((row) => String(row?.role || "").trim()).filter(Boolean))].sort(),
    },
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
