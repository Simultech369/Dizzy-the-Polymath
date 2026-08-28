# Dizzy

<div align="center">

<img src="dizzylogofull.png" alt="Dizzy Studio logo" width="420">

**Local-first assistant runtime for bounded memory, trust zones, and accountable continuity.**

<p>
  <img alt="Node.js 20.18.1+" src="https://img.shields.io/badge/Node.js-20.18.1%2B-339933?style=for-the-badge&logo=node.js&logoColor=white">
  <img alt="Checks" src="https://img.shields.io/github/actions/workflow/status/Simultech369/Dizzy-the-Polymath/checks.yml?branch=main&style=for-the-badge&label=checks">
  <img alt="License" src="https://img.shields.io/github/license/Simultech369/Dizzy-the-Polymath?style=for-the-badge">
  <img alt="Local-first runtime" src="https://img.shields.io/badge/runtime-local--first-111827?style=for-the-badge">
  <img alt="Trust zones locally tested" src="https://img.shields.io/badge/trust%20zones-locally%20tested-2563eb?style=for-the-badge">
  <img alt="Bounded memory" src="https://img.shields.io/badge/memory-bounded-7c3aed?style=for-the-badge">
  <img alt="Working runtime" src="https://img.shields.io/badge/status-working%20runtime-16a34a?style=for-the-badge">
</p>

> **Quickstart Guide**: See [QUICKSTART.md](QUICKSTART.md) for the **"Try Dizzy in 5 Minutes"** guided walk-through (`/health` + `/prompt`), trust-zone demo, and visual identity map.

</div>

### Repository Structure and Authority

| Layer | Path / Files | Authority Status |
| --- | --- | --- |
| **Runtime** | `agent_server.mjs`, `worker.mjs`, `lib/` | Active, tested execution layer |
| **Experimental** | `lib/sqlite_operational_store.mjs`, `lib/structural_query_cache.mjs` | Retained as local sidecars, reversible and non-authoritative |
| **Doctrine** | `CONSTITUTION.md`, `PROMPT_CORE.md`, `identity/` | High authority, governs prompt packs and boundaries |
| **Prototypes** | `core/prototypes/` | Reference only, non-authoritative cross-language sketches |

Dizzy is a local-first continuity-and-judgment runtime. It helps an operator preserve orientation, apply judgment under uncertainty, and carry forward only the context that improves present agency.

The repo is transparent without turning every working note into doctrine: the runtime is small and bounded; the surrounding documents show how its judgment loop, memory rules, and public/private trust boundaries are being refined.

## What Runs Today

| Surface | Current evidence / check |
| --- | --- |
| Local HTTP runtime | `/health`, `/prompt`, `/governance`, plus opt-in `/memory/graph` |
| SSE execution streaming | `POST /agent/execute/stream` with scoped execute-token auth, bounded backpressure, provider abort propagation, and hash-only stream receipts (`npm run test:streaming-response`) |
| Guided Trust Cockpit Dashboard | Accessible via `http://localhost:3000/dashboard` (`DIZZY_DASHBOARD_ENABLED=1` or `npm start`) |
| 48-Model Catalog & Evidence Ladder | 5 tiers, 4-gate qualification engine, and route compliance in [`MODEL_INVENTORY.md`](MODEL_INVENTORY.md) |
| Prompt governance & Anti-Slop | Scoped prompt loading, byte budgets, and rule-based prose/sycophancy plus visual-surface scanners (`lib/anti_slop_scanner.mjs`, `lib/visual_slop_scanner.mjs`) |
| Bounded memory & Quarantined Bridging | Trust-zone scoped retrieval with opt-in cross-session concept bridging (`runtime/quarantine/`) |
| Bounded Scenario Forking & Time-Travel | Ephemeral trajectory simulation and Euclidean divergence analysis (`lib/scenario_simulator.mjs`) |
| Robust Friction Telemetry | Median Absolute Deviation (MAD) $3\sigma$ anomaly detector and active policy containment |
| Deterministic Lifecycle Hooks | SessionStart/Stop ingress receipts and PreToolUse/PostToolUse tool-runner receipts (`lib/lifecycle_hooks.mjs`) |
| Structural Query Cache | Local dashboard query cache with trust-zone, retention, prompt/config, source-signature, and partition-hash receipts (`lib/structural_query_cache.mjs`) |
| StateM Runbook FSM | Local four-phase `plan -> execute <-> verify -> handoff` bridge with verification barriers (`lib/statem_runbook_bridge.mjs`) |
| A2A-Style Mailbox Bridge | Local sealed handoff/message queue for agent coordination; not public A2A spec compliance yet (`lib/a2a_mailbox_bridge.mjs`) |
| Council Subcommittee Router | 6-role rotating committee scheduler and dialectical tension consensus engine (`lib/council_subcommittee_router.mjs`) |
| OSS Council Audit Suite | 3-layer deterministic verification engine across 105 syntax detail entries and 51 test suites (`npm run check:council`) |

