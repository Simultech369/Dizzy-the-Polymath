# Repo-Wide Fit Map

Date: 2026-04-21

Purpose: place current repo subsystems, dormant branches, and accumulated idea fragments into a coherent upgrade map.

## Core reading

This repo is not one thing.

It currently contains at least seven distinct layers:

1. constitutional / governance layer
2. prompt-pack and behavioral runtime layer
3. messaging + execution runtime
4. memory / continuity layer
5. skills and capability layer
6. public / marketplace projection layer
7. comparison and external-inspiration layer

The upgrade opportunity is mostly about tightening interfaces between these layers.

## 1. Constitutional / governance layer

Key files:

- `DESIGN.md`
- `state.json`
- `NEXT.md`
- `AGENTS.md`
- `IDENTITY.md`
- `SOUL.md`
- `HEARTBEAT.md`
- `TOOLS.md`
- `USER.md`
- `PROTOCOL.md`
- `GOVERNANCE.md`

Current strength:

- unusually explicit and legible
- trust zones are already architectural, not just stylistic

Best fitting ideas:

### Better state sync discipline

Where it fits:

- `DESIGN.md` -> `state.json` -> runtime prompt assembly

Opportunity:

- add richer machine-readable upgrade flags so experiments like memory backends, provenance layers, or public operating surfaces are declared rather than informally accreted

### Practices system

Fragment source:

- the Lumen comparison repo's "practices" concept

Where it fits:

- likely as a new non-governing but durable memory category, not in constitutional files

Suggested home:

- `memory/topics/practices-*.md`
- or future `memory-wiki` pages under a `practices` namespace

## 2. Prompt-pack and behavioral runtime layer

Key files:

- `PROMPT_CORE.md`
- `PROMPT_MODES.md`
- `PROMPT_PACKS.md`
- `lib/prompt_bundle.mjs`

Current strength:

- compact constitutional prompt assembly
- explicit prompt-pack distinction

Best fitting ideas:

### Context-aware prompt budgeting

Where it fits:

- `lib/prompt_bundle.mjs`

Opportunity:

- more dynamic prompt selection based on trust zone, task class, and retrieval cost
- similar spirit to `context-kernel`, but likely simpler and repo-native

### Learned routing or prompt adaptation

Fragment source:

- `modelab`

Where it fits:

- prompt-pack choice
- backend selection
- fallback discipline

Opportunity:

- log which prompt pack and backend combinations produce better outcomes for specific task classes

## 3. Messaging + execution runtime

Key files:

- `agent_server.mjs`
- `lib/dispatch.mjs`
- `lib/queue.mjs`
- `worker.mjs`
- `scripts/telegram_relay.mjs`
- `scripts/telegram_notify_drain.mjs`

Current strength:

- local-first operational loop
- trust-zone-aware dispatch
- explicit queue state machine

Best fitting ideas:

### Deterministic decision layer

Fragment source:

- `context-kernel`

Where it fits:

- between inbound classification and model/tool execution

Opportunity:

- explicit route decisions
- policy verdicts
- audit events
- memory operation traces

This is probably the cleanest non-memory use of `context-kernel` ideas in the repo.

### Better model routing

Fragment source:

- `skills/model-routing`
- `llm-cost-guard`
- `modelab`

Where it fits:

- backend selection in `dispatch.mjs`

Opportunity:

- one primary per task class
- one fallback per class
- explicit cost and latency logs
- later: learned routing

## 4. Memory / continuity layer

Key files:

- `MEMORY.md`
- `memory/`
- `lib/memory_graph.mjs`
- `lib/md_retriever.mjs`
- memory sections in `lib/dispatch.mjs`

Current strength:

- disciplined local memory
- curation-aware
- already repo-shaped

Best fitting ideas:

### QMD

Where it fits:

- retrieval backend

### `memory-wiki`

Where it fits:

- provenance / claim layer above current Markdown memory

### Gravity-well schema

Where it fits:

- candidate generation and promotion layer

### Selective ingestion and progressive retrieval

Fragment source:

- `SimpleMem`

Where it fits:

- candidate-stage filtering
- top-k retrieval expansion strategy

This is worth borrowing as heuristics, not as an imported worldview.

### Memory Weave / Practices / Connection density

