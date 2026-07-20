/**
 * scripts/test_active_integration.mjs
 * -----------------------------------
 * Test suite to verify all the active integration changes:
 * - Scenario simulator logic, cosine similarity, path isolation (Risk C)
 * - Memory bridge scanning, staging, validation guards, promotion (Risk B)
 * - Friction anomaly detection with MAD z-score metrics and config/options plumbing
 * - Active Policy Engine real append path, candidate exclusion, write block suspension, bridge veto, resolution reasons
 * - Options map MDS coordinates caching
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";

import { runIsolatedSimulation, runSimulation, cosineSimilarity, calculateDivergence } from "../lib/scenario_simulator.mjs";
import { scanBridgingMemories, stageBridges, validateBridgePayload, getBridgeId } from "../lib/bridging_scan.mjs";
import { detectFrictionAnomaly, getEntryWeight } from "../lib/friction_anomaly_detector.mjs";
import { projectCoordinates } from "../lib/options_projection.mjs";
import { ActivePolicyEngine } from "../lib/active_policy_engine.mjs";
import { assertDurableWriteAllowed } from "../lib/durable_write_policy.mjs";
import { appendFrictionSync } from "../lib/friction_ledger.mjs";

console.log("Starting active integration tests...");

// Ensure runtime directory exists
fs.mkdirSync(path.join(process.cwd(), "runtime"), { recursive: true });
// Define root disposable temp dir inside runtime directory to avoid relative path '..' traversal issues in bridges
const DISPOSABLE_ROOT = fs.mkdtempSync(path.join(process.cwd(), "runtime", ".test-run-"));
console.log(`Using isolated disposable root: ${DISPOSABLE_ROOT}`);

// -------------------------------------------------------------
// Test 1: Scenario Simulator & Cosine Similarity
// -------------------------------------------------------------
console.log("Running Test 1: Scenario Simulator...");
const initialState = {
  reserves: 1000,
  participants: 50,
  allocated_amount: 0,
  exited_count: 0
};
const baselineParams = {
  decay_rate: 0.02,
  basic_needs_allocation: 2.0,
  reserves_exit_threshold: 200,
  base_exit_rate: 0.1
};
const forkedParams = {
  decay_rate: 0.05,
  basic_needs_allocation: 4.5,
  reserves_exit_threshold: 200,
  base_exit_rate: 0.1
};

const baselineHistory = runSimulation(initialState, baselineParams, 10);
const forkedHistory = runSimulation(initialState, forkedParams, 10);
const divergence = calculateDivergence(baselineHistory, forkedHistory);

assert.strictEqual(divergence.total_steps, 11, "Expected 11 steps including initial state");
assert(divergence.cumulative_divergence > 0, "Divergence must be positive");
assert(divergence.average_divergence > 0, "Average divergence must be positive");
assert(divergence.history[0].step_similarity === 1, "Initial step similarity should be 1");

// Test isolated run path does not leave temp directories behind (Risk C)
const tempPrefix = path.join(os.tmpdir(), "dizzy-sim-");
const isolatedResult = await runIsolatedSimulation(initialState, baselineParams, forkedParams, 10);
assert(isolatedResult.divergence.cumulative_divergence > 0);

// Check that no new directories matching tempPrefix were leaked in active cwd
const filesInCwd = fs.readdirSync(process.cwd());
assert(!filesInCwd.some(f => f.startsWith("dizzy-sim-")), "Leaked temp directory found in CWD!");
console.log("-> Test 1 passed.");

// -------------------------------------------------------------
// Test 2: Memory Bridge Quarantine Staging & Validation (Risk B)
// -------------------------------------------------------------
console.log("Running Test 2: Memory Bridge Staging & Validation...");
const testMemDir = path.join(DISPOSABLE_ROOT, "temp-dizzy-test-mem");
const testQuarantineDir = path.join(DISPOSABLE_ROOT, "temp-dizzy-test-quar");
fs.mkdirSync(testMemDir, { recursive: true });
fs.mkdirSync(testQuarantineDir, { recursive: true });

try {
  fs.writeFileSync(path.join(testMemDir, "2026-07-15.md"), "Antigravity, consensus proof, and sovereign Operator reviews.", "utf8");
  fs.writeFileSync(path.join(testMemDir, "2026-07-16.md"), "Random sentences that don't match anything.", "utf8");

  const currentText = "Operator review of the consensus proof with Antigravity operator-led sign off.";
  const bridges = scanBridgingMemories(testMemDir, currentText, 0.05);

  assert(bridges.length > 0, "Should detect similarity bridge");
  assert(bridges[0].source_file.endsWith("2026-07-15.md"), "Should map to correct file");
  assert.strictEqual(bridges[0].approved_by_operator, false, "Default approval status must be false");
  assert.strictEqual(bridges[0].status, "quarantined", "Default status must be quarantined");

  // Verify staging
  stageBridges(testQuarantineDir, bridges);
  const quarantineFiles = fs.readdirSync(testQuarantineDir);
  assert(quarantineFiles.length > 0, "Staged file must exist");
  
  const bridgeContent = JSON.parse(fs.readFileSync(path.join(testQuarantineDir, quarantineFiles[0]), "utf8"));
  assert.strictEqual(bridgeContent.approved_by_operator, false, "Staged bridge must have approval set to false");

  // Verify validation guards
  validateBridgePayload(bridgeContent); // should pass

  // Validation failures check
  assert.throws(() => {
    validateBridgePayload({ ...bridgeContent, source_file: "../secret_file" });
  }, /Path traversal detected/, "Should throw path traversal exception");

  assert.throws(() => {
    validateBridgePayload({ ...bridgeContent, score: 5.0 });
  }, "Should validate score bounds");

  console.log("-> Test 2 passed.");
} finally {
  fs.rmSync(testMemDir, { recursive: true, force: true });
  fs.rmSync(testQuarantineDir, { recursive: true, force: true });
}

// -------------------------------------------------------------
// Test 3: Real Append API & Candidate Exclusion integration test (AP-01, AP-02, AP-03, AP-05, AP-06, AP-07, AP-08, AP-09)
// -------------------------------------------------------------
console.log("Running Test 3: Real Append API & Active Policy engine integration...");
const tempLedgerPath = path.join(DISPOSABLE_ROOT, "friction_ledger.jsonl");
const tempConfigPath = path.join(DISPOSABLE_ROOT, "active_policy_config.json");
const tempStatePath = path.join(DISPOSABLE_ROOT, "active_policy_state.json");
const tempQuarantineDirForEngine = path.join(DISPOSABLE_ROOT, "engine_quarantine");

fs.mkdirSync(tempQuarantineDirForEngine, { recursive: true });

// Setup config with varied min_history_entries
const testConfig = {
  enabled: true,
  z_score_threshold: 3.0,
  min_history_entries: 5,
  containment_actions: {
    suspend_durable_writes: true,
    veto_quarantined_bridges: true
  },
  escalation_contact: "operator@localhost"
};
fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig, null, 2), "utf8");

// Setup environment overrides so the policy engine reads the isolated test files
process.env.DIZZY_FRICTION_PATH = tempLedgerPath;
process.env.DIZZY_QUARANTINE_PATH = tempQuarantineDirForEngine;
process.env.DIZZY_ACTIVE_POLICY_CONFIG_PATH = tempConfigPath;
process.env.DIZZY_ACTIVE_POLICY_STATE_PATH = tempStatePath;

try {
  // Setup separate reader and writer engine instances configured with temp paths
  const engine = new ActivePolicyEngine({
    configPath: tempConfigPath,
    statePath: tempStatePath,
    ledgerPath: tempLedgerPath,
    quarantinePath: tempQuarantineDirForEngine
  });

  // Inject a mock quarantined bridge inside the temporary quarantine folder
  const bridgeId = "test_bridge_id";
  const bridgeFile = path.join(tempQuarantineDirForEngine, `bridge_${bridgeId}.json`);
  fs.writeFileSync(bridgeFile, JSON.stringify({
    id: bridgeId,
    source_file: "source.md",
    target_file: "target.md",
    status: "quarantined",
    approved_by_operator: false
  }, null, 2), "utf8");

  // 1. Append 5 normal low-friction entries
  for (let i = 0; i < 5; i++) {
    appendFrictionSync({
      friction_type: "api_slowdown",
      severity: 2,
      frequency: "once",
      description: `Normal slow down instance ${i}`,
      timestamp: new Date(Date.now() - (10 - i) * 60000).toISOString()
    }, { filePath: tempLedgerPath });
  }

  // Refresh engine to inspect status: containment should be false
  engine.refreshState();
  assert.strictEqual(engine.state.containment_active, false, "Containment must be inactive with only baseline entries");
  assert.strictEqual(engine.isWriteSuspended(), false, "Writes must not be suspended");

  // 2. Append a chronic severity-10 anomaly (weight = 30)
  // If the candidate was in its own baseline, MAD scale would be large, preventing containment.
  // With baseline exclusion, the baseline has MAD=0, falling back to epsilon=0.1.
  // The candidate Z-score will be (30 - 2) / 0.1 = 280, triggering containment.
  appendFrictionSync({
    friction_type: "consensus_staleness",
    severity: 10,
    frequency: "chronic",
    description: "Critical chronic consensus stall",
    timestamp: new Date().toISOString()
  }, { filePath: tempLedgerPath });

  engine.refreshState();
  assert.strictEqual(engine.state.containment_active, true, "Containment must be active after chronic anomaly append");
  assert.strictEqual(engine.isWriteSuspended(), true, "Writes must be suspended after anomaly");
  assert(engine.state.trigger_reason.includes("consensus_staleness"), "Trigger reason must mention chronic anomaly type");

  // 3. Verify that assertDurableWriteAllowed now blocks writes
  assert.throws(() => {
    assertDurableWriteAllowed({
      kind: "friction",
      payload: { text: "attempted write" },
      trustZone: "private_self"
    });
  }, /durable write blocked: write_capabilities_suspended_containment_active/, "Assert write should throw write suspended");

  // 4. Verify that bridge veto ran and marked the quarantined bridge as vetoed
  const bridgeContent = JSON.parse(fs.readFileSync(bridgeFile, "utf8"));
  assert.strictEqual(bridgeContent.status, "vetoed", "Quarantined bridge status must be vetoed");
  assert(bridgeContent.veto_reason.includes("containment active"), "Veto reason must be logged");

  // 5. Verify resolution reason constraints: empty reason should be rejected
  assert.throws(() => {
    engine.resolveContainment("");
  }, /resolution reason is required/, "Empty containment resolution reason must be rejected");

  assert.throws(() => {
    engine.resolveContainment("   ");
  }, /resolution reason is required/, "Whitespace resolution reason must be rejected");

  // 6. Resolve containment with a valid reason
  const resolutionReason = "Verified consensus stability and restored state paths";
  engine.resolveContainment(resolutionReason);

  engine.refreshState();
  assert.strictEqual(engine.state.containment_active, false, "Containment must be inactive after resolution");
  assert.strictEqual(engine.isWriteSuspended(), false, "Writes must be allowed after resolution");

  const lastHistory = engine.state.containment_history[engine.state.containment_history.length - 1];
  assert.strictEqual(lastHistory.resolved_by_operator, true, "History should reflect operator resolution");
  assert.strictEqual(lastHistory.resolved_reason, resolutionReason, "Resolution reason must be correctly stored in history");

  console.log("-> Test 3 passed.");
} finally {
  delete process.env.DIZZY_FRICTION_PATH;
  delete process.env.DIZZY_QUARANTINE_PATH;
  delete process.env.DIZZY_ACTIVE_POLICY_CONFIG_PATH;
  delete process.env.DIZZY_ACTIVE_POLICY_STATE_PATH;
  fs.rmSync(tempQuarantineDirForEngine, { recursive: true, force: true });
}

// -------------------------------------------------------------
// Test 4: MDS Projection Caching
// -------------------------------------------------------------
console.log("Running Test 4: MDS Coordinates Caching...");
const options = [
  { option_id: "A", description: "Deploy basic needs first", friction: "low" },
  { option_id: "B", description: "Wait for multi-agent signoff", friction: "medium" }
];

const res1 = projectCoordinates(options, 50);
const res2 = projectCoordinates(options, 50);
assert.strictEqual(res1, res2, "Aggressive caching should return identical array reference");

const newOptions = [
  { option_id: "A", description: "Deploy basic needs first", friction: "low" },
  { option_id: "B", description: "Wait for multi-agent signoff", friction: "high" } // changed
];
const res3 = projectCoordinates(newOptions, 50);
assert.notStrictEqual(res1, res3, "Cache should invalidate on options mutation");
console.log("-> Test 4 passed.");

// -------------------------------------------------------------
// Test 5: Prune & Deduplication Integration
// -------------------------------------------------------------
console.log("Running Test 5: Pruning & Deduplicated Utilities...");
const testHist = path.join(DISPOSABLE_ROOT, "temp-test-history.jsonl");
const testConvos = path.join(DISPOSABLE_ROOT, "temp-test-convos");
const testDeletes = path.join(DISPOSABLE_ROOT, "temp-test-deletes.jsonl");
const testReceipts = path.join(DISPOSABLE_ROOT, "temp-test-receipts.jsonl");
fs.mkdirSync(testConvos, { recursive: true });

try {
  fs.writeFileSync(testHist, "", "utf8");
  
  const { pruneExpiredClientContinuity } = await import("../lib/client_continuity.mjs");
  const pruneReport = await pruneExpiredClientContinuity({
    nowMs: Date.now(),
    historyPath: testHist,
    conversationsDir: testConvos,
    deletionPath: testDeletes,
    automationReceiptPath: testReceipts,
    expiryMs: 1000
  });

  assert(pruneReport.ok, "Pruning report should return ok: true");
  assert(Array.isArray(pruneReport.deleted_conversation_keys), "Pruning report should return array of deleted keys");
  console.log("-> Test 5 passed.");
} finally {
  fs.rmSync(testHist, { force: true });
  fs.rmSync(testConvos, { recursive: true, force: true });
  fs.rmSync(testDeletes, { force: true });
  fs.rmSync(testReceipts, { force: true });
}

// Clean up isolated root
fs.rmSync(DISPOSABLE_ROOT, { recursive: true, force: true });
console.log("\nALL INTEGRATION TESTS PASSED SUCCESSFULLY!");
