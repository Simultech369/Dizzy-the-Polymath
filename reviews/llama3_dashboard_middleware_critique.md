# Architectural Critique: `dashboardAccessGuard` Overload

## Overview

As previously noted by Claude Opus 4.6, the `dashboardAccessGuard` middleware in `lib/dashboard.mjs` has become a "god function" that is overly responsible for multiple unrelated security checks. Currently, it synchronously evaluates:

1. **Loopback/Proxy validation** (Network boundary constraints)
2. **Trust Zone checks** (Business logic routing)
3. **Same-origin mutation guards** (CSRF/Origin protection)
4. **Session cookie validation and authentication** (Identity verification)

## Risks of the Current Implementation

- **Maintainability:** A single function enclosing network-level routing, CSRF protections, and session logic is difficult to test in isolation.
- **Flexibility:** Applying all security checks globally precludes assigning different combinations of checks to different endpoints (e.g. static assets vs. mutation endpoints).
- **Legibility:** Deep nesting and complex conditional branching—especially the session validation segment with its hardcoded exceptions for login routes—makes the code fragile.

## Proposed Refactoring

Instead of a monolithic guard, these concerns should be separated into discrete middleware functions that follow the Single Responsibility Principle. These can then be composed into arrays when mounting routes. 

### 1. Separation into Discrete Middleware

```javascript
// 1. Token & Loopback Guard
function requireLocalLoopback({ authToken, normalizeIp, isLoopbackHost }) {
  return function (req, res, next) {
    if (!authToken) return res.status(503).json({ ok: false, error: "Dashboard requires DIZZY_AUTH_TOKEN" });
    const remote = normalizeIp(req.socket?.remoteAddress || req.ip);
    const proxyHeaders = ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip"];
    const forwarded = proxyHeaders.some((name) => String(req.headers?.[name] ?? "").trim() !== "");
    if (!isLoopbackHost(remote) || forwarded) {
      return res.status(403).json({ ok: false, error: "Dashboard is restricted to local loopback connections only" });
    }
    return next();
  };
}

// 2. Trust Zone Guard
function requireDashboardTrustZone(req, res, next) {
  const trustZone = requestDashboardTrustZone(req);
  if (["paid_public", "outside_contact", "outside-contact"].includes(trustZone)) {
    return res.status(403).json({ ok: false, error: "Dashboard is unavailable in this trust zone" });
  }
  return next();
}

// 3. Mutation Guard (CSRF protection)
function requireSafeMutation({ authToken }) {
  return function(req, res, next) {
    if (!sameOriginMutation(req) && !hasMasterBearer(req, authToken)) {
      return res.status(403).json({ ok: false, error: "Dashboard mutation requires same-origin request or master bearer token" });
    }
    return next();
  }
}

// 4. Session Validation Guard
function requireSession({ authToken, hasDashboardSession }) {
  return function(req, res, next) {
    if (hasDashboardSession && typeof hasDashboardSession === "function" && !hasMasterBearer(req, authToken)) {
      const isLoginRoute = req.path === "/dashboard/login" || req.path === "/dashboard/session" || req.path === "/assets/dashboard-login.js";
      if (!isLoginRoute && !hasDashboardSession(req)) {
        if (req.method === "GET" && !req.path.startsWith("/api/")) {
          return res.redirect(303, "/dashboard/login");
        }
        return res.status(401).json({ ok: false, error: "Dashboard session expired or invalid" });
      }
    }
    return next();
  }
}
```

### 2. Route Composition

Once separated, these constraints can be aggregated into reusable middleware stacks. For example:

```javascript
const standardGuard = [
  requireLocalLoopback({ authToken, normalizeIp, isLoopbackHost }),
  requireDashboardTrustZone,
  requireSafeMutation({ authToken }),
  requireSession({ authToken, hasDashboardSession })
];

app.get("/api/dashboard-data", standardGuard, (req, res, next) => { ... });
```

This ensures a robust, testable, and highly visible security model across the application.
