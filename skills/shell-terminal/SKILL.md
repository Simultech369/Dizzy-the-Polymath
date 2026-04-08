---
name: shell-terminal
description: Execute terminal workflows with reliable command sequencing and fast diagnostics. Use when running commands, collecting logs, checking process state, or automating repetitive shell operations.
---

- Run idempotent checks before mutating commands.
- Prefer fast discovery commands.
- Capture errors and return actionable next command.
- Avoid interactive prompts when a non-interactive form exists.
- Stop on destructive actions unless explicitly approved.