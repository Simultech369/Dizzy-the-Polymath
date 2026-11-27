/**
 * Explicit Workflow Registry & Finite State Machine Guards (Phase 0.5).
 *
 * Enforces the repository-wide rule:
 *   Every multi-step workflow must declare named states, explicit allowed transitions,
 *   clear operator/developer next steps, and deterministic rejection of illegal jumps.
 *
 * Primary executable state machines:
 *   1. human_approval: running -> waiting_for_approval -> approved | rejected -> resumed | cancelled
 *   2. streaming:      open -> streaming -> stalled -> completed | aborted
 *   3. dashboard_load: booting -> checking_session -> loading_data -> ready | degraded_offline | auth_required
 *
 * Also exports WORKFLOW_CATALOG enumerating every multi-stage workflow in Dizzy + CouncilEngine.
 */

import crypto from "node:crypto";

export const WORKFLOW_TRANSITION_RECEIPT_SCHEMA = "dizzy.workflow_transition_receipt.v1";

export class IllegalWorkflowTransitionError extends Error {
  constructor({ workflow, fromState, toState, allowedNext = [] }) {
    const allowedText = allowedNext.length > 0 ? allowedNext.join(", ") : "none (terminal state)";
    super(
      `Illegal '${workflow}' state transition: '${fromState}' -> '${toState}'. Allowed next states: [${allowedText}]`
    );
    this.name = "IllegalWorkflowTransitionError";
    this.code = "ILLEGAL_STATE_TRANSITION";
    this.workflow = workflow;
    this.fromState = fromState;
    this.toState = toState;
    this.allowedNext = allowedNext;
  }
}

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

export const HUMAN_APPROVAL_STATES = Object.freeze({
  RUNNING: "running",
  WAITING_FOR_APPROVAL: "waiting_for_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  RESUMED: "resumed",
  CANCELLED: "cancelled",
});

export const HUMAN_APPROVAL_TRANSITIONS = Object.freeze({
  running: Object.freeze(["waiting_for_approval", "cancelled"]),
  waiting_for_approval: Object.freeze(["approved", "rejected", "cancelled"]),
  approved: Object.freeze(["resumed", "cancelled"]),
  rejected: Object.freeze(["cancelled"]),
  resumed: Object.freeze([]),
  cancelled: Object.freeze([]),
});

export const HUMAN_APPROVAL_NEXT_STEPS = Object.freeze({
  running: "Save step progress or pause at a sensitive boundary (waiting_for_approval), or cancel.",
  waiting_for_approval: "Operator must review checkpoint in Operator Inbox and approve or reject (or cancel).",
  approved: "Caller/worker may verify resume_token, restore saved progress, and transition to resumed (or cancel).",
  rejected: "Execution blocked by operator rejection. Record failure or transition to cancelled; never resume.",
  resumed: "Terminal approval handoff complete; resumed execution proceeds from saved checkpoint.",
  cancelled: "Terminal cancelled state; no further transitions permitted.",
});

export const STREAMING_STATES = Object.freeze({
  OPEN: "open",
  STREAMING: "streaming",
  STALLED: "stalled",
  COMPLETED: "completed",
  ABORTED: "aborted",
});

export const STREAMING_TRANSITIONS = Object.freeze({
  open: Object.freeze(["streaming", "stalled", "completed", "aborted"]),
  streaming: Object.freeze(["streaming", "stalled", "completed", "aborted"]),
  stalled: Object.freeze(["streaming", "completed", "aborted"]),
  completed: Object.freeze([]),
  aborted: Object.freeze([]),
});

export const STREAMING_NEXT_STEPS = Object.freeze({
  open: "Emit first SSE frame (streaming), complete empty response, mark stalled, or abort on disconnect.",
  streaming: "Continue emitting frames, mark stalled if ITL exceeds stallThresholdMs, complete, or abort.",
  stalled: "Recover to streaming if upstream emits before stallAbortMs, complete, or abort on stall timeout.",
  completed: "Terminal completed stream; emit hash-bound stream receipt only.",
  aborted: "Terminal aborted stream; propagate AbortController to upstream provider and seal receipt.",
});

export const DASHBOARD_LOAD_STATES = Object.freeze({
  BOOTING: "booting",
  CHECKING_SESSION: "checking_session",
  LOADING_DATA: "loading_data",
  READY: "ready",
  DEGRADED_OFFLINE: "degraded_offline",
  AUTH_REQUIRED: "auth_required",
});

