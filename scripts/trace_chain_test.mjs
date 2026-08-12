import assert from "node:assert/strict";
import {
  DIAGNOSTIC_STAGES,
  TRACE_CHAIN_AUTHORITY,
  TRACE_CHAIN_SCHEMA,
  appendTraceStep,
  computeChainHash,
  createTraceChain,
  finalizeTraceChain,
  sanitizeRouteTemplate,
} from "../lib/trace_chain.mjs";

console.log("=== W-0072 Request Trace Receipt Chain Test Suite ===");

// Test 1: Route template sanitization
assert.equal(sanitizeRouteTemplate("/dispatch/incoming?token=secret123#fragment"), "/dispatch/incoming");
assert.equal(sanitizeRouteTemplate("/agent/execute?query=user_data"), "/agent/execute");
assert.equal(sanitizeRouteTemplate("https://example.com/api/operator/receipts?token=secret123"), "/api/operator/receipts");
assert.equal(sanitizeRouteTemplate("api/operator/router-divisions?debug=true"), "/api/operator/router-divisions");

// Test 2: Full 9-stage Request Lifecycle Construction
const trace = createTraceChain({
  traceId: "trace_test_001",
  method: "POST",
  pathname: "/agent/execute?token=secret",
  trustZone: "private_self",
});

assert.equal(trace.schema, TRACE_CHAIN_SCHEMA);
assert.equal(trace.authority, TRACE_CHAIN_AUTHORITY);
assert.equal(trace.request.route_template, "/agent/execute");
assert.equal(trace.request.method, "POST");

// Append steps across diagnostic stages
appendTraceStep(trace, "ingress", { status: "accepted", latency_ms: 2 });
appendTraceStep(trace, "auth", { status: "authorized", latency_ms: 1 });
appendTraceStep(trace, "validation", { status: "valid", latency_ms: 3 });
appendTraceStep(trace, "routing", { status: "routed", model: "gemma3:4b", provider: "ollama", latency_ms: 5 });
appendTraceStep(trace, "provider", { status: "success", fallback_active: false, latency_ms: 120, receipt_id: "rcpt_001" });
appendTraceStep(trace, "persistence", { status: "persisted", receipt_id: "rcpt_002" });
appendTraceStep(trace, "retrieval", { status: "hit", latency_ms: 10 });
appendTraceStep(trace, "review-loop", { status: "passed", rehearsal_recommendation_id: "plan_alpha" });
appendTraceStep(trace, "operator-gate", { status: "approved" });

assert.equal(trace.steps.length, 9);
assert.deepEqual(trace.linked_receipt_ids, ["rcpt_001", "rcpt_002"]);

// Test 3: Finalize and Integrity Hash
const finalized = finalizeTraceChain(trace, "completed", { now: new Date(Date.now() + 150) });
assert.equal(finalized.final_status, "completed");
assert.ok(finalized.chain_hash, "Chain hash must be present");
assert.equal(typeof finalized.chain_hash, "string");
assert.equal(finalized.chain_hash.length, 64); // SHA-256 hex string length

// Test 4: Invalid stage rejection
assert.throws(() => {
  appendTraceStep(trace, "invalid_stage_name", { status: "ok" });
}, /Invalid diagnostic stage/);

// Test 5: Authority Boundary Assertions
assert.equal(finalized.authority, "trace_evidence_not_authority");
assert.notEqual(finalized.authority, "operational_trace_chain_v1");

// Test 6: Zero Private Body Text Leaks
const jsonStr = JSON.stringify(finalized);
assert.doesNotMatch(jsonStr, /secret|token=secret123|prompt_body|user_private/);

console.log("TRACE_CHAIN_TESTS_OK");
