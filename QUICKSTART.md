# QUICKSTART.md - Try Dizzy Locally

Dizzy is a local-first operator console and control-plane prototype for bounded memory, trust zones, receipts, and agentic work. This guide proves what runs locally today.

It does not claim a hosted production product, public A2A interoperability, or finished commercial application.

## Before You Start

- Node.js 20.18.1 or newer is recommended.
- PowerShell examples assume Windows.
- Redis and external model keys are optional for this walkthrough.
- The dashboard is opt-in. `npm start` starts the API; set `DIZZY_DASHBOARD_ENABLED=1` before start to serve `/dashboard`.

## 1. Install

```powershell
cd C:\Users\Josh\clawd
npm install
```

## 2. Start The Local API

```powershell
npm start
```

Expected shape:

```text
Dizzy agent server listening on http://127.0.0.1:3000
[health] http://127.0.0.1:3000/health
```

Exact ports and timestamps may vary with your environment.

## 3. Check The API

In another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/prompt
```

The health endpoint should return `ok`. The prompt endpoint returns the local prompt bundle served by the runtime.

## 4. Start The Dashboard

Stop the previous server if needed, then start with the dashboard flag:

```powershell
$env:DIZZY_DASHBOARD_ENABLED="1"
npm start
```

Open:

```text
http://localhost:3000/dashboard
```

If `DIZZY_AUTH_TOKEN` is set, use:

```text
http://localhost:3000/dashboard/login
```

Enter the token there. Do not put tokens in URLs or browser storage.

## 5. Inspect The Latest Receipt

```powershell
Get-Content -Raw .\reviews\oss_council_verdict_latest.json | ConvertFrom-Json
Get-FileHash .\reviews\oss_council_verdict_latest.json -Algorithm SHA256
```

Current local receipt after the W-0105 public-view readiness guard:

```text
VERIFIED_PASSED
2026-08-31T10:33:34.822Z
111 syntax targets / 55 deterministic execution suites / 2 governance checks
SHA-256: 6B7BD6B1F9FF8568B8DEFA8D7A0C5F74E9023531414506B0843D70C5746BA099
```

Receipts are local evidence, not a promise about every future machine. Rerunning the council audit writes a fresh timestamp and hash.

## 6. Verify The Local Surface

```powershell
npm run check:council
npm run test:dashboard-public-surface
npm run test:dashboard-safety
npm test
```

Useful focused checks:

```powershell
npm run check:docs
npm run check:next
npm run check:staging-boundary
npm run check:production
```

## 7. What Is Not Claimed

- Dizzy is not a hosted production service.
- Public A2A interoperability is not live until an external signed HTTP or WebSocket boundary test exists.
- The Python Council Engine remains a quarantined proving sidecar, not production authority for this repo.
- Redis, external providers, and model backends can be offline; the dashboard should show unavailable or unverified states instead of pretending they are healthy.
- A live browser screenshot proof was not captured in the latest local W-0105 run because the local Edge/Chrome headless capture crashed. Source, API, and route guards passed.

## Reading Path

1. `README.md` explains what Dizzy is and what runs today.
2. `RUNBOOK.md` shows operational commands and local recovery steps.
3. `NEXT.md` separates completed work from remaining work.
4. `PR_W0068_DESCRIPTION.md` summarizes the staging branch for review.
5. `reviews/oss_council_verdict_latest.json` is the latest local machine receipt.
