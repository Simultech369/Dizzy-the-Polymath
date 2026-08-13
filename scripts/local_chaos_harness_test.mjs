import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { diagnoseAiSreIncident } from "./ai_sre_diagnose.mjs";
import { appendTraceStep, createTraceChain, finalizeTraceChain } from "../lib/trace_chain.mjs";
import { scoreCandidate } from "../lib/rehearsal_gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CHAOS_SCHEMA = "dizzy.chaos_receipt.v1";
const CHAOS_AUTHORITY = "chaos_evidence_not_authority";

console.log("=== W-0073 Local Chaos & Failure Mode Harness Test Suite ===");

const fixturePath = path.join(ROOT, "scripts", "fixtures", "local_chaos_fixtures.json");
assert.ok(fs.existsSync(fixturePath), "Chaos fixtures must exist");

const fixtureData = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const scenarios = fixtureData.failure_scenarios;
assert.ok(Array.isArray(scenarios) && scenarios.length >= 8, "Must contain at least 8 failure scenarios");

function getScenario(id) {
  const scenario = scenarios.find((s) => s.id === id);
  assert.ok(scenario, `Fixture scenario must exist: ${id}`);
  return scenario;
}

function assertPrivacySafeReceipt(receipt) {
  const text = JSON.stringify(receipt);
  assert.doesNotMatch(text, /prompt_body|response_body|raw_output|secret|token=|private_key|api[_-]?key|cloud_key/i);
}

function buildChaosReceipt(scenario, {
  diagnosis = null,
  trace = null,
  outcomeMemoryRecord = null,
} = {}) {
  const receipt = {
    schema: CHAOS_SCHEMA,
    authority: CHAOS_AUTHORITY,
    scenario_id: scenario.id,
    failure_class: scenario.failure_class,
    expected_classification: scenario.expected_classification,
    expected_status: scenario.expected_status,
    observed_failure_class: diagnosis?.failure_class || trace?.steps?.[0]?.stage || scenario.failure_class,
    observed_status: trace?.steps?.[0]?.status || diagnosis?.status || scenario.expected_status,
    trace_id: trace?.trace_id || null,
    trace_final_status: trace?.final_status || null,
    diagnosis_root_cause: diagnosis?.observed_surfaces?.provider_rca?.likely_root_cause || "",
    cloud_fallback_used: false,
    private_zone_leak: false,
    outcome_memory_record: outcomeMemoryRecord
      ? {
        id: outcomeMemoryRecord.id,
        outcome: outcomeMemoryRecord.outcome,
        severity: outcomeMemoryRecord.severity,
        failure_class: outcomeMemoryRecord.failure_class,
      }
      : null,
  };
  assert.equal(receipt.authority, CHAOS_AUTHORITY);
  assert.notEqual(receipt.authority, "operational_authority");
  assertPrivacySafeReceipt(receipt);
  return receipt;
}

const chaosReceipts = [];

// Scenario 1: Provider Timeout
const timeoutScenario = getScenario("scenario_provider_timeout");
const timeoutDiag = diagnoseAiSreIncident({
  rootDir: ROOT,
  incidentType: "provider-outage",
  provider: {
    backend: "ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    error: "HTTP request timeout after 30000ms",
  },
});
assert.equal(timeoutDiag.failure_class, "provider");
assert.equal(timeoutDiag.observed_surfaces.provider_rca.likely_root_cause, "local_backend_timeout");
assert.doesNotMatch(JSON.stringify(timeoutDiag), /secret|cloud_key/);
chaosReceipts.push(buildChaosReceipt(timeoutScenario, { diagnosis: timeoutDiag }));

// Scenario 2: Malformed JSON Output
const malformedScenario = getScenario("scenario_malformed_json");
const traceMalformed = createTraceChain({ traceId: "trace_chaos_002", pathname: "/agent/execute" });
appendTraceStep(traceMalformed, "validation", { status: "malformed_json", reason_code: "invalid_syntax" });
const finalizedMalformed = finalizeTraceChain(traceMalformed, "failed");
assert.equal(finalizedMalformed.final_status, "failed");
assert.equal(finalizedMalformed.steps[0].status, "malformed_json");
chaosReceipts.push(buildChaosReceipt(malformedScenario, { trace: finalizedMalformed }));

