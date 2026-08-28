import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildStructuralQueryCacheKey,
  openStructuralQueryCache,
  STRUCTURAL_QUERY_CACHE_SCHEMA,
} from "../lib/structural_query_cache.mjs";

console.log("=== W-0098 Structural Query Cache Test Suite ===");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-structural-cache-"));
const dbPath = path.join(tempDir, "cache.sqlite");
const cache = openStructuralQueryCache(dbPath, { ttlMs: 60_000, busyTimeoutMs: 100, maxPayloadBytes: 8192 });

try {
  if (!cache.enabled) {
    console.log(`STRUCTURAL_QUERY_CACHE_TESTS_SKIPPED reason=${cache.reason || "disabled"}`);
    process.exit(0);
  }

  const query = "Find the deterministic cache receipt boundary";
  const baseInput = {
    route: "/api/dashboard-query",
    projection: "dashboard-snippets-v1",
    query,
    trustZone: "private_self",
    retentionScope: "local_conversation",
    promptConfigHash: "b".repeat(64),
    sourceSignature: { digest: "a".repeat(64), source_count: 2 },
    sourceCount: 2,
    nowMs: 1_000,
  };
  const payload = {
    snippets: [
      {
        id: "doc-abc123",
        kind: "topic",
        confidence: 1,
        decay: 1,
        score: 4.2,
        reasons: ["decision_signal"],
      },
    ],
  };

  const keyA = buildStructuralQueryCacheKey(baseInput);
  const keyB = buildStructuralQueryCacheKey({
    sourceCount: 2,
    sourceSignature: { source_count: 2, digest: "a".repeat(64) },
    promptConfigHash: "b".repeat(64),
    retentionScope: "local_conversation",
    trustZone: "private_self",
    query,
    projection: "dashboard-snippets-v1",
    route: "/api/dashboard-query",
  });
  assert.equal(keyA.cacheKey, keyB.cacheKey, "Cache keys must be deterministic across object insertion order");

  const firstLookup = cache.lookup(baseInput);
  assert.equal(firstLookup.hit, false);
  assert.equal(firstLookup.reason, "cache_miss");
  assert.equal(firstLookup.receipt.schema, STRUCTURAL_QUERY_CACHE_SCHEMA);
  assert.match(firstLookup.receipt.query_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(firstLookup.receipt).includes(query), false, "Receipts must not store raw query text");

  const stored = cache.store({ ...baseInput, payload });
  assert.equal(stored.stored, true);
  assert.equal(stored.receipt.stored, true);

  const hit = cache.lookup({ ...baseInput, nowMs: 2_000 });
  assert.equal(hit.hit, true);
  assert.deepEqual(hit.payload, payload);
  assert.equal(hit.receipt.cache_hit, true);
  assert.equal(hit.receipt.hit_count, 1);

  const row = cache.db.prepare("SELECT query_hash, payload_json, receipt_json FROM structural_query_cache WHERE cache_key=?")
    .get(keyA.cacheKey);
  assert(row, "Expected cache row to be written");
  assert.equal(row.query_hash.includes(query), false);
  assert.equal(row.payload_json.includes(query), false);
  assert.equal(row.receipt_json.includes(query), false);

  const sourceChanged = cache.lookup({
    ...baseInput,
    sourceSignature: { digest: "c".repeat(64), source_count: 2 },
    nowMs: 2_000,
  });
  assert.equal(sourceChanged.hit, false, "Changed source signature must miss");

  const promptChanged = cache.lookup({
    ...baseInput,
    promptConfigHash: "d".repeat(64),
    nowMs: 2_000,
  });
  assert.equal(promptChanged.hit, false, "Changed prompt/config hash must miss");

  const publicEphemeral = cache.store({
    ...baseInput,
    trustZone: "paid_public",
    retentionScope: "ephemeral",
    payload,
  });
  assert.equal(publicEphemeral.stored, false);
  assert.equal(publicEphemeral.reason, "ephemeral_retention_scope");

  const publicConversationMissingScope = cache.store({
    ...baseInput,
    trustZone: "paid_public",
    retentionScope: "conversation_only",
    payload,
  });
  assert.equal(publicConversationMissingScope.stored, false);
  assert.equal(publicConversationMissingScope.reason, "conversation_scope_required");

  const publicConversationInput = {
    ...baseInput,
    query: "client scoped structural cache row",
    trustZone: "paid_public",
    retentionScope: "conversation_only",
    cachePartition: "client:alpha/service:demo/conversation:one",
    sourceSignature: { digest: "f".repeat(64), source_count: 1 },
    sourceCount: 1,
  };
  const publicConversationStored = cache.store({ ...publicConversationInput, payload });
  assert.equal(publicConversationStored.stored, true);
  assert.equal(publicConversationStored.receipt.cache_partition_kind, "explicit");
  assert.match(publicConversationStored.receipt.cache_partition_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(publicConversationStored.receipt).includes("client:alpha"), false);
  const publicConversationHit = cache.lookup(publicConversationInput);
  assert.equal(publicConversationHit.hit, true);
  const publicConversationOtherClient = cache.lookup({
    ...publicConversationInput,
    cachePartition: "client:beta/service:demo/conversation:one",
  });
  assert.equal(publicConversationOtherClient.hit, false, "Changed client partition must miss");

  const shortLivedInput = {
    ...baseInput,
    query: "short lived cache row",
    sourceSignature: { digest: "e".repeat(64), source_count: 1 },
    sourceCount: 1,
    nowMs: 10_000,
    ttlMs: 1_000,
  };
  const shortStored = cache.store({ ...shortLivedInput, payload });
  assert.equal(shortStored.stored, true);
  const expired = cache.lookup({ ...shortLivedInput, nowMs: 12_000 });
  assert.equal(expired.hit, false);
  assert.equal(expired.reason, "cache_expired");

  const removed = cache.pruneExpired(120_000);
  assert.equal(Number.isInteger(removed), true);

  console.log(`STRUCTURAL_QUERY_CACHE_TESTS_OK cache_key=${keyA.cacheKey}`);
} finally {
  try { cache.close(); } catch {}
  fs.rmSync(tempDir, { recursive: true, force: true });
}
