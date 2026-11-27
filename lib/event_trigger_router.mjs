/**
 * Structured External Event Trigger Router & Task/Thread Worker Subscriptions (Phase 1).
 *
 * Implements:
 * 1. Explicit workflow states:
 *      event_received -> code_filtered -> subscribed_worker_routed | model_triaged | dropped_noise
 * 2. Cheap deterministic code filters FIRST (schema, byte cap, source allowlist, replay dedup,
 *    heartbeat/bot noise drop, prompt-injection & PII sanitization) before any optional model call.
 * 3. Task / Thread ownership subscriptions (`subscribeTask`): once a worker owns a task/thread,
 *    follow-up events matching `task_id` or `thread_id` (within the same trust zone and allowed
 *    sources) route straight to that worker without re-running full global triage.
 */

import crypto from "node:crypto";
import { FiniteWorkflowMachine } from "./workflow_state_machines.mjs";
import { scrubPii } from "./tool_guardrails_middleware.mjs";
import { sanitizePromptInjection } from "./a2a_boundary_guard.mjs";

export const EVENT_TRIGGER_RECEIPT_SCHEMA = "dizzy.event_trigger_receipt.v1";

export const EVENT_TRIGGER_STATES = Object.freeze({
  EVENT_RECEIVED: "event_received",
  CODE_FILTERED: "code_filtered",
  SUBSCRIBED_WORKER_ROUTED: "subscribed_worker_routed",
  MODEL_TRIAGED: "model_triaged",
  DROPPED_NOISE: "dropped_noise",
});

export const EVENT_TRIGGER_TRANSITIONS = Object.freeze({
  event_received: Object.freeze(["code_filtered", "dropped_noise"]),
  code_filtered: Object.freeze(["subscribed_worker_routed", "model_triaged", "dropped_noise"]),
  subscribed_worker_routed: Object.freeze([]),
  model_triaged: Object.freeze([]),
  dropped_noise: Object.freeze([]),
});

const DEFAULT_ALLOWED_SOURCES = Object.freeze([
  "github_webhook",
  "ci_pipeline",
  "local_fs_watcher",
  "cron_scheduler",
  "council_sidecar",
  "operator_cli",
  "telegram_webhook",
]);

const NOISE_EVENT_TYPES = new Set([
  "ping",
  "keepalive",
  "heartbeat_noop",
  "typing_indicator",
  "bot_self_echo",
  "empty_diff",
]);

const VALID_TRUST_ZONES = new Set([
  "private_self",
  "trusted_collaborator",
  "outside_contact",
  "paid_public",
]);

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256HexLower(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function sanitizeEventPayload(payload) {
  const promptCleaned = sanitizePromptInjection(payload);
  const scrubDeep = (val) => {
    if (typeof val === "string") return scrubPii(val).text;
    if (Array.isArray(val)) return val.map(scrubDeep);
    if (val && typeof val === "object") {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        out[k] = scrubDeep(v);
      }
      return out;
    }
    return val;
  };
  return scrubDeep(promptCleaned);
}

export class EventTriggerRouter {
  constructor(opts = {}) {
    this.allowedSources = new Set(opts.allowedSources || DEFAULT_ALLOWED_SOURCES);
    this.maxPayloadBytes = Math.max(1024, Number(opts.maxPayloadBytes || 32 * 1024));
    this.defaultSubscriptionTtlMs = Math.max(5_000, Number(opts.defaultSubscriptionTtlMs || 3600 * 1000));
    this.maxSeenEvents = Math.max(100, Number(opts.maxSeenEvents || 2000));
    this.now = opts.now || (() => new Date());

    this.seenEventIds = new Map(); // eventId -> timestampMs
    this.taskSubscriptions = new Map(); // key ("task:<id>" | "thread:<id>") -> subscription
  }

