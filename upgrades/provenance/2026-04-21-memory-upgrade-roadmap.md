# Memory Upgrade Roadmap

Date: 2026-04-21

Goal: improve Dizzy's memory and retrieval quality without rushing into a full custom memory engine.

## Strategic principle

Prefer layered local-first upgrades over a single replacement system.

Order of preference:

1. use more of current OpenClaw memory capabilities
2. add provenance and better epistemic sorting
3. add deterministic routing / audit control
4. only then consider larger custom memory machinery

## Phase 0: Baseline map

Status:

- current workspace memory files already exist
- `_external/` now contains OpenClaw and related reference repos
- `upgrades/` exists as the synthesis lane

Deliverables:

- inventory current Dizzy memory touchpoints
- identify what is manual vs automated today
- note where recall is weak: retrieval, ranking, provenance, freshness, or promotion

## Phase 1: OpenClaw-native recalibration

Primary target:

- investigate OpenClaw memory as it exists now, not as it existed when Dizzy started

Focus:

- `memory_search`
- memory flush before compaction
- QMD backend
- `memory-wiki`
- dreaming / promotion
- system-prompt bootstrap discipline

Questions:

- should Dizzy use QMD as active memory backend?
- should `memory-wiki` run in `isolated` or `bridge` mode?
- should memory search enable MMR and temporal decay?

Success condition:

- better recall quality with less custom code

## Phase 2: Gravity-well schema prototype

Problem:

- unusual but real material can be mistaken for junk because model priors lean toward dismissal

Action:

- define structured memory item types and metadata
- separate noise filtering from reality filtering

Prototype fields:

- class
- evidence strength
- freshness
- contradiction state
- gravity weight

Success condition:

- weird-but-real material stops getting flattened into `drop_candidates`

## Phase 3: Retrieval quality and ranking

Possible paths:

- OpenClaw builtin hybrid search tuned better
- QMD with reranking and extra indexed paths
- selective borrowing from `SimpleMem`

Focus:

- ranking quality
- duplicate suppression
- recency handling
- source visibility
- retrieval across workspace plus selected extra corpora

Success condition:

- higher quality recall with lower clutter

## Phase 4: Provenance-rich knowledge layer

Most likely candidate:

- OpenClaw `memory-wiki`

Reason:

- claims
- evidence
- contradictions
- dashboards
- compiled digest

Use case:

- keep raw memory in ordinary files or QMD collections
- compile stable knowledge into a maintained belief layer

Success condition:

- memory becomes inspectable and contestable, not just searchable

## Phase 5: Deterministic decision layer

Reference:

- `context-kernel`

Use:

- route memory operations
- gate writes
- tag uncertainty
- keep audit traces

Not the goal:

- replacing memory retrieval itself

Success condition:

- summarize / verify / recall / promote flows become explicit and reviewable

## Phase 6: Iterative improvement loop

Reference:

- `modelab`

Ideas to borrow:

- cross-run memory
- learned routing adjustments
- semantic recall over prior runs
- scoring loops for memory quality experiments

Success condition:

- memory improvements compound through testing rather than intuition alone

## Priority order

### First

- OpenClaw-native recalibration
- gravity-well schema prototype

### Second

- retrieval tuning and provenance layer

### Third

- deterministic decision layer
- iterative memory experiment loop

## Repos by role

### Core investigation set

- `_external/openclaw`
- `_external/context-kernel`
- `_external/modelab`

### Supporting set

- `_external/memory-context-pipeline`
- `_external/autoresearch`
- `_external/llm-cost-guard`

### Reference-only for now

- `aiming-lab/SimpleMem`
- `microsoft/kernel-memory`

## Recommended immediate next steps

1. inspect current Dizzy memory flow against OpenClaw's current memory options
2. draft the gravity-well schema against existing memory candidate shapes
3. decide whether to trial QMD + `memory-wiki` before any custom memory implementation

## Decision heuristic

If an upgrade can be achieved by configuration or plugin adoption inside OpenClaw, prefer that before inventing a new subsystem.
