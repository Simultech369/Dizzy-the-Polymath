import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildReviewCyclePlan,
  discoverHarnesses,
  getReviewerRoster,
  inferBlastRadius,
  inferReviewDomains,
  reconcileReviewBatch,
  updateReviewHistory,
} from "../lib/review_cycle_orchestrator.mjs";

console.log("=== W-0068 Review Cycle Orchestrator Test Suite ===");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const roster = getReviewerRoster();
assert.equal(roster.length, 40, "Review roster must cover the 40 W-0066 router roles");
assert.equal(new Set(roster.map((role) => role.role_key)).size, 40, "Reviewer role keys must be unique");

assert.deepEqual(
  inferReviewDomains([
    "lib/ingress_gateway.mjs",
    "lib/sqlite_operational_store.mjs",
    "lib/model_registry.mjs",
    "scripts/replay_safety_test.mjs",
  ]),
  ["ingress", "lineage", "replay", "security", "tests"],
);
assert.equal(inferBlastRadius(["lib/ingress_gateway.mjs"], ["ingress"]), "high");
assert.equal(inferBlastRadius(["lib/trajectory_snapshot_store.mjs"], ["lineage"]), "medium");
assert.equal(inferBlastRadius(["reviews/public_progress_language_options.md"], ["governance"]), "low");

const history = {
  reviewers: {
    adversarial_critic: {
      runs: 10,
      confirmed_findings: 9,
      useful_disagreements: 4,
      false_positive_findings: 1,
    },
    universal_judge: {
      runs: 8,
      confirmed_findings: 0,
      useful_disagreements: 0,
      false_positive_findings: 6,
    },
  },
};

const plan = buildReviewCyclePlan({
  changedFiles: [
    "agent_server.mjs",
    "lib/ingress_gateway.mjs",
    "lib/sqlite_operational_store.mjs",
    "lib/trajectory_snapshot_store.mjs",
    "scripts/replay_safety_test.mjs",
  ],
  packageJson,
  history,
  maxReviewers: 14,
  maxHarnesses: 10,
  candidateId: "w0068-fixture",
  now: new Date("2026-08-08T12:00:00.000Z"),
});

assert.equal(plan.schema_version, "dizzy.review_cycle_plan.v1");
assert.equal(plan.candidate_id, "w0068-fixture");
assert.equal(plan.blast_radius, "high");
assert.equal(plan.available_reviewers, 40);
assert.equal(plan.reviewer_assignments.length, 14);
assert.equal(plan.reviewer_assignments.some((role) => role.role_key === "adversarial_critic"), true);
assert.equal(plan.reviewer_assignments.some((role) => role.role_key === "systems_architect"), true);
assert.equal(plan.reviewer_assignments.some((role) => role.role_key === "schema_compliance_auditor"), true);
assert.equal(plan.reviewer_assignments.some((role) => role.role_key === "gemma3_local"), true);
assert.equal(plan.reviewer_assignments.some((role) => role.role_key === "universal_judge"), false, "Low-yield history should not beat required or underused roles");
assert.equal(new Set(plan.reviewer_assignments.map((role) => role.role_key)).size, plan.reviewer_assignments.length);

const harnessNames = plan.harness_plan.map((harness) => harness.script);
for (const expected of ["test:ingress-gateway", "test:replay-safety", "test:trajectory-snapshot", "test:model-registry", "check:council", "test"]) {
  assert.equal(harnessNames.includes(expected), true, `Expected harness ${expected}`);
}
assert.equal(discoverHarnesses(packageJson).some((harness) => harness.side_effect_class === "writes_receipts_context_only"), true);

const failedHarness = reconcileReviewBatch({
  reviews: [{ source: "qwen", findings: [] }],
  harnesses: [{ name: "test:router", status: "passed" }, { name: "test:replay-safety", status: "failed" }],
});
assert.equal(failedHarness.state_transition, "fixture-required");

const quarantine = reconcileReviewBatch({
  reviews: [{
    source: "deepseek",
    findings: [{
      disposition: "accepted",
      severity: "high",
      category: "security",
      claim: "trust-zone bypass through unauthenticated router override",
    }],
  }],
  harnesses: [{ name: "test:router", status: "passed" }],
});
assert.equal(quarantine.state_transition, "quarantine");

const split = reconcileReviewBatch({
  reviews: [{
    source: "hy3",
    findings: [{
      disposition: "accepted",
      severity: "medium",
      category: "scope_split",
      claim: "lineage UI should be separate from local manifest storage",
    }],
  }],
  harnesses: [{ name: "test:model-registry", status: "passed" }],
});
assert.equal(split.state_transition, "split");

const readyForReview = reconcileReviewBatch({
  reviews: [{ source: "gemma", findings: [] }],
  harnesses: [{ name: "test:model-router", status: "passed" }],
});
assert.equal(readyForReview.state_transition, "ready-for-review");

const readyForPush = reconcileReviewBatch({
  reviews: [
    { source: "qwen", findings: [] },
    { source: "deepseek", findings: [] },
    { source: "gemma", findings: [{ kind: "disagreement", disposition: "rejected", severity: "low", claim: "resolved fixture disagreement" }] },
  ],
  harnesses: [{ name: "test", status: "passed" }, { name: "check:council", status: "passed" }],
});
assert.equal(readyForPush.state_transition, "ready-for-push");
assert.equal(readyForPush.authority, "automation_proposes_simul_approves");

const updated = updateReviewHistory({}, [
  {
    role_key: "qwen_local",
    findings: [
      { disposition: "accepted", category: "disagreement", claim: "good catch" },
      { disposition: "rejected", claim: "false positive" },
    ],
  },
]);
assert.equal(updated.reviewers.qwen_local.runs, 1);
assert.equal(updated.reviewers.qwen_local.confirmed_findings, 1);
assert.equal(updated.reviewers.qwen_local.false_positive_findings, 1);
assert.equal(updated.reviewers.qwen_local.useful_disagreements, 1);

console.log("REVIEW_CYCLE_ORCHESTRATOR_TESTS_OK");
