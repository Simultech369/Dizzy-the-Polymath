import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { durableAppendJsonl } from "./durable_write_policy.mjs";

export const STATEM_CHECKPOINT_SCHEMA = "dizzy.statem_checkpoint.v1";
export const STATEM_FAILOVER_RESTORE_SCHEMA = "dizzy.statem_failover_restore.v1";

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

/**
 * Receipt-backed StateM checkpointer for long jobs and crash/failover recovery.
 * Verifies SHA-256 digests on readback and automatically falls back to the most recent
 * untampered snapshot when a crash leaves a truncated or corrupted tail record.
 */
export class StateMCheckpointEngine {
  constructor(filePath, { failoverLogPath = null } = {}) {
    this.filePath = path.resolve(process.cwd(), filePath || "runtime/checkpoints/statem.jsonl");
    this.failoverLogPath = failoverLogPath
      ? path.resolve(process.cwd(), failoverLogPath)
      : `${this.filePath}.failover.jsonl`;
    this.failoverRecords = [];
  }

  _ensureDir() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  saveCheckpoint(jobId, runbookName, stateInfo) {
    this._ensureDir();
    const core = {
      schema_version: STATEM_CHECKPOINT_SCHEMA,
      job_id: jobId,
      runbook_name: runbookName,
      timestamp: new Date().toISOString(),
      state: stateInfo.currentState,
      verification_attempts: stateInfo.verificationAttempts ?? 0,
      verification_passed: Boolean(stateInfo.verificationPassed),
      transitions: stateInfo.transitions || [],
      context: stateInfo.context || {},
    };
    const payloadSha256 = sha256Hex(stableJson(core));
    const payload = {
      ...core,
      payload_sha256: payloadSha256,
    };
    durableAppendJsonl(this.filePath, payload);
    return {
      checkpoint_sha256: payloadSha256,
      job_id: jobId,
      saved_at: payload.timestamp,
    };
  }

  _verifyCheckpointIntegrity(obj) {
    if (!obj || typeof obj !== "object" || obj.schema_version !== STATEM_CHECKPOINT_SCHEMA) {
      return false;
    }
    if (!obj.payload_sha256) {
      // Backward compatibility for legacy unsealed rows
      return true;
    }
    const { payload_sha256: recorded, ...core } = obj;
    const computed = sha256Hex(stableJson(core));
    return recorded === computed;
  }

  _recordFailover({ jobId, skippedCorruptedCount, restoredTimestamp, restoredState }) {
    const core = {
      schema_version: STATEM_FAILOVER_RESTORE_SCHEMA,
      timestamp: new Date().toISOString(),
      job_id: jobId,
      skipped_corrupted_or_tampered_records: skippedCorruptedCount,
      restored_snapshot_timestamp: restoredTimestamp || null,
      restored_state: restoredState || null,
      status: restoredState ? "RESTORED_FROM_LAST_VALID_SNAPSHOT" : "NO_VALID_SNAPSHOT_FOUND",
    };
    const receipt = {
      ...core,
      receipt_sha256: sha256Hex(stableJson(core)),
    };
    this.failoverRecords.push(receipt);
    durableAppendJsonl(this.failoverLogPath, receipt);
    return receipt;
  }

  readLatestCheckpoint(jobId) {
    if (!fs.existsSync(this.filePath)) return null;
    const lines = fs.readFileSync(this.filePath, "utf8").split(/\r?\n/).filter(Boolean);

    const validSnapshots = [];
    let corruptedForJob = 0;

    for (const line of lines) {
      let obj = null;
      try {
        obj = JSON.parse(line);
      } catch {
        corruptedForJob += 1;
        continue;
      }
      if (obj?.job_id && obj.job_id !== jobId) continue;
      if (obj?.job_id === jobId) {
        if (this._verifyCheckpointIntegrity(obj)) {
          validSnapshots.push(obj);
        } else {
          corruptedForJob += 1;
        }
      }
    }

    const latest = validSnapshots.length > 0 ? validSnapshots[validSnapshots.length - 1] : null;
    if (corruptedForJob > 0) {
      this._recordFailover({
        jobId,
        skippedCorruptedCount: corruptedForJob,
        restoredTimestamp: latest?.timestamp || null,
        restoredState: latest?.state || null,
      });
    }
    return latest;
  }

  getFailoverRecords() {
    return [...this.failoverRecords];
  }
}
