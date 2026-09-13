import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer } from "../agent_server.mjs";
import { TENSION_MAP_SCHEMA } from "../lib/tension_map_engine.mjs";
import { JOB_BOARD_INGRESS_SCHEMA } from "../lib/job_board_ingress.mjs";
import { COUNCIL_BRIDGE_STATUS_SCHEMA } from "../lib/council_bridge_status.mjs";

console.log("[test:operator-telemetry-routes] Starting test suite...");

const TEST_AUTH_TOKEN = "test-auth-token-32-chars-minimum-safe";

async function getJson(url, token = TEST_AUTH_TOKEN) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  const data = await res.json();
  return { status: res.status, data };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-operator-telemetry-"));
const receiptPath = path.join(tempRoot, "router_receipts.jsonl");
const oldReceiptPath = process.env.DIZZY_ROUTER_RECEIPT_PATH;
process.env.DIZZY_ROUTER_RECEIPT_PATH = receiptPath;

const routingReceiptHash = "a".repeat(64);
fs.writeFileSync(receiptPath, JSON.stringify({
  schema_version: "dizzy.router_receipt.v1",
  task_id: "routing-telemetry-fixture",
  timestamp: "2026-09-13T19:50:00.000Z",
  task_class: "route_classify",
  chosen_model: "openai_compat:gemma3:4b",
  trust_zone: "paid_public",
  estimated_cost_band: "low",
  data_boundary: "local_machine",
  model_origin_risk: "low",
  latency_ms: 42,
  provider_health: "healthy",
  persisted: true,
  routing_policy: {
    status: "SUCCEEDED",
    task_class: "chat",
    surface_id: "dispatch",
    requested_model: "gemma3:4b",
    selected_tier: "T2",
    selected_model_or_route: "openai_compat:gemma3:4b",
    provider_invoked: true,
    routing_receipt_sha256: routingReceiptHash,
    attempts: [{
      route_id: "openai_compat:gemma3:4b",
      model_id: "gemma3:4b",
      status: "SUCCEEDED",
      sent_model: "gemma3:4b",
      reported_model: "gemma3:4b",
      usage_known: false,
    }],
  },
}) + "\n", "utf8");

const runtime = await startServer({
  port: 0,
  bindHost: "127.0.0.1",
  authToken: TEST_AUTH_TOKEN,
  dashboardEnabled: true,
  corsOrigins: [],
});

const baseUrl = `http://127.0.0.1:${runtime.boundPort}`;

