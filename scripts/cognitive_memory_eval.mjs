import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  COGNITIVE_MEMORY_SCHEMA,
  COGNITIVE_MEMORY_RECEIPT_SCHEMA,
  COGNITIVE_MEMORY_EVICTION_RECEIPT_SCHEMA,
  COGNITIVE_MEMORY_PACK_SCHEMA,
  CognitiveMemoryEngine,
  classifyForCapture,
  inferImportance,
} from "../lib/cognitive_memory_engine.mjs";

console.log("[eval:cognitive-memory] Starting Cognitive Memory Evaluation Suite...");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-cognitive-eval-"));
const wikiRootPath = path.join(tempDir, "wiki");
const packPath = path.join(tempDir, "memory_pack.dizpack");

try {
  const fixedNow = new Date("2026-10-01T12:00:00.000Z");
  const engine = new CognitiveMemoryEngine({
    wikiRootPath,
    now: () => fixedNow,
    decayHalfLifeDays: 30,
    archiveBelowConfidence: 0.15,
  });

  // TEST 1: Importance inference & capture classification
  {
    const invariantClass = classifyForCapture({
      content: "Fiduciary invariant: never release funds without dual-control counter-signature.",
      trustZone: "private_self",
    });
    assert.equal(invariantClass.decision, "capture");
    assert.equal(invariantClass.memory_class, "durable");
    assert.ok(invariantClass.importance >= 0.85, `Expected high importance, got ${invariantClass.importance}`);

    const transientClass = classifyForCapture({
      content: "Temporary debug note for today's run only.",
      trustZone: "private_self",
    });
    assert.equal(transientClass.decision, "capture");
    assert.equal(transientClass.memory_class, "expiring");
    assert.ok(transientClass.importance <= 0.40, `Expected low importance, got ${transientClass.importance}`);

    console.log("  [PASS] Test 1: Importance inference correctly scores invariants vs transient notes");
  }

  // TEST 2: Invariant immunity to time decay
  {
    // Capture high-importance durable invariant (importance >= 0.8)
    const invariant = engine.capture({
      content: "Security invariant: Never allow unauthenticated operator execution on private boundary.",
      canonicalKey: "sec-boundary-invariant",
      importance: 0.95,
      confidence: 0.90,
      memoryClass: "durable",
    });
    assert.equal(invariant.decision, "captured");

    // Capture standard durable memory (importance = 0.5)
    const standardDurable = engine.capture({
      content: "Always format git commit messages with short prefix tags.",
      canonicalKey: "git-commit-tag-style",
      importance: 0.50,
      confidence: 0.70,
      memoryClass: "durable",
    });
    assert.equal(standardDurable.decision, "captured");

    // Capture expiring memory
    const expiring = engine.capture({
      content: "Temporary sprint goal: complete dark factory verification this week.",
      canonicalKey: "sprint-goal-dark-factory",
      importance: 0.30,
      confidence: 0.80,
      memoryClass: "expiring",
      expiresAt: new Date("2026-10-15T12:00:00.000Z"),
    });
    assert.equal(expiring.decision, "captured");

    // Advance time 180 days (6 half-lives)
    const futureTime = new Date("2027-04-01T12:00:00.000Z");
    const decayResult = engine.decay({ now: futureTime });

    assert.ok(decayResult.decayed_count >= 1, "Expected at least 1 memory to decay");
    assert.ok(decayResult.archived_count >= 1, "Expected expiring memory to be archived");

    const memoriesAfterDecay = engine.list({ includeArchived: true });

    // The high-importance invariant MUST remain 100% untouched and active
    const immuneMemory = memoriesAfterDecay.find((m) => m.canonical_key === "sec-boundary-invariant");
    assert.equal(immuneMemory.status, "active", "High-importance durable memory must stay active");
    assert.equal(immuneMemory.confidence, 0.90, "High-importance durable memory must NOT decay confidence");

    // The standard durable memory should have decayed confidence
    const decayedMemory = memoriesAfterDecay.find((m) => m.canonical_key === "git-commit-tag-style");
    assert.ok(decayedMemory.confidence < 0.70, `Expected confidence < 0.70, got ${decayedMemory.confidence}`);

    // The expiring memory MUST be archived due to expiration
    const expiredMemory = memoriesAfterDecay.find((m) => m.canonical_key === "sprint-goal-dark-factory");
    assert.equal(expiredMemory.status, "archived");
    assert.equal(expiredMemory.archive_reason, "expired");

    console.log("  [PASS] Test 2: Invariant immunity protects high-importance memories from decay");
  }

  // TEST 3: Pressure eviction under resource constraints
  {
    // Add additional active memories of varying importance
    engine.capture({
      content: "Governance invariant: All public receipts must bind SHA-256 git head.",
      canonicalKey: "gov-receipt-git-binding",
      importance: 0.98,
      confidence: 0.95,
      memoryClass: "durable",
    });

    engine.capture({
      content: "Optional scratch note: test buffer allocation efficiency tomorrow.",
      canonicalKey: "scratch-buffer-note",
      importance: 0.20,
      confidence: 0.50,
      memoryClass: "expiring",
    });

    engine.capture({
      content: "Local operator note: prefer concise terminal logs during automated runs.",
      canonicalKey: "operator-log-style",
      importance: 0.40,
      confidence: 0.60,
      memoryClass: "durable",
    });

    const preEvictActive = engine.list();
    assert.ok(preEvictActive.length >= 4);

    // Evict under pressure targeting a max of 2 memories
    const evictionResult = engine.evictUnderPressure({ maxMemories: 2 });

    assert.ok(evictionResult.evicted_count > 0, "Eviction must evict items to satisfy maxMemories");
    assert.equal(evictionResult.receipt.schema_version, COGNITIVE_MEMORY_EVICTION_RECEIPT_SCHEMA);
    assert.match(evictionResult.receipt.receipt_sha256, /^[a-f0-9]{64}$/i);
    assert.ok(evictionResult.immune_retained_count >= 2, "Immune invariants must be protected");

    const remainingActive = engine.list();
    assert.equal(remainingActive.length, 2);

    // Verify remaining active are the two highest-importance durable invariants
    const remainingKeys = remainingActive.map((m) => m.canonical_key);
    assert.ok(remainingKeys.includes("sec-boundary-invariant"), "sec-boundary-invariant must survive eviction");
    assert.ok(remainingKeys.includes("gov-receipt-git-binding"), "gov-receipt-git-binding must survive eviction");

    // Verify low-importance memories were archived with "pressure_eviction"
    const archived = engine.list({ includeArchived: true }).filter((m) => m.status === "archived");
    assert.ok(archived.some((m) => m.archive_reason === "pressure_eviction"));

    console.log("  [PASS] Test 3: Eviction under pressure evicts lowest-scored memories and preserves immune invariants");
  }

  // TEST 4: Verified pack export and tamper-resistant integrity verification
  let exportedPack;
  {
    exportedPack = engine.exportVerifiedPack({
      packPath,
      title: "Core Governance Invariants Pack",
      description: "Signed distribution pack containing core invariants and operational rules",
      author: "dizzy.council",
    });

    assert.equal(exportedPack.memory_count, 2);
    assert.match(exportedPack.pack_sha256, /^[a-f0-9]{64}$/i);
    assert.ok(fs.existsSync(packPath));

    const packData = JSON.parse(fs.readFileSync(packPath, "utf8"));
    assert.equal(packData.schema_version, COGNITIVE_MEMORY_PACK_SCHEMA);
    assert.equal(packData.pack_sha256, exportedPack.pack_sha256);
    assert.ok(packData.non_claims.some((c) => c.includes("Pack verification proves textual integrity")));
    assert.equal(packData.entries.length, 2);

    console.log("  [PASS] Test 4: Export verified pack writes manifest, SHA-256 checksums, and non-claims");
  }

  // TEST 5: Clean reload into fresh engine from verified pack
  {
    const freshWikiDir = path.join(tempDir, "fresh_wiki");
    const freshEngine = new CognitiveMemoryEngine({ wikiRootPath: freshWikiDir });

    const loadResult = freshEngine.loadFromVerifiedPack({
      packPath,
      expectedSha256: exportedPack.pack_sha256,
    });

    assert.equal(loadResult.status, "verified_mounted");
    assert.equal(loadResult.mounted_count, 2);
    assert.equal(loadResult.pack_sha256, exportedPack.pack_sha256);

    const freshActive = freshEngine.list();
    assert.equal(freshActive.length, 2);
    assert.ok(freshActive.some((m) => m.canonical_key === "sec-boundary-invariant"));
    assert.ok(freshActive.some((m) => m.canonical_key === "gov-receipt-git-binding"));

    console.log("  [PASS] Test 5: Fresh engine mounts verified pack with full integrity verification");
  }

  // TEST 6: Tamper detection & rejection (entry content tampering)
  {
    const tamperedPackPath = path.join(tempDir, "tampered_entry.dizpack");
    const packData = JSON.parse(fs.readFileSync(packPath, "utf8"));
    // Tamper with the content of the first entry without updating its hash
    packData.entries[0].content = "TAMPERED: Maliciously altered invariant rule!";
    fs.writeFileSync(tamperedPackPath, JSON.stringify(packData, null, 2), "utf8");

    const freshEngine = new CognitiveMemoryEngine({ wikiRootPath: path.join(tempDir, "tampered_wiki") });

    assert.throws(
      () => freshEngine.loadFromVerifiedPack({ packPath: tamperedPackPath, allowUnverified: true }),
      /Entry integrity verification failed|tamper detected/i,
      "Engine must fail closed when pack entry content is tampered"
    );

    console.log("  [PASS] Test 6: Fail-closed rejection on tampered entry content");
  }

  // TEST 7: Tamper detection & rejection (envelope checksum mismatch)
  {
    const tamperedEnvelopePath = path.join(tempDir, "tampered_envelope.dizpack");
    const packData = JSON.parse(fs.readFileSync(packPath, "utf8"));
    // Tamper with title but keep old pack_sha256
    packData.title = "Altered title without updating pack_sha256";
    fs.writeFileSync(tamperedEnvelopePath, JSON.stringify(packData, null, 2), "utf8");

    const freshEngine = new CognitiveMemoryEngine({ wikiRootPath: path.join(tempDir, "tampered_env_wiki") });

    assert.throws(
      () => freshEngine.loadFromVerifiedPack({ packPath: tamperedEnvelopePath }),
      /envelope checksum mismatch|tamper detected/i,
      "Engine must fail closed when envelope checksum does not match payload"
    );

    // Also test expectedSha256 mismatch
    assert.throws(
      () => freshEngine.loadFromVerifiedPack({
        packPath,
        expectedSha256: "0000000000000000000000000000000000000000000000000000000000000000",
      }),
      /Pack checksum verification failed/i,
      "Engine must reject pack if expectedSha256 does not match"
    );

    console.log("  [PASS] Test 7: Fail-closed rejection on envelope checksum mismatch or wrong expected hash");
  }

  console.log("\n[eval:cognitive-memory] ALL 7 EVALUATION TESTS PASSED CLEANLY.\n");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
