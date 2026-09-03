import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { generateUsageReport } from "./usage_report.mjs";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-usage-report-"));
const receiptPath = path.join(tempDir, "router_receipts.jsonl");

const validLocalReceipt = {
  schema_version: "dizzy.router_receipt.v1",
  trust_zone: "private_self",
  chosen_model: "gemma3:4b",
  data_boundary: "local_machine",
  model_origin_risk: "low",
  estimated_cost_band: "free_local",
  reason: "local_route",
};

const validFailClosedReceipt = {
  schema_version: "dizzy.router_receipt.v1",
  trust_zone: "outside_contact",
  chosen_model: "none:private_zone_cloud_disallowed",
  data_boundary: "none",
  model_origin_risk: "unknown",
  estimated_cost_band: "unknown",
  reason: "no_model_execution:private_zone_cloud_disallowed",
  fallback: {
    used: true,
    blocked_reason: "private_zone_cloud_disallowed C:\\Users\\Josh\\runtime\\secrets\\GROQ_API_KEY.txt sk-test-secret",
  },
};

const taintedModelReceipt = {
  schema_version: "dizzy.router_receipt.v1",
  trust_zone: "trusted_collaborator",
  chosen_model: "openai_compat:https://example.invalid/private.env",
  data_boundary: "openai_compatible_api",
  model_origin_risk: "medium",
  estimated_cost_band: "low",
  reason: "provider_selected",
};

fs.writeFileSync(receiptPath, [
  JSON.stringify(validLocalReceipt),
  JSON.stringify(validFailClosedReceipt),
  JSON.stringify(taintedModelReceipt),
  "{not-json",
  JSON.stringify({ schema_version: "legacy.router_receipt.v0", chosen_model: "gpt-4o" }),
].join("\n"), "utf8");

const missingReport = generateUsageReport(path.join(tempDir, "missing.jsonl"));
assert.equal(missingReport.hasReceipts, false, "missing receipt path should report no receipts");
assert.equal(missingReport.validReceiptCount, 0, "missing receipt path should have no valid rows");

const report = generateUsageReport(receiptPath);
assert.equal(report.hasReceipts, true, "fixture should report receipts");
assert.equal(report.totalCount, 5, "all non-empty rows should be counted");
assert.equal(report.validReceiptCount, 3, "v1 receipts should be counted");
assert.equal(report.malformedCount, 1, "malformed JSON rows should be counted");
assert.equal(report.unsupportedSchemaCount, 1, "unsupported schema rows should be counted");

assert.deepEqual(report.byTrustZone, {
  private_self: 1,
  outside_contact: 1,
  trusted_collaborator: 1,
});
assert.deepEqual(report.byDataBoundary, {
  local_machine: 1,
  none: 1,
  openai_compatible_api: 1,
});
assert.deepEqual(report.byModelOriginRisk, {
  low: 1,
  unknown: 1,
  medium: 1,
});
assert.deepEqual(report.byEstimatedCostBand, {
  free_local: 1,
  unknown: 1,
  low: 1,
});
assert.deepEqual(report.byExecutionStatus, {
  executed: 2,
  fail_closed: 1,
});

assert.equal(report.byChosenModel["gemma3:4b"], 1, "safe exact model should be preserved");
assert.equal(report.byChosenModel["none:private_zone_cloud_disallowed"], 1, "safe none reason should be preserved");
assert.equal(report.byChosenModel.unclassified, 1, "tainted model string should be classified away");
assert.equal(report.fallbackCount, 1, "fallback used count should be aggregated");
assert.equal(report.fallbackBlockedReasons.private_zone_cloud_disallowed, 1, "blocked reason should be sanitized to an enum");

const serializedReport = JSON.stringify(report);
assert.equal(serializedReport.includes("C:\\Users\\Josh"), false, "usage report must not echo private paths");
assert.equal(serializedReport.includes("sk-test-secret"), false, "usage report must not echo secrets");
assert.equal(serializedReport.includes("private.env"), false, "usage report must not echo private model suffixes");

fs.rmSync(tempDir, { recursive: true, force: true });
console.log("USAGE_REPORT_TEST_OK receipts=5 valid=3 malformed=1 unsupported=1");
