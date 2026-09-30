/**
 * Operational Residue & Daemon Lifecycle Hygiene Module.
 *
 * Implements telemetry sampling (process RSS, heap, event loop delay),
 * memory pressure detection, cache LRU pruning, ephemeral buffer disposal,
 * and garbage collection triggering for long-running operator daemons.
 */

import crypto from "node:crypto";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { DEFAULT_MEMORY_BUDGET_MB } from "./routing_policy.mjs";

export const DAEMON_HYGIENE_RECEIPT_SCHEMA = "dizzy.daemon_hygiene_receipt.v1";
export const DAEMON_TELEMETRY_SCHEMA = "dizzy.daemon_telemetry.v1";

export const HIGH_WATERMARK_RATIO = 0.80;
export const CRITICAL_WATERMARK_RATIO = 0.90;

let eventLoopHistogram = null;

function getEventLoopHistogram() {
  if (!eventLoopHistogram) {
    try {
      eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
      eventLoopHistogram.enable();
    } catch {
      eventLoopHistogram = null;
    }
  }
  return eventLoopHistogram;
}

export function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

export function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Returns current event loop lag metrics in milliseconds.
 */
export function getEventLoopMetrics() {
  const h = getEventLoopHistogram();
  if (!h) {
    return {
      available: false,
      mean_ms: 0,
      max_ms: 0,
      p90_ms: 0,
      p99_ms: 0,
      healthy: true,
    };
  }

  const meanMs = Number.isFinite(h.mean) ? Math.round((h.mean / 1e6) * 1000) / 1000 : 0;
  const maxMs = Number.isFinite(h.max) ? Math.round((h.max / 1e6) * 1000) / 1000 : 0;
  const p90Raw = h.percentile ? h.percentile(90) : 0;
  const p99Raw = h.percentile ? h.percentile(99) : 0;
  const p90Ms = Number.isFinite(p90Raw) ? Math.round((p90Raw / 1e6) * 1000) / 1000 : 0;
  const p99Ms = Number.isFinite(p99Raw) ? Math.round((p99Raw / 1e6) * 1000) / 1000 : 0;
  const healthy = meanMs < 50 && (maxMs === 0 || maxMs < 1000);

  return {
    available: true,
    mean_ms: meanMs,
    max_ms: maxMs,
    p90_ms: p90Ms,
    p99_ms: p99Ms,
    healthy,
  };
}

/**
 * Samples current daemon telemetry: process RSS, heap segments, event loop lag, and memory pressure.
 */
