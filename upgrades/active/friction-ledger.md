---
id: W-0012
title: Friction Ledger
status: planning candidate
created_at: 2026-05-13
updated_at: 2026-06-03
---
# Friction Ledger

Track repeated operator stuck-points so annoyance becomes design signal instead of background drag.

Status: first manual path implemented.

Implemented first pass:
- `lib/friction_ledger.mjs` stores sparse friction entries in `runtime/friction/ledger.jsonl` by default.
- `/friction add {json}` captures operator stuck-points in durable-memory trust zones only.
- `/friction list` and `/friction summary` expose recent and weighted unresolved friction.
- `scripts/maintain.mjs` summarizes ledger health.
- Safety checks cover normalization, storage, and summary weighting.

## Purpose

Make invisible friction visible and prioritized. The ledger should reduce operator burden systematically instead of relying on heroic memory or repeated debugging.

## Minimal Schema

Target location: `runtime/friction/*.jsonl`.

```json
{
  "id": "fric_20260526_xxx",
  "timestamp": "2026-05-26T14:15:00Z",
  "friction_type": "setup | auth | prompt_overload | memory_uncertainty | stale_docs | marketplace_ambiguity",
  "description": "Short description of what got stuck",
  "task_context": "Brief goal of the task",
  "severity": 1,
  "frequency": "first | repeated | chronic",
  "suggested_fix": "Optional operator note",
  "resolved": false
}
```

## Capture Triggers

- Operator uses an explicit `friction` or `stuck` command.
- `scripts/maintain.mjs` detects repeated stale-status or validation failures.
- A task enters a long refinement loop.
- Setup/auth/tooling failures recur across sessions.

## Review Process

Monthly or during maintenance:

1. Run `npm run maintain`.
2. Summarize unresolved friction by `severity * frequency`.
3. Pick the top two or three frictions.
4. Convert the highest item into a concrete experiment or cleanup.
5. Mark resolved items and archive them after 90 days.

## Starter Frictions

- Prompt pack vs `DESIGN.md` synchronization.
- Status fog between `NEXT.md` and `upgrades/`.
- Memory uncertainty when retrieval returns stale or weak items.
- Continuity boundary decisions during paid/client sessions.
- External tool auth failures that consume creative time.

## Smallest Experiment

Start with manual entries only. Add automated capture only after the maintain report proves the ledger is being read and acted on.
