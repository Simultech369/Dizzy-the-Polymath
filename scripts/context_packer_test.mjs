/**
 * Unit Test Suite for ContextPacker
 * Tests deterministic 3-slot packing, trust-zone filtering, and byte budget compliance.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ContextPacker, CONTEXT_PACKER_SCHEMA, DEFAULT_ZONE_BUDGETS } from "../lib/context_packer.mjs";

console.log("[Context Packer Suite] Testing deterministic 3-slot prompt packing...");

const packer = new ContextPacker();

// 1. Test standard packing with budget headroom
const mustInclude = [
  { id: "kernel", role: "doctrine", content: "DIZZY CONSTITUTIONAL KERNEL v1.0" },
  { id: "active_policy", role: "invariants", content: "INVARIANT: All writes require receipt." }
];

const candidateEvidence = [
  { id: "mem_01", source: "memory", priority: 10, sensitivity_tier: "public_safe", content: "User prefers concise summaries." },
  { id: "mem_02", source: "memory", priority: 5, sensitivity_tier: "public_safe", content: "Recent task: verified council engine." },
  { id: "mem_private_secret", source: "memory", priority: 8, sensitivity_tier: "LOCAL_ONLY_REQUIRED", content: "Private credential hash: abc999" }
];

// Test in paid_public zone (Strict minimization & exclusion of private artifacts)
const publicResult = packer.packContext({
  trust_zone: "paid_public",
  must_include: mustInclude,
  candidate_evidence: candidateEvidence
});

assert.equal(publicResult.receipt.schema, CONTEXT_PACKER_SCHEMA);
assert.equal(publicResult.receipt.trust_zone, "paid_public");
assert.equal(publicResult.receipt.must_include_count, 2);
assert.equal(publicResult.receipt.optional_included_count, 2);
assert.equal(publicResult.receipt.forbidden_excluded_count, 1, "Private memory must be classified as forbidden in paid_public");
assert.equal(publicResult.receipt.forbidden_records[0].id, "mem_private_secret");
assert.ok(publicResult.receipt.packed_bytes_total <= DEFAULT_ZONE_BUDGETS.paid_public, "Must respect paid_public byte budget");
assert.ok(!publicResult.packed_text.includes("Private credential hash"), "Private text must not appear in packed payload");

// Test in private_self zone (Allows private verified artifact)
const privateResult = packer.packContext({
  trust_zone: "private_self",
  must_include: mustInclude,
  candidate_evidence: candidateEvidence
});

assert.equal(privateResult.receipt.trust_zone, "private_self");
assert.equal(privateResult.receipt.optional_included_count, 3, "All 3 items allowed in private_self");
assert.equal(privateResult.receipt.forbidden_excluded_count, 0);
assert.ok(privateResult.packed_text.includes("Private credential hash"), "Private text allowed in private_self");

// Test byte budget exhaustion / omission
const oversizedResult = packer.packContext({
  trust_zone: "paid_public",
  max_byte_budget: 150, // Tiny budget
  must_include: [{ id: "kernel", content: "KERNEL" }],
  candidate_evidence: [
    { id: "ev_1", priority: 10, sensitivity_tier: "public_safe", content: "A".repeat(80) },
    { id: "ev_2", priority: 5, sensitivity_tier: "public_safe", content: "B".repeat(80) }
  ]
});

assert.equal(oversizedResult.receipt.optional_included_count, 1, "Only first item fits within 150 byte budget");
assert.equal(oversizedResult.receipt.optional_omitted_budget_count, 1, "Second item omitted due to budget limit");

const receiptPath = path.resolve(process.cwd(), "reviews/context_packer_latest.json");
fs.writeFileSync(receiptPath, JSON.stringify(publicResult.receipt, null, 2), "utf8");
console.log(`[PASS] Context Packer Suite cleanly verified 3-slot packing! Saved to: ${receiptPath}`);
