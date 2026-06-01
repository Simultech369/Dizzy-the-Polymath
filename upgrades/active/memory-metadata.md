---
id: U-memory-metadata
status: integrated
tier: 1
owner_surface: scripts/memory_validate.mjs
last_reviewed: 2026-06-01
next_action: Extend beyond curated topic files only after daily/conversation memory write contracts settle.
---

# Memory Metadata

Status: Accepted - implement soon, narrowly.

## Scope

Apply only to curated files inside `memory/topics/`.

Do not apply this as a repo-wide metadata regime.

## Frontmatter Format

```yaml
---
strength: 7              # 1-10, overall importance/value
stability: 8             # 1-10, resistance to pruning
last_accessed: 2026-05-12
semantic_weight: medium  # high | medium | low
---
```

## Safeguards

- Files with `stability: 10` are immutable except by explicit operator action.
- Never prune files referenced by civic doctrine, `DESIGN.md`, or the core prompt pack.
- Civic doctrine files default to `strength: 10` and `stability: 10`.
- All pruning actions must be logged with a before/after summary and operator-visible rationale.
- Metadata supports review; it does not outrank the file content.

## Purpose

Enable graceful, principled forgetting while protecting what must endure.

Support:

- lightweight drift/freshness checks
- utility-model compaction
- memory review prioritization

## Implementation Notes

- Update future drift or memory-review utilities to respect these fields.
- Do not use metadata to auto-delete high-stability files.
- Do not let metadata become a second hidden source of truth.
