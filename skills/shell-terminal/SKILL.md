---
name: shell-terminal
description: Execute terminal workflows with reliable command sequencing and fast diagnostics. Use when running commands, collecting logs, checking process state, or automating repetitive shell operations.
---

- Run idempotent checks before mutating commands.
- Prefer fast discovery commands.
- Discover project-specific lint, format, typecheck, and test commands before running generic tooling.
- Apply mechanical cleanup in an explicit order and review the resulting diff.
- Capture errors and return actionable next command.
- Report remaining manual fixes after automated cleanup.
- Avoid interactive prompts when a non-interactive form exists.
- Treat formatting as hygiene, not behavioral verification.
- Stop on destructive actions unless explicitly approved.
