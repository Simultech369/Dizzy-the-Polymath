# Test Side-Effect Inventory and Disposable Runtime Protocol

Status: Codex planning artifact
Snapshot: `main` at `62acf21b5a0f5e4d811cc9cebb6536931457933b`, matching `origin/main`
Role boundary: Codex documents risk and acceptance criteria. Antigravity remains final implementer.
These roles describe this local handoff workflow only; this inventory does not create standing authority, public governance, or maintainer powers.

## Purpose

This document identifies which checks are safe to run now, which write disposable fixtures, and which should wait until Antigravity isolates runtime paths. It is intentionally conservative: a check that writes inside repo `runtime/` is not treated as inert merely because it cleans up afterward.

This inventory is not blanket authorization to run commands. Before any invocation, re-check the current code path, branch, `HEAD`, `origin/main`, dirty tree, and configured environment. If the exact invocation differs from the inventory, stop and reclassify it.

## Current Package Commands

| Command | Script Surface | Side-Effect Class | Current Recommendation |
| --- | --- | --- | --- |
| `npm test` | `scripts/safety_checks.mjs` then `scripts/fuzzing_and_injection_tests.mjs` | mixed: temp writes, repo `runtime/test-*` writes, server starts, delete/prune fixtures | do not treat as fully inert yet |
| `npm run check:safety` | `scripts/safety_checks.mjs` | mixed: highest-risk test surface | run only after disposable runtime protocol is in place |
| `npm run check:fuzzing` | `scripts/fuzzing_and_injection_tests.mjs` | likely read-only/in-memory | safe candidate, but no full-suite substitute |
| `npm run smoke` | `smoke_test.mjs` | writes `runtime/test-smoke-*.jsonl` | run only with injected disposable paths |
| `npm run check:state` | `scripts/sync_state.mjs --check` | read-only check mode | safe candidate |
| `npm run check:active-policy` | `scripts/check_active_policy_state.mjs` | cwd temp files, deletes exact filenames | hold until it accepts an injected disposable root |
| `npm run check:memory` | `scripts/memory_validate.mjs` | read-only | safe candidate |
| `npm run check:prompt` | `scripts/prompt_drift_check.mjs` | read-only | safe candidate |
| `npm run check:production` | `scripts/production_readiness_check.mjs` | read-only | safe candidate |
| `npm run check:dependencies` | `scripts/dependency_api_drift_check.mjs` | read-only | safe candidate |
| `npm run check:next` | `scripts/next_consistency_check.mjs` | read-only | safe candidate |
| `npm run check:skills` | `scripts/skill_registry_check.mjs` | read-only | safe candidate |
| `npm run check:docs` | `scripts/doc_reference_check.mjs` | read-only | safe candidate |
| `npm run drift:scan` | `scripts/drift_scan.mjs` | read-only stdout | safe candidate |
| `npm run connection:scan` | `scripts/connection_scan.mjs` | writes report and quarantined bridges under live `runtime/` | not inert; needs `--check`/dry-run |
| `npm run maintain` | `scripts/maintain.mjs` | mixed because it invokes `safety`, `smoke`, and `connection:scan` | do not run as a release gate until inert |

## High-Risk Surfaces

### Connection Scan

Evidence:

- `scripts/connection_scan.mjs` defaults its report to `runtime/reports/connections.md`.
- The current script has no real `--check` mode; `--check` is interpreted as the output path argument.
- It always stages findings as quarantined bridges in `runtime/quarantine`.
- It writes `bridge_<id>.json` files for each finding.
- `scripts/maintain.mjs` includes connection scan as a yellow check.

Acceptance criteria:

- Add `--check`, `--dry-run`, or equivalent read-only mode.
- The read-only invocation must be a named exact mode, not a positional output filename.
- In check mode, print findings to stdout or a caller-provided temp path only.
- In check mode, do not create `runtime/reports`, `runtime/quarantine`, or bridge JSON files.
- `maintain` must call the read-only mode.
- Staging real bridge files should remain an explicit operator action.
- Removing the scan from `maintain` is not enough to unblock direct `npm run connection:scan`; the direct command remains held until its exact invocation is zero-write.

### Safety Checks

Evidence:

- `scripts/safety_checks.mjs` contains many valid isolated fixtures, but several use repo `runtime/test-*` paths directly.
- It starts local servers in multiple tests.
- It calls continuity deletion and prune paths against test fixtures.
- It exercises backup/restore behavior with destructive operations inside fixture roots.

Important current fixture categories:

- Durable write and active-policy fixture files under `runtime/test-*`.
- Client-continuity fixture paths such as `runtime/test-execution-history.jsonl`, `runtime/test-execute-conversations`, `runtime/test-client-continuity-deletions.jsonl`.
- Prune fixtures such as `runtime/test-prune-execution-history.jsonl`, `runtime/test-prune-conversations`, deletion logs, and automation receipts.
- RAG and memory graph fixtures under `runtime/test-rag-authority` and temporary memory roots.
- Backup/restore fixtures under temp/recovery roots.
- Server fixtures that bind to loopback ports.

Acceptance criteria:

- Centralize all test paths under one disposable root, for example `runtime/.test/<run-id>/` or OS temp.
- Every destructive cleanup must resolve and verify that the final absolute target is inside that disposable root.
- Tests must restore changed environment variables in `finally`.
- Server tests must close listeners in `finally`.
- Delete/prune tests must use preview-first expectations when Antigravity redesigns those APIs.
- Running `npm test` must not create, delete, or mutate live `runtime/friction`, `runtime/quarantine`, `runtime/conversations`, `runtime/accepted_bridges.json`, or production automation receipts.

### Active Policy Check

Evidence:

