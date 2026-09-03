import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { EventEmitter } from "node:events";

import { startServer } from "../agent_server.mjs";
import {
  STREAM_RECEIPT_SCHEMA,
  buildStreamReceipt,
  buildSseFrame,
  sha256Hex,
  stableJson,
  writeSseFrame,
} from "../lib/sse_stream.mjs";

const STRONG_TEST_AUTH_TOKEN = "test-master-token-32-chars-minimum";
const STRONG_TEST_EXECUTE_TOKEN = "test-execute-token-16-minimum";

function parseSseEvents(text) {
  return String(text)
    .split(/\r?\n\r?\n/)
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const event = { id: "", event: "message", retry: null, data: "" };
      const data = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("id: ")) event.id = line.slice(4);
        if (line.startsWith("event: ")) event.event = line.slice(7);
        if (line.startsWith("retry: ")) event.retry = Number(line.slice(7));
        if (line.startsWith("data: ")) data.push(line.slice(6));
      }
      event.data = data.join("\n");
      return event;
    });
}

function eventJson(event) {
  return JSON.parse(event.data);
}

async function listenLocal(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  return `http://127.0.0.1:${addr.port}`;
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function waitFor(predicate, label, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${label}`);
}

class FakeBackpressureResponse extends EventEmitter {
  constructor() {
    super();
    this.frames = [];
    this.writableEnded = false;
    this.destroyed = false;
  }

  write(frame) {
    this.frames.push(frame);
    return false;
  }
}

async function testSseWriterBackpressureAndAbort() {
  const drainRes = new FakeBackpressureResponse();
  let backpressureCount = 0;
  const drainPromise = writeSseFrame(
    drainRes,
    buildSseFrame({ id: "stream:000001", event: "stream_receipt", data: { ok: true } }),
    {
      onBackpressure: () => {
        backpressureCount += 1;
      },
    },
  );
  queueMicrotask(() => drainRes.emit("drain"));
  const drained = await drainPromise;
  assert.deepEqual(drained, { ok: true, status: "drained", bytes: Buffer.byteLength(drainRes.frames[0], "utf8") });
  assert.equal(backpressureCount, 1);

  const abortRes = new FakeBackpressureResponse();
  const controller = new AbortController();
  const abortPromise = writeSseFrame(
    abortRes,
    buildSseFrame({ id: "stream:000002", event: "stream_receipt", data: { ok: false } }),
    { signal: controller.signal },
  );
  queueMicrotask(() => controller.abort("fixture_abort"));
  const aborted = await abortPromise;
  assert.equal(aborted.ok, false);
  assert.equal(aborted.status, "aborted");

  const tooLargeRes = new FakeBackpressureResponse();
  const tooLarge = await writeSseFrame(tooLargeRes, "event: x\ndata: too-large\n\n", { maxFrameBytes: 4 });
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.status, "frame_too_large");
  assert.equal(tooLargeRes.frames.length, 0);
}

async function testStreamReceiptDoesNotStoreBodyValues() {
  const requestBody = {
    brief: "never persist w0099_secret_sentinel in a receipt",
    continuity_mode: "ephemeral",
  };
  const receipt = buildStreamReceipt({
    streamId: "stream-fixture",
    eventId: "stream-fixture:000001",
    eventType: "stream_start",
    status: "started",
    reason: "request_accepted",
    requestBody,
    headers: {
      "idempotency-key": "fixture-key",
      "last-event-id": "prior-stream:000004",
    },
    retryMs: 5000,
  });

  assert.equal(receipt.schema_version, STREAM_RECEIPT_SCHEMA);
  assert.equal(receipt.authority, "stream_evidence_not_authority");
  assert.equal(receipt.request_body_sha256, sha256Hex(stableJson(requestBody)));
  assert.deepEqual(receipt.request_body_keys, ["brief", "continuity_mode"]);
  assert.equal(receipt.idempotency_key_sha256, sha256Hex("fixture-key"));
  assert.equal(receipt.last_event_id_sha256, sha256Hex("prior-stream:000004"));
  assert.equal(JSON.stringify(receipt).includes("w0099_secret_sentinel"), false);
  assert.equal(JSON.stringify(receipt).includes("fixture-key"), false);
  assert.equal(JSON.stringify(receipt).includes("prior-stream"), false);
}

async function testStreamReceiptRejectsHostileFreeTextFields() {
  const receipt = buildStreamReceipt({
    streamId: "stream-hostile",
    eventId: "stream-hostile:000001",
    eventType: "not_a_real_event_type",
    status: "started but also leak w0099_hostile_sentinel",
    reason: "w0099_hostile_sentinel should never become receipt text",
    errorCode: "w0099_hostile_sentinel",
    requestBody: {
      "unsafe_w0099_hostile_sentinel_key": "nested w0099_hostile_sentinel value",
      brief: "also hide w0099_hostile_sentinel here",
    },
    headers: {
      "idempotency-key": "w0099_hostile_sentinel_key",
    },
  });

  assert.equal(receipt.event_type, "stream_error");
  assert.equal(receipt.status, "unknown");
  assert.equal(receipt.reason_code, "stream_execution_failed");
  assert.equal(receipt.error_code, "UNCLASSIFIED_ERROR");
  assert.equal(receipt.request_body_keys[0], "brief");
  assert.match(receipt.request_body_keys[1], /^sha256:[A-F0-9]{16}$/);
  assert.equal(JSON.stringify(receipt).includes("w0099_hostile_sentinel"), false);
}

async function testAgentExecuteStreamRoute() {
  const oldBackend = process.env.DIZZY_CHAT_BACKEND;
  const receiptPath = path.resolve(process.cwd(), "runtime", "test-stream-receipts.jsonl");
  fs.rmSync(receiptPath, { force: true });
  delete process.env.DIZZY_CHAT_BACKEND;

  const started = await startServer({
    port: 0,
    bindHost: "127.0.0.1",
    authToken: STRONG_TEST_AUTH_TOKEN,
    executeToken: STRONG_TEST_EXECUTE_TOKEN,
    redisUrl: "",
    streamReceiptPath: receiptPath,
  });

  const requestBody = {
    brief: "plain fixture request with w0099_route_secret_sentinel",
    continuity_mode: "ephemeral",
  };

  try {
    const response = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${STRONG_TEST_EXECUTE_TOKEN}`,
        "idempotency-key": "stream-route-key-1",
        "last-event-id": "client-stream:000003",
      },
      body: JSON.stringify(requestBody),
    });

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /text\/event-stream/);
    assert.equal(response.headers.get("cache-control"), "no-store, no-transform");
    assert.equal(response.headers.get("x-accel-buffering"), "no");

    const text = await response.text();
    const events = parseSseEvents(text);
    assert.equal(events.length >= 3, true);
    assert.deepEqual(events.map((event) => event.event), ["stream_receipt", "agent_result", "stream_receipt"]);
    assert.equal(events[0].retry, 5000);
    assert.equal(new Set(events.map((event) => event.id)).size, events.length);
    assert.ok(events.every((event) => /agent_execute_[^:]+:\d{6}$/.test(event.id)));

    const startPayload = eventJson(events[0]);
    const resultPayload = eventJson(events[1]);
    const completionPayload = eventJson(events[2]);
    assert.equal(startPayload.receipt.schema_version, STREAM_RECEIPT_SCHEMA);
    assert.equal(startPayload.receipt.authority, "stream_evidence_not_authority");
    assert.equal(startPayload.receipt.status, "started");
    assert.equal(startPayload.receipt.reason_code, "request_accepted");
    assert.equal(startPayload.receipt.request_body_sha256, sha256Hex(stableJson(requestBody)));
    assert.deepEqual(startPayload.receipt.request_body_keys, ["brief", "continuity_mode"]);
    assert.equal(startPayload.receipt.idempotency_key_sha256, sha256Hex("stream-route-key-1"));
    assert.equal(startPayload.receipt.last_event_id_sha256, sha256Hex("client-stream:000003"));
    assert.equal(resultPayload.status, 200);
    assert.equal(resultPayload.body.ok, true);
    assert.equal(completionPayload.receipt.status, "completed");
    assert.equal(completionPayload.receipt.event_type, "stream_complete");
    assert.equal(completionPayload.receipt.reason_code, "result_emitted");
    assert.equal(completionPayload.receipt.bytes_written > 0, true);
    assert.equal(completionPayload.receipt.frames_attempted >= 2, true);
    assert.equal(completionPayload.receipt.frames_written >= 2, true);
    assert.equal(JSON.stringify([startPayload.receipt, completionPayload.receipt]).includes("w0099_route_secret_sentinel"), false);
    assert.equal(JSON.stringify([startPayload.receipt, completionPayload.receipt]).includes("stream-route-key-1"), false);

    const persisted = fs.readFileSync(receiptPath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.equal(persisted.length, 2);
    assert.deepEqual(persisted.map((receipt) => receipt.event_type), ["stream_start", "stream_complete"]);
    assert.equal(JSON.stringify(persisted).includes("w0099_route_secret_sentinel"), false);
  } finally {
    await started.stop();
    if (oldBackend === undefined) {
      delete process.env.DIZZY_CHAT_BACKEND;
    } else {
      process.env.DIZZY_CHAT_BACKEND = oldBackend;
    }
    fs.rmSync(receiptPath, { force: true });
  }
}

