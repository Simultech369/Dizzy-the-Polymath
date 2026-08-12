import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  REHEARSAL_AUTHORITY,
  REHEARSAL_SCHEMA,
  evaluateRehearsalGate,
  matchOutcomeMemory,
  scoreCandidate,
} from "../lib/rehearsal_gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

console.log("=== W-0075 Rehearsal Gate & Outcome Memory Test Suite ===");

// Load fixtures
const fixturePath = path.join(ROOT, "scripts", "fixtures", "rehearsal_outcome_fixtures.json");
assert.ok(fs.existsSync(fixturePath), "Fixture file must exist");

const fixtureData = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const outcomes = fixtureData.outcomes;
const candidates = fixtureData.sample_candidates;

// Test 1: Match Outcome Memory
const matchSuccess = matchOutcomeMemory(candidates[0], outcomes[1]);
assert.equal(matchSuccess.isMatch, true);
assert.equal(matchSuccess.outcomeType, "success");

const matchFailure = matchOutcomeMemory(candidates[1], outcomes[0]);
assert.equal(matchFailure.isMatch, true);
assert.equal(matchFailure.outcomeType, "failure");

// Test 2: Scoring logic (penalties vs boosts)
const scoredAlpha = scoreCandidate(candidates[0], outcomes); // plan_alpha (should be boosted)
const scoredBeta = scoreCandidate(candidates[1], outcomes);  // plan_beta (should be penalized)

assert.ok(scoredAlpha.score > scoredAlpha.base_score, "Alpha score should be boosted by past success memory");
assert.ok(scoredBeta.score < scoredBeta.base_score, "Beta score should be penalized by past failure memory");
assert.ok(scoredAlpha.score > scoredBeta.score, "Alpha score must exceed Beta score");

// Test 3: Full Gate Evaluation & Deterministic Ranking
const receipt = evaluateRehearsalGate({
  candidates,
  outcomeMemory: outcomes,
  deterministicSignals: {
    eval_gate: "passed",
    retrieval_floor_passed: true,
    council_audit: "passed",
  },
});

assert.equal(receipt.schema, REHEARSAL_SCHEMA);
assert.equal(receipt.authority, REHEARSAL_AUTHORITY);
assert.equal(receipt.recommended_candidate_id, "plan_alpha");
assert.equal(receipt.operator_required, true);

// Verify ranking order
assert.equal(receipt.candidate_scores[0].candidate_id, "plan_alpha");
assert.equal(receipt.candidate_scores[0].rank, 1);

// Test 4: Sparse/Missing Outcome Memory Fallback
const fallbackReceipt = evaluateRehearsalGate({
  candidates,
  outcomeMemory: [],
});

assert.equal(fallbackReceipt.schema, REHEARSAL_SCHEMA);
assert.equal(fallbackReceipt.confidence_band, "baseline_only");
assert.ok(fallbackReceipt.recommended_candidate_id, "Recommendation must succeed even without prior memory");
assert.equal(fallbackReceipt.operator_required, true);

// Test 5: Strict Boundary Assertions (Never emits execution authority)
assert.equal(receipt.authority, "automation_recommends_simul_approves");
assert.notEqual(receipt.authority, "autonomous_execution");
assert.equal(receipt.operator_required, true);

// Test 6: Zero Private Body Text Leaks
const jsonStr = JSON.stringify(receipt);
assert.doesNotMatch(jsonStr, /prompt_body|private_key|secret_token/);

console.log("REHEARSAL_GATE_TESTS_OK");