Fragment source:

- Lumen comparison artifacts

Where it fits:

- next evolution of `memory/topics`
- future wiki graph / linked-memory layer

Good fit:

- connection over collection
- active forgetting
- durable practices as their own memory category

## 5. Skills and capability layer

Key files:

- `skills/`
- `CAPABILITIES.md`

Current strength:

- skills are present, lightweight, and coherent with repo values

Best fitting ideas:

### Skill maturity ladder

Where it fits:

- `CAPABILITIES.md`
- `skills/README.md`

Opportunity:

- mark skills as operational, analytical, experimental, or dormant
- tie demonstrated use back into capabilities rather than letting the skill folder become a wish list

### External skill federation

Fragment source:

- `_ext/bankrbot-skills`

Where it fits:

- optional skill import layer, not default core

Opportunity:

- treat `_ext/bankrbot-skills` as a reference pool for optional gated finance/onchain skills
- do not blend them into the default private-assistant core

## 6. Public / marketplace projection layer

Key files:

- `MARKETPLACE_PROTOCOL.md`
- `OPERATING_SURFACE.md`
- `CLIENTS.md`
- `CLIENT_TEMPLATE.md`
- `lib/order_fulfillment.mjs`

Current strength:

- honest informality
- explicit operator mediation

Current weakness:

- partially built but not yet deeply integrated

Best fitting ideas:

### Operating surface over blog

Fragment source:

- Lumen comparison repo

Where it fits:

- `OPERATING_SURFACE.md`
- any future public status page

Opportunity:

- show artifacts, decisions, actions, collaboration points
- avoid identity theater

This is already philosophically aligned with the repo and probably one of the clearest non-memory upgrades available.

### Delivery evidence chain

Where it fits:

- `lib/order_fulfillment.mjs`
- marketplace sidecars

Opportunity:

- stronger artifact lineage for deliverables
- order history with hashes, metadata, QC results, and maybe later customer-safe audit views

## 7. Comparison and external-inspiration layer

Key locations:

- `runtime/comparisons/`
- `_external/`
- `_ext/`

Current strength:

- the repo already keeps outside inspiration around instead of pretending ideas appear from nowhere

Current weakness:

- there is not yet a formal pipeline from outside inspiration -> local synthesis -> adoption or rejection

Best fitting ideas:

### Formal inspiration triage

Where it fits:

- `_external/INTEGRATION_NOTES.md`
- `upgrades/`

Opportunity:

- standardize:
  - what was inspected
  - what was borrowed
  - where it fits
  - why it was not adopted

### `_ext/MNEMOS` as future reference, not immediate dependency

Why:

- rich vault, graph, and memory APIs
- likely too heavy for immediate core integration

Where it fits:

- long-range inspiration for:
  - richer memory graph
  - vault analytics
  - duplicate detection
  - resurfacing

Better role now:

- reference architecture for a future "personal vault" branch, not a direct next move

## Highest-leverage upgrade themes

### Theme A: retrieval + provenance

Pieces:

- QMD
- `memory-wiki`
- gravity-well schema
- existing memory graph

Likely highest payoff.

### Theme B: deterministic runtime decisioning

Pieces:

- `context-kernel`
- `model-routing`
- `llm-cost-guard`
- learned routing ideas from `modelab`

Likely second-highest payoff.

### Theme C: operating surface and evidentiary public layer

Pieces:

- `OPERATING_SURFACE.md`
- Lumen-style operating surface
- artifact and decision logs

Likely strong value if public writing or collaboration becomes active again.

### Theme D: practices and meta-learning

Pieces:

- Lumen practices system
- `modelab` iteration loops
- `memory_review`

Likely best framed as:

- "how Dizzy learns reusable heuristics"

## Things that look tempting but should probably wait

- full autonomous commerce stack
- large external vault systems as direct dependencies
- heavy identity-publication architecture
- dreaming / background memory consolidation before retrieval quality improves

## Current recommendation

If looking repo-wide rather than memory-only, the best next moves are:

1. memory retrieval + provenance upgrade
2. runtime decisioning and model routing cleanup
3. operating surface / public evidence layer
4. practices system for reusable heuristics

That sequence matches both the repo's current center and the most promising fragments already lying around inside it.