async function testAgentExecuteStreamPartialFailureReceipt() {
  const oldBackend = process.env.DIZZY_CHAT_BACKEND;
  const receiptPath = path.resolve(process.cwd(), "runtime", "test-stream-partial-failure-receipts.jsonl");
  fs.rmSync(receiptPath, { force: true });
  delete process.env.DIZZY_CHAT_BACKEND;

  const started = await startServer({
    port: 0,
    bindHost: "127.0.0.1",
    authToken: STRONG_TEST_AUTH_TOKEN,
    redisUrl: "",
    streamReceiptPath: receiptPath,
    streamMaxFrameBytes: 256 * 1024,
    streamMaxResultFrameBytes: 24,
  });

  try {
    const response = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${STRONG_TEST_AUTH_TOKEN}`,
        "idempotency-key": "partial-failure-key",
      },
      body: JSON.stringify({
        brief: "trigger partial failure without persisting w0099_partial_failure_sentinel",
        continuity_mode: "ephemeral",
      }),
    });

    assert.equal(response.status, 200);
    const events = parseSseEvents(await response.text());
    assert.deepEqual(events.map((event) => event.event), ["stream_receipt"]);

    const persisted = fs.readFileSync(receiptPath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.deepEqual(persisted.map((receipt) => receipt.event_type), ["stream_start", "stream_partial_failure"]);
    assert.equal(persisted[1].status, "failed");
    assert.equal(persisted[1].reason_code, "result_frame_too_large");
    assert.equal(persisted[1].error_code, "FRAME_TOO_LARGE");
    assert.notEqual(persisted[0].event_id, persisted[1].event_id);
    assert.equal(JSON.stringify(persisted).includes("w0099_partial_failure_sentinel"), false);
  } finally {
    await started.stop();
    if (oldBackend === undefined) {
      delete process.env.DIZZY_CHAT_BACKEND;
    } else {
      process.env.DIZZY_CHAT_BACKEND = oldBackend;
    }
    fs.rmSync(receiptPath, { force: true });
  }
}

async function testAgentExecuteStreamAbortCancelsProvider() {
  const oldEnv = {
    backend: process.env.DIZZY_CHAT_BACKEND,
    baseUrl: process.env.OPENAI_COMPAT_BASE_URL,
    apiKey: process.env.OPENAI_COMPAT_API_KEY,
    model: process.env.OPENAI_COMPAT_MODEL,
    timeoutMs: process.env.OPENAI_COMPAT_TIMEOUT_MS,
  };
  const receiptPath = path.resolve(process.cwd(), "runtime", "test-stream-abort-receipts.jsonl");
  fs.rmSync(receiptPath, { force: true });

  let providerRequests = 0;
  let providerClosedBeforeReply = false;
  const provider = http.createServer((req, res) => {
    providerRequests += 1;
    req.resume();
    res.on("close", () => {
      if (!res.writableEnded) providerClosedBeforeReply = true;
    });
    setTimeout(() => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "late provider reply" } }] }));
    }, 5000);
  });
  const providerBaseUrl = await listenLocal(provider);

  process.env.DIZZY_CHAT_BACKEND = "openai_compat";
  process.env.OPENAI_COMPAT_BASE_URL = providerBaseUrl;
  process.env.OPENAI_COMPAT_API_KEY = "fixture-key";
  process.env.OPENAI_COMPAT_MODEL = "fixture-model";
  process.env.OPENAI_COMPAT_TIMEOUT_MS = "30000";

  const started = await startServer({
    port: 0,
    bindHost: "127.0.0.1",
    authToken: STRONG_TEST_AUTH_TOKEN,
    redisUrl: "",
    streamReceiptPath: receiptPath,
  });

  const controller = new AbortController();

  try {
    const response = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${STRONG_TEST_AUTH_TOKEN}`,
        "idempotency-key": "abort-provider-key",
      },
      body: JSON.stringify({
        brief: "slow provider abort should not persist w0099_abort_secret_sentinel",
        continuity_mode: "ephemeral",
      }),
      signal: controller.signal,
    });

    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const first = await reader.read();
    assert.equal(first.done, false);
    const firstText = new TextDecoder().decode(first.value);
    assert.match(firstText, /event: stream_receipt/);

    await waitFor(() => providerRequests === 1, "provider request");
    controller.abort("fixture_client_disconnect");
    try {
      await reader.read();
    } catch {
      // Either rejection or a closed reader is acceptable after client abort.
    }

    await waitFor(() => providerClosedBeforeReply, "provider connection close", 4000);
    await waitFor(() => fs.existsSync(receiptPath) && fs.readFileSync(receiptPath, "utf8").includes("client_disconnect"), "client disconnect receipt", 4000);

    const persisted = fs.readFileSync(receiptPath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.equal(persisted.some((receipt) => receipt.event_type === "client_disconnect"), true);
    assert.equal(new Set(persisted.map((receipt) => receipt.event_id)).size, persisted.length);
    assert.equal(JSON.stringify(persisted).includes("w0099_abort_secret_sentinel"), false);
  } finally {
    controller.abort("cleanup");
    await started.stop();
    await closeServer(provider);
    if (oldEnv.backend === undefined) delete process.env.DIZZY_CHAT_BACKEND;
    else process.env.DIZZY_CHAT_BACKEND = oldEnv.backend;
    if (oldEnv.baseUrl === undefined) delete process.env.OPENAI_COMPAT_BASE_URL;
    else process.env.OPENAI_COMPAT_BASE_URL = oldEnv.baseUrl;
    if (oldEnv.apiKey === undefined) delete process.env.OPENAI_COMPAT_API_KEY;
    else process.env.OPENAI_COMPAT_API_KEY = oldEnv.apiKey;
    if (oldEnv.model === undefined) delete process.env.OPENAI_COMPAT_MODEL;
    else process.env.OPENAI_COMPAT_MODEL = oldEnv.model;
    if (oldEnv.timeoutMs === undefined) delete process.env.OPENAI_COMPAT_TIMEOUT_MS;
    else process.env.OPENAI_COMPAT_TIMEOUT_MS = oldEnv.timeoutMs;
    fs.rmSync(receiptPath, { force: true });
  }
}

await testSseWriterBackpressureAndAbort();
await testStreamReceiptDoesNotStoreBodyValues();
await testStreamReceiptRejectsHostileFreeTextFields();
await testAgentExecuteStreamRoute();
await testAgentExecuteStreamPartialFailureReceipt();
await testAgentExecuteStreamAbortCancelsProvider();

console.log("STREAMING_RESPONSE_TEST_OK suites=6");
