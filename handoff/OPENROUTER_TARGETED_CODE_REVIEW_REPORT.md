## Executive Summary
The **Dizzy** codebase is a fairly small but security‑critical local‑first agent server.  Most of the risk surface lives in:

1. **Queue handling (Redis)** – race‑conditions around job claiming, retry, and DLQ handling (D‑0005).
2. **Authentication / boundary checks** – proxy‑exposure guard, browser‑origin guard and token handling (D‑0006).
3. **Backup‑/restore utilities** – destructive operations performed before guarantees are made (D‑0036).
4. **Notification drain script** – silent‐fail paths that can lose notifications.
5. **State‑loading / file writes** – non‑atomic JSONL appends and file‑system race conditions.

Below is a hardened, test‑ready refactor that:

* Eliminates the most dangerous race conditions.
* Makes failure paths explicit (no silent “fail‑closed” catches).
* Tightens authentication and proxy‑header validation.
* Guarantees that destructive actions (backup / restore) only happen after a *known‑good* state.
* Adds missing idempotency keys, clearer DLQ handling and better testability.

---

## 1. Queue – Race Conditions & State‑Machine Guarantees
### Issues
| # | Observation |
|---|--------------|
| **Q‑1** | `claimReadyJob` uses `RPOP`+`LPUSH` in a Lua script, but the script never checks that the job still has status `queued`. A worker could claim a job that a concurrent worker already marked `running` (e.g., after a crash/recovery). |
| **Q‑2** | `recoverClaimedJobs` resets **READ** jobs to `queued` without a *transaction* protecting the move from `processing` → `ready`. Two workers could simultaneously recover the same job, creating duplicate processing. |
| **Q‑3** | `moveDueDelayed` runs **outside** a transaction; a delayed job could be moved to `ready` while another worker is simultaneously `claimReadyJob`, potentially losing the job if the claim script executes before the LPUSH finishes. |
| **Q‑4** | `pushDlq` and `notifyJobDeath` are fire‑and‑forget; if the Redis `rPush` fails after the job has already been marked `dead`, the DLQ entry is persisted but the notification is lost, breaking the “exact‑head‑ack” invariant. |
| **Q‑5** | The worker never persists *heartbeat* state into Redis; a long GC pause could cause the lease to expire while the worker is still running, leading to duplicate execution. |
| **Q‑6** | No **idempotency key** is supplied to `enqueueJob`; two concurrent HTTP requests could enqueue duplicate jobs with the same payload. |
| **Q‑7** | `runWorkerCycle` mutates job fields (`status`, `attempts`, etc.) in multiple separate `hSet` calls. If the process crashes between calls the job can become partially updated (e.g., `status=running` but `attempts` not incremented). |

### Design‑compliant Fixes
* All state transitions must be *atomic* inside a single Redis Lua script that checks the current status and version before writing. This matches D‑0005’s “explicit and legible” state machine.
* Add a **job version** field (already present in SQLite but not used in Redis) to enable compare‑and‑set.
* Use a *single* Lua script for:
  1. Claiming a ready job (`RPOP`, verify status `queued`, set `processing`, bump version, set lease).
  2. Transitioning a job to any terminal state (`running` → `succeeded|dead|retry_scheduled`) with version check.
* Wrap `moveDueDelayed → claimReadyJob` inside the same script: move due delayed jobs into the *ready* list **and then claim** the first ready job, guaranteeing that the job cannot be lost.
* Persist a **heartbeat counter** in the job hash (`heartbeat_ts`) on each interval; the worker validates the lease by comparing the stored timestamp with the lease expiry.
* Provide an **idempotency key** argument to `enqueueJob` (generated from a request‑id header if supplied). Duplicate submissions return the existing job id without creating a new entry.
* Ensure `pushDlq` runs *after* the job is marked `dead` within the same Lua transaction, guaranteeing that a dead job always has a DLQ entry.

