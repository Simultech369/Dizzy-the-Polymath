# Chokepoints

Purpose: identify where Dizzy itself could become extractive, brittle, or dependency-forming.

Anti-extraction is not only an external political stance. The system has to inspect its own points of leverage: what users depend on, who controls access, what can silently become a rent, and what preserves exit.

## Review Rule

For each chokepoint, ask:

- What dependency does this create?
- Who controls access or defaults?
- What prevents rent extraction, lock-in, or hidden influence?
- What capability does the mechanism give the operator or user?
- What is the exit path if this layer fails or becomes misaligned?

## Current Chokepoints

### Model Providers

Risk: reasoning quality, price, latency, privacy, and availability depend on outside providers.

Current defense:
- local-first runtime
- explicit provider configuration
- no claim that one provider is structurally neutral

Needed:
- provider scoring by privacy, cost, latency, capability, and failure mode
- graceful fallback language when a provider is unavailable

### Prompt-Pack Authority

Risk: compact prompt files quietly become the real constitution while longer doctrine drifts.

Current defense:
- `PROMPT_CORE.md` names the runtime constitution rule
- `scripts/prompt_drift_check.mjs` checks required decision language

Needed:
- byte budgets for default prompt-pack files
- stronger mapping from `DESIGN.md` decisions to compact runtime counterparts

### Private Memory

Risk: durable memory improves judgment but can become ambient surveillance, stale authority, or dependency theater.

Current defense:
- trust zones
- scoped markdown retrieval
- curated `MEMORY.md`
- memory validation
- capability receipts on dispatch and `/agent/execute`
- local operator deletion and inactivity expiry for client continuity

Needed:
- fuller retrieval audit logs for model-backed answers
- freshness and authority metadata on memory snippets
- authenticated client lifecycle if continuity becomes externally user-facing

### Marketplace And Public Surfaces

Risk: paid/public incentives could pressure the system to leak private continuity, over-promise capability, or reshape the core around revenue.

Current defense:
- paid/public continuity defaults to ephemeral
- public surfaces are projections, not the core
- optional market/culture files are marked non-runtime-governing
- `/agent/execute` returns capability receipts with blocked context categories
- `DELETE /agent/continuity` and `POST /agent/continuity/prune` enforce local deletion/expiry

Needed:
- explicit client-visible status beyond first-pass continuity receipts
- refusal path when marketplace incentives conflict with private trust boundaries

### Operator Attention

Risk: maintenance, doctrine, and memory can consume more attention than they return.

Current defense:
- `scripts/maintain.mjs`
- Friction Ledger
- `FILE_ROLES.md`
- sparse trajectory capture

Needed:
- status frontmatter for active upgrades
- pruning cadence for `upgrades/active/`
- maintenance output that stays short enough to read

### Repo Authority

Risk: root files, planning notes, and flavor surfaces look equally important just because they are visible.

Current defense:
- `FILE_ROLES.md`
- root-role validation in `scripts/maintain.mjs`

Needed:
- archive or relocate files when usage shows they are historical, not active
- keep root legible without flattening every surface into doctrine

## Rule

A chokepoint is acceptable only if it creates more capability than dependency, has visible governance, and preserves a credible exit path.
