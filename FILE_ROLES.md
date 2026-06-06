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
- `.env.example`
- `.gitattributes`
- `.gitignore`

## Canonical Design And State

- `DESIGN.md`
- `state.json`
- `NEXT.md`
- `REPO_GUIDE.md`
- `README.md`

## Live Prompt Pack / Runtime Constitution

- `CONSTITUTIONAL_KERNEL.md`
- `CONSTITUTION.md`
- `IDENTITY.md`
- `identity/personas/SOUL.md`
- `HEARTBEAT.md`
- `TOOLS.md`
- `identity/personas/USER.md`
- `PROMPT_CORE.md`
- `PROMPT_MODES.md`
- `PROMPT_PACKS.md`

## Governance And Mechanisms

- `REFERENCE_PATTERNS.md`
- `GOVERNANCE.md`
- `PROTOCOL.md`
- `LEGAL-GUARDRAILS.md`
- `CHOKEPOINTS.md`
- `MECHANISM_SIEVE.md`
- `MECHANISMS.md`
- `MEMORY_OWNERSHIP.md`
- `ECONOMICS.md`
- `DRIFT_AUDIT.md`
- `PARALLEL_INFRASTRUCTURE_PATTERNS.md`

## Operations And Interfaces

- `RUNBOOK.md`
- `OPERATIONS.md`
- `OPERATOR.md`
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

Context packs are loading maps for bounded long-context reasoning passes. They are not doctrine unless their contents are promoted into the live prompt pack, governance docs, runtime code, or curated memory.

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

- `patch_body.txt`
- `patch_headers.txt`
- `result.png`
- `dizzylogofull.png`

These should not be read as doctrine. Some are assets; some may be cleanup candidates.

## Rule

Root presence is not authority. Authority comes from explicit role, runtime inclusion, tests, and documented promotion.
