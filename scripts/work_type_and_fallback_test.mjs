import assert from "node:assert/strict";
import {
  classifyAndRouteWorkType,
  executeOrderedFallbackCascade,
  executeStructuredOutputWithRetry,
} from "../lib/work_type_router.mjs";
import { OperatorInboxStore } from "../lib/operator_inbox.mjs";
import { HitlApprovalGateway } from "../lib/hitl_approval_gateway.mjs";
import { CostKillSwitch } from "../lib/cost_kill_switch.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

console.log("=== Work-Type Router, Structured Output Retry, Fallback Cascade & Operator Inbox Suite ===");

// 1. Math & Logic routed to deterministic T0 code ($0.00 LLM cost)
const math1 = classifyAndRouteWorkType("What is (1250 * 0.18) + 42.5?");
assert.equal(math1.work_type, "deterministic_math");
assert.equal(math1.handled_deterministically, true);
assert.equal(math1.llm_invoked, false);
assert.equal(math1.answer, "267.5");

const math2 = classifyAndRouteWorkType("Calculate 15% of 4800");
assert.equal(math2.work_type, "deterministic_math");
assert.equal(math2.answer, "720");

const logic1 = classifyAndRouteWorkType("Check invariant: (120 >= 100) AND NOT (5 == 6)");
assert.equal(logic1.work_type, "deterministic_logic");
assert.equal(logic1.handled_deterministically, true);
assert.equal(logic1.llm_invoked, false);
assert.equal(logic1.answer, "true");

const council1 = classifyAndRouteWorkType("verify patch: check CWE-89 SQL injection");
assert.equal(council1.work_type, "council_verification");
assert.equal(council1.handled_deterministically, true);
assert.equal(council1.llm_invoked, false);

const nl1 = classifyAndRouteWorkType("Summarize the trade-offs between SQLite WAL mode and Redis queues.");
assert.equal(nl1.work_type, "natural_language");
assert.equal(nl1.handled_deterministically, false);
assert.equal(nl1.llm_invoked, true);

// 2. Bounded Structured-Output Validation Retry with Receipt
let callNum = 0;
const retryOk = await executeStructuredOutputWithRetry(
  async ({ attempt, previous_error }) => {
    callNum += 1;
    if (attempt === 0) return "{ malformed json";
    if (attempt === 1) {
      assert.match(previous_error, /invalid_json/);
      return JSON.stringify({ verdict: "pass" }); // missing score
    }
    assert.match(previous_error, /missing_required_fields:score/);
    return JSON.stringify({ verdict: "pass", score: 0.98 });
  },
  { required: ["verdict", "score"], types: { verdict: "string", score: "number" } },
  { maxRetries: 2 }
);
assert.equal(retryOk.ok, true);
assert.equal(retryOk.attempt_count, 3);
assert.equal(retryOk.retry_errors.length, 2);
assert.equal(retryOk.data.score, 0.98);
assert.ok(retryOk.receipt.receipt_sha256);

// 3. Ordered Provider Fallback Cascade: stronger -> weaker -> local -> cache -> degraded
const cascadeLocal = await executeOrderedFallbackCascade({
  candidates: [
    { route_id: "frontier:strong", tier_role: "stronger" },
    { route_id: "cloud:small", tier_role: "weaker" },
    { route_id: "ollama:gemma3:4b", tier_role: "local" },
  ],
  invokeCandidate: async (c) => {
    if (c.tier_role !== "local") throw new Error("upstream_503");
    return "Local model reply";
  },
});
assert.equal(cascadeLocal.ok, true);
assert.equal(cascadeLocal.degraded, true);
assert.equal(cascadeLocal.selected_source, "local");
assert.match(cascadeLocal.user_status_message, /local fallback/);

const cascadeCache = await executeOrderedFallbackCascade({
  candidates: [{ route_id: "ollama:gemma3:4b", tier_role: "local" }],
  invokeCandidate: async () => {
    throw new Error("ollama_offline");
  },
  cacheLookup: async () => "Verified cached answer",
});
assert.equal(cascadeCache.ok, true);
assert.equal(cascadeCache.selected_source, "cache");

const cascadeDown = await executeOrderedFallbackCascade({
  candidates: [{ route_id: "ollama:gemma3:4b", tier_role: "local" }],
  invokeCandidate: async () => {
    throw new Error("all_down");
  },
  cacheLookup: async () => null,
});
assert.equal(cascadeDown.ok, false);
assert.equal(cascadeDown.selected_source, "degraded_unavailable");
assert.match(cascadeDown.user_status_message, /offline or unreachable/i);

// 4. Unified Operator Inbox (approvals + spend alerts + blockers + questions)
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-inbox-test-"));
try {
  const gw = new HitlApprovalGateway({ ledgerDir: tempDir });
  gw.createCheckpoint({ actionType: "promote_candidate", actionPayload: { id: "W-0200" } });

  const cost = new CostKillSwitch({ maxCostPerSessionUsd: 1.00, maxCostPerHourUsd: 5.00 });
  cost.recordExecutionCost({ actualCostUsd: 0.85, sessionId: "default_session" }); // 85% -> triggers soft alert!

  const inboxStore = new OperatorInboxStore();
  inboxStore.addQuestion({ title: "Confirm retention window for collaborator thread?" });

  const snap = inboxStore.buildInboxSnapshot({
    hitlGateway: gw,
    costKillSwitch: cost,
    watchdogAlerts: [{ alert_id: "wd_1", reason_code: "identical_tool_spin", message: "3x repeated call" }],
    deadLetterCount: 1,
  });

  assert.equal(snap.raw_tool_logs_included, false);
  assert.equal(snap.counts.approvals, 1);
  assert.equal(snap.counts.spend_stops, 1);
  assert.equal(snap.counts.blockers, 2);
  assert.equal(snap.counts.questions, 1);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log("WORK_TYPE_AND_FALLBACK_TESTS_OK");
