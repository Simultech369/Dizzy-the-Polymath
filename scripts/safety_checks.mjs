import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { assessCandidatePayload, buildPreparedCandidatePayload } from "../lib/order_fulfillment.mjs";
import { autoRememberSignalScore, getContinuityMode, handleIncomingMessage, isMutationCommandText, isRemoteMutationAllowed, isSelfModifyAllowed, isSelfModifyCommandText, routeIncomingMessage, shouldAutoRemember, trustZoneUsesEphemeralChatHistory } from "../lib/dispatch.mjs";
import { getRelevantMarkdownSnippets } from "../lib/md_retriever.mjs";
import { getMemoryGraph, getRelevantMemoryGraphContext } from "../lib/memory_graph.mjs";
import { getPromptSources } from "../lib/prompt_bundle.mjs";
import { makeQueueKeys, moveDueDelayed, runWorkerCycle } from "../lib/queue.mjs";
import { assertRuntimeSafetyConfig, validateRuntimeSafetyConfig } from "../lib/runtime_config.mjs";
import { validateExternalUrl } from "../lib/tools.mjs";

async function expectReject(fn, pattern) {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (pattern) assert.match(String(err?.message ?? err), pattern);
  }
  assert.equal(threw, true, "expected rejection");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function testUrlValidation() {
  const oldLocalhost = process.env.DIZZY_TOOL_ALLOW_LOCALHOST;
  const oldPrivate = process.env.DIZZY_TOOL_ALLOW_PRIVATE_NET;

  delete process.env.DIZZY_TOOL_ALLOW_LOCALHOST;
  delete process.env.DIZZY_TOOL_ALLOW_PRIVATE_NET;

  await expectReject(() => validateExternalUrl("http://127.0.0.1:3000/health"), /localhost/i);
  await expectReject(() => validateExternalUrl("http://[::1]/health"), /localhost/i);
  await expectReject(() => validateExternalUrl("http://192.168.1.10/"), /private-network/i);
  await expectReject(() => validateExternalUrl("http://user:pass@example.com/"), /credentials/i);

  process.env.DIZZY_TOOL_ALLOW_LOCALHOST = "1";
  const validated = await validateExternalUrl("http://127.0.0.1:3000/health");
  assert.equal(validated.url, "http://127.0.0.1:3000/health");
  assert.equal(validated.pinnedAddress, "127.0.0.1");

  if (oldLocalhost === undefined) delete process.env.DIZZY_TOOL_ALLOW_LOCALHOST;
  else process.env.DIZZY_TOOL_ALLOW_LOCALHOST = oldLocalhost;
  if (oldPrivate === undefined) delete process.env.DIZZY_TOOL_ALLOW_PRIVATE_NET;
  else process.env.DIZZY_TOOL_ALLOW_PRIVATE_NET = oldPrivate;
}

