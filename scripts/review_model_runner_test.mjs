import assert from "node:assert/strict";
import {
  buildModelReviewPackets,
  executeReviewerModelReview,
  isLocalOllamaModelName,
  parseReviewerResponseText,
  runModelReviewBatch,
} from "../lib/review_model_runner.mjs";
import {
  buildReviewCyclePlan,
  reconcileReviewBatch,
} from "../lib/review_cycle_orchestrator.mjs";

console.log("=== W-0068 Model Review Runner Test Suite ===");

const plan = buildReviewCyclePlan({
  changedFiles: ["lib/review_cycle_runner.mjs", "scripts/review_cycle_run_test.mjs"],
  packageJson: { scripts: { test: "node ./scripts/safety_checks.mjs", "check:council": "node ./scripts/oss_council_audit.mjs" } },
  candidateId: "model-review-fixture",
  maxReviewers: 4,
  maxHarnesses: 2,
  now: new Date("2026-08-09T00:00:00.000Z"),
});

const packets = buildModelReviewPackets(plan, { diffText: "diff --git a/file b/file\n+token=secret_value" });
assert.equal(packets.length, 4);
assert.equal(packets[0].schema_version, "dizzy.model_review_packet.v1");
assert.doesNotMatch(JSON.stringify(packets), /secret_value/);
assert.match(packets[0].system_prompt, /claims-only evidence/);
const cloudAllowedPacket = buildModelReviewPackets(plan, {
  diffText: "diff",
  allowCloud: true,
  trustZone: "trusted_collaborator",
}).find((packet) => packet.reviewer.role_key === "systems_architect");
assert.equal(cloudAllowedPacket.target.skipped_reason.includes("cloud_review_blocked"), false);

assert.equal(isLocalOllamaModelName("gemma3:4b"), true);
assert.equal(isLocalOllamaModelName("llama-audit:latest"), true);
assert.equal(isLocalOllamaModelName("nvidia/nemotron-3-super-120b-a12b:free"), false);
assert.equal(isLocalOllamaModelName("moonshotai/kimi-k2.7-code:batch"), false);

const localFallbackPacket = buildModelReviewPackets(plan, {
  diffText: "diff",
  preferLocalFallbacks: true,
}).find((packet) => packet.reviewer.role_key === "systems_architect");
assert.equal(localFallbackPacket.target.executable, true);
assert.equal(localFallbackPacket.target.model, "gemma3:4b");
assert.equal(localFallbackPacket.target.original_model, "claude-3-7-sonnet");
assert.equal(localFallbackPacket.target.selected_reason, "local_free_fallback");

const parsed = parseReviewerResponseText(`\`\`\`json
{
  "summary": "Looks bounded.",
  "findings": [
    {"severity": "medium", "category": "test_gap", "claim": "Missing live reviewer fixture.", "evidence": ["scripts/review_model_runner_test.mjs"]}
  ],
  "disagreements": [
    {"claim": "Whether skipped reviewers should count.", "evidence": ["reconcile counts"]}
  ],
  "state_transition": "fixture-required"
}
\`\`\``, { role_key: "gemma3_local" });
assert.equal(parsed.source, "gemma3_local");
assert.equal(parsed.findings.length, 2);
assert.equal(parsed.findings[1].kind, "disagreement");

const executed = await executeReviewerModelReview({
  plan,
  reviewer: { role_key: "gemma3_local", primary_model: "gemma3:4b", lens: "local" },
  diffText: "diff",
  generateText: async () => JSON.stringify({
    summary: "No blocker.",
    findings: [],
    disagreements: [{ claim: "Resolved useful disagreement.", evidence: ["test fixture"] }],
    state_transition: "ready-for-review",
  }),
});
assert.equal(executed.status, "submitted");
assert.equal(executed.findings.some((finding) => finding.kind === "disagreement"), true);

const fallbackExecuted = await executeReviewerModelReview({
  plan,
  reviewer: { role_key: "systems_architect", primary_model: "claude-3-7-sonnet", lens: "architecture" },
  diffText: "diff",
  preferLocalFallbacks: true,
  generateText: async ({ model }) => {
    assert.equal(model, "gemma3:4b");
    return JSON.stringify({ summary: "Fallback lens preserved.", findings: [], disagreements: [] });
  },
});
assert.equal(fallbackExecuted.status, "submitted");
assert.equal(fallbackExecuted.target.model, "gemma3:4b");
assert.equal(fallbackExecuted.target.original_model, "claude-3-7-sonnet");

