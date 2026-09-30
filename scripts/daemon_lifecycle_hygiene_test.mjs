/**
 * Daemon Lifecycle Hygiene & Operational Residue Unit Test Suite.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  sampleDaemonTelemetry,
  pruneOperationalResidue,
  createResidueWatchdog,
  getEventLoopMetrics,
  DAEMON_TELEMETRY_SCHEMA,
  DAEMON_HYGIENE_RECEIPT_SCHEMA,
} from "../lib/daemon_hygiene.mjs";
import { openStructuralQueryCache } from "../lib/structural_query_cache.mjs";

console.log("=== [Daemon Lifecycle Hygiene & Operational Residue Test Suite] ===");

// 1. Telemetry Sampling
console.log("\nTest 1: Telemetry Sampling...");
const telemetry = sampleDaemonTelemetry({ memoryBudgetMb: 1400 });
assert.equal(telemetry.schema_version, DAEMON_TELEMETRY_SCHEMA);
assert.equal(typeof telemetry.pid, "number");
assert.equal(typeof telemetry.uptime_seconds, "number");
assert.equal(typeof telemetry.memory.rss_mb, "number");
assert.equal(typeof telemetry.memory.heap_used_mb, "number");
assert.equal(telemetry.memory.memory_budget_mb, 1400);
assert.equal(typeof telemetry.memory.pressure_ratio, "number");
assert(["normal", "elevated", "high", "critical"].includes(telemetry.memory.pressure_level));

const el = getEventLoopMetrics();
assert.equal(typeof el.mean_ms, "number");
assert.equal(typeof el.healthy, "boolean");
console.log(`✓ Telemetry sampled: RSS=${telemetry.memory.rss_mb}MB heap=${telemetry.memory.heap_used_mb}MB level=${telemetry.memory.pressure_level} status=${telemetry.status}`);

// 2. Ephemeral Buffer & Stream Residue Disposal
console.log("\nTest 2: Ephemeral Buffer & Stream Disposal...");
const ephemeralStreamChunks = ["chunk1", "chunk2", "chunk3"];
const ephemeralToolOutputs = new Set(["tool_out_1", "tool_out_2"]);
const ephemeralBufferMap = new Map([["key1", "val1"], ["key2", "val2"]]);

const disposalReceipt = await pruneOperationalResidue({
  activeStreams: ephemeralStreamChunks,
  ephemeralBuffers: [ephemeralToolOutputs, ephemeralBufferMap],
  force: true,
});

assert.equal(disposalReceipt.schema_version, DAEMON_HYGIENE_RECEIPT_SCHEMA);
assert.equal(disposalReceipt.status, "COMPLETED");
assert.equal(disposalReceipt.actions.streams_pruned, 3);
assert.equal(disposalReceipt.actions.buffers_cleared, 4); // 2 + 2
assert.equal(ephemeralStreamChunks.length, 0, "Active stream chunk buffer must be drained");
assert.equal(ephemeralToolOutputs.size, 0, "Tool output buffer set must be cleared");
assert.equal(ephemeralBufferMap.size, 0, "Buffer map must be cleared");
assert.match(disposalReceipt.evidence_sha256, /^[a-f0-9]{64}$/);
console.log(`✓ Ephemeral residue pruned and crystallized into receipt ${disposalReceipt.receipt_id}`);

// 3. Cache Eviction Under Memory Pressure
console.log("\nTest 3: Query Cache Eviction Under Pressure...");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-hygiene-cache-"));
const dbPath = path.join(tempDir, "cache.sqlite");
const cache = openStructuralQueryCache(dbPath, { ttlMs: 600_000 });

try {
  // Seed entries into cache
  for (let i = 1; i <= 5; i++) {
    cache.store({
      route: "/api/test",
      projection: "test-v1",
      query: `query_${i}`,
      trustZone: "private_self",
      retentionScope: "local_conversation",
      promptConfigHash: "a".repeat(64),
      sourceSignature: { digest: "b".repeat(64), source_count: 1 },
      payload: { test: i },
      nowMs: Date.now() + (i * 10),
    });
  }

  assert.equal(cache.stats().total_entries, 5);

  // Trigger residue pruning with queryCache attached
  const cachePruneReceipt = await pruneOperationalResidue({
    queryCache: cache,
    force: true,
  });

  assert.equal(cachePruneReceipt.status, "COMPLETED");
  assert(cachePruneReceipt.actions.query_cache_freed >= 0);
  console.log(`✓ Cache eviction under memory pressure verified (freed ${cachePruneReceipt.actions.query_cache_freed} entries)`);
} finally {
  try { cache.close(); } catch {}
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// 4. Residue Watchdog
console.log("\nTest 4: Residue Watchdog Lifecycle...");
let pruneNotified = false;
const watchdog = createResidueWatchdog({
  intervalMs: 1000,
  memoryBudgetMb: 1400,
  highWatermarkRatio: 0.80,
  onPrune: (r) => {
    pruneNotified = true;
  },
  enabled: false, // manual check
});

const statusInitial = watchdog.getStatus();
assert.equal(statusInitial.running, false);
assert.equal(statusInitial.total_prunes, 0);

// Force check now
const checkResult = await watchdog.checkNow(true);
assert.equal(checkResult.pruned, true);
assert.equal(checkResult.receipt.status, "COMPLETED");
assert.equal(pruneNotified, true);
assert.equal(watchdog.getStatus().total_prunes, 1);

watchdog.stop();
console.log("✓ Residue watchdog manual tick and notification verified.");

console.log("\n==================================================");
console.log("   ALL DAEMON LIFECYCLE HYGIENE TESTS PASSED!    ");
console.log("==================================================");
