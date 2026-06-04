# Upgrades

Synthesized upgrade proposals, roadmaps, schemas, and migration notes.

This directory is a planning lane, not runtime doctrine. Nothing here governs Dizzy until it is deliberately moved into live docs, prompt-pack files, tests, or code.

The aesthetic here should be workshop clarity: enough provenance to understand why a proposal exists, enough restraint that a reader can tell what is live, what is candidate, and what is old sediment.

## Start here

For current direction, start with:

- [active/selection-pressure.md](active/selection-pressure.md)
- [active/2026-05-13-dizzy-upgrade-priorities.md](active/2026-05-13-dizzy-upgrade-priorities.md)
- [active/tension-map.md](active/tension-map.md)
- [active/trajectory-distillery.md](active/trajectory-distillery.md)
- [active/friction-ledger.md](active/friction-ledger.md)

For cross-model review history, start with:

- [council/2026-05-06-openclaude-front-door.md](council/2026-05-06-openclaude-front-door.md)

That note was the front door for OpenClaude as a next-team-member reviewer. It explains:

- why the live local repo matters more than GitHub alone right now
- which local recommendation notes should be read first
- what constraints are fixed for the review
- what output shape is wanted from OpenClaude

This folder is for:

- recommendations after investigation
- proposed architecture changes
- staged design docs
- migration sequences
- decision-ready summaries

This folder is not for raw cloned repos.

## Relationship to `_external/`

Keep `_external/` and `upgrades/` separate.

Why:

- `_external/` is raw outside material: cloned repos, reference projects, and inspection notes.
- `upgrades/` is internal synthesis: what to do with those materials in Dizzy's world.

Good rule:

- if it is upstream code or raw inspiration, it belongs in `_external/`
- if it is a recommendation, roadmap, schema, or adoption plan, it belongs in `upgrades/`

That separation keeps:

- provenance clearer
- vendor/code clutter out of planning notes
- planning notes readable without opening external repos

## Directory Map

- [active/](active/) - candidate or accepted upgrades that may become implementation work.
- [council/](council/) - review prompts, second opinions, and cross-model synthesis.
- [provenance/](provenance/) - source ingests, older scans, and historical reasoning trails.
- [external-projects/](external-projects/) - comparison briefs for adjacent projects.

## Status Vocabulary

All upgrade proposals in `upgrades/active/` must start with a YAML frontmatter block defining ID, title, status, and dates:

```yaml
---
id: W-0004
title: Paid/Client Continuity Lifecycle
status: runtime-enforced
created_at: 2026-05-13
updated_at: 2026-06-03
---
```

Available statuses:
- `runtime-enforced`: implemented in code, tests, or machine-facing behavior.
- `constitutional`: governing prompt-pack or doctrine text.
- `operator overlay`: manual practice or runbook-level discipline.
- `planning candidate`: useful proposal, not yet governing.
- `historical provenance`: retained context, not an active recommendation.
- `deprecated`: kept to prevent accidental revival.

## Current Active Notes

- [active/2026-05-13-dizzy-upgrade-priorities.md](active/2026-05-13-dizzy-upgrade-priorities.md) - prioritized upgrade intake and sequencing after review.
- [active/W-0004-continuity-lifecycle.md](active/W-0004-continuity-lifecycle.md) - implemented first pass; deletion/expiry mechanics remain before richer client continuity.
- [active/tension-map.md](active/tension-map.md) - live contradiction map for experiments and failure modes.
- [active/trajectory-distillery.md](active/trajectory-distillery.md) - manual sparse known-good trajectory path and proposal-only distillation implemented; confirmation flow remains future work.
- [active/friction-ledger.md](active/friction-ledger.md) - design note for converting repeated operator stuck-points into product signal; not implemented yet.
- [active/memory-metadata.md](active/memory-metadata.md) - narrow metadata proposal for `memory/topics/`, blocked on frontmatter-safe parsing.
- [active/per-zone-capability-lists.md](active/per-zone-capability-lists.md) - code-enforced capability surfaces by trust zone.
- [active/refinement-discipline.md](active/refinement-discipline.md) - compact, mostly invisible success-criteria discipline.
- [active/telos-substrate.md](active/telos-substrate.md) - candidate Telos/Substrate compression question.
- [active/civic-sieve.md](active/civic-sieve.md) - boundary/privacy guard before durable writes and risky paid/public outputs.
- [active/privilege-split.md](active/privilege-split.md) - future quarantined-input and privileged-core split.
- [active/anti-goblin-local-failure-pressure.md](active/anti-goblin-local-failure-pressure.md) - candidate review lens for recurring local failure pressures.
- [active/selection-pressure.md](active/selection-pressure.md) - subtraction questions for keeping Dizzy and PBMRebate/PFC from metabolizing complexity instead of reducing it.

## Near-Term Implementation Sequence

1. Review real `/trajectory distill` outputs and decide whether to add a two-step confirmation flow or keep copy/paste saving.
2. Review `runtime/reports/connections.md` after real use and decide whether connection hypotheses deserve a periodic operator review slot.
3. Add model/provider routing with trust-zone, risk, cost, privacy, and provider-health awareness.
4. Add deterministic experiential compression for retrieved snippets and tool outputs.
5. Add frontmatter-safe parsing before memory metadata if metadata work resumes.
6. Improve deletion/expiry mechanics in line with W-0004 retention rules before richer client continuity.

Before adding another layer, read the selection-pressure note and decide what should become simpler, less necessary, or explicitly deferred.

## Compression Rule

Compression should preserve what changed judgment. It should not flatten experience into mechanical fields just because fields are easier to count.
