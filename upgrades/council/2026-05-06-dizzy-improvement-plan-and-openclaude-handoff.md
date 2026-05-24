# Dizzy Improvement Plan And OpenClaude Handoff

Date: 2026-05-06

Purpose: define the improvement sequence we want for Dizzy with Codex, and define the later handoff/review workflow for OpenClaude across the full local repo state.

## Repo-state correction

As of this note:

- current branch: `main`
- last visible remote tip: `origin/main` at `0c60200`
- the accumulated recommendation work since that push is primarily local in `upgrades/`

That means:

- an OpenClaude review against GitHub alone will be incomplete
- OpenClaude must review the local working tree, including unpushed files

## Main goal

Two-stage process:

1. Codex works with Simul to shape and prioritize the Dizzy improvement plan
2. OpenClaude later reviews the entire live Dizzy repo, including accumulated local recommendation notes since the last push

This is not redundant.

It creates:

- first-pass synthesis
- second-pass contrastive review from a different model family

## What Codex should do first

Codex should remain the primary planner for the near-term sequence.

Why:

- Codex is already inside the repo context
- the recommendation trail is now substantial
- the current task is integration and prioritization, not just fresh idea generation

## Improvement priorities

These are the current preferred priorities under the low-churn constraint.

### 1. Make authority-vs-derivative memory explicit

Target:

- state clearly that Markdown memory is authoritative
- retrieval artifacts are rebuildable derivatives

Reason:

- prevents silent drift toward opaque canonical state
- allows more aggressive retrieval/indexing later without philosophical confusion

### 2. Add a cheap utility-model path for janitorial cognition

Target:

- compaction
- `/remember`
- memory review proposals
- other summarization-heavy maintenance tasks

Reason:

- lowers cost
- preserves premium reasoning bandwidth for actual judgment work

### 3. Add lightweight drift checks for memory-backed repo facts

Target:

- detect when remembered repo facts no longer match current files

Reason:

- stale memory is an active risk in a self-referential coding repo

### 4. Add capability filtering before prompt assembly

Target:

- reduce prompt inflation as capabilities expand

Reason:

- worthwhile, but current tool surface is still small enough that this should stay narrow

### 5. Keep practices sparse, prose-first, and curated

Target:

- a discipline, not a subsystem

Reason:

- avoids bureaucracy
- preserves interpretability

## How OpenClaude should be used later

OpenClaude should not be asked to replace this process.

It should be used as:

- a full-repo reviewer
- an alternative-priors critic
- a second-pass architecture reader

It should look for:

- what Codex overfit to
- what Codex underweighted
- where Claude-family priors surface different risks or opportunities

## Latest Codex-side pressure test

The latest Codex pass narrowed the immediate accepted work to one concrete item:

- define the paid/client continuity lifecycle for `paid_public` requests when `continuity_mode=client`

Other recommendations should be treated as OpenClaude review candidates rather than already accepted doctrine:

- compact operating loop for continuity-and-judgment
- authority-vs-derivative memory principle
- freshness labels for retrieved repo-memory
- civic doctrine consolidation around `memory/topics/civic-doctrine-kernel.md`
- sharper mechanics for capability floor, rights floor, interpreter layer, and anti-tutelage limit
- clearer humility/status fields for marketplace/profile endpoints

OpenClaude should decide which of these are truly high-leverage, which are redundant with current repo structure, and which would introduce unnecessary standardization or churn.

## What OpenClaude should review

OpenClaude should review the whole live repo, with extra focus on:

### Core runtime and memory surfaces

- `lib/dispatch.mjs`
- `lib/prompt_bundle.mjs`
- `lib/md_retriever.mjs`
- `lib/memory_graph.mjs`
- `MEMORY.md`
- `memory/`

### Governance and operating doctrine

- `DESIGN.md`
- `PROMPT_CORE.md`
- `PROMPT_MODES.md`
- `CAPABILITIES.md`
- `HEARTBEAT.md`
- `SOUL.md`
- `USER.md`

### Local recommendation trail since last push

- `upgrades/README.md`
- `upgrades/2026-04-21-current-memory-audit.md`
- `upgrades/2026-04-21-current-memory-flow.md`
- `upgrades/2026-04-21-gravity-well-memory-schema.md`
- `upgrades/2026-04-21-memory-openclaw-recalibration.md`
- `upgrades/2026-04-21-memory-upgrade-roadmap.md`
- `upgrades/2026-04-21-repo-wide-fit-map.md`
- `upgrades/2026-05-06-idea-fit-additions.md`
- `upgrades/2026-05-06-low-churn-repo-scan.md`
- `upgrades/2026-05-06-low-churn-implementation-sequence.md`

### External/reference context

At minimum:

- `_external/INTEGRATION_NOTES.md`

Optionally, selected donor repos if the review budget allows:

- `_external/openclaw`
- `_external/openclaude`
- `_external/context-kernel`
- `_external/modelab`
- `_external/memory-context-pipeline`
- `_external/claudia`
- `_external/mythos-router`
- `_external/teleclaw-agent`

## What not to ask OpenClaude to do

Do not ask for:

- vague brainstorming over the entire universe
- wholesale reinvention
- persona replacement
- big-churn architecture resets without reading the local notes first

That would destroy the point of the current workflow.

## Best review prompt shape for OpenClaude

The OpenClaude pass should be framed roughly like this:

- review the entire current Dizzy repo as it exists locally, not just GitHub
- assume `upgrades/` contains the current recommendation trail since the last push
- evaluate the proposed low-churn improvement path
- identify:
  - strongest recommendations
  - weak recommendations
  - hidden risks
  - missed opportunities
  - where Claude-family priors differ meaningfully from the current Codex-shaped plan
- preserve the existing repo identity unless there is a strong reason not to
- prefer low-churn improvements over reinvention

## Suggested sequence from here

### Phase A

Keep working with Codex to refine and rank the implementation plan.

### Phase B

When the plan is coherent enough, prepare the repo for OpenClaude review.

This may mean:

- ensuring `upgrades/` is clean and legible
- deciding whether to commit the recommendation notes first or let OpenClaude inspect the working tree directly

### Phase C

Run OpenClaude over the full local repo state and compare outputs.

### Phase D

Reconcile:

- where Codex and OpenClaude agree
- where they disagree
- what those disagreements reveal about model priors

## Current recommendation

Do not hand off to OpenClaude yet.

One more round of Codex-side consolidation is probably worth it first, so OpenClaude reviews a tighter proposal rather than a looser pile of notes.
