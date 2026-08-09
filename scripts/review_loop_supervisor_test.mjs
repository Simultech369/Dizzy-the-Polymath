import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runReviewLoopSupervisor } from "../lib/review_loop_supervisor.mjs";

console.log("=== W-0068 Review Loop Supervisor Test Suite ===");

const packageJson = {
  scripts: {
    test: "node ./scripts/safety_checks.mjs",
    "test:router": "node ./scripts/dynamic_router_test.mjs",
    "check:council": "node ./scripts/oss_council_audit.mjs",
    "eval:retrieval-golden": "node ./scripts/retrieval_eval.mjs",
  },
};

const noWriteOrder = [];
const noWrite = await runReviewLoopSupervisor({
  changedFiles: ["lib/model_router.mjs", "scripts/model_router_test.mjs"],
  packageJson,
  history: {},
  maxReviewers: 4,
  maxHarnesses: 4,
  diffText: "diff --git a/lib/model_router.mjs b/lib/model_router.mjs\n+router change",
  now: new Date("2026-08-09T00:00:00.000Z"),
  runHarness: async (harness) => {
    noWriteOrder.push(harness.script);
    return {
      script: harness.script,
      status: "passed",
      exit_code: 0,
      duration_ms: 5,
      stdout_tail: "OK",
    };
  },
});

assert.equal(noWrite.schema_version, "dizzy.review_loop_supervisor.v1");
assert.equal(noWrite.write_mode.receipts, false);
assert.equal(noWrite.write_mode.history, false);
assert.equal(noWrite.write_mode.receipt_harnesses, false);
assert.equal(noWrite.model_batch_summary.packet_count, 4);
assert.equal(noWrite.model_batch_summary.review_count, 0);
assert.equal(noWrite.run_summary.state_transition, "ready-for-review");
assert.equal(noWrite.coverage_summary.harnesses.touched, noWriteOrder.length);
assert.equal(noWrite.plan_summary.skipped_receipt_harnesses.some((harness) => harness.script === "check:council"), true);
assert.equal(noWriteOrder.includes("check:council"), false);
assert.deepEqual(Object.values(noWrite.receipt_paths), ["", "", "", ""]);
assert.equal(noWrite.authority, "automation_proposes_simul_approves");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-review-supervisor-"));
try {
  const writeOrder = [];
  const written = await runReviewLoopSupervisor({
    rootDir: tempRoot,
    changedFiles: ["lib/model_router.mjs"],
    packageJson,
    history: {},
    maxReviewers: 3,
    maxHarnesses: 4,
    diffText: "diff --git a/lib/model_router.mjs b/lib/model_router.mjs\n+router change",
    now: new Date("2026-08-09T00:01:00.000Z"),
    writeReceipts: true,
    writeHistory: true,
    runHarness: async (harness) => {
      writeOrder.push(harness.script);
      return {
        script: harness.script,
        status: "passed",
        exit_code: 0,
        duration_ms: 5,
        stdout_tail: "OK",
      };
    },
  });

  assert.equal(written.write_mode.receipts, true);
  assert.equal(written.write_mode.history, true);
  assert.equal(written.write_mode.receipt_harnesses, true);
  assert.equal(writeOrder.includes("check:council"), true);
  assert.equal(fs.existsSync(written.receipt_paths.model_review_batch), true);
  assert.equal(fs.existsSync(written.receipt_paths.review_cycle), true);
  assert.equal(fs.existsSync(written.receipt_paths.review_history), true);
  assert.equal(fs.existsSync(written.receipt_paths.supervisor), true);
  assert.equal(JSON.parse(fs.readFileSync(written.receipt_paths.supervisor, "utf8")).schema_version, "dizzy.review_loop_supervisor.v1");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("REVIEW_LOOP_SUPERVISOR_TESTS_OK");
