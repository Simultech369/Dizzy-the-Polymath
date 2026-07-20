/**
 * scripts/test_active_integration.mjs
 * -----------------------------------
 * Test suite to verify all the active integration changes:
 * - Active Policy Engine real append path, candidate exclusion, write block suspension, bridge veto, resolution reasons
 */

import assert from "assert";
import fs from "fs";
import path from "path";

import { detectFrictionAnomaly } from "../lib/friction_anomaly_detector.mjs";
import { ActivePolicyEngine } from "../lib/active_policy_engine.mjs";
import { assertDurableWriteAllowed } from "../lib/durable_write_policy.mjs";
import { appendFrictionSync } from "../lib/friction_ledger.mjs";

console.log("Starting active integration tests...");

// Ensure runtime directory exists
fs.mkdirSync(path.join(process.cwd(), "runtime"), { recursive: true });
// Define root disposable temp dir inside runtime directory
const DISPOSABLE_ROOT = fs.mkdtempSync(path.join(process.cwd(), "runtime", ".test-run-"));
console.log(`Using isolated disposable root: ${DISPOSABLE_ROOT}`);

// -------------------------------------------------------------
// Test: Real Append API & Candidate Exclusion integration test (AP-01, AP-02, AP-03, AP-05, AP-06, AP-07, AP-08, AP-09)
// -------------------------------------------------------------
console.log("Running Test: Real Append API & Active Policy engine integration...");
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

  console.log("-> Test passed.");
} finally {
  delete process.env.DIZZY_FRICTION_PATH;
  delete process.env.DIZZY_QUARANTINE_PATH;
  delete process.env.DIZZY_ACTIVE_POLICY_CONFIG_PATH;
  delete process.env.DIZZY_ACTIVE_POLICY_STATE_PATH;
  fs.rmSync(tempQuarantineDirForEngine, { recursive: true, force: true });
}

// Clean up isolated root
fs.rmSync(DISPOSABLE_ROOT, { recursive: true, force: true });
console.log("\nALL INTEGRATION TESTS PASSED SUCCESSFULLY!");