function testFulfillmentGating() {
  const runtimeRoot = path.resolve(process.cwd(), "runtime", "test-orders");
  const order = {
    order_id: "order-123",
    service_id: "svc",
    brief: "A calm mascot on a bright field",
  };
  const facts = { candidateCount: 0 };
  const orderDir = path.join(runtimeRoot, order.order_id);
  const candidatePath = path.join(orderDir, "candidate.png");
  const metadataPath = path.join(orderDir, "candidate.json");

  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  fs.mkdirSync(orderDir, { recursive: true });

  let prepared = buildPreparedCandidatePayload(order, facts, runtimeRoot);
  assert.equal(prepared.ok, false);
  assert.equal(prepared.reason, "prepared_candidate_missing");

  fs.writeFileSync(candidatePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  writeJson(metadataPath, { model: "placeholder_local_png", refined_prompt: order.brief });
  prepared = buildPreparedCandidatePayload(order, facts, runtimeRoot);
  assert.equal(prepared.ok, false);
  assert.equal(prepared.reason, "prepared_candidate_not_deliverable");

  writeJson(metadataPath, { model: "manual_prepared_asset", refined_prompt: order.brief });
  prepared = buildPreparedCandidatePayload(order, facts, runtimeRoot);
  assert.equal(prepared.ok, true);

  const assessment = assessCandidatePayload(prepared.payload, order, runtimeRoot);
  assert.equal(assessment.ok, true);

  fs.rmSync(runtimeRoot, { recursive: true, force: true });
}

function testRemoteMutationGating() {
  const old = process.env.DIZZY_ALLOW_REMOTE_MUTATIONS;
  const oldSelfModify = process.env.DIZZY_ALLOW_SELF_MODIFY;
  delete process.env.DIZZY_ALLOW_REMOTE_MUTATIONS;
  delete process.env.DIZZY_ALLOW_SELF_MODIFY;

  assert.equal(isMutationCommandText("/apply abc CONFIRM"), false);
  assert.equal(isMutationCommandText("/remember"), true);
  assert.equal(isMutationCommandText("hello"), false);
  assert.equal(isSelfModifyCommandText("/improve"), true);
  assert.equal(isSelfModifyCommandText("/apply abc CONFIRM"), true);
  assert.equal(isRemoteMutationAllowed({ channel: "local" }), false);
  assert.equal(isRemoteMutationAllowed({ channel: "local", runtime_context: { trusted_local: true } }), true);
  assert.equal(isRemoteMutationAllowed({ channel: "telegram" }), false);
  assert.equal(isSelfModifyAllowed({ channel: "local" }), false);
  assert.equal(isSelfModifyAllowed({ channel: "local", runtime_context: { trusted_local: true } }), false);
  assert.equal(isSelfModifyAllowed({ channel: "telegram" }), false);

  process.env.DIZZY_ALLOW_REMOTE_MUTATIONS = "1";
  assert.equal(isRemoteMutationAllowed({ channel: "telegram" }), true);
  process.env.DIZZY_ALLOW_SELF_MODIFY = "1";
  assert.equal(isSelfModifyAllowed({ channel: "local", runtime_context: { trusted_local: true } }), true);
  assert.equal(isSelfModifyAllowed({ channel: "telegram" }), false);

  if (old === undefined) delete process.env.DIZZY_ALLOW_REMOTE_MUTATIONS;
  else process.env.DIZZY_ALLOW_REMOTE_MUTATIONS = old;
  if (oldSelfModify === undefined) delete process.env.DIZZY_ALLOW_SELF_MODIFY;
  else process.env.DIZZY_ALLOW_SELF_MODIFY = oldSelfModify;
}

function testContinuityModes() {
  assert.equal(getContinuityMode({ runtime_context: { continuity_mode: "client" } }), "client");
  assert.equal(getContinuityMode({ runtime_context: { continuity_mode: "ephemeral" } }), "ephemeral");
  assert.equal(getContinuityMode({}), "default");

  assert.equal(
    trustZoneUsesEphemeralChatHistory({ runtime_context: { trust_zone: "paid_public", continuity_mode: "ephemeral" } }, "paid_public"),
    true,
  );
  assert.equal(
    trustZoneUsesEphemeralChatHistory({ runtime_context: { trust_zone: "paid_public", continuity_mode: "client" } }, "paid_public"),
    false,
  );
  assert.equal(
    trustZoneUsesEphemeralChatHistory({ runtime_context: { trust_zone: "private_self" } }, "private_self"),
    false,
  );
}

function testQueueChannelSanitization() {
  const keys = makeQueueKeys("dizzy");
  assert.equal(keys.notify("Telegram / Ops"), "dizzy:queue:notify:telegram_ops");

  const routed = routeIncomingMessage({
    channel: "Telegram / Ops",
    from: "Desk #1",
    text: "tool:http_get https://example.com",
    meta: ["not-an-object"],
  });
  assert.equal(routed.kind, "enqueue");
  assert.equal(routed.notify.channel, "telegram_ops");
  assert.equal(routed.notify.from, "desk_1");
  assert.deepEqual(routed.notify.meta, {});
}

async function testQueueMoveDueDelayed() {
  const calls = [];
  const redis = {
    async eval(_script, args) {
      calls.push(["eval", args]);
      return 2;
    },
    async zRangeByScore() { return ["job-a", "job-b"]; },
    async zRem(key, ids) { calls.push(["zRem", key, ids]); },
    async lPush(...args) { calls.push(["lPush", ...args]); },
  };
  const count = await moveDueDelayed(redis, { delayed: "delayed", ready: "ready" });
  assert.equal(count, 2);
  assert.equal(calls[0][0], "eval");
}

async function testQueueMoveDueDelayedFallback() {
  const calls = [];
  const redis = {
    async zRangeByScore() { return ["job-a", "job-b"]; },
    async zRem(key, ids) { calls.push(["zRem", key, ids]); },
    async lPush(...args) { calls.push(["lPush", ...args]); },
  };
  const count = await moveDueDelayed(redis, { delayed: "delayed", ready: "ready" });
  assert.equal(count, 2);
  assert.deepEqual(calls[1], ["lPush", "ready", "job-a", "job-b"]);
}

async function testCommandAvailabilityWithoutChatBackend() {
  const oldBackend = process.env.DIZZY_CHAT_BACKEND;
  const oldRemote = process.env.DIZZY_ALLOW_REMOTE_MUTATIONS;
  delete process.env.DIZZY_CHAT_BACKEND;
  process.env.DIZZY_ALLOW_REMOTE_MUTATIONS = "1";

  const out = await handleIncomingMessage({
    message: { channel: "telegram", text: "/remember", meta: { telegram: { chat_id: "123" } } },
    enqueue: async () => { throw new Error("enqueue should not run"); },
  });

  assert.equal(out.kind, "reply");
  assert.doesNotMatch(String(out.text), /^Ack:/);
  assert.match(String(out.text), /unknown chat backend|missing/i);

  if (oldBackend === undefined) delete process.env.DIZZY_CHAT_BACKEND;
  else process.env.DIZZY_CHAT_BACKEND = oldBackend;
  if (oldRemote === undefined) delete process.env.DIZZY_ALLOW_REMOTE_MUTATIONS;
  else process.env.DIZZY_ALLOW_REMOTE_MUTATIONS = oldRemote;
}

async function testSpoofedLocalChannelDoesNotBypassMutationGuards() {
  const oldSelfModify = process.env.DIZZY_ALLOW_SELF_MODIFY;
  const oldBackend = process.env.DIZZY_CHAT_BACKEND;
  delete process.env.DIZZY_ALLOW_SELF_MODIFY;
  delete process.env.DIZZY_CHAT_BACKEND;

  const out = await handleIncomingMessage({
    message: {
      channel: "local",
      text: "/apply test-id CONFIRM",
      runtime_context: { trusted_local: false },
    },
    enqueue: async () => { throw new Error("enqueue should not run"); },
  });

  assert.equal(out.kind, "reply");
  assert.match(String(out.text), /Self-modification commands are disabled/i);

  if (oldSelfModify === undefined) delete process.env.DIZZY_ALLOW_SELF_MODIFY;
  else process.env.DIZZY_ALLOW_SELF_MODIFY = oldSelfModify;
  if (oldBackend === undefined) delete process.env.DIZZY_CHAT_BACKEND;
  else process.env.DIZZY_CHAT_BACKEND = oldBackend;
}

function makeFakeRedisForQueue(jobMap, queueIds = []) {
  const ready = [...queueIds];
  const delayed = [];
  const notify = [];
  const dlq = [];

  return {
    ready,
    delayed,
    notify,
    dlq,
    async zRangeByScore() { return []; },
    async zRem() {},
    async lPush(key, ...values) {
      if (key === "ready") ready.unshift(...values);
      else if (key === "dlq") dlq.unshift(...values);
      else if (key === "notify:telegram") notify.unshift(...values);
    },
    async brPop() {
      if (!ready.length) return null;
      return { key: "ready", element: ready.pop() };
    },
    async hGetAll(key) {
      return jobMap.get(key) ?? {};
    },
    async hSet(key, patch) {
      const current = jobMap.get(key) ?? {};
      jobMap.set(key, { ...current, ...patch });
    },
    async zAdd(key, entries) {
      delayed.push({ key, entries });
    },
  };
}

async function testWorkerCycleRetryAndDeath() {
  const keys = {
    ready: "ready",
    delayed: "delayed",
    dlq: "dlq",
    notify: () => "notify:telegram",
    job: (id) => `job:${id}`,
  };

  const retryJobMap = new Map([
    [keys.job("job-retry"), {
      id: "job-retry",
      status: "queued",
      type: "tool",
      tool: "http_get",
      effect: "READ",
      attempts: "0",
      max_attempts: "4",
      retry_count: "0",
      max_retries: "3",
      payload_json: "{}",
      notify_json: JSON.stringify({ channel: "telegram" }),
      started_at_ms: "",
    }],
  ]);
  const retryRedis = makeFakeRedisForQueue(retryJobMap, ["job-retry"]);
  const retryResult = await runWorkerCycle(retryRedis, keys, async () => {
    const err = new Error("timeout");
    err.code = "ETIMEDOUT";
    throw err;
  });
  assert.equal(retryResult.kind, "retry_scheduled");
  assert.equal(retryJobMap.get(keys.job("job-retry")).status, "retry_scheduled");
  assert.equal(retryJobMap.get(keys.job("job-retry")).retry_count, "1");
  assert.equal(retryRedis.delayed.length, 1);

  const deadJobMap = new Map([
    [keys.job("job-dead"), {
      id: "job-dead",
      status: "queued",
      type: "tool",
      tool: "http_get",
      effect: "READ",
      attempts: "3",
      max_attempts: "4",
      retry_count: "3",
      max_retries: "3",
      payload_json: "{}",
      notify_json: JSON.stringify({ channel: "telegram" }),
      started_at_ms: "",
    }],
  ]);
  const deadRedis = makeFakeRedisForQueue(deadJobMap, ["job-dead"]);
  const deadResult = await runWorkerCycle(deadRedis, keys, async () => {
    const err = new Error("timeout");
    err.code = "ETIMEDOUT";
    throw err;
  });
  assert.equal(deadResult.kind, "dead");
  assert.equal(deadJobMap.get(keys.job("job-dead")).status, "dead");
  assert.equal(deadRedis.dlq.includes("job-dead"), true);
  assert.equal(deadRedis.notify.length, 1);
}

function testRuntimeConfigValidation() {
  const result = validateRuntimeSafetyConfig({
    bindHost: "0.0.0.0",
    authTokenConfigured: false,
    chatBackend: "gemini",
    toolMode: "auto",
      allowRemoteMutations: false,
      allowSelfModify: false,
      telegramStartupMessage: false,
    });
  assert.equal(result.errors.length > 0, true);
  assert.match(result.errors[0], /DIZZY_AUTH_TOKEN/);

  assert.doesNotThrow(() => {
    assertRuntimeSafetyConfig({
      bindHost: "127.0.0.1",
      authTokenConfigured: false,
      chatBackend: "",
      toolMode: "inline",
      allowRemoteMutations: false,
      allowSelfModify: false,
      telegramStartupMessage: false,
    });
  });
}

function testMemoryGraph() {
  const graph = getMemoryGraph();
  assert.equal(graph.counts.docs > 0, true);
  const ctx = getRelevantMemoryGraphContext("wikimedia world model substrate", { k: 3 });
  assert.equal(Array.isArray(ctx.docs), true);
  assert.equal(ctx.docs.length > 0, true);
  assert.equal(ctx.docs.some((d) => /wikimedia-world-model-substrate\.md$/i.test(String(d.path))), true);

  const autonomyCtx = getRelevantMemoryGraphContext("autonomy consent institutions coercion structural conditions", { k: 3 });
  assert.equal(Array.isArray(autonomyCtx.docs), true);
  assert.equal(autonomyCtx.docs.length > 0, true);
  assert.equal(autonomyCtx.docs.some((d) => Array.isArray(d.reasons) && d.reasons.includes("autonomy_structure_signal")), true);
  assert.equal((autonomyCtx.query_signals?.autonomy || 0) > 0, true);
}

function testMarkdownRetrieverSignals() {
  const snippets = getRelevantMarkdownSnippets("autonomy consent institutions coercion structural conditions", { k: 4 });
  assert.equal(Array.isArray(snippets), true);
  assert.equal(snippets.length > 0, true);
  assert.equal(snippets.some((s) => Array.isArray(s.reasons) && s.reasons.includes("autonomy_structure_signal")), true);
  assert.equal(snippets.some((s) => typeof s.signals?.autonomy === "number"), true);
}

function testMarkdownRetrieverExcludesUntrustedRoots() {
  const externalDir = path.resolve(process.cwd(), "_external");
  const probePath = path.resolve(externalDir, "retrieval-probe.md");
  const oldCache = process.env.DIZZY_RAG_CACHE_MS;
  const oldTopK = process.env.DIZZY_RAG_TOP_K;

  fs.mkdirSync(externalDir, { recursive: true });
  fs.writeFileSync(probePath, "# Retrieval Probe\n\nneedle_token_for_untrusted_probe_only\n", "utf8");
  process.env.DIZZY_RAG_CACHE_MS = "0";
  process.env.DIZZY_RAG_TOP_K = "8";

  const snippets = getRelevantMarkdownSnippets("needle_token_for_untrusted_probe_only", { k: 8 });
  assert.equal(snippets.some((s) => /retrieval-probe\.md$/i.test(String(s.path))), false);

  fs.rmSync(probePath, { force: true });
  if (oldCache === undefined) delete process.env.DIZZY_RAG_CACHE_MS;
  else process.env.DIZZY_RAG_CACHE_MS = oldCache;
  if (oldTopK === undefined) delete process.env.DIZZY_RAG_TOP_K;
  else process.env.DIZZY_RAG_TOP_K = oldTopK;
}

function testAutoRememberHeuristics() {
  const oldAuto = process.env.DIZZY_AUTO_REMEMBER;
  const oldCooldown = process.env.DIZZY_AUTO_REMEMBER_COOLDOWN_MS;
  const oldMinScore = process.env.DIZZY_AUTO_REMEMBER_MIN_SCORE;
  const oldDelay = process.env.DIZZY_AUTO_REMEMBER_DELAY_MS;

  process.env.DIZZY_AUTO_REMEMBER = "1";
  process.env.DIZZY_AUTO_REMEMBER_COOLDOWN_MS = "60000";
  process.env.DIZZY_AUTO_REMEMBER_MIN_SCORE = "4";
  process.env.DIZZY_AUTO_REMEMBER_DELAY_MS = "60000";

  const richHistory = [
    { role: "user", text: "I don't want to use /remember all the time when the system should notice structural drift." },
    { role: "assistant", text: "We can make memory automatic with cooldown and dedupe." },
    { role: "user", text: "Housing instability, autonomy, and consent matter more than generic self-management." },
    { role: "assistant", text: "Then we should improve memory capture first because that changed the priority." },
  ];

  assert.equal(autoRememberSignalScore(richHistory) >= 4, true);
  const convoKey = "test-auto-remember";
  fs.rmSync(path.resolve(process.cwd(), "runtime", "auto_memory", `${convoKey}.json`), { force: true });
  fs.rmSync(path.resolve(process.cwd(), "runtime", "auto_memory_candidates", `${convoKey}.json`), { force: true });

  const decision = shouldAutoRemember({ convoKey, history: richHistory, nowMs: Date.parse("2026-04-07T12:00:00.000Z") });
  assert.equal(decision.ok, true);
  assert.equal(decision.action, "stage");
  assert.match(String(decision.candidate?.transcript || ""), /Housing instability/i);

  writeJson(decision.candidatePath, decision.candidate);

  const promote = shouldAutoRemember({ convoKey, history: richHistory, nowMs: Date.parse("2026-04-07T12:02:00.000Z") });
  assert.equal(promote.ok, true);
  assert.equal(promote.action, "promote");
  assert.equal(promote.candidate.signature, decision.signature);

  if (oldAuto === undefined) delete process.env.DIZZY_AUTO_REMEMBER;
  else process.env.DIZZY_AUTO_REMEMBER = oldAuto;
  if (oldCooldown === undefined) delete process.env.DIZZY_AUTO_REMEMBER_COOLDOWN_MS;
  else process.env.DIZZY_AUTO_REMEMBER_COOLDOWN_MS = oldCooldown;
  if (oldMinScore === undefined) delete process.env.DIZZY_AUTO_REMEMBER_MIN_SCORE;
  else process.env.DIZZY_AUTO_REMEMBER_MIN_SCORE = oldMinScore;
  if (oldDelay === undefined) delete process.env.DIZZY_AUTO_REMEMBER_DELAY_MS;
  else process.env.DIZZY_AUTO_REMEMBER_DELAY_MS = oldDelay;

  fs.rmSync(path.resolve(process.cwd(), "runtime", "auto_memory", `${convoKey}.json`), { force: true });
  fs.rmSync(path.resolve(process.cwd(), "runtime", "auto_memory_candidates", `${convoKey}.json`), { force: true });
}

function testPromptBundleDefaults() {
  const oldPack = process.env.DIZZY_PROMPT_PACK;
  delete process.env.DIZZY_PROMPT_PACK;

  const sources = getPromptSources();
  const paths = sources.map((s) => s.path);
  assert.deepEqual(paths, [
    "IDENTITY.md",
    "SOUL.md",
    "HEARTBEAT.md",
    "TOOLS.md",
    "USER.md",
    "PROMPT_CORE.md",
    "PROMPT_MODES.md",
  ]);
  assert.equal(sources.every((s) => s.role === "constitutional"), true);

  process.env.DIZZY_PROMPT_PACK = "creative";
  const creative = getPromptSources();
  assert.equal(creative.some((s) => s.path === "PROMPT_MODES.md" && s.role === "constitutional"), true);

  if (oldPack === undefined) delete process.env.DIZZY_PROMPT_PACK;
  else process.env.DIZZY_PROMPT_PACK = oldPack;
}

await testUrlValidation();
testFulfillmentGating();
testRemoteMutationGating();
testContinuityModes();
testQueueChannelSanitization();
await testQueueMoveDueDelayed();
await testQueueMoveDueDelayedFallback();
await testWorkerCycleRetryAndDeath();
testRuntimeConfigValidation();
testMemoryGraph();
testMarkdownRetrieverSignals();
testMarkdownRetrieverExcludesUntrustedRoots();
testAutoRememberHeuristics();
testPromptBundleDefaults();
await testCommandAvailabilityWithoutChatBackend();
await testSpoofedLocalChannelDoesNotBypassMutationGuards();
console.log("SAFETY_CHECKS_OK");
