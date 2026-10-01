/**
 * Light Cost Kill-Switch Middleware
 *
 * Implements deterministic expenditure bounding and fail-closed circuit breaking:
 * - Tracks per-request, per-session, and rolling hourly USD expenditure
 * - Enforces zero-cost floors and hard budget ceilings
 * - Trips breaker to TRIPPED state when limits are breached
 * - Prevents runaway autonomous model loops and spin costs
 * - Emits cryptographic CostKillSwitchReceipts
 *
 * Schemas:
 * - dizzy.cost_kill_switch.v1
 * - dizzy.cost_kill_switch_receipt.v1
 *
 * Authority: Machine-enforced financial circuit breaker.
 */

import crypto from "node:crypto";

export const COST_KILL_SWITCH_SCHEMA = "dizzy.cost_kill_switch.v1";
export const COST_KILL_SWITCH_RECEIPT_SCHEMA = "dizzy.cost_kill_switch_receipt.v1";

export const DEFAULT_COST_LIMITS = Object.freeze({
  maxCostPerRequestUsd: 0.10,     // Hard cap for any single inference call
  maxCostPerSessionUsd: 1.00,     // Hard cap for an agent execution session
  maxCostPerHourUsd: 5.00,        // Rolling 1-hour expenditure cap
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

function isoNow(now) {
  const value = typeof now === "function" ? now() : now;
  return value instanceof Date ? value.toISOString() : new Date(value || Date.now()).toISOString();
}

export class CostKillSwitch {
  constructor(opts = {}) {
    this.maxCostPerRequestUsd = Number(opts.maxCostPerRequestUsd ?? DEFAULT_COST_LIMITS.maxCostPerRequestUsd);
    this.maxCostPerSessionUsd = Number(opts.maxCostPerSessionUsd ?? DEFAULT_COST_LIMITS.maxCostPerSessionUsd);
    this.maxCostPerHourUsd = Number(opts.maxCostPerHourUsd ?? DEFAULT_COST_LIMITS.maxCostPerHourUsd);
    this.now = opts.now || (() => new Date());

    this.state = "ACTIVE"; // "ACTIVE" | "TRIPPED"
    this.tripReason = null;
    this.trippedAt = null;

    this.totalCostUsd = 0;
    this.sessionCosts = new Map(); // sessionId -> number
    this.hourlyRecords = [];       // array of { timestampMs, costUsd }
    this.totalExecutions = 0;
  }

  _pruneHourlyRecords(nowMs) {
    const oneHourAgo = nowMs - 3600 * 1000;
    this.hourlyRecords = this.hourlyRecords.filter((r) => r.timestampMs > oneHourAgo);
  }

  _getRollingHourlyCost(nowMs) {
    this._pruneHourlyRecords(nowMs);
    return this.hourlyRecords.reduce((acc, r) => acc + r.costUsd, 0);
  }

  checkPreflight({ estimatedCostUsd = 0, sessionId = "default_session", now = null } = {}) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();
    const est = Math.max(0, Number(estimatedCostUsd) || 0);

    // If already tripped, fail closed immediately
    if (this.state === "TRIPPED") {
      const receipt = this._buildReceipt({
        status: "BLOCKED",
        action: "preflight_check",
        reason: `circuit_already_tripped: ${this.tripReason}`,
        estimatedCostUsd: est,
        sessionId,
        now,
      });
      return {
        allowed: false,
        state: "TRIPPED",
        reason: this.tripReason,
        receipt,
      };
    }

    // 1. Single-request ceiling check
    if (est > this.maxCostPerRequestUsd) {
      this._trip("request_cost_limit_exceeded", `Estimated cost ($${est.toFixed(4)}) exceeds per-request limit ($${this.maxCostPerRequestUsd.toFixed(4)})`, nowMs);
      const receipt = this._buildReceipt({
        status: "TRIPPED",
        action: "preflight_check",
        reason: this.tripReason,
        estimatedCostUsd: est,
        sessionId,
        now,
      });
      return { allowed: false, state: "TRIPPED", reason: this.tripReason, receipt };
    }

    // 2. Session ceiling check
    const currentSessionCost = this.sessionCosts.get(sessionId) || 0;
    if (currentSessionCost + est > this.maxCostPerSessionUsd) {
      this._trip("session_cost_limit_exceeded", `Projected session cost ($${(currentSessionCost + est).toFixed(4)}) exceeds session limit ($${this.maxCostPerSessionUsd.toFixed(4)})`, nowMs);
      const receipt = this._buildReceipt({
        status: "TRIPPED",
        action: "preflight_check",
        reason: this.tripReason,
        estimatedCostUsd: est,
        sessionId,
        now,
      });
      return { allowed: false, state: "TRIPPED", reason: this.tripReason, receipt };
    }

    // 3. Rolling hourly ceiling check
    const rollingHourly = this._getRollingHourlyCost(nowMs);
    if (rollingHourly + est > this.maxCostPerHourUsd) {
      this._trip("hourly_cost_limit_exceeded", `Projected hourly cost ($${(rollingHourly + est).toFixed(4)}) exceeds hourly limit ($${this.maxCostPerHourUsd.toFixed(4)})`, nowMs);
      const receipt = this._buildReceipt({
        status: "TRIPPED",
        action: "preflight_check",
        reason: this.tripReason,
        estimatedCostUsd: est,
        sessionId,
        now,
      });
      return { allowed: false, state: "TRIPPED", reason: this.tripReason, receipt };
    }

    // Preflight OK
    return {
      allowed: true,
      state: "ACTIVE",
      estimated_cost_usd: est,
      session_remaining_usd: Math.max(0, this.maxCostPerSessionUsd - currentSessionCost),
      hourly_remaining_usd: Math.max(0, this.maxCostPerHourUsd - rollingHourly),
    };
  }

  recordExecutionCost({ actualCostUsd = 0, sessionId = "default_session", promptTokens = 0, completionTokens = 0, now = null } = {}) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();
    const cost = Math.max(0, Number(actualCostUsd) || 0);

    this.totalCostUsd += cost;
    this.totalExecutions += 1;

    const currentSessionCost = (this.sessionCosts.get(sessionId) || 0) + cost;
    this.sessionCosts.set(sessionId, currentSessionCost);

    this.hourlyRecords.push({ timestampMs: nowMs, costUsd: cost });
    const rollingHourly = this._getRollingHourlyCost(nowMs);

    // Post-execution boundary trip checks
    let status = "RECORDED";
    if (this.state !== "TRIPPED") {
      if (currentSessionCost > this.maxCostPerSessionUsd) {
        this._trip("session_cost_limit_breached", `Session cost ($${currentSessionCost.toFixed(4)}) breached limit ($${this.maxCostPerSessionUsd.toFixed(4)})`, nowMs);
        status = "TRIPPED";
      } else if (rollingHourly > this.maxCostPerHourUsd) {
        this._trip("hourly_cost_limit_breached", `Rolling hourly cost ($${rollingHourly.toFixed(4)}) breached limit ($${this.maxCostPerHourUsd.toFixed(4)})`, nowMs);
        status = "TRIPPED";
      }
    }

    const receipt = this._buildReceipt({
      status,
      action: "record_execution_cost",
      reason: this.tripReason || "cost_recorded_within_limits",
      actualCostUsd: cost,
      sessionId,
      promptTokens,
      completionTokens,
      now,
    });

    return {
      status,
      circuit_state: this.state,
      cost_recorded_usd: cost,
      session_total_usd: currentSessionCost,
      hourly_total_usd: rollingHourly,
      receipt,
    };
  }

  _trip(reasonCode, message, nowMs) {
    this.state = "TRIPPED";
    this.tripReason = `${reasonCode}: ${message}`;
    this.trippedAt = new Date(nowMs).toISOString();
  }

  reset({ authorizationKey, sessionId = null, now = null } = {}) {
    if (!authorizationKey || String(authorizationKey).length < 16) {
      throw new Error("Resetting cost kill-switch requires a valid operator authorizationKey (min 16 chars)");
    }
    const timestamp = isoNow(now || this.now);

    this.state = "ACTIVE";
    this.tripReason = null;
    this.trippedAt = null;

    if (sessionId) {
      this.sessionCosts.delete(sessionId);
    } else {
      this.sessionCosts.clear();
      this.hourlyRecords = [];
    }

    return this._buildReceipt({
      status: "RESET",
      action: "operator_reset",
      reason: "Cost kill-switch successfully reset by authorized operator",
      sessionId: sessionId || "all_sessions",
      now,
    });
  }

  _buildReceipt({ status, action, reason, estimatedCostUsd = 0, actualCostUsd = 0, sessionId = "", promptTokens = 0, completionTokens = 0, now = null }) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();

    const payload = {
      schema_version: COST_KILL_SWITCH_RECEIPT_SCHEMA,
      timestamp,
      status,
      action,
      circuit_state: this.state,
      trip_reason: this.tripReason,
      session_id: sessionId,
      metrics: {
        estimated_cost_usd: estimatedCostUsd,
        actual_cost_usd: actualCostUsd,
        session_total_usd: this.sessionCosts.get(sessionId) || 0,
        rolling_hourly_usd: this._getRollingHourlyCost(nowMs),
        lifetime_total_usd: this.totalCostUsd,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      },
      limits: {
        max_cost_per_request_usd: this.maxCostPerRequestUsd,
        max_cost_per_session_usd: this.maxCostPerSessionUsd,
        max_cost_per_hour_usd: this.maxCostPerHourUsd,
      },
      reason,
    };

    return Object.freeze({
      ...payload,
      receipt_sha256: sha256Hex(stableJson(payload)),
    });
  }

  getState({ now = null } = {}) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();

    return {
      schema_version: COST_KILL_SWITCH_SCHEMA,
      state: this.state,
      trip_reason: this.tripReason,
      tripped_at: this.trippedAt,
      lifetime_cost_usd: Math.round(this.totalCostUsd * 1e6) / 1e6,
      rolling_hourly_usd: Math.round(this._getRollingHourlyCost(nowMs) * 1e6) / 1e6,
      total_executions: this.totalExecutions,
      active_sessions_count: this.sessionCosts.size,
      limits: {
        max_cost_per_request_usd: this.maxCostPerRequestUsd,
        max_cost_per_session_usd: this.maxCostPerSessionUsd,
        max_cost_per_hour_usd: this.maxCostPerHourUsd,
      },
    };
  }
}
