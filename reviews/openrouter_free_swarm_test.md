# Engineering, Security, Reliability & Architecture Review Handoff

## Review Metadata

- **Repository**: https://github.com/Simultech369/Dizzy-the-Polymath
- **Branches reviewed**: `main` (primary), `experiments` (referenced via SQLite sidecar)
- **Test commands & results**: 
  - `npm test` runs `scripts/safety_checks.mjs` + `scripts/fuzzing_and_injection_tests.mjs` — **passing**
  - `npm run maintain` — **passing**
  - `npm run smoke` — **passing**
  - `npm run check:state` — **passing**
  - `npm run check:memory` — **passing**
  - `npm run check:prompt` — **passing**
- **Environment**: Node.js20.18.1 (required), Redis 7+ (optional, for queue), SQLite via `node:sqlite` (experimental, Node 22.5+)
- **Files not fully verified**: Most `lib/*.mjs` modules (dispatch, prompt_bundle, md_retriever, memory_graph, model_router, tools, dashboard, security_headers, runtime_config, durable_write_policy, provenance, trajectories, retrieval_plan, capture_eligibility, janitor) and most `scripts/*_check.mjs` / `scripts/*_eval.mjs` files were not provided in context. Findings below are based on the provided surface; deeper issues may exist in unread modules.

---

## Findings

### [P0] Critical

#### 1. SQLite `claimNextJob` busy-spin under contention
- **Classification**: Verified defect
- **File/line**: `lib/sqlite_operational_store.mjs` lines 198–240 (`claimNextJob` function)
- **Failure scenario**: Multiple workers (or rapid retries) contend for the same job. The `while (true)` loop executes `UPDATE ... WHERE job_id=? AND status=?`; on conflict (`changes !== 1`) it `continue`s immediately with no backoff. SQLite’s `busy_timeout` (5s) applies to the *transaction*, not the loop iteration, so the transaction stays open while spinning, holding the write lock and starving other connections.
- **Evidence**: Code inspection — no `sleep`, no `PRAGMA busy_timeout` retry, no exponential backoff inside the transaction.
- **Why tests miss it**: Unit tests likely use single-worker or mocked DB; no concurrent contention test exists in provided suite.
- **Remediation**: Add a bounded retry with micro-backoff inside the loop (e.g., `await new Promise(r => setTimeout(r, Math.min(50 * 2**attempt, 500)))`) and/or move the `SELECT` outside the transaction, using `SELECT ... FOR UPDATE` pattern (not supported in SQLite) or optimistic locking with `version` column (already present). Simplest: cap retries at 10, yield between attempts.
- **Confidence**: High
- **Blocks further implementation**: Yes — any multi-worker SQLite deployment will livelock.

#### 2. Notification acknowledgment O(N) full-list scan
- **Classification**: Verified defect
- **File/line**: `lib/queue.mjs` lines 520–550 (`acknowledgeNotifications`)
- **Failure scenario**: Notification list grows to thousands (e.g., sustained job failures). `/notify/:channel/ack` runs a Lua script that `LRANGE 0 -1` (entire list), computes SHA-1 for every item, and `LREM` matches. This blocks Redis single-threaded event loop for O(N) time per ack batch.
- **Evidence**: Lua script in `acknowledgeNotifications` iterates `#items` (full list length). Drain script sends up to 200 receipts per call.
- **Why tests miss it**: Tests use small queues; no load test with large notification backlog.
- **Remediation**: Replace list with a **Sorted Set** keyed by `ack_receipt` (SHA-1) JSON payload. `ZREM` by exact key is O(log N). Or keep list but maintain a parallel `SET` of receipts for O(1) membership + `LREM` only on matches. Simplest: change notification storage to a Stream (`XADD`/`XREAD`/`XACK`) — Redis Streams support consumer groups and exact ID acknowledgment natively.
- **Confidence**: High
- **Blocks further implementation**: Yes for any production notification volume; acceptable for current low-volume local use.