- `scripts/check_active_policy_state.mjs` writes `temp-active-policy-state-<Date.now()>.json` and `temp-active-policy-config-<Date.now()>.json` in the repo cwd, then deletes those exact files.

Current recommendation:

- Hold `npm run check:active-policy` until it accepts an injected disposable root, verifies cleanup containment, restores process state, and reports files written, deleted, and remaining.
- Stop if its state or config path resolves outside a verified disposable root.
- Do not allow cwd temp filenames.

Acceptance criteria:

- Move both files under an injected temp root.
- Add a real append-path fixture that writes to temp friction/config/state/quarantine paths.
- Verify candidate exclusion, write suspension, bridge veto, and explicit resolution receipt.
- Verify partial config/state files with missing nested fields preserve containment through deep defaults or fail closed before append success is reported.
- Treat active-policy evaluation errors as check failures, not logged warnings that allow the append path to continue.
- Inject quarantine root explicitly; do not let bridge-veto fixtures touch cwd `runtime/quarantine`.
- Cleanup must verify the target root before recursive deletion.

### Smoke Test

Evidence:

- `smoke_test.mjs` sets `DIZZY_TRAJECTORY_PATH=runtime/test-smoke-trajectories.jsonl`.
- It sets `DIZZY_FRICTION_PATH=runtime/test-smoke-friction.jsonl`.
- It removes those files at the end.

Acceptance criteria:

- Route both files into a disposable root.
- Restore all modified environment variables.
- Confirm no smoke path touches live `runtime/conversations` unless isolated.

### Continuity Delete and Prune

Evidence:

- `lib/client_continuity.mjs` can delete conversation files, quarantine bridges, accepted bridges, friction rows, and write deletion receipts.
- Dashboard and CLI routes can call these mutation paths.
- Tests currently use fixture paths in several places, but the production API boundary still needs preview -> confirmation -> receipt semantics.

Acceptance criteria:

- Tests for delete/prune must use injected history, conversation, deletion, receipt, friction, quarantine, and accepted-bridge paths.
- Deletion API must support preview mode.
- Execution requires explicit confirmation.
- Receipts must include exact affected targets and partial failures.
- Missing target must return `target not found`.

## Safe-To-Run Read-Only Candidates

These appear suitable for Codex to run before Antigravity returns, provided the snapshot gate still matches:

- `npm run check:state`
- `npm run check:memory`
- `npm run check:prompt`
- `npm run check:production`
- `npm run check:dependencies`
- `npm run check:next`
- `npm run check:skills`
- `npm run check:docs`
- `npm run drift:scan`
- `npm run check:fuzzing`

Do not infer release readiness from these alone. They do not prove the active-policy correction, mutation lifecycle, or full dashboard route contract.

These remain safe candidates only under current code inspection. If any check begins creating directories, writing defaults, starting services, staging bridges, deleting fixtures, or touching live `runtime/`, reclassify it as held until inert.

## Hold Until Inert

Hold these as release gates until Antigravity isolates fixtures:

- `npm test`
- `npm run check:safety`
- `npm run check:active-policy`
- `npm run smoke`
- `npm run connection:scan`
- `npm run maintain`
- `node scripts/test_active_integration.mjs`
- direct `operator_continuity delete` or dashboard delete/prune routes
- backup/restore/repair against any non-fixture runtime path

This hold applies to the current listed invocations. It does not block a newly inert, disposable-root focused check when the exact command, injected paths, cleanup target, files written/deleted, residual files, and environment restoration are recorded.

## Disposable Runtime Protocol

Use this protocol before any focused or full-suite verification.

1. Snapshot gate:
   - Confirm branch, `HEAD`, and `origin/main`.
   - Capture `git status --short`.
   - Stop on mismatch.
2. Create one test root:
   - Prefer OS temp or `runtime/.test/<timestamp>-<purpose>/`.
   - Never use broad names like `runtime/test`, `runtime/tmp`, or a reused shared folder.
3. Inject every mutable path:
   - `DIZZY_FRICTION_PATH`
   - `DIZZY_TRAJECTORY_PATH`
   - `DIZZY_EXECUTION_HISTORY_PATH`
   - `DIZZY_CONVERSATION_DIR`
   - `DIZZY_CLIENT_CONTINUITY_DELETION_LOG`
   - `DIZZY_AUTOMATION_RECEIPT_PATH`
   - `DIZZY_DLQ_DIR`
   - `DIZZY_RAG_ROOT`
   - `DIZZY_RAG_ALLOWED_ROOTS`
   - `DIZZY_MEMORY_GRAPH_ROOT`
   - active-policy config/state/ledger/quarantine options once implemented
4. Before cleanup:
   - Resolve absolute cleanup target.
   - Resolve absolute test root.
   - Confirm the cleanup target is inside the test root.
   - Do not delete if any path cannot be resolved.
5. Cleanup:
   - Delete only the verified disposable root.
   - Restore environment variables exactly.
   - Close loopback servers.
   - Report files written and deleted.
6. Evidence:
   - Record command, exit code, files written, files deleted, and residual files.
   - Do not promote public claims unless the evidence names the exact commit.

## Antigravity Implementation Criteria

For the verification-harness phase, Antigravity should produce one small commit that:

- Adds a reusable test root/path helper or equivalent pattern.
- Moves active-policy fixtures out of cwd and live `runtime/`.
- Adds read-only/check mode to connection scan or removes the writer from `maintain`.
- Keeps destructive delete/prune routes out of automated checks unless fully injected and confirmed.
- Does not alter HUD or product presentation.

The commit must satisfy the disposable-root and side-effect evidence criteria before Antigravity proceeds to active-policy semantics. Codex reconciliation is recorded separately and does not create implementation authority.
