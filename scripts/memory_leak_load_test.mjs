/**
 * Phase 3b Bounded Retention & Memory-Leak Load Regression Suite (`npm run test:memory-leak-load`).
 *
 * Exercises sustained load across:
 * 1. Zone-keyed `openStructuralQueryCache` (400 inserts + memory-pressure LRU eviction + bounded audit trail)
 * 2. `A2AMailboxQueue` (300 signed enqueue -> lease dequeue -> acknowledge cycles -> 0 retained messages/leases)
 * 3. `EventTriggerRouter` (300 rapid subscriptions & external triggers -> TTL pruning bounds active map size)
 * 4. Process heap growth ceiling check across repeated cycles
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";

import { openStructuralQueryCache } from "../lib/structural_query_cache.mjs";
import { A2AMailboxQueue, createA2AMessage, signA2AMessageEnvelope } from "../lib/a2a_mailbox_bridge.mjs";
import { Ed25519TrustStore } from "../lib/a2a_boundary_guard.mjs";
import { EventTriggerRouter } from "../lib/event_trigger_router.mjs";

console.log("=== Phase 3b: Memory-Leak & Bounded Retention Load Regression Suite ===");

const baselineHeapBytes = process.memoryUsage().heapUsed;

// 1. Structural Query Cache bounded entries & audit trail under sustained load
const cache = openStructuralQueryCache(":memory:", { maxAuditEntries: 100 });
try {
  const baseNow = 1_760_000_000_000;
  for (let i = 0; i < 400; i += 1) {
    cache.store({
      route: "/api/dashboard-query",
      projection: "v1",
      trustZone: i % 2 === 0 ? "private_self" : "trusted_collaborator",
      retentionScope: "local_conversation",
      query: `load_query_${i}`,
      payload: { idx: i, snippets: ["bounded_test_snippet"] },
      ttlMs: i < 250 ? 5_000 : 120_000,
      nowMs: baseNow,
    });
  }

  assert.equal(cache.stats().total_entries, 400);
  assert.ok(cache.getAuditTrail().length <= 100, "Cache audit trail must stay strictly bounded");

  const pruneRes = cache.pruneUnderMemoryPressure({
    currentRssMb: 1300,
    maxRssMb: 1400,
    highWatermarkRatio: 0.80,
    batchSize: 50,
    nowMs: baseNow + 10_000,
  });
  assert.equal(pruneRes.under_pressure, true);
  assert.equal(pruneRes.pruned_expired, 250);
  assert.equal(pruneRes.evicted_lru, 50);
  assert.equal(cache.stats().total_entries, 100);
  console.log("  [PASS] Cache expired + LRU eviction bounded 400 entries -> 100 under pressure.");
} finally {
  cache.close();
}

// 2. A2AMailboxQueue zero-residue after 300 signed enqueue -> dequeue -> ack cycles
{
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const trustStore = new Ed25519TrustStore();
  trustStore.addKey("worker_load", publicKey, {
    authorized_sender_ids: ["worker_load"],
    authorized_trust_zones: ["trusted_collaborator"],
  });
  const mailbox = new A2AMailboxQueue({ requireSignature: true, trustStore });

  for (let i = 0; i < 300; i += 1) {
    const msg = createA2AMessage({
      senderId: "worker_load",
      recipientId: "dizzy_router",
      messageType: "task_result",
      trustZone: "trusted_collaborator",
      payload: { cycle: i, summary: "ok" },
    });
    const env = signA2AMessageEnvelope(msg, {
      algorithm: "ed25519",
      privateKey,
      keyId: "worker_load",
    });
    mailbox.enqueue(env);
    const leased = mailbox.dequeue({ recipientId: "dizzy_router", limit: 1 });
    assert.equal(leased.length, 1);
    const ack = mailbox.acknowledge({
      messageId: msg.message_id,
      leaseToken: leased[0].lease_token,
    });
    assert.equal(ack.action, "ACKNOWLEDGED");
  }

  const finalStats = mailbox.getStats();
  assert.equal(finalStats.total_stored, 0, "Acknowledged messages must not leak in mailbox map");
  assert.equal(finalStats.queued_count, 0);
  assert.equal(finalStats.leased_count, 0);
  console.log("  [PASS] 300 signed A2A mailbox cycles left 0 leaked messages or leases.");
}

// 3. EventTriggerRouter subscription TTL pruning under load
{
  let clockMs = 1_760_000_000_000;
  const router = new EventTriggerRouter({ now: () => new Date(clockMs) });
  for (let i = 0; i < 300; i += 1) {
    router.subscribeTask({
      taskId: `task_load_${i}`,
      workerId: `worker_${i % 4}`,
      trustZone: "private_self",
      ttlMs: i < 280 ? 5_000 : 60_000,
    });
  }
  clockMs += 10_000;
  const activeSubs = router.listSubscriptions();
  assert.equal(activeSubs.length, 20, "Expired task subscriptions must prune automatically");
  console.log("  [PASS] 300 task subscriptions pruned cleanly to 20 active entries after TTL.");
}

const afterHeapBytes = process.memoryUsage().heapUsed;
const heapDeltaMb = (afterHeapBytes - baselineHeapBytes) / (1024 * 1024);
assert.ok(heapDeltaMb < 64, `Unexpected heap retention delta: ${heapDeltaMb.toFixed(2)} MB`);
console.log(`  [PASS] Net heap delta remained bounded (${heapDeltaMb.toFixed(2)} MB < 64 MB ceiling).`);
console.log("MEMORY_LEAK_LOAD_TESTS_OK");