  _nowMs(now) {
    const val = typeof (now || this.now) === "function" ? (now || this.now)() : (now || this.now);
    return val instanceof Date ? val.getTime() : new Date(val || Date.now()).getTime();
  }

  _pruneExpired(nowMs) {
    for (const [key, sub] of this.taskSubscriptions.entries()) {
      if (sub.expires_at_ms <= nowMs) {
        this.taskSubscriptions.delete(key);
      }
    }
    if (this.seenEventIds.size > this.maxSeenEvents) {
      const oldestKey = this.seenEventIds.keys().next().value;
      if (oldestKey !== undefined) this.seenEventIds.delete(oldestKey);
    }
  }

  /**
   * Binds a task_id and/or thread_id to an owning worker within a specific trust zone.
   * Follow-up events matching the subscription bypass full model re-routing.
   */
  subscribeTask({
    taskId = null,
    threadId = null,
    workerId,
    trustZone = "private_self",
    allowedSources = null,
    ttlMs = null,
    now = null,
  } = {}) {
    if (!workerId || typeof workerId !== "string") {
      throw new Error("subscribeTask requires a non-empty workerId");
    }
    if (!taskId && !threadId) {
      throw new Error("subscribeTask requires at least taskId or threadId");
    }
    if (!VALID_TRUST_ZONES.has(trustZone)) {
      throw new Error(`Invalid trustZone '${trustZone}' for subscription`);
    }

    const nowMs = this._nowMs(now);
    const effectiveTtl = Number.isFinite(Number(ttlMs)) && Number(ttlMs) > 0
      ? Number(ttlMs)
      : this.defaultSubscriptionTtlMs;

    const record = {
      subscription_id: `sub_${nowMs}_${crypto.randomBytes(4).toString("hex")}`,
      task_id: taskId ? String(taskId).trim() : null,
      thread_id: threadId ? String(threadId).trim() : null,
      worker_id: String(workerId).trim(),
      trust_zone: trustZone,
      allowed_sources: Array.isArray(allowedSources) && allowedSources.length > 0
        ? [...new Set(allowedSources.map((s) => String(s).trim()))]
        : null,
      created_at: new Date(nowMs).toISOString(),
      expires_at_ms: nowMs + effectiveTtl,
      routed_followup_count: 0,
    };

    if (record.task_id) this.taskSubscriptions.set(`task:${record.task_id}`, record);
    if (record.thread_id) this.taskSubscriptions.set(`thread:${record.thread_id}`, record);
    return { ...record };
  }

  unsubscribeTask({ taskId = null, threadId = null } = {}) {
    let removed = false;
    if (taskId) removed = this.taskSubscriptions.delete(`task:${String(taskId).trim()}`) || removed;
    if (threadId) removed = this.taskSubscriptions.delete(`thread:${String(threadId).trim()}`) || removed;
    return removed;
  }

  listSubscriptions({ now = null } = {}) {
    const nowMs = this._nowMs(now);
    this._pruneExpired(nowMs);
    const unique = new Map();
    for (const sub of this.taskSubscriptions.values()) {
      unique.set(sub.subscription_id, {
        ...sub,
        expires_at: new Date(sub.expires_at_ms).toISOString(),
      });
    }
    return Array.from(unique.values());
  }

