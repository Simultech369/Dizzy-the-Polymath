# Memory + OpenClaw Recalibration

Date: 2026-04-21

Purpose: collect upgrade recommendations for Dizzy's memory stack and broader OpenClaw recalibration without changing the current workspace architecture yet.

## Main take

The older mental model of "OpenClaw = prompt files + MEMORY.md + compaction" is now incomplete.

OpenClaw has moved toward a more layered memory system:

- plain workspace memory files for continuity
- hybrid semantic recall via `memory_search`
- optional QMD local-first retrieval sidecar
- optional `memory-wiki` compiled knowledge layer with claims and evidence
- optional dreaming / promotion workflows

That means Dizzy likely needs less custom memory invention than previously assumed.

## Recommended direction

Build around a layered local-first memory stack:

1. Keep the current workspace memory files and governance files as the durable human-readable base.
2. Treat `memory-context-pipeline` as an offload / compaction helper, not the full memory architecture.
3. Pull in ideas from `context-kernel` for deterministic routing, policy checks, and auditability.
4. Use current OpenClaw memory features as the main retrieval substrate before inventing a separate one.
5. Add a provenance-rich layer so retrieval does not flatten unusual-but-real observations into "probably meme/hoax/noise."

## Why this matters

Current concern: models have different retrieval priors.

One failure mode is over-penalizing weird but real material because it "sounds fake."

This suggests a missing memory distinction between:

- low-value noise
- speculative material
- anomalous but plausible real-world observations
- verified durable facts

The upgrade target is not just better storage.
It is better epistemic sorting.

## Concrete upgrade ideas

### 1. Add an upgrades path, not immediate architecture churn

Use `upgrades/` as a staging area for:

- repo comparison notes
- proposed schemas
- OpenClaw recalibration ideas
- migration plans that are not yet accepted

This keeps exploration out of core governance files until something earns adoption.

### 2. Reframe `memory-context-pipeline`

Good at:

- threshold-triggered compaction
- local vs premium routing
- structured memory candidate output
- append-only channel memory logs

Missing:

- provenance
- evidence weighting
- contradiction tracking
- freshness / staleness handling
- retrieval ranking logic
- "anomalous but plausible" classification

Recommendation:

Keep it as a narrow worker or memory-offload utility, not the center of the memory system.

### 3. Use `context-kernel` ideas without overfitting to its current shape

Useful concepts:

- deterministic routing
- explicit policy gates
- audit events
- memory candidate extraction hooks

Current limitation:

Its candidate extraction is still heuristic and shallow. It is better as a control plane than a belief engine.

Recommendation:

Borrow:

- route / policy / audit structure
- model routing separation
- typed candidate objects

Do not mistake it for a full memory ontology yet.

### 4. Lean into OpenClaw's newer memory stack

Most relevant current OpenClaw pieces:

- `memory_search` hybrid retrieval
- QMD backend for local-first recall, reranking, and extra indexed paths
- `memory-wiki` for provenance-rich compiled knowledge
- memory flush before compaction
- dreaming / promotion flow for long-term memory hygiene

Most promising combination:

- QMD for broad local recall
- `memory-wiki` for durable claims, evidence, contradiction tracking, and dashboards

This is the strongest native answer to the "real-world gravity well" problem found so far.

### 5. Define a better memory schema

Add or prototype categories like:

- `verified`
- `operational`
- `speculative`
- `anomalous_but_plausible`
- `disconfirmed`

And metadata like:

- `source_type`
- `evidence_strength`
- `last_checked_at`
- `freshness_horizon`
- `contradictions`
- `gravity_weight`

`gravity_weight` here means: how strongly a memory item should resist being discarded just because it is socially unusual or low-prior under default model assumptions.

### 6. Prefer provenance over authority branding

External references should be weighted by:

- inspectability
- reproducibility
- source diversity
- grounding quality

Not by brand prestige alone.

This fits the decentralization / neutrality preference better than simply choosing "big vendor memory."

## Repo priority list

### Highest priority

#### `openclaw/openclaw`

Reason:

- Dizzy started here
- current memory features are more advanced than the older mental model
- likely best source of recalibration ideas beyond memory too

Focus areas:

- memory backends
- compaction behavior
- prompt injection / workspace bootstrap
- skill visibility and management
- hooks / automation around memory and compaction

#### `darks0l/context-kernel`

Reason:

- useful control-plane pattern for routing, policy, and audit

Best use:

- deterministic decision layer above memory workers

#### `darks0l/modelab`

Reason:

- strongest "persistent memory drives iterative improvement" repo found here without being domain-locked to a single narrow memory feature

Best use:

- ideas for cross-run learning
- semantic recall
- experimental scoring loops
- learned routing

### Medium priority

#### `darks0l/memory-context-pipeline`

Reason:

- good utility layer
- not sufficient as the whole system

#### `aiming-lab/SimpleMem`

Reason:

- useful for selective ingestion and progressive retrieval ideas
- worth mining for retrieval heuristics, not necessarily adopting wholesale

### Low priority / reference only

#### `microsoft/kernel-memory`

Reason:

- interesting as a general memory architecture reference
- lower fit for current values and likely lower fit than local-first OpenClaw + QMD + wiki layering

Recommendation:

Use as a comparative reference only unless it offers a very specific mechanism worth borrowing.

## Suggested next experiments

### Experiment A: OpenClaw-native memory upgrade

Investigate whether Dizzy should move toward:

- QMD as active memory backend
- `memory-wiki` in bridge or isolated mode
- memory search tuning with MMR + temporal decay

Goal:

Improve recall quality and provenance before building custom memory infrastructure.

### Experiment B: Gravity well schema prototype

Draft a small schema for memory candidates that separates:

- weird-but-real
- speculative
- dropped noise
- durable verified

Goal:

Reduce false dismissals caused by model prior mismatch.

### Experiment C: Context-kernel style decision layer

Prototype a thin decision layer that:

- routes summarize / extract / verify / recall tasks
- records audit traces
- forces explicit uncertainty labels

Goal:

Make memory operations legible and reviewable.

## Current recommendation

If only one path is pursued first:

Start with OpenClaw-native recalibration before building a separate custom memory engine.

Reason:

- lower integration risk
- more local-first
- more provenance support already exists than expected
- likely better fit with existing Dizzy origin and workspace model

## Repos cloned locally for this investigation

- `_external/memory-context-pipeline`
- `_external/context-kernel`
- `_external/autoresearch`
- `_external/llm-cost-guard`
- `_external/modelab`
- `_external/vault`
- `_external/openclaw`
