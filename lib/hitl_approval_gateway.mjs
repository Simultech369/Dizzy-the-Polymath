/**
 * Human-In-The-Loop (HITL) Approval Gateway & Immutable Audit Log.
 *
 * Implements high-stakes execution checkpoints, dual-control resume tokens,
 * operator approval/rejection workflows, and hash-chained audit trails.
 *
 * Schemas:
 * - dizzy.hitl_checkpoint.v1
 * - dizzy.hitl_resolution.v1
 * - dizzy.hitl_audit_entry.v1
 *
 * Authority: Fail-closed gatekeeper for high-stakes routing and fiduciary operations.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { durableAppendJsonl, redactSecretMaterial } from "./durable_write_policy.mjs";

export const HITL_CHECKPOINT_SCHEMA = "dizzy.hitl_checkpoint.v1";
export const HITL_RESOLUTION_SCHEMA = "dizzy.hitl_resolution.v1";
export const HITL_AUDIT_ENTRY_SCHEMA = "dizzy.hitl_audit_entry.v1";

const DEFAULT_SECRET = "dizzy-hitl-gateway-default-secret-salt-32b";
const GENESIS_PREV_HASH = "0".repeat(64);

export function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

export function hmacSha256Hex(secret, text) {
  return crypto.createHmac("sha256", String(secret)).update(String(text ?? ""), "utf8").digest("hex");
}

export function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function isoNow(now) {
  const value = typeof now === "function" ? now() : now;
  return value instanceof Date ? value.toISOString() : new Date(value || Date.now()).toISOString();
}

export class HitlApprovalGateway {
  constructor(opts = {}) {
    this.ledgerDir = path.resolve(process.cwd(), opts.ledgerDir || "runtime/hitl");
    this.secret = String(opts.secret || process.env.HITL_GATEWAY_SECRET || DEFAULT_SECRET);
    this.now = opts.now || (() => new Date());
    this.defaultTtlSec = Math.max(60, Number(opts.defaultTtlSec || 86400)); // Default 24h

    this.checkpointsPath = path.join(this.ledgerDir, "checkpoints.jsonl");
    this.auditLogPath = path.join(this.ledgerDir, "audit_log.jsonl");

    // In-memory cache for fast lookups
    this.checkpoints = new Map();
    this.lastAuditHash = GENESIS_PREV_HASH;

    this._initialize();
  }

  _initialize() {
    fs.mkdirSync(this.ledgerDir, { recursive: true });

    // Load existing checkpoints
    if (fs.existsSync(this.checkpointsPath)) {
      const lines = fs.readFileSync(this.checkpointsPath, "utf8").split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.checkpoint_id) {
            this.checkpoints.set(entry.checkpoint_id, entry);
          }
        } catch {
          // Ignore partial or corrupted lines during initial load
        }
      }
    }

    // Determine latest hash from audit log
    if (fs.existsSync(this.auditLogPath)) {
      const lines = fs.readFileSync(this.auditLogPath, "utf8").split(/\r?\n/).filter(Boolean);
      if (lines.length > 0) {
        try {
          const lastEntry = JSON.parse(lines[lines.length - 1]);
          if (lastEntry.entry_hash) {
            this.lastAuditHash = lastEntry.entry_hash;
          }
        } catch {
          this.lastAuditHash = GENESIS_PREV_HASH;
        }
      }
    }
  }

  _recordAuditEntry({ eventType, checkpointId, details = {}, now }) {
    const timestamp = isoNow(now || this.now);
    const entryPayload = {
      schema_version: HITL_AUDIT_ENTRY_SCHEMA,
      timestamp,
      event_type: eventType,
      checkpoint_id: checkpointId,
      prev_hash: this.lastAuditHash,
      details,
    };

    const entryHash = sha256Hex(stableJson(entryPayload));
    const fullEntry = {
      ...entryPayload,
      entry_hash: entryHash,
    };

    durableAppendJsonl(this.auditLogPath, fullEntry);
    this.lastAuditHash = entryHash;
    return fullEntry;
  }

  _saveCheckpoint(checkpoint) {
    this.checkpoints.set(checkpoint.checkpoint_id, checkpoint);
    durableAppendJsonl(this.checkpointsPath, checkpoint);
  }

  createCheckpoint({
    actionType,
    actionPayload = {},
    context = {},
    expiresAfterSec = null,
    highStakes = true,
    now = null,
  } = {}) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();
    const ttlSec = Number.isFinite(expiresAfterSec) && expiresAfterSec > 0 ? expiresAfterSec : this.defaultTtlSec;
    const expiresAt = new Date(nowMs + ttlSec * 1000).toISOString();

    const actionHash = sha256Hex(stableJson(actionPayload));
    const checkpointId = `hitl_chk_${nowMs}_${actionHash.slice(0, 8)}`;

    // Generate cryptographically signed resume token
    const tokenSignature = hmacSha256Hex(
      this.secret,
      `${checkpointId}:${actionType}:${actionHash}:${expiresAt}`
    ).slice(0, 32);
    const resumeToken = `hitl_tok_${tokenSignature}`;

    const checkpoint = {
      schema_version: HITL_CHECKPOINT_SCHEMA,
      checkpoint_id: checkpointId,
      action_type: String(actionType || "unspecified_action"),
      action_payload: actionPayload,
      action_hash: actionHash,
      high_stakes: Boolean(highStakes),
      context: { ...context },
      state: "PENDING_APPROVAL",
      resume_token: resumeToken,
      created_at: timestamp,
      expires_at: expiresAt,
      resolution: null,
    };

    const checkpointSha256 = sha256Hex(stableJson(checkpoint));
    checkpoint.checkpoint_sha256 = checkpointSha256;

    this._saveCheckpoint(checkpoint);

    const auditEntry = this._recordAuditEntry({
      eventType: "CHECKPOINT_CREATED",
      checkpointId,
      details: {
        action_type: checkpoint.action_type,
        action_hash: actionHash,
        expires_at: expiresAt,
        high_stakes: checkpoint.high_stakes,
      },
      now,
    });

    const receipt = {
      schema_version: HITL_CHECKPOINT_SCHEMA,
      checkpoint_id: checkpointId,
      state: "PENDING_APPROVAL",
      resume_token: resumeToken,
      action_type: checkpoint.action_type,
      action_hash: actionHash,
      expires_at: expiresAt,
      receipt_sha256: checkpointSha256,
      audit_entry_hash: auditEntry.entry_hash,
    };

    return {
      checkpoint,
      resume_token: resumeToken,
      receipt,
    };
  }

  resolveCheckpoint({
    resumeToken,
    action,
    approverId,
    signature = null,
    modifiedPayload = null,
    reason = null,
    now = null,
  } = {}) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();

    const safeAction = String(action || "").toUpperCase().trim();
    if (safeAction !== "APPROVE" && safeAction !== "REJECT") {
      throw new Error(`Invalid resolution action: '${action}'. Expected 'APPROVE' or 'REJECT'.`);
    }

    if (!resumeToken || typeof resumeToken !== "string") {
      throw new Error("Missing or invalid resumeToken");
    }

    // Find checkpoint
    let checkpoint = null;
    for (const cp of this.checkpoints.values()) {
      if (cp.resume_token === resumeToken) {
        checkpoint = cp;
        break;
      }
    }

    if (!checkpoint) {
      throw new Error("Checkpoint not found for provided resumeToken");
    }

    if (checkpoint.state !== "PENDING_APPROVAL") {
      throw new Error(`Checkpoint '${checkpoint.checkpoint_id}' is already in state '${checkpoint.state}'`);
    }

    // Verify token cryptographic signature
    const expectedSig = hmacSha256Hex(
      this.secret,
      `${checkpoint.checkpoint_id}:${checkpoint.action_type}:${checkpoint.action_hash}:${checkpoint.expires_at}`
    ).slice(0, 32);
    const providedSig = resumeToken.replace(/^hitl_tok_/, "");

    if (expectedSig !== providedSig) {
      throw new Error("Invalid resume token signature (tamper detected)");
    }

    // Check expiration
    if (new Date(checkpoint.expires_at).getTime() <= nowMs) {
      checkpoint.state = "EXPIRED";
      checkpoint.updated_at = timestamp;
      this._saveCheckpoint(checkpoint);
      this._recordAuditEntry({
        eventType: "CHECKPOINT_EXPIRED",
        checkpointId: checkpoint.checkpoint_id,
        details: { expired_at: checkpoint.expires_at },
        now,
      });
      throw new Error(`Checkpoint '${checkpoint.checkpoint_id}' expired at ${checkpoint.expires_at}`);
    }

    const isApprove = safeAction === "APPROVE";
    const resolvedPayload = isApprove && modifiedPayload ? modifiedPayload : checkpoint.action_payload;
    const resolvedHash = sha256Hex(stableJson(resolvedPayload));

    const resolution = {
      schema_version: HITL_RESOLUTION_SCHEMA,
      resolution_id: `hitl_res_${nowMs}_${crypto.randomBytes(4).toString("hex")}`,
      checkpoint_id: checkpoint.checkpoint_id,
      state: isApprove ? "APPROVED" : "REJECTED",
      actor_id: String(approverId || "operator_anonymous").trim(),
      signature: signature || null,
      resolved_at: timestamp,
      modified: Boolean(isApprove && modifiedPayload),
      resolved_payload_hash: resolvedHash,
      reason: reason || (isApprove ? "Operator dual-control approval granted" : "Operator rejected"),
    };

    resolution.resolution_sha256 = sha256Hex(stableJson(resolution));

    checkpoint.state = resolution.state;
    checkpoint.resolution = resolution;
    checkpoint.updated_at = timestamp;

    this._saveCheckpoint(checkpoint);

    const auditEntry = this._recordAuditEntry({
      eventType: isApprove ? "CHECKPOINT_APPROVED" : "CHECKPOINT_REJECTED",
      checkpointId: checkpoint.checkpoint_id,
      details: {
        actor_id: resolution.actor_id,
        modified: resolution.modified,
        resolved_payload_hash: resolvedHash,
        reason: resolution.reason,
      },
      now,
    });

    return {
      ok: true,
      state: checkpoint.state,
      checkpoint_id: checkpoint.checkpoint_id,
      resolved_payload: resolvedPayload,
      resolution_receipt: {
        ...resolution,
        audit_entry_hash: auditEntry.entry_hash,
      },
    };
  }

  verifyResumeToken(resumeToken, expectedPayload = null, { now = null } = {}) {
    if (!resumeToken || typeof resumeToken !== "string") {
      return { valid: false, reason: "missing_or_invalid_token" };
    }

    let checkpoint = null;
    for (const cp of this.checkpoints.values()) {
      if (cp.resume_token === resumeToken) {
        checkpoint = cp;
        break;
      }
    }

    if (!checkpoint) {
      return { valid: false, reason: "checkpoint_not_found" };
    }

    if (checkpoint.state !== "APPROVED") {
      return { valid: false, reason: `checkpoint_state_${checkpoint.state.toLowerCase()}` };
    }

    const timestamp = isoNow(now || this.now);
    if (new Date(checkpoint.expires_at).getTime() <= new Date(timestamp).getTime()) {
      return { valid: false, reason: "checkpoint_expired" };
    }

    // If expectedPayload provided, verify hash matches resolved payload
    if (expectedPayload !== null && expectedPayload !== undefined) {
      const payloadHash = sha256Hex(stableJson(expectedPayload));
      const expectedHash = checkpoint.resolution?.resolved_payload_hash || checkpoint.action_hash;
      if (payloadHash !== expectedHash) {
        return { valid: false, reason: "action_payload_hash_mismatch" };
      }
    }

    return {
      valid: true,
      state: "APPROVED",
      checkpoint_id: checkpoint.checkpoint_id,
      action_type: checkpoint.action_type,
      approver_id: checkpoint.resolution?.actor_id,
      resolution_receipt: checkpoint.resolution,
    };
  }

  listPending({ now = null } = {}) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();

    return Array.from(this.checkpoints.values())
      .filter((cp) => cp.state === "PENDING_APPROVAL" && new Date(cp.expires_at).getTime() > nowMs)
      .map((cp) => ({
        checkpoint_id: cp.checkpoint_id,
        action_type: cp.action_type,
        action_hash: cp.action_hash,
        created_at: cp.created_at,
        expires_at: cp.expires_at,
        resume_token: cp.resume_token,
      }));
  }

  verifyAuditLog() {
    if (!fs.existsSync(this.auditLogPath)) {
      return { valid: true, entry_count: 0, head_hash: GENESIS_PREV_HASH };
    }

    const lines = fs.readFileSync(this.auditLogPath, "utf8").split(/\r?\n/).filter(Boolean);
    let expectedPrevHash = GENESIS_PREV_HASH;
    let entryCount = 0;

    for (const line of lines) {
      entryCount += 1;
      const entry = JSON.parse(line);
      const { entry_hash: recordedHash, ...payloadWithoutHash } = entry;

      if (entry.prev_hash !== expectedPrevHash) {
        throw new Error(
          `Audit log chain break at entry ${entryCount}: expected prev_hash ${expectedPrevHash}, got ${entry.prev_hash}`
        );
      }

      const calculatedHash = sha256Hex(stableJson(payloadWithoutHash));
      if (recordedHash !== calculatedHash) {
        throw new Error(
          `Audit log entry tamper at entry ${entryCount}: recorded hash ${recordedHash}, computed ${calculatedHash}`
        );
      }

      expectedPrevHash = recordedHash;
    }

    return {
      valid: true,
      entry_count: entryCount,
      head_hash: expectedPrevHash,
    };
  }
}
