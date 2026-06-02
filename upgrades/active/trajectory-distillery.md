---
id: U-trajectory-distillery
status: integrated
tier: 3
owner_surface: lib/trajectories.mjs
last_reviewed: 2026-06-01
next_action: Review real /trajectory distill proposals against the contract before adding confirmation flow.
---

# Trajectory Distillery

Capture reusable intelligence from successful executions without creating memory sludge.

Status: first manual path implemented.

Implemented first pass:
- `lib/trajectories.mjs` stores sparse known-good trajectories in `runtime/trajectories/known_good.jsonl` by default.
- `/trajectory add {json}` captures an operator-provided distilled pattern in durable-memory trust zones only.
- `/trajectory list` shows recent entries.
- `/trajectory distill` proposes a trajectory from recent conversation history, but does not save it.
- Private/trusted chat retrieval can surface relevant trajectories as supporting context.
- Saved rows include a `distillation_contract` with allowed/excluded content classes, evidence basis, lossy-risk label, operator-review requirement, and auto-save prohibition.
- Safety checks cover normalization, storage, retrieval, contract validation, and context formatting.

## Purpose

Auto-memory preserves durable context. Trajectory Distillery should preserve reusable moves: what worked, under what constraints, and how it can be reused later.

## Minimal Schema

Target location: `runtime/trajectories/*.jsonl`.

```json
{
  "id": "traj_20260526_1432_xxx",
  "timestamp": "2026-05-26T14:32:00Z",
  "goal": "Short clear goal statement",
  "constraints": "Key constraints or hard stops",
  "success_criteria": "What counted as success in this task",
  "actions_taken": ["brief list of key moves"],
  "outcome": "success | partial | failure",
  "reusable_pattern": "One-sentence tactic or insight that worked",
  "reuse_tags": ["refinement", "tooling", "compression"],
  "source_hash": "short hash of originating transcript or artifact",
  "strength": 7,
  "distillation_contract": {
    "allowed_content_classes": ["goal", "constraints", "success_criteria", "actions_taken", "outcome", "reusable_pattern", "reuse_tags", "source_hash"],
    "excluded_content_classes": ["raw_transcript", "secret_material", "private_emotional_detail", "identity_or_attachment_claim", "unverified_user_fact"],
    "evidence_basis": ["short evidence reason"],
    "lossy_risk": "low | medium | high",
    "operator_review_required": true,
    "auto_save_allowed": false
  }
}
```

## Capture Triggers

- Successful refinement where the result satisfies explicit or implicit success criteria.
- Complex reasoning tasks where the operator accepts the framing or implementation.
- Tooling sequences that worked cleanly after friction.
- Manual `/distill` command from the operator.

## Retrieval Logic

On similar tasks, surface the top two or three trajectories by goal similarity and tag overlap. Retrieval should prefer recent high-strength trajectories, but old high-signal patterns can remain available when their mechanism still applies.

Only surface a trajectory if:

- `strength >= 6`
- it has a concrete `reusable_pattern`
- it does not require private context forbidden by the active trust zone

## Anti-Sludge Rules

- Maximum one automatic trajectory per session unless the operator explicitly asks for more.
- Never store raw conversation; store the distilled pattern.
- Do not capture "the user liked it" as evidence. Capture what worked.
- Exclude raw transcript, secrets, private emotional detail, identity/attachment claims, and unverified user facts.
- Label lossy risk instead of hiding uncertainty.
- Keep fewer than 200 active trajectories before compaction or pruning.
- Fail closed in `paid_public` unless an operator explicitly enables scoped client learning later.

## Good Entry

`reusable_pattern`: Use explicit success criteria plus one targeted refinement question before complex tool chains.

`reuse_tags`: `["refinement", "tooling", "operator-burden"]`

## Bad Entry

- Long narrative summary of the chat.
- Vague praise or mood notes.
- Full tool output instead of the operational insight.

## Completed Smallest Experiment

Add manual-only trajectory capture first. Let the operator invoke it after a successful task, then review whether retrieval actually improves a later similar task.

## Next Experiment

Review real `/trajectory distill` outputs and decide whether they are clean enough to support a two-step confirmation flow or should remain copy/paste proposals.