export const DASHBOARD_LOAD_TRANSITIONS = Object.freeze({
  booting: Object.freeze(["checking_session", "loading_data", "degraded_offline"]),
  checking_session: Object.freeze(["loading_data", "auth_required", "degraded_offline"]),
  loading_data: Object.freeze(["ready", "degraded_offline", "auth_required"]),
  ready: Object.freeze(["loading_data", "degraded_offline", "auth_required"]),
  degraded_offline: Object.freeze(["checking_session", "loading_data", "ready"]),
  auth_required: Object.freeze(["checking_session", "loading_data"]),
});

/**
 * Complete inventory of staged workflows across Dizzy (control plane) and CouncilEngine (offline verifier).
 */
export const WORKFLOW_CATALOG = Object.freeze([
  {
    id: "human_approval",
    owner: "dizzy+council",
    module: "lib/hitl_approval_gateway.mjs, CouncilEngine/human_approval.py",
    states: ["running", "waiting_for_approval", "approved", "rejected", "resumed", "cancelled"],
    persistence: "runtime/hitl/runs.jsonl + runtime/hitl/checkpoints.jsonl + runtime/hitl/audit_log.jsonl",
    test_command: "npm run test:workflow-states && npm run test:hitl-gateway",
    summary: "Pauses sensitive actions for human dual-control approval with crash-safe progress snapshots and single-use resume.",
  },
  {
    id: "streaming_response",
    owner: "dizzy",
    module: "lib/sse_stream.mjs, agent_server.mjs",
    states: ["open", "streaming", "stalled", "completed", "aborted"],
    persistence: "dizzy.stream_receipt.v1 JSONL receipts",
    test_command: "npm run test:streaming-response && npm run test:workflow-states",
    summary: "Tracks SSE response lifecycle, inter-token latency stalls, backpressure, and upstream abort propagation.",
  },
  {
    id: "statem_runbook",
    owner: "dizzy+council",
    module: "lib/statem_runbook_bridge.mjs, lib/statem_checkpoint.mjs, CouncilEngine/statem_runbook_bridge.py",
    states: ["plan", "execute", "verify", "handoff"],
    persistence: "runtime/checkpoints/statem.jsonl",
    test_command: "npm run test:statem-runbook",
    summary: "Four-phase deterministic runbook FSM requiring passing verification barriers before handoff.",
  },
  {
    id: "cognitive_memory_lifecycle",
    owner: "dizzy",
    module: "lib/cognitive_memory_engine.mjs, lib/memory_wiki_adapter.mjs",
    states: ["captured", "consolidated", "retrieved", "reconciled", "decayed", "deleted"],
    persistence: "trust-zone partitioned wiki Markdown + memory audit receipts",
    test_command: "npm run test:cognitive-memory && npm run test:memory-wiki",
    summary: "Five-stage bounded memory lifecycle partitioned by trust_zone and sensitivity_tier with explicit deletion records.",
  },
  {
    id: "tool_execution_guardrails",
    owner: "dizzy",
    module: "lib/lifecycle_hooks.mjs, lib/tool_guardrails_middleware.mjs, lib/tools.mjs",
    states: ["session_start", "pre_tool_check", "executing_sandbox", "post_tool_scrub", "completed", "denied"],
    persistence: "PreToolUse/PostToolUse + dizzy.tool_guardrail_receipt.v1",
    test_command: "npm run test:tool-guardrails && npm run test:lifecycle-hooks",
    summary: "Zone capability check, traversal/injection input guard, bounded execution, PII output scrub, and hash receipt.",
  },
  {
    id: "a2a_mailbox_delivery",
    owner: "dizzy",
    module: "lib/a2a_boundary_guard.mjs, lib/a2a_mailbox_bridge.mjs, lib/inter_agent_sanitization_proxy.mjs",
    states: ["signed_ingress", "sanitized_queued", "leased", "acked", "expired_requeued", "dead_letter"],
    persistence: "in-memory/durable mailbox queue + dizzy.a2a_dispatch_receipt.v1",
    test_command: "npm run test:a2a-mailbox && npm run test:a2a-boundary && npm run test:inter-agent-proxy",
    summary: "Verifies Ed25519/HMAC signatures, strips prompt injection across agent boundaries, leases work, and tracks ACKs.",
  },
  {
    id: "model_routing_fallback",
    owner: "dizzy",
    module: "lib/routing_policy.mjs, lib/dispatch.mjs",
    states: ["classified", "budget_checked", "primary_attempt", "fallback_attempt", "local_or_cache_degraded", "hitl_approval_required", "failed_closed"],
    persistence: "dizzy.routing_delta_receipt.v1",
    test_command: "npm run test:routing-policy && npm run test:physical-budget-routing",
    summary: "Routes deterministic math/logic to T0 code/Council and NL to bounded model tiers with ordered fallback.",
  },
  {
    id: "context_assembly_budget",
    owner: "dizzy",
    module: "lib/context_assembler.mjs, lib/context_packer.mjs",
    states: ["zone_scoped", "sources_admitted", "scored_deduped", "packed", "truncated_with_receipt", "failed_safe_overflow"],
    persistence: "dizzy.context_assembler.v2 provenance receipt",
    test_command: "npm run test:context-packer",
    summary: "Packs MUST_INCLUDE / OPTIONAL_EVIDENCE / FORBIDDEN slots within zone byte budgets; fails safe if context overflows.",
  },
  {
    id: "pii_safe_external_inference",
    owner: "dizzy",
    module: "lib/pii_safe_inference_proxy.mjs, lib/dispatch.mjs",
    states: ["raw_input", "egress_zone_checked", "masked_placeholders", "hosted_call", "rehydrated", "blocked_private_leak"],
    persistence: "dizzy.pii_proxy_receipt.v1",
    test_command: "npm run test:pii-proxy",
    summary: "Replaces PII with stable surrogates before hosted calls, blocks private-zone exfiltration, and restores locally.",
  },
  {
    id: "external_event_triggers",
    owner: "dizzy",
    module: "lib/event_trigger_router.mjs, worker.mjs",
    states: ["event_received", "code_filtered", "subscribed_worker_routed", "model_triaged", "dropped_noise"],
    persistence: "dizzy.event_trigger_receipt.v1",
    test_command: "npm run test:event-triggers",
    summary: "Runs cheap deterministic code filters on structured events first and routes follow-ups to subscribed task owners.",
  },
  {
    id: "worker_job_queue",
    owner: "dizzy",
    module: "lib/queue.mjs, worker.mjs",
    states: ["queued", "running", "succeeded", "retry_scheduled", "dead"],
    persistence: "Redis/local queue + runtime/dlq/*.jsonl",
    test_command: "npm test",
    summary: "Background worker execution with READ-only exponential backoff retries (1s/4s/16s) and dead-letter receipts.",
  },
  {
    id: "consistency_boundary_promotion",
    owner: "dizzy+council",
    module: "lib/consistency_boundary.mjs",
    states: ["SYNTHETIC_REHEARSAL", "LOCAL_RECEIPT_VERIFIED", "GLOBAL_CONSENSUS_FINALIZED"],
    persistence: "dizzy.trajectory_contract_receipt.v1",
    test_command: "npm run test:consistency-boundary",
    summary: "Prevents leapfrogging from dry-run rehearsal to finalized authority without local receipts and human sign-off.",
  },
  {
    id: "council_verification_bridge",
    owner: "dizzy+council",
    module: "lib/node_python_council_bridge_contract.mjs, CouncilEngine/council_api_server.py",
    states: ["queued", "verifying", "waiting_for_approval", "approved", "rejected", "blocked"],
    persistence: "dizzy.node_python_council_bridge_contract.v1 + CouncilEngine receipts",
    test_command: "npm run test:node-python-bridge-contract && npm run test:dizzy-council-contract",
    summary: "Offline Council verification job lifecycle reporting promotion blockers and shared HITL approval states.",
  },
  {
    id: "client_continuity_retention",
    owner: "dizzy",
    module: "lib/client_continuity.mjs",
    states: ["clean_start", "reused_scoped_context", "exported", "pruned_expired", "deleted_by_operator"],
    persistence: "runtime/continuity/*.json + audit receipts",
    test_command: "npm test",
    summary: "Controls when multi-turn chats may reuse context vs must start clean by trust zone and inactivity TTL.",
  },
  {
    id: "dashboard_ui_lifecycle",
    owner: "dizzy",
    module: "dashboard/index.html, dashboard/dashboard.js",
    states: ["booting", "checking_session", "loading_data", "ready", "degraded_offline", "auth_required"],
    persistence: "localStorage UI preferences + server session cookie",
    test_command: "npm run test:dashboard-public-surface && npm run test:dashboard-safety",
    summary: "Non-blocking operator UI startup, settings persistence across updates, and explicit offline/degraded banners.",
  },
]);

