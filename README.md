# Dizzy

<div align="center">

<img src="dizzylogofull.png" alt="Dizzy Studio logo" width="420">

**Local-first control plane for routing, bounded memory rules, tool guardrails, receipts, and user-facing channels.**

*Dizzy does not train or fine-tune models; it is the router and control plane around them.*

</div>

## System Roles (Read First)

- **Dizzy (`Dizzy-the-Polymath`) = Local Control Plane**: Owns request routing, trust-zone memory rules, sandboxed tool execution, PII masking before hosted calls, hash-linked audit receipts, Operator Inbox, and user-facing channels.
- **CouncilEngine (`Simultech369/CouncilEngine`) = Offline Verification Helper**: Runs deterministic code/AST/policy checks, verification task routing, and human-approved promotion gates. CouncilEngine is **not** a second chat brain or consumer product.
- **Pharmacy / PBM (`Pharmacy-Fiduciary-Commons`) = Optional Domain**: Healthcare/PBM auditing is one domain workload that uses Dizzy and CouncilEngine primitives, **not** the whole product.

**Current public-view status:** this repository is ready for serious collaborator review from this checkout, not a hosted production launch. Public and dashboard wording follows [Public Truth Language](docs/public_truth_language.md): say what is verified, what is rehearsal, what is local, and what remains operator-mediated.

`/api/a2a/incoming` is a single-runtime, shared-secret signed JSON ingress proof (with optional local Ed25519 trust-store verification). It does not prove external peer identity, signed responses, distributed replay protection, or cross-runtime interoperability. Start with [QUICKSTART.md](QUICKSTART.md) or [Dizzy Thesis In 15 Minutes](docs/thesis_in_15_minutes.md). For background orientation, see [Worldview and Governance Direction](docs/worldview_and_governance_direction.md).

---

## Quick Start (Windows and Mac/Linux)

Node.js 20.18.1+ is required. Redis and external model API keys are optional for local verification.

### Mac / Linux (Bash + `curl`)

```bash
# 1. Install dependencies
npm install

# 2. Launch the local control-plane API (binds to 127.0.0.1:3000)
DIZZY_AUTH_TOKEN="local-dev-operator-token-at-least-32-chars" npm start
```

In a second terminal, query local endpoints with `curl`:

```bash
export DIZZY_AUTH_TOKEN="local-dev-operator-token-at-least-32-chars"

# Check runtime, model, mailbox, and disk health
curl -s http://127.0.0.1:3000/health | jq .

# Fetch active prompt bundle metadata
curl -s http://127.0.0.1:3000/prompt | jq .

# Inspect authenticated Operator Inbox (approvals, blockers, spend stops)
curl -s -H "Authorization: Bearer $DIZZY_AUTH_TOKEN" \
  http://127.0.0.1:3000/api/operator/inbox | jq .
```

To enable the local Operator Dashboard (`http://localhost:3000/dashboard`):

```bash
DIZZY_DASHBOARD_ENABLED=1 DIZZY_AUTH_TOKEN="local-dev-operator-token-at-least-32-chars" npm start
```

### Windows (PowerShell)

```powershell
# 1. Install dependencies
npm install

# 2. Launch with opt-in dashboard enabled
$env:DIZZY_AUTH_TOKEN="local-dev-operator-token-at-least-32-chars"
$env:DIZZY_DASHBOARD_ENABLED="1"
npm start
```

In another PowerShell window:

```powershell
$env:DIZZY_AUTH_TOKEN="local-dev-operator-token-at-least-32-chars"
$headers = @{ Authorization = "Bearer $env:DIZZY_AUTH_TOKEN" }
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/prompt
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/operator/inbox" -Headers $headers
```

---

## Memory Architecture: Stages, Trust Zones, and Tests

Dizzy enforces bounded, expiring memory rather than ambient infinite retention.

### 1. Five Memory Stages + Explicit Deletion
Implemented in `lib/cognitive_memory_engine.mjs`, `lib/memory_hygiene_scanner.mjs`, and `lib/memory_wiki_adapter.mjs` (see [Memory Wiki Examples](docs/memory_wiki_examples.md)):

