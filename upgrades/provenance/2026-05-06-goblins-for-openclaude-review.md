# Goblins For OpenClaude Review

Date: 2026-05-06

Purpose: provide a compact failure-pattern checklist for OpenClaude to consider while reviewing Dizzy and the accumulated local recommendation trail.

This is not an implementation spec.
It is a review aid.

## Use

Treat these as named sabotage patterns:

- small recurring distortions
- easy to miss when reading a repo incrementally
- useful when comparing architectural recommendations

If a recommendation strengthens one of these goblins, that counts against it.

## Core goblins

### `Stale Memory Goblin`

Failure mode:

- remembered repo facts feel current long after the files changed

Countermeasure:

- authority-vs-derivative memory discipline
- lightweight drift checks
- freshness awareness

### `Misclassification Goblin`

Failure mode:

- unusual but real material gets flattened into noise, meme, or implausibility too early

Countermeasure:

- provenance-aware retrieval
- anomaly-resistant recall
- explicit caution around retrieval priors

### `Ontology Inflation Goblin`

Failure mode:

- a real insight gets over-expanded into a bloated schema or unnecessary subsystem

Countermeasure:

- low-churn design
- minimal new layers
- prose before structure

### `Single-Mind Goblin`

Failure mode:

- one model family's priors quietly become the system's worldview

Countermeasure:

- contrastive review
- model pluralism
- treat disagreement as signal

### `Churn Goblin`

Failure mode:

- system pressure triggers rebuilding instead of tightening interfaces

Countermeasure:

- insertion-point thinking
- preserve existing architecture where possible
- prefer incremental gains over resets

### `Practice Bureaucrat Goblin`

Failure mode:

- useful heuristics turn into rigid overmanaged process

Countermeasure:

- keep practices sparse
- keep them prose-first
- only store repeated high-yield patterns

## What OpenClaude should do with this

While reviewing Dizzy and the local `upgrades/` trail, ask:

- which recommendations reduce these goblins?
- which recommendations accidentally feed them?
- where does Claude-family reasoning see goblin risks differently than the current Codex-shaped plan?

## Current tie-in

These goblins map directly onto the current preferred improvement direction:

- authority-first Markdown memory
- rebuildable retrieval infrastructure
- cheap utility-model path for compaction
- lightweight repo-fact drift checks
- narrow capability filtering before prompt inflation
- sparse, curated practices

That is why this note belongs in `upgrades/` and not in implementation files.
