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

- `runtime-enforced`: implemented in code, tests, or machine-facing behavior.
- `constitutional`: governing prompt-pack or doctrine text.
- `operator overlay`: manual practice or runbook-level discipline.
- `planning candidate`: useful proposal, not yet governing.
- `historical provenance`: retained context, not an active recommendation.
- `deprecated`: kept to prevent accidental revival.

## Active Lane Discipline

Every note in `active/` must start with status frontmatter:

- `id`
- `status`: `active`, `integrated`, `parked`, or `archived`
- `tier`: `1`, `2`, or `3`
- `owner_surface`: the live file, module, or future surface responsible for the idea
- `last_reviewed`: ISO date
- `next_action`: concrete next move or reason to retain as provenance

`scripts/maintain.mjs` summarizes these counts and flags missing metadata, stale active reviews, and non-actionable next actions.

## Current Active Notes

- `active`: [memory-metadata.md](active/memory-metadata.md), [selection-pressure.md](active/selection-pressure.md), [tension-map.md](active/tension-map.md)
- `integrated`: [W-0004-continuity-lifecycle.md](active/W-0004-continuity-lifecycle.md), [civic-sieve.md](active/civic-sieve.md), [friction-ledger.md](active/friction-ledger.md), [per-zone-capability-lists.md](active/per-zone-capability-lists.md), [refinement-discipline.md](active/refinement-discipline.md), [trajectory-distillery.md](active/trajectory-distillery.md)
- `parked`: [2026-05-13-dizzy-upgrade-priorities.md](active/2026-05-13-dizzy-upgrade-priorities.md), [anti-goblin-local-failure-pressure.md](active/anti-goblin-local-failure-pressure.md), [privilege-split.md](active/privilege-split.md), [telos-substrate.md](active/telos-substrate.md)

## Near-Term Implementation Sequence

1. Extend memory validation toward claim metadata across curated memory surfaces.
2. Add explicit trust-zone crossing checklist fields to receipts.
3. Teach `maintain` to compare `CONSTITUTION.md`, `DESIGN.md`, and `PROMPT_CORE.md` for kernel drift.
4. Add prompt-pack byte-budget or scope warnings.
5. Prototype three-pool retrieval as report-only.
6. Review real `/trajectory distill` outputs before adding a confirmation flow.

Before adding another layer, read the selection-pressure note and decide what should become simpler, less necessary, or explicitly deferred.

## Compression Rule

Compression should preserve what changed judgment. It should not flatten experience into mechanical fields just because fields are easier to count.
