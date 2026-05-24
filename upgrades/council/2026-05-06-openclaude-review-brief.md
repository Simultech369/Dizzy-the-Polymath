# OpenClaude Review Brief

Date: 2026-05-06

Purpose: give OpenClaude a compact, high-signal brief for reviewing the full current Dizzy repo, including the local unpushed recommendation trail.

## Review stance

Review the live local repo, not just GitHub.

Assume:

- `origin/main` does not contain the current recommendation trail
- `upgrades/` contains the relevant accumulated local synthesis since the last push
- the goal is low-churn improvement, not reinvention

## Primary task

Evaluate the current Codex-shaped improvement direction for Dizzy.

Focus on:

1. what is strong
2. what is weak
3. what is missing
4. what is overbuilt
5. what Claude-family priors see differently from the current plan

## Core constraints

Hold these constraints fixed unless there is a strong reason not to:

- minimize churn
- keep practices sparse, prose-first, and curated
- preserve repo identity and constitutional structure
- prefer inspectable local-first memory over opaque canonical state
- treat model pluralism as a feature, not a bug

## Current preferred direction

The current preferred path is:

### 1. Make Markdown memory authoritative

- durable memory remains in human-readable Markdown
- retrieval structures, graphs, indexes, embeddings, and similar artifacts are derivative and rebuildable

### 2. Add a cheap utility-model path for janitorial cognition

- compaction
- `/remember`
- memory review proposals
- similar summarization-heavy tasks

### 3. Add lightweight drift checks for memory-backed repo facts

- identify stale or conflicted repo-memory claims

### 4. Add narrow capability filtering before prompt assembly

- reduce prompt inflation without building a giant tool-routing machine

### 5. Keep practices minimal

- short, curated prose
- no heavy judgment bureaucracy

## Files to review first

### Core runtime

- `lib/dispatch.mjs`
- `lib/prompt_bundle.mjs`
- `lib/md_retriever.mjs`
- `lib/memory_graph.mjs`
- `lib/tools.mjs`

### Memory and doctrine

- `MEMORY.md`
- `memory/`
- `DESIGN.md`
- `PROMPT_CORE.md`
- `PROMPT_MODES.md`
- `CAPABILITIES.md`
- `HEARTBEAT.md`
- `SOUL.md`
- `USER.md`

### Recommendation trail

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
- `upgrades/2026-05-06-dizzy-improvement-plan-and-openclaude-handoff.md`
- `upgrades/2026-05-06-goblins-for-openclaude-review.md`

### Optional external context

If needed for comparison:

- `_external/INTEGRATION_NOTES.md`
- `_external/openclaw`
- `_external/openclaude`
- `_external/context-kernel`
- `_external/modelab`
- `_external/memory-context-pipeline`
- `_external/claudia`
- `_external/mythos-router`
- `_external/teleclaw-agent`

## Review questions

OpenClaude should answer:

### A. Architecture

- Is the current low-churn sequence sound?
- Which of the five priorities should move up or down?
- Where is the current plan underestimating risk?

### B. Memory

- Is the authority-vs-derivative split the right principle for Dizzy?
- Are the proposed drift checks too weak, too strong, or correctly scoped?
- What memory risks does Claude-family reasoning notice that Codex may be underweighting?

### C. Prompting and routing

- Is narrow capability filtering enough, or is the current plan underbuilding that area?
- Where would Claude-family priors recommend different prompt shaping or routing?

### D. Practices and governance

- Is the plan correctly resisting over-structuring?
- Are there places where minimal extra structure would help without turning into bureaucracy?

### E. Comparative epistemics

- Where do Claude-family priors likely outperform Codex on this repo?
- Where might Claude-family priors over-regularize, over-sanitize, or prematurely dismiss anomalous-but-real material?

### F. Latest Codex pressure-test candidates

Review these as candidates, not decisions:

- Should the continuity-and-judgment center become a compact procedural loop, or would that over-standardize judgment?
- Should Markdown memory be declared authoritative while all indexes, graphs, embeddings, and caches are derivative?
- Should retrieved repo-memory receive freshness labels like `unchecked`, `stale_risk`, and `conflicted`?
- Should the civic doctrine kernel become the single elaboration home, with live prompt files carrying only compact behavioral rules?
- Does the freedom/capability/tutelage frame need sharper institutional mechanics: capability floor, rights floor, interpreter layer, anti-tutelage limit?
- Are the marketplace/profile endpoints sufficiently humble, or should they expose clearer operator-mediated status fields?

Do not treat the paid/client continuity lifecycle as merely optional. Codex and Simul have already marked it as near-term work; review the shape, not whether the issue exists.

## Goblin check

Use the goblin note as a stress-test:

- `Stale Memory Goblin`
- `Misclassification Goblin`
- `Ontology Inflation Goblin`
- `Single-Mind Goblin`
- `Churn Goblin`
- `Practice Bureaucrat Goblin`

Recommendations that feed these goblins should be marked down.

## Desired output shape

The review should ideally produce:

1. strongest agreements with current plan
2. strongest disagreements with current plan
3. best missed opportunities
4. highest-risk bad ideas to avoid
5. a revised ranked shortlist, if warranted

## What not to do

Do not optimize for:

- reinvention for its own sake
- abstract philosophy detached from repo insertion points
- large new subsystems without strong justification
- replacing Dizzy's existing identity with the donor repo identity of some other system

## Final review criterion

The winning recommendations should:

- improve continuity and judgment
- reduce drift
- preserve inspectability
- preserve model pluralism
- avoid needless churn
