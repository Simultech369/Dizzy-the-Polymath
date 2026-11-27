/**
 * Human-In-The-Loop (HITL) Approval Gateway & Immutable Audit Log.
 *
 * Implements high-stakes execution checkpoints, dual-control resume tokens,
 * operator approval/rejection workflows, crash-resumable progress snapshots,
 * explicit workflow state machine transitions, and hash-chained audit trails.
 *
 * Explicit Workflow States (Phase 0.5 + Dizzy/CouncilEngine Contract):
 *   running -> waiting_for_approval -> approved | rejected -> resumed | cancelled
 *
 * Schemas:
 * - dizzy.hitl_checkpoint.v1
 * - dizzy.hitl_resolution.v1
 * - dizzy.hitl_audit_entry.v1
 * - dizzy.hitl_run_state.v1
 *
 * Authority: Fail-closed gatekeeper for high-stakes routing and fiduciary operations.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { durableAppendJsonl } from "./durable_write_policy.mjs";
import {
  HUMAN_APPROVAL_STATES,
  HUMAN_APPROVAL_TRANSITIONS,
  HUMAN_APPROVAL_NEXT_STEPS,
  IllegalWorkflowTransitionError,
  validateWorkflowTransition,
} from "./workflow_state_machines.mjs";

export const HITL_CHECKPOINT_SCHEMA = "dizzy.hitl_checkpoint.v1";
export const HITL_RESOLUTION_SCHEMA = "dizzy.hitl_resolution.v1";
export const HITL_AUDIT_ENTRY_SCHEMA = "dizzy.hitl_audit_entry.v1";
export const HITL_RUN_STATE_SCHEMA = "dizzy.hitl_run_state.v1";

export {
  HUMAN_APPROVAL_STATES,
  HUMAN_APPROVAL_TRANSITIONS,
  HUMAN_APPROVAL_NEXT_STEPS,
  IllegalWorkflowTransitionError,
};

const DEFAULT_SECRET = "dizzy-hitl-gateway-default-secret-salt-32b";
const GENESIS_PREV_HASH = "0".repeat(64);

const LEGACY_STATE_TO_WORKFLOW = Object.freeze({
  RUNNING: HUMAN_APPROVAL_STATES.RUNNING,
  PENDING_APPROVAL: HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL,
  APPROVED: HUMAN_APPROVAL_STATES.APPROVED,
  REJECTED: HUMAN_APPROVAL_STATES.REJECTED,
  RESUMED: HUMAN_APPROVAL_STATES.RESUMED,
  CANCELLED: HUMAN_APPROVAL_STATES.CANCELLED,
  EXPIRED: HUMAN_APPROVAL_STATES.CANCELLED,
});

const WORKFLOW_TO_LEGACY_STATE = Object.freeze({
  [HUMAN_APPROVAL_STATES.RUNNING]: "RUNNING",
  [HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL]: "PENDING_APPROVAL",
  [HUMAN_APPROVAL_STATES.APPROVED]: "APPROVED",
  [HUMAN_APPROVAL_STATES.REJECTED]: "REJECTED",
  [HUMAN_APPROVAL_STATES.RESUMED]: "RESUMED",
  [HUMAN_APPROVAL_STATES.CANCELLED]: "CANCELLED",
});

export function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

export function hmacSha256Hex(secret, text) {
  return crypto.createHmac("sha256", String(secret)).update(String(text ?? ""), "utf8").digest("hex");
}

function timingSafeHexEqual(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
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
    this.runsPath = path.join(this.ledgerDir, "runs.jsonl");
    this.auditLogPath = path.join(this.ledgerDir, "audit_log.jsonl");

    // In-memory state reconstructed from durable JSONL ledgers
    this.checkpoints = new Map();
    this.runs = new Map();
    this.lastAuditHash = GENESIS_PREV_HASH;

    this._initialize();
  }

  _initialize() {
    fs.mkdirSync(this.ledgerDir, { recursive: true });

    if (fs.existsSync(this.checkpointsPath)) {
      const lines = fs.readFileSync(this.checkpointsPath, "utf8").split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.checkpoint_id) {
            if (!entry.workflow_state) {
              entry.workflow_state = LEGACY_STATE_TO_WORKFLOW[entry.state] || HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL;
            }
            entry.allowed_next_states = [...(HUMAN_APPROVAL_TRANSITIONS[entry.workflow_state] || [])];
            this.checkpoints.set(entry.checkpoint_id, entry);
          }
        } catch {
          // Ignore partial or corrupted lines during initial load
        }
      }
    }

    if (fs.existsSync(this.runsPath)) {
      const lines = fs.readFileSync(this.runsPath, "utf8").split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const run = JSON.parse(line);
          if (run.run_id) {
            run.allowed_next_states = [...(HUMAN_APPROVAL_TRANSITIONS[run.workflow_state] || [])];
            this.runs.set(run.run_id, run);
          }
        } catch {
          // Ignore partial or corrupted lines during initial load
        }
      }
    }

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

  _recordAuditEntry({ eventType, checkpointId = null, runId = null, details = {}, now }) {
    const timestamp = isoNow(now || this.now);
    const entryPayload = {
      schema_version: HITL_AUDIT_ENTRY_SCHEMA,
      timestamp,
      event_type: eventType,
      checkpoint_id: checkpointId,
      ...(runId ? { run_id: runId } : {}),
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
    checkpoint.allowed_next_states = [...(HUMAN_APPROVAL_TRANSITIONS[checkpoint.workflow_state] || [])];
    checkpoint.next_step = HUMAN_APPROVAL_NEXT_STEPS[checkpoint.workflow_state] || "";
    this.checkpoints.set(checkpoint.checkpoint_id, checkpoint);
    durableAppendJsonl(this.checkpointsPath, checkpoint);
  }

  _saveRun(run) {
    run.allowed_next_states = [...(HUMAN_APPROVAL_TRANSITIONS[run.workflow_state] || [])];
    run.next_step = HUMAN_APPROVAL_NEXT_STEPS[run.workflow_state] || "";
    run.run_sha256 = sha256Hex(stableJson({ ...run, run_sha256: undefined }));
    this.runs.set(run.run_id, run);
    durableAppendJsonl(this.runsPath, run);
  }

  _findCheckpointByToken(resumeToken) {
    for (const cp of this.checkpoints.values()) {
      if (timingSafeHexEqual(cp.resume_token, resumeToken)) {
        return cp;
      }
    }
    return null;
  }

  /**
   * Starts a multi-step HITL-capable run in explicit `running` state with durable progress.
   */
  startRun({
    runId = null,
    actionType = "unspecified_action",
    actionPayload = {},
    context = {},
    initialProgress = {},
    highStakes = true,
    now = null,
  } = {}) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();
    const resolvedRunId = runId || `hitl_run_${nowMs}_${crypto.randomBytes(4).toString("hex")}`;

    if (this.runs.has(resolvedRunId)) {
      throw new Error(`Run '${resolvedRunId}' already exists`);
    }

    const run = {
      schema_version: HITL_RUN_STATE_SCHEMA,
      run_id: resolvedRunId,
      action_type: String(actionType || "unspecified_action"),
      action_payload: actionPayload,
      high_stakes: Boolean(highStakes),
      context: { ...context },
      workflow_state: HUMAN_APPROVAL_STATES.RUNNING,
      state: WORKFLOW_TO_LEGACY_STATE[HUMAN_APPROVAL_STATES.RUNNING],
      checkpoint_id: null,
      resume_token: null,
      saved_progress: {
        step_index: 0,
        step_name: "initialized",
        completed_steps: [],
        partial_outputs: {},
        ...initialProgress,
      },
      transition_history: [
        {
          from_state: null,
          to_state: HUMAN_APPROVAL_STATES.RUNNING,
          timestamp,
          reason: "run_started",
        },
      ],
      created_at: timestamp,
      updated_at: timestamp,
    };

    this._saveRun(run);
    this._recordAuditEntry({
      eventType: "RUN_STARTED",
      runId: resolvedRunId,
      details: {
        action_type: run.action_type,
        workflow_state: run.workflow_state,
      },
      now,
    });

    return { ...run };
  }

  /**
   * Saves incremental execution progress while `running` so a crash can restore without restarting from zero.
   */
  saveProgress(runId, progressPatch = {}, { now = null } = {}) {
    const run = this.runs.get(String(runId || ""));
    if (!run) {
      throw new Error(`Run '${runId}' not found`);
    }
    if (run.workflow_state !== HUMAN_APPROVAL_STATES.RUNNING) {
      throw new IllegalWorkflowTransitionError({
        workflow: "human_approval",
        fromState: run.workflow_state,
        toState: HUMAN_APPROVAL_STATES.RUNNING,
        allowedNext: HUMAN_APPROVAL_TRANSITIONS[run.workflow_state] || [],
      });
    }

    const timestamp = isoNow(now || this.now);
    run.saved_progress = {
      ...run.saved_progress,
      ...(progressPatch && typeof progressPatch === "object" ? progressPatch : {}),
      saved_at: timestamp,
    };
    run.updated_at = timestamp;
    this._saveRun(run);

    this._recordAuditEntry({
      eventType: "RUN_PROGRESS_SAVED",
      runId: run.run_id,
      details: {
        step_index: run.saved_progress.step_index,
        step_name: run.saved_progress.step_name,
      },
      now,
    });

    return { ...run };
  }

  /**
   * Transitions an active `running` run into `waiting_for_approval` and issues a signed checkpoint.
   */
  requestApproval(runId, {
    actionPayload = null,
    expiresAfterSec = null,
    reason = "Sensitive operation requires human approval",
    now = null,
  } = {}) {
    const run = this.runs.get(String(runId || ""));
    if (!run) {
      throw new Error(`Run '${runId}' not found`);
    }

    validateWorkflowTransition(
      HUMAN_APPROVAL_TRANSITIONS,
      "human_approval",
      run.workflow_state,
      HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL
    );

    const effectivePayload = actionPayload !== null && actionPayload !== undefined
      ? actionPayload
      : run.action_payload;

    const created = this.createCheckpoint({
      actionType: run.action_type,
      actionPayload: effectivePayload,
      context: { ...run.context, run_id: run.run_id },
      savedProgress: run.saved_progress,
      runId: run.run_id,
      expiresAfterSec,
      highStakes: run.high_stakes,
      now,
    });

    const timestamp = isoNow(now || this.now);
    run.action_payload = effectivePayload;
    run.workflow_state = HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL;
    run.state = WORKFLOW_TO_LEGACY_STATE[HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL];
    run.checkpoint_id = created.checkpoint.checkpoint_id;
    run.resume_token = created.resume_token;
    run.updated_at = timestamp;
    run.transition_history = [
      ...(run.transition_history || []),
      {
        from_state: HUMAN_APPROVAL_STATES.RUNNING,
        to_state: HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL,
        timestamp,
        reason,
        checkpoint_id: created.checkpoint.checkpoint_id,
      },
    ];
    this._saveRun(run);

    return {
      run: { ...run },
      ...created,
    };
  }

  createCheckpoint({
    actionType,
    actionPayload = {},
    context = {},
    savedProgress = null,
    runId = null,
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
      run_id: runId || null,
      action_type: String(actionType || "unspecified_action"),
      action_payload: actionPayload,
      action_hash: actionHash,
      high_stakes: Boolean(highStakes),
      context: { ...context },
      saved_progress: savedProgress ? { ...savedProgress } : null,
      state: "PENDING_APPROVAL",
      workflow_state: HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL,
      resume_token: resumeToken,
      created_at: timestamp,
      expires_at: expiresAt,
      resolution: null,
      resumed_at: null,
      cancelled_at: null,
    };

    const checkpointSha256 = sha256Hex(stableJson(checkpoint));
    checkpoint.checkpoint_sha256 = checkpointSha256;

    this._saveCheckpoint(checkpoint);

    const auditEntry = this._recordAuditEntry({
      eventType: "CHECKPOINT_CREATED",
      checkpointId,
      runId: runId || null,
      details: {
        action_type: checkpoint.action_type,
        action_hash: actionHash,
        expires_at: expiresAt,
        high_stakes: checkpoint.high_stakes,
        workflow_state: checkpoint.workflow_state,
      },
      now,
    });

    const receipt = {
      schema_version: HITL_CHECKPOINT_SCHEMA,
      checkpoint_id: checkpointId,
      run_id: runId || null,
      state: "PENDING_APPROVAL",
      workflow_state: HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL,
      allowed_next_states: [...HUMAN_APPROVAL_TRANSITIONS[HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL]],
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

    const checkpoint = this._findCheckpointByToken(resumeToken);
    if (!checkpoint) {
      throw new Error("Checkpoint not found for provided resumeToken");
    }

    const targetWorkflowState = safeAction === "APPROVE"
      ? HUMAN_APPROVAL_STATES.APPROVED
      : HUMAN_APPROVAL_STATES.REJECTED;

    if (checkpoint.workflow_state !== HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL) {
      validateWorkflowTransition(
        HUMAN_APPROVAL_TRANSITIONS,
        "human_approval",
        checkpoint.workflow_state,
        targetWorkflowState
      );
    }

    // Verify token cryptographic signature in constant time
    const expectedSig = hmacSha256Hex(
      this.secret,
      `${checkpoint.checkpoint_id}:${checkpoint.action_type}:${checkpoint.action_hash}:${checkpoint.expires_at}`
    ).slice(0, 32);
    const providedSig = resumeToken.replace(/^hitl_tok_/, "");

    if (!timingSafeHexEqual(expectedSig, providedSig)) {
      throw new Error("Invalid resume token signature (tamper detected)");
    }

    // Check expiration
    if (new Date(checkpoint.expires_at).getTime() <= nowMs) {
      checkpoint.state = "EXPIRED";
      checkpoint.workflow_state = HUMAN_APPROVAL_STATES.CANCELLED;
      checkpoint.cancelled_at = timestamp;
      checkpoint.updated_at = timestamp;
      this._saveCheckpoint(checkpoint);
      if (checkpoint.run_id && this.runs.has(checkpoint.run_id)) {
        const run = this.runs.get(checkpoint.run_id);
        run.workflow_state = HUMAN_APPROVAL_STATES.CANCELLED;
        run.state = "EXPIRED";
        run.updated_at = timestamp;
        this._saveRun(run);
      }
      this._recordAuditEntry({
        eventType: "CHECKPOINT_EXPIRED",
        checkpointId: checkpoint.checkpoint_id,
        runId: checkpoint.run_id,
        details: { expired_at: checkpoint.expires_at, workflow_state: HUMAN_APPROVAL_STATES.CANCELLED },
        now,
      });
      throw new Error(`Checkpoint '${checkpoint.checkpoint_id}' expired at ${checkpoint.expires_at}`);
    }

    validateWorkflowTransition(
      HUMAN_APPROVAL_TRANSITIONS,
      "human_approval",
      checkpoint.workflow_state,
      targetWorkflowState
    );

    const isApprove = safeAction === "APPROVE";
    const resolvedPayload = isApprove && modifiedPayload ? modifiedPayload : checkpoint.action_payload;
    const resolvedHash = sha256Hex(stableJson(resolvedPayload));

    const resolution = {
      schema_version: HITL_RESOLUTION_SCHEMA,
      resolution_id: `hitl_res_${nowMs}_${crypto.randomBytes(4).toString("hex")}`,
      checkpoint_id: checkpoint.checkpoint_id,
      state: isApprove ? "APPROVED" : "REJECTED",
      workflow_state: targetWorkflowState,
      actor_id: String(approverId || "operator_anonymous").trim(),
      signature: signature || null,
      resolved_at: timestamp,
      modified: Boolean(isApprove && modifiedPayload),
      resolved_payload_hash: resolvedHash,
      reason: reason || (isApprove ? "Operator dual-control approval granted" : "Operator rejected"),
    };

    resolution.resolution_sha256 = sha256Hex(stableJson(resolution));

    checkpoint.state = resolution.state;
    checkpoint.workflow_state = targetWorkflowState;
    checkpoint.resolution = resolution;
    checkpoint.updated_at = timestamp;

    this._saveCheckpoint(checkpoint);

    if (checkpoint.run_id && this.runs.has(checkpoint.run_id)) {
      const run = this.runs.get(checkpoint.run_id);
      const prevState = run.workflow_state;
      run.workflow_state = targetWorkflowState;
      run.state = resolution.state;
      run.resolved_payload = resolvedPayload;
      run.updated_at = timestamp;
      run.transition_history = [
        ...(run.transition_history || []),
        {
          from_state: prevState,
          to_state: targetWorkflowState,
          timestamp,
          actor_id: resolution.actor_id,
          reason: resolution.reason,
        },
      ];
      this._saveRun(run);
    }

    const auditEntry = this._recordAuditEntry({
      eventType: isApprove ? "CHECKPOINT_APPROVED" : "CHECKPOINT_REJECTED",
      checkpointId: checkpoint.checkpoint_id,
      runId: checkpoint.run_id,
      details: {
        actor_id: resolution.actor_id,
        modified: resolution.modified,
        resolved_payload_hash: resolvedHash,
        reason: resolution.reason,
        workflow_state: targetWorkflowState,
      },
      now,
    });

    return {
      ok: true,
      state: checkpoint.state,
      workflow_state: checkpoint.workflow_state,
      allowed_next_states: [...HUMAN_APPROVAL_TRANSITIONS[checkpoint.workflow_state]],
      checkpoint_id: checkpoint.checkpoint_id,
      run_id: checkpoint.run_id,
      resolved_payload: resolvedPayload,
      resolution_receipt: {
        ...resolution,
        audit_entry_hash: auditEntry.entry_hash,
      },
    };
  }

  /**
   * Resumes a crash-persisted or waiting run/checkpoint ONLY from `approved -> resumed`.
   * Rejects illegal jumps (`running -> resumed`, `waiting_for_approval -> resumed`,
   * `rejected -> resumed`, `resumed -> resumed`, `cancelled -> resumed`).
   */
  resumeCheckpoint({
    resumeToken = null,
    runId = null,
    expectedPayload = null,
    actorId = "worker_runtime",
    now = null,
  } = {}) {
    const run = runId ? this.runs.get(String(runId)) : null;
    if (run && !resumeToken && !run.resume_token) {
      validateWorkflowTransition(
        HUMAN_APPROVAL_TRANSITIONS,
        "human_approval",
        run.workflow_state,
        HUMAN_APPROVAL_STATES.RESUMED
      );
    }

    const effectiveToken = resumeToken || run?.resume_token || "";
    if (!effectiveToken || typeof effectiveToken !== "string") {
      throw new Error("Missing or invalid resumeToken");
    }

    const checkpoint = this._findCheckpointByToken(effectiveToken);
    if (!checkpoint) {
      throw new Error("Checkpoint not found for provided resumeToken");
    }

    // Enforce strict state machine edge: ONLY `approved -> resumed` is legal
    validateWorkflowTransition(
      HUMAN_APPROVAL_TRANSITIONS,
      "human_approval",
      checkpoint.workflow_state,
      HUMAN_APPROVAL_STATES.RESUMED
    );

    const tokenCheck = this.verifyResumeToken(effectiveToken, expectedPayload, { now });
    if (!tokenCheck.valid) {
      throw new Error(`Cannot resume checkpoint '${checkpoint.checkpoint_id}': ${tokenCheck.reason}`);
    }

    const timestamp = isoNow(now || this.now);
    const resolvedPayload = checkpoint.resolution?.modified
      ? (this.runs.get(checkpoint.run_id)?.resolved_payload ?? checkpoint.action_payload)
      : checkpoint.action_payload;

    checkpoint.workflow_state = HUMAN_APPROVAL_STATES.RESUMED;
    checkpoint.state = WORKFLOW_TO_LEGACY_STATE[HUMAN_APPROVAL_STATES.RESUMED];
    checkpoint.resumed_at = timestamp;
    checkpoint.updated_at = timestamp;
    this._saveCheckpoint(checkpoint);

    let updatedRun = null;
    if (checkpoint.run_id && this.runs.has(checkpoint.run_id)) {
      const targetRun = this.runs.get(checkpoint.run_id);
      validateWorkflowTransition(
        HUMAN_APPROVAL_TRANSITIONS,
        "human_approval",
        targetRun.workflow_state,
        HUMAN_APPROVAL_STATES.RESUMED
      );
      const prevState = targetRun.workflow_state;
      targetRun.workflow_state = HUMAN_APPROVAL_STATES.RESUMED;
      targetRun.state = WORKFLOW_TO_LEGACY_STATE[HUMAN_APPROVAL_STATES.RESUMED];
      targetRun.resumed_at = timestamp;
      targetRun.updated_at = timestamp;
      targetRun.transition_history = [
        ...(targetRun.transition_history || []),
        {
          from_state: prevState,
          to_state: HUMAN_APPROVAL_STATES.RESUMED,
          timestamp,
          actor_id: String(actorId || "worker_runtime"),
          reason: "resumed_from_saved_checkpoint",
        },
      ];
      this._saveRun(targetRun);
      updatedRun = { ...targetRun };
    }

    const auditEntry = this._recordAuditEntry({
      eventType: "CHECKPOINT_RESUMED",
      checkpointId: checkpoint.checkpoint_id,
      runId: checkpoint.run_id,
      details: {
        actor_id: String(actorId || "worker_runtime"),
        workflow_state: HUMAN_APPROVAL_STATES.RESUMED,
        restored_step: updatedRun?.saved_progress?.step_name || checkpoint.saved_progress?.step_name || null,
      },
      now,
    });

    return {
      ok: true,
      checkpoint_id: checkpoint.checkpoint_id,
      run_id: checkpoint.run_id,
      state: checkpoint.state,
      workflow_state: checkpoint.workflow_state,
      allowed_next_states: [],
      saved_progress: updatedRun?.saved_progress || checkpoint.saved_progress || null,
      resolved_payload: resolvedPayload,
      audit_entry_hash: auditEntry.entry_hash,
    };
  }

  /**
   * Cancels an active, waiting, approved, or rejected run/checkpoint (`-> cancelled`).
   * Rejects illegal jumps from `resumed -> cancelled` or `cancelled -> cancelled`.
   */
  cancelRun({
    runId = null,
    checkpointId = null,
    resumeToken = null,
    actorId = "operator",
    reason = "Cancelled by operator",
    now = null,
  } = {}) {
    const timestamp = isoNow(now || this.now);
    const run = runId ? this.runs.get(String(runId)) : null;
    const checkpoint = checkpointId
      ? this.checkpoints.get(String(checkpointId))
      : resumeToken
        ? this._findCheckpointByToken(resumeToken)
        : (run?.checkpoint_id ? this.checkpoints.get(run.checkpoint_id) : null);

    if (!run && !checkpoint) {
      throw new Error("Run or checkpoint not found for cancellation");
    }

    const currentState = run ? run.workflow_state : checkpoint.workflow_state;
    validateWorkflowTransition(
      HUMAN_APPROVAL_TRANSITIONS,
      "human_approval",
      currentState,
      HUMAN_APPROVAL_STATES.CANCELLED
    );

    if (checkpoint) {
      checkpoint.workflow_state = HUMAN_APPROVAL_STATES.CANCELLED;
      checkpoint.state = WORKFLOW_TO_LEGACY_STATE[HUMAN_APPROVAL_STATES.CANCELLED];
      checkpoint.cancelled_at = timestamp;
      checkpoint.updated_at = timestamp;
      this._saveCheckpoint(checkpoint);
    }

    if (run) {
      const prevState = run.workflow_state;
      run.workflow_state = HUMAN_APPROVAL_STATES.CANCELLED;
      run.state = WORKFLOW_TO_LEGACY_STATE[HUMAN_APPROVAL_STATES.CANCELLED];
      run.cancelled_at = timestamp;
      run.updated_at = timestamp;
      run.transition_history = [
        ...(run.transition_history || []),
        {
          from_state: prevState,
          to_state: HUMAN_APPROVAL_STATES.CANCELLED,
          timestamp,
          actor_id: String(actorId || "operator"),
          reason: String(reason || "Cancelled"),
        },
      ];
      this._saveRun(run);
    }

    const auditEntry = this._recordAuditEntry({
      eventType: "WORKFLOW_CANCELLED",
      checkpointId: checkpoint?.checkpoint_id || null,
      runId: run?.run_id || checkpoint?.run_id || null,
      details: {
        from_state: currentState,
        workflow_state: HUMAN_APPROVAL_STATES.CANCELLED,
        actor_id: String(actorId || "operator"),
        reason: String(reason || "Cancelled"),
      },
      now,
    });

    return {
      ok: true,
      run_id: run?.run_id || checkpoint?.run_id || null,
      checkpoint_id: checkpoint?.checkpoint_id || null,
      state: "CANCELLED",
      workflow_state: HUMAN_APPROVAL_STATES.CANCELLED,
      allowed_next_states: [],
      audit_entry_hash: auditEntry.entry_hash,
    };
  }

  /**
   * Enforces explicit state machine validation on direct transition requests.
   */
  transitionRunState(runId, targetState, opts = {}) {
    const run = this.runs.get(String(runId || ""));
    if (!run) {
      throw new Error(`Run '${runId}' not found`);
    }

    validateWorkflowTransition(
      HUMAN_APPROVAL_TRANSITIONS,
      "human_approval",
      run.workflow_state,
      targetState
    );

    if (targetState === HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL) {
      return this.requestApproval(runId, opts);
    }
    if (targetState === HUMAN_APPROVAL_STATES.APPROVED) {
      return this.resolveCheckpoint({ ...opts, resumeToken: run.resume_token, action: "APPROVE" });
    }
    if (targetState === HUMAN_APPROVAL_STATES.REJECTED) {
      return this.resolveCheckpoint({ ...opts, resumeToken: run.resume_token, action: "REJECT" });
    }
    if (targetState === HUMAN_APPROVAL_STATES.RESUMED) {
      return this.resumeCheckpoint({ ...opts, runId, resumeToken: run.resume_token });
    }
    if (targetState === HUMAN_APPROVAL_STATES.CANCELLED) {
      return this.cancelRun({ ...opts, runId });
    }

    throw new IllegalWorkflowTransitionError({
      workflow: "human_approval",
      fromState: run.workflow_state,
      toState: targetState,
      allowedNext: HUMAN_APPROVAL_TRANSITIONS[run.workflow_state] || [],
    });
  }

  /**
   * Lists non-terminal runs reconstructed from disk so a restarted process can recover cleanly.
   */
  listRecoverableRuns() {
    return Array.from(this.runs.values())
      .filter((run) => !["resumed", "cancelled"].includes(run.workflow_state))
      .map((run) => ({
        run_id: run.run_id,
        action_type: run.action_type,
        workflow_state: run.workflow_state,
        checkpoint_id: run.checkpoint_id,
        resume_token: run.resume_token,
        saved_progress: run.saved_progress,
        allowed_next_states: [...(HUMAN_APPROVAL_TRANSITIONS[run.workflow_state] || [])],
        next_step: HUMAN_APPROVAL_NEXT_STEPS[run.workflow_state] || "",
        updated_at: run.updated_at,
      }));
  }

  getRun(runId) {
    const run = this.runs.get(String(runId || ""));
    return run ? { ...run } : null;
  }

  verifyResumeToken(resumeToken, expectedPayload = null, { now = null } = {}) {
    if (!resumeToken || typeof resumeToken !== "string") {
      return { valid: false, reason: "missing_or_invalid_token" };
    }

    const checkpoint = this._findCheckpointByToken(resumeToken);
    if (!checkpoint) {
      return { valid: false, reason: "checkpoint_not_found" };
    }

    if (checkpoint.state !== "APPROVED") {
      return {
        valid: false,
        reason: `checkpoint_state_${checkpoint.state.toLowerCase()}`,
        workflow_state: checkpoint.workflow_state,
      };
    }

    const timestamp = isoNow(now || this.now);
    if (new Date(checkpoint.expires_at).getTime() <= new Date(timestamp).getTime()) {
      return { valid: false, reason: "checkpoint_expired", workflow_state: HUMAN_APPROVAL_STATES.CANCELLED };
    }

    if (expectedPayload !== null && expectedPayload !== undefined) {
      const payloadHash = sha256Hex(stableJson(expectedPayload));
      const expectedHash = checkpoint.resolution?.resolved_payload_hash || checkpoint.action_hash;
      if (payloadHash !== expectedHash) {
        return { valid: false, reason: "action_payload_hash_mismatch", workflow_state: checkpoint.workflow_state };
      }
    }

    return {
      valid: true,
      state: "APPROVED",
      workflow_state: HUMAN_APPROVAL_STATES.APPROVED,
      checkpoint_id: checkpoint.checkpoint_id,
      run_id: checkpoint.run_id || null,
      action_type: checkpoint.action_type,
      approver_id: checkpoint.resolution?.actor_id,
      saved_progress: checkpoint.saved_progress || null,
      resolution_receipt: checkpoint.resolution,
    };
  }

  listPending({ now = null } = {}) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();

    return Array.from(this.checkpoints.values())
      .filter((cp) => cp.workflow_state === HUMAN_APPROVAL_STATES.WAITING_FOR_APPROVAL && new Date(cp.expires_at).getTime() > nowMs)
      .map((cp) => ({
        checkpoint_id: cp.checkpoint_id,
        run_id: cp.run_id || null,
        action_type: cp.action_type,
        action_hash: cp.action_hash,
        workflow_state: cp.workflow_state,
        allowed_next_states: [...HUMAN_APPROVAL_TRANSITIONS[cp.workflow_state]],
        next_step: HUMAN_APPROVAL_NEXT_STEPS[cp.workflow_state],
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
