# Runtime Recovery And Review-Tool Hardening Evidence

## Impact Classification

runtime_dependency, external_contract

## Affected Surface

- `lib/queue.mjs` Redis Lua notification enqueue and marker persistence
- `lib/sqlite_operational_store.mjs` job-creation idempotency
- `.github/workflows/checks.yml` Node 20.18.1, Node 22, and Python 3.12 verification environments
- `scripts/openrouter_review.py` destination validation and credential selection

## Verification

- `npm test`
- `npm run maintain`
- Focused failure injection covers notification failure, recovery retry inside the same worker lifetime, and a lost response after an atomic Redis commit.
- OpenRouter review-tool checks cover malformed, non-HTTPS, user-info, ambiguous query-bearing bases, noninteractive use, provider-key isolation, and fail-closed redirect wiring without making a network request.
- SQLite checks cover matching create replay, conflicting job IDs, and same-ID effect conflicts.

## Result

Dead-job notification enqueue and `death_notified_at_ms` persistence share one idempotent Redis script. DLQ enqueue and `dlq_enqueued_at_ms` now use the same pattern. Retained claims are retried periodically with bounded backoff while the worker remains alive. Retrying after an ambiguous response observes the marker and does not enqueue another queue item. End-to-end downstream delivery remains at-least-once because an external delivery may succeed before its queue receipt is acknowledged.

The full safety suite reports a clear Python 3 prerequisite, CI provisions Python explicitly where the suite runs, and custom review destinations cannot receive `OPENROUTER_API_KEY`. Redirects are blocked, `.env` loading is opt-in, and base URLs are parsed rather than concatenated.

## Rollback Path

Revert the runtime-recovery and review-tool hardening commit. No stored-job migration is required; existing empty or populated notification markers remain compatible. Restore the earlier review-script destination behavior only if custom endpoint credential exposure is explicitly accepted.

## Live-Check Gap

No live Redis/Memurai server or external review provider was contacted. Redis command behavior was validated with the repository fake-Redis contract and safety tests; provider validation stopped before network access. Redis Cluster remains explicitly unsupported because the existing key layout does not share a hash slot.
