import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";

import { getIndex, getRelevantMarkdownSnippets } from "./md_retriever.mjs";
import { getPromptSources } from "./prompt_bundle.mjs";

const DEFAULT_DASHBOARD_ASSET = fileURLToPath(new URL("../dashboard/index.html", import.meta.url));
const DEFAULT_DASHBOARD_SCRIPT_ASSET = fileURLToPath(new URL("../dashboard/dashboard.js", import.meta.url));
const DEFAULT_DASHBOARD_LOGIN_SCRIPT_ASSET = fileURLToPath(new URL("../dashboard/dashboard-login.js", import.meta.url));
const DASHBOARD_SESSION_COOKIE = "dizzy_dashboard_session";

function opaquePathId(prefix, value) {
  const digest = crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
  return `${prefix}-${digest}`;
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
      const promptSources = getPromptSources();
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
}
