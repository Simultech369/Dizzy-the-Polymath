import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export const STRUCTURAL_QUERY_CACHE_SCHEMA = "dizzy.structural_query_cache.v1";

const require = createRequire(import.meta.url);
let cachedDatabaseSync = undefined;

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseBool(value, fallback = false) {
  const raw = String(value ?? (fallback ? "1" : "0")).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function normalizeIdentifier(value, fallback) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_.:/-]+/g, "_").slice(0, 120) || fallback;
}

function normalizeTrustZone(value) {
  const raw = String(value || "").trim().toLowerCase();
  return ["private_self", "trusted_collaborator", "outside_contact", "paid_public"].includes(raw)
    ? raw
    : "outside_contact";
}

function normalizeRetentionScope(value) {
  const raw = String(value || "").trim().toLowerCase();
  return ["ephemeral", "conversation_only", "local_conversation"].includes(raw) ? raw : "ephemeral";
}

function normalizePartitionValue(value) {
  return String(value ?? "").trim().slice(0, 240);
}

function cachePartitionForInput(input = {}) {
  const trustZone = normalizeTrustZone(input.trustZone ?? input.trust_zone);
  const retentionScope = normalizeRetentionScope(input.retentionScope ?? input.retention_scope);
  const explicit = normalizePartitionValue(
    input.cachePartition
      ?? input.cache_partition
      ?? input.partitionKey
      ?? input.partition_key
      ?? input.clientScope
      ?? input.client_scope
      ?? input.conversationKey
      ?? input.conversation_key,
  );
  if (explicit) {
    return {
      present: true,
      kind: "explicit",
      hash: sha256Hex(explicit),
    };
  }
  if (retentionScope === "local_conversation" && (trustZone === "private_self" || trustZone === "trusted_collaborator")) {
    return {
      present: true,
      kind: "local_operator",
      hash: sha256Hex("local_operator"),
    };
  }
  return {
    present: false,
    kind: "missing",
    hash: "",
  };
}

function sourceSignatureDigest(sourceSignature) {
  if (sourceSignature && typeof sourceSignature === "object" && !Array.isArray(sourceSignature)) {
    const direct = String(sourceSignature.digest || sourceSignature.sha256 || "").trim();
    if (/^[a-f0-9]{64}$/i.test(direct)) return direct.toLowerCase();
    return sha256Hex(stableJson(sourceSignature));
  }
  const value = String(sourceSignature || "").trim();
  return /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : sha256Hex(value);
}

function promptConfigDigest(promptConfigHash) {
  const value = String(promptConfigHash || "").trim();
  return /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : sha256Hex(value);
}

function canPersist(input = {}) {
  const trustZone = input.trustZone ?? input.trust_zone;
  const retentionScope = input.retentionScope ?? input.retention_scope;
  const zone = normalizeTrustZone(trustZone);
  const scope = normalizeRetentionScope(retentionScope);
  const partition = cachePartitionForInput({ ...input, trustZone: zone, retentionScope: scope });
  if (scope === "ephemeral") return { ok: false, reason: "ephemeral_retention_scope" };
  if (scope === "local_conversation" && (zone === "private_self" || zone === "trusted_collaborator")) {
    return { ok: true, reason: "local_private_cache_allowed", partition };
  }
  if (scope === "conversation_only" && zone === "paid_public") {
    if (!partition.present || partition.kind !== "explicit") {
      return { ok: false, reason: "conversation_scope_required", partition };
    }
    return { ok: true, reason: "client_conversation_cache_allowed", partition };
  }
  return { ok: false, reason: "trust_zone_retention_mismatch", partition };
}

function loadDatabaseSync() {
  if (cachedDatabaseSync !== undefined) return cachedDatabaseSync;
  try {
    ({ DatabaseSync: cachedDatabaseSync } = require("node:sqlite"));
  } catch {
    cachedDatabaseSync = null;
  }
  return cachedDatabaseSync;
}

function disabledCache(reason) {
  return {
    enabled: false,
    reason,
    lookup(input = {}) {
      return {
        hit: false,
        stored: false,
        reason,
        cache_key: buildStructuralQueryCacheKey(input).cacheKey,
        receipt: buildCacheReceipt({ ...input, cacheHit: false, stored: false, reason }),
      };
    },
    store(input = {}) {
      return {
        stored: false,
        reason,
        cache_key: buildStructuralQueryCacheKey(input).cacheKey,
        receipt: buildCacheReceipt({ ...input, cacheHit: false, stored: false, reason }),
      };
    },
    pruneExpired() {
      return 0;
    },
    close() {},
  };
}

export function hashStructuralPayload(value) {
  return sha256Hex(stableJson(value));
}

