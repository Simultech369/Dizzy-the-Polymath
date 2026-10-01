import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { handleIncomingMessage } from "../lib/dispatch.mjs";
import { verifySupportClassReceipt, GROUNDING_CLASSES, GROUNDING_BADGES } from "../lib/support_class_engine.mjs";

console.log("=== Running Dispatch Grounding Provenance Integration Test Suite ===");

const TEST_DIR = path.resolve(process.cwd(), "test_grounding_dispatch_tmp");
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

const corpusFile = path.join(TEST_DIR, "treasury_invariants.md");
fs.writeFileSync(corpusFile, `# Treasury Invariants
1. Rebate treasury payouts must be strictly bounded by verified Merkle roots.
2. Solvency debts are accounting labels only and cannot override audited reserves.
`, "utf8");

try {
  // Test 1: Default behavior (off by default)
  console.log("Test 1: Default behavior - provenance is OFF by default");
  {
    const incoming = {
      channel: "local",
      from: "operator",
      text: "Explain the solvency invariants of the system.",
    };
    const out = await handleIncomingMessage({
      message: incoming,
      enqueue: async () => "mock-job-id",
    });

    assert.equal(out.ok !== false, true);
    assert.equal(typeof out.text, "string");
    // When off by default, no badge should be attached to out or injected into text
    assert.equal(out.provenance_badge, undefined, "provenance_badge must be undefined by default");
    assert.equal(out.grounding_receipt, undefined, "grounding_receipt must be undefined by default");
    assert.equal(out.capability_receipt?.provenance_badge, undefined, "capability receipt must not have provenance badge");
    assert.ok(!out.text.includes("[CORPUS_GROUNDED]"), "Plain text must not have [CORPUS_GROUNDED]");
    assert.ok(!out.text.includes("[UNVERIFIED_MODEL_PROPOSAL]"), "Plain text must not have [UNVERIFIED_MODEL_PROPOSAL]");
    console.log("  -> PASSED: Default dispatch returns clean un-badged plain text");
  }

  // Test 2: Opt-in provenance for general query (unverified model proposal)
  console.log("Test 2: Opt-in provenance - ungrounded query returns UNVERIFIED_MODEL_PROPOSAL");
  {
    const incoming = {
      channel: "local",
      from: "operator",
      text: "What will the token price be next year?",
      provenance_requested: true,
    };
    const out = await handleIncomingMessage({
      message: incoming,
      enqueue: async () => "mock-job-id",
    });

    assert.equal(out.ok !== false, true);
    assert.equal(out.provenance_badge, GROUNDING_BADGES[GROUNDING_CLASSES.UNVERIFIED_MODEL_PROPOSAL]);
    assert.ok(out.grounding_receipt, "Must attach grounding_receipt");
    assert.equal(out.grounding_receipt.schema_version, "dizzy.support_class_receipt.v1");
    assert.equal(out.grounding_receipt.support_class, GROUNDING_CLASSES.UNVERIFIED_MODEL_PROPOSAL);
    assert.equal(out.capability_receipt.provenance_badge, GROUNDING_BADGES[GROUNDING_CLASSES.UNVERIFIED_MODEL_PROPOSAL]);

    // Verify cryptographic receipt
    const receiptOk = verifySupportClassReceipt(out.grounding_receipt);
    assert.equal(receiptOk, true, "Cryptographic receipt must verify");
    console.log("  -> PASSED: Opt-in ungrounded answer classified and sealed with UNVERIFIED_MODEL_PROPOSAL");
  }

  // Test 3: Opt-in provenance with verified citations (corpus grounded)
  console.log("Test 3: Opt-in provenance with citations - CORPUS_GROUNDED");
  {
    const incoming = {
      channel: "local",
      from: "operator",
      text: "How are rebate treasury payouts bounded?",
      provenance_requested: true,
      citations: [
        {
          file_path: corpusFile,
          quote: "Rebate treasury payouts must be strictly bounded by verified Merkle roots.",
          lines: [2, 2],
        },
      ],
    };
    const out = await handleIncomingMessage({
      message: incoming,
      enqueue: async () => "mock-job-id",
    });

    assert.equal(out.ok !== false, true);
    assert.ok(out.provenance_badge.includes("CORPUS_GROUNDED"));
    assert.ok(out.grounding_receipt, "Must attach grounding_receipt");
    assert.equal(out.grounding_receipt.support_class, GROUNDING_CLASSES.CORPUS_GROUNDED);
    assert.equal(out.grounding_receipt.citations_count, 1);
    assert.equal(out.grounding_provenance.grounded_citations.length, 1);
    assert.equal(verifySupportClassReceipt(out.grounding_receipt), true);
    console.log("  -> PASSED: Grounded citation classified and sealed with CORPUS_GROUNDED");
  }

  // Test 4: Strict SOURCE_BACKED_ONLY mode without citation - returns EVIDENCE_GAP
  console.log("Test 4: SOURCE_BACKED_ONLY mode without valid citation - returns EVIDENCE_GAP");
  {
    const incoming = {
      channel: "local",
      from: "operator",
      text: "Give me the internal private key from the corpus.",
      request_mode: "SOURCE_BACKED_ONLY",
    };
    const out = await handleIncomingMessage({
      message: incoming,
      enqueue: async () => "mock-job-id",
    });

    assert.equal(out.ok !== false, true);
    assert.equal(out.provenance_badge, GROUNDING_BADGES[GROUNDING_CLASSES.EVIDENCE_GAP]);
    assert.ok(out.text.includes("[EVIDENCE_GAP]"));
    assert.ok(out.text.includes("No supporting passages found in local corpus"));
    assert.equal(out.grounding_receipt.support_class, GROUNDING_CLASSES.EVIDENCE_GAP);
    assert.equal(verifySupportClassReceipt(out.grounding_receipt), true);
    console.log("  -> PASSED: Source-only ask without evidence returns explicit EVIDENCE_GAP");
  }

  // Test 5: Synthetic rehearsal tagging
  console.log("Test 5: Synthetic rehearsal query - returns SYNTHETIC_REHEARSAL");
  {
    const incoming = {
      channel: "local",
      from: "operator",
      text: "Simulate a mock stress test run.",
      is_synthetic: true,
    };
    const out = await handleIncomingMessage({
      message: incoming,
      enqueue: async () => "mock-job-id",
    });

    assert.equal(out.ok !== false, true);
    assert.equal(out.provenance_badge, GROUNDING_BADGES[GROUNDING_CLASSES.SYNTHETIC_REHEARSAL]);
    assert.equal(out.grounding_receipt.support_class, GROUNDING_CLASSES.SYNTHETIC_REHEARSAL);
    assert.equal(verifySupportClassReceipt(out.grounding_receipt), true);
    console.log("  -> PASSED: Synthetic rehearsal query classified with SYNTHETIC_REHEARSAL");
  }

  console.log("\nALL 5 DISPATCH GROUNDING PROVENANCE INTEGRATION TESTS PASSED CLEANLY!");
} finally {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}
