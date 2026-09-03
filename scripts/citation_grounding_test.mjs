import assert from "assert";
import fs from "fs";
import path from "path";
import { CitationGroundingVerifier } from "../lib/citation_grounding_verifier.mjs";

console.log("=== Deterministic Citation Grounding Verifier Test Suite ===");

const fixturesPath = path.resolve(process.cwd(), "scripts/fixtures/citation_grounding_fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));

const verifier = new CitationGroundingVerifier();

// 1. Verify Valid Citations Suite
const validFixture = fixtures.valid_claim_suite;
const validReceipt = verifier.verifyCitations(validFixture.claim_id, validFixture.citations, validFixture.context_packets);

console.log(`[PASS] Valid Claim: ${validReceipt.claim_id}`);
console.log(`[PASS] Accuracy Score: ${validReceipt.accuracy_score}, Verdict: ${validReceipt.grounding_verdict}`);
assert.strictEqual(validReceipt.grounding_verdict, validFixture.expected_verdict);
assert.strictEqual(validReceipt.exact_matches, 2, "Expected 2 exact matches");
assert.strictEqual(validReceipt.phantom_citations, 0, "Expected 0 phantoms");
assert.ok(validReceipt.receipt_sha256, "Must contain SHA-256 hash");

// 2. Verify Phantom Citations Suite
const phantomFixture = fixtures.phantom_claim_suite;
const phantomReceipt = verifier.verifyCitations(phantomFixture.claim_id, phantomFixture.citations, phantomFixture.context_packets);

console.log(`[PASS] Phantom Claim: ${phantomReceipt.claim_id}`);
console.log(`[PASS] Phantom Citations Caught: ${phantomReceipt.phantom_citations}, Verdict: ${phantomReceipt.grounding_verdict}`);
assert.strictEqual(phantomReceipt.grounding_verdict, phantomFixture.expected_verdict);
assert.strictEqual(phantomReceipt.phantom_citations, 1, "Must catch phantom citation");

// 3. Verify Line Drift Suite
const driftFixture = fixtures.line_drift_claim_suite;
const driftReceipt = verifier.verifyCitations(driftFixture.claim_id, driftFixture.citations, driftFixture.context_packets);

console.log(`[PASS] Line Drift Claim: ${driftReceipt.claim_id}`);
console.log(`[PASS] Line Drifts Caught: ${driftReceipt.line_drifts}, Verdict: ${driftReceipt.grounding_verdict}`);
assert.strictEqual(driftReceipt.line_drifts, 1, "Must catch line drift");
assert.strictEqual(driftReceipt.citations[0].actual_lines[0], 3, "Must identify actual line 3");

// Save latest receipt to reviews/ (gitignored)
const outPath = path.resolve(process.cwd(), "reviews/citation_grounding_latest.json");
fs.writeFileSync(outPath, JSON.stringify(validReceipt, null, 2), "utf8");
console.log(`[PASS] Saved citation grounding receipt to: ${outPath}`);

console.log("CITATION_GROUNDING_TESTS_OK");
