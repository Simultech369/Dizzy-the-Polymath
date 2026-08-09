import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  synthesizeReviewEvidence,
  writeReviewSynthesis,
} from "../lib/review_synthesis.mjs";

console.log("=== W-0068 Review Synthesis Test Suite ===");

const synthesis = synthesizeReviewEvidence({
  candidateId: "synthesis-fixture",
  changedFiles: ["lib/review_synthesis.mjs", "scripts/review_synthesis_test.mjs"],
  modelBatches: [{
    schema_version: "dizzy.model_review_batch.v1",
    candidate_id: "synthesis-fixture",
    reviews: [
      {
        source: "qwen_local",
        role_key: "qwen_local",
        status: "submitted",
        findings: [{
          severity: "medium",
          category: "fixture",
          disposition: "new",
          claim: "Add a regression fixture for review synthesis duplicate clustering.",
          evidence: ["scripts/review_synthesis_test.mjs"],
        }],
      },
      {
        source: "gemma3_local",
        role_key: "gemma3_local",
        status: "submitted",
        findings: [
          {
            severity: "medium",
            category: "fixture",
            disposition: "new",
            claim: "Add regression fixture for review synthesis duplicate clustering.",
            evidence: ["lib/review_synthesis.mjs"],
          },
          {
            kind: "disagreement",
            severity: "low",
            category: "disagreement",
            disposition: "rejected",
            claim: "Whether skipped reviewers should count as coverage.",
            evidence: ["review coverage semantics"],
          },
        ],
      },
      {
        source: "dead_local",
        role_key: "gemma3_local",
        status: "skipped",
        skipped_reason: "local_review_backend_unavailable",
        diagnosis: {
          likely_root_cause: "local_backend_unreachable",
          authority: "diagnostic_evidence_not_authority",
        },
        findings: [{
          severity: "high",
          category: "fixture",
          disposition: "new",
          claim: "Skipped review findings must not be trusted.",
        }],
      },
    ],
  }],
  cycleReceipts: [{
    schema_version: "dizzy.review_cycle_run.v1",
    candidate_id: "synthesis-fixture",
    changed_files: ["lib/review_synthesis.mjs"],
    harnesses: [
      { script: "test:review-synthesis", status: "passed", exit_code: 0 },
      { script: "test:router", status: "failed", exit_code: 1, stderr_tail: "token=secret_should_not_survive" },
    ],
  }],
  now: new Date("2026-08-09T00:00:00.000Z"),
});

assert.equal(synthesis.schema_version, "dizzy.review_synthesis.v1");
assert.equal(synthesis.authority, "synthesis_is_triage_not_authority");
assert.equal(synthesis.counts.reviews, 3);
assert.equal(synthesis.counts.usable_reviews, 2);
assert.equal(synthesis.counts.skipped_or_failed_reviews, 1);
assert.equal(synthesis.counts.failed_harnesses, 1);
assert.equal(synthesis.counts.availability_rechecks, 1);
assert.equal(synthesis.agreement_clusters[0].source_count, 2);
assert.equal(synthesis.disagreement_clusters.length, 1);
assert.equal(synthesis.availability_rechecks[0].likely_root_cause, "local_backend_unreachable");
assert.equal(synthesis.proposed_state_transition, "fixture-required");
assert.equal(synthesis.suggested_tests.includes("test:router"), true);
assert.doesNotMatch(JSON.stringify(synthesis), /secret_should_not_survive/);
assert.doesNotMatch(JSON.stringify(synthesis.clusters), /Skipped review findings must not be trusted/);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-review-synthesis-"));
try {
  const outPath = writeReviewSynthesis(synthesis, { rootDir: tempRoot, outPath: "reviews/synthesis.json" });
  assert.equal(JSON.parse(fs.readFileSync(outPath, "utf8")).synthesis_id, synthesis.synthesis_id);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("REVIEW_SYNTHESIS_TESTS_OK");
