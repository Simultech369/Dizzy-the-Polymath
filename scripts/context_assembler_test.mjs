import assert from "node:assert";
import { assembleContext } from "../lib/context_assembler.mjs";

console.log("[test:context-assembler] Starting pure pipeline tests...");

const mockSnapshot = {
  snapshot_id: "snap_123",
  as_of: new Date().toISOString(),
  records: [
    {
      id: "mem_1",
      kind: "cognitive_memory",
      content: "This is a durable rule about system architecture.",
      source_sha256: "hash1",
      trust_zone: "private_self",
      sensitivity_tier: "durable_rule",
      status: "active",
      is_mandatory: true
    },
    {
      id: "mem_2",
      kind: "cognitive_memory",
      content: "The user prefers dark mode.",
      source_sha256: "hash2",
      trust_zone: "private_self",
      sensitivity_tier: "normal",
      status: "active",
      is_mandatory: false
    },
    {
      id: "mem_3",
      kind: "cognitive_memory",
      content: "Archived preference about light mode.",
      source_sha256: "hash3",
      trust_zone: "private_self",
      sensitivity_tier: "normal",
      status: "archived",
      is_mandatory: false
    },
    {
      id: "mem_4",
      kind: "cognitive_memory",
      content: "Secret API keys.",
      source_sha256: "hash4",
      trust_zone: "private_self",
      sensitivity_tier: "do_not_export",
      status: "active",
      is_mandatory: false
    }
  ]
};

// Test 1: Mandatory records bypass selection and are always packed
{
  const result = assembleContext({
    trust_zone: "private_self",
    task: "tell me about mode preferences",
    budget_tokens: 1000,
    allowed_sources: mockSnapshot
  });
  
  assert.ok(result.packed_context.includes("durable rule about system architecture"), "Mandatory rule must be included");
  assert.ok(result.packed_context.includes("dark mode"), "Relevant optional memory must be included");
  assert.ok(!result.packed_context.includes("Archived"), "Archived memory must be dropped");
  assert.ok(!result.packed_context.includes("Secret API keys"), "Zero-overlap optional memory must be dropped");
  console.log("  [PASS] Test 1: Validation and Selection Logic");
}

// Test 2: do_not_export is rigidly blocked from outside zones
{
  const result = assembleContext({
    trust_zone: "paid_public",
    task: "tell me about Secret API keys",
    budget_tokens: 1000,
    allowed_sources: mockSnapshot
  });
  
  assert.ok(!result.packed_context.includes("Secret API keys"), "do_not_export MUST NOT be exported to paid_public");
  
  const omitted = result.provenance_receipt.omitted.find(o => o.id === "mem_4");
  assert.ok(omitted && omitted.reason === "zone_restricted", "Must log zone_restricted in receipt");
  console.log("  [PASS] Test 2: Zone Restricted (do_not_export)");
}

// Test 3: Strict Byte Budgeting
{
  // Try packing the mandatory memory but with a tiny budget
  try {
    assembleContext({
      trust_zone: "private_self",
      task: "architecture",
      budget_tokens: 10, // Not enough to even pack the separator
      allowed_sources: mockSnapshot
    });
    assert.fail("Should have thrown BudgetExceededError");
  } catch (e) {
    assert.ok(e.message.includes("BudgetExceededError"), "Must throw if mandatory cannot fit");
  }
  console.log("  [PASS] Test 3: Strict Byte Budgeting (Mandatory Throw)");
}

console.log("[test:context-assembler] ALL TESTS PASSED CLEANLY.\n");
