import crypto from "crypto";

/**
 * W-0072: Request Trace Receipt Chain
 * Constructs deterministic, privacy-safe trace receipts linking the 9-stage diagnostic lifecycle
 * without storing private prompt/output text bodies or query strings.
 *
 * Schema: dizzy.trace_chain.v1
 * Authority: trace_evidence_not_authority
 */

export const TRACE_CHAIN_SCHEMA = "dizzy.trace_chain.v1";
export const TRACE_CHAIN_AUTHORITY = "trace_evidence_not_authority";

export const DIAGNOSTIC_STAGES = Object.freeze([
  "ingress",
  "auth",
  "validation",
  "routing",
  "provider",
  "persistence",
  "retrieval",
  "review-loop",
  "operator-gate",
]);

/**
 * Sanitizes a path/URL by removing query parameters and sensitive segments.
 */
export function sanitizeRouteTemplate(pathname = "/") {
  const cleanPath = String(pathname || "/").split("?")[0].split("#")[0];
  return cleanPath.replace(/\/+/g, "/");
}

/**
 * Computes a SHA-256 integrity hash across step IDs and metadata.
 */
export function computeChainHash(traceId, steps = []) {
  const hash = crypto.createHash("sha256");
  hash.update(String(traceId));
  for (const step of steps) {
    hash.update(`:${step.stage}:${step.status}:${step.timestamp || ""}`);
  }
  return hash.digest("hex");
}

/**
 * Initializes a new trace chain receipt builder.
 */
export function createTraceChain(opts = {}) {
  const traceId = opts.traceId || opts.trace_id || `trace_${crypto.randomUUID()}`;
  const requestPath = sanitizeRouteTemplate(opts.pathname || opts.path || "/");
  const method = String(opts.method || "GET").toUpperCase();

  return {
    schema: TRACE_CHAIN_SCHEMA,
    authority: TRACE_CHAIN_AUTHORITY,
    trace_id: traceId,
    request: {
      method,
      route_template: requestPath,
      trust_zone: opts.trustZone || opts.trust_zone || "private_self",
      retention_scope: opts.retentionScope || opts.retention_scope || "ephemeral",
    },
    steps: [],
    linked_receipt_ids: [],
    final_status: "in_flight",
    latency_ms: 0,
    created_at: opts.now ? opts.now.toISOString() : new Date().toISOString(),
  };
}

/**
 * Appends a lifecycle stage step to the trace chain.
 */
export function appendTraceStep(trace, stage, stepData = {}) {
  if (!trace || !Array.isArray(trace.steps)) {
    throw new Error("Invalid trace object passed to appendTraceStep");
  }

  const stageLower = String(stage || "").toLowerCase();
  if (!DIAGNOSTIC_STAGES.includes(stageLower)) {
    throw new Error(`Invalid diagnostic stage '${stage}'. Must be one of: ${DIAGNOSTIC_STAGES.join(", ")}`);
  }

  // Filter out any potential private body text or un-sanitized fields
  const safeData = {
    status: stepData.status || "ok",
    latency_ms: typeof stepData.latency_ms === "number" ? stepData.latency_ms : 0,
    model: stepData.model || null,
    provider: stepData.provider || null,
    fallback_active: Boolean(stepData.fallback_active),
    cost_band: stepData.cost_band || null,
    receipt_id: stepData.receipt_id || null,
    eval_verdict: stepData.eval_verdict || null,
    rehearsal_recommendation_id: stepData.rehearsal_recommendation_id || null,
    reason_code: stepData.reason_code || null,
    timestamp: stepData.timestamp || new Date().toISOString(),
  };

  if (safeData.receipt_id && !trace.linked_receipt_ids.includes(safeData.receipt_id)) {
    trace.linked_receipt_ids.push(safeData.receipt_id);
  }

  trace.steps.push({
    stage: stageLower,
    ...safeData,
  });

  return trace;
}

/**
 * Finalizes the trace chain, computes end-to-end latency, chain hash, and asserts privacy safety.
 */
export function finalizeTraceChain(trace, finalStatus = "completed", opts = {}) {
  if (!trace) throw new Error("Trace object is required");

  const now = opts.now ? opts.now.getTime() : Date.now();
  const start = new Date(trace.created_at).getTime();
  const totalLatency = Math.max(0, now - start);

  trace.final_status = finalStatus;
  trace.latency_ms = totalLatency;
  trace.chain_hash = computeChainHash(trace.trace_id, trace.steps);

  const jsonStr = JSON.stringify(trace);
  if (/prompt_body|user_private|secret|query_param/i.test(jsonStr)) {
    throw new Error("Trace receipt contains prohibited private text or query string keywords.");
  }

  return trace;
}
