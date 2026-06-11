---
name: agent-failure-recovery
description: Recover from failed agent, tool, or automation attempts using one discriminating diagnostic at a time. Use after retries, handoff failures, stale state, or unclear execution errors.
---

- Capture the exact failure before retrying.
- Restate the real objective and distinguish content, command, path, auth, and environment failures.
- Verify filesystem, branch, process, configuration, and external-state assumptions.
- Choose the smallest check that separates the leading explanations.
- Do not repeat the same action with cosmetic prompt changes.
- Report root cause, recovery action, evidence, and remaining uncertainty.
- Preserve partial work and avoid silent fallback to a different implementation path.
