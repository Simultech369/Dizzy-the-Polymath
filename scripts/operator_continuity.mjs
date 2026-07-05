#!/usr/bin/env node
import fs from "fs";
import path from "path";

import {
  clientContinuityExpiryMs,
  conversationDir,
  conversationPathForKey,
  deleteClientContinuity,
  deletionLogPath,
  executionHistoryPath,
  exportClientContinuity,
} from "../lib/client_continuity.mjs";

const CLIENT_CONVERSATION_FILE = /^execute_client_[a-z0-9_-]+\.jsonl$/;

function usage() {
  return [
    "Usage:",
    "  node scripts/operator_continuity.mjs list [--json]",
    "  node scripts/operator_continuity.mjs export <conversation_key>",
    "  node scripts/operator_continuity.mjs delete <conversation_key>",
  ].join("\n");
}

function relativePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return path.relative(process.cwd(), raw).replace(/\\/g, "/") || ".";
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

function countJsonlLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const text = fs.readFileSync(filePath, "utf8").trim();
  return text ? text.split(/\r?\n/).length : 0;
}

function isClientContinuityRow(row) {
  return row
    && !row.malformed
    && row.route === "/agent/execute"
    && row.trust_zone === "paid_public"
    && row.retention_scope === "conversation_only"
    && String(row.conversation_key || "").startsWith("execute_client_");
}

function listConversationFiles(dir = conversationDir()) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && CLIENT_CONVERSATION_FILE.test(entry.name))
    .map((entry) => {
      const filePath = path.resolve(dir, entry.name);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
      return {
        conversation_key: entry.name.replace(/\.jsonl$/, ""),
        path: relativePath(filePath),
        size_bytes: stat.size,
        line_count: countJsonlLines(filePath),
        modified_at: new Date(stat.mtimeMs).toISOString(),
        mtime_ms: stat.mtimeMs,
      };
    })
    .filter(Boolean);
}

function latestHistoryByKey(historyPath = executionHistoryPath()) {
  const out = new Map();
  for (const row of readJsonl(historyPath)) {
    if (!isClientContinuityRow(row)) continue;
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

function expirySummary({ file, history, expiryMs, nowMs }) {
  const basisMs = history?.last_seen_ms || file?.mtime_ms || 0;
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

function buildContinuityReport({ nowMs = Date.now() } = {}) {
  const files = new Map(listConversationFiles().map((file) => [file.conversation_key, file]));
  const history = latestHistoryByKey();
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
      expiry: expirySummary({ file, history: h, expiryMs, nowMs }),
    };
  });

  return {
    ok: true,
    schema_version: "dizzy.operator_continuity.list.v1",
    generated_at: new Date(nowMs).toISOString(),
    history_path: relativePath(executionHistoryPath()),
    conversation_dir: relativePath(conversationDir()),
    deletion_log_path: relativePath(deletionLogPath()),
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

function printHumanList(report) {
  console.log(`Client continuity records (${report.counts.records})`);
  console.log(`history=${report.history_path}`);
  console.log(`conversations=${report.conversation_dir}`);
  console.log(`retention_days=${report.expiry_days}`);
  if (!report.records.length) {
    console.log("No active client continuity records found.");
    return;
  }

  for (const record of report.records) {
    const expiry = record.expiry.expired
      ? "expired"
      : record.expiry.remaining_hours == null
        ? "unknown"
        : `${record.expiry.remaining_hours}h remaining`;
    console.log("");
    console.log(`- ${record.conversation_key}`);
    console.log(`  client_id: ${record.client_id || "unknown"}`);
    console.log(`  service_id: ${record.service_id || "unknown"}`);
    console.log(`  ownership_source: ${record.ownership_source}`);
    console.log(`  file: ${record.file.exists ? `${record.file.path} (${record.file.size_bytes} bytes, ${record.file.line_count} lines)` : "missing"}`);
    console.log(`  history_rows: ${record.history.rows}`);
    console.log(`  last_seen: ${record.history.last_seen_at || "unknown"}`);
    console.log(`  expiry: ${expiry} (${record.expiry.basis})`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  try {
    if (command === "help" || command === "--help" || command === "-h") {
      console.log(usage());
      return;
    }

    if (command === "list") {
      const report = buildContinuityReport();
      if (args.includes("--json")) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printHumanList(report);
      }
      return;
    }

    if (command === "export") {
      const key = args[1] || "";
      if (!key) throw new Error("export requires <conversation_key>");
      const result = exportClientContinuity({ conversation_key: key });
      if (!result.ok) {
        console.error(result.error || "export failed");
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "delete") {
      const key = args[1] || "";
      if (!key) throw new Error("delete requires <conversation_key>");
      const result = deleteClientContinuity({ conversation_key: key, reason: "operator_cli_delete" });
      if (!result.ok) {
        console.error(result.error || "delete failed");
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (err) {
    console.error(String(err?.message || err));
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  }
}

main();