export function sampleDaemonTelemetry({ memoryBudgetMb = DEFAULT_MEMORY_BUDGET_MB } = {}) {
  const mem = process.memoryUsage ? process.memoryUsage() : { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
  const rssMb = Math.round((mem.rss / 1048576) * 100) / 100;
  const heapTotalMb = Math.round((mem.heapTotal / 1048576) * 100) / 100;
  const heapUsedMb = Math.round((mem.heapUsed / 1048576) * 100) / 100;
  const externalMb = Math.round((mem.external / 1048576) * 100) / 100;
  const arrayBuffersMb = Math.round(((mem.arrayBuffers || 0) / 1048576) * 100) / 100;

  const budgetMb = Number.isFinite(memoryBudgetMb) && memoryBudgetMb > 0 ? memoryBudgetMb : DEFAULT_MEMORY_BUDGET_MB;
  const pressureRatio = Math.round((rssMb / budgetMb) * 1000) / 1000;

  let pressureLevel = "normal";
  if (pressureRatio >= CRITICAL_WATERMARK_RATIO) {
    pressureLevel = "critical";
  } else if (pressureRatio >= HIGH_WATERMARK_RATIO) {
    pressureLevel = "high";
  } else if (pressureRatio >= 0.70) {
    pressureLevel = "elevated";
  }

  const el = getEventLoopMetrics();
  const isHealthy = el.healthy && pressureLevel !== "critical";

  return {
    schema_version: DAEMON_TELEMETRY_SCHEMA,
    pid: process.pid,
    uptime_seconds: Math.round(process.uptime ? process.uptime() : 0),
    timestamp: new Date().toISOString(),
    status: isHealthy ? "HEALTHY" : "DEGRADED",
    memory: {
      rss_mb: rssMb,
      heap_used_mb: heapUsedMb,
      heap_total_mb: heapTotalMb,
      external_mb: externalMb,
      array_buffers_mb: arrayBuffersMb,
      memory_budget_mb: budgetMb,
      pressure_ratio: pressureRatio,
      pressure_level: pressureLevel,
      high_watermark_ratio: HIGH_WATERMARK_RATIO,
      critical_watermark_ratio: CRITICAL_WATERMARK_RATIO,
    },
    event_loop: el,
  };
}

/**
 * Prunes operational residue:
 * - Evicts expired and LRU entries from structural query cache when under memory pressure
 * - Discards completed stream buffers and ephemeral execution chunks
 * - Triggers V8 GC when available
 * - Emits a cryptographically bound DaemonHygieneReceipt
 */
export async function pruneOperationalResidue({
  queryCache = null,
  activeStreams = null,
  ephemeralBuffers = null,
  triggerGc = true,
  memoryBudgetMb = DEFAULT_MEMORY_BUDGET_MB,
  force = false,
  nowMs = Date.now(),
} = {}) {
  const before = sampleDaemonTelemetry({ memoryBudgetMb });

  let cachePruneResult = null;
  if (queryCache && typeof queryCache.pruneUnderMemoryPressure === "function") {
    cachePruneResult = queryCache.pruneUnderMemoryPressure({
      currentRssMb: before.memory.rss_mb,
      maxRssMb: memoryBudgetMb,
      highWatermarkRatio: HIGH_WATERMARK_RATIO,
      force,
      nowMs,
    });
  }

  let streamsPrunedCount = 0;
  if (activeStreams) {
    if (Array.isArray(activeStreams)) {
      streamsPrunedCount = activeStreams.length;
      activeStreams.length = 0;
    } else if (activeStreams instanceof Set || activeStreams instanceof Map) {
      streamsPrunedCount = activeStreams.size;
      activeStreams.clear();
    }
  }

  let buffersClearedCount = 0;
  if (ephemeralBuffers) {
    const list = Array.isArray(ephemeralBuffers) ? ephemeralBuffers : [ephemeralBuffers];
    for (const buf of list) {
      if (Array.isArray(buf)) {
        buffersClearedCount += buf.length;
        buf.length = 0;
      } else if (buf instanceof Set || buf instanceof Map) {
        buffersClearedCount += buf.size;
        buf.clear();
      }
    }
  }

  let gcTriggered = false;
  if (triggerGc && typeof global.gc === "function") {
    try {
      global.gc();
      gcTriggered = true;
    } catch {
      gcTriggered = false;
    }
  }

  const after = sampleDaemonTelemetry({ memoryBudgetMb });
  const heapFreedMb = Math.max(0, Math.round((before.memory.heap_used_mb - after.memory.heap_used_mb) * 100) / 100);

  const receiptPayload = {
    schema_version: DAEMON_HYGIENE_RECEIPT_SCHEMA,
    receipt_id: `hygiene_${nowMs}_${crypto.randomBytes(4).toString("hex")}`,
    timestamp: new Date(nowMs).toISOString(),
    status: "COMPLETED",
    memory_freed_heap_mb: heapFreedMb,
    telemetry_before: {
      rss_mb: before.memory.rss_mb,
      heap_used_mb: before.memory.heap_used_mb,
      pressure_level: before.memory.pressure_level,
    },
    telemetry_after: {
      rss_mb: after.memory.rss_mb,
      heap_used_mb: after.memory.heap_used_mb,
      pressure_level: after.memory.pressure_level,
    },
    actions: {
      query_cache_freed: cachePruneResult?.total_freed ?? 0,
      streams_pruned: streamsPrunedCount,
      buffers_cleared: buffersClearedCount,
      gc_triggered: gcTriggered,
      forced: Boolean(force),
    },
  };

  const evidenceSha256 = sha256Hex(stableJson(receiptPayload));

  return Object.freeze({
    ...receiptPayload,
    evidence_sha256: evidenceSha256,
  });
}

/**
 * Creates an unref'd residue watchdog that periodically inspects memory pressure
 * and triggers hygiene pruning when thresholds are exceeded.
 */
export function createResidueWatchdog({
  intervalMs = 30000,
  memoryBudgetMb = DEFAULT_MEMORY_BUDGET_MB,
  highWatermarkRatio = HIGH_WATERMARK_RATIO,
  queryCache = null,
  onPrune = null,
  enabled = true,
} = {}) {
  let timer = null;
  let running = false;
  let lastReceipt = null;
  let totalPrunes = 0;

  async function checkNow(force = false) {
    const telemetry = sampleDaemonTelemetry({ memoryBudgetMb });
    const ratio = telemetry.memory.pressure_ratio;
    if (ratio >= highWatermarkRatio || force) {
      const receipt = await pruneOperationalResidue({
        queryCache,
        memoryBudgetMb,
        force,
      });
      lastReceipt = receipt;
      totalPrunes += 1;
      if (typeof onPrune === "function") {
        try {
          onPrune(receipt);
        } catch {}
      }
      return { pruned: true, receipt };
    }
    return { pruned: false, telemetry };
  }

  function start() {
    if (running || !enabled) return;
    running = true;
    timer = setInterval(() => {
      checkNow(false).catch(() => {});
    }, Math.max(1000, intervalMs));
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }

  function stop() {
    if (!running) return;
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  if (enabled) {
    start();
  }

  return {
    start,
    stop,
    checkNow,
    getStatus: () => ({
      running,
      enabled,
      interval_ms: intervalMs,
      total_prunes: totalPrunes,
      last_receipt: lastReceipt,
    }),
  };
}
