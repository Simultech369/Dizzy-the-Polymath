# Dizzy

Local-first continuity-and-judgment runtime.

Dizzy is a bounded assistant system designed to help a human preserve orientation, apply judgment under uncertainty, and carry forward only the context that improves present agency. The center of the repo is not companionship, not a generic chatbot, and not a marketplace persona. It is continuity, trust-zone discipline, memory restraint, and legible governance.

## What This Is

- A local-first runtime for a continuity-aware assistant
- A doctrine + runtime repo where the constitutional layer is explicit
- A system with trust zones, retention boundaries, and operator-mediated public surfaces
- A working codebase with health, prompt, governance, memory, and queue/tool infrastructure

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

- [`DESIGN.md`](DESIGN.md): human canonical source of truth
- [`GOVERNANCE.md`](GOVERNANCE.md): plain-language governance summary
- [`PROMPT_CORE.md`](PROMPT_CORE.md): live behavioral core
- [`PROMPT_PACKS.md`](PROMPT_PACKS.md): prompt-pack model
- [`RUNBOOK.md`](RUNBOOK.md): local setup and operational notes
- [`OPERATIONS.md`](OPERATIONS.md): runtime execution overlay
- [`OPERATING_SURFACE.md`](OPERATING_SURFACE.md): optional lightweight outward-facing surface

## Quick Start

Install dependencies:

```powershell
npm install
```

Run the server:

```powershell
node .\agent_server.mjs
```

Run safety checks:

```powershell
node .\scripts\safety_checks.mjs
```

Run the smoke test:

```powershell
node .\smoke_test.mjs
```

For Telegram and optional worker setup, see [`RUNBOOK.md`](RUNBOOK.md).

## Trust Zones And Retention

Dizzy uses trust zones as real runtime boundaries:

- `private_self`: retained continuity and durable memory allowed
- `trusted_collaborator`: selective continuity, narrower disclosure
- `outside_contact`: fresh-context reasoning by default
- `paid_public`: ephemeral by default; continuity only when explicitly enabled per client/task

Retention is intentional and local-first, not ambient.

## Safety Posture

- Loopback bind by default
- Optional bearer auth for non-loopback exposure
- Remote mutations disabled by default
- Self-modification disabled by default
- Explicit external-tool invocation only
- Auto-retrieval scoped to trusted doctrine and memory surfaces

## Political-Economic Direction

The repo carries a political-economic direction centered on anti-extraction, capability, and bounded governance. That direction should be read as orientation for construction, not as a claim that current conditions have already achieved it.

## Verification

Current baseline checks:

- `node .\scripts\safety_checks.mjs`
- `node .\smoke_test.mjs`

## Notes

This repository is intentionally legible about what is implemented, what is operator-mediated, and what remains provisional. If a public surface overclaims maturity, the docs should be corrected rather than cosmetically improved.