1. **Capture**: Checks `lib/capture_eligibility.mjs` and `lib/durable_write_policy.mjs`, scans for poisoned instructions or raw secrets, and assigns an explicit `trust_zone` and `sensitivity_tier` (`public_safe`, `normal`, `do_not_export`).
2. **Consolidate**: Deduplicates and merges records strictly inside `canonical_key + trust_zone + sensitivity_tier` so private notes never collapse into public records.
3. **Retrieve**: Enforces trust-zone allowlists; unrecognized zones fail closed with an `invalid_trust_zone` receipt.
4. **Reconcile**: Resolves conflicting facts deterministically by confidence, reinforcement, and governance invariants.
5. **Decay & Delete**: Applies time-based decay and memory-pressure eviction to low-importance entries while emitting hash-backed eviction/deletion receipts (`dizzy.cognitive_memory_eviction_receipt.v1`).

### 2. Trust Zones and Multi-Turn Context Reuse

| Trust Zone | Default Continuity & Reuse Rule | Durable Memory | Hosted Model Egress |
| :--- | :--- | :--- | :--- |
| `private_self` | Reuses local conversation history; starts clean on zone downgrade or policy drift | Allowed (`do_not_export` supported) | Cloud routes blocked by local isolation policy |
| `trusted_collaborator` | Scoped continuity; starts clean if trust zone or prompt policy changes | Selective, audited writes | PII masked via `lib/pii_safe_inference_proxy.mjs` |
| `outside_contact` | Starts clean (fresh context) by default | Disabled by default | PII masked; private-zone leaks blocked |
| `paid_public` | Ephemeral clean start by default; scoped client continuity only when explicitly enabled (7-day inactivity expiry) | Disabled | PII masked; strict egress DLP |

### 3. Where Memory Tests Live
- Lifecycle, zone isolation, and consolidation: `scripts/cognitive_memory_engine_test.mjs` (`npm run test:cognitive-memory`)
- Path-jailed Markdown wiki storage: `scripts/memory_wiki_adapter_test.mjs` (`npm run test:memory-wiki`)
- Poisoned/secret stored-content scanner & keep/delete receipts: `scripts/memory_hygiene_scanner_test.mjs` (`npm run test:memory-hygiene`)
- Frontmatter & line-budget validation: `scripts/memory_validate.mjs` (`npm run check:memory`)
- Cross-client continuity & graph filtering: `scripts/safety_checks.mjs` (`npm test`)

---

## Major Rules and Proof Commands

Every core governance rule is backed by a deterministic local test command:

