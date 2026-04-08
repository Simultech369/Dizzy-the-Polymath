# Drift Audit

Snapshot date: 2026-04-02

Purpose: label major docs and surfaces as `accurate`, `stale`, `aspirational`, or `dangerous-if-literal` relative to the current runtime.

## Accurate

- `RUNBOOK.md`
  - Mostly aligned after the recent safety updates.
  - Correctly reflects tool-network defaults, Telegram startup-message behavior, and remote-mutation gating.

- `GOVERNANCE.md`
  - Still matches the runtime at a high level.
  - Structural transparency, contestability, and local-first posture are represented honestly.

- `LEGAL-GUARDRAILS.md`
  - Broadly aligned with the current runtime posture.
  - Restricted-content blocking in fulfillment is still heuristic, but the general boundary is accurate.

## Stale

- `scripts/doctor_telegram.ps1`
  - Previously suggested a localhost tool fetch from Telegram.
  - This is now corrected, but any copies of the old workflow should be treated as stale.

- Marketplace-facing descriptions in `agent_server.mjs`
  - The profile/services surface exists, but it remains minimal and does not imply a full production marketplace backend.

## Aspirational

- `MARKETPLACE_PROTOCOL.md`
  - `Client Intake (before generating)` is not enforced by code today.
  - `Metadata Sidecar` is partly reflected in the new staged fulfillment metadata, but not yet generalized across all generation flows.
  - `Financial Guardrails (Gas Limit)` is a policy intention; there is no generalized cost-heartbeat enforcement in runtime code yet.

- `GOVERNANCE.md` contestability flow
  - It points users toward `NEXT.md` and `DESIGN.md`, which is a reasonable governance workflow, but the runtime does not actively surface or enforce that path.

## Dangerous If Literal

- Any reading of the marketplace docs that implies “client-safe production fulfillment is complete.”
  - The runtime is safer now, but fulfillment still depends on operator-staged assets.
  - The system is not yet a fully automated, production-grade image marketplace pipeline.

- Any reading of chat commands that assumes `/improve` and `/apply` are ordinary user features.
  - They are now treated as privileged local operator features and require `DIZZY_ALLOW_SELF_MODIFY=1`.

## Current Structural Tensions

- Governance and protocol docs are more mature than the automation around them.
  - The repo expresses a strong philosophy of calibrated operation.
  - Some of that philosophy is still enforced socially or procedurally rather than through code.

- Marketplace intent is ahead of marketplace implementation.
  - The repo clearly wants a commercial mode.
  - The codebase currently supports a constrained, operator-mediated version of that mode rather than a complete autonomous one.

- Memory and self-modification features are powerful relative to the current authorization model.
  - They are now better gated.
  - They still deserve ongoing caution because they mutate local state from a chat-oriented system.

## Recommended Next Moves

1. Keep self-modification disabled by default and treat it as a maintenance tool, not a product feature.
2. Add one Redis-backed integration test outside the current fake-redis test layer when a local Redis service is available.
3. Either trim `MARKETPLACE_PROTOCOL.md` to current reality or add explicit “operator-mediated” language so it does not over-claim automation.
4. Decide whether the marketplace/profile endpoints are informational only or part of a real public contract, then document them accordingly.