export function buildStructuralQueryCacheKey(input = {}) {
  const route = normalizeIdentifier(input.route, "route:unknown");
  const projection = normalizeIdentifier(input.projection, "projection:v1");
  const trustZone = normalizeTrustZone(input.trustZone ?? input.trust_zone);
  const retentionScope = normalizeRetentionScope(input.retentionScope ?? input.retention_scope);
  const partition = cachePartitionForInput({ ...input, trustZone, retentionScope });
  const queryHash = sha256Hex(String(input.query || "").trim().toLowerCase());
  const promptHash = promptConfigDigest(input.promptConfigHash ?? input.prompt_config_hash);
  const signature = sourceSignatureDigest(input.sourceSignature ?? input.source_signature);
  const keyMaterial = {
    schema: STRUCTURAL_QUERY_CACHE_SCHEMA,
    route,
    projection,
    trust_zone: trustZone,
    retention_scope: retentionScope,
    query_hash: queryHash,
    prompt_config_hash: promptHash,
    source_signature: signature,
    cache_partition_hash: partition.hash,
    cache_partition_kind: partition.kind,
  };
  return {
    cacheKey: `sqc_${sha256Hex(stableJson(keyMaterial))}`,
    keyMaterial,
  };
}

export function buildCacheReceipt(input = {}) {
  const { cacheKey, keyMaterial } = buildStructuralQueryCacheKey(input);
  return {
    schema: STRUCTURAL_QUERY_CACHE_SCHEMA,
    cache_key: cacheKey,
    cache_hit: Boolean(input.cacheHit ?? input.cache_hit),
    stored: Boolean(input.stored),
    reason: String(input.reason || ""),
    route: keyMaterial.route,
    projection: keyMaterial.projection,
    trust_zone: keyMaterial.trust_zone,
    retention_scope: keyMaterial.retention_scope,
    query_hash: keyMaterial.query_hash,
    prompt_config_hash: keyMaterial.prompt_config_hash,
    source_signature: keyMaterial.source_signature,
    cache_partition_hash: keyMaterial.cache_partition_hash,
    cache_partition_kind: keyMaterial.cache_partition_kind,
    source_count: Math.max(0, Number(input.sourceCount ?? input.source_count ?? 0) || 0),
    payload_hash: input.payloadHash || input.payload_hash || "",
    served_at: new Date(Number(input.nowMs) || Date.now()).toISOString(),
  };
}