| Major Rule / Invariant | Primary Modules | Verification Command |
| :--- | :--- | :--- |
| Explicit workflow states, crash-safe HITL resume, illegal-jump rejection | `lib/workflow_state_machines.mjs`, `lib/hitl_approval_gateway.mjs` | `npm run test:workflow-states` |
| Loopback auth, rate limits, proxy IP mistrust, symlink & HTTP bounds | `agent_server.mjs`, `lib/ingress_gateway.mjs` | `npm test` |
| Unified hash-linked audit ledger & debug replay | `lib/unified_audit_ledger.mjs`, `lib/receipt_trace_viewer.mjs` | `npm run test:audit-ledger` |
| Tool sandbox zone allowlists, traversal block, input/output PII scrub | `lib/tool_guardrails_middleware.mjs`, `lib/tools.mjs` | `npm run test:tool-guardrails` |
| Signed A2A ingress (HMAC/Ed25519) + mailbox injection/PII sanitization | `lib/a2a_boundary_guard.mjs`, `lib/a2a_mailbox_bridge.mjs`, `lib/inter_agent_sanitization_proxy.mjs` | `npm run test:a2a-boundary && npm run test:a2a-mailbox` |
| Source-grounded answers, missing-evidence flags, spoof/poison detection | `lib/citation_grounding_verifier.mjs`, `lib/support_class_engine.mjs` | `npm run test:citation-grounding && npm run test:dispatch-grounding` |
| Memory zone/sensitivity partitioning, keep/delete receipts, poison scan | `lib/cognitive_memory_engine.mjs`, `lib/memory_hygiene_scanner.mjs` | `npm run test:cognitive-memory && npm run test:memory-hygiene` |
| PII placeholder masking before hosted models + private-zone DLP block | `lib/pii_safe_inference_proxy.mjs`, `lib/dispatch.mjs` | `npm run test:pii-proxy` |
| Zone-keyed cache TTLs & memory-pressure eviction | `lib/structural_query_cache.mjs`, `lib/daemon_hygiene.mjs` | `npm run test:structural-query-cache && npm run test:daemon-hygiene` |
| Structured external event triggers (cheap code filter first + subscriptions) | `lib/event_trigger_router.mjs` | `npm run test:event-triggers` |
| Work-type routing (math/logic -> T0 deterministic/Council; NL -> LLM) | `lib/routing_policy.mjs`, `lib/dispatch.mjs` | `npm run test:routing-policy && npm run test:work-type-routing` |
| SSE streaming states, ITL stall detection, bounded backpressure | `lib/sse_stream.mjs` | `npm run test:streaming-response` |
| Dizzy <-> CouncilEngine shared approval states & verification bridge | `lib/node_python_council_bridge_contract.mjs`, `CouncilEngine/human_approval.py` | `npm run test:node-python-bridge-contract && npm run test:dizzy-council-contract` |
| Multi-turn jailbreak, tool fuzzing, chaos, and malicious skill/dep checks | `scripts/fuzzing_and_injection_tests.mjs`, `scripts/multi_turn_jailbreak_eval.mjs` | `npm run test:attack-suite && npm run check:skills` |
| Full 3-layer OSS Council syntax, governance, and execution gate | `scripts/oss_council_audit.mjs` | `npm run check:council` |

---

## What Works Today vs. Future Ideas

### Conversation vs. Internal Debug Session
- **User / Operator Conversation Surface**: Operators and users interact with clean conversation threads, clear degraded/offline status messages, and a single **Operator Inbox** (`/api/operator/inbox` and Dashboard Inbox tab) grouping pending human approvals, active blockers, spend stops, and open questions.
- **Internal Debug Session (Inspect / Replay)**: Raw tool call payloads, multi-hop routing attempts, StateM checkpoints, and hash-linked audit chains are **never** dumped as the main chat UI; they live under dedicated Inspect/Replay endpoints (`/api/operator/audit-replay`) and the Receipt Trail inspector.

### What Runs Today (Local Checkout)

| Surface | Status & Boundary |
| :--- | :--- |
| Local HTTP Control Plane | `/health` (models, mailbox, disk, cold seats), `/prompt`, `/governance`, `/dispatch/incoming`, `/agent/execute/stream`, `/api/events/trigger`, `/api/operator/inbox` |
| Guided Trust Cockpit Dashboard | Opt-in at `http://localhost:3000/dashboard` only when `DIZZY_DASHBOARD_ENABLED=1` is set before `npm start`. Operator captured the W-0106 walkthrough screenshots offline. No repository path or PR attachment is recorded in this checkout, so this is operator-observed evidence rather than a repository-verifiable launch artifact. W-0106 is operationally resolved. |
| Capability & Work-Type Router | Routes math/logic/invariants to deterministic T0 handlers or offline Council checks; routes natural language across bounded tiers with ordered fallback (`stronger -> weaker -> local -> cache`) and spend caps (`lib/cost_kill_switch.mjs`). See **External Gateway Posture** in [`docs/external_gateway_posture.md`](docs/external_gateway_posture.md): external routers provide reach, never verification authority. |
| Experimental Sidecars | `lib/sqlite_operational_store.mjs` and `lib/structural_query_cache.mjs` are retained as reversible local Experimental sidecars, non-authoritative over canonical state. |
| Offline CouncilEngine Bridge | Schema-validated Node/Python rehearsal bridge, verification job router, and shared HITL approval state contract (`waiting_for_approval`, `approved`, `rejected`). |

