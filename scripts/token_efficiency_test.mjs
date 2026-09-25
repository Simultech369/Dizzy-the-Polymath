import assert from "node:assert/strict";
import http from "node:http";
import { normalizeOpenAICompatUsage, openaiCompatGenerate } from "../lib/openai_compat_client.mjs";
import { normalizeGeminiUsage, geminiGenerate } from "../lib/gemini_client.mjs";
import {
  calculateAsymmetricCostUsd,
  TIER_INPUT_COST_PER_1K,
  TIER_CACHED_INPUT_COST_PER_1K,
  TIER_OUTPUT_COST_PER_1K,
} from "../lib/routing_policy.mjs";
import { getPromptSources } from "../lib/prompt_bundle.mjs";

console.log("=== Agent Harness Token Efficiency Test Suite ===");

// 1. OpenAI Compat Usage Normalization with Prompt Cache Telemetry
{
  console.log("[Test 1] OpenAI Compat Usage Normalization");
  const rawWithDetails = {
    prompt_tokens: 2000,
    completion_tokens: 500,
    total_tokens: 2500,
    prompt_tokens_details: {
      cached_tokens: 1500,
    },
  };
  const norm1 = normalizeOpenAICompatUsage(rawWithDetails);
  assert.equal(norm1.prompt_tokens, 2000);
  assert.equal(norm1.completion_tokens, 500);
  assert.equal(norm1.cached_tokens, 1500);
  assert.equal(norm1.uncached_prompt_tokens, 500);

  const rawDeepSeek = {
    prompt_tokens: 1000,
    completion_tokens: 200,
    prompt_cache_hit_tokens: 800,
  };
  const norm2 = normalizeOpenAICompatUsage(rawDeepSeek);
  assert.equal(norm2.cached_tokens, 800);
  assert.equal(norm2.uncached_prompt_tokens, 200);

  assert.equal(normalizeOpenAICompatUsage(null), null);
  assert.equal(normalizeOpenAICompatUsage({}), null);
  assert.equal(normalizeOpenAICompatUsage([]), null);
  assert.equal(normalizeOpenAICompatUsage({ total_tokens: 100 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: -1, completion_tokens: 2 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 10, completion_tokens: 2, cached_tokens: -1 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 10, completion_tokens: 2, cached_tokens: 11 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: "", completion_tokens: 2 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: false, completion_tokens: 2 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 1.5, completion_tokens: 2 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 12, completion_tokens: 4, total_tokens: null }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 12, completion_tokens: 4, total_tokens: false }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 12, completion_tokens: 4, total_tokens: "" }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 12, completion_tokens: 4, total_tokens: 1.5 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 12, completion_tokens: 4, total_tokens: [] }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 12, completion_tokens: 4, total_tokens: {} }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 12, completion_tokens: 4, total_tokens: 10 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: Number.MAX_SAFE_INTEGER, completion_tokens: 2 }), null);
  // Authoritative aliases: input_tokens/output_tokens win when present.
  {
    const authoritativeInput = normalizeOpenAICompatUsage({ input_tokens: 0, prompt_tokens: 1000, output_tokens: 4 });
    assert.equal(authoritativeInput.prompt_tokens, 0);
    assert.equal(authoritativeInput.completion_tokens, 4);
    assert.equal(authoritativeInput.total_tokens, 4);
  }
  {
    const authoritativeOutput = normalizeOpenAICompatUsage({ input_tokens: 10, prompt_tokens: 10, output_tokens: 4, completion_tokens: 8 });
    assert.equal(authoritativeOutput.prompt_tokens, 10);
    assert.equal(authoritativeOutput.completion_tokens, 4);
  }
  // Malformed authoritative aliases fail closed instead of falling back.
  assert.equal(normalizeOpenAICompatUsage({ input_tokens: false, prompt_tokens: 1000, output_tokens: 4 }), null);
  assert.equal(normalizeOpenAICompatUsage({ input_tokens: "", prompt_tokens: 1000, output_tokens: 4 }), null);
  assert.equal(normalizeOpenAICompatUsage({ input_tokens: 1.5, prompt_tokens: 1000, output_tokens: 4 }), null);
  assert.equal(normalizeOpenAICompatUsage({ input_tokens: Number.MAX_SAFE_INTEGER, prompt_tokens: 1000, output_tokens: 4 }), null);
  // Cached token null fallthrough: explicit null in one alias must not fall through to another
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: null }, cached_tokens: 0 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 5 }, cached_tokens: null }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 10, completion_tokens: 5, cached_tokens: null, prompt_cache_hit_tokens: 0 }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 10, completion_tokens: 5, cached_tokens: 0, prompt_cache_hit_tokens: null }), null);
  assert.equal(normalizeOpenAICompatUsage({ prompt_tokens: 10, completion_tokens: 5, cached_tokens: 5, prompt_cache_hit_tokens: 0 }), null);
  // Cached token: single valid source works, and agreeing sources work
  { const cached = normalizeOpenAICompatUsage({ prompt_tokens: 10, completion_tokens: 5, cached_tokens: 3 }); assert.equal(cached.cached_tokens, 3); }
  { const cached = normalizeOpenAICompatUsage({ prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 3 }, cached_tokens: 3 }); assert.equal(cached.cached_tokens, 3); }
  console.log("  [PASS] OpenAI Compat telemetry normalization correctly extracts cached tokens.");
}

