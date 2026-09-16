import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const STATEM_CHECKPOINT_SCHEMA = "dizzy.statem_checkpoint.v1";

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

/**
 * Small, receipt-backed StateM checkpointer for long jobs.
 */
export class StateMCheckpointEngine {
  constructor(filePath) {
    this.filePath = path.resolve(process.cwd(), filePath || "runtime/checkpoints/statem.jsonl");
  }

  _ensureDir() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  saveCheckpoint(jobId, runbookName, stateInfo) {
    this._ensureDir();
    const payload = {
      schema_version: STATEM_CHECKPOINT_SCHEMA,
      job_id: jobId,
      runbook_name: runbookName,
      timestamp: new Date().toISOString(),
      state: stateInfo.currentState,
      verification_attempts: stateInfo.verificationAttempts,
      verification_passed: stateInfo.verificationPassed,
      transitions: stateInfo.transitions || [],
      context: stateInfo.context || {},
    };
    const line = JSON.stringify(payload) + "\n";
    fs.appendFileSync(this.filePath, line, "utf8");
    return {
      checkpoint_sha256: sha256Hex(line),
      job_id: jobId,
      saved_at: payload.timestamp
    };
  }

  readLatestCheckpoint(jobId) {
    if (!fs.existsSync(this.filePath)) return null;
    const lines = fs.readFileSync(this.filePath, "utf8").split(/\r?\n/).filter(Boolean);
    
    let latest = null;
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.schema_version === STATEM_CHECKPOINT_SCHEMA && obj.job_id === jobId) {
          latest = obj;
        }
      } catch (err) {
        // ignore malformed
      }
    }
    return latest;
  }
}
