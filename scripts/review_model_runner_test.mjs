import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildModelReviewPackets,
  executeReviewerModelReview,
  getModelExecutionProfile,
  isLocalOllamaModelName,
  isReviewUsableLocalOllamaModelName,
  parseReviewerResponseText,
  resolveReviewerExecutionTarget,
  runModelReviewBatch,
  stripReasoningContent,
} from "../lib/review_model_runner.mjs";
import { openaiCompatGenerateText } from "../lib/openai_compat_client.mjs";
import {
  buildReviewCyclePlan,
  reconcileReviewBatch,
} from "../lib/review_cycle_orchestrator.mjs";
import {
  applyReviewerModelRotation,
  diffText,
  isDefaultReviewCandidateExcluded,
  splitReviewCandidateFiles,
} from "./review_model_batch.mjs";

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
assert.equal(getModelExecutionProfile("deepseek-r1:7b").review_usable, true);
assert.equal(isReviewUsableLocalOllamaModelName("deepseek-r1:7b"), true);

// Reasoning tag stripping tests (DeepSeek R1 adapter)
assert.equal(stripReasoningContent("<think>Step 1... Step 2...</think>\nHello world"), "Hello world");
assert.equal(stripReasoningContent("<think>Unclosed thinking block..."), "");
const r1Parsed = parseReviewerResponseText("<think>Analyzing diff...\nThinking done.</think>\n```json\n{\"summary\":\"R1 reasoning passed\",\"findings\":[]}\n```");
assert.equal(r1Parsed.summary, "R1 reasoning passed");
assert.equal(r1Parsed.status, "submitted");
const r1RawJsonParsed = parseReviewerResponseText("<think>Reason privately.</think>\n{\"summary\":\"R1 raw JSON passed\",\"findings\":[]}");
assert.equal(r1RawJsonParsed.summary, "R1 raw JSON passed");
assert.throws(
  () => parseReviewerResponseText("<think>Unclosed reasoning with {\"summary\":\"not final\",\"findings\":[]}"),
  /empty model review response/,
);

const originalFetchForR1Adapter = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: "", reasoning_content: "{\"summary\":\"Reasoning content fallback\",\"findings\":[]}" } }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  const reasoningFallbackText = await openaiCompatGenerateText({
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "deepseek-r1:7b",
    messages: [{ role: "user", content: "return final json" }],
    timeoutMs: 1000,
    maxTokens: 80,
  });
  assert.equal(reasoningFallbackText, "{\"summary\":\"Reasoning content fallback\",\"findings\":[]}");

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: [{ text: "Array " }, { text: "content" }], reasoning_content: "ignored" } }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  const arrayContentText = await openaiCompatGenerateText({
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "gemma3:4b",
    messages: [{ role: "user", content: "return content array" }],
    timeoutMs: 1000,
    maxTokens: 80,
  });
  assert.equal(arrayContentText, "Array content");
} finally {
  globalThis.fetch = originalFetchForR1Adapter;
}
const originalFetchForIsolationGuard = globalThis.fetch;
let isolationFetchCalled = false;
try {
  globalThis.fetch = async () => {
    isolationFetchCalled = true;
    throw new Error("remote fetch must not be attempted under local isolation");
  };
  await assert.rejects(
    () => openaiCompatGenerateText({
      baseUrl: "https://example.com/v1",
      model: "remote-model",
      messages: [{ role: "user", content: "private prompt" }],
      isLocalIsolationRequired: true,
    }),
    (err) => err?.code === "LOCAL_ISOLATION_REMOTE_ENDPOINT_DISALLOWED"
      && err?.blocked_reason === "local_offline_cloud_blocked",
  );
  assert.equal(isolationFetchCalled, false);
} finally {
  globalThis.fetch = originalFetchForIsolationGuard;
}
assert.equal(isReviewUsableLocalOllamaModelName("gemma3:4b"), true);
assert.equal(getModelExecutionProfile("llama-3.1-8b-instant").json_reliability, "high");
assert.equal(isDefaultReviewCandidateExcluded("reviews/retrieval_eval_latest.json"), true);
assert.equal(isDefaultReviewCandidateExcluded("reviews/gemma4_review.md"), false);
assert.deepEqual(splitReviewCandidateFiles([
  "lib/review_model_runner.mjs",
  "reviews/retrieval_eval_latest.json",
  "runtime/local_fast_final_latest.json",
]).changedFiles, ["lib/review_model_runner.mjs"]);
assert.deepEqual(splitReviewCandidateFiles([
  "lib/review_model_runner.mjs",
  "reviews/retrieval_eval_latest.json",
], { includeGeneratedEvidence: true }).changedFiles, [
  "lib/review_model_runner.mjs",
  "reviews/retrieval_eval_latest.json",
]);
assert.equal(diffText({ changedFiles: [], useWorktree: true }), "");
const rotatedPlan = applyReviewerModelRotation(plan, ["llama-3.1-8b-instant", "qwen/qwen3.6-27b"]);
assert.equal(rotatedPlan.reviewer_assignments[0].primary_model, "llama-3.1-8b-instant");
assert.equal(rotatedPlan.reviewer_assignments[1].primary_model, "qwen/qwen3.6-27b");
assert.equal(rotatedPlan.reviewer_assignments[2].primary_model, "llama-3.1-8b-instant");
assert.equal(rotatedPlan.reviewer_assignments[0].provider_model_override, true);

