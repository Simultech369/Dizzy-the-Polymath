import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { UnifiedAuditLedger, UNIFIED_AUDIT_REPLAY_SCHEMA } from "../lib/unified_audit_ledger.mjs";

console.log("=== Unified Hash-Linked Audit Ledger & Debug Replay Suite ===");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-audit-ledger-"));
const ledgerPath = path.join(tempDir, "unified_audit.jsonl");

try {
  const ledger = new UnifiedAuditLedger({ ledgerPath });
  const e1 = ledger.append({
    surface: "ingress",
    eventType: "SESSION_STARTED",
    correlationId: "run_debug_01",
    trustZone: "private_self",
    summary: "User alice@example.com initiated local request with Bearer sk-secretkey1234567890123456",
    metadata: { raw_prompt: "sensitive prompt body", step: 1 },
  });
  const e2 = ledger.append({
    surface: "tool_guardrail",
    eventType: "TOOL_GUARDED",
    correlationId: "run_debug_01",
    trustZone: "private_self",
    workflowState: "completed",
    summary: "Executed read_file safely",
    prevHashCheck: e1.entry_hash,
  });

  assert.equal(e2.prev_hash, e1.entry_hash);
  // Secrets/emails redacted, raw_prompt hashed instead of stored raw
  assert.doesNotMatch(e1.summary, /alice@example\.com/);
  assert.ok(e1.metadata.raw_prompt_sha256);
  assert.equal(e1.metadata.raw_prompt, undefined);

  const verifyOk = ledger.verifyChain();
  assert.equal(verifyOk.valid, true);
  assert.equal(verifyOk.entry_count, 2);

  // Replay correlation for Inspect / Replay (kept separate from main chat UI)
  const replay = ledger.replayCorrelation("run_debug_01");
  assert.equal(replay.schema_version, UNIFIED_AUDIT_REPLAY_SCHEMA);
  assert.equal(replay.not_for_end_user_chat, true);
  assert.equal(replay.chain_verified, true);
  assert.equal(replay.step_count, 2);

  // Tamper with entry 1 and verify chain break is caught
  const lines = fs.readFileSync(ledgerPath, "utf8").trim().split("\n");
  const mutated = JSON.parse(lines[0]);
  mutated.summary = "Tampered summary";
  lines[0] = JSON.stringify(mutated);
  fs.writeFileSync(ledgerPath, lines.join("\n") + "\n", "utf8");

  const verifyTampered = ledger.verifyChain();
  assert.equal(verifyTampered.valid, false);
  assert.equal(verifyTampered.broken_at_seq, 1);

  console.log("UNIFIED_AUDIT_LEDGER_TESTS_OK");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
