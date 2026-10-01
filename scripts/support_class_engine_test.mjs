import assert from "node:assert/strict";
import {
  GroundingProvenanceEngine,
  SupportClassEngine,
  GROUNDING_CLASSES,
  SUPPORT_CLASSES,
  GROUNDING_BADGES,
  GROUNDING_PROVENANCE_RECEIPT_SCHEMA,
  CITATION_NOT_PROOF_DISCLAIMER,
  verifyGroundingProvenanceReceipt,
  verifySupportClassReceipt,
} from "../lib/support_class_engine.mjs";

console.log("[GROUNDING_PROVENANCE_TEST] Starting test suite...");

const engine = new GroundingProvenanceEngine({
  now: () => new Date("2026-10-01T12:00:00.000Z"),
});

const sampleContextPackets = {
  "docs/architecture.md": [
    "# Architecture",
    "Dizzy uses deterministic consensus over immutable Merkle trees.",
    "No claim is accepted without cryptographic receipt verification.",
  ].join("\n"),
};

// Test 1: Off by default (standard output is clean without badges)
{
  const res = engine.classifyAnswer({
    query: "Tell me a joke",
    answerText: "Why did the robot cross the road? To optimize the path.",
    // enabled is not specified -> defaults to false
  });

  assert.equal(res.ok, true);
  assert.equal(res.enabled, false);
  assert.equal(res.provenance_badge, null);
  assert.equal(res.receipt, null);
  assert.equal(res.rendered_markdown, "Why did the robot cross the road? To optimize the path.");
  console.log("  [PASS] Test 1: Off-by-default returns clean output without badges");
}

// Test 2: Opt-in enabled with verified corpus citations
{
  const res = engine.classifyAnswer({
    query: "How does Dizzy reach consensus?",
    answerText: "Dizzy uses deterministic consensus over immutable Merkle trees.",
    enabled: true,
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
  assert.equal(res.enabled, true);
  assert.equal(res.support_class, GROUNDING_CLASSES.CORPUS_GROUNDED);
  assert.match(res.provenance_badge, /\[CORPUS_GROUNDED: 1 citation\(s\)\]/);
  assert.equal(res.grounded_citations.length, 1);
  assert.equal(res.grounded_citations[0].verified, true);
  assert.match(res.rendered_markdown, /Citation proves textual presence in local corpus/);
  assert.equal(res.receipt.schema_version, GROUNDING_PROVENANCE_RECEIPT_SCHEMA);
  assert.equal(verifyGroundingProvenanceReceipt(res.receipt), true);
  console.log("  [PASS] Test 2: Opt-in enabled with CORPUS_GROUNDED citations verified");
}

// Test 3: SOURCE_BACKED_ONLY mode triggers evidence gap even if enabled flag is omitted
{
  const res = engine.classifyAnswer({
    query: "What is the token cost of GPT-5 in Dizzy?",
    answerText: "GPT-5 costs $0.002 per token.",
    requestMode: "SOURCE_BACKED_ONLY",
    citations: [],
    contextPackets: sampleContextPackets,
  });

  assert.equal(res.ok, false, "Must fail closed on evidence gap in SOURCE_BACKED_ONLY mode");
  assert.equal(res.support_class, GROUNDING_CLASSES.EVIDENCE_GAP);
  assert.equal(res.provenance_badge, "[EVIDENCE_GAP]");
  assert.match(res.answer_text, /\[EVIDENCE_GAP\] No supporting passages found/);
  assert.equal(res.receipt.evidence_gap, true);
  assert.equal(verifyGroundingProvenanceReceipt(res.receipt), true);
  console.log("  [PASS] Test 3: SOURCE_BACKED_ONLY strictly enforces EVIDENCE_GAP response");
}

// Test 4: Opt-in unverified model proposal
{
  const res = engine.classifyAnswer({
    query: "Explain why Merkle trees are efficient.",
    answerText: "Merkle trees provide O(log n) inclusion proofs.",
    enabled: true,
    requestMode: "HYBRID",
    citations: [],
  });

  assert.equal(res.ok, true);
  assert.equal(res.support_class, GROUNDING_CLASSES.UNVERIFIED_MODEL_PROPOSAL);
  assert.equal(res.provenance_badge, "[UNVERIFIED_MODEL_PROPOSAL]");
  assert.match(res.rendered_markdown, /Zero Grounding Authority/);
  assert.equal(verifyGroundingProvenanceReceipt(res.receipt), true);
  console.log("  [PASS] Test 4: Opt-in UNVERIFIED_MODEL_PROPOSAL tagged appropriately");
}

// Test 5: Synthetic rehearsal tagging
{
  const res = engine.classifyAnswer({
    query: "Simulate trade execution",
    answerText: "Simulated 500 shares traded at $10.00.",
    isSynthetic: true,
  });

  assert.equal(res.ok, true);
  assert.equal(res.support_class, GROUNDING_CLASSES.SYNTHETIC_REHEARSAL);
  assert.equal(res.provenance_badge, "[SYNTHETIC_REHEARSAL]");
  assert.match(res.rendered_markdown, /production authority = false/);
  assert.equal(verifyGroundingProvenanceReceipt(res.receipt), true);
  console.log("  [PASS] Test 5: Synthetic rehearsal output properly segregated");
}

// Test 6: Invariant disclaimer and backwards compatibility aliases
{
  assert.equal(SupportClassEngine, GroundingProvenanceEngine);
  assert.equal(verifySupportClassReceipt, verifyGroundingProvenanceReceipt);
  assert.equal(SUPPORT_CLASSES.SUPPORTED_BY_LOCAL_PASSAGE, GROUNDING_CLASSES.CORPUS_GROUNDED);
  assert.equal(SUPPORT_CLASSES.UNVERIFIED_MODEL_EXPLANATION, GROUNDING_CLASSES.UNVERIFIED_MODEL_PROPOSAL);

  const compatRes = engine.classifyAnswer({
    query: "Alias check",
    answerText: "Testing aliases.",
    enabled: true,
  });
  assert.equal(compatRes.receipt.disclaimer, CITATION_NOT_PROOF_DISCLAIMER);
  console.log("  [PASS] Test 6: Backwards compatibility aliases and disclaimers intact");
}

// Test 7: Tamper resistance of receipts
{
  const res = engine.classifyAnswer({
    query: "Tamper check",
    answerText: "Tamper test content.",
    enabled: true,
  });

  assert.equal(verifyGroundingProvenanceReceipt(res.receipt), true);

  const tampered1 = { ...res.receipt, claim_id: "forged" };
  assert.equal(verifyGroundingProvenanceReceipt(tampered1), false);

  const tampered2 = { ...res.receipt, evidence_sha256: "0".repeat(64) };
  assert.equal(verifyGroundingProvenanceReceipt(tampered2), false);

  console.log("  [PASS] Test 7: Cryptographic tamper resistance validated");
}

console.log("[GROUNDING_PROVENANCE_TEST] All 7 tests passed successfully.");
