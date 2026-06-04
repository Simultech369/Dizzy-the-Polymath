# Dizzy

A local-first assistant runtime for bounded memory, trust zones, and accountable continuity.

Dizzy helps a human preserve orientation, apply judgment under uncertainty, and carry forward only the context that improves present agency. The center is not companionship, not a generic chatbot, and not a marketplace persona. It is disciplined continuity across time, risk, and trust zones.

**The first live execution layer running under Dizzy's judgment loop is the [Pharmacy Fiduciary Commons](file:///C:/Users/Josh/.gemini/antigravity/scratch/Pharmacy-Fiduciary-Commons/README.md), which implements the Wellbeing Commons Kernel to route pharmaceutical rebate surplus directly back to independent pharmacies and patients.**

The repo is transparent without turning every working note into doctrine. Read it as a working instrument with a visible workshop attached: the runtime is small and bounded; the surrounding notes show how its judgment is being refined.

## Quick Start

Install dependencies:

```powershell
npm install
```

Run the server:

```powershell
node .\agent_server.mjs
```

In another terminal, inspect the local runtime:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/prompt
Invoke-RestMethod http://127.0.0.1:3000/memory/graph
```

Run verification:

```powershell
node .\scripts\safety_checks.mjs
node .\smoke_test.mjs
node .\scripts\sync_state.mjs --check
```

For Telegram, model backends, Redis, workers, and optional marketplace surfaces, see [`RUNBOOK.md`](RUNBOOK.md).

For a guided map of the repo, see [`REPO_GUIDE.md`](REPO_GUIDE.md).

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
- [`REPO_GUIDE.md`](REPO_GUIDE.md): guided map for first-time readers and maintainers
- [`FILE_ROLES.md`](FILE_ROLES.md): root-file authority and role map
- [`MECHANISMS.md`](MECHANISMS.md): reusable design mechanisms in the repo
- [`CHOKEPOINTS.md`](CHOKEPOINTS.md): self-inspection map for dependency, capture, and exit risks
- [`OPERATING_LOOP.md`](OPERATING_LOOP.md): daily operator loop for turning work into durable value
- [`OPERATIONS.md`](OPERATIONS.md): runtime execution overlay
- [`MECHANISM_SIEVE.md`](MECHANISM_SIEVE.md): worksheet for converting anti-extractive values into ownership, governance, enforcement, exit, and capability mechanisms
- [`OPERATING_SURFACE.md`](OPERATING_SURFACE.md): optional lightweight outward-facing surface
- [`upgrades/`](upgrades/): planning lane, review trail, and candidate improvements; not runtime doctrine

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

## Status Vocabulary

- `runtime-enforced`: implemented in code, tests, or machine-facing behavior
- `constitutional`: live prompt-pack or governing doctrine that shapes default behavior
- `operator overlay`: operational practice or manual boundary, not fully automated
- `planning candidate`: proposal under review in `upgrades/`
- `historical provenance`: retained context for audit, not an active recommendation
- `deprecated`: kept only to explain what should not guide future work

## Verification

Current baseline checks:

- `node .\scripts\safety_checks.mjs`
- `node .\smoke_test.mjs`

## Notes

This repository is intentionally legible about what is implemented, what is operator-mediated, and what remains provisional. If a public surface overclaims maturity, correct the claim rather than decorating it.
