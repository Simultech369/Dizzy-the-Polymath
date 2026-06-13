---
id: U-drift-check-evidence
status: active
tier: 2
owner_surface: scripts/drift_scan.mjs
last_reviewed: 2026-06-13
next_action: Add report metadata for checked revision, checked files, rule-set version, and timestamp without writing ambient state during ordinary scans.
---

# Drift Check Evidence

## Goal

Make drift reports auditable without creating another hidden authority file.

## Minimum Contract

Each report should expose:

- repository revision when available
- files or surfaces checked
- rule-set or scanner version
- check timestamp
- findings count and stable finding IDs

## Boundaries

- Default scans remain report-only.
- Do not update source documents merely to record that they were checked.
- A persisted `last_check` receipt is optional and operator-triggered.
- Absence of findings is not proof of doctrinal correctness.

## Acceptance Tests

- Two scans at the same revision and rule set produce equivalent finding IDs.
- Reports distinguish a new source revision from a new scanner version.
- Running the scan does not dirty the worktree by default.
