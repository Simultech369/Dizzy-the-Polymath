# Queue Enqueue Idempotency Key Evidence

## Impact Classification

runtime_dependency

## Affected Surface

- `lib/queue.mjs`
- Redis Lua enqueue path
- `/dispatch/incoming` and `/agent/execute` idempotency-key handling

## Verification

- `node scripts/safety_checks.mjs`
- `npm run maintain`
- Focused tests cover scoped `Idempotency-Key` validation, Redis Lua return shape, duplicate-key behavior, and positive integer expiry validation.

## Result

The idempotent enqueue path was promoted with route/actor scoping, printable-ASCII header validation, Redis Lua atomicity, and safety-check coverage.

## Rollback Path

Revert the queue enqueue idempotency-key commit and remove the reconciliation ledger entry. Existing queued jobs do not require migration because the idempotency key only gates enqueue creation.

## Live-Check Gap

No live Redis/Memurai server was contacted by this evidence packet. Validation used repository safety checks and fake Redis coverage.

