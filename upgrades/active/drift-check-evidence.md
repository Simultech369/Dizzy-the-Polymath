---
id: U-drift-check-evidence
status: integrated
tier: 2
owner_surface: scripts/drift_scan.mjs
last_reviewed: 2026-06-13
next_action: None. Maintain drift scan integration in the maintainer flow.
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

## Implemented Integration

- `scripts/drift_scan.mjs` outputs `scanner_version`, `repository_revision`, `findings_count`, and `stable_finding_ids`.
- Safety check unit tests verify behavior under environment overrides (`DIZZY_GIT_REVISION` and `DIZZY_SCANNER_VERSION`).
- The scan runs cleanly in memory without modifying source files.
