import fs from "fs";
import { fileURLToPath } from "url";

import { getIndex, getRelevantMarkdownSnippets } from "./md_retriever.mjs";
import { getPromptSources } from "./prompt_bundle.mjs";

const DEFAULT_DASHBOARD_ASSET = fileURLToPath(new URL("../dashboard/index.html", import.meta.url));

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
      relPath: doc.relPath,
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
  const guard = dashboardAccessGuard({ authToken, normalizeIp, isLoopbackHost });

  app.get("/dashboard", guard, (req, res) => {
    try {
      const html = fs.readFileSync(assetPath, "utf8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
      res.type("text/html").send(html);
    } catch {
      res.status(503).json({ ok: false, error: "Dashboard asset unavailable" });
    }
  });

  app.get("/api/dashboard-data", guard, (req, res, next) => {
    try {
      const promptSources = getPromptSources();
      res.setHeader("Cache-Control", "no-store");
      res.json({
        ok: true,
        prompt_sources: promptSources.map((source) => ({
          path: source.path,
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
          path: snippet.path,
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
