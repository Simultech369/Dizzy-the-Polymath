import assert from "assert";
import fs from "fs";

import { startServer } from "../agent_server.mjs";

const DASHBOARD_HTML = "dashboard/index.html";
const DASHBOARD_JS = "dashboard/dashboard.js";
const TOKEN = "local-public-surface-token-0123456789";

function assertStatus(response, expected, label) {
  assert.strictEqual(
    response.status,
    expected,
    `${label} returned ${response.status}; expected ${expected}`,
  );
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

function assertNoDecorativeSurfaceTerms(text, label) {
  const banned = [
    "linear-gradient",
    "radial-gradient",
    "box-shadow",
    "text-shadow",
    "backdrop-filter",
    "@keyframes",
    "animation:",
    "pulse",
    "glow",
    "neon",
    "Glassmorphic",
  ];
  for (const term of banned) {
    assert(
      !text.includes(term),
      `${label} still contains decorative surface term: ${term}`,
    );
  }
}

function assertAscii(text, label) {
  assert(
    /^[\x00-\x7F]*$/.test(text),
    `${label} contains non-ASCII characters`,
  );
}

function assertInitialDashboardTruthfulness(html) {
  assert(html.includes("Checking Local Runtime"), "dashboard should start with neutral runtime status");
  assert(html.includes("Route unverified"), "dashboard should not claim a model route before local telemetry");
  assert(html.includes("Awaiting telemetry"), "dashboard should show explicit pending telemetry states");
  assert(html.includes("Record Simulated Sign-Off"), "operator sign-off action should be labeled as simulated");
  assert(html.includes("Record Simulated Veto"), "operator veto action should be labeled as simulated");

  const optimisticDefaults = [
    "LOCAL / GEMMA 3",
    "I am online",
    "All Routes Operational</span>",
    "8/8 BLOCKED",
    "100% RESTRAINT",
    "Score: 1.0</span>",
  ];
  for (const phrase of optimisticDefaults) {
    assert(!html.includes(phrase), `dashboard initial HTML overclaims before telemetry: ${phrase}`);
  }
}

async function run() {
  console.log("=== W-0105 Dashboard Public Surface Test Suite ===");

  const htmlSource = fs.readFileSync(DASHBOARD_HTML, "utf8");
  const jsSource = fs.readFileSync(DASHBOARD_JS, "utf8");
  assertNoDecorativeSurfaceTerms(htmlSource, DASHBOARD_HTML);
  assertNoDecorativeSurfaceTerms(jsSource, DASHBOARD_JS);
  assertAscii(htmlSource, DASHBOARD_HTML);
  assertAscii(jsSource, DASHBOARD_JS);
  assertInitialDashboardTruthfulness(htmlSource);
  assert(jsSource.includes("chatSurfaceInitialized"), "chat surface initializer should be idempotent");
  assert(jsSource.includes("fetchJson(`/api/dashboard-query"), "dashboard search should use explicit non-OK fetch handling");
  assert(!jsSource.includes("\"8/8 Blocked\""), "dashboard adversarial status should be receipt-derived, not hardcoded");

  const started = await startServer({
    port: 0,
    bindHost: "127.0.0.1",
    dashboardEnabled: true,
    authToken: TOKEN,
    publicSurfaceMode: "closed",
    redisUrl: "",
  });

  try {
    const base = `http://127.0.0.1:${started.boundPort}`;
    const health = await fetch(`${base}/health`);
    assertStatus(health, 200, "health");

    const unauthDashboard = await fetch(`${base}/dashboard`, {
      headers: { accept: "text/html" },
      redirect: "manual",
    });
    assertStatus(unauthDashboard, 401, "unauthenticated dashboard");

    const session = await fetch(`${base}/dashboard/session`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: base,
      },
      body: new URLSearchParams({ token: TOKEN }),
    });
    assertStatus(session, 303, "dashboard session");
    const cookie = String(session.headers.get("set-cookie") || "").split(";")[0];
    assert(cookie.startsWith("dizzy_dashboard_session="), "dashboard session should set HttpOnly session cookie");

    const headers = { cookie };
    const dashboard = await fetchText(`${base}/dashboard`, { headers });
    assertStatus(dashboard.response, 200, "authenticated dashboard");
    assert(dashboard.text.includes("data-tab-target"), "dashboard HTML should include tab controls");
    assert(dashboard.text.includes("Checking Local Runtime"), "dashboard response should preserve neutral startup state");

    const script = await fetchText(`${base}/assets/dashboard.js`, { headers });
    assertStatus(script.response, 200, "dashboard script");
    assert(script.text.includes("chatSurfaceInitialized"), "served dashboard script should include idempotent chat guard");

    const apiRoutes = [
      "/api/dashboard-data",
      "/api/operator/hardware-status",
      "/api/operator/receipts-telemetry",
      "/api/operator/tension-map",
      "/api/operator/job-opportunities",
    ];
    for (const route of apiRoutes) {
      const response = await fetch(`${base}${route}`, { headers });
      assertStatus(response, 200, route);
      const contentType = response.headers.get("content-type") || "";
      assert(contentType.includes("application/json"), `${route} should return JSON`);
      await response.text();
    }
  } finally {
    await started.stop();
  }

  console.log("DASHBOARD_PUBLIC_SURFACE_TESTS_OK");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