const parseFailed = await executeReviewerModelReview({
  plan,
  reviewer: { role_key: "gemma3_local", primary_model: "gemma3:4b", lens: "local" },
  diffText: "diff",
  generateText: async () => "{\"summary\":\"bad\",\"findings\":[{\"claim\":\"x\"} token=secret_should_not_survive",
});
assert.equal(parseFailed.status, "failed");
assert.equal(parseFailed.failure_stage, "parse");
assert.match(parseFailed.response_excerpt, /token=\[REDACTED\]/);
assert.doesNotMatch(JSON.stringify(parseFailed), /secret_should_not_survive/);

const localUnavailable = await executeReviewerModelReview({
  plan,
  reviewer: { role_key: "gemma3_local", primary_model: "gemma3:4b", lens: "local" },
  diffText: "diff",
  generateText: async () => {
    throw new Error("fetch failed token=secret_should_not_survive");
  },
});
assert.equal(localUnavailable.status, "skipped");
assert.equal(localUnavailable.skipped_reason, "local_review_backend_unavailable");
assert.equal(localUnavailable.diagnosis.likely_root_cause, "local_backend_unreachable");
assert.equal(localUnavailable.diagnosis.authority, "diagnostic_evidence_not_authority");
assert.doesNotMatch(JSON.stringify(localUnavailable), /secret_should_not_survive/);

const originalOpenAICompatBaseUrl = process.env.OPENAI_COMPAT_BASE_URL;
process.env.OPENAI_COMPAT_BASE_URL = "https://openrouter.ai/api/v1";
const skipped = await executeReviewerModelReview({
  plan,
  reviewer: { role_key: "systems_architect", primary_model: "claude-3-7-sonnet", lens: "architecture" },
  diffText: "diff",
  allowCloud: false,
});
if (originalOpenAICompatBaseUrl === undefined) {
  delete process.env.OPENAI_COMPAT_BASE_URL;
} else {
  process.env.OPENAI_COMPAT_BASE_URL = originalOpenAICompatBaseUrl;
}
assert.equal(skipped.status, "skipped");
assert.equal(skipped.diagnosis.likely_root_cause, "cloud_blocked_by_policy");
assert.equal(skipped.findings.length, 0);

const progressEvents = [];
const batch = await runModelReviewBatch({
  plan,
  diffText: "diff",
  executeModels: true,
  onProgress: (event) => progressEvents.push(event),
  generateText: async () => "{\"summary\":\"ok\",\"findings\":[],\"disagreements\":[]}",
});
assert.equal(batch.schema_version, "dizzy.model_review_batch.v1");
assert.equal(batch.reviews.length, 4);
assert.equal(batch.packets.length, 4);
assert.equal(progressEvents.filter((event) => event.event === "reviewer_started").length, 4);
assert.equal(progressEvents.filter((event) => event.event === "reviewer_finished").length, 4);
for (let i = 0; i < plan.reviewer_assignments.length; i++) {
  const start = progressEvents[i * 2];
  const finish = progressEvents[(i * 2) + 1];
  assert.equal(start.event, "reviewer_started");
  assert.equal(finish.event, "reviewer_finished");
  assert.equal(start.role_key, plan.reviewer_assignments[i].role_key);
  assert.equal(finish.role_key, plan.reviewer_assignments[i].role_key);
  assert.equal(typeof finish.seconds, "number");
}

const notEnough = reconcileReviewBatch({
  reviews: [
    { source: "skipped-a", status: "skipped", findings: [] },
    { source: "skipped-b", status: "skipped", findings: [{ kind: "disagreement", disposition: "new", claim: "should not count" }] },
    executed,
  ],
  harnesses: [{ name: "test", status: "passed" }],
  minReviewsForPush: 2,
  requireDisagreement: false,
});
assert.equal(notEnough.counts.reviews, 1);
assert.equal(notEnough.counts.skipped_reviews, 2);
assert.equal(notEnough.state_transition, "ready-for-review");

console.log("MODEL_REVIEW_RUNNER_TESTS_OK");