  /**
   * Ingests a structured external event:
   *   1. Cheap deterministic code filters run first (0 model tokens).
   *   2. Active task/thread subscription routes directly to owning worker if matched & authorized.
   *   3. Only unowned, substantive events invoke optional modelTriageFn.
   */
  async ingestEvent(event = {}, { modelTriageFn = null, now = null } = {}) {
    const nowMs = this._nowMs(now);
    const nowDate = new Date(nowMs);
    this._pruneExpired(nowMs);

    const fsm = new FiniteWorkflowMachine({
      workflowName: "external_event_triggers",
      initialState: EVENT_TRIGGER_STATES.EVENT_RECEIVED,
      transitions: EVENT_TRIGGER_TRANSITIONS,
      now: () => nowDate,
    });

    const eventId = String(event?.event_id || "").trim();
    const eventType = String(event?.event_type || "").trim().toLowerCase();
    const source = String(event?.source || "").trim();
    const trustZone = String(event?.trust_zone || "outside_contact").trim();
    const taskId = event?.task_id ? String(event.task_id).trim() : null;
    const threadId = event?.thread_id ? String(event.thread_id).trim() : null;
    const rawPayload = event?.payload && typeof event.payload === "object" ? event.payload : {};

    // Cheap Deterministic Filter 1: Required structure & valid trust zone
    if (!eventId || !eventType || !source || !VALID_TRUST_ZONES.has(trustZone)) {
      fsm.transition(EVENT_TRIGGER_STATES.DROPPED_NOISE, { reason: "invalid_event_envelope" });
      return this._buildOutcome({
        fsm,
        eventId: eventId || "missing",
        eventType: eventType || "missing",
        source: source || "missing",
        trustZone,
        dropReason: "invalid_event_envelope",
        modelInvoked: false,
        nowDate,
      });
    }

    // Cheap Deterministic Filter 2: Source allowlist
    if (!this.allowedSources.has(source)) {
      fsm.transition(EVENT_TRIGGER_STATES.DROPPED_NOISE, { reason: "untrusted_event_source" });
      return this._buildOutcome({
        fsm,
        eventId,
        eventType,
        source,
        trustZone,
        dropReason: `untrusted_event_source:${source}`,
        modelInvoked: false,
        nowDate,
      });
    }

    // Cheap Deterministic Filter 3: Payload byte cap
    const rawJson = stableJson(rawPayload);
    const payloadBytes = Buffer.byteLength(rawJson, "utf8");
    if (payloadBytes > this.maxPayloadBytes) {
      fsm.transition(EVENT_TRIGGER_STATES.DROPPED_NOISE, { reason: "payload_exceeds_byte_cap" });
      return this._buildOutcome({
        fsm,
        eventId,
        eventType,
        source,
        trustZone,
        dropReason: "payload_exceeds_byte_cap",
        modelInvoked: false,
        nowDate,
      });
    }

    // Cheap Deterministic Filter 4: Replay / duplicate event_id filter
    if (this.seenEventIds.has(eventId)) {
      fsm.transition(EVENT_TRIGGER_STATES.DROPPED_NOISE, { reason: "duplicate_event_id" });
      return this._buildOutcome({
        fsm,
        eventId,
        eventType,
        source,
        trustZone,
        dropReason: "duplicate_event_id",
        modelInvoked: false,
        nowDate,
      });
    }
    this.seenEventIds.set(eventId, nowMs);

    // Cheap Deterministic Filter 5: Noise / heartbeat / self-echo event types
    if (NOISE_EVENT_TYPES.has(eventType) || rawPayload.is_bot === true) {
      fsm.transition(EVENT_TRIGGER_STATES.DROPPED_NOISE, { reason: "cheap_noise_filter" });
      return this._buildOutcome({
        fsm,
        eventId,
        eventType,
        source,
        trustZone,
        dropReason: "cheap_noise_filter",
        modelInvoked: false,
        nowDate,
      });
    }

    // Passed cheap code filters -> sanitize payload
    const sanitizedPayload = sanitizeEventPayload(rawPayload);
    fsm.transition(EVENT_TRIGGER_STATES.CODE_FILTERED, { reason: "passed_deterministic_code_filters" });

    // Check active Task / Thread Subscription
    const matchedSub = (taskId && this.taskSubscriptions.get(`task:${taskId}`))
      || (threadId && this.taskSubscriptions.get(`thread:${threadId}`))
      || null;

    if (matchedSub) {
      // Enforce strict trust-zone & source boundary so external events cannot hijack private subscriptions
      if (matchedSub.trust_zone !== trustZone) {
        fsm.transition(EVENT_TRIGGER_STATES.DROPPED_NOISE, {
          reason: "subscription_trust_zone_mismatch",
        });
        return this._buildOutcome({
          fsm,
          eventId,
          eventType,
          source,
          trustZone,
          dropReason: "subscription_trust_zone_mismatch",
          modelInvoked: false,
          nowDate,
        });
      }
      if (matchedSub.allowed_sources && !matchedSub.allowed_sources.includes(source)) {
        fsm.transition(EVENT_TRIGGER_STATES.DROPPED_NOISE, {
          reason: "subscription_source_not_allowed",
        });
        return this._buildOutcome({
          fsm,
          eventId,
          eventType,
          source,
          trustZone,
          dropReason: "subscription_source_not_allowed",
          modelInvoked: false,
          nowDate,
        });
      }

      matchedSub.routed_followup_count += 1;
      fsm.transition(EVENT_TRIGGER_STATES.SUBSCRIBED_WORKER_ROUTED, {
        reason: `routed_to_subscribed_worker:${matchedSub.worker_id}`,
      });
      return this._buildOutcome({
        fsm,
        eventId,
        eventType,
        source,
        trustZone,
        sanitizedPayload,
        routedWorkerId: matchedSub.worker_id,
        subscriptionId: matchedSub.subscription_id,
        fullRerouteSkipped: true,
        modelInvoked: false,
        nowDate,
      });
    }

    // Unowned substantive event -> optional bounded model judgment
    let triageDecision = { action: "queued_for_router", confidence: 1.0 };
    let modelInvoked = false;
    if (typeof modelTriageFn === "function" && event.allow_model_judgment !== false) {
      modelInvoked = true;
      triageDecision = await modelTriageFn({
        event_id: eventId,
        event_type: eventType,
        source,
        trust_zone: trustZone,
        payload: sanitizedPayload,
      });
    }

    fsm.transition(EVENT_TRIGGER_STATES.MODEL_TRIAGED, {
      reason: modelInvoked ? "optional_model_triage_completed" : "deterministic_default_triage",
    });

    return this._buildOutcome({
      fsm,
      eventId,
      eventType,
      source,
      trustZone,
      sanitizedPayload,
      triageDecision,
      fullRerouteSkipped: false,
      modelInvoked,
      nowDate,
    });
  }