export function openStructuralQueryCache(filePath, opts = {}) {
  const enabled = opts.enabled !== undefined
    ? Boolean(opts.enabled)
    : parseBool(env("DIZZY_STRUCTURAL_QUERY_CACHE", "1"), true);
  if (!enabled) return disabledCache("disabled_by_config");

  const DatabaseSync = loadDatabaseSync();
  if (!DatabaseSync) return disabledCache("node_sqlite_unavailable");

  const resolved = filePath === ":memory:"
    ? ":memory:"
    : path.resolve(filePath || env("DIZZY_STRUCTURAL_QUERY_CACHE_PATH", "runtime/structural_query_cache.sqlite"));
  if (resolved !== ":memory:") fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new DatabaseSync(resolved);
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(`PRAGMA busy_timeout=${Math.max(1, Number(opts.busyTimeoutMs || 500) || 500)}`);
  if (resolved !== ":memory:") {
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("PRAGMA synchronous=NORMAL");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS structural_query_cache (
      cache_key TEXT PRIMARY KEY,
      schema_version TEXT NOT NULL,
      route TEXT NOT NULL,
      projection TEXT NOT NULL,
      trust_zone TEXT NOT NULL,
      retention_scope TEXT NOT NULL,
      query_hash TEXT NOT NULL,
      prompt_config_hash TEXT NOT NULL,
      source_signature TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      receipt_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_hit_at TEXT,
      expires_at TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0 CHECK(hit_count >= 0)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_structural_query_cache_expires_at
      ON structural_query_cache(expires_at);
  `);

  const defaultTtlMs = Math.max(1_000, Number(opts.ttlMs ?? env("DIZZY_STRUCTURAL_QUERY_CACHE_TTL_MS", "60000")) || 60_000);
  const maxPayloadBytes = Math.max(512, Number(opts.maxPayloadBytes ?? env("DIZZY_STRUCTURAL_QUERY_CACHE_MAX_PAYLOAD_BYTES", "65536")) || 65_536);

  function normalizeInput(input = {}) {
    const { cacheKey, keyMaterial } = buildStructuralQueryCacheKey(input);
    const sourceCount = Math.max(0, Number(input.sourceCount ?? input.source_count ?? 0) || 0);
    return { cacheKey, keyMaterial, sourceCount };
  }

  function pruneExpired(nowMs = Date.now()) {
    const expiresBefore = new Date(nowMs).toISOString();
    const result = db.prepare("DELETE FROM structural_query_cache WHERE expires_at <= ?").run(expiresBefore);
    return Number(result.changes || 0);
  }

  function lookup(input = {}) {
    const normalized = normalizeInput(input);
    const allowed = canPersist({
      ...input,
      trustZone: normalized.keyMaterial.trust_zone,
      retentionScope: normalized.keyMaterial.retention_scope,
    });
    if (!allowed.ok) {
      return {
        hit: false,
        stored: false,
        reason: allowed.reason,
        cache_key: normalized.cacheKey,
        receipt: buildCacheReceipt({ ...input, cacheHit: false, stored: false, reason: allowed.reason }),
      };
    }

    const nowMs = Number(input.nowMs) || Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const row = db.prepare("SELECT * FROM structural_query_cache WHERE cache_key=?").get(normalized.cacheKey);
    if (!row) {
      return {
        hit: false,
        stored: false,
        reason: "cache_miss",
        cache_key: normalized.cacheKey,
        receipt: buildCacheReceipt({ ...input, cacheHit: false, stored: false, reason: "cache_miss", sourceCount: normalized.sourceCount, nowMs }),
      };
    }
    if (Date.parse(row.expires_at) <= nowMs) {
      db.prepare("DELETE FROM structural_query_cache WHERE cache_key=?").run(normalized.cacheKey);
      return {
        hit: false,
        stored: false,
        reason: "cache_expired",
        cache_key: normalized.cacheKey,
        receipt: buildCacheReceipt({ ...input, cacheHit: false, stored: false, reason: "cache_expired", sourceCount: normalized.sourceCount, nowMs }),
      };
    }

    const nextHitCount = Number(row.hit_count || 0) + 1;
    db.prepare("UPDATE structural_query_cache SET hit_count=?, last_hit_at=?, updated_at=? WHERE cache_key=?")
      .run(nextHitCount, nowIso, nowIso, normalized.cacheKey);
    let payload = null;
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      db.prepare("DELETE FROM structural_query_cache WHERE cache_key=?").run(normalized.cacheKey);
      return {
        hit: false,
        stored: false,
        reason: "cache_payload_invalid",
        cache_key: normalized.cacheKey,
        receipt: buildCacheReceipt({ ...input, cacheHit: false, stored: false, reason: "cache_payload_invalid", sourceCount: normalized.sourceCount, nowMs }),
      };
    }

    return {
      hit: true,
      stored: true,
      reason: "cache_hit",
      cache_key: normalized.cacheKey,
      payload,
      receipt: {
        ...buildCacheReceipt({
          ...input,
          cacheHit: true,
          stored: true,
          reason: "cache_hit",
          sourceCount: normalized.sourceCount,
          payloadHash: sha256Hex(row.payload_json),
          nowMs,
        }),
        hit_count: nextHitCount,
        created_at: row.created_at,
        expires_at: row.expires_at,
      },
    };
  }

  function store(input = {}) {
    const normalized = normalizeInput(input);
    const allowed = canPersist({
      ...input,
      trustZone: normalized.keyMaterial.trust_zone,
      retentionScope: normalized.keyMaterial.retention_scope,
    });
    if (!allowed.ok) {
      return {
        stored: false,
        reason: allowed.reason,
        cache_key: normalized.cacheKey,
        receipt: buildCacheReceipt({ ...input, cacheHit: false, stored: false, reason: allowed.reason }),
      };
    }

    const payloadJson = stableJson(input.payload ?? {});
    const payloadBytes = Buffer.byteLength(payloadJson, "utf8");
    if (payloadBytes > maxPayloadBytes) {
      return {
        stored: false,
        reason: "payload_too_large",
        cache_key: normalized.cacheKey,
        receipt: buildCacheReceipt({ ...input, cacheHit: false, stored: false, reason: "payload_too_large" }),
      };
    }

    const nowMs = Number(input.nowMs) || Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const ttlMs = Math.max(1_000, Number(input.ttlMs ?? input.ttl_ms ?? defaultTtlMs) || defaultTtlMs);
    const expiresAt = new Date(nowMs + ttlMs).toISOString();
    const receipt = buildCacheReceipt({
      ...input,
      cacheHit: false,
      stored: true,
      reason: "stored",
      sourceCount: normalized.sourceCount,
      payloadHash: sha256Hex(payloadJson),
      nowMs,
    });

    db.prepare(`
      INSERT INTO structural_query_cache(
        cache_key, schema_version, route, projection, trust_zone, retention_scope, query_hash,
        prompt_config_hash, source_signature, payload_json, receipt_json, created_at, updated_at,
        last_hit_at, expires_at, hit_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0)
      ON CONFLICT(cache_key) DO UPDATE SET
        payload_json=excluded.payload_json,
        receipt_json=excluded.receipt_json,
        updated_at=excluded.updated_at,
        expires_at=excluded.expires_at
    `).run(
      normalized.cacheKey,
      STRUCTURAL_QUERY_CACHE_SCHEMA,
      normalized.keyMaterial.route,
      normalized.keyMaterial.projection,
      normalized.keyMaterial.trust_zone,
      normalized.keyMaterial.retention_scope,
      normalized.keyMaterial.query_hash,
      normalized.keyMaterial.prompt_config_hash,
      normalized.keyMaterial.source_signature,
      payloadJson,
      stableJson(receipt),
      nowIso,
      nowIso,
      expiresAt,
    );

    return {
      stored: true,
      reason: "stored",
      cache_key: normalized.cacheKey,
      receipt: { ...receipt, expires_at: expiresAt },
    };
  }

  return {
    enabled: true,
    filePath: resolved,
    db,
    lookup,
    store,
    pruneExpired,
    close: () => db.close(),
  };
}
