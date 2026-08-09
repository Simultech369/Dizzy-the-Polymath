import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildReviewCyclePlan } from "../lib/review_cycle_orchestrator.mjs";
import {
  redactReviewLoopText,
  runHarnessCommand,
  runReviewCycle,
  summarizeHarnessOutput,
  updateReviewCycleHistory,
  writeReviewCycleHistory,
  writeReviewCycleReceipt,
  loadReviewCycleHistory,
} from "../lib/review_cycle_runner.mjs";

console.log("=== W-0068 Review Cycle Run Test Suite ===");

assert.equal(redactReviewLoopText("authorization: Bearer sk-testsecret12345"), "authorization: Bearer [REDACTED]");
assert.doesNotMatch(summarizeHarnessOutput("token=supersecretvalue sk-testsecret12345"), /supersecretvalue|sk-testsecret/);
assert.equal(runHarnessCommand({ script: "bad script;", side_effect_class: "deterministic_local" }).status, "failed");

const packageJson = {
  scripts: {
    "test:ingress-gateway": "node ./scripts/ingress_gateway_test.mjs",
    "test:replay-safety": "node ./scripts/replay_safety_test.mjs",
    "check:council": "node ./scripts/oss_council_audit.mjs",
    "test": "node ./scripts/safety_checks.mjs",
  },
};

const plan = buildReviewCyclePlan({
  changedFiles: ["lib/ingress_gateway.mjs", "lib/sqlite_operational_store.mjs"],
  packageJson,
  maxReviewers: 6,
  maxHarnesses: 4,
  candidateId: "loopage-fixture",
  now: new Date("2026-08-09T00:00:00.000Z"),
});

const runOrder = [];
const passed = await runReviewCycle({
  plan,
  now: new Date("2026-08-09T00:01:00.000Z"),
  requireDisagreement: true,
  reviews: [
    { source: "qwen_local", role_key: "qwen_local", findings: [] },
    { source: "deepseek_r1", role_key: "chain_of_thought_critic", findings: [] },
    {
      source: "gemma3_local",
      role_key: "gemma3_local",
      findings: [{ kind: "disagreement", disposition: "rejected", severity: "low", claim: "Resolved loop planning disagreement." }],
    },
  ],
  runHarness: async (harness) => {
    runOrder.push(harness.script);
    return {
      script: harness.script,
      status: "passed",
      exit_code: 0,
      duration_ms: 7,
      stdout_tail: "OK",
    };
  },
});

assert.equal(passed.schema_version, "dizzy.review_cycle_run.v1");
assert.equal(passed.reconciliation.state_transition, "ready-for-push");
assert.equal(passed.reconciliation.authority, "automation_proposes_simul_approves");
assert.deepEqual(runOrder, plan.harness_plan.map((harness) => harness.script));
assert.equal(passed.autonomy_boundary.meaning, "bounded_local_orchestration");

const failed = await runReviewCycle({
  plan,
  failFast: true,
  runHarness: async (harness) => ({
    script: harness.script,
    status: harness.script === plan.harness_plan[0].script ? "failed" : "passed",
    exit_code: 1,
    stderr_tail: "API_KEY=secret_should_not_survive",
  }),
});
assert.equal(failed.reconciliation.state_transition, "fixture-required");
assert.equal(failed.harnesses.length, 1);
assert.doesNotMatch(JSON.stringify(failed), /secret_should_not_survive/);

const history = updateReviewCycleHistory({}, passed);
assert.equal(history.harnesses[plan.harness_plan[0].script].runs, 1);
assert.equal(history.harnesses[plan.harness_plan[0].script].passes, 1);
assert.equal(history.reviewers.qwen_local.attempts, 1);
assert.equal(history.reviewers.qwen_local.runs, 1);
assert.equal(history.reviewers.gemma3_local.useful_disagreements, 1);
assert.equal(history.cycles[0].state_transition, "ready-for-push");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-review-cycle-"));
try {
  const receiptPath = writeReviewCycleReceipt(passed, { rootDir: tempRoot, outPath: "reviews/latest.json" });
  const historyPath = writeReviewCycleHistory(history, { rootDir: tempRoot, historyPath: "reviews/history.json" });
  assert.equal(JSON.parse(fs.readFileSync(receiptPath, "utf8")).run_id, passed.run_id);
  assert.equal(loadReviewCycleHistory("reviews/history.json", { rootDir: tempRoot }).cycles.length, 1);
  assert.equal(path.basename(historyPath), "history.json");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("REVIEW_CYCLE_RUN_TESTS_OK");
