import assert from "node:assert/strict";
import {
  classifyOpenAICompatBaseUrl,
  EIGHT_DIVISIONS_ROSTER,
  getAllDivisions,
  getAllRoles,
  getChosenModelString,
  getCouncilSelectionOptions,
  getDivisionForRole,
  getModelRoute,
  normalizeOpenAICompatModelForBaseUrl,
  normalizeCouncilSelection,
  resolveCouncilSelection,
  resolveDivisionModelRoute,
  resolveOpenAICompatTimeoutMs,
} from "../lib/model_router.mjs";

console.log("=== W-0066 Model Router Test Suite ===");

function withEnv(updates, fn) {
  const previous = {};
  for (const key of Object.keys(updates)) {
    previous[key] = process.env[key];
    const value = updates[key];
    if (value === undefined || value === null) delete process.env[key];
    else process.env[key] = String(value);
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const divisions = getAllDivisions();
assert.strictEqual(Object.keys(divisions).length, 8, "Router roster must expose 8 divisions");
assert.strictEqual(divisions, EIGHT_DIVISIONS_ROSTER, "getAllDivisions must return the canonical roster");

const roles = getAllRoles();
assert.strictEqual(Object.keys(roles).length, 40, "Router roster currently contains 40 roles");

const r1 = resolveDivisionModelRoute("liquid_dynamics_critic");
assert.strictEqual(r1.ok, true);
assert.strictEqual(r1.division_key, "DIV_I");
assert.strictEqual(r1.primary_model, "liquid-ai/lfm-40b");

const r2 = resolveDivisionModelRoute("program_synthesis_specialist");
assert.strictEqual(r2.division_key, "DIV_II");
assert.strictEqual(r2.primary_model, "poolside/laguna");

const r3 = resolveDivisionModelRoute("adversarial_critic");
assert.strictEqual(r3.division_key, "DIV_III");
assert.strictEqual(r3.primary_model, "x-ai/grok-2");

const r4 = resolveDivisionModelRoute("chain_of_thought_critic");
assert.strictEqual(r4.division_key, "DIV_IV");
assert.strictEqual(r4.primary_model, "deepseek-r1");

const r5 = resolveDivisionModelRoute("systems_architect");
assert.strictEqual(r5.division_key, "DIV_VI");
assert.strictEqual(r5.primary_model, "claude-3-7-sonnet");

const r6 = resolveDivisionModelRoute("gemma3_local");
assert.strictEqual(r6.division_key, "DIV_VII");
assert.strictEqual(r6.primary_model, "gemma3:4b");

const r7 = resolveDivisionModelRoute("git_diff_engine");
assert.strictEqual(r7.division_key, "DIV_VIII");
assert.strictEqual(r7.primary_model, "aider");

assert.strictEqual(getDivisionForRole("unknown_router_role"), null);
const fallbackRoute = resolveDivisionModelRoute("unknown_router_role");
assert.strictEqual(fallbackRoute.ok, false);
assert.strictEqual(fallbackRoute.primary_model, "gemma3:4b");

withEnv({ DIZZY_CHAT_BACKEND: "local", OLLAMA_MODEL: "qwen2.5-coder:7b" }, () => {
  const chatRoute = getModelRoute("chat");
  assert.strictEqual(chatRoute.backend, "openai_compat");
  assert.strictEqual(chatRoute.reason, "local_backend_mapped_to_ollama");
  assert.strictEqual(getChosenModelString("chat"), "openai_compat:qwen2.5-coder:7b");
});

withEnv({
  DIZZY_CHAT_BACKEND: "openai_compat",
  OPENAI_COMPAT_BASE_URL: "https://compat.example.test/v1",
  OPENAI_COMPAT_MODEL: "qwen/qwen3-32b",
}, () => {
  const chatRoute = getModelRoute("chat");
  assert.strictEqual(chatRoute.backend, "openai_compat");
  assert.strictEqual(getChosenModelString("chat"), "openai_compat:qwen/qwen-2.5-coder-32b-instruct");
});

assert.deepStrictEqual(
  classifyOpenAICompatBaseUrl("https://openrouter.ai/api/v1"),
  { provider: "openrouter", host: "openrouter.ai", isLocalHost: false },
);
assert.strictEqual(
  normalizeOpenAICompatModelForBaseUrl({
    baseUrl: "https://openrouter.ai/api/v1",
    model: "qwen/qwen-2.5-coder-32b-instruct",
  }),
  "openrouter/auto",
);
assert.strictEqual(
  normalizeOpenAICompatModelForBaseUrl({
    baseUrl: "https://api.groq.com/openai/v1",
    model: "qwen/qwen3-32b",
  }),
  "qwen-2.5-coder-32b",
);
assert.strictEqual(
  normalizeOpenAICompatModelForBaseUrl({
    baseUrl: "https://api.groq.com/openai/v1",
    model: "qwen/qwen3.6-27b",
  }),
  "qwen/qwen3.6-27b",
);
assert.strictEqual(
  normalizeOpenAICompatModelForBaseUrl({
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "openrouter/auto",
    localFallbackModel: "gemma3:4b",
  }),
  "gemma3:4b",
);
assert.strictEqual(
  normalizeOpenAICompatModelForBaseUrl({
    baseUrl: "https://compat.example.test/v1",
    model: "qwen3-32b",
  }),
  "qwen/qwen-2.5-coder-32b-instruct",
);

assert.strictEqual(resolveOpenAICompatTimeoutMs({ baseUrl: "https://api.openai.com/v1" }), 20000);
assert.strictEqual(resolveOpenAICompatTimeoutMs({ baseUrl: "http://127.0.0.1:11434/v1" }), 120000);
assert.strictEqual(resolveOpenAICompatTimeoutMs({ baseUrl: "http://127.0.0.1:11434/v1", timeoutMs: 5000 }), 10000);

const selectionOptions = getCouncilSelectionOptions();
assert.ok(selectionOptions.length >= 4, "dashboard selector API should report configured local/open-weight seats");
assert.ok(selectionOptions.filter((option) => option.enabled !== false).length >= 4, "dashboard selector should expose implemented native-chat local seats");
const qwenOption = selectionOptions.find((option) => option.seat_id === "qwen_local");
assert.ok(qwenOption, "qwen local seat should be selectable");
assert.strictEqual(qwenOption.model_id, "qwen2.5-coder:7b");
assert.strictEqual(qwenOption.harness_id, "native_chat");
assert.strictEqual(qwenOption.evidence_state, "configured_unverified");
assert.strictEqual(qwenOption.authority, "operator_requested_not_availability_proof");
const r1Option = selectionOptions.find((option) => option.seat_id === "r1_local");
assert.ok(r1Option, "r1 local seat should remain visible in the configured option evidence");
assert.strictEqual(r1Option.enabled, false);
assert.strictEqual(r1Option.blocked_reason, "reasoning_adapter_required");
const llamaAuditOption = selectionOptions.find((option) => option.seat_id === "llama_audit_local");
assert.ok(llamaAuditOption, "llama audit local seat should be selectable");
assert.strictEqual(llamaAuditOption.model_id, "llama-audit:latest");
assert.strictEqual(llamaAuditOption.enabled, true);

assert.deepStrictEqual(
  normalizeCouncilSelection({ seat: " QWEN_Local ", harness: "" }),
  { seat_id: "qwen_local", model_id: "", harness_id: "native_chat" },
);

withEnv({ OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1" }, () => {
  const resolved = resolveCouncilSelection({ seat_id: "qwen_local", harness_id: "native_chat" });
  assert.strictEqual(resolved.ok, true);
  assert.strictEqual(resolved.backend, "openai_compat");
  assert.strictEqual(resolved.adapter, "ollama");
  assert.strictEqual(resolved.route_id, "ollama:qwen2.5-coder:7b");
  assert.strictEqual(resolved.provider_boundary, "local_machine");
});
withEnv({ OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1" }, () => {
  assert.strictEqual(resolveCouncilSelection({ seat_id: "llama_audit_local" }).route_id, "ollama:llama-audit:latest");
});

assert.strictEqual(resolveCouncilSelection({}).empty, true);
assert.strictEqual(resolveCouncilSelection({ seat_id: "unknown", harness_id: "native_chat" }).reason, "unknown_seat");
assert.strictEqual(resolveCouncilSelection({ seat_id: "qwen_local", model_id: "mistral:latest" }).reason, "seat_model_mismatch");
assert.strictEqual(resolveCouncilSelection({ seat_id: "qwen_local", harness_id: "dizzy_json_review" }).reason, "review_harness_not_wired_to_chat_selection");
assert.strictEqual(resolveCouncilSelection({ seat_id: "r1_local", harness_id: "native_chat" }).reason, "reasoning_adapter_required");

withEnv({ OLLAMA_BASE_URL: "https://compat.example.test/v1" }, () => {
  const resolved = resolveCouncilSelection({ seat_id: "qwen_local" });
  assert.strictEqual(resolved.ok, false);
  assert.strictEqual(resolved.reason, "local_seat_requires_loopback_or_private_lan_ollama");
});

console.log("MODEL_ROUTER_TESTS_OK");