export function validateWorkflowTransition(transitionTable, workflowName, fromState, toState) {
  const normalizedFrom = String(fromState ?? "").trim();
  const normalizedTo = String(toState ?? "").trim();

  if (!Object.prototype.hasOwnProperty.call(transitionTable, normalizedFrom)) {
    throw new IllegalWorkflowTransitionError({
      workflow: workflowName,
      fromState: normalizedFrom,
      toState: normalizedTo,
      allowedNext: [],
    });
  }

  const allowedNext = transitionTable[normalizedFrom] || [];
  if (!allowedNext.includes(normalizedTo)) {
    throw new IllegalWorkflowTransitionError({
      workflow: workflowName,
      fromState: normalizedFrom,
      toState: normalizedTo,
      allowedNext,
    });
  }

  return {
    ok: true,
    workflow: workflowName,
    from_state: normalizedFrom,
    to_state: normalizedTo,
    allowed_next: transitionTable[normalizedTo] || [],
  };
}

/**
 * Reusable explicit finite state machine with transition history and hash-backed receipts.
 */
export class FiniteWorkflowMachine {
  constructor({
    workflowName,
    initialState,
    transitions,
    nextSteps = {},
    runId = null,
    now = () => new Date(),
  }) {
    if (!workflowName || typeof workflowName !== "string") {
      throw new Error("workflowName is required");
    }
    if (!transitions || !Object.prototype.hasOwnProperty.call(transitions, initialState)) {
      throw new Error(`Invalid initialState '${initialState}' for workflow '${workflowName}'`);
    }
    this.workflowName = workflowName;
    this.transitions = transitions;
    this.nextSteps = nextSteps;
    this.state = initialState;
    this.runId = runId || `${workflowName}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    this.now = now;
    this.history = [];
  }

  getAllowedNextStates() {
    return [...(this.transitions[this.state] || [])];
  }

  getNextStepGuidance() {
    return this.nextSteps[this.state] || "";
  }

  isTerminal() {
    return this.getAllowedNextStates().length === 0;
  }

  canTransitionTo(targetState) {
    return (this.transitions[this.state] || []).includes(String(targetState ?? "").trim());
  }

  transition(targetState, { actor = "system", reason = "", metadata = {}, now = null } = {}) {
    const check = validateWorkflowTransition(this.transitions, this.workflowName, this.state, targetState);
    const tsValue = typeof (now || this.now) === "function" ? (now || this.now)() : (now || this.now);
    const timestamp = tsValue instanceof Date ? tsValue.toISOString() : new Date(tsValue || Date.now()).toISOString();

    const prevReceiptHash = this.history.length > 0
      ? this.history[this.history.length - 1].receipt_sha256
      : "0".repeat(64);

    const record = {
      schema_version: WORKFLOW_TRANSITION_RECEIPT_SCHEMA,
      workflow: this.workflowName,
      run_id: this.runId,
      from_state: check.from_state,
      to_state: check.to_state,
      actor: String(actor || "system"),
      reason: String(reason || ""),
      metadata: metadata && typeof metadata === "object" ? { ...metadata } : {},
      allowed_next_states: [...check.allowed_next],
      next_step: this.nextSteps[check.to_state] || "",
      prev_receipt_sha256: prevReceiptHash,
      timestamp,
    };
    record.receipt_sha256 = sha256HexLower(stableJson(record));

    this.state = check.to_state;
    this.history.push(record);
    return record;
  }

  toSnapshot() {
    return {
      workflow: this.workflowName,
      run_id: this.runId,
      state: this.state,
      allowed_next_states: this.getAllowedNextStates(),
      next_step: this.getNextStepGuidance(),
      is_terminal: this.isTerminal(),
      history: [...this.history],
    };
  }

  static fromSnapshot(snapshot, { transitions, nextSteps = {}, now = () => new Date() }) {
    if (!snapshot || typeof snapshot !== "object") {
      throw new Error("Invalid workflow snapshot");
    }
    const machine = new FiniteWorkflowMachine({
      workflowName: snapshot.workflow,
      initialState: snapshot.state,
      transitions,
      nextSteps,
      runId: snapshot.run_id,
      now,
    });
    machine.history = Array.isArray(snapshot.history) ? [...snapshot.history] : [];
    return machine;
  }
}

export function createHumanApprovalStateMachine({
  runId = null,
  initialState = HUMAN_APPROVAL_STATES.RUNNING,
  now = () => new Date(),
} = {}) {
  return new FiniteWorkflowMachine({
    workflowName: "human_approval",
    initialState,
    transitions: HUMAN_APPROVAL_TRANSITIONS,
    nextSteps: HUMAN_APPROVAL_NEXT_STEPS,
    runId,
    now,
  });
}

export function createStreamStateMachine({
  streamId = null,
  initialState = STREAMING_STATES.OPEN,
  now = () => new Date(),
} = {}) {
  return new FiniteWorkflowMachine({
    workflowName: "streaming",
    initialState,
    transitions: STREAMING_TRANSITIONS,
    nextSteps: STREAMING_NEXT_STEPS,
    runId: streamId,
    now,
  });
}
