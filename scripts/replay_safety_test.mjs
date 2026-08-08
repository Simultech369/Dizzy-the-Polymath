import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

console.log("=== W-0067 Replay Safety Test Suite ===");

let openOperationalStore;
try {
  ({ openOperationalStore } = await import("../lib/sqlite_operational_store.mjs"));
} catch (error) {
  if (/node:sqlite|unknown built-in module|unknown builtin module/i.test(String(error?.message || error))) {
    console.log("REPLAY_SAFETY_TESTS_SKIPPED_NODE_SQLITE_UNAVAILABLE");
    process.exit(0);
  }
  throw error;
}

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy_replay_safety_"));
const dbPath = path.join(fixtureDir, "operational.sqlite");

function cleanup() {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${dbPath}${suffix}`, { force: true });
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

const storeA = openOperationalStore(dbPath, { busyTimeoutMs: 1000 });
const storeB = openOperationalStore(dbPath, { busyTimeoutMs: 1000 });

try {
  assert.equal(String(storeA.db.prepare("PRAGMA journal_mode").get().journal_mode).toLowerCase(), "wal");

  const first = storeA.acquireReplayLease({
    leaseKey: "route:/agent/execute|client:alpha|key:idem-1",
    owner: "worker-a",
    leaseMs: 60000,
    idempotencyKey: "idem-1",
    operationFingerprint: "execute:alpha:v1",
  });
  assert.equal(first.acquired, true);
  assert.equal(first.status, "leased");

  const duplicateInFlight = storeB.acquireReplayLease({
    leaseKey: "route:/agent/execute|client:alpha|key:idem-1",
    owner: "worker-b",
    leaseMs: 60000,
    idempotencyKey: "idem-1",
    operationFingerprint: "execute:alpha:v1",
  });
  assert.equal(duplicateInFlight.acquired, false);
  assert.equal(duplicateInFlight.status, "leased");
  assert.equal(duplicateInFlight.owner, "worker-a");
  assert.ok(duplicateInFlight.retry_after_ms > 0);

  assert.throws(
    () => storeB.completeReplayLease({
      leaseKey: "route:/agent/execute|client:alpha|key:idem-1",
      owner: "worker-b",
    }),
    /owner conflict/i,
  );

  const completed = storeA.completeReplayLease({
    leaseKey: "route:/agent/execute|client:alpha|key:idem-1",
    owner: "worker-a",
    resultFingerprint: "sha256:reply-a",
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.replay, false);

  const replay = storeB.acquireReplayLease({
    leaseKey: "route:/agent/execute|client:alpha|key:idem-1",
    owner: "worker-b",
    leaseMs: 60000,
    idempotencyKey: "idem-1",
    operationFingerprint: "execute:alpha:v1",
  });
  assert.equal(replay.acquired, false);
  assert.equal(replay.replay, true);
  assert.equal(replay.status, "completed");

  assert.throws(
    () => storeB.acquireReplayLease({
      leaseKey: "route:/agent/execute|client:alpha|key:idem-1",
      owner: "worker-b",
      leaseMs: 60000,
      idempotencyKey: "idem-1",
      operationFingerprint: "execute:alpha:v2",
    }),
    /request conflict/i,
  );

  storeA.acquireReplayLease({
    leaseKey: "route:/dispatch/incoming|client:beta|key:idem-2",
    owner: "worker-a",
    leaseMs: 60000,
    idempotencyKey: "idem-2",
    operationFingerprint: "dispatch:beta:v1",
  });
  assert.throws(
    () => storeB.acquireReplayLease({
      leaseKey: "route:/dispatch/incoming|client:gamma|key:idem-2",
      owner: "worker-b",
      leaseMs: 60000,
      idempotencyKey: "idem-2",
      operationFingerprint: "dispatch:gamma:v1",
    }),
    /idempotency key conflict/i,
  );

  storeA.acquireReplayLease({
    leaseKey: "route:/dispatch/incoming|client:delta|key:idem-3",
    owner: "worker-a",
    leaseMs: 60000,
    idempotencyKey: "idem-3",
    operationFingerprint: "dispatch:delta:v1",
  });
  storeA.db.prepare("UPDATE replay_leases SET lease_expires_at=? WHERE lease_key=?")
    .run(new Date(Date.now() - 5000).toISOString(), "route:/dispatch/incoming|client:delta|key:idem-3");
  const reacquired = storeB.acquireReplayLease({
    leaseKey: "route:/dispatch/incoming|client:delta|key:idem-3",
    owner: "worker-b",
    leaseMs: 60000,
    idempotencyKey: "idem-3",
    operationFingerprint: "dispatch:delta:v1",
  });
  assert.equal(reacquired.acquired, true);
  assert.equal(reacquired.owner, "worker-b");

  const failed = storeB.failReplayLease({
    leaseKey: "route:/dispatch/incoming|client:delta|key:idem-3",
    owner: "worker-b",
    resultFingerprint: "sha256:error",
  });
  assert.equal(failed.status, "failed");
  assert.equal(storeB.getReplayLease("route:/dispatch/incoming|client:delta|key:idem-3").status, "failed");
} finally {
  storeA.close();
  storeB.close();
  cleanup();
}

console.log("REPLAY_SAFETY_TESTS_OK");
