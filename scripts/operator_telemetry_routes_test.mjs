import assert from "node:assert/strict";
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
    assert.ok(data.count >= 3);
    assert.equal(data.opportunities[0].opportunity.schema_version, JOB_BOARD_INGRESS_SCHEMA);
    assert.equal(data.opportunities[0].task_conversion.qualified, true);
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

  console.log("\n[test:operator-telemetry-routes] ALL TESTS PASSED CLEANLY.\n");
} finally {
  await runtime.stop?.();
}