try {
  // Test 1: GET /api/operator/tension-map returns valid schema and SVG
  {
    const { status, data } = await getJson(`${baseUrl}/api/operator/tension-map?topic_id=test_run_01`);
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.tension_map.schema_version, TENSION_MAP_SCHEMA);
    assert.equal(data.tension_map.topic_id, "test_run_01");
    assert.ok(data.svg.includes("<svg"));
    assert.ok(data.svg.includes("ELEGANCE"));
    console.log("  [PASS] Test 1: GET /api/operator/tension-map");
  }

  // Test 2: GET /api/operator/job-opportunities returns normalized feeds
  {
    const { status, data } = await getJson(`${baseUrl}/api/operator/job-opportunities`);
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.sample_only, true);
    assert.ok(data.count >= 3);
    assert.equal(data.opportunities[0].sample_only, true);
    assert.equal(data.opportunities[0].opportunity.schema_version, JOB_BOARD_INGRESS_SCHEMA);
    assert.equal(data.opportunities[0].opportunity.claimability_state, "unverified");
    assert.equal(data.opportunities[0].opportunity.payout_usd_est, null);
    assert.ok(typeof data.opportunities[0].opportunity.salary_or_payout === "string");
    assert.equal(data.opportunities[0].task_conversion.qualified, false);
    assert.equal(data.opportunities[0].task_conversion.eligibility_state, "needs_verification");
    assert.equal(data.opportunities[0].task_conversion.ev_receipt.recommendation, "NEEDS_VERIFICATION");
    console.log("  [PASS] Test 2: GET /api/operator/job-opportunities");
  }

  // Test 3: GET /api/operator/council-bridge-status shows the local/rehearsal bridge posture
  {
    const { status, data } = await getJson(`${baseUrl}/api/operator/council-bridge-status`);
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.bridge_status.schema_version, COUNCIL_BRIDGE_STATUS_SCHEMA);
    assert.equal(data.bridge_status.status, "LOCAL_REHEARSAL_COMPONENTS_VISIBLE");
    assert.equal(data.bridge_status.bridge_mode, "local_rehearsal");
    assert.equal(data.bridge_status.integration_state, "component_status_only");
    assert.equal(data.bridge_status.runtime_promotion_allowed, false);
    assert.equal(data.bridge_status.public_claim_allowed, false);
    assert.equal(data.bridge_status.auth_boundary, "operator_token_or_dashboard_session_required");
    assert.equal(data.bridge_status.a2a_ingress.auth_configured, false);
    assert.equal(data.bridge_status.a2a_ingress.route_posture, "fail_closed_until_a2a_secret_or_trust_store");
    assert.equal(data.bridge_status.mailbox.require_signature, true);
    assert.equal(data.bridge_status.mailbox.signed_envelope_policy, "required_by_queue");
    assert.ok(data.bridge_status.component_map.some((step) => step.route === "/api/a2a/incoming"));
    assert.ok(data.bridge_status.component_map.some((step) => step.step === "sidecar_rehearsal"));
    assert.ok(data.bridge_status.observed_operations.some((item) => item.operation === "a2a_ingress_auth_configuration" && item.status === "fail_closed_unconfigured"));
    assert.ok(data.bridge_status.observed_operations.some((item) => item.operation === "continuous_mailbox_to_sidecar_worker" && item.status === "not_observed"));
    assert.ok(data.bridge_status.open_blockers.includes("W-0091 non-mock sandbox proof"));
    console.log("  [PASS] Test 3: GET /api/operator/council-bridge-status");
  }

  // Test 4: status route remains behind the operator/dashboard auth boundary
  {
    const { status, data } = await getJson(`${baseUrl}/api/operator/council-bridge-status`, "");
    assert.equal(status, 401);
    assert.equal(data.ok, false);
    assert.match(data.error, /unauthorized/i);
    console.log("  [PASS] Test 4: unauthenticated council bridge status is rejected");
  }

  // Test 5: status route fails closed when no operator token is configured
  {
    const noTokenRuntime = await startServer({
      port: 0,
      bindHost: "127.0.0.1",
      authToken: "",
      dashboardEnabled: true,
      corsOrigins: [],
    });
    try {
      const { status, data } = await getJson(`http://127.0.0.1:${noTokenRuntime.boundPort}/api/operator/council-bridge-status`, "");
      assert.equal(status, 503);
      assert.equal(data.ok, false);
      assert.equal(data.code, "LOCAL_CONTROL_AUTH_REQUIRED");
    } finally {
      await noTokenRuntime.stop?.();
    }
    console.log("  [PASS] Test 5: unconfigured council bridge status fails closed");
  }

  // Test 6: receipts telemetry exposes capability-first routing facts without relying on env reconstruction
  {
    const { status, data } = await getJson(`${baseUrl}/api/operator/receipts-telemetry`);
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.receipt_count, 1);
    assert.equal(data.summary.routing_policy_statuses.succeeded, 1);
    assert.equal(data.summary.selected_tiers.T2, 1);
    const receipt = data.recent_receipts[0];
    assert.equal(receipt.task_id, "routing-telemetry-fixture");
    assert.equal(receipt.routing_policy.status, "succeeded");
    assert.equal(receipt.routing_policy.task_class, "chat");
    assert.equal(receipt.routing_policy.surface_id, "dispatch");
    assert.equal(receipt.routing_policy.selected_tier, "T2");
    assert.equal(receipt.routing_policy.selected_model_or_route, "openai_compat:gemma3:4b");
    assert.equal(receipt.routing_policy.provider_invoked, true);
    assert.equal(receipt.routing_policy.routing_receipt_sha256, routingReceiptHash);
    assert.equal(receipt.routing_policy.attempts[0].sent_model, "gemma3:4b");
    console.log("  [PASS] Test 6: receipts telemetry exposes routing policy facts");
  }

  console.log("\n[test:operator-telemetry-routes] ALL TESTS PASSED CLEANLY.\n");
} finally {
  await runtime.stop?.();
  if (oldReceiptPath === undefined) {
    delete process.env.DIZZY_ROUTER_RECEIPT_PATH;
  } else {
    process.env.DIZZY_ROUTER_RECEIPT_PATH = oldReceiptPath;
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
