/**
 * Unified Context Assembly Pipeline Tests (W-0151)
 *
 * Verifies that the upgraded assembleContext() correctly:
 * 1. Uses ContextPacker 3-slot model (MUST_INCLUDE / OPTIONAL_EVIDENCE / FORBIDDEN)
 * 2. Enforces zone-aware budgets from DEFAULT_ZONE_BUDGETS
 * 3. Emits unified provenance receipts with slot categorization
 * 4. Preserves backward-compatible API shape (packed_context + provenance_receipt)
 * 5. Blocks cross-zone leakage through packer zone enforcement
 * 6. Handles deduplication, scoring, and budget overflow correctly
 */

import assert from "node:assert";
import crypto from "node:crypto";
import { assembleContext, CONTEXT_ASSEMBLER_SCHEMA, DEFAULT_ZONE_BUDGETS } from "../lib/context_assembler.mjs";

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

console.log("[test:unified-context-pipeline] Starting unified pipeline tests...\n");

const makeRecord = (id, content, overrides = {}) => ({
  id,
  kind: "cognitive_memory",
  content,
  source_sha256: sha256Hex(content),
  trust_zone: "private_self",
  sensitivity_tier: "normal",
  status: "active",
  is_mandatory: false,
  ...overrides,
});

const wrapSnapshot = (records) => ({
  snapshot_id: `snap_test_${Date.now()}`,
  as_of: new Date().toISOString(),
  records,
});

// ── Group 1: Unified Receipt Schema ──────────────────────────────

{
  const snapshot = wrapSnapshot([
    makeRecord("r1", "Architecture rule: always use receipts.", { is_mandatory: true }),
    makeRecord("r2", "The user prefers dark mode for the dashboard."),
  ]);

  const result = assembleContext({
    trust_zone: "private_self",
    task: "dashboard mode preferences",
    budget_bytes: 4000,
    allowed_sources: snapshot,
  });

  // Must return backward-compatible shape
  assert.ok(typeof result.packed_context === "string", "Must return packed_context string");
  assert.ok(result.provenance_receipt, "Must return provenance_receipt");

  // Receipt must use v2 schema
  assert.strictEqual(result.provenance_receipt.schema, CONTEXT_ASSEMBLER_SCHEMA);
  assert.strictEqual(result.provenance_receipt.schema, "dizzy.context_assembler.v2");

  // Receipt must include slot counts
  assert.ok(result.provenance_receipt.slots, "Receipt must include slots object");
  assert.strictEqual(result.provenance_receipt.slots.must_include_count, 1);
  assert.ok(result.provenance_receipt.slots.optional_included_count >= 1);

  // Receipt must include both zone budgets
  assert.ok(result.provenance_receipt.effective_budget_bytes > 0);
  assert.ok(result.provenance_receipt.zone_default_budget_bytes > 0);

  // Receipt must include payload hash and packer receipt hash
  assert.ok(result.provenance_receipt.payload_sha256);
  assert.ok(result.provenance_receipt.packer_receipt_sha256);

  // Selected IDs must include the mandatory record
  assert.ok(result.provenance_receipt.selected_ids.includes("r1"));

  console.log("  [PASS] Group 1: Unified receipt schema (v2) with slot counts");
}

// ── Group 2: Zone-Aware Budget Defaults ──────────────────────────

{
  // When no budget_bytes is specified, should use zone default
  const smallContent = "Short memory.";
  const snapshot = wrapSnapshot([makeRecord("z1", smallContent)]);

  for (const zone of ["private_self", "trusted_collaborator", "outside_contact", "paid_public"]) {
    // For non-private zones, mark content as public_safe so it passes zone check
    const zoneSnapshot = wrapSnapshot([
      makeRecord("z1", smallContent, {
        sensitivity_tier: zone === "private_self" ? "normal" : "public_safe",
      }),
    ]);

    const result = assembleContext({
      trust_zone: zone,
      task: "short memory",
      allowed_sources: zoneSnapshot,
      // No budget_bytes — should use zone default
    });

    assert.strictEqual(
      result.provenance_receipt.zone_default_budget_bytes,
      DEFAULT_ZONE_BUDGETS[zone],
      `Zone ${zone} should use default budget ${DEFAULT_ZONE_BUDGETS[zone]}`
    );
  }

  console.log("  [PASS] Group 2: Zone-aware budget defaults applied correctly");
}