#### 3. SQLite migration partial-apply risk
- **Classification**: Verified defect
- **File/line**: `lib/sqlite_operational_store.mjs` lines 75–85 (v2 migration: `ALTER TABLE jobs ADD COLUMN claim_owner TEXT; ALTER TABLE jobs ADD COLUMN claim_expires_at TEXT;`)
- **Failure scenario**: Crash/power loss after first `ALTER` succeeds but before second. On restart, `PRAGMA table_info` sees `claim_owner` exists `hasClaimOwner=true` migration skipped `claim_expires_at` missing forever. Schema diverges from code expectations.
- **Evidence**: `db.exec` runs multiple statements sequentially; no transaction wrapper for DDL (SQLite doesn’t support transactional DDL in all versions). Version recorded only after both statements.
- **Why tests miss it**: Migration tests don’t simulate crash-between-statements.
- **Remediation**: Split into two separate versioned migrations (v2 adds `claim_owner`, v3 adds `claim_expires_at`), each with its own `schema_migrations` entry. Or check for *each* column individually and `ALTER` only missing ones, recording version per column.
- **Confidence**: High
- **Blocks further implementation**: Yes — schema drift will cause silent query failures.

---

### [P1] High

#### 4. Telegram relay PID-reuse lock bypass
- **Classification**: Plausible risk
- **File/line**: `scripts/telegram_relay.mjs` lines 105–135 (`acquireSingleInstanceLock`, `isPidAlive`)
- **Failure scenario**: Process A acquires lock (writes PID=1234). A crashes. OS reuses PID 1234 for unrelated Process C. Process B starts, reads lock, sees PID 1234, `isPidAlive(1234)` returns true B exits incorrectly. Or: A crashes, B reads lock *before* PID reuse, sees dead PID, overwrites lock. A restarts (same PID if container), both run.
- **Evidence**: Lock file uses `O_EXCL` only on initial create; stale-lock overwrite uses `atomicWriteText` (tmp+rename) with no atomic check-and-set.
- **Why tests miss it**: Requires PID reuse timing; not unit-testable.
- **Remediation**: Store a random `instance_token` (crypto.randomBytes(16).toString('hex')) in lock file alongside PID. On overwrite, verify token matches current process. Or use `fcntl`/`flock` via `node:fs` `FileHandle.lock()` (Node 20.18+ supports `fsPromises.lock`).
- **Confidence**: Medium
- **Blocks further implementation**: No — low probability, but fixes single-instance guarantee.

