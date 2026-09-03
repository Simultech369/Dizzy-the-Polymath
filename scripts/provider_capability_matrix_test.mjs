import assert from "node:assert/strict";
import {
  PROVIDER_CAPABILITY_MATRIX_SCHEMA,
  PROVIDER_CAPABILITY_PROFILES,
  buildProviderCapabilityMatrixReceipt,
  getProviderCapabilityProfile,
} from "../lib/provider_capability_matrix.mjs";
import {
  OPENROUTER_FREE_PROBES,
  probeOpenRouterSlug,
} from "./openrouter_free_slug_probe.mjs";

console.log("=== W-0068 Provider Capability Matrix & OpenRouter Probe Test Suite ===");

// 1. Verify Schema Version
assert.equal(PROVIDER_CAPABILITY_MATRIX_SCHEMA, "dizzy.provider_capability_matrix.v1");

// 2. Verify Profiles for key models
const gemmaProfile = getProviderCapabilityProfile("gemma3:4b", new Set(["gemma3:4b"]));
assert.equal(PROVIDER_CAPABILITY_PROFILES["gemma3:4b"].installed, false);
assert.equal(gemmaProfile.provider, "ollama");
assert.equal(gemmaProfile.installed, true);
assert.equal(gemmaProfile.json_review_usable, true);
assert.equal(gemmaProfile.provider_boundary, "private_self");

const groqProfile = getProviderCapabilityProfile("llama-3.1-8b-instant");
assert.equal(groqProfile.provider, "groq");
assert.equal(groqProfile.installed, false);
assert.equal(groqProfile.json_review_usable, true);
assert.equal(groqProfile.provider_boundary, "trusted_collaborator");

const openrouterProfile = getProviderCapabilityProfile("nvidia/llama-3.1-nemotron-70b-instruct:free");
assert.equal(openrouterProfile.provider, "openrouter");
assert.equal(openrouterProfile.provider_boundary, "public_free");
assert.equal(openrouterProfile.callable, false);
assert.equal(openrouterProfile.json_review_usable, false);
assert.equal(openrouterProfile.availability_status, "unproven_requires_probe");

const openrouterAvailableProfile = getProviderCapabilityProfile(
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  new Set(),
  { model: "nvidia/llama-3.1-nemotron-70b-instruct:free", status: "available", runnable: true, json_usable: true },
);
assert.equal(openrouterAvailableProfile.callable, true);
assert.equal(openrouterAvailableProfile.json_review_usable, true);

const qwenOpenRouterProfile = getProviderCapabilityProfile("qwen/qwen-2.5-coder-32b-instruct:free");
assert.equal(qwenOpenRouterProfile.provider, "openrouter");
assert.equal(qwenOpenRouterProfile.callable, false);

const cerebrasProfile = getProviderCapabilityProfile("cerebras/qwen-2.5-coder-32b");
assert.equal(cerebrasProfile.provider, "cerebras");
assert.equal(cerebrasProfile.expected_latency_band, "cerebras_ultra_fast");
assert.equal(cerebrasProfile.callable, false);
assert.equal(cerebrasProfile.json_review_usable, false);

const museProfile = getProviderCapabilityProfile("muse-glimmer:latest");
assert.equal(museProfile.installed, false);
assert.equal(museProfile.callable, false);
assert.equal(museProfile.json_review_usable, false);
assert.equal(museProfile.availability_status, "unverified_candidate");

const museInstalledProfile = getProviderCapabilityProfile("muse-glimmer:latest", new Set(["muse-glimmer:latest"]));
assert.equal(museInstalledProfile.installed, true);
assert.equal(museInstalledProfile.callable, true);
assert.equal(museInstalledProfile.json_review_usable, false);

const museAvailableProfile = getProviderCapabilityProfile(
  "muse-glimmer:latest",
  new Set(),
  { model: "muse-glimmer:latest", status: "available", runnable: true, json_usable: true },
);
assert.equal(museAvailableProfile.callable, true);
assert.equal(museAvailableProfile.json_review_usable, true);

const unverifiedCandidates = Object.values(PROVIDER_CAPABILITY_PROFILES)
  .filter((p) => p.availability_status === "unverified_candidate");
assert.ok(unverifiedCandidates.length >= 10, "Expected at least 10 unverified candidate profiles");
for (const candidate of unverifiedCandidates) {
  assert.equal(candidate.callable, false, `Candidate ${candidate.model_id} must not be callable by default`);
  assert.equal(candidate.json_review_usable, false, `Candidate ${candidate.model_id} must not be review-usable by default`);
}

// 3. Verify Receipt Generation
const receipt = buildProviderCapabilityMatrixReceipt({
  installedModels: ["gemma3:4b", "deepseek-r1:7b"],
  testedModels: ["llama-3.1-8b-instant"],
});

assert.equal(receipt.schema_version, "dizzy.provider_capability_matrix.v1");
assert.equal(receipt.authority, "capability_matrix_evidence_not_authority");
assert.ok(receipt.model_count >= 14);
const gemmaReceiptEntry = receipt.profiles.find((p) => p.model_id === "gemma3:4b");
assert.equal(gemmaReceiptEntry.installed, true);
const openrouterReceipt = buildProviderCapabilityMatrixReceipt({
  availabilityResults: [{
    model: "liquid/lqc-3b-v0.1:free",
    status: "content_parse_warning",
    runnable: true,
    json_usable: false,
  }],
});
const liquidReceiptEntry = openrouterReceipt.profiles.find((p) => p.model_id === "liquid/lqc-3b-v0.1:free");
assert.equal(liquidReceiptEntry.callable, true);
assert.equal(liquidReceiptEntry.json_review_usable, false);

// 4. Verify OpenRouter Missing Key Behavior (Offline Safety)
const openrouterMissingKeyResult = await probeOpenRouterSlug({
  model: "nvidia/llama-3.1-nemotron-70b-instruct:free",
  apiKey: "",
});
assert.equal(openrouterMissingKeyResult.status, "skipped_missing_key");
assert.equal(openrouterMissingKeyResult.runnable, false);
assert.equal(openrouterMissingKeyResult.parse_result, "not_run");
assert.equal(openrouterMissingKeyResult.error_class, "missing_key");

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: "```json\n{\"status\":\"ok\"}\n```" } }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  const openrouterAvailableResult = await probeOpenRouterSlug({
    roleKey: "nemotron_free",
    model: "nvidia/llama-3.1-nemotron-70b-instruct:free",
    apiKey: "test-key",
    timeoutMs: 1000,
  });
  assert.equal(openrouterAvailableResult.role_key, "nemotron_free");
  assert.equal(openrouterAvailableResult.status, "available");
  assert.equal(openrouterAvailableResult.parse_result, "json_valid");
  assert.equal(openrouterAvailableResult.error_class, "");
} finally {
  globalThis.fetch = originalFetch;
}

assert.ok(OPENROUTER_FREE_PROBES.length >= 5);
for (const probe of OPENROUTER_FREE_PROBES) {
  assert.ok(PROVIDER_CAPABILITY_PROFILES[probe.model], `Missing capability profile for ${probe.model}`);
}

console.log("PROVIDER_CAPABILITY_MATRIX_TESTS_OK");
