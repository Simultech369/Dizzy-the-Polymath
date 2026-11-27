/**
 * Unified Hash-Linked Audit Ledger & Debug Replay Store (Phase 1).
 *
 * Consolidates security, routing, tool, memory, A2A, PII-proxy, spend, watchdog,
 * and HITL audit events into one append-only SHA-256 hash-chained JSONL ledger.
 *
 * Strictly separates:
 * - User/Operator Conversation UI (clean status & answers)
 * - Internal Debug / Inspect Replay (`/api/operator/audit-replay`)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { durableAppendJsonl, redactSecretMaterial } from "./durable_write_policy.mjs";
import { scrubPii } from "./tool_guardrails_middleware.mjs";

export const UNIFIED_AUDIT_ENTRY_SCHEMA = "dizzy.unified_audit_entry.v1";
export const UNIFIED_AUDIT_REPLAY_SCHEMA = "dizzy.unified_audit_replay.v1";

const GENESIS_PREV_HASH = "0".repeat(64);

const VALID_SURFACES = new Set([
  "ingress",
  "routing",
  "tool_guardrail",
  "a2a_mailbox",
  "pii_proxy",
  "grounding",
  "memory_hygiene",
  "event_trigger",
  "hitl_approval",
  "cost_guard",
  "watchdog",
  "continuity",
  "system",
]);

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256HexLower(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function sanitizeAuditValue(value, depth = 0) {
  if (depth > 5) return "[TRUNCATED_DEPTH]";
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.length > 600 ? `${value.slice(0, 600)}...[truncated]` : value;
    const secretRedacted = redactSecretMaterial(trimmed);
    return scrubPii(secretRedacted).text;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => sanitizeAuditValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      // Never persist raw conversational prompt/response bodies inside audit metadata
      if (k === "raw_prompt" || k === "raw_response" || k === "authorization" || k === "api_key") {
        out[`${k}_sha256`] = sha256HexLower(String(v ?? ""));
        continue;
      }
      out[k] = sanitizeAuditValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

export class UnifiedAuditLedger {
  constructor(opts = {}) {
    this.ledgerPath = path.resolve(
      process.cwd(),
      opts.ledgerPath || "runtime/audit/unified_audit_ledger.jsonl"
    );
    this.now = opts.now || (() => new Date());
    this.headHash = GENESIS_PREV_HASH;
    this.sequence = 0;
    this._initialize();
  }

  _initialize() {
    fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
    if (!fs.existsSync(this.ledgerPath)) return;

    const lines = fs.readFileSync(this.ledgerPath, "utf8").split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return;

    this.sequence = lines.length;
    try {
      const last = JSON.parse(lines[lines.length - 1]);
      if (typeof last.entry_hash === "string" && /^[a-f0-9]{64}$/.test(last.entry_hash)) {
        this.headHash = last.entry_hash;
      }
    } catch {
      this.headHash = GENESIS_PREV_HASH;
    }
  }

  append({
    surface = "system",
    eventType,
    correlationId = null,
    trustZone = "private_self",
    workflowState = null,
    status = "recorded",
    summary = "",
    receiptSha256 = null,
    metadata = {},
    now = null,
  } = {}) {
    if (!eventType || typeof eventType !== "string") {
      throw new Error("UnifiedAuditLedger.append requires a non-empty eventType");
    }

    const safeSurface = VALID_SURFACES.has(surface) ? surface : "system";
    const tsVal = typeof (now || this.now) === "function" ? (now || this.now)() : (now || this.now);
    const timestamp = tsVal instanceof Date ? tsVal.toISOString() : new Date(tsVal || Date.now()).toISOString();

    this.sequence += 1;
    const core = {
      schema_version: UNIFIED_AUDIT_ENTRY_SCHEMA,
      seq: this.sequence,
      timestamp,
      surface: safeSurface,
      event_type: String(eventType).trim(),
      correlation_id: correlationId ? String(correlationId).trim().slice(0, 128) : `corr_${this.sequence}`,
      trust_zone: String(trustZone || "private_self").trim(),
      workflow_state: workflowState ? String(workflowState).trim() : null,
      status: String(status || "recorded").trim(),
      summary: sanitizeAuditValue(String(summary || "")),
      linked_receipt_sha256: receiptSha256 ? String(receiptSha256) : null,
      metadata: sanitizeAuditValue(metadata || {}),
      prev_hash: this.headHash,
    };

    const entryHash = sha256HexLower(stableJson(core));
    const fullEntry = {
      ...core,
      entry_hash: entryHash,
    };

    durableAppendJsonl(this.ledgerPath, fullEntry);
    this.headHash = entryHash;
    return fullEntry;
  }

  readAll() {
    if (!fs.existsSync(this.ledgerPath)) return [];
    const lines = fs.readFileSync(this.ledgerPath, "utf8").split(/\r?\n/).filter(Boolean);
    const entries = [];
    for (const line of lines) {
      entries.push(JSON.parse(line));
    }
    return entries;
  }

  verifyChain() {
    const entries = this.readAll();
    let expectedPrev = GENESIS_PREV_HASH;

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const { entry_hash: recordedHash, ...core } = entry;
      if (core.prev_hash !== expectedPrev) {
        return {
          valid: false,
          broken_at_seq: core.seq ?? (i + 1),
          reason: `prev_hash_mismatch: expected ${expectedPrev}, got ${core.prev_hash}`,
          entry_count: entries.length,
        };
      }
      const computed = sha256HexLower(stableJson(core));
      if (recordedHash !== computed) {
        return {
          valid: false,
          broken_at_seq: core.seq ?? (i + 1),
          reason: `entry_hash_tampered: recorded ${recordedHash}, computed ${computed}`,
          entry_count: entries.length,
        };
      }
      expectedPrev = recordedHash;
    }

    return {
      valid: true,
      entry_count: entries.length,
      head_hash: expectedPrev,
    };
  }

  /**
   * Reconstructs an ordered debug replay session for a correlation/run ID.
   * Intended for `/api/operator/audit-replay` and Inspect drawers, never main chat UI.
   */
  replayCorrelation(correlationId) {
    const target = String(correlationId || "").trim();
    const chainStatus = this.verifyChain();
    const all = this.readAll();
    const steps = target
      ? all.filter((e) => e.correlation_id === target)
      : all.slice(-50);

    return {
      schema_version: UNIFIED_AUDIT_REPLAY_SCHEMA,
      view_mode: "internal_debug_replay",
      not_for_end_user_chat: true,
      correlation_id: target || "recent_tail",
      chain_verified: chainStatus.valid,
      ledger_head_hash: chainStatus.head_hash || null,
      step_count: steps.length,
      surfaces_touched: [...new Set(steps.map((s) => s.surface))],
      steps,
    };
  }

  listRecent({ surface = null, limit = 50 } = {}) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const all = this.readAll();
    const filtered = surface ? all.filter((e) => e.surface === surface) : all;
    return filtered.slice(-safeLimit).reverse();
  }
}