### Future Ideas (Not Claimed Today)
- **Hosted multi-tenant SaaS launch (Phase 4)**: Public TLS termination, external OAuth/SSO, multi-tenant database RLS, and public SLA monitoring are future work, not active claims.
- **Public cross-runtime A2A federation**: Signed cross-network peer discovery and distributed replay caches remain future work (see [`NEXT.md`](NEXT.md)).
- **Distributed multi-machine agent clusters (Phase 5)**: Multi-daemon fleet orchestration and autonomous extension installation are out of current scope.

---

## Repository Map (Important Files and Docs)

| Category | Path | Role |
| :--- | :--- | :--- |
| **Control-Plane Entrypoints** | `agent_server.mjs`, `worker.mjs`, `lib/dispatch.mjs` | HTTP API, SSE streaming, background worker, and message/work-type dispatch |
| **Workflows & HITL** | `lib/workflow_state_machines.mjs`, `lib/hitl_approval_gateway.mjs`, `lib/statem_runbook_bridge.mjs` | Explicit workflow FSMs, crash-resumable HITL checkpoints, and 4-phase StateM runbooks |
| **Routing, Cost & Watchdog** | `lib/routing_policy.mjs`, `lib/model_router.mjs`, `lib/cost_kill_switch.mjs`, `lib/runaway_execution_watchdog.mjs` | Tiered capability routing, spend caps/alerts, and non-progressing loop containment |
| **Safety, PII & Grounding** | `lib/tool_guardrails_middleware.mjs`, `lib/pii_safe_inference_proxy.mjs`, `lib/inter_agent_sanitization_proxy.mjs`, `lib/citation_grounding_verifier.mjs` | Tool sandboxing, hosted-call PII masking, A2A sanitization, and source-grounded verification |
| **Memory & Audit Ledger** | `lib/cognitive_memory_engine.mjs`, `lib/memory_wiki_adapter.mjs`, `lib/memory_hygiene_scanner.mjs`, `lib/unified_audit_ledger.mjs` | Zone-partitioned memory lifecycle, poison scanner, and unified hash-linked audit log |
| **Operator UI** | `dashboard/index.html`, `dashboard/dashboard.js`, `lib/dashboard.mjs` | Calm local dashboard centered on Operator Inbox, status, budgets, and inspectable receipts |
| **Architecture & Threat Docs** | [`DESIGN.md`](DESIGN.md), [`docs/threat_model.md`](docs/threat_model.md), [`docs/workflows_and_state_machines.md`](docs/workflows_and_state_machines.md), [`REPO_GUIDE.md`](REPO_GUIDE.md), [`RUNBOOK.md`](RUNBOOK.md), [`MODEL_INVENTORY.md`](MODEL_INVENTORY.md) | Canonical design state, unified 6-surface threat model, workflow catalog, runbook, and model roster |
| **Planning & Governance** | [`NEXT.md`](NEXT.md), [`CONSTITUTION.md`](CONSTITUTION.md), [`PROMPT_CORE.md`](PROMPT_CORE.md), [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Completed/open work ledger, behavioral core, and clean-room license provenance |

---

## Status Vocabulary

- `runtime-enforced`: implemented in code, tests, or machine-facing behavior
- `constitutional`: live prompt-pack or governing doctrine that shapes default behavior
- `operator overlay`: operational practice or manual boundary, not fully automated
- `planning candidate`: proposal under review in `upgrades/`
- `historical provenance`: retained context for audit, not an active recommendation
- `deprecated`: kept only to explain what should not guide future work

## Production Readiness Checklist

This is the minimum bar before any hosted or client-facing surface should be treated as production-ready. The integrated gate lives in [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) and [`EXTERNAL_SURFACE_REVIEW.md`](EXTERNAL_SURFACE_REVIEW.md), checked by:

```bash
npm run check:production
npm run check:dependencies
```
