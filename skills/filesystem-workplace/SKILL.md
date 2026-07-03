---
name: filesystem-workplace
description: Navigate, inspect, and organize local files and folders safely. Use when tasks involve locating files, reviewing workspace structure, editing file trees, or preparing artifacts without external network actions.
---

- Resolve paths before editing.
- Search and inspect the existing structure before creating, renaming, or reorganizing files.
- Prefer non-destructive operations first.
- Confirm target folders before moving or deleting.
- Preserve frontmatter, wikilinks, index notes, naming conventions, and backlinks in Obsidian-style vaults.
- Maintain navigable note neighborhoods instead of creating folder sprawl.
- Use vault-aware helpers when available, but do not assume a specific wiki tool exists.
- Keep outputs in predictable locations.
- Report changed paths explicitly.
- Parse raw logs, PDFs, or CSVs in three distinct phases: Raw Extraction, Structural Typing (JSON schema), and Inference Analysis.
- Produce a validation delta showing missing fields or parsing errors. Never dump unparsed log data directly into the prompt context.
