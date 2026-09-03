import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseAuditSourceRows,
  buildThirdPartyNoticesMarkdown,
  generateThirdPartyNotices,
  NOTICES_SCHEMA,
} from "./generate_third_party_notices.mjs";

console.log("[test:third-party-notices] Starting test suite...");

// Test 1: Parse audit source rows from actual audit markdown
{
  const auditPath = path.resolve(process.cwd(), "reviews/external_pattern_license_audit.md");
  const content = fs.readFileSync(auditPath, "utf8");
  const rows = parseAuditSourceRows(content);
  assert.equal(rows.length, 12);
  assert.ok(rows.some((r) => r.source === "henryqin1997/statem"));
  assert.ok(rows.some((r) => r.source === "Panniantong/Agent-Reach"));
  console.log("  [PASS] Test 1: Parse audit source rows");
}

// Test 2: Build markdown document
{
  const sampleRows = [
    {
      source: "henryqin1997/statem",
      status: "web license observed",
      borrowingClass: "mechanism_translation",
      disposition: "needs_legal_review",
      notes: "Classified as StateM-style control-plane pattern.",
    },
  ];

  const doc = buildThirdPartyNoticesMarkdown(sampleRows);
  assert.ok(doc.includes("henryqin1997/statem"));
  assert.ok(doc.includes("mechanism_translation"));
  assert.ok(doc.includes("Apache License 2.0"));
  console.log("  [PASS] Test 2: Build markdown document");
}

// Test 3: Generate receipt without writing to disk
{
  const receipt = generateThirdPartyNotices({ write: false });
  assert.equal(receipt.schema_version, NOTICES_SCHEMA);
  assert.equal(receipt.sources_audited, 12);
  assert.equal(receipt.written, false);
  assert.ok(receipt.content_sha256 && receipt.content_sha256.length === 64);
  console.log("  [PASS] Test 3: Generate receipt without writing to disk");
}

console.log("\n[test:third-party-notices] ALL TESTS PASSED CLEANLY.\n");
