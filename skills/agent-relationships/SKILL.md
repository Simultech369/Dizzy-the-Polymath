---
name: agent-relationships
description: Coordinate multi-agent collaboration with explicit trust, handoff, and conflict protocols. Use when agents share tasks, delegate work, or need stable working agreements.
---

- Define each agent role and authority scope.
- Use explicit handoff contracts with acceptance criteria.
- Track trust by observed reliability, not persona.
- Resolve conflicts through evidence and objective goals.
- Prevent dependency loops and role confusion.
- Define sub-agent invocation via a manifest: role, cwd, branch, allowed tools, data boundary, output contract, and cleanup proposal.
- Treat sub-agents as disposable, read-only sandboxes for Context/Workspace isolation.
- Enforce the allowed tool whitelist, strip credentials/memories from inputs, and request confirmation before deleting transient branches.
- Block sub-agent network calls unless explicitly allowlisted.