const r1Target = resolveReviewerExecutionTarget(
  { role_key: "chain_of_thought_critic", primary_model: "deepseek-r1", lens: "reasoning" },
  { preferLocalFallbacks: true },
);
assert.equal(r1Target.executable, true);
assert.equal(r1Target.model, "deepseek-r1:7b");
assert.equal(r1Target.selected_reason, "local_free_fallback");

const localFallbackPacket = buildModelReviewPackets(plan, {
  diffText: "diff",
  preferLocalFallbacks: true,
}).find((packet) => packet.reviewer.role_key === "systems_architect");
assert.equal(localFallbackPacket.target.executable, true);
assert.equal(localFallbackPacket.target.model, "gemma3:4b");
assert.equal(localFallbackPacket.target.original_model, "claude-3-7-sonnet");
assert.equal(localFallbackPacket.target.selected_reason, "local_free_fallback");
assert.equal(localFallbackPacket.target.model_profile.review_usable, true);

const localFastPacket = buildModelReviewPackets(plan, {
  diffText: "diff",
  preferLocalFallbacks: true,
  reviewProfile: "local_fast",
  maxFindings: 2,
}).find((packet) => packet.reviewer.role_key === "systems_architect");
assert.equal(localFastPacket.review_profile, "local_fast");
assert.match(localFastPacket.system_prompt, /Local-fast profile/);
assert.match(localFastPacket.system_prompt, /at most 2 total findings/);
const groqFastPacket = buildModelReviewPackets(rotatedPlan, {
  diffText: "diff",
  allowCloud: true,
  trustZone: "trusted_collaborator",
  cloudProvider: "groq",
  cloudApiKey: "test-key",
  allowProviderEnv: false,
  reviewProfile: "groq_fast",
  maxFindings: 2,
}).find((packet) => packet.reviewer.role_key === "systems_architect");
assert.equal(groqFastPacket.review_profile, "groq_fast");
assert.match(groqFastPacket.system_prompt, /Groq-fast profile/);

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

const localFastExecuted = await executeReviewerModelReview({
  plan,
  reviewer: { role_key: "gemma3_local", primary_model: "gemma3:4b", lens: "local" },
  diffText: "diff",
  reviewProfile: "local_fast",
  generateText: async ({ responseFormat }) => {
    assert.deepEqual(responseFormat, { type: "json_object" });
    return JSON.stringify({ summary: "JSON mode honored.", findings: [], disagreements: [] });
  },
});
assert.equal(localFastExecuted.status, "submitted");

const groqTarget = resolveReviewerExecutionTarget(
  { role_key: "gemma3_local", primary_model: "llama-3.1-8b-instant", lens: "fast cloud sanity" },
  { allowCloud: true, trustZone: "trusted_collaborator", cloudProvider: "groq", cloudApiKey: "test-key" },
);
assert.equal(groqTarget.executable, true);
assert.equal(groqTarget.baseUrl, "https://api.groq.com/openai/v1");
assert.equal(groqTarget.model, "llama-3.1-8b-instant");
assert.equal(groqTarget.selected_reason, "groq_cloud_provider");
assert.equal(groqTarget.model_profile.expected_latency_band, "groq_fast");

const privateSelfCloudTarget = resolveReviewerExecutionTarget(
  { role_key: "gemma3_local", primary_model: "llama-3.1-8b-instant", lens: "private cloud must fail" },
  { allowCloud: true, trustZone: "private_self", cloudProvider: "groq", cloudApiKey: "test-key" },
);
assert.equal(privateSelfCloudTarget.executable, false);
assert.equal(privateSelfCloudTarget.skipped_reason, "private_zone_cloud_disallowed");