// 2. Gemini Usage Normalization with Cached Content Telemetry
{
  console.log("[Test 2] Gemini Usage Normalization");
  const rawGemini = {
    promptTokenCount: 5000,
    candidatesTokenCount: 800,
    totalTokenCount: 5800,
    cachedContentTokenCount: 4000,
  };
  const norm = normalizeGeminiUsage(rawGemini);
  assert.equal(norm.prompt_tokens, 5000);
  assert.equal(norm.completion_tokens, 800);
  assert.equal(norm.cached_tokens, 4000);
  assert.equal(norm.uncached_prompt_tokens, 1000);
  assert.equal(norm.total_tokens, 5800);
  assert.equal(normalizeGeminiUsage(null), null);
  assert.equal(normalizeGeminiUsage({}), null);
  assert.equal(normalizeGeminiUsage([]), null);
  assert.equal(normalizeGeminiUsage({ totalTokenCount: 100 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: -1, candidatesTokenCount: 2 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 10, candidatesTokenCount: 2, cachedContentTokenCount: -1 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 10, candidatesTokenCount: 2, cachedContentTokenCount: 11 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: "", candidatesTokenCount: 2 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: false, candidatesTokenCount: 2 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 1.5, candidatesTokenCount: 2 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: null }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: false }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: "" }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: 1.5 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: [] }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: {} }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: 10 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: Number.MAX_SAFE_INTEGER, candidatesTokenCount: 2 }), null);
  // Native Gemini usage fields win when present.
  {
    const authoritativePrompt = normalizeGeminiUsage({ promptTokenCount: 0, prompt_tokens: 1000, candidatesTokenCount: 4 });
    assert.equal(authoritativePrompt.prompt_tokens, 0);
    assert.equal(authoritativePrompt.completion_tokens, 4);
    assert.equal(authoritativePrompt.total_tokens, 4);
  }
  {
    const authoritativeCompletion = normalizeGeminiUsage({ promptTokenCount: 12, candidatesTokenCount: 4, completion_tokens: 8 });
    assert.equal(authoritativeCompletion.prompt_tokens, 12);
    assert.equal(authoritativeCompletion.completion_tokens, 4);
  }
  // Malformed native fields fail closed instead of falling back.
  assert.equal(normalizeGeminiUsage({ promptTokenCount: false, prompt_tokens: 1000, candidatesTokenCount: 4 }), null);
  {
    const authoritativeTotal = normalizeGeminiUsage({ promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: 16, total_tokens: 20 });
    assert.equal(authoritativeTotal.total_tokens, 16);
  }
  // Cached token null fallthrough: explicit null must not fall through
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 10, candidatesTokenCount: 5, cachedContentTokenCount: null, cached_tokens: 0 }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 10, candidatesTokenCount: 5, cachedContentTokenCount: 0, cached_tokens: null }), null);
  assert.equal(normalizeGeminiUsage({ promptTokenCount: 10, candidatesTokenCount: 5, cachedContentTokenCount: 5, cached_tokens: 0 }), null);
  { const cached = normalizeGeminiUsage({ promptTokenCount: 10, candidatesTokenCount: 5, cachedContentTokenCount: 3, cached_tokens: 3 }); assert.equal(cached.cached_tokens, 3); }
  console.log("  [PASS] Gemini usageMetadata normalization correctly extracts cachedContentTokenCount.");
}

