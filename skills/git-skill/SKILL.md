---
name: git-skill
description: Manage code changes, diffs, commits, and branch hygiene safely. Use when reviewing changes, preparing commits, resolving merge issues, or summarizing repository state.
version: 1.0.0
provides: git-operations
required_tools: run_command
permissions: Level 4 - Irreversible Actions
external_services: GitHub (origin)
validation_path: npm run maintain
rollback_path: git restore
receipt_fields: skills.loaded, skills.manifests
---

- Inspect status and diff before commit actions.
- Keep commits scoped to one intent.
- Run the repository's known hygiene and verification commands before committing when the change warrants them.
- Separate mechanical formatting changes from behavioral changes when practical.
- Avoid rewriting history unless requested.
- Prefer non-interactive git commands.
- Summarize changed files, remaining manual fixes, and risk before merge.
