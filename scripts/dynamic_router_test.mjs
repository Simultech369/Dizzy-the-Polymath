import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {
  computePromptPrefixHash,
  evaluateLocalIsolationPolicy,
  getModelRoute,
  getChosenModelString,
  isLoopbackHost,
  isPrivateLanHost,
  isRemoteCloudBackend
} from "../lib/model_router.mjs";
import { openaiCompatGenerateText } from "../lib/openai_compat_client.mjs";
import { conversationArtifactPath, handleIncomingMessage, isPrivateLanBackendHost } from "../lib/dispatch.mjs";

console.log("=== W-0066 Dynamic Model Router Integration Test Suite ===");

// 0. Disposable OS temp directory for side-effect-free test isolation
const FIXTURE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy_router_test_"));
process.env.DIZZY_CONVERSATION_DIR = FIXTURE_DIR;

// 1. Test computePromptPrefixHash
const sys1 = "You are an AI assistant bound by the Dizzy Constitutional Kernel.";
const hash1 = computePromptPrefixHash(sys1);
assert.equal(typeof hash1, "string");
assert.equal(hash1.length, 16);

const hash2 = computePromptPrefixHash(sys1);
assert.equal(hash1, hash2, "Prefix hash must be deterministic");

const emptyHash = computePromptPrefixHash("");
assert.equal(emptyHash, "none");

// 2. Test Host Classifications & DNS Spoofing Prevention
assert.equal(isLoopbackHost("127.0.0.1"), true);
assert.equal(isLoopbackHost("::1"), true);
assert.equal(isLoopbackHost("[::1]"), true);
assert.equal(isLoopbackHost("localhost"), true);
assert.equal(isLoopbackHost("192.168.1.1"), false);

assert.equal(isPrivateLanHost("10.0.0.1"), true);
assert.equal(isPrivateLanHost("192.168.1.50"), true);
assert.equal(isPrivateLanHost("my-server.local"), false, ".local hostnames without literal IP resolution MUST NOT be classified as private LAN");
assert.equal(isPrivateLanBackendHost("my-server.local"), false, "dispatch LAN wrapper must use the same literal-IP classification");
assert.equal(isPrivateLanHost("fd00::20"), true, "IPv6 ULA (fd00::/7) must be recognized as private LAN");
assert.equal(isPrivateLanHost("fe80::20"), true, "IPv6 Link-Local (fe80::/10) must be recognized as private LAN");

// Security Check: DNS hostnames MUST NOT masquerade as private IP literals
assert.equal(isPrivateLanHost("10.attacker.example"), false, "10.attacker.example MUST NOT be classified as private LAN");
assert.equal(isRemoteCloudBackend("openai_compat", "http://10.attacker.example/v1"), true, "10.attacker.example MUST be classified as remote cloud");

assert.equal(isRemoteCloudBackend("openai_compat", "http://127.0.0.1:11434/v1"), false);
assert.equal(isRemoteCloudBackend("openai_compat", "http://[fd00::20]:11434/v1"), false);
assert.equal(isRemoteCloudBackend("openai_compat", "https://api.openai.com/v1"), true);
assert.equal(isRemoteCloudBackend("gemini", ""), true);

// 3. Test evaluateLocalIsolationPolicy
const localPolicy = evaluateLocalIsolationPolicy({ trustZone: "private_self", dataBoundary: "internal_only", isLocalBackend: true });
assert.equal(localPolicy.isLocalIsolationRequired, true);
assert.equal(localPolicy.allowCloudFallback, false);
assert.equal(localPolicy.blockedReason, "local_offline_cloud_blocked");

const lanPolicy = evaluateLocalIsolationPolicy({ trustZone: "trusted_collaborator", dataBoundary: "private_lan", isLocalBackend: false });
assert.equal(lanPolicy.isLocalIsolationRequired, true, "private_lan boundary must enforce local isolation");

