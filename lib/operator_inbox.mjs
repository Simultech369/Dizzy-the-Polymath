/**
 * Unified Operator Inbox (Phase 1 & Phase 3b).
 *
 * Aggregates actionable operator items into ONE calm, structured surface:
 *   1. Pending human approvals (`waiting_for_approval`) & crash-recoverable runs
 *   2. Spend stops (`TRIPPED`) and soft-budget alerts (>= 80% threshold)
 *   3. Execution blockers (watchdog containment stops, circuit breakers, DLQ items, Council blockers)
 *   4. Open operator questions
 *
 * Never dumps raw tool traces or raw JSON logs into the conversation/inbox surface;
 * each item carries an `inspect_correlation_id` linking to Inspect / Replay.
 */

import crypto from "node:crypto";

export const OPERATOR_INBOX_SCHEMA = "dizzy.operator_inbox.v1";

const SEVERITY_RANK = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
});

export class OperatorInboxStore {
  constructor(opts = {}) {
    this.now = opts.now || (() => new Date());
    this.questions = new Map(); // question_id -> item
  }

  addQuestion({
    questionId = null,
    title,
    whyBlocked = "Operator clarification required before proceeding",
    correlationId = null,
    trustZone = "private_self",
    options = [],
    now = null,
  } = {}) {
    if (!title || typeof title !== "string") {
      throw new Error("OperatorInboxStore.addQuestion requires a non-empty title");
    }
    const tsVal = typeof (now || this.now) === "function" ? (now || this.now)() : (now || this.now);
    const timestamp = tsVal instanceof Date ? tsVal.toISOString() : new Date(tsVal || Date.now()).toISOString();
    const id = questionId || `q_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

    const question = {
      question_id: id,
      title: title.trim(),
      why_blocked: String(whyBlocked || "").trim(),
      correlation_id: correlationId || id,
      trust_zone: trustZone,
      options: Array.isArray(options) ? options.map((o) => String(o)) : [],
      status: "waiting_for_answer",
      answer: null,
      created_at: timestamp,
      resolved_at: null,
    };
    this.questions.set(id, question);
    return { ...question };
  }

  answerQuestion({ questionId, answer, actorId = "operator", now = null } = {}) {
    const existing = this.questions.get(String(questionId || ""));
    if (!existing) {
      throw new Error(`Operator question '${questionId}' not found`);
    }
    const tsVal = typeof (now || this.now) === "function" ? (now || this.now)() : (now || this.now);
    const timestamp = tsVal instanceof Date ? tsVal.toISOString() : new Date(tsVal || Date.now()).toISOString();

    existing.status = "answered";
    existing.answer = String(answer ?? "").trim();
    existing.actor_id = String(actorId || "operator");
    existing.resolved_at = timestamp;
    return { ...existing };
  }

  buildInboxSnapshot({
    hitlGateway = null,
    costKillSwitch = null,
    watchdogAlerts = [],
    deadLetterCount = 0,
    councilBridgeStatus = null,
    now = null,
  } = {}) {
    const tsVal = typeof (now || this.now) === "function" ? (now || this.now)() : (now || this.now);
    const timestamp = tsVal instanceof Date ? tsVal.toISOString() : new Date(tsVal || Date.now()).toISOString();
    const items = [];

    // 1. Pending Human Approvals & Crash-Recoverable Runs
    if (hitlGateway) {
      const pending = hitlGateway.listPending({ now: timestamp });
      for (const cp of pending) {
        items.push({
          item_id: cp.checkpoint_id,
          category: "approval",
          severity: "high",
          workflow_state: cp.workflow_state || "waiting_for_approval",
          title: `Approval required: ${cp.action_type}`,
          why_blocked: "Execution paused at human-approval gate; operator must approve or reject.",
          recommended_action: "Review action digest and approve or reject in Operator Inbox.",
          resume_token: cp.resume_token,
          inspect_correlation_id: cp.run_id || cp.checkpoint_id,
          created_at: cp.created_at,
          expires_at: cp.expires_at,
        });
      }

      if (typeof hitlGateway.listRecoverableRuns === "function") {
        for (const run of hitlGateway.listRecoverableRuns()) {
          if (run.workflow_state === "approved") {
            items.push({
              item_id: `resume_${run.run_id}`,
              category: "resumable_run",
              severity: "medium",
              workflow_state: run.workflow_state,
              title: `Approved run ready to resume: ${run.action_type}`,
              why_blocked: "Approved by operator; waiting for worker/operator resume trigger.",
              recommended_action: "Resume from saved checkpoint without restarting work.",
              resume_token: run.resume_token,
              inspect_correlation_id: run.run_id,
              created_at: run.updated_at,
            });
          }
        }
      }
    }

    // 2. Spend Stops & Soft-Cap Alerts
    if (costKillSwitch) {
      const budgetStatus = typeof costKillSwitch.getBudgetTelemetry === "function"
        ? costKillSwitch.getBudgetTelemetry({ now: timestamp })
        : {
          state: costKillSwitch.state,
          trip_reason: costKillSwitch.tripReason,
          hourly_utilization_ratio: 0,
          alerts: [],
        };

      if (budgetStatus.state === "TRIPPED") {
        items.push({
          item_id: "spend_stop_tripped",
          category: "spend_stop",
          severity: "critical",
          workflow_state: "blocked",
          title: "Spending cap reached (Cost Kill-Switch tripped)",
          why_blocked: budgetStatus.trip_reason || "Spending limit exceeded; paid model routes halted.",
          recommended_action: "Inspect session spend or reset Cost Kill-Switch if authorized.",
          inspect_correlation_id: "cost_guard",
          created_at: costKillSwitch.trippedAt || timestamp,
        });
      } else if (Array.isArray(budgetStatus.alerts) && budgetStatus.alerts.length > 0) {
        for (const alert of budgetStatus.alerts) {
          items.push({
            item_id: `spend_alert_${alert.scope}`,
            category: "spend_alert",
            severity: "medium",
            workflow_state: "warning",
            title: `Budget alert (${alert.scope}): ${Math.round(alert.utilization_ratio * 100)}% used`,
            why_blocked: alert.message,
            recommended_action: "Monitor paid model usage or route tasks to local/deterministic seats.",
            inspect_correlation_id: "cost_guard",
            created_at: timestamp,
          });
        }
      }
    }

    // 3. Watchdog Stops & Execution Blockers
    for (const wd of watchdogAlerts) {
      items.push({
        item_id: wd.alert_id || `watchdog_${items.length + 1}`,
        category: "blocker",
        severity: "high",
        workflow_state: wd.state || "halted",
        title: `Watchdog stopped non-progressing task (${wd.reason_code || "spin_detected"})`,
        why_blocked: wd.message || "Repeated identical tool/model attempts made no progress.",
        recommended_action: "Inspect replay trace and adjust task constraints or approve retry.",
        inspect_correlation_id: wd.correlation_id || "watchdog",
        created_at: wd.timestamp || timestamp,
      });
    }

    if (Number(deadLetterCount) > 0) {
      items.push({
        item_id: "dlq_failed_jobs",
        category: "blocker",
        severity: "medium",
        workflow_state: "dead",
        title: `${Number(deadLetterCount)} dead-lettered background job(s)`,
        why_blocked: "Background worker exhausted safe retries and moved failed jobs to dead-letter queue.",
        recommended_action: "Inspect dead-letter summary under Inspect / Replay.",
        inspect_correlation_id: "worker_dlq",
        created_at: timestamp,
      });
    }

    if (councilBridgeStatus?.open_blockers?.length) {
      items.push({
        item_id: "council_promotion_blockers",
        category: "promotion_gate",
        severity: "info",
        workflow_state: "rehearsal_only",
        title: `Council sidecar promotion gated (${councilBridgeStatus.open_blockers.length} open prerequisites)`,
        why_blocked: councilBridgeStatus.open_blockers.join("; "),
        recommended_action: "Keep CouncilEngine in offline verification helper mode until prerequisites pass.",
        inspect_correlation_id: "council_bridge",
        created_at: timestamp,
      });
    }

    // 4. Open Operator Questions
    for (const q of this.questions.values()) {
      if (q.status === "waiting_for_answer") {
        items.push({
          item_id: q.question_id,
          category: "question",
          severity: "medium",
          workflow_state: "waiting_for_approval",
          title: q.title,
          why_blocked: q.why_blocked,
          recommended_action: "Provide operator decision to unblock waiting task.",
          options: q.options,
          inspect_correlation_id: q.correlation_id,
          created_at: q.created_at,
        });
      }
    }

    items.sort((a, b) => {
      const rankDiff = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
      if (rankDiff !== 0) return rankDiff;
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });

    const counts = {
      total: items.length,
      approvals: items.filter((i) => i.category === "approval" || i.category === "resumable_run").length,
      blockers: items.filter((i) => i.category === "blocker" || i.category === "promotion_gate").length,
      spend_stops: items.filter((i) => i.category === "spend_stop" || i.category === "spend_alert").length,
      questions: items.filter((i) => i.category === "question").length,
    };

    return {
      schema_version: OPERATOR_INBOX_SCHEMA,
      timestamp,
      surface_mode: "operator_conversation_and_status",
      raw_tool_logs_included: false,
      empty_state_message: items.length === 0 ? "Nothing waiting in Operator Inbox. Approvals, spend alerts, and blockers appear here." : null,
      counts,
      items,
    };
  }
}
