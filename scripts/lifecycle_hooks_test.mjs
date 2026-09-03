import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  LifecycleHookError,
  createLifecycleHookManager,
  runWithToolLifecycle,
} from "../lib/lifecycle_hooks.mjs";
import { createIngressGatewayMiddleware } from "../lib/ingress_gateway.mjs";
import { runToolJob } from "../lib/tools.mjs";

const receipts = [];
let now = 1_800_000_000_000;
const hooks = createLifecycleHookManager({
  writer: (receipt) => receipts.push(receipt),
  nowFn: () => {
    now += 10;
    return now;
  },
});

const req = {
  path: "/dispatch/incoming",
  originalUrl: "/dispatch/incoming?token=do-not-log",
  method: "POST",
  headers: {},
  socket: { remoteAddress: "127.0.0.1" },
  body: { runtime_context: { trust_zone: "private_self" } },
};
const res = new EventEmitter();
res.statusCode = 200;
res.headers = {};
res.setHeader = (key, value) => {
  res.headers[String(key).toLowerCase()] = String(value);
};

const middleware = createIngressGatewayMiddleware({ rateLimit: { enabled: false }, budget: { enabled: false } }, { lifecycleHooks: hooks });
let nextCalled = false;
middleware(req, res, () => {
  nextCalled = true;
});
assert.equal(nextCalled, true, "ingress lifecycle middleware should continue allowed requests");
res.emit("finish");

assert.equal(receipts[0].schema_version, "dizzy.lifecycle_hook.v1");
assert.equal(receipts[0].phase, "SESSION_START");
assert.equal(receipts[0].route, "/dispatch/incoming");
assert.equal(receipts[1].phase, "STOP");
assert.equal(JSON.stringify(receipts).includes("do-not-log"), false, "session receipts must not store raw query tokens");

const okResult = await runWithToolLifecycle(
  { id: "job_ok", type: "tool", tool: "cheerio_extract", payload: {} },
  async () => {
    throw Object.assign(new Error("Missing payload.url"), { code: "EXPECTED_FIXTURE_ERROR" });
  },
  { lifecycleHooks: hooks, actorId: "fixture_worker", sessionId: "fixture_session" },
).catch((error) => error);
assert.equal(okResult.code, "EXPECTED_FIXTURE_ERROR");
assert.equal(receipts.at(-2).phase, "PRE_TOOL_USE");
assert.equal(receipts.at(-2).decision, "allowed");
assert.equal(receipts.at(-1).phase, "POST_TOOL_USE");
assert.equal(receipts.at(-1).outcome, "failed");

await assert.rejects(
  () => runToolJob(
    { id: "job_shell", type: "tool", tool: "shell", payload: { command: "echo should-not-run", cookie: "session=secret" } },
    { lifecycleHooks: hooks, actorId: "fixture_worker", sessionId: "blocked_session" },
  ),
  (error) => {
    assert.ok(error instanceof LifecycleHookError);
    assert.equal(error.code, "LIFECYCLE_PRE_TOOL_REJECTED");
    return true;
  },
);
assert.equal(receipts.at(-1).phase, "PRE_TOOL_USE");
assert.equal(receipts.at(-1).decision, "rejected");
assert.equal(JSON.stringify(receipts).includes("should-not-run"), false, "tool receipts must hash command payloads instead of storing them");
assert.equal(JSON.stringify(receipts).includes("session=secret"), false, "tool receipts must not store ambient session material");

console.log(`LIFECYCLE_HOOKS_TEST_OK receipts=${receipts.length}`);
