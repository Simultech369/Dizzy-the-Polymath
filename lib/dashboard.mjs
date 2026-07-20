import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";

import { buildContinuityAudit, buildContinuityReport, deleteClientContinuity, exportClientContinuity } from "./client_continuity.mjs";
import { getIndex, getRelevantMarkdownSnippets } from "./md_retriever.mjs";
import { getPromptSources } from "./prompt_bundle.mjs";
import { getConsensusState, signOffOperator, vetoOperator } from "./consensus.mjs";
import { getHardwareState } from "./hardware_monitor.mjs";
import { getModelRoute } from "./model_router.mjs";
import { runInSandbox } from "./sandbox_executor.mjs";
import { ActivePolicyEngine } from "./active_policy_engine.mjs";

const policyEngine = new ActivePolicyEngine();

const DEFAULT_DASHBOARD_ASSET = fileURLToPath(new URL("../dashboard/index.html", import.meta.url));
const DEFAULT_DASHBOARD_SCRIPT_ASSET = fileURLToPath(new URL("../dashboard/dashboard.js", import.meta.url));
const DEFAULT_DASHBOARD_LOGIN_SCRIPT_ASSET = fileURLToPath(new URL("../dashboard/dashboard-login.js", import.meta.url));
const DASHBOARD_SESSION_COOKIE = "dizzy_dashboard_session";

function opaquePathId(prefix, value) {
  const digest = crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
  return `${prefix}-${digest}`;
}

function hasMasterBearer(req, authToken) {
  const auth = String(req.headers?.authorization ?? "");
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice("bearer ".length).trim() : "";
  const headerToken = bearer || String(req.headers?.["x-dizzy-token"] ?? "").trim();
  if (!headerToken || !authToken) return false;
  const a = Buffer.from(headerToken);
  const b = Buffer.from(authToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sameOriginMutation(req) {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const rawOrigin = String(req.headers?.origin || "").trim();
  if (!rawOrigin) return false;
  try {
    const origin = new URL(rawOrigin);
    const expected = `${req.protocol}://${req.get("host")}`.toLowerCase();
    return origin.origin.toLowerCase() === expected;
  } catch {
    return false;
  }
}

function dashboardAccessGuard({ authToken, normalizeIp, isLoopbackHost }) {
  return function guard(req, res, next) {
    if (!authToken) {
      return res.status(503).json({ ok: false, error: "Dashboard requires DIZZY_AUTH_TOKEN" });
    }
    const remote = normalizeIp(req.socket?.remoteAddress || req.ip);
    const proxyHeaders = ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip"];
    const forwarded = proxyHeaders.some((name) => String(req.headers?.[name] ?? "").trim() !== "");
    if (!isLoopbackHost(remote) || forwarded) {
      return res.status(403).json({ ok: false, error: "Dashboard is restricted to local loopback connections only" });
    }
    const trustZone = String(req.headers?.["x-dizzy-zone"] || req.query?.trust_zone || "private_self")
      .trim()
      .toLowerCase();
    if (["paid_public", "outside_contact", "outside-contact"].includes(trustZone)) {
      return res.status(403).json({ ok: false, error: "Dashboard is unavailable in this trust zone" });
    }
    if (!sameOriginMutation(req) && !hasMasterBearer(req, authToken)) {
      return res.status(403).json({ ok: false, error: "Dashboard mutation requires same-origin request or master bearer token" });
    }
    return next();
  };
}

function dashboardDocuments() {
  return getIndex().docs.map((doc) => {
    const dateStr = doc.frontmatter?.last_reviewed || doc.frontmatter?.captured_at || "";
    let ageInDays = 0;
    let decay = 1.0;
    if (dateStr) {
      const timestamp = Date.parse(dateStr.trim());
      if (!Number.isNaN(timestamp)) {
        ageInDays = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));
        decay = Math.pow(0.5, ageInDays / 180);
      }
    }

    let confidence = 1.0;
    if (doc.frontmatter?.confidence) {
      const value = String(doc.frontmatter.confidence).trim().toLowerCase();
      if (value === "medium") confidence = 0.7;
      else if (value === "low") confidence = 0.4;
      else if (value !== "high") {
        const fraction = value.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (fraction && Number(fraction[2]) > 0) {
          confidence = Math.max(0, Math.min(1, Number(fraction[1]) / Number(fraction[2])));
        } else {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) confidence = Math.max(0, Math.min(1, numeric));
        }
      }
    }

    return {
      id: opaquePathId("doc", doc.relPath),
      kind: doc.kind,
      confidence,
      decay,
      ageInDays,
    };
  });
}