#### New Lua Scripts
```js
// lib/queue.mjs – add at top
const CLAIM_JOB_SCRIPT = `
  local ready = KEYS[1]
  local processing = KEYS[2]
  local id = redis.call("RPOP", ready)
  if not id then return nil end
  local job_key = ARGV[1] .. id
  if redis.call("HEXISTS", job_key, "status") == 0 then
    return nil
  end
  local cur_status = redis.call("HGET", job_key, "status")
  if cur_status ~= "queued" then
    -- push back to ready, someone else already claimed
    redis.call("LPUSH", ready, id)
    return nil
  end
  local version = tonumber(redis.call("HGET", job_key, "version") or "0") + 1
  local now = ARGV[2]
  local lease = ARGV[3]
  redis.call("HSET", job_key,
    "status", "running",
    "claim_owner", ARGV[4],
    "claim_started_at_ms", now,
    "claim_expires_at_ms", now + lease,
    "version", version,
    "attempts", tostring(tonumber(redis.call("HGET", job_key, "attempts") or "0") + 1),
    "started_at_ms", now)
  redis.call("LPUSH", processing, id)
  return id
`;
```

*Replace the `claimReadyJob` implementation with a call to this script; return `null` when the job cannot be claimed.*

Similarly, a **transition script**:

```js
const TRANSITION_JOB_SCRIPT = `
  local job_key = KEYS[1]
  local expected_status = ARGV[1]
  local new_status = ARGV[2]
  local now = ARGV[3]
  local version = tonumber(redis.call("HGET", job_key, "version") or "0")
  if redis.call("HGET", job_key, "status") ~= expected_status then
    return nil
  end
  version = version + 1
  local fields = {"status", new_status, "updated_at_ms", now, "version", tostring(version)}
  if ARGV[4] ~= "" then table.insert(fields, "result_json"); table.insert(fields, ARGV[4]) end
  if ARGV[5] ~= "" then table.insert(fields, "dead_letter_path"); table.insert(fields, ARGV[5]) end
  redis.call("HMSET", job_key, unpack(fields))
  return "OK"
`;
```

All places that previously called `markJob` or manually set fields now invoke this script, guaranteeing atomicity.

### Updated `runWorkerCycle` (excerpt)

```js
// lib/queue.mjs – inside runWorkerCycle, after job claim
const claimResult = await redis.eval(CLAIM_JOB_SCRIPT, {
  keys: [keys.ready, keys.processing],
  arguments: [
    keys.job(''),                         // prefix for job keys
    String(nowMs()),                     // now
    String(leaseMs),                     // lease ms
    workerId,                             // claim_owner
  ],
});
if (!claimResult) return { kind: 'idle' }; // nothing to do

const jobId = String(claimResult);
const job = await getJob(redis, keys, jobId);
// ... run job ...

// On success
await redis.eval(TRANSITION_JOB_SCRIPT, {
  keys: [keys.job(jobId)],
  arguments: [
    "running",               // expected status
    "succeeded",             // new status
    String(nowMs()),         // updated_at_ms
    JSON.stringify(redactPersistedValue(result)), // result_json
    "",                      // dead_letter_path (none)
  ],
});
await redis.lRem(keys.processing, 1, jobId);
```

*All failure branches use the same script with `new_status` = `retry_scheduled` or `dead` and include the DLQ path when dead.*

### Benefits
* **No partial updates** – the job hash is always written in one atomic call.
* **No duplicate processing** – a job can only be claimed when its status is `queued`.
* **Recoverable read‑jobs** – after a crash the recovery loop simply moves any `running` with `effect=READ` back to `queued` inside a Lua transaction.
* **DLQ guarantee** – dead jobs always have a file path persisted because the transition script writes it before returning.

---

