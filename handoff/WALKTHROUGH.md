# Approved Checkpoint Walkthrough

Status date: 2026-06-15

## Repository State

- Branch: `experiments`
- Approved HEAD: `13b5c4a315925426e548f486a6a6768897411264`
- Review range for the last approved hardening pass: `a2b437d..13b5c4a`
- At checkpoint, local `experiments` matched `origin/experiments` with zero divergence.
- The worktree was clean.

## Approved Commits

- `d466fe4` - Harden scoped access and notification delivery.
- `7f1328a` - Bound runtime recovery and SQLite durability.
- `13b5c4a` - Verify final independent-review hardening.

## What Was Accepted

### Notification delivery

- Terminal notifications are appended in delivery order.
- Reads are non-destructive.
- Responses include receipts derived from the exact serialized queue entries.
- Acknowledgment atomically verifies the observed queue prefix before trimming it.
- Telegram stops at the first failed send and acknowledges only confirmed deliveries.
- The chosen failure bias is possible duplication rather than silent loss.

### Runtime access boundaries

- Dashboard repository-derived values are HTML escaped.
- Execute and notification clients may use scoped tokens.
- Scoped tokens require a master token to remain configured.
- Scoped tokens cannot access administrative routes.
- Paid/client identity headers require `proxied` mode and explicit trusted proxy peer addresses.
- Untrusted direct peers cannot establish client continuity through identity headers.

### Telegram binding

- Auto-bind generates a startup nonce.
- The first accepted private chat must send `/bind <nonce>`.

### Backup and recovery

- Backup uses a new directory destination and refuses overwrite.
- Restore renames the existing runtime into a recovery location before copying.
- Failed restore copying rolls the original runtime back into place.
- JSONL repair preserves the original and repairs only a malformed final record.
- Interior corruption is refused rather than guessed through.
- Operators are told to stop active writers and protect snapshots as sensitive data.

### SQLite prototype

- File-backed prototype databases use WAL and `synchronous=NORMAL` with bounded lock waits.
- SQLite remains experimental, isolated, and non-authoritative.

## What Was Rejected Or Rewritten

Antigravity's initial patch described ten completed iterations, but the shared worktree patch was treated as untrusted until audited.

Rejected:
- Promoting SQLite to a production-grade Redis replacement.
- Opening the prototype from the live server, dispatch layer, and worker.
- Startup recovery that could treat another active worker's job as stale.
- Extending the schema without a migration for existing databases.
- A restore flow that deleted the live runtime even when its safety backup failed.
- Telegram behavior that acknowledged a whole batch despite individual send failures.
- Trusting paid/client identity headers from every peer when no proxy allowlist existed.

Reason:
- These changes passed happy-path tests but violated existing authority decisions or had concrete data-loss, duplication, migration, or trust-bypass failure paths.

## Verification

The approved committed state passed:

```text
npm.cmd test
SAFETY_CHECKS_OK

npm.cmd run maintain
[green] Dizzy maintenance status
Actionable next steps:
- No immediate maintenance action required.
```

Coverage includes:
- Exact notification acknowledgment and conflict rejection.
- Recovery snapshot and restore rollback behavior.
- Final-record-only JSONL repair and interior-corruption refusal.
- Dashboard escaping markers.
- Scoped token route separation.
- Required trusted proxy configuration.
- Trusted and untrusted proxy identity behavior.
- SQLite WAL durability settings.

## Known Boundaries

- Notification delivery is at least once, not exactly once.
- External services without idempotency support cannot provide exactly-once effects.
- Runtime snapshots require quiesced writers.
- Restore is local filesystem recovery, not a transactional multi-service restore.
- SQLite is a prototype, not the queue or conversation authority.
- Trusted proxy configuration currently names exact socket IPs, not CIDR ranges or cryptographic upstream identity.
- Automated tests do not replace real deployment validation behind the intended reverse proxy.

## Handoff Rule

Changes after `13b5c4a` should be presented as a commit range. Bounded fixes may be implemented and committed by Antigravity, but queue semantics, persistence authority, destructive recovery, trust boundaries, retention, and external-effect replay require Codex review before being treated as approved.

This checkpoint is intentionally suitable for pausing until credit refresh.
