# Dizzy Thesis In 15 Minutes

Purpose: prove the core thesis without reading the whole repo first.

This path demonstrates four things:

1. Dizzy starts as a local operator runtime.
2. The dashboard/API exposes implemented local/open-weight model seats instead of a fantasy roster.
3. A selected seat and harness flow into a real dispatch request and receipt.
4. Deterministic tests can verify routing, trust-zone blocking, public-surface language, and the current council receipt.

This does not prove hosted production readiness, public A2A interoperability, model quality, bounty success, or CouncilEngine promotion authority.

## 0. Prerequisites

- Node.js 20.18.1 or newer.
- Optional for a genuine local model response: Ollama running on `127.0.0.1:11434` with at least one selectable local model such as `qwen2.5-coder:7b`, `gemma3:4b`, `mistral:latest`, or `deepseek-r1:7b`.
- No hosted provider key is required for this path.

## 1. Install

PowerShell:

```powershell
git clone https://github.com/Simultech369/Dizzy-the-Polymath.git
Set-Location -LiteralPath ".\Dizzy-the-Polymath"
npm install
```

Bash or zsh:

```bash
git clone https://github.com/Simultech369/Dizzy-the-Polymath.git
cd Dizzy-the-Polymath
npm install
```

## 2. Start The Local Operator Surface

Use a local token so operator routes are explicit.

PowerShell:

```powershell
$env:DIZZY_AUTH_TOKEN="replace-with-a-local-operator-token-of-32-plus-characters"
$env:DIZZY_DASHBOARD_ENABLED="1"
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434/v1"
npm start
```

Bash or zsh:

```bash
export DIZZY_AUTH_TOKEN="replace-with-a-local-operator-token-of-32-plus-characters"
export DIZZY_DASHBOARD_ENABLED="1"
export OLLAMA_BASE_URL="http://127.0.0.1:11434/v1"
npm start
```

Open `http://127.0.0.1:3000/dashboard/login`, enter the token, then open the dashboard.

What this proves: the dashboard is opt-in, token-gated, and local. It does not prove any model is available yet.

## 3. Inspect Executable Seat Options

PowerShell:

```powershell
$headers = @{ Authorization = "Bearer $env:DIZZY_AUTH_TOKEN" }
Invoke-RestMethod "http://127.0.0.1:3000/api/operator/router-divisions" -Headers $headers |
  Select-Object -ExpandProperty executable_combinations |
  Format-Table seat_id, model_id, harness_id, provider_boundary, evidence_state
```

Bash or zsh:

```bash
curl -sS \
  -H "Authorization: Bearer $DIZZY_AUTH_TOKEN" \
  http://127.0.0.1:3000/api/operator/router-divisions |
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{for(const x of JSON.parse(d).executable_combinations||[]) console.log(`${x.seat_id}\t${x.model_id}\t${x.harness_id}\t${x.provider_boundary}\t${x.evidence_state}`)})'
```

Expected shape:

```text
seat_id       model_id             harness_id   provider_boundary  evidence_state
qwen_local    qwen2.5-coder:7b     native_chat  local_machine      configured_unverified
gemma3_local  gemma3:4b            native_chat  local_machine      configured_unverified
```

What this proves: Dizzy exposes implemented model/harness combinations. `configured_unverified` means the option is configured, not that the model has just answered.

## 4. Ask One Selected Local Seat

If Ollama is running and the model is present, this should return a genuine response from the selected local seat. If not, it should fail with a receipt that says what was attempted.

PowerShell:

```powershell
$headers = @{ Authorization = "Bearer $env:DIZZY_AUTH_TOKEN" }
$body = @{
  channel = "dashboard_chat"
  text = "Reply in one short sentence: what is Dizzy?"
  selection = @{
    seat_id = "qwen_local"
    model_id = "qwen2.5-coder:7b"
    harness_id = "native_chat"
  }
} | ConvertTo-Json -Depth 6

$response = Invoke-RestMethod "http://127.0.0.1:3000/dispatch/incoming" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body

$response.text
$response.router_receipt.routing_policy | ConvertTo-Json -Depth 8
```

Bash or zsh:

```bash
curl -sS \
  -H "Authorization: Bearer $DIZZY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "dashboard_chat",
    "text": "Reply in one short sentence: what is Dizzy?",
    "selection": {
      "seat_id": "qwen_local",
      "model_id": "qwen2.5-coder:7b",
      "harness_id": "native_chat"
    }
  }' \
  http://127.0.0.1:3000/dispatch/incoming |
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d); console.log(r.text||r.error); console.log(JSON.stringify(r.router_receipt?.routing_policy,null,2));})'
```

Receipt fields to inspect:

- `selection.requested_seat_id`
- `selection.requested_model_id`
- `selection.requested_harness_id`
- `selected_model_or_route`
- `provider_invoked`
- `attempts[0].adapter`
- `attempts[0].provider_boundary`
- `attempts[0].transport_started`
- `attempts[0].status`

What this proves: the operator's requested local/open-weight seat reaches the dispatch layer and the receipt records what happened. A provider failure is still evidence; it must not be rendered as "no provider call."

## 5. Run The Minimal Proof Tests

PowerShell:

```powershell
npm run test:model-router
npm run test:router
npm run test:dashboard-public-surface
npm run test:operator-telemetry
npm run check:council
```

Bash or zsh:

```bash
npm run test:model-router
npm run test:router
npm run test:dashboard-public-surface
npm run test:operator-telemetry
npm run check:council
```

What this proves:

- `test:model-router`: selection options are constrained to implemented local/open-weight chat seats.
- `test:router`: explicit selection changes the actual request body and receipt; private-zone cloud calls fail closed.
- `test:dashboard-public-surface`: the dashboard does not overclaim model availability before receipt evidence.
- `test:operator-telemetry`: receipt summaries preserve selected seat, adapter, boundary, and transport facts.
- `check:council`: the deterministic local audit suite passes for this checkout.

## Receipt Primer

| Receipt | What it proves | What it does not prove |
| --- | --- | --- |
| Capability receipt | Which trust zone and context sources were allowed for the current request. | That a model answered correctly. |
| Router receipt | Which model route was selected or blocked, whether an adapter/transport was attempted, and what the local execution metadata reported. | That the provider-reported model identity is independently attested, or that the answer is true. |
| Council audit receipt | The listed deterministic syntax, governance, and execution suites passed in that run. | Future behavior, hosted production readiness, or external audit. |
| Trajectory/admission receipt | A candidate memory or trajectory satisfied the local admission policy used at capture time. | Promotion authority, deployment authority, or universal correctness. |
| CouncilEngine rehearsal receipt | The quarantined Python sidecar produced offline verifier evidence. | Runtime authority inside Dizzy, production promotion, or public interoperability. |

## The MVP Claim

After this path succeeds, the honest MVP claim is:

> Dizzy is a local-first operator control plane that can expose implemented local/open-weight model seats, route a selected native-chat request through the bounded dispatch policy, and produce receipts showing what was allowed, selected, attempted, blocked, or answered.

Do not claim:

- Hosted production launch readiness.
- Public A2A interoperability.
- Autonomous deployment authority.
- External audit or formal proof of all behavior.
- That catalog membership means a model/harness is callable.