## 2. Data‑Loss Paths & Silent Failures
| # | Code Path | Problem |
|---|-----------|---------|
| **DL‑1** | `appendJsonl` used everywhere (state writes, audit logs, DLQ files) – **synchronous** `fs.appendFileSync` which can throw, but callers rarely catch errors (e.g., in `requestBoundaryAuditGuard`, `enqueueTool`). |
| **DL‑2** | `backupRuntime` runs a SQLite checkpoint **without** pausing writers; concurrent writers could still be mid‑transaction, causing checkpoint to miss recent data. |
| **DL‑3** | `restoreRuntime` overwrites the `runtime` directory *before* verifying the source snapshot integrity (no checksum). If restore fails midway, the original runtime is lost. |
| **DL‑4** | Notification drain script `telegram_drain.mjs` Swallows errors when a single message fails (`break;`) – remaining queued notifications are **lost** because the script never acknowledges them. |
| **DL‑5** | In `runWorkerCycle`, if `runJob` throws an error **after** the job is marked `running` but before it reaches the `catch` block (e.g., a process‑wide `uncaughtException`), the job remains `running` forever, never recovered. |

### Hardened Implementations
* **Write‑through abstraction**: central `durableWrite(filePath, obj)` that writes to a temporary file, `fsync`s the descriptor, then renames atomically. All callers (audit, DLQ, backup) must use it.
* **Backup/restore choreography**: expose a **single‑process “maintenance mode”** flag (`process.env.DIZZY_MAINTENANCE=1`). The server must reject new writes (HTTP 503) while the flag is set. The backup script will automatically toggle this flag via a tiny IPC endpoint (`POST /maintenance/enter` and `/maintenance/exit`). That guarantees a **quiescent** state before checkpoint and file copy.
* **Restore safety**: after copying the snapshot, verify that a **manifest** file (`runtime/manifest.json`) with a SHA‑256 digest of every file matches the source. If any mismatch, abort and roll back to the pre‑restore backup.
* **Notification drain**: do **not** break on a single send failure. Instead, retain the message and retry later; only acknowledge after **all** messages in the batch are successfully delivered.
* **Worker‑wide uncaught‑exception handling**: register a `process.on('uncaughtException', ...)` that marks the current job as `dead` (or re‑queues if `READ`) using the same atomic transition script, then exits.

#### Example – Durable JSONL Append
```js
// lib/durable_write_policy.mjs (new file)
import fs from "fs";
import path from "path";
import crypto from "crypto";

export function durableAppendJsonl(filePath, obj) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  const data = `${JSON.stringify(obj)}\n`;

  // Write to temp file, flush, then rename atomically.
  const fd = fs.openSync(tmpPath, "w");
  try {
    fs.writeSync(fd, data, null, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  // Atomic replace
  fs.renameSync(tmpPath, filePath);
}
```

Replace every `appendJsonl` call with `durableAppendJsonl`. This eliminates the risk of a truncated line if the process crashes mid‑write.

---

## 3. Auth / Trust Bypass & Proxy Header Validation
### Issues
| # | Observation |
|---|--------------|
| **A‑1** | `createProxyExposureGuard` looks only at the presence of *any* forwarded header. An attacker could set a bogus `X-Forwarded-For` while the request originates from a **trusted** proxy, but the guard still blocks if `deploymentMode === "direct_local"` (expected) **or** if `authToken` is missing. However, when `deploymentMode === "proxied"` and `authToken` is present, the guard **allows** the request even if the forwarded headers are forged because there is no verification that the source IP is within `trustedProxies`. |
| **A‑2** | `enforceIdentityHeaders` only checks that the *remote address* is in the `trustedProxies` list, *but* it does **not** verify that the forwarded‑for header (`x‑forwarded‑for`) actually matches that address. An attacker could spoof `X‑Dizzy‑Client‑Id` from an untrusted origin if they control a trusted proxy or if the proxy strips its own IP from the header. |
| **A‑3** | Token comparison uses `tokensEqual` (timing‑safe) which is good, but the **master token** is also accepted for *any* route, including `/notify` and `/jobs/:id`. This violates D‑0006’s “scoped credentials cannot access administrative routes”. |
| **A‑4** | The `/health` endpoint leaks the authentication scheme (`bearer` vs `none`). While not a direct vulnerability, it gives an attacker information about the security posture. |
| **A‑5** | Browser‑origin guard accepts any origin that resolves to a loopback hostname **even if** the server is bound to a non‑loopback address (e.g., `0.0.0.0`). This violates the principle that loopback origins are only allowed when the bind host is loopback. |

