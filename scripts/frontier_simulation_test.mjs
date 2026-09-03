import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  SCENARIO_SIMULATION_SCHEMA,
  calculateDivergence,
  forkScenario,
  runSimulation,
  simulateStep,
} from "../lib/scenario_simulator.mjs";
import {
  FRICTION_ANOMALY_SCHEMA,
  calculateMedian,
  detectFrictionAnomaly,
  getEntryWeight,
} from "../lib/friction_anomaly_detector.mjs";
import {
  BRIDGING_MEMORY_SCHEMA,
  computeJaccardSimilarity,
  scanBridgingMemories,
  stageBridgesInQuarantine,
  tokenize,
} from "../lib/bridging_memory_scanner.mjs";

console.log("=== Frontier Simulation & Friction Test Suite ===");

// 1. Test Scenario Simulator
assert.equal(SCENARIO_SIMULATION_SCHEMA, "dizzy.scenario_simulation.v1");

const initialState = {
  reserves: 1000,
  participants: 50,
  allocated_amount: 0,
  exited_count: 0,
};

const baselineParams = {
  decay_rate: 0.02,
  basic_needs_allocation: 2.0,
  reserves_exit_threshold: 200,
  base_exit_rate: 0.1,
};

const step1 = simulateStep(initialState, baselineParams);
assert.equal(step1.allocated_amount, 100);
assert.ok(step1.reserves < 1000, "Reserves must decrease after decay and allocation");

const baselineHistory = runSimulation(initialState, baselineParams, 10);
assert.equal(baselineHistory.length, 11);
assert.equal(baselineHistory[0].step, 0);
assert.equal(baselineHistory[10].step, 10);

const forkedParams = {
  ...baselineParams,
  basic_needs_allocation: 5.0,
};
const forkedHistory = runSimulation(initialState, forkedParams, 10);
const divergence = calculateDivergence(baselineHistory, forkedHistory);

assert.equal(divergence.schema_version, "dizzy.scenario_simulation.v1");
assert.equal(divergence.total_steps, 11);
assert.ok(divergence.cumulative_divergence > 0, "Forked policy must show non-zero divergence");
assert.ok(divergence.average_divergence > 0);
assert.equal(divergence.history.length, 11);

const forkReport = forkScenario({
  initialState,
  baselineParams,
  forkedParams,
  steps: 5,
});
assert.equal(forkReport.schema_version, "dizzy.scenario_simulation.v1");
assert.equal(forkReport.steps, 5);
assert.ok(forkReport.divergence.cumulative_divergence > 0);

// 2. Test Friction Anomaly Detector
assert.equal(FRICTION_ANOMALY_SCHEMA, "dizzy.friction_anomaly_report.v1");
assert.equal(calculateMedian([1, 3, 5]), 3);
assert.equal(calculateMedian([1, 2, 3, 4]), 2.5);
assert.equal(calculateMedian([]), 0);

const normalEntry = { friction_type: "auth_token_expire", severity: 3, frequency: "first" };
assert.equal(getEntryWeight(normalEntry), 3);
const chronicEntry = { friction_type: "untrusted_injection", severity: 10, frequency: "chronic" };
assert.equal(getEntryWeight(chronicEntry), 30);

// Insufficient history test
const insufficientReport = detectFrictionAnomaly([normalEntry], chronicEntry, { min_history_entries: 5 });
assert.equal(insufficientReport.is_anomaly, false);
assert.match(insufficientReport.reason, /Insufficient historical data/);

// Baseline history
const mockHistory = [
  { friction_type: "auth_token_expire", severity: 4, frequency: "first" },
  { friction_type: "doc_reference_stale", severity: 3, frequency: "repeated" },
  { friction_type: "vram_exhaustion", severity: 8, frequency: "first" },
  { friction_type: "api_rate_limit", severity: 5, frequency: "repeated" },
  { friction_type: "skill_registry_missing", severity: 6, frequency: "first" },
  { friction_type: "auth_token_expire", severity: 3, frequency: "first" },
  { friction_type: "doc_reference_stale", severity: 2, frequency: "repeated" },
];

const normalCheck = detectFrictionAnomaly(mockHistory, { friction_type: "redis_latency", severity: 5, frequency: "first" });
assert.equal(normalCheck.is_anomaly, false);
assert.equal(normalCheck.prompt, null);

const anomalyCheck = detectFrictionAnomaly(mockHistory, chronicEntry);
assert.equal(anomalyCheck.is_anomaly, true);
assert.ok(anomalyCheck.robust_z >= 3.0);
assert.match(anomalyCheck.prompt, /\d+\.\d+σ deviation/);

// 3. Test Bridging Memory Scanner
assert.equal(BRIDGING_MEMORY_SCHEMA, "dizzy.bridging_memory_quarantine.v1");

const tokensA = tokenize("The quick brown fox jumps over the lazy dog");
assert.equal(tokensA.has("the"), false, "Stop words must be excluded");
assert.equal(tokensA.has("quick"), true);
assert.equal(tokensA.has("fox"), true);

const tokensB = tokenize("A quick brown dog barks loudly");
const similarity = computeJaccardSimilarity(tokensA, tokensB);
assert.ok(similarity > 0 && similarity < 1);

// Test opt-in gating
const disabledScan = scanBridgingMemories({
  memoryDir: "memory",
  currentText: "active session text",
  optIn: false,
});
assert.equal(disabledScan.opt_in, false);
assert.equal(disabledScan.status, "disabled_opt_in_required");
assert.deepEqual(disabledScan.suggestions, []);

// Test temporary fixture memory scan
const tmpMemoryDir = path.join(os.tmpdir(), `dizzy-test-mem-${Date.now()}`);
fs.mkdirSync(tmpMemoryDir, { recursive: true });
try {
  fs.writeFileSync(
    path.join(tmpMemoryDir, "2026-08-10.md"),
    "# Daily Log\nToday we refactored the router receipt schema and consensus state transitions.\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(tmpMemoryDir, "2026-08-11.md"),
    "# Daily Log\nUnrelated session on local hardware benchmarking and GPU vram metrics.\n",
    "utf8",
  );

  const enabledScan = scanBridgingMemories({
    memoryDir: tmpMemoryDir,
    currentText: "We are auditing consensus state transitions and receipt schemas.",
    threshold: 0.05,
    optIn: true,
  });

  assert.equal(enabledScan.opt_in, true);
  assert.equal(enabledScan.status, "ok");
  assert.ok(enabledScan.suggestions.length >= 1);
  assert.equal(enabledScan.suggestions[0].source_file, "2026-08-10.md");
  assert.equal(enabledScan.suggestions[0].status, "quarantined");

  const tmpQuarantineDir = path.join(os.tmpdir(), `dizzy-test-quarantine-${Date.now()}`);
  try {
    const staged = stageBridgesInQuarantine(tmpQuarantineDir, enabledScan.suggestions);
    assert.equal(staged.length, enabledScan.suggestions.length);
    for (const p of staged) {
      assert.equal(fs.existsSync(p), true);
    }
  } finally {
    fs.rmSync(tmpQuarantineDir, { recursive: true, force: true });
  }
} finally {
  fs.rmSync(tmpMemoryDir, { recursive: true, force: true });
}

console.log("FRONTIER_SIMULATION_TESTS_OK");
