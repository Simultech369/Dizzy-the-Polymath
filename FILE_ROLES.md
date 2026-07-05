# File Roles

Purpose: classify root-level files so proximity does not imply equal authority.

The root is intentionally legible, but not every root file governs runtime behavior. This map prevents flavor, workshop residue, and optional surfaces from masquerading as constitutional doctrine.

## Authority Order

1. Runtime code and tests for enforced behavior.
2. Default prompt-pack files for live chat behavior.
3. `DESIGN.md` and `state.json` for human/machine decision source of truth.
4. Mechanism and governance docs for reusable design logic.
5. Operational docs for setup and running.
6. Public/client surfaces and flavor files.
7. Historical residue or local artifacts.

If this map conflicts with `DESIGN.md`, `DESIGN.md` wins.

## Core Runtime

- `agent_server.mjs`
- `worker.mjs`
- `smoke_test.mjs`
- `package.json`
- `package-lock.json`

## Workspace Protocol And Repo Config

- `AGENTS.md`
- `BOOTSTRAP.md`
- `.editorconfig`
- `.env`
- `.env.example`
- `.gitattributes`
- `.gitignore`
- `LICENSE`

## Canonical Design And State

- `DESIGN.md`
- `state.json`
- `NEXT.md`
- `REPO_GUIDE.md`
- `README.md`

## Planning Maps

- `EXPERIMENT_RECONCILIATION.md`

Planning maps coordinate review and promotion work. They are non-authoritative until their decisions are promoted into `DESIGN.md`, `NEXT.md`, runtime code, or tests.

## Live Prompt Pack / Runtime Constitution

- `CONSTITUTIONAL_KERNEL.md`
- `CONSTITUTION.md`
- `IDENTITY.md`
- `identity/personas/SOUL.md`
- `TOOLS.md`
- `identity/personas/USER.md`
- `PROMPT_CORE.md`
- `PROMPT_MODES.md`
- `PROMPT_PACKS.md`

## Governance And Mechanisms

- `REFERENCE_PATTERNS.md`
- `INTERACTION_NORMS.md`
- `PROTOCOL.md`
- `LEGAL-GUARDRAILS.md`
- `CHOKEPOINTS.md`
- `MECHANISM_SIEVE.md`
- `PORTABILITY.md`
- `MECHANISMS.md`
- `MEMORY_OWNERSHIP.md`
- `ECONOMICS.md`
- `DRIFT_AUDIT.md`
- `DEPENDENCY_GOVERNANCE.md`
- `PARALLEL_INFRASTRUCTURE_PATTERNS.md`

## Operations And Interfaces

- `RUNBOOK.md`
- `OPERATIONS.md`
- `OPERATOR.md`
- `PRODUCTION_READINESS.md`
- `EXTERNAL_SURFACE_REVIEW.md`
- `PROFILE_README.md`
- `OPERATING_LOOP.md`
- `OPERATING_SURFACE.md`
- `CAPABILITIES.md`
- `COMMUNICATION.md`
- `MARKETPLACE_PROTOCOL.md`
- `CLIENTS.md`
- `CLIENT_TEMPLATE.md`
- `dizzy_poll_deliver.mjs`

## Memory Index

- `MEMORY.md`

Memory is curated context, not doctrine. Topic files live under `memory/`.

## Context Packs

- `context-packs/*.md`
- `context-packs/experiments/*.md`

Root-level context packs are loading maps for bounded long-context reasoning passes. They are not doctrine unless their contents are promoted into the live prompt pack, governance docs, runtime code, or curated memory.

Experimental context packs are offline conceptual sketches or stress specs. They may inform review, but they are not active loading maps and must not be cited as implemented runtime behavior.

## Ignored External Reference Clones

- `_ext/`
- `_external/`

These directories are local research inputs and are ignored by git. They are not first-party Dizzy surfaces, not automatic retrieval roots, and not proof of implemented capability. Patterns may be promoted only after translation through `REFERENCE_PATTERNS.md`, `DESIGN.md`, runtime code, tests, or reviewed local skills. Public/client-facing surfaces should not expose clone inventory unless source attribution is intentionally relevant.

## Local Skills

- `skills/*/SKILL.md`
- `skills/registry.json`
- `skills/REVIEW.md`

Local skills are reviewed task-workflow guidance. They are selected per request below the constitutional prompt and do not grant tools, credentials, network access, or authority beyond existing runtime boundaries.

## Identity / Optional Voice Surfaces

- `identity/personas/PENGUIN.md`
- `identity/personas/TROLL.md`
- `identity/personas/COPPER-INU.md`
- `identity/personas/COSMIC-CORRESPONDENT.md`

These files may carry style, experiments, or optional public-surface material. `identity/personas/SOUL.md` and `identity/personas/USER.md` are live prompt-pack files; the other persona files do not govern runtime unless compressed into the default prompt pack, tests, or code.

## Optional Strategy Overlays

- `overlays/LEVERAGE.md`

These files may carry optional economic, strategy, or campaign-specific orientation. They do not govern runtime unless explicitly included in a prompt pack or promoted through `DESIGN.md`, tests, or code.

## Local Artifacts / Cleanup Candidates

- `dizzylogofull.png`

Root scratch probes should be archived under ignored runtime storage such as `runtime/local-artifacts/` rather than kept beside governing files. `dizzylogofull.png` is a root asset used by the README and `/assets/logo`; it should not be read as doctrine.

Generated media under `output/` is local operator output and ignored by default.

## Rule

Root presence is not authority. Authority comes from explicit role, runtime inclusion, tests, and documented promotion.
