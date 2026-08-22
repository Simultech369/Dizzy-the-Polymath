import assert from "assert";
import fs from "fs";
import path from "path";
import { ReceiptTraceViewer } from "../lib/receipt_trace_viewer.mjs";

console.log("=== Receipt Trace Replay Engine Test Suite ===");

const fixturesPath = path.resolve(process.cwd(), "scripts/fixtures/trace_replay_fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));

const viewer = new ReceiptTraceViewer();

// 1. Replay Clean Trace
const cleanFixture = fixtures.trace_clean_01;
const cleanReplay = viewer.reconstructTrace(cleanFixture.trace_id, cleanFixture.receipts);

console.log(`[PASS] Reconstructed clean trace: ${cleanReplay.trace_id}`);
console.log(`[PASS] Step count: ${cleanReplay.step_count}, Total Latency: ${cleanReplay.total_latency_ms}ms`);
console.log(`[PASS] Replay Status: ${cleanReplay.replay_status}`);

assert.strictEqual(cleanReplay.step_count, 4, "Expected 4 steps");
assert.strictEqual(cleanReplay.tamper_detected, false, "Should not detect tampering on clean trace");
assert.strictEqual(cleanReplay.replay_status, cleanFixture.expected_status);
assert.ok(cleanReplay.trace_sha256, "Trace SHA-256 must be present");

// 2. Render ASCII Machine-Room Diagram
const diagram = viewer.renderAsciiDiagram(cleanReplay);
console.log("\n" + diagram + "\n");
assert.ok(diagram.includes("DIZZY MACHINE-ROOM TRACE REPLAY"), "Diagram must have header");
assert.ok(diagram.includes("[ROUTING]"), "Diagram must show ROUTING step");
assert.ok(diagram.includes("[COUNCIL_VERIFICATION]"), "Diagram must show COUNCIL_VERIFICATION step");

// 3. Replay Tampered Trace (Skipped Council)
const tamperedFixture = fixtures.trace_tampered_skip_council;
const tamperedReplay = viewer.reconstructTrace(tamperedFixture.trace_id, tamperedFixture.receipts);

console.log(`[PASS] Tampered Trace Replay Status: ${tamperedReplay.replay_status}`);
console.log(`[PASS] Anomalies Detected: ${JSON.stringify(tamperedReplay.anomalies)}`);

assert.strictEqual(tamperedReplay.tamper_detected, true, "Must detect unverified state commit");
assert.strictEqual(tamperedReplay.replay_status, tamperedFixture.expected_status);
assert.ok(tamperedReplay.anomalies.includes("UNVERIFIED_STATE_COMMIT_WITHOUT_COUNCIL"), "Must catch unverified commit");

// Save latest receipt to reviews/ (gitignored)
const outPath = path.resolve(process.cwd(), "reviews/trace_replay_latest.json");
fs.writeFileSync(outPath, JSON.stringify(cleanReplay, null, 2), "utf8");
console.log(`[PASS] Saved trace replay receipt to: ${outPath}`);

console.log("RECEIPT_TRACE_VIEWER_TESTS_OK");
