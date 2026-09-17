import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { startServer } from "../agent_server.mjs";
import {
  STREAM_RECEIPT_SCHEMA,
  StreamingLatencyTracker,
  buildStreamReceipt,
  buildSseFrame,
  writeSseFrame,
} from "../lib/sse_stream.mjs";

console.log("=== W-0150 Streaming Inter-Token Latency (ITL) & Health Guardrail Test Suite ===");

// -----------------------------------------------------------------------------
// Test 1: StreamingLatencyTracker Interval & Average Calculation
// -----------------------------------------------------------------------------
console.log("-> Test 1: Inter-token latency calculation...");

const tracker = new StreamingLatencyTracker({
  stallThresholdMs: 200,
  stallAbortMs: 1000,
});

// Frame 1 at t=1000
const f1 = tracker.recordFrame(1000);
assert.equal(f1.ok, true);
assert.equal(f1.itl_ms, 0);
assert.equal(f1.stalled, false);

// Frame 2 at t=1050 (ITL = 50ms)
const f2 = tracker.recordFrame(1050);
assert.equal(f2.ok, true);
assert.equal(f2.itl_ms, 50);
assert.equal(f2.stalled, false);

// Frame 3 at t=1150 (ITL = 100ms)
const f3 = tracker.recordFrame(1150);
assert.equal(f3.ok, true);
assert.equal(f3.itl_ms, 100);
assert.equal(f3.stalled, false);

const m1 = tracker.getMetrics();
assert.equal(m1.frame_count, 3);
assert.equal(m1.max_itl_ms, 100);
assert.equal(m1.avg_itl_ms, 75); // (50 + 100) / 2 = 75
assert.equal(m1.stall_count, 0);

// -----------------------------------------------------------------------------
// Test 2: Stall Detection Threshold
// -----------------------------------------------------------------------------
console.log("-> Test 2: Stall threshold detection...");

// Frame 4 at t=1400 (ITL = 250ms > 200ms threshold)
const f4 = tracker.recordFrame(1400);
assert.equal(f4.ok, true);
assert.equal(f4.itl_ms, 250);
assert.equal(f4.stalled, true, "Frame exceeding stall threshold must be flagged as stalled");

const m2 = tracker.getMetrics();
assert.equal(m2.frame_count, 4);
assert.equal(m2.max_itl_ms, 250);
assert.equal(m2.stall_count, 1, "Stall count must increment");

// -----------------------------------------------------------------------------
// Test 3: Stall Abort / Timeout Limit
// -----------------------------------------------------------------------------
console.log("-> Test 3: Stall abort limit enforcement...");

// Frame 5 at t=2500 (ITL = 1100ms > 1000ms abort threshold)
const f5 = tracker.recordFrame(2500);
assert.equal(f5.ok, false);
assert.equal(f5.status, "stream_stall_timeout");
assert.equal(f5.reason, "stream_stall_timeout");
assert.equal(f5.errorCode, "STREAM_STALL_TIMEOUT");

// -----------------------------------------------------------------------------
// Test 4: Stream Receipt Includes ITL & Stall Metrics
// -----------------------------------------------------------------------------
console.log("-> Test 4: Stream receipt projection...");

const receipt = buildStreamReceipt({
  streamId: "stream-itl-test",
  eventId: "stream-itl-test:000001",
  eventType: "stream_complete",
  status: "completed",
  reason: "result_emitted",
  framesAttempted: 5,
  framesWritten: 5,
  bytesWritten: 1200,
  maxItlMs: 250,
  avgItlMs: 80,
  stallCount: 1,
});

assert.equal(receipt.schema_version, STREAM_RECEIPT_SCHEMA);
assert.equal(receipt.max_itl_ms, 250);
assert.equal(receipt.avg_itl_ms, 80);
assert.equal(receipt.stall_count, 1);

// -----------------------------------------------------------------------------
// Test 5: Live HTTP Streaming Server Integration
// -----------------------------------------------------------------------------
console.log("-> Test 5: Live HTTP streaming execution with latency receipts...");

const testReceiptPath = path.resolve("runtime/test_stream_latency_receipts.jsonl");
if (fs.existsSync(testReceiptPath)) fs.unlinkSync(testReceiptPath);

const strongToken = "test-master-token-32-chars-minimum";
const strongExecuteToken = "test-execute-token-16-minimum";

const started = await startServer({
  port: 0,
  bindHost: "127.0.0.1",
  authToken: strongToken,
  executeToken: strongExecuteToken,
  redisUrl: "",
  streamReceiptPath: testReceiptPath,
  streamStallThresholdMs: 500,
  streamStallAbortMs: 5000,
});

try {
  const reqBody = {
    brief: "test streaming latency",
    continuity_mode: "ephemeral",
  };

  const response = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${strongExecuteToken}`,
      "idempotency-key": "itl-test-key-001",
    },
    body: JSON.stringify(reqBody),
  });

  const responseText = await response.text();
  assert.ok(responseText.includes('"event_type":"stream_start"'));
  assert.ok(responseText.includes('"event_type":"stream_complete"'));
  assert.ok(responseText.includes("event: stream_receipt"));
  assert.ok(responseText.includes("event: agent_result"));

  // Check persisted stream receipts on disk
  assert.ok(fs.existsSync(testReceiptPath), "Stream receipts log must exist");
  const rawLines = fs.readFileSync(testReceiptPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
  assert.ok(rawLines.length >= 2, "At least start and complete receipts must be recorded");

  const receipts = rawLines.map((line) => JSON.parse(line));
  const completeReceipt = receipts.find((r) => r.event_type === "stream_complete");
  assert.ok(completeReceipt, "stream_complete receipt must be present");
  assert.equal(completeReceipt.status, "completed");
  assert.ok(completeReceipt.frames_written >= 2);
  assert.ok(Number.isFinite(completeReceipt.max_itl_ms));
  assert.ok(Number.isFinite(completeReceipt.avg_itl_ms));
  assert.ok(completeReceipt.stall_count >= 0);

} finally {
  await started.stop();
  if (fs.existsSync(testReceiptPath)) fs.unlinkSync(testReceiptPath);
}

console.log("[PASS] All streaming ITL and latency guardrail tests passed.");
console.log("STREAMING_LATENCY_GUARD_TESTS_OK");
