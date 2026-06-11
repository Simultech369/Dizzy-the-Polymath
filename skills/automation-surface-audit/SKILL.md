---
name: automation-surface-audit
description: Audit automations, connectors, hooks, scheduled jobs, wrappers, and MCP surfaces for actual operational readiness. Use before consolidating, deleting, enabling, or claiming an automation is live.
---

- Inventory each surface with owner, trigger, permissions, state, and disable path.
- Classify it as configured, authenticated, recently verified, stale or broken, or missing.
- Require evidence such as config paths, logs, workflow runs, command output, or exact failures.
- Distinguish readable configuration from working execution.
- Check secret handling, external side effects, retry limits, and observability.
- End with keep, merge, retire, or fix-next recommendations.
- Do not mutate or delete surfaces until the evidence table is reviewed.
