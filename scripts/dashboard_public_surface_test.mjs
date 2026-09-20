import assert from "assert";
import fs from "fs";

import { startServer } from "../agent_server.mjs";

const DASHBOARD_HTML = "dashboard/index.html";
const DASHBOARD_JS = "dashboard/dashboard.js";
const DASHBOARD_LOGIN_JS = "dashboard/dashboard-login.js";
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
  const loginJsSource = fs.readFileSync(DASHBOARD_LOGIN_JS, "utf8");
  assertNoDecorativeSurfaceTerms(htmlSource, DASHBOARD_HTML);
  assertNoDecorativeSurfaceTerms(jsSource, DASHBOARD_JS);
  assertAscii(htmlSource, DASHBOARD_HTML);
  assertAscii(jsSource, DASHBOARD_JS);
  assertAscii(loginJsSource, DASHBOARD_LOGIN_JS);
  assertInitialDashboardTruthfulness(htmlSource);
  assert(htmlSource.includes('<meta name="description"'), "dashboard should include a factual meta description");
  assert(htmlSource.includes("<title>Dizzy Local Operator Dashboard</title>"), "dashboard title should identify the local operator surface");
  assert(htmlSource.includes("Receipt &amp; Capability Evidence"), "dashboard should label receipts as evidence rather than broad proof");
  assert(htmlSource.includes('id="latest-council-git-binding"'), "dashboard should expose the council receipt Git binding");
  assert(htmlSource.includes('id="btn-refresh-telemetry"'), "dashboard should provide a refresh affordance for telemetry");
  assert(htmlSource.includes('id="latest-council-freshness-badge"'), "dashboard should expose a council freshness badge");
  assert(htmlSource.includes('id="telemetry-observed-time"'), "dashboard should display an observation timestamp");
  assert(htmlSource.includes('id="latest-council-freshness-detail"'), "dashboard should display freshness detail");
  assert(jsSource.includes("council_freshness"), "dashboard should process council freshness metadata");
  assert(jsSource.includes("telemetry_generated_at"), "dashboard should process telemetry generation timestamps");
  assert(htmlSource.includes("Reported Route Circuit Breakers (Demonstration Data)"), "dashboard circuit-breaker heading should be report-scoped");
  assert(htmlSource.includes("Reported Latency-Cost-Trust Map"), "dashboard route map heading should be report-scoped");
  assert(!htmlSource.includes("Receipt &amp; Capability Proof"), "dashboard should not use broad proof language for receipts");
  assert(!jsSource.includes("Capability Proof"), "dashboard chat receipts should use evidence language");
  assert(!htmlSource.includes("Live Route Circuit Breakers"), "dashboard should not label demonstration circuit-breaker data as live");
  assert(!htmlSource.includes("Latency-Cost-Trust Pareto Frontier HUD"), "dashboard should not over-style demo telemetry as a frontier HUD");
  assert(htmlSource.includes('role="tablist"'), "dashboard tabs should expose a tablist role");
  assert(htmlSource.includes('role="tabpanel"'), "dashboard panels should expose tabpanel roles");
  assert(htmlSource.includes('class="sr-only" for="chat-input-text"'), "chat input should have a screen-reader label");
  assert(htmlSource.includes('class="sr-only" for="search-query"'), "search input should have a screen-reader label");
  assert(htmlSource.includes("@media (max-width: 760px)"), "dashboard should include a mobile layout breakpoint");
  assert(htmlSource.includes('id="routing-policy-status-summary"'), "receipts view should expose routing policy status summary");
  assert(htmlSource.includes('id="routing-policy-tier-summary"'), "receipts view should expose selected routing tier summary");
  assert(!/<div class="tab(?:\s|")/.test(htmlSource), "dashboard tab controls should be buttons, not inert divs");
  assert(jsSource.includes("chatSurfaceInitialized"), "chat surface initializer should be idempotent");
  assert(jsSource.includes("fetchJson(`/api/dashboard-query"), "dashboard search should use explicit non-OK fetch handling");
  assert(jsSource.includes("formatFetchError"), "dashboard should preserve HTTP status and reason codes in visible errors");
  assert(jsSource.includes('setAttribute("aria-busy", "true")'), "dashboard buttons should expose busy states");
  assert(jsSource.includes('setAttribute("aria-selected"'), "dashboard tab state should update aria-selected");
  assert(jsSource.includes('toggleAttribute("hidden"'), "dashboard tab state should hide inactive panels");
  assert(jsSource.includes("routingPolicySummaryHtml"), "receipt history should render routing policy details");
  assert(jsSource.includes("selected_model_or_route"), "receipt history should show selected route facts");
  assert(jsSource.includes("provider_invoked"), "receipt history should show whether a provider was invoked");
  assert(jsSource.includes("downgrade_reason"), "receipt history should show downgrade reason");
  assert(jsSource.includes("fail_closed_reason"), "receipt history should show fail-closed reason");
  assert(jsSource.includes("git_binding"), "receipt telemetry should project council receipt Git binding facts");
  assert(loginJsSource.includes('setAttribute("aria-busy", "true")'), "login form should expose a busy state while submitting");
  assert(!jsSource.includes("Local route available"), "dashboard must not invent route availability when telemetry is missing");
  assert(!jsSource.includes("Runtime Online"), "dashboard should report reachability, not broad runtime health");
  assert(jsSource.includes("Route unverified"), "dashboard should use unverified route language before capability evidence");
  assert(jsSource.includes("Dispatch blocked or unavailable"), "dashboard chat failures should not look like successful acknowledgements");
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

    const loginPage = await fetchText(`${base}/dashboard/login`, {
      headers: { accept: "text/html" },
    });
    assertStatus(loginPage.response, 200, "dashboard login");
    assert(loginPage.text.includes('for="dashboard-token"'), "dashboard login token field should have an explicit label");
    assert(loginPage.text.includes('aria-describedby="login-error"'), "dashboard login input should reference the error region");
    assert(loginPage.text.includes('aria-live="polite"'), "dashboard login error region should be announced politely");

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
    assert(script.text.includes("sessionStorage"), "dashboard chat should use browser session storage, not persistent localStorage history");
    assert(script.text.includes("clearBrowserSessionState"), "dashboard logout should clear browser-side session state");
    assert(!script.text.includes('localStorage.setItem("dizzy_chat_history"'), "dashboard must not write legacy persistent chat history");
    assert(!script.text.includes('localStorage.getItem("dizzy_chat_history"'), "dashboard must not load legacy persistent chat history");
    assert(dashboard.text.includes('id="btn-dashboard-logout"'), "dashboard should expose a visible logout control");
    assert(dashboard.text.includes("Session history"), "dashboard should disclose browser session history scope");

    const cookieChat = await fetch(`${base}/dispatch/incoming`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        "idempotency-key": "invalid key with spaces",
        origin: base,
      },
      body: JSON.stringify({ channel: "dashboard_chat", text: "cookie-auth validation probe" }),
    });
    assertStatus(cookieChat, 400, "dashboard cookie dispatch validation");
    const cookieChatBody = await cookieChat.json();
    assert.match(cookieChatBody.error, /Invalid Idempotency-Key/i);

    const cookieNoOrigin = await fetch(`${base}/dispatch/incoming`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel: "dashboard_chat", text: "missing-origin validation probe" }),
    });
    assertStatus(cookieNoOrigin, 403, "dashboard cookie dispatch same-origin guard");
    const cookieNoOriginBody = await cookieNoOrigin.json();
    assert.equal(cookieNoOriginBody.code, "DASHBOARD_CHAT_SCOPE_REQUIRED");

    const cookieTool = await fetch(`${base}/dispatch/incoming`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        origin: base,
      },
      body: JSON.stringify({ channel: "dashboard_chat", text: "tool:http_get https://example.com" }),
    });
    assertStatus(cookieTool, 403, "dashboard cookie dispatch tool scope");
    const cookieToolBody = await cookieTool.json();
    assert.equal(cookieToolBody.code, "DASHBOARD_CHAT_SCOPE_REQUIRED");

    const missingApi = await fetch(`${base}/api/not-a-real-route`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    assertStatus(missingApi, 404, "missing API route");
    assert((missingApi.headers.get("content-type") || "").includes("application/json"), "missing API route should return JSON");
    const missingApiBody = await missingApi.json();
    assert.deepEqual(missingApiBody, {
      ok: false,
      code: "ROUTE_NOT_FOUND",
      error: "Route not found",
      route_type: "api",
      method: "GET",
    });

    const missingDashboard = await fetchText(`${base}/dashboard/not-a-real-page`, {
      headers: { ...headers, accept: "text/html" },
    });
    assertStatus(missingDashboard.response, 404, "missing dashboard route");
    assert((missingDashboard.response.headers.get("content-type") || "").includes("text/html"), "missing dashboard route should return HTML");
    assert(missingDashboard.text.includes("<title>Dizzy Route Not Found</title>"), "missing dashboard route should explain the route state");
    assert(!/stack|trace|agent_server|internal server error/i.test(missingDashboard.text), "missing dashboard route must not expose stack details");

    const apiRoutes = [
      "/api/dashboard-data",
      "/api/operator/hardware-status",
      "/api/operator/receipts-telemetry",
      "/api/operator/tension-map",
      "/api/operator/job-opportunities",
      "/api/operator/council-bridge-status",
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
