# Upgrades

Synthesized upgrade proposals, roadmaps, schemas, and migration notes.

This directory is a planning lane, not runtime doctrine. Nothing here governs Dizzy until it is deliberately moved into live docs, prompt-pack files, tests, or code.

The aesthetic here should be workshop clarity: enough provenance to understand why a proposal exists, enough restraint that a reader can tell what is live, what is candidate, and what is old sediment.

## Start here

For current direction, start with:

- [active/selection-pressure.md](active/selection-pressure.md)
- [active/memory-metadata.md](active/memory-metadata.md)
- [active/2026-05-13-dizzy-upgrade-priorities.md](active/2026-05-13-dizzy-upgrade-priorities.md)

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

## Current Active Notes

- [active/2026-05-13-dizzy-upgrade-priorities.md](active/2026-05-13-dizzy-upgrade-priorities.md) - prioritized upgrade intake and sequencing after review.
- [active/W-0004-continuity-lifecycle.md](active/W-0004-continuity-lifecycle.md) - implemented locally in `d9ea5fb`; kept as rationale/provenance.
- [active/memory-metadata.md](active/memory-metadata.md) - narrow metadata proposal for `memory/topics/`, blocked on frontmatter-safe parsing.
- [active/per-zone-capability-lists.md](active/per-zone-capability-lists.md) - code-enforced capability surfaces by trust zone.
- [active/refinement-discipline.md](active/refinement-discipline.md) - compact, mostly invisible success-criteria discipline.
- [active/telos-substrate.md](active/telos-substrate.md) - candidate Telos/Substrate compression question.
- [active/civic-sieve.md](active/civic-sieve.md) - boundary/privacy guard before durable writes and risky paid/public outputs.
- [active/privilege-split.md](active/privilege-split.md) - future quarantined-input and privileged-core split.
- [active/anti-goblin-local-failure-pressure.md](active/anti-goblin-local-failure-pressure.md) - candidate review lens for recurring local failure pressures.
- [active/selection-pressure.md](active/selection-pressure.md) - subtraction questions for keeping Dizzy and PBMRebate/PFC from metabolizing complexity instead of reducing it.

## Near-Term Implementation Sequence

1. Publish and review W-0004 continuity lifecycle branch.
2. Keep `upgrades/` readable as a public-facing planning lane.
3. Add model/provider routing with trust-zone, risk, cost, privacy, and provider-health awareness.
4. Add frontmatter-safe parsing before memory metadata.
5. Add TokenJuice-style experiential compression: preserve decisions, constraints, dissent, provenance, and failure modes; remove repetition and obsolete scaffolding.
6. Add sparse self-learning memory for known-good trajectories.
7. Extend drift scanning with surprise detection only as a hypothesis generator.
8. Improve persistent execution history in line with W-0004 retention rules.

Before adding another layer, read the selection-pressure note and decide what should become simpler, less necessary, or explicitly deferred.

## Compression Rule

Compression should preserve what changed judgment. It should not flatten experience into mechanical fields just because fields are easier to count.
