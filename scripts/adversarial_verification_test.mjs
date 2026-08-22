/**
 * Unit test suite for Adversarial Verification Harness
 * Validates deterministic interception of all 8 attack vectors.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AdversarialVerificationHarness, ADVERSARIAL_VERIFICATION_SCHEMA } from "../lib/adversarial_verification_harness.mjs";

console.log("[Adversarial Verification Suite] Initiating 8-Scenario Adversarial Drill...");

const harness = new AdversarialVerificationHarness();
const receipt = harness.runDrill();

assert.equal(receipt.schema, ADVERSARIAL_VERIFICATION_SCHEMA, "Receipt must conform to dizzy.adversarial_verification.v1");
assert.equal(receipt.scenarios_tested, 8, "Must test all 8 hostile scenarios");
assert.equal(receipt.bypasses_allowed, 0, "Zero bypasses allowed across hostile scenarios");
assert.equal(receipt.deterministic_blocks, 8, "All 8 scenarios must be deterministically blocked");
assert.equal(receipt.verdict, "ADVERSARIAL_VERIFICATION_PASSED", "Verdict must be passed");

// Verify individual scenario interception assertions
for (const entry of receipt.who_caught_what) {
  assert.equal(entry.deterministic_intercepted, true, `Scenario ${entry.scenario_id} was not intercepted`);
  assert.equal(entry.outcome, "VERIFIED_BLOCKED", `Scenario ${entry.scenario_id} outcome was not VERIFIED_BLOCKED`);
  assert.equal(entry.intercepting_gate, entry.expected_gate, `Scenario ${entry.scenario_id} gate mismatch`);
  assert.equal(entry.rejection_reason, entry.expected_rejection_reason, `Scenario ${entry.scenario_id} reason mismatch`);
  console.log(`  [PASS] ${entry.scenario_id} -> Blocked by ${entry.intercepting_gate} (${entry.rejection_reason})`);
}

// Persist latest adversarial verification receipt
const receiptPath = path.resolve(process.cwd(), "reviews/adversarial_verification_latest.json");
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
console.log(`[PASS] Adversarial Verification Suite cleanly passed 8/8 scenarios! Saved to: ${receiptPath}`);
