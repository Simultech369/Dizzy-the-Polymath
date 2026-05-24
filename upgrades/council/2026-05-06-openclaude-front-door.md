# OpenClaude Front Door

Date: 2026-05-06

Purpose: provide one compact entry point for OpenClaude to review the current Dizzy repo and the local unpushed recommendation trail.

## What this is

This is the front door for the OpenClaude review pass.

Use this note first.
Then follow the linked notes in order.

## Current repo-state fact

Do not review GitHub alone.

As of this note:

- `origin/main` does not contain the accumulated local recommendation trail
- the important post-push work is in local `upgrades/`

So the review target is the live local repo, not just the remote snapshot.

## Review goal

Evaluate the current Codex-shaped improvement direction for Dizzy.

Specifically:

- test the low-churn improvement plan
- identify strong recommendations
- identify weak recommendations
- identify missing opportunities
- identify where Claude-family priors materially differ

## Fixed constraints

Unless there is a strong reason not to, keep these fixed:

- minimize churn
- preserve Dizzy's existing constitutional structure
- keep practices sparse, prose-first, and curated
- prefer inspectable local-first memory over opaque canonical state
- preserve model pluralism

## Current preferred improvement direction

The current leading path is:

1. make Markdown memory authoritative and retrieval infrastructure derivative
2. add a cheap utility-model path for janitorial cognition
3. add lightweight drift checks for memory-backed repo facts
4. add narrow capability filtering before prompt assembly
5. keep practices minimal and prose-first

## Read order

## 1. Handoff and review stance

Start here:

- [2026-05-06-dizzy-improvement-plan-and-openclaude-handoff.md](C:\Users\Josh\clawd\upgrades\2026-05-06-dizzy-improvement-plan-and-openclaude-handoff.md)
- [2026-05-06-openclaude-review-brief.md](C:\Users\Josh\clawd\upgrades\2026-05-06-openclaude-review-brief.md)

These define:

- what kind of review is wanted
- what should be treated as current local state
- what output shape is desired

## 2. Core implementation direction

Then read:

- [2026-05-06-low-churn-implementation-sequence.md](C:\Users\Josh\clawd\upgrades\2026-05-06-low-churn-implementation-sequence.md)
- [2026-05-06-low-churn-repo-scan.md](C:\Users\Josh\clawd\upgrades\2026-05-06-low-churn-repo-scan.md)

These define:

- the current recommended order
- which donor repos are actually worth borrowing from
- which ideas should wait

## 3. Memory-specific thread

Then read:

- [2026-04-21-current-memory-audit.md](C:\Users\Josh\clawd\upgrades\2026-04-21-current-memory-audit.md)
- [2026-04-21-current-memory-flow.md](C:\Users\Josh\clawd\upgrades\2026-04-21-current-memory-flow.md)
- [2026-04-21-memory-openclaw-recalibration.md](C:\Users\Josh\clawd\upgrades\2026-04-21-memory-openclaw-recalibration.md)
- [2026-04-21-memory-upgrade-roadmap.md](C:\Users\Josh\clawd\upgrades\2026-04-21-memory-upgrade-roadmap.md)
- [2026-04-21-gravity-well-memory-schema.md](C:\Users\Josh\clawd\upgrades\2026-04-21-gravity-well-memory-schema.md)

These define:

- where Dizzy's current memory system actually is
- how OpenClaw-native memory pieces fit
- how the gravity-well idea emerged

## 4. Repo-wide fit and idea expansion

Then read:

- [2026-04-21-repo-wide-fit-map.md](C:\Users\Josh\clawd\upgrades\2026-04-21-repo-wide-fit-map.md)
- [2026-05-06-idea-fit-additions.md](C:\Users\Josh\clawd\upgrades\2026-05-06-idea-fit-additions.md)

These define:

- where accumulated fragments fit in the repo
- how newer ideas from Rae Johnson, political-economy lenses, Claudia, and retrieval-prior thinking were placed

## 5. Review pressure-checks

Then read:

- [2026-05-06-goblins-for-openclaude-review.md](C:\Users\Josh\clawd\upgrades\2026-05-06-goblins-for-openclaude-review.md)

This defines the main named sabotage patterns that should be used as a stress-test on recommendations.

## 6. Optional advanced thread

If evaluating the JEPA/world-model side path, then read:

- [2026-05-06-jepa-second-opinion.md](C:\Users\Josh\clawd\upgrades\2026-05-06-jepa-second-opinion.md)

This note exists to clean up a partially sloppy copied recipe before a third-opinion review.

## Core repo files to inspect

After the notes, inspect at minimum:

- `lib/dispatch.mjs`
- `lib/prompt_bundle.mjs`
- `lib/md_retriever.mjs`
- `lib/memory_graph.mjs`
- `lib/tools.mjs`
- `MEMORY.md`
- `memory/`
- `DESIGN.md`
- `PROMPT_CORE.md`
- `PROMPT_MODES.md`
- `CAPABILITIES.md`
- `SOUL.md`
- `HEARTBEAT.md`
- `USER.md`

## Optional donor repos for comparison

Use only if needed:

- `_external/openclaw`
- `_external/openclaude`
- `_external/context-kernel`
- `_external/modelab`
- `_external/memory-context-pipeline`
- `_external/claudia`
- `_external/mythos-router`
- `_external/teleclaw-agent`

## What matters most

If time or attention is limited, prioritize these questions:

1. Is the authority-vs-derivative memory principle right for Dizzy?
2. Is the low-churn sequence correctly ordered?
3. Are drift checks being underweighted?
4. Is capability filtering being underbuilt or correctly scoped?
5. Are Codex-shaped recommendations missing risks that Claude-family priors would catch?

## New pressure-test agenda

After the latest Codex-side repo pass, treat these as recommendation candidates for OpenClaude, not accepted doctrine:

- whether Dizzy needs a compact operating loop for continuity-and-judgment, such as `orient -> retrieve selectively -> test against present reality -> name trade-offs -> choose reversible next move -> update durable memory only if future judgment improves`
- whether Markdown memory should be formally declared authoritative while retrieval indexes, graphs, embeddings, and caches remain derivative and rebuildable
- whether retrieved repo-memory should carry freshness labels such as `unchecked`, `stale_risk`, or `conflicted`
- whether the civic doctrine should be consolidated around `memory/topics/civic-doctrine-kernel.md` to reduce duplication across `SOUL.md`, `USER.md`, and `PROMPT_CORE.md`
- whether the freedom/capability/tutelage frame needs more mechanical boundaries: capability floor, rights floor, interpreter layer, and anti-tutelage limit
- whether marketplace/profile endpoints need clearer status fields without implying storefront maturity

One item has already been accepted as near-term work rather than deferred to OpenClaude:

- define the paid/client continuity lifecycle for `paid_public` requests using `continuity_mode=client`

## What not to do

Avoid:

- judging the repo from GitHub alone
- recommending high-churn reinvention without strong justification
- replacing Dizzy's identity with donor repo identity
- turning sparse practices into a bureaucracy

## Desired OpenClaude output

The best review output would contain:

1. strongest agreements
2. strongest disagreements
3. highest-value missed opportunities
4. highest-risk bad ideas to avoid
5. revised top-priority shortlist, if warranted

## Final note

This front door exists so OpenClaude does not have to reconstruct the recommendation trail from scattered notes.

It is a reading order, not a replacement for the notes themselves.