## Quick Start

### 1. Install Dependencies

Node.js 20.18.1+ is required.

```powershell
npm install
```

### 2. Launch the Runtime & Guided Trust Cockpit

Start the server using standard npm start:

```powershell
npm start
```

This launches the agent server locally on `http://127.0.0.1:3000`. Open the Guided Trust Cockpit dashboard at:
`http://localhost:3000/dashboard`

### 3. Inspect Local Endpoints

In another terminal window:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/prompt
```

### 4. Run the Full Verification Suite

Verify total system integrity across 105 syntax detail entries and 51 deterministic execution suites:

```powershell
# Run the complete 3-layer OSS Model Council Audit Engine
npm run check:council

# Run individual verification suites
npm test
npm run test:frontier-simulation
npm run test:anti-slop
npm run test:provider-matrix
npm run test:dashboard-safety
npm run test:structural-query-cache
npm run test:statem-runbook
npm run test:a2a-mailbox
npm run test:job-board-scanner
npm run check:pattern-provenance
```

## The Paranoia Engine: OSS Model Council

Dizzy is not a standard chat bot; it is a strictly-gated state machine. To ensure it never acts unpredictably, all critical decisions and logic changes must pass through a local **OSS Model Council**. 

This Council separates model availability into explicit trust zones, deterministic qualification gates, and dual-chain verification:

```
                              ┌────────────────────────────────────────┐
                              │      Local Repo Snapshot & Diff        │
                              │  (Head commit, staged/unstaged blobs)  │
                              └───────────────────┬────────────────────┘
                                                  │
               ┌──────────────────────────────────┴──────────────────────────────────┐
               ▼                                                                     ▼
 ┌───────────────────────────┐                                         ┌───────────────────────────┐
 │ 🔴 ADVERSARIAL RED-TEAM   │                                         │ 🟢 QUALIFIED VOTER SEATS  │
 │ • Jiunsong SuperGemma     │                                         │ • Qwen-3.8 / Qwen2.5-Coder│
 │ • Jiunsong SuperDeepSeek  │                                         │ • GLM-5.3 / GLM-4         │
 │   (Uncensored GGUFs)      │                                         │ • Mistral Lineage         │
 └─────────────┬─────────────┘                                         └─────────────┬─────────────┘
               │                                                                     │
               ▼                                                                     ▼
 ┌───────────────────────────┐                                         ┌───────────────────────────┐
 │ 🛡️ VERIFIER ADVERSARIAL   │ ◄───────────────────────────────────────┤ ⚖️ 3-FAMILY QUORUM BALLOT │
 │ Asserts 11 invariants     │                                         │ Approvals >= ceil(2N/3)   │
 └───────────────────────────┘                                         └───────────────────────────┘
