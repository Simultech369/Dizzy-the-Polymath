/**
 * Runaway Execution Watchdog & Progress/Spin Kill Engine
 *
 * Implements fail-closed watchdog guards for autonomous agent execution:
 * - Detects repeated identical tool calls (action spinning)
 * - Detects cyclic action thrashing (A -> B -> A -> B)
 * - Detects zero-progress state stagnation across N consecutive steps
 * - Enforces hard trajectory step ceilings
 * - Bridges to HITL Approval Gateway when checkpoint escalation is enabled
 * - Emits cryptographic RunawaySpinReceipts
 *
 * Schema: dizzy.runaway_spin_receipt.v1
 * Authority: Fail-closed trajectory termination & cycle prevention.
 */

import crypto from "node:crypto";

export const RUNAWAY_SPIN_RECEIPT_SCHEMA = "dizzy.runaway_spin_receipt.v1";

const DEFAULT_CONFIG = Object.freeze({
  maxSteps: 25,
  maxConsecutiveIdenticalActions: 3,
  cycleDetectionWindow: 6,
  maxStagnantSteps: 4,
});

function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export class RunawayExecutionWatchdog {
  constructor(opts = {}) {
    this.sessionId = opts.sessionId || `watchdog_${crypto.randomUUID().slice(0, 8)}`;
    this.maxSteps = Number.isFinite(opts.maxSteps) ? opts.maxSteps : DEFAULT_CONFIG.maxSteps;
    this.maxConsecutiveIdenticalActions = Number.isFinite(opts.maxConsecutiveIdenticalActions)
      ? opts.maxConsecutiveIdenticalActions
      : DEFAULT_CONFIG.maxConsecutiveIdenticalActions;
    this.cycleDetectionWindow = Number.isFinite(opts.cycleDetectionWindow)
      ? opts.cycleDetectionWindow
      : DEFAULT_CONFIG.cycleDetectionWindow;
    this.maxStagnantSteps = Number.isFinite(opts.maxStagnantSteps)
      ? opts.maxStagnantSteps
      : DEFAULT_CONFIG.maxStagnantSteps;
    this.hitlGateway = opts.hitlGateway || null;
    this.escalateToHitl = Boolean(opts.escalateToHitl);
    this.now = opts.now || (() => new Date());

    this.steps = [];
    this.status = "ACTIVE"; // "ACTIVE" | "TRIPPED" | "ESCALATED_HITL" | "CLEARED"
    this.tripReason = null;
    this.lastReceipt = null;
  }

  /**
   * Records a step and evaluates whether watchdog thresholds are breached.
   *
   * @param {Object} step
   * @param {number} [step.stepNumber]
   * @param {string} step.tool
   * @param {Object} [step.args]
   * @param {Object} [step.stateDelta]
   * @param {string} [step.summary]
   * @returns {{ ok: boolean, status: string, receipt?: Object, error?: string }}
   */
  recordStep(step = {}) {
    if (this.status === "TRIPPED") {
      return {
        ok: false,
        status: this.status,
        error: `watchdog_tripped: execution is halted due to ${this.tripReason}`,
        receipt: this.lastReceipt,
      };
    }

    const stepIndex = this.steps.length + 1;
    const tool = step.tool || "none";
    const argsJson = stableJson(step.args || {});
    const actionFingerprint = sha256Hex(`${tool}:${argsJson}`);
    const stateDeltaJson = stableJson(step.stateDelta || null);
    const hasStateDelta = Boolean(step.stateDelta && Object.keys(step.stateDelta).length > 0 && stateDeltaJson !== "null" && stateDeltaJson !== "{}");
    const deltaFingerprint = hasStateDelta ? sha256Hex(stateDeltaJson) : null;

    const recordedStep = Object.freeze({
      step_number: step.stepNumber ?? stepIndex,
      tool,
      action_fingerprint: actionFingerprint,
      has_state_delta: hasStateDelta,
      delta_fingerprint: deltaFingerprint,
      summary: step.summary || "",
      timestamp: (this.now)().toISOString(),
    });

    this.steps.push(recordedStep);

    // 1. Check Hard Step Budget Ceiling
    if (this.steps.length > this.maxSteps) {
      return this._trip("MAX_STEPS_EXCEEDED", `Trajectory exceeded step budget limit of ${this.maxSteps} steps`);
    }

    // 2. Check Consecutive Identical Actions (Spinning)
    if (this.steps.length >= this.maxConsecutiveIdenticalActions) {
      const recent = this.steps.slice(-this.maxConsecutiveIdenticalActions);
      const firstFp = recent[0].action_fingerprint;
      const allIdentical = recent.every((s) => s.action_fingerprint === firstFp);
      if (allIdentical) {
        return this._trip(
          "REPEATED_IDENTICAL_ACTION_SPIN",
          `Detected ${this.maxConsecutiveIdenticalActions} consecutive identical tool calls to '${tool}'`
        );
      }
    }

    // 3. Check Cyclic Thrashing / Alternation (A -> B -> A -> B)
    if (this.steps.length >= 4) {
      const cycleDetected = this._detectCyclicPattern();
      if (cycleDetected) {
        return this._trip(
          "CYCLIC_ACTION_OSCILLATION",
          `Detected cyclic tool invocation pattern across recent steps (period: ${cycleDetected.period})`
        );
      }
    }

    // 4. Check State Stagnation (N consecutive steps with no delta)
    if (this.steps.length >= this.maxStagnantSteps) {
      const recentStagnant = this.steps.slice(-this.maxStagnantSteps);
      const allStagnant = recentStagnant.every((s) => !s.has_state_delta);
      if (allStagnant) {
        return this._trip(
          "ZERO_PROGRESS_STAGNATION",
          `Detected ${this.maxStagnantSteps} consecutive steps without state delta or progress`
        );
      }
    }

    return {
      ok: true,
      status: "ACTIVE",
      step_count: this.steps.length,
    };
  }

  _detectCyclicPattern() {
    // Check cycle period 2 (A B A B) and period 3 (A B C A B C)
    const len = this.steps.length;
    for (const period of [2, 3]) {
      const neededSteps = period * 2;
      if (len >= neededSteps) {
        const slice = this.steps.slice(-neededSteps);
        let isCycle = true;
        for (let i = 0; i < period; i++) {
          if (slice[i].action_fingerprint !== slice[i + period].action_fingerprint) {
            isCycle = false;
            break;
          }
        }
        if (isCycle) {
          return { period };
        }
      }
    }
    return null;
  }

  _trip(reasonCode, reasonDescription) {
    this.status = "TRIPPED";
    this.tripReason = reasonCode;
    const nowIso = (this.now)().toISOString();

    let hitlCheckpointId = null;
    let hitlResumeToken = null;

    if (this.escalateToHitl && this.hitlGateway) {
      const checkpoint = this.hitlGateway.createCheckpoint({
        actionType: "runaway_spin_recovery",
        payload: {
          session_id: this.sessionId,
          reason_code: reasonCode,
          steps_executed: this.steps.length,
          last_step: this.steps[this.steps.length - 1],
        },
        riskTier: "HIGH",
        reason: `Watchdog tripped: ${reasonDescription}`,
      });
      hitlCheckpointId = checkpoint.checkpoint.checkpoint_id;
      hitlResumeToken = checkpoint.resume_token;
      this.status = "ESCALATED_HITL";
    }

    const receiptPayload = {
      schema_version: RUNAWAY_SPIN_RECEIPT_SCHEMA,
      timestamp: nowIso,
      session_id: this.sessionId,
      status: this.status,
      trip_reason: reasonCode,
      description: reasonDescription,
      total_steps: this.steps.length,
      max_steps_allowed: this.maxSteps,
      escalated_to_hitl: Boolean(hitlCheckpointId),
      hitl_checkpoint_id: hitlCheckpointId,
      trajectory_fingerprint_chain: this.steps.map((s) => s.action_fingerprint),
    };

    const evidenceSha256 = sha256Hex(stableJson(receiptPayload));
    this.lastReceipt = Object.freeze({
      ...receiptPayload,
      evidence_sha256: evidenceSha256,
    });

    return {
      ok: false,
      status: this.status,
      error: reasonDescription,
      trip_reason: reasonCode,
      hitl_resume_token: hitlResumeToken,
      receipt: this.lastReceipt,
    };
  }

  /**
   * Resets watchdog state following authorized operator clearance or HITL approval.
   */
  reset({ authorization = "operator_reset", reason = "resumed_after_audit" } = {}) {
    this.steps = [];
    this.status = "CLEARED";
    this.tripReason = null;
    const nowIso = (this.now)().toISOString();

    const resetReceiptPayload = {
      schema_version: RUNAWAY_SPIN_RECEIPT_SCHEMA,
      timestamp: nowIso,
      session_id: this.sessionId,
      status: "CLEARED",
      trip_reason: null,
      description: `Watchdog reset by ${authorization}: ${reason}`,
      total_steps: 0,
      max_steps_allowed: this.maxSteps,
      escalated_to_hitl: false,
      hitl_checkpoint_id: null,
      trajectory_fingerprint_chain: [],
    };

    const evidenceSha256 = sha256Hex(stableJson(resetReceiptPayload));
    this.lastReceipt = Object.freeze({
      ...resetReceiptPayload,
      evidence_sha256: evidenceSha256,
    });

    return {
      ok: true,
      status: "CLEARED",
      receipt: this.lastReceipt,
    };
  }
}

export function verifyRunawaySpinReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") return false;
  if (receipt.schema_version !== RUNAWAY_SPIN_RECEIPT_SCHEMA) return false;
  const { evidence_sha256, ...payload } = receipt;
  if (!evidence_sha256) return false;
  const expectedHash = sha256Hex(stableJson(payload));
  return evidence_sha256 === expectedHash;
}
