# Low-Churn Implementation Sequence

Date: 2026-05-06

Purpose: turn the current preferred upgrade set into concrete repo-facing insertion points without adding a heavy new subsystem.

Constraints:

- minimize churn
- keep practices sparse, prose-first, and curated
- prefer interface tightening over architecture replacement

## Main take

The repo already contains most of the substrate needed for the next step:

- prompt assembly in `lib/prompt_bundle.mjs`
- retrieval in `lib/md_retriever.mjs`
- graph-style recall in `lib/memory_graph.mjs`
- chat + auto-memory + compaction logic in `lib/dispatch.mjs`
- explicit tool execution in `lib/tools.mjs`

So the work is not "build a new memory system."

The work is:

1. select less junk before prompt assembly
2. treat memory index infrastructure as derivative, not authoritative
3. verify remembered repo facts against reality when possible
4. route janitorial cognition to a cheap path

## 1. Tool filtering before prompt assembly

Status:

- conceptually relevant
- not yet urgent in the current runtime because the live tool surface is still small and explicit

Current repo reality:

- tool invocation is explicit in `lib/dispatch.mjs`
- actual built-in tools are narrow in `lib/tools.mjs`
- no giant MCP tool catalog is currently being injected into the prompt

Conclusion:

- do not overbuild "tool RAG" yet
- but do create a path for capability filtering before the repo grows into prompt bloat

### Low-churn implementation shape

Add a small capability-selection layer, not a full semantic tool router.

Suggested insertion points:

- `lib/prompt_bundle.mjs`
- `CAPABILITIES.md`
- optionally a future `lib/capability_selector.mjs`

### Recommended behavior

For each request, derive a compact capability hint set such as:

- `continuity`
- `memory_review`
- `repo_retrieval`
- `tool_http`
- `governance_lookup`
- `public_scope`

Then expose only the relevant capability summary or tool instructions to the prompt.

This is the low-churn version of Teleclaw's `tool_rag` idea.

It avoids:

- embedding a full semantic retrieval engine just for tools
- pretending the repo already has 150 tools when it does not

### Why this is worth doing

Current prompt assembly in `lib/prompt_bundle.mjs` is file-based, not task-shaped.

That is acceptable now, but it will degrade as more skills, MCP servers, and runtime modes accumulate.

The cheapest fix is pre-prompt capability narrowing.

## 2. Authority-first memory plus rebuildable retrieval index

Status:

- highest-value upgrade
- already partially compatible with current design

Current repo reality:

- `MEMORY.md` is explicitly an index, not a journal
- `memory/topics/*.md` already hold durable prose
- `lib/md_retriever.mjs` builds a disposable TF/IDF-like retrieval index in memory
- `lib/memory_graph.mjs` already derives graph structure from Markdown

Conclusion:

- the repo is already behaving as if Markdown is authority and retrieval structures are derivative
- that principle should be made explicit and hardened

### Low-churn implementation shape

Do not replace Markdown memory.

Do:

- formally declare Markdown files as authoritative memory
- allow richer retrieval indexes to be rebuilt from those files
- keep indexes disposable

Suggested insertion points:

- `MEMORY.md`
- `DESIGN.md`
- `lib/md_retriever.mjs`
- `lib/memory_graph.mjs`
- optional future `runtime/memory_index.json` or SQLite cache

### Recommended behavior

Principle:

- durable truth lives in human-readable Markdown
- all search indexes, graphs, and embeddings are derivative caches

Immediate practical consequence:

- if a retrieval artifact goes stale, delete and rebuild it
- do not hand-edit derivative artifacts

This is the strongest concept to borrow from Mythos Router.

### Why this is worth doing

It gives you better retrieval options without risking ontology drift toward opaque memory storage.

It also fits your decentralization preference better than vendor-heavy "memory platform" thinking.

## 3. Lightweight drift checks for memory-backed repo facts

Status:

- very useful
- should be narrow, not universal

Current repo reality:

- memory review and `/remember` already create durable summaries in `lib/dispatch.mjs`
- retrieval can surface old repo facts that may no longer match current files
- no real drift check exists yet for memory-backed repo claims

Conclusion:

- this is a real weakness
- stale memory is worse than missing memory for code and architecture work

### Low-churn implementation shape

