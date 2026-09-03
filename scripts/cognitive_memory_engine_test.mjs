import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  A2A_MEMORY_UPDATE_SCHEMA,
  COGNITIVE_MEMORY_RECEIPT_SCHEMA,
  COGNITIVE_MEMORY_WIKI_SCHEMA,
  CognitiveMemoryEngine,
  classifyForCapture,
  createA2AMemoryUpdateEnvelope,
} from "../lib/cognitive_memory_engine.mjs";

console.log("[test:cognitive-memory] Starting Cognitive Memory Engine tests...");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-cognitive-memory-"));
const wikiRootPath = path.join(tempDir, "wiki");
const legacyStorePath = path.join(tempDir, "memory.json");

function readWiki(relPath) {
  return fs.readFileSync(path.join(wikiRootPath, relPath), "utf8");
}

try {
  const fixedNow = new Date("2026-08-28T12:00:00.000Z");
  const engine = new CognitiveMemoryEngine({
    wikiRootPath,
    now: () => fixedNow,
    decayHalfLifeDays: 30,
    archiveBelowConfidence: 0.2,
  });

  {
    const noisy = classifyForCapture({ content: "ugh ok", trustZone: "private_self" });
    assert.equal(noisy.decision, "drop");

    const durable = classifyForCapture({
      content: "Always use absolute paths in handoff artifacts for Josh.",
      trustZone: "private_self",
    });
    assert.equal(durable.decision, "capture");
    assert.equal(durable.memory_class, "durable");

    console.log("  [PASS] Test 1: Capture filter drops noise and keeps durable rules");
  }

  let absolutePathMemory;
  {
    const captured = engine.capture({
      content: "Always use absolute paths in handoff artifacts for Josh.",
      canonicalKey: "handoff-path-style",
      confidence: 0.82,
      sensitivityTier: "normal",
      provenance: { source: "operator_reviewed" },
    });
    assert.equal(captured.decision, "captured");
    assert.equal(captured.receipt.schema_version, COGNITIVE_MEMORY_RECEIPT_SCHEMA);
    assert.equal(captured.receipt.storage, "markdown_wiki");
    assert.equal(captured.memory.memory_class, "durable");
    absolutePathMemory = captured.memory;

    assert.ok(fs.existsSync(path.join(wikiRootPath, "index.md")));
    assert.ok(fs.existsSync(path.join(wikiRootPath, "log.md")));
    assert.ok(fs.existsSync(path.join(wikiRootPath, "SCHEMA.md")));
    assert.ok(fs.existsSync(path.join(wikiRootPath, "entries", "handoff-path-style.md")));
    assert.equal(fs.existsSync(legacyStorePath), false, "Engine must not write a flat JSON memory store");

    const index = readWiki("index.md");
    assert.ok(index.includes(COGNITIVE_MEMORY_WIKI_SCHEMA));
    assert.ok(index.includes("[handoff-path-style](entries/handoff-path-style.md)"));
    const page = readWiki(path.join("entries", "handoff-path-style.md"));
    assert.ok(page.includes("## Content"));
    assert.ok(page.includes("Always use absolute paths"));
    assert.ok(page.includes("[Wiki Index](../index.md)"));

    const duplicate = engine.capture({
      content: "Always use full absolute file paths when preparing handoff artifacts.",
      canonicalKey: "handoff-path-style",
      confidence: 0.84,
    });
    assert.equal(duplicate.decision, "consolidated");
    assert.equal(duplicate.memory.reinforcement_count, 2);
    assert.ok(readWiki(path.join("entries", "handoff-path-style.md")).includes("Consolidated note"));

    console.log("  [PASS] Test 2: Markdown wiki capture writes index, log, schema, and page updates");
  }

  {
    const reloaded = new CognitiveMemoryEngine({ wikiRootPath, now: () => fixedNow });
    const loaded = reloaded.list();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].canonical_key, "handoff-path-style");
    assert.equal(loaded[0].page_path, "entries/handoff-path-style.md");

    console.log("  [PASS] Test 3: Engine reloads compiled memories from Markdown pages");
  }

  {
    const conflict = engine.capture({
      content: "Do not use absolute paths in handoff artifacts.",
      canonicalKey: "handoff-path-style",
      confidence: 0.7,
    });
    assert.equal(conflict.decision, "flag_conflict");
    assert.equal(conflict.receipt.action, "reconcile");
    assert.equal(conflict.conflicts.length, 1);
    assert.equal(conflict.conflicts[0].wiki_page, "entries/handoff-path-style.md");
    assert.ok(readWiki("log.md").includes("reconcile | flag_conflict"));

    console.log("  [PASS] Test 4: Reconcile stage flags contradictory memories in the wiki log");
  }

  {
    engine.capture({
      content: "Currently prioritize rigorous testing over speed for public-facing changes.",
      canonicalKey: "public-readiness-priority",
      confidence: 0.88,
      memoryClass: "expiring",
      sensitivityTier: "public_safe",
    });

    const privateOnly = engine.capture({
      content: "Never export private collaborator notes outside the trusted boundary.",
      canonicalKey: "private-boundary",
      confidence: 0.95,
      sensitivityTier: "do_not_export",
    });
    assert.equal(privateOnly.decision, "captured");

    const privateResult = engine.retrieve("handoff absolute paths testing public collaborator", {
      trustZone: "private_self",
      limit: 3,
    });
    assert.ok(privateResult.memories.some((m) => m.memory_id === absolutePathMemory.memory_id));
    assert.equal(privateResult.receipt.traversal_index, undefined);
    assert.equal(privateResult.receipt.details.traversal_index, "index.md");
    assert.ok(privateResult.memories.every((m) => m.wiki_page.endsWith(".md")));

    const publicResult = engine.retrieve("private collaborator notes trusted boundary", {
      trustZone: "paid_public",
      limit: 5,
    });
    assert.equal(publicResult.memories.some((m) => m.sensitivity_tier === "do_not_export"), false);

    console.log("  [PASS] Test 5: Retrieve scores relevant pages and enforces trust-zone filtering");
  }

  {
    const oldNow = new Date("2027-02-28T12:00:00.000Z");
    const decayed = engine.decay({ now: oldNow });
    assert.ok(decayed.decayed_count >= 1);
    assert.equal(decayed.receipt.action, "decay");

    const expiring = engine.list({ includeArchived: true }).find((m) => m.canonical_key === "public-readiness-priority");
    assert.equal(expiring.status, "archived");
    assert.equal(expiring.archive_reason, "expired");
    assert.ok(readWiki("index.md").includes("## Archived Memories"));
    assert.ok(readWiki(path.join("entries", "public-readiness-priority.md")).includes("Status: archived"));

    console.log("  [PASS] Test 6: Decay updates Markdown pages and archives expired memories");
  }

  {
    const envelope = createA2AMemoryUpdateEnvelope({
      fromAgent: "openclaude",
      toAgent: "codex",
      updateType: "capture",
      receipt: engine.retrieve("handoff absolute paths", { trustZone: "trusted_collaborator" }).receipt,
      memories: engine.list(),
      trustZone: "trusted_collaborator",
      includeContent: true,
      now: () => fixedNow,
    });
    assert.equal(envelope.message_type, "memory_update");
    assert.equal(envelope.payload.schema_version, A2A_MEMORY_UPDATE_SCHEMA);
    assert.equal(envelope.payload.storage, "markdown_wiki");
    assert.equal(envelope.payload.traversal_index, "memory/wiki/index.md");
    assert.equal(envelope.payload.memories.some((m) => m.content && m.sensitivity_tier === "do_not_export"), false);
    assert.ok(envelope.payload.memories.every((m) => m.wiki_page.endsWith(".md")));
    assert.match(envelope.payload.payload_sha256, /^[A-F0-9]{64}$/);

    assert.throws(() => createA2AMemoryUpdateEnvelope({
      fromAgent: "openclaude",
      toAgent: "codex",
      updateType: "capture",
      receipt: envelope.payload,
      memories: engine.list(),
      trustZone: "paid_public",
      includeContent: true,
    }), /Cannot export raw memory content/);

    console.log("  [PASS] Test 7: A2A memory update envelope carries wiki references and respects export boundary");
  }

  assert.ok(fs.existsSync(path.join(wikiRootPath, "index.md")), "Expected Markdown wiki index to be written");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log("\n[test:cognitive-memory] ALL 7 TESTS PASSED CLEANLY.\n");
