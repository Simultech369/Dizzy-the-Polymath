# Post-Checkpoint Task Checklist

Status date: 2026-06-15

Approved baseline:
- Branch: `experiments`
- Commit: `13b5c4a315925426e548f486a6a6768897411264`
- Remote branch was clean and synchronized at handoff.
- `npm.cmd test` and `npm.cmd run maintain` passed from the committed state.

This checklist is a review and implementation aid. It is not runtime doctrine. `DESIGN.md`, tests, and committed code remain authoritative.

## Before Any Work

- [ ] Read `AGENTS.md`, `BOOTSTRAP.md`, and the required initialization files.
- [ ] Verify `git rev-parse HEAD`, `git status --short --branch`, and the current branch.
- [ ] Treat changes after `13b5c4a` as provisional until their commit range is independently reviewed.
- [ ] Preserve user or agent changes already present in the worktree.
- [ ] Never expose credentials, invoke real paid services, or perform destructive recovery tests against live `runtime/` data.

## Independent Review

- [ ] Build a fresh system model before relying on existing conclusions.
- [ ] Identify authoritative state, trust boundaries, external effects, and recovery paths.
- [ ] Review the repository as a whole, not only `13b5c4a..HEAD`.
- [ ] Separately inspect the provisional diff or commit range after understanding the baseline.
- [ ] Classify every finding as verified defect, likely defect, policy contention, test gap, documentation drift, or future hardening.
- [ ] State explicitly when the existing implementation is sound.

## Safe Autonomous Work

Antigravity or another implementation agent may implement and commit these when evidence is clear and the change is bounded:

- [ ] Tests that reproduce a verified bug without changing policy.
- [ ] Escaping, redaction, bounds checks, resource cleanup, or error handling consistent with current decisions.
- [ ] Documentation corrections that accurately describe existing behavior.
- [ ] Small operator diagnostics that do not mutate authoritative state.
- [ ] Refactors with behavior-preserving tests and no trust-boundary changes.

Requirements:
- [ ] Keep each concern in a separate commit.
- [ ] Run focused tests after each commit.
- [ ] Run `npm.cmd test` and `npm.cmd run maintain` before handoff.
- [ ] Record exact commands, results, commit hashes, and unresolved concerns.

## Review-Required Work

Draft or implement on a clearly provisional branch, but do not merge into the approved line without Codex review:

- [ ] Making SQLite authoritative or wiring `DIZZY_OPERATIONAL_STORE=sqlite` into the server or worker.
- [ ] Queue claim, lease, retry, dead-letter, acknowledgment, or replay semantic changes.
- [ ] Recovery or restore code that deletes, overwrites, repairs, or migrates durable state.
- [ ] Proxy trust, authentication, scoped token, identity, public-surface, or remote mutation changes.
- [ ] Paid/client continuity, retention, deletion, or cross-zone retrieval changes.
- [ ] Any automatic replay after an unresolved external effect.
- [ ] New external services, dependencies, network exposure, or secret-bearing configuration.
- [ ] Changes to constitutional prompt files, memory authority, or promotion rules.

For each review-required item:
- [ ] Name the concrete failure being prevented.
- [ ] Present the strongest contention against the change.
- [ ] Provide a reversible implementation or patch.
- [ ] Include failure-injection or adversarial tests.
- [ ] Leave the decision visible in the walkthrough.

## Backup And Recovery Verification

- [ ] Confirm backup refuses an existing destination.
- [ ] Confirm backup refuses a destination inside the live runtime directory.
- [ ] Confirm restore preserves the prior runtime as a recovery directory.
- [ ] Inject a restore-copy failure and confirm automatic rollback restores the original runtime.
- [ ] Confirm JSONL repair preserves the original file.
- [ ] Confirm repair only removes a malformed final record.
- [ ] Confirm repair refuses interior or ambiguous corruption.
- [ ] Confirm snapshots are documented as sensitive private data.
- [ ] Do not claim live-writer consistency unless a real quiescence or coordinated snapshot mechanism exists.

## Completion Gate

- [ ] No uncommitted files remain unless deliberately listed as provisional.
- [ ] `git diff --check` passes.
- [ ] `npm.cmd test` passes.
- [ ] `npm.cmd run maintain` passes.
- [ ] Documentation and generated `state.json` agree.
- [ ] Handoff identifies approved commits, provisional commits, rejected proposals, and remaining uncertainties.
- [ ] The resulting point is useful and understandable even if work pauses until credit refresh.