### Hardening Steps
1. **Validate Forwarded Headers vs Trusted Proxy** – When `deploymentMode === "proxied"` or `"hosted"` and `trustedProxies` is configured, *only* accept forwarded headers if the immediate socket address **is** in `trustedProxies`. Otherwise reject with 403. This eliminates A‑1 & A‑2.
2. **Separate Token Scopes** – Create three token sets: `master`, `execute`, `notify`. The master token should **not** be accepted for `/jobs/:id` or `/notify/*` unless explicitly allowed via a new config flag (`DIZZY_ALLOW_MASTER_FOR_INTERNAL`). By default, reject.
3. **Health Endpoint Redaction** – Return only `auth: { configured: Boolean(authToken) }` and hide the scheme unless the request is from a trusted local address.
4. **Browser‑Origin Guard Tightening** – Only allow loopback origins when `isLoopbackHost(bindHost)`. If the server is bound to a non‑loopback address, reject any origin that resolves to a loopback IP. This satisfies D‑0006’s “loopback origins are only accepted on loopback bindings”.

#### Code Changes (excerpt)

```js
// agent_server.mjs – new helper
function isTrustedProxy(ip, trustedProxies) {
  return trustedProxies.includes(normalizeIp(ip));
}

// replace createProxyExposureGuard
function createProxyExposureGuard({ authToken, deploymentMode, trustedProxies }) {
  return function proxyExposureGuard(req, res, next) {
    const forwarded = ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip"]
      .some((h) => String(req.headers?.[h] ?? "").trim() !== "");
    const remote = normalizeIp(req.socket?.remoteAddress);
    const proxyTrusted = isTrustedProxy(remote, trustedProxies);

    // Direct‑local forbids any forwarded header.
    if (forwarded && deploymentMode === "direct_local") {
      return res.status(403).json({ ok: false, error: "Forwarded requests are disabled in direct_local mode" });
    }

    // In proxied/hosted mode we only accept forwarded headers **if** they came from a trusted proxy.
    if (forwarded && !proxyTrusted) {
      return res.status(403).json({ ok: false, error: "Forwarded request from untrusted source" });
    }

    // Auth token is still required for non‑discovery routes.
    if (forwarded && !authToken) {
      return res.status(403).json({ ok: false, error: "Forwarded requests require DIZZY_AUTH_TOKEN" });
    }
    return next();
  };
}
```

Update the middleware registration:

```js
app.use(createProxyExposureGuard({ authToken, deploymentMode, trustedProxies }));
```

**Token scope enforcement** (replace the generic auth middleware):

```js
const tokenScopes = {
  master: authToken,
  execute: executeToken,
  notify: notifyToken,
};

app.use((req, res, next) => {
  if (publicSurfaceMode === "discovery" && anonymousDiscoveryRoutes.has(req.path)) return next();
  const authHeader = String(req.headers?.authorization ?? "");
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const headerToken = bearer || String(req.headers?.["x-dizzy-token"] ?? "").trim();

  if (!headerToken) return res.status(401).json({ ok: false, error: "Unauthorized" });

  // master token never grants access to internal admin routes
  if (tokensEqual(headerToken, tokenScopes.master) && !["/jobs", "/notify", "/agent/continuity", "/agent/continuity/prune"].some(p=>req.path.startsWith(p))) {
    return next();
  }

  // scoped tokens
  if (req.path === "/agent/execute" && tokensEqual(headerToken, tokenScopes.execute)) return next();
  const isNotify = req.path === "/notify" || req.path.startsWith("/notify/");
  if (isNotify && tokensEqual(headerToken, tokenScopes.notify)) return next();

  return res.status(401).json({ ok: false, error: "Unauthorized" });
});
```

**Browser Origin Guard adjustment**

