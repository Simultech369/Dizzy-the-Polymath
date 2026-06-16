# Post-Checkpoint Implementation Plan

Status date: 2026-06-15

## Objective

Allow independent reviewers and Antigravity to continue useful work after approved commit `13b5c4a`, while keeping architectural contentions auditable and preserving a clean stopping point for later Codex review.

## Operating Model

1. `13b5c4a` is the approved baseline.
2. New work should occur in small commits on `experiments` only when it is clearly bounded, or preferably on a provisional branch such as `antigravity/review-followup`.
3. Passing tests do not by themselves approve a policy or architecture change.
4. Review-required changes remain provisional until Codex examines the code, tests, and contention.
5. A later Codex pass may accept commits unchanged, amend them, split them, or revert them.

## Phase 1: Fresh Whole-Repository Review

Reviewer responsibilities:
- Reconstruct the runtime architecture independently.
- Trace high-risk claims through code, tests, configuration, and operator documentation.
- Run existing verification where feasible.
- Produce findings with exact evidence and concrete failure sequences.
- Avoid generic best-practice inventories.

Deliverable:
- A findings-first review with prioritized candidate iterations and explicit uncertainties.

Stopping condition:
- The report distinguishes defects from policy disagreements and identifies what should not change.

## Phase 2: Evidence And Reproduction

Implementation agent responsibilities:
- Convert high-confidence findings into minimal failing tests or deterministic reproductions.
- Check whether the concern still applies at current HEAD.
- Search for existing policy decisions before changing behavior.
- Reject findings whose premise is contradicted by code or deployment assumptions.

Deliverable:
- One evidence commit per verified concern when practical.

Stopping condition:
- Each proposed fix has a reproduced failure or a clearly documented reason why reproduction is infeasible.

## Phase 3: Bounded Implementation

Preferred order:
1. Security boundary or data-loss defects with plausible reachability.
2. Crash consistency and operator recovery defects.
3. Concurrency, retry, and external-effect ambiguity.
4. Test coverage and observability gaps.
5. Maintainability improvements with demonstrated value.

Commit discipline:
- One cohesive concern per commit.
- No unrelated cleanup.
- Preserve current external behavior unless the finding requires changing it.
- Update `DESIGN.md` only for deliberate policy decisions.
- Regenerate `state.json` after canonical design changes.

## Phase 4: Contention Handling

The following need an explicit decision record before promotion:

### SQLite authority

Current position:
- SQLite is experimental and non-authoritative.
- The live server and worker do not use it as an operational backend.

Promotion evidence required:
- Schema migration strategy.
- Multi-process claim leases and stale-worker recovery.
- Notification and DLQ parity with Redis.
- Export, rollback, and corruption handling.
- Supported Node runtime decision despite `node:sqlite` experimental status.
- Failure-injection tests across process interruption and concurrent workers.

### Backup and restore

Current position:
- Operators must stop writers.
- Backup creates a new directory snapshot.
- Restore preserves the current runtime by rename and rolls it back if copying fails.
- JSONL repair is intentionally narrow and preserves originals.

Any broader repair or live snapshot proposal must prove it cannot silently lose or combine inconsistent state.

### Queue and external effects

Current position:
- Queue claims use ownership leases.
- Non-READ interrupted effects fail closed.
- Unresolved uploads or deliveries block automatic replay.
- Notifications use non-destructive reads and exact-prefix acknowledgment.

Changes must prefer at-least-once notification delivery over silent loss and must not claim exactly-once remote effects without remote idempotency support.

### Proxy and paid/client identity

Current position:
- Proxy-derived identity requires `proxied` mode and explicit trusted proxy socket addresses.
- Scoped execute/notify tokens require the master token and cannot access administrative routes.

Changes must model the direct peer, forwarding topology, and bypass paths rather than trusting headers by name alone.

## Phase 5: Verification And Handoff

Required commands:

```powershell
git diff --check
npm.cmd test
npm.cmd run maintain
git status --short --branch
git log --oneline --decorate -12
```

The walkthrough must report:
- Baseline and reviewed HEAD.
- Commits created.
- Tests and commands run.
- Accepted findings.
- Rejected findings and technical reasons.
- Contentions awaiting Codex.
- Whether the branch is pushed and synchronized.
- Whether the repository is a safe stopping point.

## Credit-Refresh Stopping Rule

Stop rather than expand when:
- All current high-confidence findings are resolved or explicitly deferred.
- Tests and maintenance are green.
- The branch is clean and synchronized.
- Remaining work is architectural, speculative, or requires new external evidence.
- A new iteration would create more provisional surface than verified value.