// ── Group 3: 3-Slot Packing Structure ────────────────────────────

{
  const snapshot = wrapSnapshot([
    makeRecord("mandatory_1", "GOVERNANCE: All actions require receipts.", { is_mandatory: true }),
    makeRecord("evidence_1", "The routing policy uses T0-T3 tiers for cost control."),
    makeRecord("evidence_2", "Dashboard accessibility was improved in W-0135."),
  ]);

  const result = assembleContext({
    trust_zone: "private_self",
    task: "routing policy tiers",
    budget_bytes: 8000,
    allowed_sources: snapshot,
  });

  // packed_context must contain slot headers from ContextPacker
  assert.ok(
    result.packed_context.includes("MUST_INCLUDE") || result.packed_context.includes("CANONICAL GOVERNANCE"),
    "Packed context must contain MUST_INCLUDE slot header"
  );
  assert.ok(
    result.packed_context.includes("OPTIONAL_EVIDENCE") || result.packed_context.includes("VERIFIED CONTEXT"),
    "Packed context must contain OPTIONAL_EVIDENCE slot header"
  );

  // Mandatory content must be present
  assert.ok(result.packed_context.includes("All actions require receipts"));

  // Relevant evidence (routing) should be present
  assert.ok(result.packed_context.includes("T0-T3 tiers"));

  console.log("  [PASS] Group 3: 3-slot packing structure (MUST_INCLUDE + OPTIONAL_EVIDENCE)");
}

// ── Group 4: Cross-Zone Leakage Prevention ───────────────────────

{
  const snapshot = wrapSnapshot([
    makeRecord("public_ok", "Public documentation about API.", { sensitivity_tier: "public_safe" }),
    makeRecord("private_secret", "Internal API keys and credentials.", { sensitivity_tier: "do_not_export" }),
    makeRecord("normal_mem", "User preference for dark mode.", { sensitivity_tier: "normal" }),
  ]);

  // paid_public zone: only public_safe should pass
  const result = assembleContext({
    trust_zone: "paid_public",
    task: "API keys documentation mode",
    budget_bytes: 4000,
    allowed_sources: snapshot,
  });

  assert.ok(!result.packed_context.includes("Internal API keys"), "do_not_export must not leak to paid_public");
  
  // normal sensitivity should be blocked from paid_public by packer zone enforcement
  const omittedReasons = result.provenance_receipt.omitted.map(o => o.reason);
  assert.ok(
    omittedReasons.includes("zone_restricted") || omittedReasons.includes("packer_zone_forbidden"),
    "Must record zone restriction in omitted list"
  );

  // private_self zone: everything should be accessible
  const privateResult = assembleContext({
    trust_zone: "private_self",
    task: "API keys documentation mode",
    budget_bytes: 4000,
    allowed_sources: snapshot,
  });
  assert.ok(privateResult.packed_context.includes("Internal API keys"), "private_self must access do_not_export");

  console.log("  [PASS] Group 4: Cross-zone leakage prevention (paid_public blocks private content)");
}

// ── Group 5: Deduplication and Scoring ───────────────────────────