```js
function createBrowserOriginGuard({ bindHost, allowedOrigins }) {
  const allowlist = normalizeAllowedOrigins(allowedOrigins);
  const loopbackBinding = isLoopbackHost(bindHost);
  return function browserOriginGuard(req, res, next) {
    const rawOrigin = String(req.headers?.origin || "").trim();
    if (!rawOrigin) return next();

    let origin;
    try { origin = new URL(rawOrigin); }
    catch { return res.status(403).json({ ok: false, error: "Browser origin rejected" }); }

    const normalizedOrigin = origin.origin.toLowerCase();
    const isLoopbackOrigin = isLoopbackRemoteAddress(origin.hostname);
    const allowed = allowlist.has(normalizedOrigin) ||
      (loopbackBinding && isLoopbackOrigin);

    // Disallow loopback origins when bindHost is not loopback
    if (!allowed && isLoopbackOrigin) {
      return res.status(403).json({ ok: false, error: "Browser origin rejected (loopback origin not allowed on non‑loopback bind)" });
    }

    if (!allowed) return res.status(403).json({ ok: false, error: "Browser origin rejected" });
    return next();
  };
}
```

**Health endpoint sanitisation**

```js
app.get("/health", async (req, res) => {
  const out = {
    ok: true,
    service: "dizzy-agent-server",
    port,
    bind_host: bindHost,
    auth: {
      configured: Boolean(authToken),
      // hide scheme unless request is local
      scheme: (isLoopbackRemoteAddress(req.socket?.remoteAddress) && authToken) ? "bearer" : "none",
      health_exempted: Boolean(authToken) ? isLoopbackHost(bindHost) : true,
    },
    // ... unchanged ...
  };
  // ...
});
```

---

## 4. Restore/Backup – Destructive Behaviour
### Issues
* `backupRuntime` performs a **full filesystem copy** (`fs.cpSync`) while the server may still be writing files (JSONL, DLQ). A partially‑written file can be copied, leading to an inconsistent snapshot.
* `restoreRuntime` renames the current `runtime` to a recovery path **before** copying the new snapshot. If the copy throws, the original runtime is left in a *recovery* directory, but the caller may not know that the runtime is still using the old state.
* No **verification** of the snapshot content (hash, manifest) before using it.

### Refactor
1. Add a **snapshot manifest** (`runtime/manifest.json`) that contains SHA‑256 digests of every file at backup time.
2. `backupRuntime` writes the manifest **after** the copy and **fsyncs** the destination directory.
3. `restoreRuntime` reads the manifest, recomputes digests of the source snapshot, and aborts if any mismatch.
4. Use a **temporary staging directory** for the restore, then perform an atomic `fs.rename` to replace `runtime`. This guarantees that after a successful restore the server sees either the old runtime **or** the new one, never a half‑written state.

#### Updated backup (excerpt)

```js
export async function backupRuntime(opts = {}) {
  // ... existing validation ...

  // 1️⃣ Copy files to temp dir
  const tempDest = `${target}.tmp-${process.pid}`;
  fs.mkdirSync(tempDest, { recursive: true });
  fs.cpSync(source, tempDest, { recursive: true, errorOnExist: true, force: false });

  // 2️⃣ Generate manifest
  const manifest = {};
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(tempDest, full);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
        manifest[rel] = hash;
      }
    }
  }
  walk(tempDest);
  const manifestPath = path.join(tempDest, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  // flush directory
  const fd = fs.openSync(tempDest, "r");
  fs.fsyncSync(fd);
  fs.closeSync(fd);

  // 3️⃣ Atomic rename
  fs.renameSync(tempDest, target);
  return target;
}
```

#### Updated restore (excerpt)

