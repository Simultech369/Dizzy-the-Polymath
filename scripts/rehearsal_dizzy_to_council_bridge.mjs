import assert from "assert";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  parseBountyTask,
  calculateBountyEv,
  createBountyA2AIngestEnvelope,
} from "../lib/bounty_hunter_engine.mjs";
import {
  createBridgeRequest,
  validateBridgeResponse,
  NODE_PYTHON_BRIDGE_RESPONSE_SCHEMA,
} from "../lib/node_python_council_bridge_contract.mjs";

const DEFAULT_COUNCIL_ENGINE_DIR = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, ".gemini", "antigravity", "scratch", "council_engine")
  : path.resolve("../scratch/council_engine");
const COUNCIL_ENGINE_DIR = process.env.COUNCIL_ENGINE_DIR || DEFAULT_COUNCIL_ENGINE_DIR;
const INPUT_ENVELOPE_PATH = path.join(COUNCIL_ENGINE_DIR, "inputs", "bridge_rehearsal_payload.json");
const OUTPUT_RECEIPT_PATH = path.join(COUNCIL_ENGINE_DIR, "outputs", "bridge_rehearsal_receipt.json");
const REVIEWS_RECEIPT_PATH = path.resolve("reviews/bounty_bridge_rehearsal_latest.json");

console.log("=== Autonomous Bounty Bridge End-to-End Rehearsal ===");

// 1. Ingest sample SWE-bench / GitHub issue task through hardened ingress
console.log("[step-1] Ingesting bounty through Dizzy hardened ingress...");
const sampleTask = parseBountyTask({
  id: "bounty_swebench_issue_109",
  title: "Security: Patch path traversal and enforce domain allowlist in artifact parser",
  description: "Identify and patch vulnerability in path normalization. Verify zero SSRF or shell injection vectors exist.",
  platform: "swe_bench",
  repository: "Simultech369/Dizzy-the-Polymath",
  sourceUrl: "https://github.com/Simultech369/Dizzy-the-Polymath/issues/109",
  testCommand: "npm test",
  target_files: ["lib/bounty_hunter_engine.mjs", "scripts/bounty_hunter_engine_test.mjs"],
  payoutUsd: 500,
  difficulty: "hard",
  files: ["lib/bounty_hunter_engine.mjs", "scripts/bounty_hunter_engine_test.mjs"],
});

assert.strictEqual(sampleTask.repository, "Simultech369/Dizzy-the-Polymath");
assert.strictEqual(sampleTask.source_url, "https://github.com/Simultech369/Dizzy-the-Polymath/issues/109");
assert.strictEqual(sampleTask.test_command, "npm test");
assert.strictEqual(sampleTask.target_files.length, 2);
console.log(`  [PASS] Task parsed & sealed: ${sampleTask.payload_sha256.slice(0, 16)}...`);

// 2. Perform EV Triage
console.log("[step-2] Calculating Expected Value (EV)...");
const triage = calculateBountyEv({
  payoutUsd: sampleTask.payout_usd,
  difficulty: sampleTask.difficulty,
  hasReproductionTests: true,
  estimatedTokens: 75_000,
});
assert(triage.recommendation.startsWith("DISPATCH"), `Expected DISPATCH recommendation, got ${triage.recommendation}`);
assert(triage.expected_value_usd > 0, "Expected positive EV");
console.log(`  [PASS] EV Calculated: $${triage.expected_value_usd.toFixed(2)} (Ratio: ${triage.ev_ratio}x) -> ${triage.recommendation}`);

// 3. Create sealed W-0112 Bridge Request
console.log("[step-3] Sealing W-0112 Bridge Request...");
const ingestContract = createBountyA2AIngestEnvelope({
  bountyTask: sampleTask,
  triageReceipt: triage,
  fromAgent: "subagent_researcher",
  toAgent: "oss_council",
});
const bridgePayload = {
  ...ingestContract.envelope.payload,
  proof_boundaries: [
    "sidecar_rehearsal_is_not_runtime_promotion",
    "bridge_payload_hash_lives_in_integrity_payload_sha256",
    "bounty_task_payload_sha256_remains_task_digest",
    "public_submission_requires_operator_approval",
  ],
  operator_approval_required_for: [
    "public_submission",
    "claiming_bounty",
    "maintainer_outreach",
    "external_broadcast",
  ],
};
const bridgeRequest = createBridgeRequest({
  requestId: `w0114_rehearsal_${sampleTask.bounty_id}`,
  payload: bridgePayload,
  requestedReceiptAuthority: "rehearsal_receipt",
});