  _buildOutcome({
    fsm,
    eventId,
    eventType,
    source,
    trustZone,
    sanitizedPayload = null,
    routedWorkerId = null,
    subscriptionId = null,
    triageDecision = null,
    dropReason = null,
    fullRerouteSkipped = false,
    modelInvoked = false,
    nowDate,
  }) {
    const receiptCore = {
      schema_version: EVENT_TRIGGER_RECEIPT_SCHEMA,
      timestamp: nowDate.toISOString(),
      event_id: eventId,
      event_type: eventType,
      source,
      trust_zone: trustZone,
      workflow_state: fsm.state,
      routed_worker_id: routedWorkerId,
      subscription_id: subscriptionId,
      full_reroute_skipped: Boolean(fullRerouteSkipped),
      model_invoked: Boolean(modelInvoked),
      drop_reason: dropReason,
      sanitized_payload_sha256: sanitizedPayload ? sha256HexLower(stableJson(sanitizedPayload)) : null,
    };
    const receipt = {
      ...receiptCore,
      receipt_sha256: sha256HexLower(stableJson(receiptCore)),
    };

    return {
      accepted: fsm.state !== EVENT_TRIGGER_STATES.DROPPED_NOISE,
      workflow_state: fsm.state,
      routed_worker_id: routedWorkerId,
      subscription_id: subscriptionId,
      full_reroute_skipped: Boolean(fullRerouteSkipped),
      model_invoked: Boolean(modelInvoked),
      drop_reason: dropReason,
      sanitized_payload: sanitizedPayload,
      triage_decision: triageDecision,
      receipt,
    };
  }
}