Do not build a universal verification engine.

Do add a narrow repo-fact validation pass for references that point to:

- specific files
- explicit architectural claims
- operational instructions that can be checked against current docs

Suggested insertion points:

- `lib/dispatch.mjs`
- `lib/md_retriever.mjs`
- optional future `scripts/memory_verify_repo_facts.mjs`

### Recommended behavior

When retrieval surfaces repo memory, attach a lightweight status such as:

- `fresh`
- `unchecked`
- `stale_risk`
- `conflicted`

Good first heuristic:

- if a memory item references a path and that path changed materially since memory capture, mark it `stale_risk`
- if a referenced path no longer exists, mark it `conflicted`

This does not require full cryptographic verification on day one.

Even file existence + modification-time + content-hash sampling would be enough to reduce false confidence.

### Why this is worth doing

The repo is increasingly self-referential.

That means "what Dizzy remembers about the repo" can quietly detach from "what the repo now is."

This is a concrete place where Mythos Router is right.

## 4. Cheap utility-model path for compaction

Status:

- immediately useful
- lowest-risk code change after drift signals

Current repo reality:

- `lib/dispatch.mjs` already separates major chat backends
- auto-remember, `/remember`, and memory review already call a model for summarization / synthesis
- these janitorial tasks do not always need the primary reasoning model

Conclusion:

- background summarization should not burn premium reasoning by default

### Low-churn implementation shape

Add a utility-model path only for:

- auto-remember promotion
- `/remember`
- memory review proposal generation
- future compaction or index rebuild summaries

Suggested insertion points:

- `lib/dispatch.mjs`
- backend helper wrappers around `geminiGenerateText` / `openaiCompatGenerateText`

### Recommended behavior

Environment split:

- primary reasoning backend remains unchanged
- utility backend is optional and can default to primary if unset

Suggested env pattern:

- `DIZZY_UTILITY_BACKEND`
- `DIZZY_UTILITY_MODEL`
- `DIZZY_UTILITY_MAX_TOKENS`

Use the utility path only when the task is:

- compressive
- summarizing
- indexing-oriented
- not making final high-stakes judgments

This is the cleanest import from Teleclaw and also consistent with the older OpenClaw memory-compaction direction.

### Why this is worth doing

It lowers cost and reduces the temptation to over-compress everything into the main reasoning stream.

It also creates a natural place for future memory hygiene jobs.

## 5. Keep practices sparse and prose-first

Status:

- should remain a discipline, not a new product surface

Conclusion:

- do not add a formal practices engine
- do not create a rigid judgment schema

### Recommended shape

Use only:

- short curated topic files
- occasional compact additions to existing memory topics
- prose that captures repeated useful heuristics

Good examples:

- pacing heuristics that reduce overload
- retrieval cautions like the real-world gravity-well idea
- framing heuristics such as "where the pressure actually is"

Bad examples:

- dozens of rule objects
- formal ontologies for every preference
- pseudo-scientific metadata inflation

## Recommended order

## Phase 1

### A. Make authority-vs-derivative memory explicit

Files:

- `DESIGN.md`
- possibly `MEMORY.md`

Why first:

- this sets the conceptual floor for later retrieval improvements

### B. Add a utility-model path for summarization and memory hygiene

Files:

- `lib/dispatch.mjs`

Why second:

- immediate benefit
- low conceptual risk

## Phase 2

### C. Add lightweight repo-fact drift signals

Files:

- `lib/dispatch.mjs`
- optional helper script/module

Why third:

- strongest trust improvement
- easiest to overbuild, so better done after principles are fixed

### D. Add capability filtering before prompt assembly

Files:

- `lib/prompt_bundle.mjs`
- optional helper module

Why fourth:

- worthwhile, but gains compound more as the capability surface grows

## Phase 3

### E. Continue curating practices in prose only

Files:

- `memory/topics/*.md`

Why last:

- this should emerge from repeated use, not be invented in bulk

## Strongest implementation thesis

The clean path is:

- keep Markdown memory authoritative
- keep retrieval infrastructure disposable
- verify memory claims when reality can cheaply falsify them
- push compression work to cheaper models
- narrow capability exposure before prompt inflation gets bad
- keep practices human-readable and sparse

That improves the system without turning it into a new bureaucracy.