const publicPolicy = evaluateLocalIsolationPolicy({ trustZone: "paid_public", dataBoundary: "filtered_carryover", isLocalBackend: false });
assert.equal(publicPolicy.isLocalIsolationRequired, false);
assert.equal(publicPolicy.allowCloudFallback, true);
assert.equal(publicPolicy.blockedReason, "");

// 4. Test getModelRoute when local backend is set
process.env.DIZZY_CHAT_BACKEND = "local";
const localRoute = getModelRoute("chat");
assert.equal(localRoute.backend, "openai_compat");
assert.equal(localRoute.reason, "local_backend_mapped_to_ollama");

const localChosen = getChosenModelString("chat");
assert.ok(localChosen.startsWith("openai_compat:"), "Chosen model must map to openai_compat when local");

delete process.env.DIZZY_CHAT_BACKEND;

// 5. Integration Test Suite
async function runIntegrationTests() {
  try {
    async function withMockOpenAICompat(content, fn) {
      const server = http.createServer((req, res) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content } }] }));
      });
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      const port = server.address().port;
      try {
        process.env.DIZZY_CHAT_BACKEND = "openai_compat";
        process.env.OPENAI_COMPAT_BASE_URL = `http://127.0.0.1:${port}/v1`;
        process.env.OPENAI_COMPAT_MODEL = "qwen2.5-coder:7b";
        process.env.OPENAI_COMPAT_API_KEY = "local_nop";
        await fn();
      } finally {
        await new Promise((r) => server.close(r));
        delete process.env.DIZZY_CHAT_BACKEND;
        delete process.env.OPENAI_COMPAT_BASE_URL;
        delete process.env.OPENAI_COMPAT_MODEL;
        delete process.env.OPENAI_COMPAT_API_KEY;
      }
    }

    function seedConversationHistory(conversationKey = "cli") {
      const convoFile = conversationArtifactPath(FIXTURE_DIR, conversationKey, ".jsonl");
      fs.writeFileSync(convoFile, JSON.stringify({ t: new Date().toISOString(), role: "user", text: "Hello test history for improve command" }) + "\n", "utf8");
      return convoFile;
    }

    // Test Case A: Offline Local Backend
    process.env.DIZZY_CHAT_BACKEND = "local";
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:59999/v1"; // Mock offline port
    delete process.env.GEMINI_API_KEY;

    const msgA = {
      text: "Hello local model integration test",
      runtime_context: { trust_zone: "private_self", trusted_local: true },
      channel: "cli",
      sensitivity_class: "internal_only"
    };

    const resA = await handleIncomingMessage({ message: msgA });
    assert.equal(resA.kind, "reply");
    assert.ok(resA.execution_metadata, "Execution metadata must be attached");

    const metaA = resA.execution_metadata;
    assert.equal(metaA.chosen_model, "none:local_backend_unavailable");
    assert.equal(metaA.fallback.used, false);
    assert.equal(metaA.fallback.blocked_reason, "local_offline_cloud_blocked");
    assert.equal(metaA.reason, "no_model_execution:local_offline_cloud_blocked");

    process.env.OLLAMA_BASE_URL = "http://my-server.local:11434/v1";
    process.env.DIZZY_ALLOW_LAN_LOCAL_BACKEND = "1";
    const localDotLocalRes = await handleIncomingMessage({
      message: {
        text: "Hello dot-local local backend config test",
        runtime_context: { trust_zone: "private_self", trusted_local: true },
        channel: "cli",
        sensitivity_class: "internal_only"
      }
    });
    assert.ok(localDotLocalRes.execution_metadata);
    assert.equal(localDotLocalRes.execution_metadata.fallback.blocked_reason, "security_exception_non_private_lan");
    assert.equal(localDotLocalRes.text.includes(".local endpoints"), false, "operator text must not promise .local LAN support");
    delete process.env.DIZZY_ALLOW_LAN_LOCAL_BACKEND;
    delete process.env.OLLAMA_BASE_URL;

    let outboundFetchCalls = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (...args) => {
      outboundFetchCalls++;
      return realFetch(...args);
    };

    // Test Case B: Cloud Pre-Blocking for Private-Self Requests
    process.env.DIZZY_CHAT_BACKEND = "openai_compat";
    process.env.OPENAI_COMPAT_BASE_URL = "https://api.openai.com/v1";
    process.env.OPENAI_COMPAT_MODEL = "gpt-4o";
    process.env.OPENAI_COMPAT_API_KEY = "sk-fake-test-key-do-not-call";

    const msgB = {
      text: "Hello private self cloud test",
      runtime_context: { trust_zone: "private_self", trusted_local: true },
      channel: "cli",
      sensitivity_class: "internal_only"
    };

    const resB = await handleIncomingMessage({ message: msgB });
    const metaB = resB.execution_metadata;
    assert.equal(metaB.chosen_model, "none:cloud_disallowed_for_private_zone");
    assert.equal(metaB.fallback.used, false);
    assert.equal(metaB.fallback.blocked_reason, "private_zone_cloud_disallowed");
    assert.equal(metaB.reason, "no_model_execution:private_zone_cloud_disallowed");
    assert.equal(metaB.latency_ms, 0);
    assert.equal(outboundFetchCalls, 0, "Private-self cloud request must trigger ZERO fetch calls");

    // Test Case C: Trusted Collaborator + internal_only / private_lan Pre-Blocking
    for (const boundary of ["internal_only", "private_lan"]) {
      const msgC = {
        text: `Hello ${boundary} boundary test`,
        runtime_context: { trust_zone: "trusted_collaborator", data_boundary: boundary },
        channel: "cli",
        sensitivity_class: boundary === "internal_only" ? "internal_only" : ""
      };

      const resC = await handleIncomingMessage({ message: msgC });
      const metaC = resC.execution_metadata;
      assert.equal(metaC.chosen_model, "none:cloud_disallowed_for_private_zone");
      assert.equal(metaC.fallback.used, false);
      assert.equal(metaC.fallback.blocked_reason, "private_zone_cloud_disallowed");
      assert.equal(metaC.reason, "no_model_execution:private_zone_cloud_disallowed");
      assert.equal(outboundFetchCalls, 0, `${boundary} pre-block must trigger ZERO fetch calls`);
    }

    globalThis.fetch = realFetch;

    delete process.env.DIZZY_CHAT_BACKEND;
    delete process.env.OPENAI_COMPAT_BASE_URL;
    delete process.env.OPENAI_COMPAT_MODEL;
    delete process.env.OPENAI_COMPAT_API_KEY;

    const unsetBackendRes = await handleIncomingMessage({
      message: {
        text: "Hello unset backend receipt test",
        runtime_context: { trust_zone: "paid_public" },
        channel: "cli",
      }
    });
    assert.ok(unsetBackendRes.execution_metadata, "Unset backend must emit missing-config execution metadata");
    assert.equal(unsetBackendRes.execution_metadata.chosen_model, "none:chat_backend_not_configured");
    assert.equal(unsetBackendRes.execution_metadata.fallback.blocked_reason, "chat_backend_not_configured");
    assert.equal(unsetBackendRes.execution_metadata.reason, "no_model_execution:chat_backend_not_configured");

    // Test Case D: Cross-Origin Redirect Prevention across 301, 302, 303, 307, 308
    for (const redirectCode of [301, 302, 303, 307, 308]) {
      let redirectHits = 0;
      let trapHits = 0;

      const trapServer = http.createServer((req, res) => {
        trapHits++;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: "Pawned!" } }] }));
      });
      await new Promise((r) => trapServer.listen(0, "127.0.0.1", r));
      const trapPort = trapServer.address().port;

      const redirectServer = http.createServer((req, res) => {
        redirectHits++;
        res.writeHead(redirectCode, { Location: `http://127.0.0.1:${trapPort}/v1/chat/completions` });
        res.end();
      });
      await new Promise((r) => redirectServer.listen(0, "127.0.0.1", r));
      const redirectPort = redirectServer.address().port;

      process.env.DIZZY_CHAT_BACKEND = "openai_compat";
      process.env.OPENAI_COMPAT_BASE_URL = `http://127.0.0.1:${redirectPort}/v1`;
      process.env.OPENAI_COMPAT_MODEL = "mock-local-model";
      process.env.OPENAI_COMPAT_API_KEY = "local_nop";

      const redirectMsg = {
        text: "Hello redirect isolation test",
        runtime_context: { trust_zone: "private_self", trusted_local: true },
        channel: "cli",
        sensitivity_class: "internal_only"
      };

      const redirectRes = await handleIncomingMessage({ message: redirectMsg });
      redirectServer.close();
      trapServer.close();

      assert.equal(redirectHits, 1, `Redirect server should be hit once for status ${redirectCode}`);
      assert.equal(trapHits, 0, `Trap server MUST receive ZERO requests for status ${redirectCode}`);
      assert.equal(redirectRes.execution_metadata.fallback.blocked_reason, "redirect_to_cloud_disallowed");

      delete process.env.DIZZY_CHAT_BACKEND;
      delete process.env.OPENAI_COMPAT_BASE_URL;
      delete process.env.OPENAI_COMPAT_MODEL;
      delete process.env.OPENAI_COMPAT_API_KEY;
    }

    let sameOriginInitialHits = 0;
    let sameOriginSecondHits = 0;
    const sameOriginServer = http.createServer((req, res) => {
      if (req.url === "/v1/chat/completions") {
        sameOriginInitialHits++;
        res.writeHead(307, { Location: "/v1/redirected-chat/completions" });
        res.end();
        return;
      }
      sameOriginSecondHits++;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "redirect followed" } }] }));
    });
    await new Promise((r) => sameOriginServer.listen(0, "127.0.0.1", r));
    const sameOriginPort = sameOriginServer.address().port;
    try {
      await assert.rejects(
        () => openaiCompatGenerateText({
          baseUrl: `http://127.0.0.1:${sameOriginPort}/v1`,
          apiKey: "local_nop",
          model: "mock-local-model",
          systemPrompt: "redirect body/auth replay test",
          messages: [{ role: "user", text: "PROMPT_BODY_SENTINEL" }],
          isLocalIsolationRequired: false,
        }),
        (err) => err?.blocked_reason === "redirect_to_cloud_disallowed",
      );
      assert.equal(sameOriginInitialHits, 1, "Same-origin redirect source should receive the initial request once");
      assert.equal(sameOriginSecondHits, 0, "Same-origin redirect target must not receive replayed body/auth");
    } finally {
      await new Promise((r) => sameOriginServer.close(r));
    }

    // Test Case D2: Paused fallback branches must emit exact no-execution receipts.
    async function withGeminiFailureFetch(fn) {
      const realFetchForGemini = globalThis.fetch;
      const fetchUrls = [];
      globalThis.fetch = async (...args) => {
        const requestUrl = String(args[0]);
        fetchUrls.push(requestUrl);
        if (requestUrl.includes("generativelanguage.googleapis.com")) {
          return new Response("temporary Gemini outage", { status: 500 });
        }
        throw new Error(`Unexpected fallback/provider fetch: ${requestUrl}`);
      };
      try {
        await fn(fetchUrls);
      } finally {
        globalThis.fetch = realFetchForGemini;
      }
    }

    function seedFallbackUsage(conversationKey) {
      const usageDir = path.join(FIXTURE_DIR, "fallback_usage");
      fs.mkdirSync(usageDir, { recursive: true });
      const usagePath = conversationArtifactPath(usageDir, conversationKey, ".jsonl");
      fs.writeFileSync(usagePath, JSON.stringify({ t: new Date().toISOString(), kind: "chat_fallback" }) + "\n", "utf8");
      return usageDir;
    }

    await withGeminiFailureFetch(async (fetchUrls) => {
      const oldFallbackUsageDir = process.env.DIZZY_FALLBACK_USAGE_DIR;
      const oldFallbackBackend = process.env.DIZZY_CHAT_FALLBACK_BACKEND;
      const oldGlobalLimit = process.env.DIZZY_FALLBACK_MAX_CALLS_PER_HOUR;
      const oldConversationLimit = process.env.DIZZY_FALLBACK_MAX_CALLS_PER_CONVERSATION_HOUR;
      try {
        process.env.DIZZY_CHAT_BACKEND = "gemini";
        process.env.GEMINI_API_KEY = "fake-gemini-key";
        process.env.GEMINI_MODEL = "gemini-1.5-flash";
        process.env.DIZZY_CHAT_FALLBACK_BACKEND = "openai_compat";
        process.env.OPENAI_COMPAT_BASE_URL = "https://api.openai.com/v1";
        process.env.OPENAI_COMPAT_MODEL = "gpt-4o";
        process.env.OPENAI_COMPAT_API_KEY = "sk-fake-fallback-key-do-not-call";
        process.env.DIZZY_FALLBACK_USAGE_DIR = seedFallbackUsage("all_fallbacks_global");
        process.env.DIZZY_FALLBACK_MAX_CALLS_PER_HOUR = "1";
        delete process.env.DIZZY_FALLBACK_MAX_CALLS_PER_CONVERSATION_HOUR;

        const globalPaused = await handleIncomingMessage({
          message: {
            text: "Trigger Gemini fallback global pause",
            runtime_context: { trust_zone: "paid_public" },
            channel: "cli",
          }
        });
        assert.equal(globalPaused.execution_metadata.chosen_model, "none:fallback_paused_global_limit");
        assert.equal(globalPaused.execution_metadata.reason, "no_model_execution:fallback_paused_global_limit");
        assert.equal(globalPaused.execution_metadata.fallback.blocked_reason, "fallback_paused_global_limit");
        assert.ok(fetchUrls.every((url) => url.includes("generativelanguage.googleapis.com")), "Paused fallback must not call OpenAI-compatible backend");
      } finally {
        if (oldFallbackUsageDir !== undefined) process.env.DIZZY_FALLBACK_USAGE_DIR = oldFallbackUsageDir;
        else delete process.env.DIZZY_FALLBACK_USAGE_DIR;
        if (oldFallbackBackend !== undefined) process.env.DIZZY_CHAT_FALLBACK_BACKEND = oldFallbackBackend;
        else delete process.env.DIZZY_CHAT_FALLBACK_BACKEND;
        if (oldGlobalLimit !== undefined) process.env.DIZZY_FALLBACK_MAX_CALLS_PER_HOUR = oldGlobalLimit;
        else delete process.env.DIZZY_FALLBACK_MAX_CALLS_PER_HOUR;
        if (oldConversationLimit !== undefined) process.env.DIZZY_FALLBACK_MAX_CALLS_PER_CONVERSATION_HOUR = oldConversationLimit;
        else delete process.env.DIZZY_FALLBACK_MAX_CALLS_PER_CONVERSATION_HOUR;
        delete process.env.DIZZY_CHAT_BACKEND;
        delete process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_MODEL;
        delete process.env.OPENAI_COMPAT_BASE_URL;
        delete process.env.OPENAI_COMPAT_MODEL;
        delete process.env.OPENAI_COMPAT_API_KEY;
      }
    });

    await withGeminiFailureFetch(async (fetchUrls) => {
      const oldFallbackUsageDir = process.env.DIZZY_FALLBACK_USAGE_DIR;
      const oldFallbackBackend = process.env.DIZZY_CHAT_FALLBACK_BACKEND;
      const oldGlobalLimit = process.env.DIZZY_FALLBACK_MAX_CALLS_PER_HOUR;
      const oldConversationLimit = process.env.DIZZY_FALLBACK_MAX_CALLS_PER_CONVERSATION_HOUR;
      const conversationKey = "fallback_pause_conversation";
      try {
        process.env.DIZZY_CHAT_BACKEND = "gemini";
        process.env.GEMINI_API_KEY = "fake-gemini-key";
        process.env.GEMINI_MODEL = "gemini-1.5-flash";
        process.env.DIZZY_CHAT_FALLBACK_BACKEND = "openai_compat";
        process.env.OPENAI_COMPAT_BASE_URL = "https://api.openai.com/v1";
        process.env.OPENAI_COMPAT_MODEL = "gpt-4o";
        process.env.OPENAI_COMPAT_API_KEY = "sk-fake-fallback-key-do-not-call";
        process.env.DIZZY_FALLBACK_USAGE_DIR = seedFallbackUsage(conversationKey);
        delete process.env.DIZZY_FALLBACK_MAX_CALLS_PER_HOUR;
        process.env.DIZZY_FALLBACK_MAX_CALLS_PER_CONVERSATION_HOUR = "1";

        const conversationPaused = await handleIncomingMessage({
          message: {
            text: "Trigger Gemini fallback conversation pause",
            runtime_context: { trust_zone: "paid_public", conversation_key: conversationKey },
            channel: "cli",
          }
        });
        assert.equal(conversationPaused.execution_metadata.chosen_model, "none:fallback_paused_conversation_limit");
        assert.equal(conversationPaused.execution_metadata.reason, "no_model_execution:fallback_paused_conversation_limit");
        assert.equal(conversationPaused.execution_metadata.fallback.blocked_reason, "fallback_paused_conversation_limit");
        assert.ok(fetchUrls.every((url) => url.includes("generativelanguage.googleapis.com")), "Paused fallback must not call OpenAI-compatible backend");
      } finally {
        if (oldFallbackUsageDir !== undefined) process.env.DIZZY_FALLBACK_USAGE_DIR = oldFallbackUsageDir;
        else delete process.env.DIZZY_FALLBACK_USAGE_DIR;
        if (oldFallbackBackend !== undefined) process.env.DIZZY_CHAT_FALLBACK_BACKEND = oldFallbackBackend;
        else delete process.env.DIZZY_CHAT_FALLBACK_BACKEND;
        if (oldGlobalLimit !== undefined) process.env.DIZZY_FALLBACK_MAX_CALLS_PER_HOUR = oldGlobalLimit;
        else delete process.env.DIZZY_FALLBACK_MAX_CALLS_PER_HOUR;
        if (oldConversationLimit !== undefined) process.env.DIZZY_FALLBACK_MAX_CALLS_PER_CONVERSATION_HOUR = oldConversationLimit;
        else delete process.env.DIZZY_FALLBACK_MAX_CALLS_PER_CONVERSATION_HOUR;
        delete process.env.DIZZY_CHAT_BACKEND;
        delete process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_MODEL;
        delete process.env.OPENAI_COMPAT_BASE_URL;
        delete process.env.OPENAI_COMPAT_MODEL;
        delete process.env.OPENAI_COMPAT_API_KEY;
      }
    });

    // Test Case E: Utility Command Hoisting Verification (/improve)
    process.env.DIZZY_CHAT_BACKEND = "openai_compat";
    process.env.OPENAI_COMPAT_BASE_URL = "https://api.openai.com/v1";
    process.env.OPENAI_COMPAT_MODEL = "gpt-4o";
    process.env.OPENAI_COMPAT_API_KEY = "sk-fake-test-key-do-not-call";
    process.env.DIZZY_ALLOW_SELF_MODIFY = "1";

    // Seed conversation history through the same key resolver used by /improve.
    seedConversationHistory("cli");

    const utilMsg = {
      text: "/improve",
      runtime_context: { trust_zone: "private_self", trusted_local: true },
      channel: "cli",
      sensitivity_class: "internal_only"
    };

    const utilRes = await handleIncomingMessage({ message: utilMsg });
    assert.equal(utilRes.kind, "reply");
    assert.ok(utilRes.execution_metadata);
    assert.equal(utilRes.execution_metadata.fallback.blocked_reason, "private_zone_cloud_disallowed");

    process.env.DIZZY_CHAT_BACKEND = "gemini";
    process.env.GEMINI_API_KEY = "fake-gemini-key-do-not-call";
    process.env.GEMINI_MODEL = "gemini-1.5-flash";
    seedConversationHistory("gemini_improve_block");
    const geminiUtilRes = await handleIncomingMessage({
      message: {
        text: "/improve",
        runtime_context: { trust_zone: "private_self", trusted_local: true, conversation_key: "gemini_improve_block" },
        channel: "cli",
        sensitivity_class: "internal_only"
      }
    });
    assert.ok(geminiUtilRes.execution_metadata);
    assert.equal(geminiUtilRes.execution_metadata.chosen_model, "none:private_zone_cloud_disallowed");
    assert.equal(geminiUtilRes.execution_metadata.data_boundary, "none");
    assert.equal(geminiUtilRes.execution_metadata.fallback.blocked_reason, "private_zone_cloud_disallowed");
    assert.equal(geminiUtilRes.execution_metadata.reason, "no_model_execution:private_zone_cloud_disallowed");
    delete process.env.DIZZY_CHAT_BACKEND;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;

    // Test Case F: /improve post-model exits keep truthful execution metadata
    const improveExitCases = [
      {
        name: "non-json",
        providerContent: "plain text is not valid improve JSON",
        expectedText: "Improve: model returned non-JSON output",
        expectedReason: "post_model_parse_failed",
      },
      {
        name: "no-edits",
        providerContent: JSON.stringify({ edits: [], summary: "nothing to change" }),
        expectedText: "Improve: model returned no edits.",
        expectedReason: "post_model_policy_failed",
      },
      {
        name: "disallowed-edits",
        providerContent: JSON.stringify({ edits: [{ path: "lib/dispatch.mjs", content: "not allowed" }], summary: "unsafe edit" }),
        expectedText: "Improve: no allowed edits produced.",
        expectedReason: "post_model_policy_failed",
      },
    ];

    for (const testCase of improveExitCases) {
      await withMockOpenAICompat(testCase.providerContent, async () => {
        const conversationKey = `improve_${testCase.name}`;
        seedConversationHistory(conversationKey);
        process.env.DIZZY_ALLOW_SELF_MODIFY = "1";
        try {
          const res = await handleIncomingMessage({
            message: {
              text: "/improve",
              runtime_context: { trust_zone: "trusted_collaborator", trusted_local: true, conversation_key: conversationKey },
              channel: "cli",
            }
          });
          assert.equal(res.kind, "reply");
          assert.ok(res.text.includes(testCase.expectedText), `${testCase.name}: expected improve exit text`);
          assert.ok(res.execution_metadata, `${testCase.name}: execution metadata must be present`);
          assert.equal(res.execution_metadata.chosen_model, "openai_compat:qwen2.5-coder:7b");
          assert.equal(res.execution_metadata.data_boundary, "local_machine");
          assert.equal(res.execution_metadata.model_origin_risk, "high");
          assert.equal(res.execution_metadata.reason, testCase.expectedReason);
          assert.equal(res.execution_metadata.provider_health, "healthy");
          assert.ok(res.execution_metadata.latency_ms >= 0);
          assert.equal(res.execution_metadata.fallback.blocked_reason, testCase.expectedReason);
        } finally {
          delete process.env.DIZZY_ALLOW_SELF_MODIFY;
        }
      });
    }

    delete process.env.DIZZY_CHAT_BACKEND;
    delete process.env.OPENAI_COMPAT_BASE_URL;
    delete process.env.OPENAI_COMPAT_MODEL;
    delete process.env.OPENAI_COMPAT_API_KEY;
    delete process.env.DIZZY_ALLOW_SELF_MODIFY;

    console.log("DYNAMIC_ROUTER_INTEGRATION_TESTS_OK");
  } finally {
    if (fs.existsSync(FIXTURE_DIR)) {
      fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
  }
}

runIntegrationTests().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