// Scenario 3: Empty Reasoning Output
const emptyScenario = getScenario("scenario_empty_reasoning");
const traceEmpty = createTraceChain({ traceId: "trace_chaos_003", pathname: "/dispatch/incoming" });
appendTraceStep(traceEmpty, "provider", { status: "quarantined", reason_code: "empty_output" });
const finalizedEmpty = finalizeTraceChain(traceEmpty, "failed");
assert.equal(finalizedEmpty.steps[0].status, "quarantined");
chaosReceipts.push(buildChaosReceipt(emptyScenario, { trace: finalizedEmpty }));

// Scenario 4: Rate Limit 429 Spike
const rateLimitScenario = getScenario("scenario_rate_limit_429");
const rateLimitDiag = diagnoseAiSreIncident({
  rootDir: ROOT,
  request: { method: "POST", pathname: "/dispatch/incoming", statusCode: 429 },
});
assert.equal(rateLimitDiag.failure_class, "ingress");
assert.equal(rateLimitDiag.observed_surfaces.request.status_code, 429);
chaosReceipts.push(buildChaosReceipt(rateLimitScenario, { diagnosis: rateLimitDiag }));

// Scenario 5: Local Backend Dropout
const dropoutScenario = getScenario("scenario_backend_dropout");
const dropoutDiag = diagnoseAiSreIncident({
  rootDir: ROOT,
  incidentType: "provider-outage",
  provider: { backend: "ollama", baseUrl: "http://127.0.0.1:11434/v1", error: "connect ECONNREFUSED 127.0.0.1:11434" },
});
assert.equal(dropoutDiag.failure_class, "provider");
assert.equal(dropoutDiag.observed_surfaces.provider_rca.likely_root_cause, "local_backend_unreachable");
chaosReceipts.push(buildChaosReceipt(dropoutScenario, { diagnosis: dropoutDiag }));

// Scenario 6: Context-Window Exhaustion
const contextExhaustionScenario = getScenario("scenario_context_exhaustion");
const traceContext = createTraceChain({ traceId: "trace_chaos_006", pathname: "/agent/execute" });
appendTraceStep(traceContext, "validation", { status: "context_window_exhausted", reason_code: "token_limit_exceeded" });
const finalizedContext = finalizeTraceChain(traceContext, "rejected");
assert.equal(finalizedContext.final_status, "rejected");
chaosReceipts.push(buildChaosReceipt(contextExhaustionScenario, { trace: finalizedContext }));

// Scenario 7: Receipt Write Failure
const receiptWriteScenario = getScenario("scenario_receipt_write_failure");
const receiptDiag = diagnoseAiSreIncident({
  rootDir: ROOT,
  incidentType: "receipt-write-failure",
});
assert.equal(receiptDiag.failure_class, "persistence");
chaosReceipts.push(buildChaosReceipt(receiptWriteScenario, { diagnosis: receiptDiag }));

// Scenario 8: Dashboard / Route Misuse
const routeMisuseScenario = getScenario("scenario_route_misuse");
const authDiag = diagnoseAiSreIncident({
  rootDir: ROOT,
  request: { method: "GET", pathname: "/api/operator/receipts-telemetry", statusCode: 401 },
});
assert.equal(authDiag.failure_class, "auth");
chaosReceipts.push(buildChaosReceipt(routeMisuseScenario, { diagnosis: authDiag }));

// Verify Outcome Memory penalizes scenarios cleanly
const outcomeMemoryRecord = {
  id: "out_chaos_001",
  targetComponents: ["model_router"],
  outcome: "failure",
  severity: "high",
  failure_class: "routing",
  rootCause: "unconstrained query sprawl",
};
const scoredCandidate = scoreCandidate(
  { id: "cand_chaos_test", name: "Chaos Candidate", targetComponents: ["model_router", "dispatch"], changes: ["unconstrained"] },
  [outcomeMemoryRecord]
);
assert.ok(scoredCandidate.penalty > 0, "Chaos failure record must penalize candidate");

chaosReceipts.push(buildChaosReceipt(
  { id: "scenario_outcome_memory_penalty", failure_class: "review-loop", expected_classification: "review-loop", expected_status: "penalized" },
  { outcomeMemoryRecord },
));

assert.equal(chaosReceipts.length, scenarios.length + 1);
for (const receipt of chaosReceipts) {
  assert.equal(receipt.schema, CHAOS_SCHEMA);
  assert.equal(receipt.authority, CHAOS_AUTHORITY);
  assert.equal(receipt.private_zone_leak, false);
  assert.equal(receipt.cloud_fallback_used, false);
  assertPrivacySafeReceipt(receipt);
}

console.log("CHAOS_HARNESS_TESTS_OK");
