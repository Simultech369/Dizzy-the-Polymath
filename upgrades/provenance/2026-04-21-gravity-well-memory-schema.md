# Gravity-Well Memory Schema

Date: 2026-04-21

Purpose: reduce false dismissal of unusual but real material by separating epistemic status from social familiarity.

## Core idea

A memory item should not be treated as disposable merely because it is surprising, niche, stigmatized, or low-prior under a default model.

The schema should distinguish:

- false
- low-value
- speculative
- under-evidenced
- unusual but plausible
- well-supported and durable

## Why "gravity well"

`gravity_weight` means how strongly an item resists being dropped during summarization, compaction, or retrieval pruning.

Examples of high gravity:

- user-stated durable preferences
- explicit decisions
- repeatedly observed real-world patterns
- strange claims with multiple grounded anchors

Examples of low gravity:

- filler chatter
- duplicated paraphrases
- unsupported one-off speculation

## Proposed item shape

```json
{
  "id": "mem_2026_04_21_001",
  "text": "Example memory item",
  "class": "anomalous_but_plausible",
  "confidence": 0.68,
  "gravity_weight": 0.83,
  "source_type": "user_observation",
  "evidence_strength": "medium",
  "freshness": {
    "last_checked_at": "2026-04-21T12:00:00Z",
    "freshness_horizon_days": 30
  },
  "status": "active",
  "why": "Observed repeatedly and not contradicted, but still outside common model priors",
  "anchors": [
    {
      "kind": "memory_file",
      "ref": "memory/2026-04-21.md#item-3"
    }
  ],
  "contradictions": [],
  "tags": ["retrieval-priors", "world-model", "memory"]
}
```

## Proposed classes

### `verified`

Use for:

- well-supported durable facts
- explicit confirmed preferences
- accepted project decisions

Behavior:

- high retention
- strong retrieval preference
- low decay

### `operational`

Use for:

- practical run-state
- active project constraints
- current working assumptions

Behavior:

- medium-high retention
- decays with staleness if not refreshed

### `speculative`

Use for:

- hypotheses
- possibilities
- tentative pattern reads

Behavior:

- retain with clear labeling
- do not promote as fact

### `anomalous_but_plausible`

Use for:

- weird-but-real observations
- socially low-prior but grounded material
- claims that risk over-dismissal by default priors

Behavior:

- not auto-dropped for sounding strange
- retrieval should surface with provenance and uncertainty attached
- candidate for re-check instead of discard

### `disconfirmed`

Use for:

- claims shown false
- obsolete assumptions with explicit contradiction

Behavior:

- searchable for error prevention
- not presented as active belief

### `noise`

Use for:

- filler
- repetition
- disposable context

Behavior:

- safe to compress or drop

## Proposed supporting fields

### `source_type`

Suggested values:

- `user_statement`
- `user_observation`
- `assistant_inference`
- `external_source`
- `derived_summary`
- `system_state`

This separates "who said it" from "how true it is."

### `evidence_strength`

Suggested values:

- `none`
- `weak`
- `medium`
- `strong`

This is not the same as confidence.

Difference:

- `confidence` = current belief estimate
- `evidence_strength` = strength of grounding

## Gravity-weight heuristics

Start simple.

Base upward when:

- user explicitly says "remember this"
- item is tied to a decision
- item appears repeatedly across days
- item has multiple anchors
- item is surprising but grounded

Base downward when:

- paraphrase duplicate
- no anchor
- stale and never re-confirmed
- purely conversational filler

## Retrieval rules

### During compaction

- `verified` and `operational` should rarely be dropped
- `anomalous_but_plausible` should be reviewed before dropping
- `noise` should be first to compress away

### During search

- rank by hybrid relevance plus gravity weight
- show provenance on anomalous items
- surface contradiction markers visibly

### During promotion

- `speculative` should need more evidence to become `verified`
- `anomalous_but_plausible` should prefer re-check workflows over silent suppression

## Minimal compatibility layer with current repos

### `memory-context-pipeline`

Current fields:

- `memory_candidates`
- `drop_candidates`
- `risk_flags`

Upgrade path:

- allow memory candidates to carry `class`, `gravity_weight`, `source_type`, and `evidence_strength`

### `context-kernel`

Current fields:

- summary
- tags
- priority
- confidence

Upgrade path:

- extend memory candidate typing with epistemic class and provenance hints

### OpenClaw `memory-wiki`

Best fit:

- map high-gravity items into claims/evidence structures
- preserve contradiction handling
- keep a maintained knowledge layer beside raw memory

## Recommended first implementation

Do not start with a huge ontology.

Start with:

- `class`
- `gravity_weight`
- `source_type`
- `evidence_strength`
- `last_checked_at`
- `contradictions`

That is enough to test whether the schema actually improves retrieval behavior.

## Test cases

The schema is helping if:

1. a weird but grounded claim is retained for review instead of dropped as noise
2. a stale but previously useful operational assumption gets downgraded instead of silently persisting
3. an unsupported speculative claim is still searchable but not treated as fact
4. contradictory memories surface as tension rather than being blended into one summary
