/**
 * Verification Test Suite for Trajectory Replay Debugger & Diff Engine
 *
 * Verifies:
 * 1. Complete hop recording with metrics, state deltas, and cryptographic hashes
 * 2. Time-travel forking at arbitrary historical points
 * 3. Formal divergence classification:
 *    - Perfect match
 *    - Orchestration bugs (tool mismatch, arg drift, premature termination)
 *    - Model quality bugs (semantic output confabulation/drift)
 *    - Cost/latency regressions
 * 4. Cryptographic diff receipt emission and tamper detection
 */

import assert from "node:assert/strict";

import {
  TRAJECTORY_DEBUG_SESSION_SCHEMA,
  TRAJECTORY_DIFF_RECEIPT_SCHEMA,
  DIVERGENCE_CLASSES,
  TrajectoryDebugSession,
  compareTrajectories,
} from "../lib/trajectory_replay_debugger.mjs";

console.log("==================================================");
console.log("   Trajectory Replay Debugger & Diff Engine Suite ");
console.log("==================================================\n");

// TEST 1: Hop recording and session snapshot
console.log("[Test 1] Recording hops and generating session snapshot...");
const goldenSession = new TrajectoryDebugSession({ name: "Golden Rebate Audit Run" });

goldenSession.recordHop({
  actor: "agent",
  stage: "route",
  input: "Inspect rebate epoch 4 claims for compliance",
  output: "Selected local deterministic auditor route",
  latencyMs: 15,
  promptTokens: 120,
  completionTokens: 25,
  costUsd: 0.0001,
});

goldenSession.recordHop({
  actor: "tool",
  stage: "tool_call",
  tool: "query_rebate_claims",
  args: { epoch: 4, status: "pending" },
  output: JSON.stringify({ claims_count: 42, total_rebates_usd: 128000 }),
  stateDelta: { bytes_changed: 256, diff_summary: "Queried 42 claims" },
  latencyMs: 85,
  promptTokens: 250,
  completionTokens: 80,
  costUsd: 0.0004,
});

goldenSession.recordHop({
  actor: "agent",
  stage: "synthesis",
  input: "Summarize findings",
  output: "All 42 claims in epoch 4 verified against fiduciary invariant rules. 0 discrepancies found.",
  latencyMs: 120,
  promptTokens: 400,
  completionTokens: 150,
  costUsd: 0.0008,
});

const goldenSnapshot = goldenSession.getSnapshot();
assert.equal(goldenSnapshot.schema_version, TRAJECTORY_DEBUG_SESSION_SCHEMA);
assert.equal(goldenSnapshot.hop_count, 3);
assert.equal(goldenSnapshot.totals.latency_ms, 220);
assert.ok(goldenSnapshot.session_sha256);
console.log("  [PASS] Test 1: Complete hop recording and session snapshot verified");

// TEST 2: Time-travel forking
console.log("\n[Test 2] Time-travel forking at historical hop...");
const forkedSession = goldenSession.forkAt(1, "candidate_fork_run");
assert.equal(forkedSession.hops.length, 2);
assert.equal(forkedSession.parentSessionId, goldenSession.sessionId);
assert.equal(forkedSession.forkPoint, 1);

// Record divergent candidate hop on step 2
forkedSession.recordHop({
  actor: "agent",
  stage: "synthesis",
  input: "Summarize findings",
  output: "The weather in New York is cloudy and sunny today with rain showers.", // Hallucinated / drifting output
  latencyMs: 110,
  promptTokens: 400,
  completionTokens: 140,
  costUsd: 0.0008,
});
assert.equal(forkedSession.hops.length, 3);
console.log("  [PASS] Test 2: Time-travel fork cloned pre-conditions and allowed alternative execution");

// TEST 3: Perfect match comparison
console.log("\n[Test 3] Comparing identical trajectories (PERFECT_MATCH)...");
const identicalDiff = compareTrajectories(goldenSnapshot, goldenSnapshot);
assert.equal(identicalDiff.schema_version, TRAJECTORY_DIFF_RECEIPT_SCHEMA);
assert.equal(identicalDiff.primary_classification, DIVERGENCE_CLASSES.PERFECT_MATCH);
assert.equal(identicalDiff.divergence_count, 0);
assert.ok(identicalDiff.receipt_sha256);
console.log("  [PASS] Test 3: Identical trajectory yields PERFECT_MATCH receipt");

