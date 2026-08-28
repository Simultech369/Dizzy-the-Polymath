import assert from "node:assert/strict";
import { startServer } from "../agent_server.mjs";
import { TENSION_MAP_SCHEMA } from "../lib/tension_map_engine.mjs";
import { JOB_BOARD_INGRESS_SCHEMA } from "../lib/job_board_ingress.mjs";

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

  console.log("\n[test:operator-telemetry-routes] ALL TESTS PASSED CLEANLY.\n");
} finally {
  await runtime.stop?.();
}
