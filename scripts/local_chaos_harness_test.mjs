import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { diagnoseAiSreIncident } from "./ai_sre_diagnose.mjs";
import { appendTraceStep, createTraceChain, finalizeTraceChain } from "../lib/trace_chain.mjs";
import { scoreCandidate } from "../lib/rehearsal_gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

console.log("=== W-0073 Local Chaos & Failure Mode Harness Test Suite ===");

const fixturePath = path.join(ROOT, "scripts", "fixtures", "local_chaos_fixtures.json");
assert.ok(fs.existsSync(fixturePath), "Chaos fixtures must exist");

const fixtureData = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const scenarios = fixtureData.failure_scenarios;
assert.ok(Array.isArray(scenarios) && scenarios.length >= 8, "Must contain at least 8 failure scenarios");

// Scenario 1: Provider Timeout
const timeoutScenario = scenarios.find((s) => s.id === "scenario_provider_timeout");
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

// Scenario 2: Malformed JSON Output
const malformedScenario = scenarios.find((s) => s.id === "scenario_malformed_json");
const traceMalformed = createTraceChain({ traceId: "trace_chaos_002", pathname: "/agent/execute" });
appendTraceStep(traceMalformed, "validation", { status: "malformed_json", reason_code: "invalid_syntax" });
const finalizedMalformed = finalizeTraceChain(traceMalformed, "failed");
assert.equal(finalizedMalformed.final_status, "failed");
assert.equal(finalizedMalformed.steps[0].status, "malformed_json");

// Scenario 3: Empty Reasoning Output
const emptyScenario = scenarios.find((s) => s.id === "scenario_empty_reasoning");
const traceEmpty = createTraceChain({ traceId: "trace_chaos_003", pathname: "/dispatch/incoming" });
appendTraceStep(traceEmpty, "provider", { status: "quarantined", reason_code: "empty_output" });
const finalizedEmpty = finalizeTraceChain(traceEmpty, "failed");
assert.equal(finalizedEmpty.steps[0].status, "quarantined");

// Scenario 4: Rate Limit 429 Spike
const rateLimitScenario = scenarios.find((s) => s.id === "scenario_rate_limit_429");
const rateLimitDiag = diagnoseAiSreIncident({
  rootDir: ROOT,
  request: { method: "POST", pathname: "/dispatch/incoming", statusCode: 429 },
});
assert.equal(rateLimitDiag.failure_class, "ingress");
assert.equal(rateLimitDiag.observed_surfaces.request.status_code, 429);

// Scenario 5: Local Backend Dropout
const dropoutScenario = scenarios.find((s) => s.id === "scenario_backend_dropout");
const dropoutDiag = diagnoseAiSreIncident({
  rootDir: ROOT,
  incidentType: "provider-outage",
  provider: { backend: "ollama", baseUrl: "http://127.0.0.1:11434/v1", error: "connect ECONNREFUSED 127.0.0.1:11434" },
});
assert.equal(dropoutDiag.failure_class, "provider");
assert.equal(dropoutDiag.observed_surfaces.provider_rca.likely_root_cause, "local_backend_unreachable");

// Scenario 6: Context-Window Exhaustion
const contextExhaustionScenario = scenarios.find((s) => s.id === "scenario_context_exhaustion");
const traceContext = createTraceChain({ traceId: "trace_chaos_006", pathname: "/agent/execute" });
appendTraceStep(traceContext, "validation", { status: "context_window_exhausted", reason_code: "token_limit_exceeded" });
const finalizedContext = finalizeTraceChain(traceContext, "rejected");
assert.equal(finalizedContext.final_status, "rejected");

// Scenario 7: Receipt Write Failure
const receiptWriteScenario = scenarios.find((s) => s.id === "scenario_receipt_write_failure");
const receiptDiag = diagnoseAiSreIncident({
  rootDir: ROOT,
  incidentType: "receipt-write-failure",
});
assert.equal(receiptDiag.failure_class, "persistence");

// Scenario 8: Dashboard / Route Misuse
const routeMisuseScenario = scenarios.find((s) => s.id === "scenario_route_misuse");
const authDiag = diagnoseAiSreIncident({
  rootDir: ROOT,
  request: { method: "GET", pathname: "/api/operator/receipts-telemetry", statusCode: 401 },
});
assert.equal(authDiag.failure_class, "auth");

// Verify Outcome Memory penalizes scenarios cleanly
const scoredCandidate = scoreCandidate(
  { id: "cand_chaos_test", name: "Chaos Candidate", targetComponents: ["model_router", "dispatch"], changes: ["unconstrained"] },
  [
    {
      id: "out_chaos_001",
      targetComponents: ["model_router"],
      outcome: "failure",
      severity: "high",
      rootCause: "unconstrained query sprawl",
    },
  ]
);
assert.ok(scoredCandidate.penalty > 0, "Chaos failure record must penalize candidate");

console.log("CHAOS_HARNESS_TESTS_OK");