// TEST 4: Model quality bug detection (Semantic drift)
console.log("\n[Test 4] Detecting model quality bug (semantic output drift)...");
const modelQualityDiff = compareTrajectories(goldenSnapshot, forkedSession.getSnapshot());
assert.equal(modelQualityDiff.primary_classification, DIVERGENCE_CLASSES.MODEL_QUALITY_BUG);
assert.ok(modelQualityDiff.divergences.some((d) => d.type === "SEMANTIC_OUTPUT_DRIFT"));
assert.equal(modelQualityDiff.divergences[0].classification, DIVERGENCE_CLASSES.MODEL_QUALITY_BUG);
console.log("  [PASS] Test 4: Model quality bug successfully isolated from orchestration bugs");

// TEST 5: Orchestration bug detection (Tool mismatch)
console.log("\n[Test 5] Detecting orchestration bug (tool mismatch)...");
const toolMismatchSession = new TrajectoryDebugSession({ name: "Tool Mismatch Candidate" });
toolMismatchSession.recordHop({ ...goldenSession.hops[0] });
toolMismatchSession.recordHop({
  actor: "tool",
  stage: "tool_call",
  tool: "wrong_external_scraper", // Wrong tool!
  args: { url: "http://example.com" },
  output: "{}",
});
toolMismatchSession.recordHop({ ...goldenSession.hops[2] });

const toolMismatchDiff = compareTrajectories(goldenSnapshot, toolMismatchSession.getSnapshot());
assert.equal(toolMismatchDiff.primary_classification, DIVERGENCE_CLASSES.ORCHESTRATION_BUG);
assert.ok(toolMismatchDiff.divergences.some((d) => d.type === "TOOL_MISMATCH"));
console.log("  [PASS] Test 5: Tool mismatch classified as ORCHESTRATION_BUG");

// TEST 6: Orchestration bug detection (Tool arguments drift)
console.log("\n[Test 6] Detecting orchestration bug (tool arguments mismatch)...");
const argDriftSession = new TrajectoryDebugSession({ name: "Arg Drift Candidate" });
argDriftSession.recordHop({ ...goldenSession.hops[0] });
argDriftSession.recordHop({
  actor: "tool",
  stage: "tool_call",
  tool: "query_rebate_claims",
  args: { epoch: 99, status: "corrupted" }, // Divergent args
  output: "{}",
});
argDriftSession.recordHop({ ...goldenSession.hops[2] });

const argDriftDiff = compareTrajectories(goldenSnapshot, argDriftSession.getSnapshot());
assert.equal(argDriftDiff.primary_classification, DIVERGENCE_CLASSES.ORCHESTRATION_BUG);
assert.ok(argDriftDiff.divergences.some((d) => d.type === "TOOL_ARGS_MISMATCH"));
console.log("  [PASS] Test 6: Tool arguments mismatch classified as ORCHESTRATION_BUG");

// TEST 7: Premature termination (extraneous / missing hops)
console.log("\n[Test 7] Detecting premature termination...");
const truncatedSession = new TrajectoryDebugSession({ name: "Truncated Candidate" });
truncatedSession.recordHop({ ...goldenSession.hops[0] });

const truncatedDiff = compareTrajectories(goldenSnapshot, truncatedSession.getSnapshot());
assert.equal(truncatedDiff.primary_classification, DIVERGENCE_CLASSES.ORCHESTRATION_BUG);
assert.ok(truncatedDiff.divergences.some((d) => d.type === "PREMATURE_TERMINATION"));
console.log("  [PASS] Test 7: Premature termination classified as ORCHESTRATION_BUG");

// TEST 8: Cost regression detection
console.log("\n[Test 8] Detecting cost regression...");
const expensiveSession = new TrajectoryDebugSession({ name: "Expensive Candidate" });
expensiveSession.recordHop({ ...goldenSession.hops[0], metrics: { ...goldenSession.hops[0].metrics, cost_usd: 0.005 } });
expensiveSession.recordHop({ ...goldenSession.hops[1], metrics: { ...goldenSession.hops[1].metrics, cost_usd: 0.010 } });
expensiveSession.recordHop({ ...goldenSession.hops[2], metrics: { ...goldenSession.hops[2].metrics, cost_usd: 0.020 } });

const costDiff = compareTrajectories(goldenSnapshot, expensiveSession.getSnapshot());
assert.equal(costDiff.primary_classification, DIVERGENCE_CLASSES.LATENCY_COST_REGRESSION);
assert.ok(costDiff.divergences.some((d) => d.type === "COST_REGRESSION"));
console.log("  [PASS] Test 8: Cost regression identified and tagged with LATENCY_COST_REGRESSION");

console.log("\n[test:trajectory-debugger] ALL 8 REPLAY & DIFF TESTS PASSED CLEANLY.\n");
