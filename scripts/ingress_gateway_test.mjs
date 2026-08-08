import assert from "node:assert/strict";
import {
  createProviderCircuitBreaker,
  reserveFixedWindowQuota,
  reserveTokenBudget,
  selectProviderWithCircuit,
} from "../lib/ingress_gateway.mjs";
import { startServer } from "../agent_server.mjs";

console.log("=== W-0067 Ingress Gateway Test Suite ===");

const quotaBuckets = new Map();
const firstQuota = reserveFixedWindowQuota(quotaBuckets, "client-a", { windowMs: 1000, max: 1 }, 100);
assert.equal(firstQuota.allowed, true);
assert.equal(firstQuota.remaining, 0);
const secondQuota = reserveFixedWindowQuota(quotaBuckets, "client-a", { windowMs: 1000, max: 1 }, 101);
assert.equal(secondQuota.allowed, false);
assert.equal(secondQuota.retryAfterMs, 999);
const resetQuota = reserveFixedWindowQuota(quotaBuckets, "client-a", { windowMs: 1000, max: 1 }, 1101);
assert.equal(resetQuota.allowed, true);

const budgetBuckets = new Map();
const firstBudget = reserveTokenBudget(budgetBuckets, "client-a", { windowMs: 1000, max: 2, requestCost: 2 }, 0);
assert.equal(firstBudget.allowed, true);
assert.equal(firstBudget.remaining, 0);
const blockedBudget = reserveTokenBudget(budgetBuckets, "client-a", { windowMs: 1000, max: 2, requestCost: 2 }, 100);
assert.equal(blockedBudget.allowed, false);
assert.ok(blockedBudget.retryAfterMs > 0);
const refilledBudget = reserveTokenBudget(budgetBuckets, "client-a", { windowMs: 1000, max: 2, requestCost: 2 }, 1100);
assert.equal(refilledBudget.allowed, true);

let now = 0;
const circuit = createProviderCircuitBreaker({
  failureThreshold: 2,
  cooldownMs: 1000,
  halfOpenSuccessThreshold: 1,
  nowFn: () => now,
});
assert.equal(circuit.canRequest("gemini"), true);
circuit.recordFailure("gemini");
assert.equal(circuit.snapshot("gemini").state, "closed");
circuit.recordFailure("gemini");
assert.equal(circuit.snapshot("gemini").state, "open");
assert.equal(circuit.canRequest("gemini"), false);
assert.deepEqual(
  selectProviderWithCircuit({ circuit, primary: "gemini", fallback: "local_ollama" }),
  { provider: "local_ollama", usedFallback: true, reason: "primary_circuit_open" },
);
now = 1001;
assert.equal(circuit.canRequest("gemini"), true);
assert.equal(circuit.snapshot("gemini").state, "half_open");
circuit.recordSuccess("gemini");
assert.equal(circuit.snapshot("gemini").state, "closed");

const started = await startServer({
  port: 0,
  bindHost: "127.0.0.1",
  authToken: "",
  redisUrl: "",
  rateLimitEnabled: false,
  ingressBudgetEnabled: true,
  ingressBudgetWindowMs: 60000,
  ingressBudgetMax: 1,
  ingressBudgetRequestCost: 1,
});

try {
  const baseUrl = `http://127.0.0.1:${started.boundPort}`;
  const health = await fetch(`${baseUrl}/health`).then((r) => r.json());
  assert.equal(health.ok, true);
  assert.equal(health.ingress_budget.enabled, true);
  assert.equal(health.ingress_budget.health_exempted, true);

  const first = await fetch(`${baseUrl}/governance`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-dizzy-ingress-budget-limit"), "1");
  assert.equal(first.headers.get("x-dizzy-ingress-budget-remaining"), "0");

  const second = await fetch(`${baseUrl}/governance`);
  assert.equal(second.status, 429);
  const body = await second.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /Ingress budget/i);
  assert.ok(second.headers.get("retry-after"));
} finally {
  await started.stop();
}

console.log("INGRESS_GATEWAY_TESTS_OK");
