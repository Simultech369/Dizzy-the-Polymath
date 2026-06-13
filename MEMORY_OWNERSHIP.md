# Memory Ownership

Purpose: name which subsystem owns each durable memory-like surface so independent writers do not silently overwrite each other.

This is an operational map, not a constitution. If a new memory-like file or ledger appears, classify it here or keep it explicitly temporary.

## Owned Surfaces

| Surface | Owner | Write Path | Persistence Role |
|---|---|---|---|
| `MEMORY.md` | Operator-curated memory index | `/memory_review` proposals, manual edits | Non-governing long-term memory index |
| `memory/topics/*.md` | Operator-curated topic memory | `/memory_review` proposals, manual edits | Durable topic context |
| `memory/YYYY-MM-DD.md` | Daily log | `/remember`, auto-memory promotion, session close | Dated decisions and meaningful shifts; generated summaries declare source, capture mode, and review status |
| `memory/conversations/*.md` | Conversation memory | `/remember`, auto-memory promotion | Compact conversation continuity; generated summaries remain `runtime_generated` until separately curated |
| `runtime/trajectories/known_good.jsonl` | Trajectory Distillery | `/trajectory add` after review | Reusable known-good patterns |
| `runtime/friction/ledger.jsonl` | Friction Ledger | `/friction add` | Repeated operator stuck-points |
| `runtime/auto_memory_candidates/*.json` | Auto-memory staging | auto-memory gate | Delayed candidate before promotion |
| `runtime/auto_memory/*.json` | Auto-memory dedupe state | auto-memory gate | Signature/cooldown state |
| `runtime/improvements/*.json` | Self-modification proposal queue | `/improve`, `/memory_review` | Proposed edits requiring explicit apply |

## Rules

- One durable surface should have one primary writer.
- Proposal files are not applied state.
- Runtime ledgers are local operational records, not constitutional doctrine.
- Conversation and daily memories should capture deltas, not raw transcripts.
- A new writer must declare its target surface before writing durable state.
- Deletion, expiry, or archival must be explicit and reviewable.

## Current Gaps

- Memory metadata is enforced first on trajectory rows, not yet on every markdown memory surface.
- Daily logs and conversation summaries do not yet carry full source/confidence/freshness metadata.
- This map is checked for presence, not exhaustive path coverage.