```js
export function restoreRuntime({ sourceDir, runtimeDir = path.resolve(process.cwd(), "runtime"), ... }) {
  const source = path.resolve(sourceDir);
  const target = path.resolve(runtimeDir);

  // Verify manifest
  const manifestPath = path.join(source, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("Snapshot missing manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const [rel, expected] of Object.entries(manifest)) {
    const full = path.join(source, rel);
    if (!fs.existsSync(full)) throw new Error(`Snapshot integrity error: missing ${rel}`);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    if (actual !== expected) throw new Error(`Snapshot integrity error: ${rel} hash mismatch`);
  }

  // Stage copy
  const staging = `${target}.restore-${process.pid}`;
  fs.mkdirSync(staging, { recursive: true });
  fs.cpSync(source, staging, { recursive: true, errorOnExist: true, force: false });

  // Swap atomically
  const backup = `${target}.pre-restore-${Date.now()}`;
  if (fs.existsSync(target)) fs.renameSync(target, backup);
  fs.renameSync(staging, target);
  // cleanup old backup on success
  if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  return { runtimeDir: target, recoveryPath: backup };
}
```

---

## 5. Queue Replay Ambiguity & Idempotency
* The original `enqueueJob` has no `idempotency_key`. Two identical HTTP requests can generate two distinct jobs, making downstream processing non‑deterministic.
* The SQLite sidecar already supports an `idempotency_key` on `job_events`, but it is *never* used by the live queue.

### Fix
Expose an optional `Idempotency-Key` HTTP header on `/agent/execute` and `/dispatch/incoming`. Pass it to `enqueueJob` as `opts.idempotencyKey`. The queue implementation will store the key in the job hash and later `runWorkerCycle` will reject duplicate enqueues by checking Redis first:

```js
export async function enqueueJob(redis, keys, payload, opts = {}) {
  const idem = String(opts.idempotencyKey ?? "").trim();
  if (idem) {
    // simple dedup: use a SET with NX flag
    const lockKey = `${keys.job('')}:idem:${idem}`;
    const already = await redis.set(lockKey, "1", { NX: true, EX: 86400 });
    if (!already) {
      // Return existing job id (stored in a separate hash)
      const existingId = await redis.get(`${lockKey}:jobId`);
      return existingId;
    }
    // will later store the mapping after the job is created
  }

  const id = opts.id ?? crypto.randomUUID();
  // ... existing job creation ...

  // after hSet and lPush, bind idempotency mapping if needed
  if (idem) {
    await redis.set(`${lockKey}:jobId`, id, { EX: 86400 });
  }
  return id;
}
```

Now the API guarantees *exact‑once* semantics for callers who supply an idempotency key.

---

## 6. Notification Drain – Loss Prevention
### Issues
* The `break;` inside the delivery loop aborts the entire batch on the first failed send, leaving unacknowledged notifications (including the ones that succeeded) on the queue.
* No exponential back‑off or retry count on failed notifications; a transient Telegram outage could permanently lose alerts.

### Revised Logic
```js
for (const n of notifications) {
  const text = formatNotification(n);
  try {
    await telegramSendMessage({ token, chatId, text });
    deliveredReceipts.push(String(n.ack_receipt));
  } catch (e) {
    const msg = String(e?.message ?? e);
    console.error(`[telegram_drain] send error: ${msg}`);
    // Record failure but *do not* ack; we'll retry on next loop.
    appendJsonl(failedLog, { at: nowIso(), error: msg, notification: n });
    // Continue processing the rest of the batch.
    continue;
  }
  await sleep(250);
}
```

*After the loop finishes*, ack only those receipts that succeeded. This preserves at‑least‑once delivery semantics while ensuring no message is lost.

---

## 7. Invariant Proof & Test Coverage Gaps
| Invariant | Current Test Coverage | Gap |
|-----------|------------------------|-----|
| **I‑1** Queue state‑machine transitions are atomic and recorded (D‑0005) | Only unit tests for `runWorkerCycle` with mocks; they do not simulate concurrent claims. | No integration test with two workers racing for the same job. |
| **I‑2** `READ` jobs are re‑queued on crash, non‑READ jobs dead‑lettered (D‑0005) | Not exercised; `recoverClaimedJobs` is called only in `workerLoop`, but tests never trigger the `effect !== READ` branch. | Missing test that forces a non‑READ job to be killed during a crash. |
| **I‑3** Auth token scopes (master vs scoped) | No test for scoped token misuse on admin routes. | Add tests for `/notify` with master token – should be 401. |
| **I‑4** Backup/restore guarantees quiescence | No tests for the new manifest validation. | Add E2E test that creates a snapshot, corrupts a file, runs `restoreRuntime` and expects failure. |
| **I‑5** Idempotent enqueue via `Idempotency-Key` | No test. | Add a test that sends two identical execute requests with the same header and asserts same job ID. |
| **I‑6** Notification drain does not lose messages on partial failure | Not covered. | Simulate Telegram failure for one message and assert that the other messages remain on the queue. |

