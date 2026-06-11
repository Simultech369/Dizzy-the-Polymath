---
name: plan-execution-checkpoints
description: Execute a written implementation plan in bounded verified batches. Use for multi-step changes where repo reality, review points, or rollback boundaries matter.
---

- Read and challenge the plan against current repository state before execution.
- Name stale assumptions, missing prerequisites, and unsafe sequencing.
- Divide work into independently verifiable batches with rollback points.
- Complete and test one batch before advancing.
- Update the plan when evidence changes the route.
- Report meaningful checkpoints without narrating every trivial operation.
- Stop before irreversible or externally visible actions that lack approval.
