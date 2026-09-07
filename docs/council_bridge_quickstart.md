# Council Bridge Quickstart

Purpose: show the current operator-visible path between Dizzy and the quarantined Council sidecar.

This is a local/rehearsal component-visibility proof. It does not claim hosted production readiness, public cross-runtime A2A interoperability, a continuous mailbox-to-sidecar worker, or Python sidecar production authority.

## What Exists

The current local component map is:

```text
signed A2A ingress
-> mailbox queue
-> leased dequeue/ack
-> Node/Python bridge contract
-> quarantined sidecar rehearsal
-> bounded receipt returned to Dizzy
```

The operator-facing status route is:

```text
GET /api/operator/council-bridge-status
```

It reports:

- bridge mode: `local_rehearsal`
- whether A2A ingress auth is configured or fail-closed
- mailbox signature posture
- mailbox queue counts
- implemented component steps
- unobserved or unmeasured operations
- verification commands
- remaining blockers before promotion or public claims

The status receipt is `advisory_receipt` authority. It proves authenticated operator visibility of the bridge posture, not continuous dispatch, sidecar runtime promotion, or public interoperability.

## Inspect Locally

Start the local runtime with dashboard serving enabled and an operator token:

```powershell
$env:DIZZY_AUTH_TOKEN="replace-with-a-local-operator-token-of-32-plus-characters"
$env:DIZZY_DASHBOARD_ENABLED="1"
npm start
```

Then inspect the bridge status from another terminal. Set the same local token in this terminal too:

```powershell
$env:DIZZY_AUTH_TOKEN="replace-with-the-same-local-operator-token"
$headers = @{ Authorization = "Bearer $env:DIZZY_AUTH_TOKEN" }
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/operator/council-bridge-status" -Headers $headers
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/a2a/mailbox/stats" -Headers $headers
```

Run the focused proof commands:

```powershell
npm run test:a2a-boundary
npm run test:a2a-mailbox
npm run test:node-python-bridge-contract
npm run test:bounty-bridge-rehearsal
npm run test:operator-telemetry
```

## Boundaries

- The mailbox can hold signed local A2A envelopes and issue leased dispatch receipts.
- Mailbox ACKs are lease-token bound local receipts, not signed Council response proofs.
- The Node/Python bridge contract validates rehearsal request and response shape.
- The sidecar rehearsal remains bounded to `rehearsal_receipt`.
- The status API reports configured components and current queue counts; it does not run a Council job.
- Live execution, promotion authority, and public claims remain blocked by W-0091 until non-mock sandbox, egress, path-jail, and public handshake evidence are independently verified.
