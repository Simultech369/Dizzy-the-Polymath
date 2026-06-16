# Grok Feedback Triage

Status date: 2026-06-16

Reviewed against:
- Branch: `experiments`
- Commit: `ce153f9e894566a22606046f9dcece80eadb7523`

## Accepted Or Already Addressed

- Grok's D-0005 summary aligns with the current design: queue state is explicit, notification reads are non-destructive, ack is exact-prefix only after delivery evidence, and effectful jobs block automatic replay without completion evidence.
- Stale ready-list queue entries should not be claimable unless the job hash still says `status=queued`.
  - Addressed in `053b456`.
- Forwarded headers should be rejected when `DIZZY_TRUSTED_PROXIES` is configured and the immediate peer is not trusted.
  - Addressed in `053b456`.
- Backup snapshots should carry integrity evidence and restore should verify before touching runtime state.
  - Addressed in `053b456`.
- Critical JSONL append paths should flush the file descriptor.
  - Addressed in `ef6b015`.
- SQLite should remain experimental until multi-worker recovery, migration, checkpoint, and crash evidence exist.
  - Current design already keeps SQLite non-authoritative.

## Rejected Or Deferred

### Implementation lag versus high-scale production semantics

Grok is right that the implementation is strongest for single-operator, local-first use. The current repo should not be represented as high-scale, multi-tenant hosted infrastructure.

Accepted framing:
- Queue notification ack now has explicit Lua atomicity documentation and out-of-prefix safety coverage.
- Full queue transition scripting remains deferred pending focused failure tests.
- SQLite recovery does not mirror Redis and should not, yet, because SQLite is experimental and non-authoritative.
- Proxy defaults are safe for local-first use and stricter when trusted proxies are configured; exposed hosted deployments still require topology-specific review.
- Full client lifecycle, tenant isolation, billing-grade audit, and hosted account management remain future product work.

### Notification ack race claim

Grok's stated race has a false premise: Redis Lua scripts execute atomically. The current `acknowledgeNotifications` script performs `LRANGE`, receipt comparison, and `LTRIM` in one Redis script, so a SHA mismatch cannot partially trim the queue.

The real tradeoff is exact-prefix semantics. If Telegram delivery fails for the head notification, later notifications are intentionally not acknowledged ahead of it. This can duplicate later delivery attempts, but it avoids silent ordered-queue deletion.

Follow-up added:
- `lib/queue.mjs` now documents the atomic Lua boundary at `acknowledgeNotifications`.
- Safety checks prove an out-of-prefix receipt does not trim the queue.

Deferred alternatives:
- arbitrary receipt removal from a Redis list
- Redis Streams consumer groups
- durable notification WAL

Those are larger storage/semantics changes and should be justified by production evidence.

### Full Redis transition rewrite

A versioned transition-script rewrite may be valuable later, but it is a broad queue-state-machine change. It should not be bundled with reviewer cleanup unless backed by focused failure tests.

### Enqueue idempotency key

The proposed idempotency lock can poison a key if the process sets the lock but crashes before storing the job-id mapping. A correct design needs atomic creation of the job and idempotency mapping or a recoverable reservation state.

### HTTP maintenance mode

Single-process HTTP maintenance does not stop the worker, relay, direct scripts, or other processes from writing runtime files. It should not be represented as quiescence until every writer is actually gated.

### Master token route restrictions

Changing the master token from operator/admin credential to a restricted token is a policy change. It requires a `DESIGN.md` decision before implementation.

## Current Recommendation

No additional runtime code is required from this Grok pass. The repository remains a good checkpoint. Future useful work would be failure experiments, not broad new architecture:

- notification flood and drain crash/retry simulation
- Redis queue recovery chaos test with real Redis
- proxy topology test behind the intended reverse proxy
- SQLite multi-process experiment while still non-authoritative
