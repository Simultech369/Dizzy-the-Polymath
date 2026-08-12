import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  AI_SRE_AUTHORITY,
  AI_SRE_DIAGNOSIS_SCHEMA,
  FAILURE_CLASSES,
  buildRequestAutopsy,
  diagnoseAiSreIncident,
} from "./ai_sre_diagnose.mjs";

console.log("=== W-0071 AI SRE Diagnose Test Suite ===");

function writeJson(root, relPath, value) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(root, relPath, value) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, value, "utf8");
}

const request = buildRequestAutopsy({ method: "post", pathname: "/agent/execute", statusCode: 429 });
assert.equal(request.failure_class, "ingress");
assert.equal(request.method, "POST");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-ai-sre-"));
try {
  writeJson(tempRoot, "reviews/retrieval_eval_latest.json", {
    schema: "dizzy.retrieval_eval_receipt.v1",
    metrics: {
      hit_rate_top_3_pct: 80,
      mrr: 0.55,
    },
  });
  const retrievalDrift = diagnoseAiSreIncident({
    rootDir: tempRoot,
    incidentType: "retrieval-drift",
    now: new Date("2026-08-12T00:00:00.000Z"),
  });
  assert.equal(retrievalDrift.schema_version, AI_SRE_DIAGNOSIS_SCHEMA);
  assert.equal(retrievalDrift.authority, AI_SRE_AUTHORITY);
  assert.equal(retrievalDrift.failure_class, "retrieval");
  assert.equal(retrievalDrift.observed_surfaces.retrieval_eval.status, "failed");
  assert.match(retrievalDrift.runbook, /#retrieval$/);

  writeText(tempRoot, "runtime/router_receipts.jsonl", "{not-json}\n");
  const receiptFailure = diagnoseAiSreIncident({
    rootDir: tempRoot,
    incidentType: "receipt-write-failure",
  });
  assert.equal(receiptFailure.failure_class, "persistence");
  assert.equal(receiptFailure.observed_surfaces.router_receipts.status, "malformed");
  assert.equal(receiptFailure.observed_surfaces.router_receipts.malformed_count, 1);

  writeJson(tempRoot, "reviews/review_cycle_latest.json", {
    schema_version: "dizzy.review_cycle_run.v1",
    reconciliation: {
      state_transition: "fixture-required",
    },
    harnesses: [{ script: "test:router" }],
    reviews: [],
  });
  const reviewLoop = diagnoseAiSreIncident({
    rootDir: tempRoot,
    incidentType: "review-loop-deadlock",
  });
  assert.equal(reviewLoop.failure_class, "review-loop");
  assert.equal(reviewLoop.observed_surfaces.review_cycle.status, "blocked");

  const provider = diagnoseAiSreIncident({
    rootDir: tempRoot,
    incidentType: "provider-outage",
    provider: {
      backend: "ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "gemma3:4b",
      error: "fetch failed token=secret_should_not_survive",
    },
  });
  assert.equal(provider.failure_class, "provider");
  assert.equal(provider.observed_surfaces.provider_rca.likely_root_cause, "local_backend_unreachable");
  assert.doesNotMatch(JSON.stringify(provider), /secret_should_not_survive/);

  const ingress = diagnoseAiSreIncident({
    rootDir: tempRoot,
    request: {
      method: "POST",
      pathname: "/dispatch/incoming",
      statusCode: 429,
    },
  });
  assert.equal(ingress.failure_class, "ingress");
  assert.equal(ingress.observed_surfaces.request.lifecycle_stage, "ingress");

  const hallucination = diagnoseAiSreIncident({
    rootDir: tempRoot,
    incidentType: "hallucination-spike",
  });
  assert.equal(hallucination.failure_class, "operator-gate");
  assert.match(hallucination.next_actions.join(" "), /Compare the claim against receipts/);
  assert.deepEqual(hallucination.taxonomy, FAILURE_CLASSES);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("AI_SRE_DIAGNOSE_TESTS_OK");