```

### Qualification & Integration

Before any model is allowed to operate within Dizzy, it must prove its reliability:
- **4-Gate Qualification Ladder**: Every model candidate moves through $G_1\ (\text{JSON Strictness}) \rightarrow G_2\ (\text{Benign Control}) \rightarrow G_3\ (\text{Grounded Bug Detection}) \rightarrow G_4\ (\text{Sealed Receipt})$ before promotion to active voting pools.

As a local-first system, Dizzy also acts as a secure orchestrator for other tools in your environment:
- **Ecosystem Integrations (Sovereign Satellites)**: Dizzy provides native interoperability with local-first tools like `Gitlawb/zero` (decentralized commit signing), `Gitlawb/openclaude` (consensus coordination), `freecodexyz/free-code` (zero-telemetry pairing CLI), and `InclusionAI` models (`Ling-3.0`, `Ming-omni-tts`, `LLaDA2.0-Uni`).
- **Complete Catalog**: See [`MODEL_INVENTORY.md`](MODEL_INVENTORY.md) for full 48-model catalog, tier mappings, and cryptographic route attestations.

For Telegram, model backends, Redis, workers, and optional marketplace surfaces, see [`RUNBOOK.md`](RUNBOOK.md).

For a guided map of the repo, see [`REPO_GUIDE.md`](REPO_GUIDE.md).

## What This Is

- A local-first runtime for a continuity-aware assistant
- A doctrine + runtime repo where the constitutional layer is explicit
- A system with trust zones, retention boundaries, and operator-mediated public surfaces
- A working codebase with health, prompt, governance, memory, queue, and tool infrastructure

## What This Is Not

- A finished commercial product
- A turnkey hosted service
- A general claim that the political-economic conditions described in the docs already exist
- A public ontology-performance project

The public or paid layer is currently a constrained projection of the core system and remains operator-mediated.

## Current Status

- Local-first runtime works
- Governance and prompt-pack architecture are implemented
- Paid/public mode defaults to ephemeral continuity unless explicitly enabled per client/task
- Automatic markdown retrieval is scoped to trusted doctrine docs plus `memory/`
- Marketplace/public endpoints are informational and informal, not a mature storefront contract

## Repo Map

| File | Role |
| --- | --- |
| [`DESIGN.md`](DESIGN.md) | Human canonical source of truth |
| [`INTERACTION_NORMS.md`](INTERACTION_NORMS.md) | Plain-language interaction and governance summary |
| [`PROMPT_CORE.md`](PROMPT_CORE.md) | Live behavioral core |
| [`PROMPT_PACKS.md`](PROMPT_PACKS.md) | Prompt-pack model |
| [`RUNBOOK.md`](RUNBOOK.md) | Local setup and operational notes |
| [`REPO_GUIDE.md`](REPO_GUIDE.md) | Guided map for first-time readers and maintainers |
| [`FILE_ROLES.md`](FILE_ROLES.md) | Root-file authority and role map |
| [`MECHANISMS.md`](MECHANISMS.md) | Reusable design mechanisms in the repo |
| [`CHOKEPOINTS.md`](CHOKEPOINTS.md) | Self-inspection map for dependency, capture, and exit risks |
| [`OPERATING_LOOP.md`](OPERATING_LOOP.md) | Daily operator loop for turning work into durable value |
| [`OPERATIONS.md`](OPERATIONS.md) | Runtime execution overlay |
| [`MECHANISM_SIEVE.md`](MECHANISM_SIEVE.md) | Worksheet for converting values into mechanisms |
| [`PORTABILITY.md`](PORTABILITY.md) | Export, deletion, and trust-zone boundaries for continuity records |
| [`OPERATING_SURFACE.md`](OPERATING_SURFACE.md) | Optional lightweight outward-facing surface |
| [`upgrades/`](upgrades/) | Planning lane, review trail, and candidate improvements; not runtime doctrine |

## Trust Zones And Retention

Dizzy uses trust zones as real runtime boundaries:

| Zone | Default continuity posture |
| --- | --- |
| `private_self` | Retained continuity and durable memory allowed |
| `trusted_collaborator` | Selective continuity, narrower disclosure |
| `outside_contact` | Fresh-context reasoning by default |
| `paid_public` | Ephemeral by default; continuity only when explicitly enabled per client/task |

Retention is intentional and local-first, not ambient.

## Safety Posture

- Loopback bind by default
- Operator-control routes require `DIZZY_AUTH_TOKEN` by default, including direct local dispatch, agent execution, and continuity export/delete/prune
- Remote mutations disabled by default
- Self-modification disabled by default
- Explicit external-tool invocation only
- Auto-retrieval scoped to trusted doctrine and memory surfaces

## Political-Economic Direction

The repo carries a political-economic direction centered on anti-extraction, capability, and bounded governance. That direction should be read as orientation for construction, not as a claim that current conditions have already achieved it.

## Status Vocabulary

- `runtime-enforced`: implemented in code, tests, or machine-facing behavior
- `constitutional`: live prompt-pack or governing doctrine that shapes default behavior
- `operator overlay`: operational practice or manual boundary, not fully automated
- `planning candidate`: proposal under review in `upgrades/`
- `historical provenance`: retained context for audit, not an active recommendation
- `deprecated`: kept only to explain what should not guide future work

## Production Readiness Checklist

This is the minimum bar before any hosted or client-facing surface should be treated as production-ready.

The integrated project gate lives in [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) and is checked by:

```powershell
npm run check:production
npm run check:dependencies
```

Use [`EXTERNAL_SURFACE_REVIEW.md`](EXTERNAL_SURFACE_REVIEW.md) before adding any public form, auth provider, edge provider, hosted database, or client-facing storage.

| Area | Requirement |
| --- | --- |
| Minified front end | Production build uses minified assets, no exposed secrets, no public source maps unless intentionally gated, and no environment variables shipped into client bundles unless safe for public use |
| Database | Row-level security is enabled where supported, every authenticated read/write path is scoped to the current user or tenant, and service-role credentials never touch the browser |
| Version control | Main branch is protected, releases are tagged, secrets are excluded from git history, and deploys come from reviewed commits |
| APIs | Auth, input validation, schema checks, CORS policy, request size limits, structured errors, and explicit public/private route boundaries are in place |
| Hosting and deployment | Deploy target uses HTTPS, least-privilege environment variables, rollback path, health checks, and separate development/staging/production configuration |
| External intake and providers | Public forms, auth providers, hosted databases, edge providers, and storage providers are scoped adapters with documented purpose, collected fields, destination, retention, deletion/export path, logging posture, and secret boundary |
| Rate limiting | Public, auth, and expensive routes have per-IP or per-user limits; abuse limits fail closed without leaking private state |
| Caching | Static assets are cacheable, sensitive responses are not cached publicly, and cache invalidation is explicit for user-specific data |
| Scaling | Runtime has documented resource assumptions, queue/backpressure behavior, horizontal-scaling constraints, and failure modes for Redis/database/provider outages |
| Dependency/API drift | Dependency, lockfile, runtime, provider, and external API contract changes are classified before promotion; provider keys stay in environment variables, not CLI args |
| Error tracking | Server and client errors are captured with environment, release, and request context, while secrets and private user content are scrubbed |
| Accessibility / ADA | Public UI targets WCAG 2.2 AA; legal/procurement-sensitive surfaces verify at least WCAG 2.1 AA, with keyboard navigation, semantic HTML, labels, focus states, contrast, alt text, reduced-motion support, and screen-reader checks |

## Launch Proof To Capture

- Screenshot or GIF of the production build running
- `/health` response from the deployed target
- Passing test output from the release commit
- Accessibility scan results plus one manual keyboard/screen-reader pass
- Rate-limit behavior shown on one public route
- Error-tracking dashboard receiving a test event
- External intake/provider data-flow map if any form, auth provider, edge provider, hosted database, or client-facing storage is added
- Database RLS policy notes or migration references
- Deployment rollback command or provider rollback path

## Notes

This repository is intentionally legible about what is implemented, what is operator-mediated, and what remains provisional. If a public surface overclaims maturity, correct the claim rather than decorating it.
