import assert from "assert";
import fs from "fs";
import vm from "node:vm";

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

function assertDashboardResetStorageFailureBehavior(jsSource) {
  const start = jsSource.indexOf("let chatSurfaceInitialized = false;");
  const end = jsSource.indexOf("function clearBrowserSessionState()", start);
  assert(start >= 0 && end > start, "dashboard conversation-key helpers should remain discoverable for behavior tests");
  const helperSource = jsSource.slice(start, end);
  const oldKey = "dashboard_chat_1727000000000_oldkey";
  const context = {
    Date: { now: () => 1727000000001 },
    Math,
    sessionStorage: {
      getItem: () => oldKey,
      setItem: () => {
        throw new Error("synthetic storage write failure");
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(`${helperSource}
globalThis.beforeResetKey = getDashboardConversationKey();
globalThis.resetKey = resetDashboardConversationKey();
globalThis.afterResetKey = getDashboardConversationKey();
`, context);
  assert.equal(context.beforeResetKey, oldKey, "pre-reset reads may use the stored dashboard conversation key");
  assert.notEqual(context.resetKey, oldKey, "reset must choose a new dashboard conversation key");
  assert.equal(
    context.afterResetKey,
    context.resetKey,
    "a storage write failure must not let the old stored key override the reset in-memory key",
  );
}

async function assertLocalReviewFailureRendersReceipt(source) {
  const elements = {
    "local-review-seat-select": {
      value: "qwen_local",
      options: [{ dataset: { model: "qwen2.5-coder:7b" } }],
      selectedIndex: 0,
    },
    "local-review-subject": { value: "test_subject" },
    "local-review-goal": { value: "test_goal" },
    "local-review-text": { value: "token=abc" },
    "local-review-status": { textContent: "" },
    "local-review-summary": { textContent: "" },
    "local-review-findings": { innerHTML: "" },
    "local-review-receipt": { style: { display: "none" }, innerHTML: "" },
    "btn-run-local-review": { disabled: false, setAttribute: () => {}, removeAttribute: () => {} },
  };

  const fakeError = new Error("HTTP 502: Model parse failure");
  fakeError.status = 502;
  fakeError.code = "LOCAL_REVIEW_MODEL_ERROR";
  fakeError.body = {
    ok: false,
    status: "failed",
    error: "Model output failed parse",
    receipt: {
      seat_id: "qwen_local",
      model_id: "qwen2.5-coder:7b",
      authority: "ADVISORY_SUPPLIED_EVIDENCE_REVIEW_ONLY",
      input_sha256: "abc123hash",
      output_sha256: "def456hash",
      file_reads_observed: false,
      edits_observed: false,
      tests_observed: false,
      promotion_authority: false,
    },
  };

  const context = {
    document: {
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => [],
    },
    fetchJson: async () => {
      throw fakeError;
    },
    console,
  };

  vm.createContext(context);
  const testScript = `
${source.slice(source.indexOf("function escapeHtml"), source.indexOf("const DASHBOARD_SLASH_COMMANDS"))}
${source.slice(source.indexOf("function renderLocalReviewFindings"), source.indexOf("document.querySelectorAll(\"[data-tab-target]\")"))}
globalThis.runTest = runLocalReview;
`;
  vm.runInContext(testScript, context);
  await context.runTest();
  const receiptElem = elements["local-review-receipt"];
  const statusElem = elements["local-review-status"];
  assert.equal(receiptElem.style.display, "block", "Failed review must show receipt element");
  assert(receiptElem.innerHTML.includes("qwen_local"), "Receipt must contain seat_id");
  assert(receiptElem.innerHTML.includes("ADVISORY_SUPPLIED_EVIDENCE_REVIEW_ONLY"), "Receipt must contain authority");
  assert(statusElem.textContent.includes("Review blocked or unavailable"), "Status must retain failure message");
  assert(statusElem.textContent.includes("HTTP 502"), "Status must retain HTTP status");
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
  assertDashboardResetStorageFailureBehavior(jsSource);
  await assertLocalReviewFailureRendersReceipt(jsSource);
  assert(htmlSource.includes('<meta name="description"'), "dashboard should include a factual meta description");
  assert(htmlSource.includes("<title>Dizzy Local Operator Dashboard</title>"), "dashboard title should identify the local operator surface");
  assert(htmlSource.includes("Receipt &amp; Capability Evidence"), "dashboard should label receipts as evidence rather than broad proof");
  assert(htmlSource.includes("Router Receipt Window"), "dashboard should label receipt counts as a bounded telemetry window");
  assert(htmlSource.includes("Latest persisted receipts, not live call count"), "dashboard should explain that receipt totals are not live call counts");
  assert(htmlSource.includes("Local/open-weight council seat"), "dashboard should expose local/open-weight seat selection language");
  assert(htmlSource.includes('id="chat-seat-select"'), "dashboard should expose a council seat selector");
  assert(htmlSource.includes('id="chat-seat-smoke"'), "dashboard should expose local seat smoke evidence");
  assert(htmlSource.includes('id="chat-harness-select"'), "dashboard should expose a harness selector");
  assert(htmlSource.includes("Configured default - execution unverified"), "dashboard selector should not claim availability before receipt evidence");
  assert(htmlSource.includes('id="latest-council-git-binding"'), "dashboard should expose the council receipt Git binding");
  assert(htmlSource.includes('id="btn-refresh-telemetry"'), "dashboard should provide a refresh affordance for telemetry");
  assert(htmlSource.includes('id="latest-council-freshness-badge"'), "dashboard should expose a council freshness badge");
  assert(htmlSource.includes('id="telemetry-observed-time"'), "dashboard should display an observation timestamp");
  assert(htmlSource.includes('id="latest-council-freshness-detail"'), "dashboard should display freshness detail");
  assert(jsSource.includes("council_freshness"), "dashboard should process council freshness metadata");
  assert(jsSource.includes("telemetry_generated_at"), "dashboard should process telemetry generation timestamps");
  assert(jsSource.includes("receipt_log_total_count"), "dashboard should distinguish sampled receipt windows from total log rows");
  assert(jsSource.includes("executable_combinations"), "dashboard should populate selectable combinations from operator API evidence");
  assert(jsSource.includes("currentCouncilSelection"), "dashboard should send explicit model/harness selections when chosen");
  assert(jsSource.includes("renderSeatSmokeMatrix"), "dashboard should render recent local seat smoke evidence");
  assert(jsSource.includes("No recent local seat receipts observed"), "dashboard should avoid claiming unobserved seats are available");
  assert(jsSource.includes("Requested Seat:"), "chat receipt drawer should show requested seat");
  assert(jsSource.includes("transport started"), "chat receipt drawer should distinguish attempted transport from no-call failures");
  assert(jsSource.includes("Model Result:"), "chat receipt drawer should show model result rather than implying a local route");
  assert(jsSource.includes("Planned Route:"), "chat receipt drawer should expose the actual planned route when available");
  assert(htmlSource.includes("Reported Route Circuit Breakers (Fixture Data)"), "dashboard circuit-breaker heading should be fixture-scoped");
  assert(htmlSource.includes("Reported Latency-Cost-Trust Map"), "dashboard route map heading should be report-scoped");
  assert(htmlSource.includes("Configured Instruction Sources"), "dashboard should not label static prompt inventory as a resolved run contract");
  assert(htmlSource.includes("A complete Current Run Contract is not yet implemented"), "dashboard should not overclaim a complete resolved run contract");
  assert(htmlSource.includes("Privacy Note"), "dashboard should include a concise privacy note");
  assert(htmlSource.includes("Operator Notice"), "dashboard should include a concise operator notice");
  assert(htmlSource.includes("clearing this view or logging out does not delete them"), "privacy note should disclose server retention separately from browser view");
  assert(htmlSource.includes("Claims about reading files, changing files, or running tests require matching execution receipts"), "operator notice should bind action claims to receipts");
  assert(htmlSource.includes("Memory Index"), "dashboard should label memory as an index, not a database claim");
  assert(htmlSource.includes("Retrieval Check"), "dashboard should label retrieval as an operator check");
  assert(htmlSource.includes("data-tab-target=\"tab-console\">Console</button>"), "dashboard should expose a plain Console tab");
  assert(htmlSource.includes("data-tab-target=\"tab-governance\">Council</button>"), "dashboard should expose the council surface without over-promoting it");
  assert(htmlSource.includes("Receipt Trail"), "dashboard should use receipt trail language for observability");
  assert(htmlSource.includes("Browser View"), "dashboard should clarify the non-clickable browser transcript scope");
  assert(htmlSource.includes("Clear View"), "dashboard should distinguish clearing the browser view from server retention");
  assert(htmlSource.includes("Reset Conversation"), "dashboard should expose a separate conversation-reset action");
  assert(htmlSource.includes("Retrieval queries require the dashboard token"), "retrieval sieve should explain authorization boundaries");
  assert(htmlSource.includes("Simulation only:"), "governance fixture should be visibly simulation-scoped");
  assert(htmlSource.includes("Review Supplied Evidence"), "council tab should expose bounded local review as a real operator action");
  assert(htmlSource.includes('id="local-review-seat-select"'), "local review surface should expose an explicit review seat selector");
  assert(htmlSource.includes("Advisory local review only"), "local review surface should state advisory-only authority");
  assert(htmlSource.includes("no file reads, edits, tests, commits, or promotion authority"), "local review surface should disclose negative guarantees");
  assert(jsSource.includes("DASHBOARD_SLASH_COMMANDS"), "dashboard slash command presets should be explicit, not decorative chips");
  assert(jsSource.includes("hasOwnProperty.call(DASHBOARD_SLASH_COMMANDS"), "dashboard slash command lookup must reject inherited properties");
  assert(jsSource.includes("getDashboardConversationKey"), "dashboard dispatch should carry a scoped server conversation key");
  assert(jsSource.includes("chatViewGeneration"), "dashboard reset should fence off stale pending responses");
  assert(jsSource.includes("volatileDashboardConversationKeyAuthoritative"), "dashboard reset key should remain authoritative after partial storage failure");
  assert(jsSource.includes("runLocalReview"), "dashboard should wire the local review action separately from chat");
  assert(jsSource.includes("/api/operator/local-review"), "dashboard local review action should call the bounded review endpoint");
  assert(jsSource.includes("No file reads observed") === false, "dashboard should render negative guarantees from receipts rather than hard-coded success prose");
  assert(!jsSource.includes('return "dashboard_chat";'), "dashboard storage fallback must not collapse into the shared server conversation key");
  assert(jsSource.includes("Waiting for selected route and receipt"), "chat loading text should not claim memory graph access before receipt evidence");
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
    assert(dashboard.text.includes("Browser View"), "dashboard should disclose browser view scope");

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

    const cookieSelection = await fetch(`${base}/dispatch/incoming`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        origin: base,
      },
      body: JSON.stringify({
        channel: "dashboard_chat",
        text: "selection metadata validation probe",
        selection: { seat_id: "unknown", harness_id: "native_chat" },
      }),
    });
    assertStatus(cookieSelection, 200, "dashboard cookie dispatch selection metadata");
    const cookieSelectionBody = await cookieSelection.json();
    assert.equal(cookieSelectionBody.ok, true);
    assert.match(cookieSelectionBody.text, /seat\/harness selection is unavailable/i);
    assert.equal(cookieSelectionBody.router_receipt?.selection?.requested_seat_id, "unknown");
    assert.equal(cookieSelectionBody.router_receipt?.selection?.requested_harness_id, "native_chat");

    const cookieForeignConversation = await fetch(`${base}/dispatch/incoming`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        origin: base,
      },
      body: JSON.stringify({
        channel: "dashboard_chat",
        text: "foreign conversation validation probe",
        runtime_context: { conversation_key: "local" },
      }),
    });
    assertStatus(cookieForeignConversation, 403, "dashboard cookie dispatch foreign conversation key");
    const cookieForeignConversationBody = await cookieForeignConversation.json();
    assert.equal(cookieForeignConversationBody.code, "DASHBOARD_CHAT_SCOPE_REQUIRED");

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

    const cookieLocalReviewNoOrigin = await fetch(`${base}/api/operator/local-review`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        selection: { seat_id: "qwen_local", harness_id: "dizzy_json_review" },
        supplied_text: "same-origin required",
      }),
    });
    assertStatus(cookieLocalReviewNoOrigin, 403, "dashboard local review same-origin guard");
    const cookieLocalReviewNoOriginBody = await cookieLocalReviewNoOrigin.json();
    assert.equal(cookieLocalReviewNoOriginBody.code, "DASHBOARD_MUTATION_SCOPE_REQUIRED");

    const cookieLocalReviewMissingText = await fetch(`${base}/api/operator/local-review`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        origin: base,
      },
      body: JSON.stringify({
        selection: { seat_id: "qwen_local", harness_id: "dizzy_json_review" },
      }),
    });
    assertStatus(cookieLocalReviewMissingText, 400, "dashboard local review payload validation");
    const cookieLocalReviewMissingTextBody = await cookieLocalReviewMissingText.json();
    assert.equal(cookieLocalReviewMissingTextBody.code, "LOCAL_REVIEW_TEXT_REQUIRED");

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
