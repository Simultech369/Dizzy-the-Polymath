---
name: context-budgeting
description: Design a bounded context set for a task while controlling bloat, poisoning, duplication, and lost-in-the-middle risk. Use when preparing deep reviews, long-context work, or context packs.
---

- State the task, decision, and evidence threshold before selecting context.
- Load stable authority first, then add only task-relevant supporting files.
- Separate governing context, evidence, hypotheses, and historical residue.
- Prefer summaries with retrieval handles over indiscriminate full-file loading.
- Identify missing context and excluded context explicitly.
- Judge context quality by output accuracy and decision value, not token volume.
- Use sub-agents only when context isolation creates a real boundary.
