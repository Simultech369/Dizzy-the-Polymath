---
id: U-refinement-discipline
status: active
tier: 2
owner_surface: OPERATING_LOOP.md and future task preflight helper
last_reviewed: 2026-06-13
next_action: Define one compact task-preflight contract and test its skip, clarify, and proceed paths.
---

# Refinement Discipline And Success Criteria

Status: Accepted - implement soon.

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
