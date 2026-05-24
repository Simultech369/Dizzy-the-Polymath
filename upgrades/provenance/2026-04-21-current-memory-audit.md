# Current Memory Audit

Date: 2026-04-21

Purpose: map Dizzy's current local memory implementation and identify where OpenClaw-native upgrades would plug in first.

## Executive read

Current state is not "no memory."

Current state is:

- a small curated Markdown memory corpus
- a custom local memory graph and retrieval helper
- custom auto-remember and memory-review flows
- little evidence of broad active use of those flows
- no provenance-rich knowledge layer yet

This means the bottleneck is not only architecture.
It is also corpus maturity and retrieval quality.

## What exists now

### 1. Curated Markdown memory

Current durable memory files:

- `MEMORY.md`
- `memory/2026-02-03-1556.md`
- `memory/topics/civic-doctrine-kernel.md`
- `memory/topics/wikimedia-world-model-substrate.md`

Observed shape:

- `MEMORY.md` is intentionally an index, not a journal
- topic files are reasonably high quality and dense
- daily memory is extremely sparse right now

Implication:

- the structure is clean
- the dataset is small

### 2. Custom memory graph

Relevant files:

- `lib/memory_graph.mjs`
- `runtime/memory_graph.json`
- `scripts/sync_memory_graph.mjs`

What it does:

- scans `MEMORY.md` plus the `memory/` tree
- classifies docs into kinds like `memory_index`, `topic`, and `daily_log`
- extracts headings, keywords, links, entities, and signal groups
- ranks docs against a query
- exposes a memory graph API via `agent_server.mjs`

Strengths:

- local-first
- simple and inspectable
- already tuned toward Dizzy-relevant signal classes like autonomy, structure, meaning, and decisions

Limits:

- only as good as the small current corpus
- no real provenance model
- entity extraction is heuristic
- no contradiction tracking
- no freshness model beyond file age and whatever the caller infers

### 3. Custom auto-remember flow

Relevant file:

- `lib/dispatch.mjs`

What it does:

- scores recent chat turns for memory-worthiness
- stages candidate summaries under `runtime/auto_memory_candidates/`
- promotes them after delay and cooldown checks
- writes remembered output into:
  - `memory/conversations/<convoKey>.md`
  - `memory/YYYY-MM-DD.md`

Strengths:

- already has signal scoring
- avoids some duplicate spam
- local and operator-readable

Limits:

- current runtime folders appear empty, so active capture may be low or cleared often
- summarization output is still mostly sectioned prose, not typed memory objects
- no explicit epistemic classes like verified/speculative/anomalous
- no provenance weighting

### 4. Custom memory review flow

Relevant file:

- `lib/dispatch.mjs`

What it does:

- reviews `MEMORY.md`, topics, and recent daily notes
- proposes edits
- saves them into `runtime/improvements/*.json`
- applies only after explicit confirmation

Strengths:

- respects curation
- minimizes uncontrolled memory mutation

Limits:

- still centered on prose file edits
- not yet a richer belief-management layer

### 5. Markdown retrieval context

Relevant files:

- `lib/md_retriever.mjs`
- `lib/dispatch.mjs`

What it does:

- injects relevant markdown snippets for current messages
- combines ordinary markdown retrieval with memory graph context

Strengths:

- lightweight
- likely enough for small corpora

Limits:

- no advanced reranking
- no dedicated provenance surface
- no explicit distinction between "highly relevant" and "highly trustworthy"

## What does not seem active yet

From this repo state, there is no obvious sign of:

- a dense daily memory practice
- a large `memory/conversations/` corpus
- active auto-memory candidate queues
- a separate evidence / claims layer
- contradiction dashboards
- freshness decay logic

That suggests the next step should be improving the memory system that already exists, not replacing it blindly.

## OpenClaw-native upgrades that fit best

### Best fit: QMD

Why:

- local-first
- better retrieval and reranking
- can index beyond the base workspace memory files
- matches decentralization / neutrality preferences better than remote-vendor-heavy memory

Best insertion point:

- replace or augment current markdown retrieval and graph-first recall

What it would improve:

- retrieval quality
- duplicate suppression
- multi-corpus recall
- indexing extra paths if needed

### Best fit: `memory-wiki`

Why:

- adds claims, evidence, contradictions, and dashboards
- strongest native place for a provenance-rich layer

Best insertion point:

- above the current prose memory files and topic docs

What it would improve:

- inspectability
- contradiction tracking
- claim freshness
- provenance-aware recall

### Good fit: memory search tuning

Relevant OpenClaw features:

- hybrid retrieval
- MMR
- temporal decay

Best insertion point:

- wherever current retrieval is too lexical or too repetitive

What it would improve:

- stale note suppression
- result diversity
- better ranking for larger corpora

### Good fit: memory flush before compaction

Current repo already has custom remember logic, but OpenClaw's native compaction-memory interaction is now more mature.

Best insertion point:

- around long-session summarization or session-reset continuity workflows

What it would improve:

- less silent context loss
- less need for purely manual `/remember`

## OpenClaw-native pieces that are less urgent

### Dreaming

Interesting, but not first.

Reason:

- current memory corpus is still sparse
- better retrieval and provenance matter before deeper promotion loops

### Full backend replacement

Not first.

Reason:

- existing custom memory machinery contains useful domain tuning
- some of it may remain valuable even after adopting OpenClaw-native retrieval layers

## Structural gap summary

Current system is strongest at:

- local inspectability
- prose capture
- cautious curation
- domain-shaped heuristics

Current system is weakest at:

- retrieval depth
- provenance
- contradiction handling
- freshness management
- typed epistemic categories

## Recommended order of operations

### First

- map current custom memory writes and reads into one simple flow diagram
- evaluate whether QMD can replace or sit beside current markdown retrieval
- evaluate whether `memory-wiki` can become the provenance layer above `MEMORY.md` and topic files

### Second

- adapt the gravity-well schema to current local memory candidate generation

### Third

- decide what custom logic should survive after OpenClaw-native upgrades

## Recommendation

Do not jump straight to a new candidate JSON contract.

First use the current system map:

- existing Markdown corpus
- custom memory graph
- custom auto-remember
- custom memory review

Then attach OpenClaw-native upgrades where they remove real weaknesses:

- QMD for retrieval
- `memory-wiki` for provenance
- memory-search tuning for ranking

Only after that should the candidate contract be shaped, because then the contract can target real insertion points instead of imagined ones.
