import assert from "node:assert/strict";
import {
  SupportClassEngine,
  SUPPORT_CLASSES,
  SUPPORT_CLASS_RECEIPT_SCHEMA,
  CITATION_NOT_PROOF_DISCLAIMER,
  verifySupportClassReceipt,
} from "../lib/support_class_engine.mjs";

console.log("[SUPPORT_CLASS_ENGINE_TEST] Starting test suite...");

const engine = new SupportClassEngine({
  now: () => new Date("2026-10-01T12:00:00.000Z"),
});

const sampleContextPackets = {
  "docs/architecture.md": [
    "# Architecture",
    "Dizzy uses deterministic consensus over immutable Merkle trees.",
    "No claim is accepted without cryptographic receipt verification.",
  ].join("\n"),
};

// Test 1: Grounded answer supported by local passage
{
  const res = engine.classifyAnswer({
    query: "How does Dizzy reach consensus?",
    answerText: "Dizzy uses deterministic consensus over immutable Merkle trees.",
    requestMode: "SOURCE_BACKED_ONLY",
    citations: [
      {
        file_path: "docs/architecture.md",
        quote: "Dizzy uses deterministic consensus over immutable Merkle trees.",
        lines: [2, 2],
      },
    ],
    contextPackets: sampleContextPackets,
  });

  assert.equal(res.ok, true);
  assert.equal(res.support_class, SUPPORT_CLASSES.SUPPORTED_BY_LOCAL_PASSAGE);
  assert.match(res.provenance_badge, /\[SUPPORTED_BY_LOCAL_PASSAGE: 1 citation\(s\)\]/);
  assert.equal(res.grounded_citations.length, 1);
  assert.equal(res.grounded_citations[0].verified, true);
  assert.match(res.rendered_markdown, /Citation proves textual presence in local corpus/);
  assert.equal(res.receipt.schema_version, SUPPORT_CLASS_RECEIPT_SCHEMA);
  assert.equal(res.receipt.citations_count, 1);
  assert.equal(verifySupportClassReceipt(res.receipt), true);
  console.log("  [PASS] Test 1: Supported by local passage verified");
}

// Test 2: Evidence-gap response under SOURCE_BACKED_ONLY mode
{
  const res = engine.classifyAnswer({
    query: "What is the token cost of GPT-5 in Dizzy?",
    answerText: "GPT-5 costs $0.002 per token.",
    requestMode: "SOURCE_BACKED_ONLY",
    citations: [], // zero citations
    contextPackets: sampleContextPackets,
  });

  assert.equal(res.ok, false, "Must fail closed on evidence gap in SOURCE_BACKED_ONLY mode");
  assert.equal(res.support_class, SUPPORT_CLASSES.EVIDENCE_GAP);
  assert.equal(res.provenance_badge, "[EVIDENCE_GAP]");
  assert.match(res.answer_text, /\[EVIDENCE_GAP\] No supporting passages found/);
  assert.equal(res.receipt.evidence_gap, true);
  assert.ok(res.receipt.gap_reason);
  assert.equal(verifySupportClassReceipt(res.receipt), true);
  console.log("  [PASS] Test 2: Evidence-gap response enforced without hallucination");
}

// Test 3: Evidence-gap response when citations are phantom / invalid
{
  const res = engine.classifyAnswer({
    query: "What is the consensus algorithm?",
    answerText: "Proof of Stake is used.",
    requestMode: "SOURCE_BACKED_ONLY",
    citations: [
      {
        file_path: "docs/architecture.md",
        quote: "Proof of Stake is used across all nodes.", // Phantom quote not in doc
        lines: [1, 2],
      },
    ],
    contextPackets: sampleContextPackets,
  });

  assert.equal(res.ok, false);
  assert.equal(res.support_class, SUPPORT_CLASSES.EVIDENCE_GAP);
  assert.equal(verifySupportClassReceipt(res.receipt), true);
  console.log("  [PASS] Test 3: Phantom citations trigger evidence gap under SOURCE_BACKED_ONLY");
}

// Test 4: Unverified model explanation in HYBRID mode
{
  const res = engine.classifyAnswer({
    query: "Can you explain why Merkle trees are efficient?",
    answerText: "Merkle trees enable logarithmic verification of set membership using cryptographic hashes.",
    requestMode: "HYBRID",
    citations: [],
    contextPackets: sampleContextPackets,
  });

  assert.equal(res.ok, true);
  assert.equal(res.support_class, SUPPORT_CLASSES.UNVERIFIED_MODEL_EXPLANATION);
  assert.equal(res.provenance_badge, "[UNVERIFIED_MODEL_EXPLANATION]");
  assert.match(res.rendered_markdown, /Zero Grounding Authority/);
  assert.equal(res.receipt.evidence_gap, false);
  assert.equal(verifySupportClassReceipt(res.receipt), true);
  console.log("  [PASS] Test 4: Unverified model explanation appropriately tagged");
}

// Test 5: Synthetic rehearsal tagging
{
  const res = engine.classifyAnswer({
    query: "Simulate trade execution",
    answerText: "Simulated 500 shares traded at $10.00.",
    isSynthetic: true,
  });

  assert.equal(res.ok, true);
  assert.equal(res.support_class, SUPPORT_CLASSES.SYNTHETIC_REASONING_ONLY);
  assert.equal(res.provenance_badge, "[SYNTHETIC_REASONING_ONLY]");
  assert.match(res.rendered_markdown, /production authority = false/);
  assert.equal(verifySupportClassReceipt(res.receipt), true);
  console.log("  [PASS] Test 5: Synthetic rehearsal output properly segregated");
}

// Test 6: Invariant "Citation != Proof" disclaimer presence
{
  const res = engine.classifyAnswer({
    query: "Check rule",
    answerText: "Rule text.",
    requestMode: "HYBRID",
  });

  assert.equal(res.receipt.disclaimer, CITATION_NOT_PROOF_DISCLAIMER);
  console.log("  [PASS] Test 6: Citation != proof disclaimer invariant present");
}

// Test 7: Tamper resistance of support class receipts
{
  const res = engine.classifyAnswer({
    query: "Verification test",
    answerText: "Testing receipt tamper checks.",
    requestMode: "HYBRID",
  });

  assert.equal(verifySupportClassReceipt(res.receipt), true);

  // Tamper with claim_id
  const tampered1 = { ...res.receipt, claim_id: "forged_claim" };
  assert.equal(verifySupportClassReceipt(tampered1), false);

  // Tamper with support_class
  const tampered2 = { ...res.receipt, support_class: "SUPPORTED_BY_LOCAL_PASSAGE" };
  assert.equal(verifySupportClassReceipt(tampered2), false);

  // Tamper with evidence hash
  const tampered3 = { ...res.receipt, evidence_sha256: "0000000000000000000000000000000000000000000000000000000000000000" };
  assert.equal(verifySupportClassReceipt(tampered3), false);

  console.log("  [PASS] Test 7: Cryptographic tamper resistance validated");
}

console.log("[SUPPORT_CLASS_ENGINE_TEST] All 7 tests passed successfully.");