// 2b. Gemini Thought Parts Are Not Final Answer Text
{
  console.log("[Test 2b] Gemini Thought Part Filtering");
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ thought: true, text: "SYNTHETIC_PRIVATE_THOUGHT" }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 1 },
    }), { status: 200, headers: { "content-type": "application/json" } });
    await assert.rejects(
      () => geminiGenerate({
        apiKey: "test_key",
        model: "gemini-test",
        messages: [{ role: "user", text: "hello" }],
        timeoutMs: 1000,
      }),
      /Gemini returned empty text/,
    );

    globalThis.fetch = async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [
        { thought: true, text: "SYNTHETIC_PRIVATE_THOUGHT" },
        { text: "visible answer" },
      ] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 },
    }), { status: 200, headers: { "content-type": "application/json" } });
    const result = await geminiGenerate({
      apiKey: "test_key",
      model: "gemini-test",
      messages: [{ role: "user", text: "hello" }],
      timeoutMs: 1000,
    });
    assert.equal(result.text, "visible answer");
    console.log("  [PASS] Gemini thought parts are excluded from answer text.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 2c. Gemini model discovery fallback preserves the actual attempted model
{
  console.log("[Test 2c] Gemini Fallback Model Identity");
  const originalFetch = globalThis.fetch;
  const urls = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      const u = String(url);
      urls.push(u);
      if (u.includes("/models/gemini-original:generateContent")) {
        return new Response(JSON.stringify({ error: { message: "not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      if (u.includes("/models?")) {
        return new Response(JSON.stringify({
          models: [
            { name: "models/gemini-fallback-flash", supportedGenerationMethods: ["generateContent"] },
          ],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (u.includes("/models/gemini-fallback-flash:generateContent")) {
        assert.equal(options.method, "POST");
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "fallback answer" }] } }],
          usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 2 },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected Gemini fetch URL: ${u}`);
    };

    const result = await geminiGenerate({
      apiKey: "test_key",
      model: "gemini-original",
      messages: [{ role: "user", text: "hello" }],
      timeoutMs: 1000,
    });
    assert.equal(result.text, "fallback answer");
    assert.equal(result.model, "gemini-fallback-flash");
    assert.ok(urls.some((u) => u.includes("/v1beta/models/gemini-original:generateContent")));
    assert.ok(urls.some((u) => u.includes("/v1/models/gemini-original:generateContent")));
    assert.ok(urls.some((u) => u.includes("/v1beta/models/gemini-fallback-flash:generateContent")));
    console.log("  [PASS] Gemini fallback reports the discovered model that produced the answer.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 3. Asymmetric Cost Accounting with Prompt Cache Discount
{
  console.log("[Test 3] Price-Weighted Asymmetric Cost Accounting");
  // Without caching: 10k input, 1k output on T2 ($0.002/1k in, $0.008/1k out)
  // inCost = 10 * 0.002 = 0.02
  // outCost = 1 * 0.008 = 0.008
  // Total = 0.028
  const uncachedCost = calculateAsymmetricCostUsd({
    tier: "T2",
    inputTokens: 10000,
    outputTokens: 1000,
    cachedTokens: 0,
  });
  assert.equal(uncachedCost, 0.028);

  // With 80% prompt caching: 8k cached, 2k uncached
  // uncachedInCost = 2 * 0.002 = 0.004
  // cachedInCost = 8 * 0.0005 = 0.004 (75% discount)
  // outCost = 1 * 0.008 = 0.008
  // Total = 0.016
  const cachedCost = calculateAsymmetricCostUsd({
    tier: "T2",
    inputTokens: 10000,
    outputTokens: 1000,
    cachedTokens: 8000,
  });
  assert.equal(cachedCost, 0.016);
  assert.ok(cachedCost < uncachedCost, "Cached cost must be significantly lower than uncached cost");
  const savingsPct = Math.round(((uncachedCost - cachedCost) / uncachedCost) * 100);
  console.log(`  [PASS] Asymmetric cost accounting accurately computes 75% prompt cache discount (${savingsPct}% savings).`);
}

// 4. OpenAI Compat Client Telemetry & Reasoning Continuity
{
  console.log("[Test 4] OpenAI Compat Provider Call & Reasoning Preservation");
  const mockServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        model: "qwen-2.5-coder-32b",
        choices: [
          {
            message: {
              content: "Here is the optimized code.",
              reasoning_content: "Plan: analyze the AST, prune dead branches, return minimal diff.",
            },
          },
        ],
        usage: {
          prompt_tokens: 3500,
          completion_tokens: 450,
          total_tokens: 3950,
          prompt_tokens_details: { cached_tokens: 2800 },
        },
      }));
    });
  });

  await new Promise((r) => mockServer.listen(0, "127.0.0.1", r));
  const port = mockServer.address().port;

  try {
    const result = await openaiCompatGenerate({
      baseUrl: `http://127.0.0.1:${port}/v1`,
      apiKey: "test_key",
      model: "test_model",
      systemPrompt: "You are an assistant",
      messages: [{ role: "user", text: "Hello" }],
    });

    assert.equal(result.text, "Here is the optimized code.");
    assert.equal(result.reasoning_content, "Plan: analyze the AST, prune dead branches, return minimal diff.");
    assert.equal(result.usage.cached_tokens, 2800);
    assert.equal(result.usage.uncached_prompt_tokens, 700);
    console.log("  [PASS] openaiCompatGenerate captured text, reasoning_content, and cache usage details.");
  } finally {
    await new Promise((r) => mockServer.close(r));
  }
}

// 5. Lean Prompt Pack (Removing Redundant Tool Definitions)
{
  console.log("[Test 5] Lean Prompt Pack Configuration");
  const origPack = process.env.DIZZY_PROMPT_PACK;
  try {
    process.env.DIZZY_PROMPT_PACK = "core";
    const coreResult = getPromptSources();
    const coreSources = coreResult.sources;
    const coreFiles = coreSources.map((s) => s.path);
    assert.ok(coreFiles.some((f) => f.includes("TOOLS.md")), "Core pack contains TOOLS.md");

    process.env.DIZZY_PROMPT_PACK = "lean";
    const leanResult = getPromptSources();
    const leanSources = leanResult.sources;
    const leanFiles = leanSources.map((s) => s.path);
    assert.ok(!leanFiles.some((f) => f.includes("TOOLS.md")), "Lean pack excludes redundant TOOLS.md");
    assert.ok(!leanFiles.some((f) => f.includes("SOUL.md")), "Lean pack excludes SOUL.md");
    assert.ok(leanFiles.some((f) => f.includes("CONSTITUTIONAL_KERNEL.md")), "Lean pack preserves CONSTITUTIONAL_KERNEL");
    assert.ok(leanFiles.some((f) => f.includes("PROMPT_CORE.md")), "Lean pack preserves PROMPT_CORE");

    const coreChars = coreSources.reduce((acc, s) => acc + (s.text?.length || 0), 0);
    const leanChars = leanSources.reduce((acc, s) => acc + (s.text?.length || 0), 0);
    const reductionPct = Math.round(((coreChars - leanChars) / coreChars) * 100);
    console.log(`  [PASS] Lean prompt pack reduces injected prompt chars from ${coreChars} to ${leanChars} (-${reductionPct}% tokens).`);
  } finally {
    if (origPack !== undefined) process.env.DIZZY_PROMPT_PACK = origPack;
    else delete process.env.DIZZY_PROMPT_PACK;
  }
}

console.log("\nTOKEN_EFFICIENCY_TESTS_OK");
