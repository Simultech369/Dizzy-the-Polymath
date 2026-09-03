import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import { MemoryWikiAdapter } from "../lib/memory_wiki_adapter.mjs";

console.log("--- RUNNING MEMORY WIKI ADAPTER TESTS ---");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-wiki-test-"));
const adapter = new MemoryWikiAdapter(tempDir);

try {
  adapter.init();

  for (const dir of ["preferences", "projects", "models", "archive"]) {
    assert.equal(fs.existsSync(path.join(tempDir, dir)), true, `Failed to create directory: ${dir}`);
  }
  console.log("[PASS] Directories initialized successfully.");

  const mockMemory = {
    memory_id: "mem_handoff_rules",
    category: "preference",
    title: "handoffs",
    memory_class: "durable",
    confidence: 0.95,
    reinforcement_count: 5,
    freshness_window_days: 90,
    sensitivity_tier: "normal",
    trust_zone: "private_self",
    last_accessed_at: new Date().toISOString(),
    status: "active",
    source_receipt_sha256: "ABCD1234EFGH",
    content: "Always use absolute paths when passing file targets to Codex or Antigravity.",
  };

  const writtenPath = adapter.writeMemory(mockMemory);
  assert.equal(fs.existsSync(writtenPath), true, `File was not written to: ${writtenPath}`);
  console.log(`[PASS] Memory written successfully to: ${path.basename(writtenPath)}`);

  const hydratedMemory = adapter.readMemory(writtenPath);
  assert.ok(hydratedMemory, "Failed to read memory file.");
  assert.equal(hydratedMemory.memory_id, mockMemory.memory_id);
  assert.equal(hydratedMemory.confidence, mockMemory.confidence);
  assert.equal(hydratedMemory.content, mockMemory.content);
  console.log("[PASS] Memory read and deserialized successfully.");

  const injectedPath = adapter.writeMemory({
    ...mockMemory,
    memory_id: "mem_injection\nstatus: revoked",
    title: "../evil:name",
    content: "A colon: and newline\nremain safe in body content.",
  });
  assert.equal(path.relative(tempDir, injectedPath).startsWith(".."), false);
  const injectedMarkdown = fs.readFileSync(injectedPath, "utf8");
  assert.match(injectedMarkdown, /memory_id: "mem_injection status: revoked"/);
  assert.equal(adapter.readMemory(injectedPath).memory_id, "mem_injection status: revoked");
  console.log("[PASS] Frontmatter injection is neutralized.");

  assert.throws(() => adapter.readMemory(path.join(tempDir, "..", "outside.md")), /escapes/);
  console.log("[PASS] Read path traversal outside wiki root is rejected.");

  console.log("\nALL MEMORY WIKI ADAPTER TESTS PASSED CLEANLY.");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