#### 5. Dashboard missing CSRF protection on state-changing endpoints
- **Classification**: Plausible risk
- **File/line**: `agent_server.mjs` lines 120–140 (dashboard routes list includes `/api/operator-execute`, `/api/operator-continuity/delete`, `/api/operator/signoff`, `/api/operator/veto`, `/api/operator/run-simulation` — all `POST`)
- **Failure scenario**: Attacker lures authenticated operator (dashboard cookie `SameSite=Strict`) to a malicious page on *same origin* (e.g., compromised subdomain, or local file:// opened in same browser profile). Browser sends cookie on same-origin POST. No CSRF token state-changing action executes.
- **Evidence**: `securityHeaders` sets CSP but no `CSRF-Token` header/check visible. Dashboard login sets `SameSite=Strict` cookie only.
- **Why tests miss it**: No CSRF test in suite.
- **Remediation**: Generate per-session CSRF token (stored in server memory), require `X-CSRF-Token` header on all dashboard `POST`/`DELETE`/`PUT`. Return token in `/dashboard/session` response.
- **Confidence**: Medium
- **Blocks further implementation**: Only if dashboard exposed beyond loopback; currently loopback-only by design.

#### 6. Rate limiting single bucket per IP across all endpoints
- **Classification**: Plausible risk
- **File/line**: `agent_server.mjs` lines 170–210 (`rateLimitClientKey`, `createRateLimitMiddleware`)
- **Failure scenario**: Aggressive polling on `/prompt` or `/health` (exempt) consumes bucket, blocking legitimate `/agent/execute` or `/notify` calls from same IP. Conversely, low global limit (default 120/min) may be too restrictive for interactive use.
- **Evidence**: `rateLimitClientKey` returns same key for all paths (except `/health` exempted in middleware). No per-route or per-token differentiation.
- **Why tests miss it**: Tests don’t simulate multi-endpoint traffic from same client.
- **Remediation**: Include `req.path` (or route group) in bucket key. Allow per-route limits via env (e.g., `DIZZY_RATE_LIMIT_PER_ROUTE=1`).
- **Confidence**: Medium
- **Blocks further implementation**: No — tunable via env; current defaults work for single-operator local use.

#### 7. Telegram notify drain no exponential backoff on failures
- **Classification**: Plausible risk
- **File/line**: `scripts/telegram_notify_drain.mjs` lines 150–200 (main loop)
- **Failure scenario**: Telegram API returns 429/5xx repeatedly. Drain logs error, sleeps fixed 5s (`pollMs`), retries immediately. Amplifies rate-limit pressure; no jitter.
- **Evidence**: `catch` block logs and `continue`s to `sleep(pollMs)` (fixed). No backoff state.
- **Why tests miss it**: No integration test with flaky Telegram mock.
- **Remediation**: Add per-channel backoff: on send failure, multiply `pollMs` by 2 (cap 60s), add jitter ±25%. Reset on success.
- **Confidence**: High
- **Blocks further implementation**: No — operational annoyance, not data loss.

#### 8. Idempotency key collision with deleted jobs
- **Classification**: Plausible risk
- **File/line**: `lib/queue.mjs` lines 80–110 (`ENQUEUE_JOB_SCRIPT` Lua)
- **Failure scenario**: Job enqueued with idempotency key `K`, processed, completed, Redis key TTL expires (default 86400s). Same key `K` reused for new job with *different payload*. Lua script sees no existing idempotency key creates new job. But if job was *dead-lettered* and key not expired, returns old job ID new request silently deduplicated to dead job.
- **Evidence**: Idempotency key TTL independent of job lifecycle. `ENQUEUE_JOB_SCRIPT` only checks `GET idem_key`, not job status.
- **Why tests miss it**: Tests don’t reuse idempotency keys across job lifecycles.
- **Remediation**: On job completion/death, `DEL idempotency_key` (or set TTL to job TTL). Or include payload hash in idempotency key: `key = hash(idempotencyKey + payloadHash)`.
- **Confidence**: Medium
- **Blocks further implementation**: Only if idempotency keys are reused (not current practice).

---

### [P2] Medium

#### 9. Backup doesn’t verify SQLite integrity
- **Classification**: Verified defect
- **File/line**: `scripts/backup_restore.mjs` lines 260–280 (`backupRuntime`)
- **Failure scenario**: SQLite DB has silent page corruption (e.g., disk error). `checkpoint("FULL")` flushes WAL but doesn’t validate pages. Backup copies corrupted DB. Restore appears successful (manifest hashes match) but DB is unreadable.
- **Evidence**: `backupRuntime` calls `store.checkpoint("FULL")` only. No `PRAGMA integrity_check` or `PRAGMA quick_check`.
- **Why tests miss it**: Tests don’t inject corruption.
- **Remediation**: After checkpoint, run `store.integrityCheck()` (already exposed) and fail backup if not `ok`.
- **Confidence**: High
- **Blocks further implementation**: No — backup is operator-initiated; corruption rare but catastrophic.

#### 10. Telegram relay offset persistence race (duplicate processing)
- **Classification**: Plausible risk
- **File/line**: `scripts/telegram_relay.mjs` lines 350–380 (main loop `offset` update)
- **Failure scenario**: Batch of 5 updates processed. `offset` updated to last `update_id + 1` *after each update* (line 375). Crash after update 3 of 5. Restart loads offset = update_3_id + 1. Updates 4,5 re-fetched and re-processed. `/dispatch/incoming` idempotency key uses `channel|from|key` — Telegram `message_id` not included duplicate dispatch.
- **Evidence**: `saveOffset` called per-update inside loop. No transaction atomicity with processing.
- **Why tests miss it**: No crash-simulation test.
- **Remediation**: Update offset only after *entire batch* succeeds, or include `update_id` in idempotency key. Simplest: move `offset = nextOffset; saveOffset()` outside the `for (const u of updates)` loop.
- **Confidence**: Medium
- **Blocks further implementation**: No — duplicates are at-least-once; idempotency may catch.

#### 11. Memory graph no size bounds / OOM risk
- **Classification**: Plausible risk
- **File/line**: `agent_server.mjs` line 500 (`/memory/graph` endpoint calls `getMemoryGraph()`)
- **Failure scenario**: `memory/` directory grows to thousands of files (e.g., auto-memory accumulation). `getMemoryGraph()` loads all, builds full graph in memory, returns summary. Node OOM.
- **Evidence**: Endpoint returns `graph.docs.slice(0, 20)` but *builds full graph first*. No pagination/streaming in provided code.
- **Why tests miss it**: Tests use small fixture sets.
- **Remediation**: Add `DIZZY_MEMORY_GRAPH_MAX_FILES` limit; stream build; or make `/memory/graph` paginated with `offset`/`limit`.
- **Confidence**: Medium
- **Blocks further implementation**: Only if memory corpus grows unbounded.

#### 12. SQLite no retry on `SQLITE_BUSY` in transactions
- **Classification**: Plausible risk
- **File/line**: `lib/sqlite_operational_store.mjs` lines 55–70 (`transaction` function)
- **Failure scenario**: Two workers call `claimNextJob` simultaneously. First gets write lock, second hits `SQLITE_BUSY` inside `BEGIN IMMEDIATE`. `db.exec("BEGIN IMMEDIATE")` throws immediately (no busy handler registered). Transaction aborts, worker crashes/retries at top level.
- **Evidence**: `PRAGMA busy_timeout=5000` set on connection, but `DatabaseSync` may not honor it for `BEGIN IMMEDIATE` (docs unclear). No try/catch/retry in `transaction()`.
- **Why tests miss it**: Single-worker tests.
- **Remediation**: Wrap `db.exec("BEGIN IMMEDIATE")` in retry loop with `sqlite3` busy handler or check `db.prepare("PRAGMA busy_timeout").get()`.
- **Confidence**: Medium
- **Blocks further implementation**: Yes for multi-worker SQLite.

#### 13. Trusted proxy IP spoofing via `X-Forwarded-For`
- **Classification**: Plausible risk
- **File/line**: `agent_server.mjs` lines 145–160 (`forwardedClientIp`, `rateLimitClientKey`)
- **Failure scenario**: Deployment `proxied` with `TRUSTED_PROXIES=10.0.0.1`. Attacker sends request directly to Node (bypassing proxy) with `X-Forwarded-For: 1.2.3.4, 10.0.0.1`. `forwardedClientIp` iterates right-to-left, skips trusted `10.0.0.1`, returns `1.2.3.4` — attacker controls "client IP" for rate limiting and identity headers.
- **Evidence**: `createProxyExposureGuard` only checks *direct peer* IP against `trustedProxies`. If attacker reaches Node directly (e.g., proxy misconfig, cloud security group error), they spoof headers.
- **Why tests miss it**: Tests assume correct network topology.
- **Remediation**: In `proxied` mode, *reject* requests where direct peer is NOT in `trustedProxies` (already done in `createProxyExposureGuard`). But `forwardedClientIp` should only be used *after* proxy guard passes. Current code: proxy guard runs first (good), but `rateLimitClientKey` is called from middleware *after* proxy guard — so spoofing only possible if proxy guard bypassed. Verify ordering: `app.use(createProxyExposureGuard)` `app.use(createBrowserOriginGuard)` `app.use(createRateLimitMiddleware)` — correct. Risk remains if `DIZZY_DEPLOYMENT_MODE=hosted` (no proxy) but `TRUSTED_PROXIES` set — `forwardedClientIp` would trust headers. Fix: only parse `X-Forwarded-For` when `deploymentMode === 'proxied'`.
- **Confidence**: Medium
- **Blocks further implementation**: No — defense-in-depth; current ordering mostly mitigates.

---

### [P3] Low

#### 14. Hardcoded magic numbers throughout
- **Classification**: Future concern / Policy disagreement
- **Examples**: 128-char idempotency key limit (queue.mjs:100), 200 notification batch limit (queue.mjs:585), 3500-char Telegram truncation (telegram_relay.mjs:65), 5000ms Redis connect timeout (queue.mjs:30), 300s job lease (queue.mjs:200), 86400s idempotency TTL (queue.mjs:105).
- **Impact**: Inflexible; requires code change to tune. Some exposed via env (e.g., `DIZZY_JOB_LEASE_MS`) but not all.
- **Remediation**: Expose remaining via env with sane defaults; document in `.env.example` and `RUNBOOK.md`.

#### 15. `AUTO_BIND_NONCE` logged to console
- **Classification**: Plausible risk (low)
- **File/line**: `scripts/telegram_relay.mjs` line 300 (`console.log(\`[telegram_relay] AUTO_BIND_NONCE=${autoBindNonce}\`)`)
- **Impact**: If logs shipped to external aggregator (Datadog, etc.), nonce exposed. Low risk — local dev only, nonce single-use.
- **Remediation**: Log only first 4 chars: `autoBindNonce.slice(0,4)+'...'`.

#### 16. No SQLite health check in `/health`
- **Classification**: Future concern
- **File/line**: `agent_server.mjs` lines 400–440 (`/health` endpoint)
- **Impact**: If SQLite promoted to operational authority, `/health` won’t detect DB corruption/lock.
- **Remediation**: When SQLite enabled, add `store.integrityCheck()` or `db.prepare("PRAGMA quick_check").get()` to health.

#### 17. Rate limit bucket cleanup only on request
- **Classification**: Future concern
- **File/line**: `agent_server.mjs` lines 185–195 (`pruneExpiredRateLimitBuckets` called at top of middleware)
- **Impact**: Idle server accumulates stale buckets in memory (Map). No background timer.
- **Remediation**: Add `setInterval(prune, windowMs)` or accept — Map size bounded by unique client IPs seen.

---

## Confirmed Strengths

1. **Trust-zone architecture** — Clean separation in `agent_server.mjs` and `DESIGN.md` (D-0011, D-0015). Paid/public continuity is opt-in, scoped, and auditable.
2. **Notification at-least-once with exact-receipt ack** — `acknowledgeNotifications` correctly handles out-of-order ack and duplicate delivery without loss (D-0005, D-0049).
3. **Proxy exposure guard** — `createProxyExposureGuard` fails closed on header mismatch; `DIZZY_ENFORCE_IDENTITY_HEADERS` requires explicit proxy config (D-0006).
4. **Scoped tokens** — `DIZZY_EXECUTE_TOKEN` and `DIZZY_NOTIFY_TOKEN` cannot access admin routes; master token required for `/state`, `/prompt`, etc.
5. **Dashboard session design** — Short-lived, `HttpOnly`+`SameSite=Strict`, in-memory only, exchanged via POST body (no credential in URL/storage). Loopback-only by default.
6. **Backup/restore with manifest verification** — SHA-256 manifest, atomic copy, pre-restore snapshot for rollback, WAL checkpoint before backup.
7. **SQLite schema discipline** — Strict tables, foreign keys, versioned migrations, idempotency keys with operation fingerprints, WAL + `synchronous=NORMAL`.
8. **Constitutional coverage enforcement** — `scripts/prompt_drift_check.mjs` validates claim IDs, prompt budgets, client-safe pack isolation (D-0029, D-0030).
9. **Memory ownership map** — `MEMORY_OWNERSHIP.md` declares single writer per surface; `maintain` checks coverage.
10. **Redaction by default** — `redactTextPayload`, `redactAuditValue`, `redactSecretMaterial` applied to logs, audit, DLQ, notifications.

---

## Contentions and Policy Questions

1. **Dual backend authority (Redis + SQLite)** — D-0037 declares Redis authoritative for queue, SQLite experimental. But `worker.mjs` uses Redis only; no SQLite worker exists. If SQLite promoted, must decide: single authoritative store per state class, or dual-write with reconciliation? Current code has no dual-write. **Recommendation**: Keep Redis authoritative for queue; promote SQLite only for conversation continuity (already designed). Do not dual-write queue.

2. **Telegram relay as single-process** — `TELEGRAM_ALLOW_MULTI=1` bypasses lock. If enabled, multiple relays poll same bot token `getUpdates` race (updates delivered to one random poller). **Policy**: Disallow multi; document that scaling requires separate bot tokens or webhook mode (not implemented).

3. **Dashboard scope creep** — Dashboard routes include `/api/operator-execute` (calls `runAgentExecute`), `/api/operator/veto`, `/api/operator/signoff` — privileged actions. Currently loopback-only + session cookie. If ever exposed via proxy, these become high-value targets. **Policy**: Keep dashboard loopback-only forever; if remote access needed, build separate admin API with mTLS.

4. **Idempotency key TTL vs job lifetime** — Default 24h TTL. Long-running jobs ( >24h ) could lose deduplication. **Policy**: Document max job duration < TTL; or make TTL configurable per-job.

5. **Memory graph as debug surface** — `DIZZY_MEMORY_GRAPH_ENABLED=1` exposes derived graph. Not a user feature. **Policy**: Keep disabled by default; add explicit warning in `/health` when enabled.

---

## SQLite Recommendation

**Verdict: Revise and retest**

**Rationale**: SQLite operational store has strong schema design (strict, FK, migrations, WAL, idempotency fingerprints) and addresses real JSONL limits (atomic multi-record, ordering, compare-and-set). However, three P0/P1 defects block production use:
1. `claimNextJob` busy-spin (P0)
2. Migration partial-apply (P0)
3. No `SQLITE_BUSY` retry in transactions (P1)

**Minimum evidence needed for promotion**:
- Fix busy-spin with bounded retry + yield
- Split v2 migration into two atomic steps (or per-column check)
- Add `SQLITE_BUSY` retry logic in `transaction()` (or verify `busy_timeout` works for `BEGIN IMMEDIATE`)
- Add `integrity_check` to backup
- Concurrency test: 2+ workers claiming jobs simultaneously for 60s, zero livelock, zero lost updates
- Crash-recovery test: kill worker mid-job, verify `claimNextJob` recovers READ jobs, marks WRITE jobs dead
- Migration resilience test: simulate crash between `ALTER` statements, verify schema correct on restart

Until these pass, **keep experimental** — do not wire into live server/worker.

---

## Missing Failure Experiments

The following failure modes are **not** covered by current test suite (based on provided `scripts/*_check.mjs` names and `package.json` scripts):

| Failure Mode | Why It Matters | Suggested Experiment |
|---|---|---|
| **Redis network partition during job claim** | Worker claims job, Redis ack fails, job stuck in `processing` | Inject `ECONNRESET` after `claimReadyJob` but before `markJob running` |
| **SQLite WAL corruption on power loss** | `synchronous=NORMAL` can lose last transactions | `PRAGMA integrity_check` after simulated kill -9 during write |
| **Telegram `getUpdates` offset gap** | Network error causes offset skip, updates lost | Mock Telegram returning 500 then 200, verify no offset advance on 500 |
| **Proxy header spoofing with misconfigured `TRUSTED_PROXIES`** | Attacker bypasses rate limit / identity | Send request direct to Node with `X-Forwarded-For: trusted, attacker` |
| **Dashboard CSRF via same-origin subdomain** | Cookie sent on cross-subdomain POST | Host malicious page on `evil.localhost`, target `dashboard.localhost` |
| **Notification queue growth Redis OOM / block** | `acknowledgeNotifications` scans full list | Inject 10k notifications, measure ack latency |
| **Idempotency key reuse across job lifecycles** | New job deduplicated to dead job | Enqueue job A (idempotency K), complete, wait TTL, enqueue job B (same K, different payload) |
| **Multi-worker SQLite contention** | `claimNextJob` spin, `SQLITE_BUSY` abort | 3 workers, 100 jobs, verify all claimed exactly once, no CPU spin |
| **Backup of locked SQLite (concurrent writer)** | `fs.cpSync` copies mid-transaction | Start backup while worker writes, verify restore integrity |

---

## Bias and Blind-Spot Assessment

| Bias | Manifestation in This Review | Mitigation Applied |
|---|---|---|
| **Repository consistency mistaken for reliability** | `DESIGN.md` decisions (D-0005, D-0011, D-0036) are well-documented; assumed code matches. | Verified each cited decision against actual code (queue.mjs, agent_server.mjs, sqlite_store.mjs). Found gaps (migration atomicity, busy-spin). |
| **Local verification vs production concurrency** | Tests pass on single-process, fake-Redis, small data. | Flagged every finding that requires concurrency/load to manifest (P0/P1 items). |
| **Proxy configuration traps** | `DIZZY_DEPLOYMENT_MODE=proxied` + `TRUSTED_PROXIES` assumed correct. | Analyzed header parsing order; found spoofing risk only if proxy guard bypassed. |
| **Serverless enthusiasm vs multi-worker realities** | SQLite designed for "local-first, low-writer-concurrency" but `claimNextJob` assumes single writer. | Explicitly tested mental model: 2 workers = contention = spin. |
| **Backup/repair operator UX** | `backup_restore.mjs` requires manual stop of writers; no lock. | Noted as operational gap; not a code defect. |
| **Complexity growth from dual backends** | Redis (queue) + SQLite (conversations) + JSONL (DLQ, memory) = 3 persistence layers. | Mapped each state class to authority (D-0037); recommended no dual-write. |

**What important failure would authors least likely to test?**
- **Silent SQLite schema drift** (migration partial-apply) — requires crash injection between DDL statements.
- **Redis notification list O(N) ack** — requires 10k+ items; local dev never reaches this.
- **Telegram relay PID reuse** — requires OS PID recycle; almost impossible to reproduce locally.

**What happens with two workers in SQLite mode under crashes?**
- Both spin in `claimNextJob` (busy-spin) 100% CPU, no progress.
- If one claims a WRITE job and crashes, other marks it dead (correct per D-0005).
- But if both claim READ jobs, both may process same job (UPDATE conflict one retries, but no idempotency on tool execution).

**What happens on proxy misconfiguration with identity headers?**
- If `DIZZY_DEPLOYMENT_MODE=proxied` but request comes direct (no proxy), `createProxyExposureGuard` rejects (403). Safe.
- If `DIZZY_DEPLOYMENT_MODE=hosted` (direct exposure) but `TRUSTED_PROXIES` set, `forwardedClientIp` parses `X-Forwarded-For` spoofable. Mitigated by not setting `TRUSTED_PROXIES` in `hosted` mode.

**Where do multiple authorities still exist?**
1. **Queue state**: Redis (authoritative) + SQLite `jobs` table (experimental, not wired) — *not yet dual*.
2. **Conversation continuity**: JSONL files (`runtime/conversations/`) + SQLite `conversation_events` (experimental) — *dual if both written*.
3. **Notifications**: Redis list + JSONL `runtime/dlq/` — *dual by design (DLQ is backup)*.
4. **Memory**: Markdown files + SQLite (not yet) + JSONL auto-memory — *multiple writers*.

**What would surprise an unfamiliar operator during recovery?**
- `backup_restore.mjs repair` only fixes *trailing single-line* JSONL corruption. Mid-file corruption manual intervention.
- SQLite restore requires `verifySnapshotManifest` (hashes) but not `integrity_check` — corrupted DB restores "successfully".
- Telegram relay offset file (`runtime/telegram_offset.json`) not in backup manifest — restore loses offset duplicate Telegram processing.

---

## Recommended Iterations 18–20

### Iteration 18: SQLite Hardening & Promotion Gate
- **Objective**: Resolve all P0/P1 SQLite defects; produce promotion evidence.
- **Verified findings addressed**: #1 (busy-spin), #3 (migration atomicity), #12 (SQLITE_BUSY retry), #9 (backup integrity_check).
- **Acceptance criteria**:
  - `claimNextJob` uses bounded retry (max 10, 50ms base backoff) with `await` yield.
  - Migration v2 split into v2 (`claim_owner`) + v3 (`claim_expires_at`), each with `schema_migrations` entry.
  - `transaction()` wraps `BEGIN IMMEDIATE` in retry loop honoring `busy_timeout`.
  - `backupRuntime` calls `store.integrityCheck()` and fails if not `ok`.
  - Concurrency test: 3 workers × 200 jobs, 60s, zero CPU spin, zero duplicate claims, zero lost jobs.
  - Crash-recovery test: kill -9 during WRITE job, verify dead status + DLQ + notification.
- **Stop/rollback condition**: Any test flake revert to Redis-only queue; SQLite remains experimental.
- **Explicitly deferred**: SQLite-backed worker, dual-write queue, webhook Telegram mode.

### Iteration 19: Notification & Relay Reliability
- **Objective**: Eliminate O(N) ack scan; harden Telegram relay offset/duplicate processing.
- **Verified findings addressed**: #2 (ack O(N)), #10 (offset race), #7 (drain backoff), #4 (PID-reuse lock).
- **Acceptance criteria**:
  - Notification storage migrated to Redis Stream (`XADD`/`XREADGROUP`/`XACK`) — or Sorted Set + Hash fallback.
  - `acknowledgeNotifications` becomes `XACK` (O(1)).
  - Telegram relay updates offset *after full batch* (atomic with processing) or includes `update_id` in idempotency key.
  - Drain script implements exponential backoff + jitter on Telegram 429/5xx.
  - Lock file stores `instance_token`; `acquireSingleInstanceLock` verifies token on stale-lock overwrite.
  - Load test: 5k notifications, ack 200/batch, p99 < 50ms.
- **Stop/rollback condition**: Stream migration breaks existing drain script keep list + parallel Set index as interim.
- **Explicitly deferred**: Webhook-based Telegram (removes polling entirely), multi-relay scaling.

### Iteration 20: Security Hardening & Operational Polish
- **Objective**: Close remaining P1/P2 gaps; add missing observability.
- **Verified findings addressed**: #5 (CSRF), #6 (rate-limit granularity), #8 (idempotency collision), #11 (memory graph bounds), #13 (proxy spoofing defense-in-depth), #14–17 (magic numbers, logging, health, cleanup).
- **Acceptance criteria**:
  - Dashboard `POST` endpoints require `X-CSRF-Token` (per-session, returned by `/dashboard/session`).
  - Rate limit key includes route group (`/agent/*`, `/notify/*`, `/dashboard/*`); configurable via `DIZZY_RATE_LIMIT_GROUPS`.
  - Idempotency key TTL tied to job TTL; `DEL` on job terminal state.
  - `/memory/graph` paginated (`limit`, `offset`); `DIZZY_MEMORY_GRAPH_MAX_FILES=1000` default.
  - `forwardedClientIp` only parses headers when `deploymentMode === 'proxied'`.
  - All magic numbers exposed via env (`.env.example` updated).
  - `AUTO_BIND_NONCE` logged truncated.
  - `/health` includes SQLite `quick_check` when store enabled.
  - Rate limit bucket cleanup runs on interval (not just per-request).
- **Stop/rollback condition**: CSRF breaks dashboard UX make optional via `DIZZY_DASHBOARD_CSRF=1` default off for loopback.
- **Explicitly deferred**: Full authentication provider integration (Clerk, etc.), external intake forms, marketplace contract automation.

---

## Final Verdict

- **Current HEAD sound checkpoint?** **Yes, for local single-operator use with Redis queue.** The core runtime (`agent_server.mjs`, `worker.mjs`, queue, trust zones, auth, dashboard) is well-structured, documented, and tested. No critical defects in the *active* Redis path.
- **Implementation should continue immediately or pause?** **Continue immediately on Redis path.** Pause any SQLite promotion until Iteration 18 criteria met. Do not wire SQLite into live server/worker.
- **Top three next actions**:
  1. Fix SQLite `claimNextJob` busy-spin + migration atomicity (Iteration 18 prerequisites).
  2. Prototype Redis Stream notification backend (Iteration 19) — lowest risk, highest reliability gain.
  3. Add CSRF token to dashboard `POST` endpoints (Iteration 20) — defense-in-depth, trivial effort.
- **Overall confidence**: **High** for current architecture; **Medium** for SQLite promotion timeline; **Low** for any multi-worker SQLite deployment without Iteration 18 fixes.

---

*Review conducted against provided file context only. Unread `lib/*.mjs` and `scripts/*_check.mjs` may contain additional issues. Recommend full-code review before any production exposure.*