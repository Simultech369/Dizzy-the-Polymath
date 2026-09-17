import assert from "node:assert";
import {
  TrajectoryReplaySimulator,
  TRAJECTORY_REPLAY_SCHEMA,
} from "../lib/trajectory_replay_simulator.mjs";

console.log("[test:trajectory-replay] Starting suite...");

const goldenTrajectory = {
  id: "golden-git-fetch-and-build",
  steps: [
    { actor: "user", content: "Sync the repo and test." },
    {
      actor: "agent",
      tool: "git_fetch",
      args: { remote: "origin", branch: "main" },
      status: "success",
      result: "From github.com/repo * branch main -> FETCH_HEAD",
    },
    {
      actor: "agent",
      tool: "run_test",
      args: { suite: "unit" },
      status: "success",
      result: "ALL 10 TESTS PASSED",
    },
    { actor: "agent", content: "All tests passed successfully." },
  ],
};

// 1. Exact matching replay
const sim1 = new TrajectoryReplaySimulator(goldenTrajectory);
const res1a = sim1.executeTool("git_fetch", { remote: "origin", branch: "main" });
assert.equal(res1a.ok, true);
assert.equal(res1a.cached, true);
assert.equal(res1a.result, "From github.com/repo * branch main -> FETCH_HEAD");

const res1b = sim1.executeTool("run_test", { suite: "unit" });
assert.equal(res1b.ok, true);
assert.equal(res1b.cached, true);
assert.equal(res1b.result, "ALL 10 TESTS PASSED");

const receipt1 = sim1.emitReceipt();
assert.equal(receipt1.schema_version, TRAJECTORY_REPLAY_SCHEMA);
assert.equal(receipt1.status, "MATCHED");
assert.equal(receipt1.is_fully_matched, true);
assert.equal(receipt1.steps_replayed, 2);
assert.equal(receipt1.total_expected_tool_steps, 2);

// 2. Divergence on tool name
const sim2 = new TrajectoryReplaySimulator(goldenTrajectory);
const res2 = sim2.executeTool("git_checkout", { branch: "main" });
assert.equal(res2.ok, false);
assert.equal(res2.diverged, true);

const receipt2 = sim2.emitReceipt();
assert.equal(receipt2.status, "DIVERGED");
assert.equal(receipt2.divergence.reason, "tool_mismatch");
assert.equal(receipt2.divergence.expected_tool, "git_fetch");
assert.equal(receipt2.divergence.actual_tool, "git_checkout");

// 3. Divergence on arguments
const sim3 = new TrajectoryReplaySimulator(goldenTrajectory);
const res3 = sim3.executeTool("git_fetch", { remote: "upstream", branch: "main" });
assert.equal(res3.ok, false);
assert.equal(res3.diverged, true);

const receipt3 = sim3.emitReceipt();
assert.equal(receipt3.status, "DIVERGED");
assert.equal(receipt3.divergence.reason, "args_mismatch");

// 4. Over-execution beyond golden trajectory
const sim4 = new TrajectoryReplaySimulator(goldenTrajectory);
sim4.executeTool("git_fetch", { remote: "origin", branch: "main" });
sim4.executeTool("run_test", { suite: "unit" });
const res4 = sim4.executeTool("extra_cleanup", {});
assert.equal(res4.ok, false);
assert.equal(res4.diverged, true);
const receipt4 = sim4.emitReceipt();
assert.equal(receipt4.divergence.reason, "trajectory_exhausted");

// 5. Incomplete replay
const sim5 = new TrajectoryReplaySimulator(goldenTrajectory);
sim5.executeTool("git_fetch", { remote: "origin", branch: "main" });
const receipt5 = sim5.emitReceipt();
assert.equal(receipt5.status, "INCOMPLETE");
assert.equal(receipt5.steps_replayed, 1);
assert.equal(receipt5.total_expected_tool_steps, 2);

console.log("  [PASS] Trajectory Replay Simulator accurately replays, detects divergence, and emits receipts.");
console.log("\n[test:trajectory-replay] ALL TESTS PASSED CLEANLY.\n");