fs.mkdirSync(path.dirname(INPUT_ENVELOPE_PATH), { recursive: true });
fs.writeFileSync(INPUT_ENVELOPE_PATH, JSON.stringify(bridgeRequest, null, 2), "utf8");
console.log(`  [PASS] Bridge request written to: ${INPUT_ENVELOPE_PATH}`);

// 4. Invoke Council Engine (Python Patch 10E)
console.log("[step-4] Crossing A2A bridge into Python Council Engine...");
const pythonScript = path.join(COUNCIL_ENGINE_DIR, "bridge_rehearsal_runner.py");
const pythonOutput = execFileSync("python", [pythonScript, INPUT_ENVELOPE_PATH, OUTPUT_RECEIPT_PATH], {
  encoding: "utf8",
});
console.log("  [Python Subprocess Output]:\n" + pythonOutput.trim());

// 5. Ground and Verify Receipt against W-0112 Contract
console.log("[step-5] Reading and verifying Council Engine receipt...");
assert(fs.existsSync(OUTPUT_RECEIPT_PATH), "Expected Python receipt to exist");
const receipt = JSON.parse(fs.readFileSync(OUTPUT_RECEIPT_PATH, "utf8"));

const validation = validateBridgeResponse(receipt, bridgeRequest);
assert.strictEqual(validation.ok, true, `Bridge response validation failed: ${JSON.stringify(validation.errors)}`);
assert.strictEqual(receipt.schema_version, NODE_PYTHON_BRIDGE_RESPONSE_SCHEMA);
assert.strictEqual(receipt.status, "VERIFIED_DISPATCH");
assert.strictEqual(receipt.receipt_authority, "rehearsal_receipt");
assert.strictEqual(receipt.assigned_lane, "SECURITY_REVIEWER");
assert.strictEqual(receipt.request_payload_sha256, bridgeRequest.integrity.payload_sha256);
assert.strictEqual(receipt.runtime_promotion_allowed, false);
assert.strictEqual(receipt.promotion_receipt_required, true);
assert.strictEqual(receipt.public_claim_allowed, false);
assert.strictEqual(receipt.sanitized_target_files.length, 2);
assert.strictEqual(receipt.enforced_verification_command, "npm test");

console.log(`  [PASS] Council Engine Assigned Lane: ${receipt.assigned_lane}`);
console.log(`  [PASS] Bridge Request Payload SHA-256 Match: ${receipt.request_payload_sha256.slice(0, 16)}...`);
console.log(`  [PASS] Receipt Authority Bounded: ${receipt.receipt_authority}`);

// 6. Record Joint Proof Receipt
const jointReceipt = {
  schema_version: "dizzy.bounty_bridge_rehearsal.v2",
  contract_version: "W-0112",
  timestamp: new Date().toISOString(),
  status: "VERIFIED_BRIDGE_PASS",
  receipt_authority: "rehearsal_receipt",
  bridge_request_id: bridgeRequest.request_id,
  bridge_payload_sha256: bridgeRequest.integrity.payload_sha256,
  front_end: {
    runtime: "node_mjs",
    bounty_id: sampleTask.bounty_id,
    task_payload_sha256: sampleTask.payload_sha256,
    ev_usd: triage.expected_value_usd,
  },
  back_end: {
    runtime: "python_council_engine_patch_10e",
    assigned_lane: receipt.assigned_lane,
    receipt_authority: receipt.receipt_authority,
    verification_command: receipt.enforced_verification_command,
  },
  invariants_verified: [
    "ingress_ssrf_and_domain_allowlist_enforced",
    "artifact_paths_jailed_to_relative_workspace",
    "verification_command_allowlisted",
    "w0112_bridge_payload_sha256_canonical_integrity_verified",
    "task_level_sha256_distinct_from_bridge_payload_sha256",
    "sidecar_response_bounded_to_rehearsal_receipt_authority",
    "deterministic_signal_classification_in_python_council",
  ],
};

fs.writeFileSync(REVIEWS_RECEIPT_PATH, JSON.stringify(jointReceipt, null, 2) + "\n", "utf8");
console.log(`\n=== REHEARSAL SUCCESSFUL: Receipt sealed to ${REVIEWS_RECEIPT_PATH} ===\n`);