{
  const duplicateContent = "Routing uses capability-first dispatch.";
  const snapshot = wrapSnapshot([
    makeRecord("dup_a", duplicateContent),
    makeRecord("dup_b", duplicateContent), // Same content, different ID
    makeRecord("relevant", "Dispatch pipeline validates routing evidence."),
    makeRecord("irrelevant", "Banana smoothie recipe for breakfast."),
  ]);

  const result = assembleContext({
    trust_zone: "private_self",
    task: "routing dispatch pipeline",
    budget_bytes: 4000,
    allowed_sources: snapshot,
  });

  // Only one copy of duplicate content should be packed
  const dupCount = (result.packed_context.match(/capability-first dispatch/g) || []).length;
  assert.strictEqual(dupCount, 1, "Duplicate content must be deduplicated to 1 copy");

  // Duplicate should be in omitted list
  const dupOmit = result.provenance_receipt.omitted.find(o => o.reason === "duplicate_content");
  assert.ok(dupOmit, "Duplicate must be recorded in omitted list");

  // Irrelevant content should be dropped (zero overlap)
  assert.ok(!result.packed_context.includes("Banana smoothie"), "Zero-overlap content must be dropped");
  const zeroOmit = result.provenance_receipt.omitted.find(o => o.reason === "zero_overlap");
  assert.ok(zeroOmit, "Zero-overlap must be recorded in omitted list");

  console.log("  [PASS] Group 5: Deduplication and scoring (duplicates removed, irrelevant dropped)");
}

// ── Group 6: Budget Overflow Graceful Handling ───────────────────

{
  const bigContent = "X".repeat(500);
  const snapshot = wrapSnapshot([
    makeRecord("big_1", bigContent + " routing alpha"),
    makeRecord("big_2", bigContent + " routing beta"),
    makeRecord("big_3", bigContent + " routing gamma"),
  ]);

  // Budget only fits ~1 record
  const result = assembleContext({
    trust_zone: "private_self",
    task: "routing",
    budget_bytes: 700,
    allowed_sources: snapshot,
  });

  // At least one should be packed, others budget-exceeded
  assert.ok(result.provenance_receipt.selected_ids.length >= 1, "At least 1 record must fit");
  assert.ok(result.provenance_receipt.slots.optional_omitted_budget_count >= 1, "Budget overflow must be tracked in slots");
  assert.ok(result.provenance_receipt.headroom_bytes >= 0, "Headroom must be non-negative");

  console.log("  [PASS] Group 6: Budget overflow graceful handling");
}

// ── Group 7: Mandatory Budget Exceeded Throws ────────────────────

{
  const snapshot = wrapSnapshot([
    makeRecord("huge_mandatory", "Y".repeat(200), { is_mandatory: true }),
  ]);

  try {
    assembleContext({
      trust_zone: "private_self",
      task: "test",
      budget_bytes: 10,
      allowed_sources: snapshot,
    });
    assert.fail("Should throw BudgetExceededError");
  } catch (e) {
    assert.ok(e.message.includes("BudgetExceededError"), `Error must contain BudgetExceededError: ${e.message}`);
  }

  console.log("  [PASS] Group 7: Mandatory budget exceeded throws BudgetExceededError");
}

// ── Group 8: Provenance Receipt Integrity ────────────────────────

{
  const snapshot = wrapSnapshot([
    makeRecord("prov_1", "Receipt integrity check content alpha.", { is_mandatory: true }),
    makeRecord("prov_2", "Receipt integrity check content beta."),
  ]);

  const result = assembleContext({
    trust_zone: "private_self",
    task: "receipt integrity check",
    budget_bytes: 4000,
    allowed_sources: snapshot,
  });

  const receipt = result.provenance_receipt;

  // Snapshot ID must be preserved
  assert.strictEqual(receipt.snapshot_id, snapshot.snapshot_id);

  // Payload hash must match actual packed content
  const expectedHash = sha256Hex(result.packed_context);
  assert.strictEqual(receipt.payload_sha256, expectedHash, "Payload SHA-256 must match packed content");

  // Final bytes must be positive
  assert.ok(receipt.final_bytes > 0, "Final bytes must be positive");

  // Trust zone must be recorded
  assert.strictEqual(receipt.trust_zone, "private_self");

  console.log("  [PASS] Group 8: Provenance receipt integrity (hash, snapshot, zone)");
}

console.log("\n[test:unified-context-pipeline] ALL 8 GROUPS PASSED.\n");