const privateSelfCloudSkipped = await executeReviewerModelReview({
  plan,
  reviewer: { role_key: "gemma3_local", primary_model: "llama-3.1-8b-instant", lens: "private cloud must fail" },
  diffText: "diff",
  allowCloud: true,
  trustZone: "private_self",
  cloudProvider: "groq",
  cloudApiKey: "test-key",
  generateText: async () => {
    throw new Error("private_self remote reviewer dispatch must not execute");
  },
});
assert.equal(privateSelfCloudSkipped.status, "skipped");
assert.equal(privateSelfCloudSkipped.skipped_reason, "private_zone_cloud_disallowed");

const groqMissingKeyTarget = resolveReviewerExecutionTarget(
  { role_key: "gemma3_local", primary_model: "llama-3.1-8b-instant", lens: "fast cloud sanity" },
  { allowCloud: true, trustZone: "trusted_collaborator", cloudProvider: "groq", allowProviderEnv: false },
);
assert.equal(groqMissingKeyTarget.executable, false);
assert.equal(groqMissingKeyTarget.skipped_reason, "openai_compat_api_key_missing");

const groqQwenTarget = resolveReviewerExecutionTarget(
  { role_key: "qwen_local", primary_model: "qwen/qwen3.6-27b", lens: "provider slug preservation" },
  { allowCloud: true, trustZone: "trusted_collaborator", cloudProvider: "groq", cloudApiKey: "test-key" },
);
assert.equal(groqQwenTarget.model, "qwen/qwen3.6-27b");

const groqExecuted = await executeReviewerModelReview({
  plan,
  reviewer: { role_key: "gemma3_local", primary_model: "llama-3.1-8b-instant", lens: "fast cloud sanity" },
  diffText: "diff",
  allowCloud: true,
  trustZone: "trusted_collaborator",
  cloudProvider: "groq",
  cloudApiKey: "test-key",
  reviewProfile: "groq_fast",
  generateText: async ({ baseUrl, apiKey, model, responseFormat, isLocalIsolationRequired }) => {
    assert.equal(baseUrl, "https://api.groq.com/openai/v1");
    assert.equal(apiKey, "test-key");
    assert.equal(model, "llama-3.1-8b-instant");
    assert.deepEqual(responseFormat, { type: "json_object" });
    assert.equal(isLocalIsolationRequired, false);
    return JSON.stringify({ summary: "Groq lane honored.", findings: [], disagreements: [] });
  },
});
assert.equal(groqExecuted.status, "submitted");

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
  trustZone: "trusted_collaborator",
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

const partialDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy_review_partial_"));
const partialPath = path.join(partialDir, "partial.json");
const localOnlyPlan = {
  ...plan,
  reviewer_assignments: [
    { role_key: "gemma3_local", primary_model: "gemma3:4b", lens: "local" },
    { role_key: "qwen_local", primary_model: "qwen2.5-coder:7b", lens: "implementation" },
  ],
};
let partialCalls = 0;
const partialBatch = await runModelReviewBatch({
  plan: localOnlyPlan,
  diffText: "diff",
  executeModels: true,
  partialOutPath: partialPath,
  generateText: async () => {
    partialCalls++;
    if (partialCalls === 2) {
      const partialReceipt = JSON.parse(fs.readFileSync(partialPath, "utf8"));
      assert.equal(partialReceipt.completion_status, "partial");
      assert.equal(partialReceipt.completed_reviews, 1);
      assert.equal(partialReceipt.reviews.length, 1);
    }
    return "{\"summary\":\"ok\",\"findings\":[],\"disagreements\":[]}";
  },
});
assert.equal(partialBatch.completion_status, "completed");
assert.equal(partialBatch.completed_reviews, 2);
assert.equal(JSON.parse(fs.readFileSync(partialPath, "utf8")).completion_status, "completed");

let resumedCalls = 0;
const resumedBatch = await runModelReviewBatch({
  plan: localOnlyPlan,
  diffText: "diff",
  executeModels: true,
  resumeReviews: [partialBatch.reviews[0]],
  generateText: async () => {
    resumedCalls++;
    return "{\"summary\":\"ok\",\"findings\":[],\"disagreements\":[]}";
  },
});
assert.equal(resumedBatch.resumed_review_count, 1);
assert.equal(resumedBatch.completion_status, "completed");
assert.equal(resumedBatch.completed_reviews, 2);
assert.equal(resumedCalls, 1);
fs.rmSync(partialDir, { recursive: true, force: true });

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