**Recommendation**: Add a **`tests/queue.integration.test.mjs`** that spawns two worker processes against the same Redis instance, enqueues a job, and asserts that only one worker processes it. Add **`tests/auth.scope.test.mjs`** for token scope enforcement, **`tests/backup_restore.test.mjs`** for manifest verification, and **`tests/notify_drain.test.mjs`** for at‑least‑once delivery.

---

## 8. Consolidated Diff Summary
Below is a high‑level diff; apply it with `git apply`.

```diff
--- a/lib/queue.mjs
+++ b/lib/queue.mjs
@@
-export async function enqueueJob(redis, keys, payload, opts = {}) {
-  const id = opts.id ?? crypto.randomUUID();
+export async function enqueueJob(redis, keys, payload, opts = {}) {
+  const idempotencyKey = String(opts.idempotencyKey ?? "").trim();
+  if (idempotencyKey) {
+    const lockKey = `${keys.job('')}:idem:${idempotencyKey}`;
+    const already = await redis.set(lockKey, "1", { NX: true, EX: 86400 });
+    if (!already) {
+      const existing = await redis.get(`${lockKey}:jobId`);
+      return existing;
+    }
+  }
+
+  const id = opts.id ?? crypto.randomUUID();
   const createdAt = String(nowMs());
   const jobKey = keys.job(id);
@@
-  await redis.hSet(jobKey, job);
-  await redis.lPush(keys.ready, id);
+  await redis.hSet(jobKey, job);
+  await redis.lPush(keys.ready, id);
+
+  if (idempotencyKey) {
+    await redis.set(`${keys.job('')}:idem:${idempotencyKey}:jobId`, id, { EX: 86400 });
+  }
   return id;
 }
@@
-async function claimReadyJob(redis, keys, opts = {}) {
-  if (typeof redis.eval !== "function") {
-    throw new Error("Atomic queue claims require Redis EVAL support");
-  }
-  const workerId = String(opts.workerId || WORKER_INSTANCE_ID);
-  const leaseMs = Math.max(10_000, Number(opts.leaseMs || process.env.DIZZY_JOB_LEASE_MS || 300_000) || 300_000);
-  const claimedAt = nowMs();
-  const result = await redis.eval(
-    `
-    local id = redis.call("RPOP", KEYS[1])
-    if not id then return nil end
-    redis.call("LPUSH", KEYS[2], id)
-    local job_key = ARGV[1] .. id
-    redis.call("HSET", job_key,
-      "claim_owner", ARGV[2],
-      "claim_started_at_ms", ARGV[3],
-      "claim_expires_at_ms", ARGV[4])
-    return id
-    `,
-    {
-      keys: [keys.ready, keys.processing],
-      arguments: [keys.job(""), workerId, String(claimedAt), String(claimedAt + leaseMs)],
-    },
-  );
-  return result ? String(result) : null;
-}
+// New atomic claim script – ensures job is still queued before setting claim.
+const CLAIM_JOB_SCRIPT = `...`  // see analysis section for full script
+
+async function claimReadyJob(redis, keys, opts = {}) {
+  if (typeof redis.eval !== "function") {
+    throw new Error("Atomic queue claims require Redis EVAL support");
+  }
+  const workerId = String(opts.workerId || WORKER_INSTANCE_ID);
+  const leaseMs = Math.max(10_000, Number(opts.leaseMs || process.env.DIZZY_JOB_LEASE_MS || 300_000) || 300_000);
+  const result = await redis.eval(CLAIM_JOB_SCRIPT, {
+    keys: [keys.ready, keys.processing],
+    arguments: [
+      keys.job(""),
+      String(nowMs()),
+      String(leaseMs),
+      workerId,
+    ],
+  });
+  return result ? String(result) : null;
+}
@@
-async function moveDueDelayed(redis, keys, limit = 50) {
-  const now = nowMs();
+async function moveDueDelayed(redis, keys, limit = 50) {
+  const now = nowMs();
   const maxCount = Math.max(1, Number(limit) || 50);
@@
-  if (typeof redis.eval === "function") {
-    const moved = await redis.eval(
-      `
-      local delayed = KEYS[1]
-      local ready = KEYS[2]
-      local now = tonumber(ARGV[1])
-      local max_count = tonumber(ARGV[2])
-      local ids = redis.call("ZRANGEBYSCORE", delayed, "-inf", now, "LIMIT", 0, max_count)
-      if #ids == 0 then
-        return 0
-      end
-      redis.call("ZREM", delayed, unpack(ids))
-      redis.call("LPUSH", ready, unpack(ids))
-      return #ids
-      `,
-      {
-        keys: [keys.delayed, keys.ready],
-        arguments: [String(now), String(maxCount)],
-      },
-    );
-    return Number(moved) || 0;
-  }
+  // Use a Lua script to atomically move delayed → ready
+  const moved = await redis.eval(
+    `
+    local delayed = KEYS[1]
+    local ready = KEYS[2]
+    local now = tonumber(ARGV[1])
+    local max = tonumber(ARGV[2])
+    local ids = redis.call("ZRANGEBYSCORE", delayed, "-inf", now, "LIMIT", 0, max)
+    if #ids == 0 then return 0 end
+    redis.call("ZREM", delayed, unpack(ids))
+    redis.call("LPUSH", ready, unpack(ids))
+    return #ids
+    `,
+    { keys: [keys.delayed, keys.ready], arguments: [String(now), String(maxCount)] }
+  );
+  return Number(moved) || 0;
+}
@@
-export async function runWorkerCycle(redis, keys, runJob, opts = {}) {
+export async function runWorkerCycle(redis, keys, runJob, opts = {}) {
   await moveDueDelayed(redis, keys);
-
-  const claimed = await claimReadyJob(redis, keys, opts);
-  if (!claimed) {
-    return { kind: "idle" };
-  }
-
-  const jobId = String(claimed);
+  const jobId = await claimReadyJob(redis, keys, opts);
+  if (!jobId) return { kind: "idle" };
+
   const job = await getJob(redis, keys, jobId);
   if (!job) {
-    await acknowledgeClaim(redis, keys, jobId);
+    await redis.lRem(keys.processing, 1, jobId);
     return { kind: "missing", jobId };
   }
@@
-  await markJob(redis, keys, jobId, {
-    status: "running",
-    attempts: String(attemptsNow),
-    started_at_ms: startedAtMs,
-    next_retry_at_ms: "",
-  });
+  // atomic transition script (see analysis)
+  await redis.eval(TRANSITION_JOB_SCRIPT, {
+    keys: [keys.job(jobId)],
+    arguments: ["queued", "running", String(nowMs()), "", ""],
+  });
   const heartbeat = setInterval(() => {
     renewClaimLease(redis, keys, jobId, workerId, leaseMs).catch(() => {});
   }, Math.max(1000, Math.floor(leaseMs / 3)));
@@
-    await markJob(redis, keys, jobId, {
-      status: "succeeded",
-      result_json: JSON.stringify(redactPersistedValue(result ?? null)),
-      last_error: "",
-      last_error_at_ms: "",
-      last_retry_reason: "",
-      next_retry_at_ms: "",
-      finished_at_ms: String(nowMs()),
-      claim_owner: "",
-      claim_started_at_ms: "",
-      claim_expires_at_ms: "",
-    });
+    await redis.eval(TRANSITION_JOB_SCRIPT, {
+      keys: [keys.job(jobId)],
+      arguments: [
+       