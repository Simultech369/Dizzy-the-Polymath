import { startServer } from "./agent_server.mjs";
import fs from "fs";

async function must(ok, msg) {
  if (!ok) throw new Error(msg);
}

process.env.DIZZY_TOOL_ALLOW_LOCALHOST = "1";
delete process.env.DIZZY_CHAT_BACKEND;
delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_MODEL;
delete process.env.DIZZY_CHAT_FALLBACK_BACKEND;
delete process.env.OPENAI_COMPAT_BASE_URL;
delete process.env.OPENAI_COMPAT_API_KEY;
delete process.env.OPENAI_COMPAT_MODEL;
process.env.DIZZY_TRAJECTORY_PATH = "runtime/test-smoke-trajectories.jsonl";
process.env.DIZZY_FRICTION_PATH = "runtime/test-smoke-friction.jsonl";

const started = await startServer({ port: 0, redisUrl: "", memoryGraphEnabled: true });

try {
  const port = started.boundPort;

  const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
  await must(health.ok === true, "health not ok");

  const prompt = await fetch(`http://127.0.0.1:${port}/prompt`).then((r) => r.json());
  await must(prompt.ok === true, "prompt not ok");
  await must(prompt.prompt_budget?.constitutional_files >= 1, "prompt budget missing constitutional count");

  const profile = await fetch(`http://127.0.0.1:${port}/agent/profile`).then((r) => r.json());
  await must(typeof profile.avatar_url === "string" && profile.avatar_url.includes("/assets/logo"), "profile avatar missing");

  const gov = await fetch(`http://127.0.0.1:${port}/governance`).then((r) => r.text());
  await must(gov.includes("INTERACTION_NORMS.md"), "governance doc missing");

  const disabledDashboard = await fetch(`http://127.0.0.1:${port}/api/dashboard-data`);
  await must(disabledDashboard.status === 404, `expected disabled dashboard, got ${disabledDashboard.status}`);

  const memoryGraph = await fetch(`http://127.0.0.1:${port}/memory/graph`).then((r) => r.json());
  await must(memoryGraph.ok === true && memoryGraph.mode === "summary", "memory graph summary missing");

  const memoryQuery = await fetch(`http://127.0.0.1:${port}/memory/graph?q=wikimedia`).then((r) => r.json());
  await must(memoryQuery.ok === true && memoryQuery.mode === "query", "memory graph query missing");

  const r1 = await fetch(`http://127.0.0.1:${port}/dispatch/incoming`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel: "smoke", text: "hello" }),
  }).then((r) => r.json());

  await must(r1.ok === true && r1.kind === "reply", `unexpected reply: ${JSON.stringify(r1)}`);
  await must(
    typeof r1.text === "string" && r1.text.includes("Chat backend is not configured"),
    `unexpected degraded-mode text: ${JSON.stringify(r1)}`,
  );
  await must(
    r1.text.includes("runtime/conversations/smoke.jsonl"),
    `degraded-mode reply missing conversation path: ${JSON.stringify(r1)}`,
  );

  const r2 = await fetch(`http://127.0.0.1:${port}/dispatch/incoming`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel: "smoke", text: `tool:http_get http://127.0.0.1:${port}/health` }),
  }).then((r) => r.json());

  // With redisUrl unset, tool requests run inline by default.
  await must(r2.ok === true && (r2.kind === "reply" || r2.kind === "ack"), `unexpected tool result: ${JSON.stringify(r2)}`);

  const trajectory = await fetch(`http://127.0.0.1:${port}/dispatch/incoming`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channel: "local",
      text: '/trajectory add {"goal":"Smoke test manual trajectory capture","success_criteria":"Runtime accepts sparse known-good pattern","actions_taken":["sent command"],"outcome":"success","reusable_pattern":"Keep manual learning capture explicit before automating it","reuse_tags":["smoke","trajectory"],"strength":7}',
    }),
  }).then((r) => r.json());

  await must(trajectory.ok === true && trajectory.text.includes("Saved trajectory"), `unexpected trajectory result: ${JSON.stringify(trajectory)}`);

  const friction = await fetch(`http://127.0.0.1:${port}/dispatch/incoming`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channel: "local",
      text: '/friction add {"friction_type":"disruption","description":"Smoke test logged a recoverable disruption","task_context":"runtime smoke","severity":3,"frequency":"first"}',
    }),
  }).then((r) => r.json());

  await must(friction.ok === true && friction.text.includes("Saved friction"), `unexpected friction result: ${JSON.stringify(friction)}`);

  console.log("SMOKE_OK");
} finally {
  await started.stop();
  await fs.promises.rm("runtime/test-smoke-trajectories.jsonl", { force: true });
  await fs.promises.rm("runtime/test-smoke-friction.jsonl", { force: true });
}

const authed = await startServer({
  port: 0,
  redisUrl: "",
  authToken: "test-token",
  dashboardEnabled: true,
});

try {
  const port = authed.boundPort;

  const unauthPrompt = await fetch(`http://127.0.0.1:${port}/prompt`);
  await must(unauthPrompt.status === 401, `expected unauthorized prompt, got ${unauthPrompt.status}`);

  const authedPrompt = await fetch(`http://127.0.0.1:${port}/prompt`, {
    headers: { authorization: "Bearer test-token" },
  }).then((r) => r.json());
  await must(authedPrompt.ok === true, "authorized prompt not ok");

  const unauthDashboard = await fetch(`http://127.0.0.1:${port}/api/dashboard-data`);
  await must(unauthDashboard.status === 401, `expected unauthorized dashboard, got ${unauthDashboard.status}`);

  const dashHtml = await fetch(`http://127.0.0.1:${port}/dashboard`, {
    headers: { authorization: "Bearer test-token" },
  }).then((r) => r.text());
  await must(dashHtml.includes("Drift & Memory Dashboard"), "dashboard html missing title");

  const dashData = await fetch(`http://127.0.0.1:${port}/api/dashboard-data`, {
    headers: { authorization: "Bearer test-token" },
  }).then((r) => r.json());
  await must(dashData.ok === true && Array.isArray(dashData.prompt_sources) && Array.isArray(dashData.docs), "dashboard data invalid");

  const dashQuery = await fetch(`http://127.0.0.1:${port}/api/dashboard-query?q=apples`, {
    headers: { authorization: "Bearer test-token" },
  }).then((r) => r.json());
  await must(dashQuery.ok === true && Array.isArray(dashQuery.snippets), "dashboard query invalid");
  await must(dashQuery.snippets.some(s => s.path.includes("calibration-examples.md")), "dashboard query missing calibration doc");

  const authHealth = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
  await must(authHealth.ok === true, "health should stay open on loopback binding");

  console.log("SMOKE_AUTH_OK");
} finally {
  await authed.stop();
}
