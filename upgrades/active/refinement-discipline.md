---
id: U-refinement-discipline
status: integrated
tier: 2
owner_surface: PROMPT_CORE.md and OPERATING_LOOP.md
last_reviewed: 2026-06-13
next_action: Keep this as prompt and process discipline; add code only if repeated evidence shows the model contract is insufficient.
---

# Refinement Discipline And Success Criteria

Status: Integrated as live prompt and operator-process guidance.

## Rule

Before any non-trivial task, distill a compact internal `success_criteria` block.

## Process

- If criteria cannot be written clearly and concisely, ask at most one targeted question.
- Ask only if the missing piece would materially change the approach.
- Never ask what a reasonable attempt would reveal.
- Skip refinement entirely when the operator request is already clear.

## One-Minute Rule

If distillation feels slow, default to:

- goal in one sentence
- hard constraints or abort conditions
- one clear completion signal

## Success Criteria Shape

The internal or visible block should contain:

- completion signal
- 1-3 acceptance checks
- abort conditions

## Philosophy

Favor momentum and sparse prose over heavy prompt engineering.

This is a discipline, not a new bureaucracy.

## Implemented Contract

- `skip`: simple and clear requests do not trigger refinement ceremony
- `proceed`: non-trivial work silently holds one completion signal, one to three checks, and hard constraints or abort conditions
- `clarify`: at most one question, only when the missing fact materially changes approach, risk, or irreversible outcome
- one-minute fallback: goal, hard constraints, completion signal

The contract is intentionally not a new runtime helper or visible response block. Safety checks pin all three paths and the no-planning-theater rule in the live prompt and operator loop.
