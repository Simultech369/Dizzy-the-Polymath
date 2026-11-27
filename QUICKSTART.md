# QUICKSTART.md - Try Dizzy Locally

Dizzy is a local-first router and control plane for bounded memory, trust zones, tool guardrails, receipts, and user/operator channels. CouncilEngine (`Simultech369/CouncilEngine`) acts as its offline verification helper.

Dizzy is not a hosted production service, public A2A network, or finished commercial SaaS application.

For the shortest end-to-end proof of the thesis, see [Dizzy Thesis In 15 Minutes](docs/thesis_in_15_minutes.md).

## Before You Start

- Node.js 20.18.1 or newer is required (tested on Node 20 and Node 22).
- Redis and external model API keys are optional for local verification.
- The dashboard is opt-in: `npm start` starts the API only; set `DIZZY_DASHBOARD_ENABLED=1` before start to serve `/dashboard`.

---

## 1. Install

### Mac / Linux (Bash)

```bash
git clone https://github.com/Simultech369/Dizzy-the-Polymath.git
cd Dizzy-the-Polymath
npm install
```

### Windows (PowerShell)

```powershell
git clone https://github.com/Simultech369/Dizzy-the-Polymath.git
Set-Location -LiteralPath ".\Dizzy-the-Polymath"
npm install
```

---

## 2. Start The Local Control Plane

### Mac / Linux (Bash)

```bash
export DIZZY_AUTH_TOKEN="replace-with-local-operator-token-32-chars"
npm start
```

### Windows (PowerShell)

```powershell
$env:DIZZY_AUTH_TOKEN="replace-with-local-operator-token-32-chars"
npm start
```

Expected startup output:

```text
Dizzy agent server listening on http://127.0.0.1:3000
[health] http://127.0.0.1:3000/health
```

---

## 3. Check The API (`curl` and PowerShell)

### Mac / Linux (`curl`)

```bash
export DIZZY_AUTH_TOKEN="replace-with-local-operator-token-32-chars"

# Public local health check (models, mailbox, disk, cold-seat posture)
curl -s http://127.0.0.1:3000/health | jq .

# Prompt bundle summary
curl -s http://127.0.0.1:3000/prompt | jq .

# Operator Inbox (approvals, blockers, spend stops)
curl -s -H "Authorization: Bearer $DIZZY_AUTH_TOKEN" \
  http://127.0.0.1:3000/api/operator/inbox | jq .
```

### Windows (PowerShell)

```powershell
$env:DIZZY_AUTH_TOKEN="replace-with-local-operator-token-32-chars"
$headers = @{ Authorization = "Bearer $env:DIZZY_AUTH_TOKEN" }
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/prompt
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/operator/inbox" -Headers $headers
```

---

## 4. Start The Opt-In Operator Dashboard

Stop the previous server if running, then set `DIZZY_DASHBOARD_ENABLED=1` before `npm start`:

### Mac / Linux (Bash)

```bash
DIZZY_DASHBOARD_ENABLED=1 DIZZY_AUTH_TOKEN="replace-with-local-operator-token-32-chars" npm start
```

### Windows (PowerShell)

```powershell
$env:DIZZY_DASHBOARD_ENABLED="1"
$env:DIZZY_AUTH_TOKEN="replace-with-local-operator-token-32-chars"
npm start
```

Open `http://localhost:3000/dashboard` (or `http://localhost:3000/dashboard/login` when `DIZZY_AUTH_TOKEN` is set; never place tokens in URLs or `localStorage`).

---

## 5. Inspect The Latest Council Audit Receipt

### Mac / Linux (Bash)

```bash
jq '{verdict, timestamp, syntax_targets: (.layers.syntax.details | length), execution_suites: (.layers.execution.details | length)}' \
  reviews/oss_council_verdict_latest.json
sha256sum reviews/oss_council_verdict_latest.json
```

### Windows (PowerShell)

```powershell
$receipt = Get-Content -Raw .\reviews\oss_council_verdict_latest.json | ConvertFrom-Json
"VERDICT=$($receipt.verdict)"
"TIMESTAMP=$($receipt.timestamp)"
"SYNTAX_TARGETS=$($receipt.layers.syntax.details.Count)"
"EXECUTION_SUITES=$($receipt.layers.execution.details.Count)"
Get-FileHash .\reviews\oss_council_verdict_latest.json -Algorithm SHA256
```

---

## 6. Verify The Local Surface

```bash
npm test
npm run test:workflow-states
npm run check:docs
npm run check:next
npm run check:production
npm run test:dashboard-public-surface
npm run test:dashboard-safety
npm run check:council
```

---

## 7. What Is Not Claimed

- Dizzy is not a hosted production service.
- `/api/a2a/incoming` is a single-runtime, shared-secret signed JSON ingress proof. It does not prove external peer identity, signed responses, distributed replay protection, or cross-runtime interoperability. The local signed A2A ingress boundary is verified by deterministic tests; public interoperability remains future work.
- CouncilEngine remains an offline verification helper, not consumer chat authority.
- Redis, external providers, and model backends can be offline; the runtime and dashboard report degraded or unavailable states explicitly rather than faking health.
- Operator captured the W-0106 walkthrough screenshots offline. No repository path or PR attachment is recorded in this checkout, so this is operator-observed evidence rather than a repository-verifiable launch artifact. W-0106 is operationally resolved.