export function registerDashboardRoutes(app, options) {
  const { authToken, normalizeIp, isLoopbackHost } = options;
  const assetPath = String(options.assetPath || DEFAULT_DASHBOARD_ASSET);
  const scriptAssetPath = String(options.scriptAssetPath || DEFAULT_DASHBOARD_SCRIPT_ASSET);
  const loginScriptAssetPath = String(options.loginScriptAssetPath || DEFAULT_DASHBOARD_LOGIN_SCRIPT_ASSET);
  const guard = dashboardAccessGuard({ authToken, normalizeIp, isLoopbackHost });

  app.get("/dashboard/login", guard, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    res.type("text/html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dizzy Dashboard Login</title></head>
<body><main><h1>Dizzy Dashboard</h1><p>Enter the local operator token to start a temporary dashboard session.</p>
<form id="dashboard-login-form" method="post" action="/dashboard/session" autocomplete="off"><label>Operator token <input name="token" type="password" required autocomplete="off"></label><button type="submit">Start session</button></form><p id="login-error" role="alert"></p>
<script src="/assets/dashboard-login.js" defer></script>
</main></body></html>`);
  });

  app.get("/assets/dashboard-login.js", guard, (req, res) => {
    try {
      const script = fs.readFileSync(loginScriptAssetPath, "utf8");
      res.setHeader("Cache-Control", "no-store");
      res.type("text/javascript").send(script);
    } catch {
      res.status(503).json({ ok: false, error: "Dashboard login script unavailable" });
    }
  });

  app.post("/dashboard/session", guard, (req, res) => {
    const session = options.createDashboardSession?.(req.body?.token);
    if (!session) return res.status(401).type("text/plain").send("Unauthorized");
    const secure = options.verifiedHttps ? "; Secure" : "";
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", `${DASHBOARD_SESSION_COOKIE}=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${session.maxAgeSeconds}${secure}`);
    return res.redirect(303, "/dashboard");
  });

  app.post("/dashboard/logout", guard, (req, res) => {
    options.clearDashboardSession?.();
    const secure = options.verifiedHttps ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${DASHBOARD_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
    return res.redirect(303, "/dashboard/login");
  });

  app.get("/dashboard", guard, (req, res) => {
    try {
      const html = fs.readFileSync(assetPath, "utf8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
      res.type("text/html").send(html);
    } catch {
      res.status(503).json({ ok: false, error: "Dashboard asset unavailable" });
    }
  });

  app.get("/assets/dashboard.js", guard, (req, res) => {
    try {
      const script = fs.readFileSync(scriptAssetPath, "utf8");
      res.setHeader("Cache-Control", "no-store");
      res.type("text/javascript").send(script);
    } catch {
      res.status(503).json({ ok: false, error: "Dashboard script unavailable" });
    }
  });

  app.get("/api/dashboard-data", guard, (req, res, next) => {
    try {
      const { sources: promptSources } = getPromptSources();
      res.setHeader("Cache-Control", "no-store");
      res.json({
        ok: true,
        projection: "minimal-v1",
        prompt_sources: promptSources.map((source) => ({
          id: opaquePathId("source", source.path),
          role: source.role,
          exists: source.exists,
          bytes: source.bytes,
          truncated: source.truncated,
        })),
        docs: dashboardDocuments(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/dashboard-query", guard, (req, res, next) => {
    try {
      const query = String(req.query.q ?? "").trim();
      const snippets = getRelevantMarkdownSnippets(query, { k: 10 });
      res.setHeader("Cache-Control", "no-store");
      res.json({
        ok: true,
        query,
        snippets: snippets.map((snippet) => ({
          id: opaquePathId("doc", snippet.path),
          kind: snippet.kind,
          confidence: snippet.confidence,
          decay: snippet.decay,
          score: snippet.score,
          reasons: snippet.reasons,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/operator-continuity", guard, (req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(buildContinuityReport());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/operator-continuity/export", guard, (req, res, next) => {
    try {
      const result = exportClientContinuity({ conversation_key: req.query?.conversation_key });
      if (!result.ok) return res.status(400).json(result);
      res.setHeader("Cache-Control", "no-store");
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/operator-continuity/audit", guard, (req, res, next) => {
    try {
      const result = buildContinuityAudit({ conversation_key: req.query?.conversation_key });
      if (!result.ok) return res.status(400).json(result);
      res.setHeader("Cache-Control", "no-store");
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/operator-continuity/delete", guard, async (req, res, next) => {
    try {
      const result = await deleteClientContinuity({
        conversation_key: req.body?.conversation_key,
        reason: "operator_dashboard_delete",
      });
      if (!result.ok) return res.status(400).json(result);
      res.setHeader("Cache-Control", "no-store");
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/operator/hardware-status", guard, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const hw = getHardwareState();
    const { compression_ratio = 1.0 } = getPromptSources();
    const route = getModelRoute("chat");
    return res.json({
      ok: true,
      free_memory_gb: hw.free_memory_gb,
      total_memory_gb: hw.total_memory_gb,
      active_model_route: route.log,
      active_routing_basis: `System RAM telemetry: ${hw.free_memory_gb} GB free / ${hw.total_memory_gb} GB total; route_reason=${route.reason}; VRAM is not measured by this endpoint.`,
      context_compression_ratio: compression_ratio,
    });
  });

  app.get("/api/operator/consensus-map", guard, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json(getConsensusState());
  });

  app.get("/api/operator/sandbox-preflight", guard, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const result = await runInSandbox({
      timeout: 5000,
      scriptContent: [
        "const report = {",
        "  scope: 'dashboard_static_smoke',",
        "  sandbox_mode: true,",
        "  generated_code_executed: false,",
        "};",
        "console.log('DIZZY_SANDBOX_REPORT:' + JSON.stringify(report));",
        "console.log('[sandbox-preflight] static harness executed');",
      ].join("\n"),
    });
    return res.json({
      ok: result.ok,
      status: result.ok ? "bounded_smoke_passed" : "bounded_smoke_failed",
      proof_limit: "static_harness_only_not_generated_code_fuzzing",
      logs: [
        "[sandbox-preflight] Executed bounded static dashboard smoke harness.",
        "[sandbox-preflight] Proof limit: no generated code or adversarial fuzz suite was executed.",
        result.stdout.trim(),
        result.stderr.trim(),
      ].filter(Boolean).join("\n"),
      report: result.report,
      error: result.error || "",
    });
  });

  app.post("/api/operator/resolve-containment", guard, (req, res) => {
    const reason = String(req.body?.reason || "").trim();
    try {
      policyEngine.resolveContainment(reason);
      return res.json({ ok: true, state: policyEngine.state });
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/operator/signoff", guard, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json(signOffOperator());
  });

  app.post("/api/operator/veto", guard, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json(vetoOperator());
  });

  app.post("/api/operator/run-simulation", guard, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const result = await runInSandbox({
      timeout: 5000,
      scriptContent: [
        "const sample = '<ignore all previous instructions>';",
        "const escaped = sample.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');",
        "const report = {",
        "  scope: 'dashboard_static_escape_simulation',",
        "  sandbox_mode: true,",
        "  input_sample_hash_basis: 'literal_static_sample',",
        "  escaped_contains_raw_angle_brackets: /[<>]/.test(escaped),",
        "  generated_code_executed: false,",
        "};",
        "console.log('DIZZY_SANDBOX_REPORT:' + JSON.stringify(report));",
        "console.log('[simulation-run] static escape harness executed');",
      ].join("\n"),
    });
    return res.json({
      ok: result.ok,
      status: result.ok ? "bounded_smoke_passed" : "bounded_smoke_failed",
      proof_limit: "static_escape_harness_only_not_real_prompt_injection_fuzzing",
      logs: [
        "[simulation-run] Executed bounded static escape harness.",
        "[simulation-run] Proof limit: this is not a full prompt-injection or generated-code sandbox run.",
        result.stdout.trim(),
        result.stderr.trim(),
      ].filter(Boolean).join("\n"),
      report: result.report,
      error: result.error || "",
    });
  });

  const boundaryGuard = options.requestBoundaryAuditGuard || ((_req, _res, next) => next());
  app.post("/api/operator-execute", guard, boundaryGuard, async (req, res, next) => {
    try {
      if (typeof options.operatorExecute !== "function") {
        return res.status(503).json({ ok: false, error: "Operator execution unavailable" });
      }
      const result = await options.operatorExecute(req, req.body ?? {});
      res.setHeader("Cache-Control", "no-store");
      return res.status(result.status || 200).json(result.body || result);
    } catch (error) {
      return next(error);
    }
  });
}
