import fs from "fs";
import path from "path";
import {
  VALID_DATA_BOUNDARIES,
  VALID_COST_BANDS,
  VALID_MODEL_ORIGIN_RISKS,
  VALID_BLOCKED_REASONS,
} from "../lib/model_router.mjs";

const ROOT = process.cwd();
const RECEIPT_PATH = path.resolve(ROOT, process.env.DIZZY_ROUTER_RECEIPT_PATH || "runtime/router_receipts.jsonl");

const ALLOWED_TRUST_ZONES = new Set(["private_self", "trusted_collaborator", "paid_public", "outside_contact"]);
const ALLOWED_BOUNDARIES = new Set(VALID_DATA_BOUNDARIES);
const ALLOWED_ORIGIN_RISKS = new Set(VALID_MODEL_ORIGIN_RISKS);
const ALLOWED_COST_BANDS = new Set(VALID_COST_BANDS);
const ALLOWED_BLOCKED_REASONS = new Set(VALID_BLOCKED_REASONS);

const SAFE_EXACT_MODELS = new Set([
  "gemma3:4b",
  "qwen2.5-coder:7b",
  "codestral:22b",
  "codestral-mamba:7b",
  "gemini-1.5-flash",
  "gemini-2.5-pro",
  "gpt-4o",
  "gpt-4o-mini",
  "claude-3-5-sonnet",
  "deepseek-r1"
]);

const ALLOWED_NONE_MODEL_REASONS = new Set([
  ...VALID_BLOCKED_REASONS,
  "provider_failed",
  "local_backend_not_implemented",
  "local_backend_unavailable",
  "cloud_disallowed_for_private_zone",
]);
const ALLOWED_UNKNOWN_MODEL_REASONS = new Set(["default"]);
const ALLOWED_OPENAI_COMPAT_MODELS = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "qwen2.5-coder:7b",
  "codestral:22b",
  "codestral-mamba:7b",
  "gemma3:4b",
  "llama3:8b",
  "deepseek-r1",
  "claude-3-5-sonnet",
  "mock-local-model"
]);
const RECOGNIZED_MODEL_PREFIXES = ["gpt-", "qwen", "gemma", "llama", "deepseek", "claude-", "ollama", "codestral"];

const MODEL_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$/;
const DANGEROUS_MODEL_PATTERNS = [
  /sk[_\-]/i,
  /ghp_/i,
  /glpat-/i,
  /AKIA[0-9A-Z]{10,}/,
  /AIza[0-9A-Za-z_-]{10,}/,
  /eyJ[a-zA-Z0-9_-]{6,}/,
  /(?:file:|https?:|private|secret|sentinel|prompt)/i,
  /\.(txt|md|mjs|js|json|py|key|env|pem|crt|csr|p12|pfx)$/i,
  /[\\\/]/,
];

function isSafeModelIdSuffix(suffix) {
  if (!suffix || !MODEL_ID_RE.test(suffix)) return false;
  return !DANGEROUS_MODEL_PATTERNS.some((pattern) => pattern.test(suffix));
}

function sanitizeChosenModel(rawModel) {
  const str = String(rawModel || "").trim();
  if (!str) return "unspecified";
  if (str === "none") return "none";

  if (SAFE_EXACT_MODELS.has(str)) {
    return str;
  }

  if (str.startsWith("gemini:")) {
    const suffix = str.slice("gemini:".length);
    return /^gemini-[a-z0-9][a-z0-9_.:-]{1,63}$/i.test(suffix) && isSafeModelIdSuffix(suffix)
      ? str
      : "unclassified";
  }

  if (str.startsWith("openai_compat:")) {
    const suffix = str.slice("openai_compat:".length);
    if (ALLOWED_OPENAI_COMPAT_MODELS.has(suffix)) return str;
    const matchesPrefix = RECOGNIZED_MODEL_PREFIXES.some((p) => suffix.toLowerCase().startsWith(p));
    return matchesPrefix && isSafeModelIdSuffix(suffix) ? str : "unclassified";
  }

  if (str.startsWith("none:")) {
    const suffix = str.slice("none:".length);
    return ALLOWED_NONE_MODEL_REASONS.has(suffix) ? str : "unclassified";
  }

  if (str.startsWith("unknown:")) {
    const suffix = str.slice("unknown:".length);
    return ALLOWED_UNKNOWN_MODEL_REASONS.has(suffix) ? str : "unclassified";
  }

  return "unclassified";
}

function sanitizeBlockedReason(raw) {
  const str = String(raw || "").trim();
  if (!str) return "unknown_blocked_reason";
  if (ALLOWED_BLOCKED_REASONS.has(str)) return str;
  for (const enumCode of ALLOWED_BLOCKED_REASONS) {
    if (enumCode && enumCode !== "other" && str.includes(enumCode)) return enumCode;
  }
  return "other";
}

export function generateUsageReport(customFilePath) {
  const filePath = customFilePath || RECEIPT_PATH;
  if (!fs.existsSync(filePath)) {
    return {
      hasReceipts: false,
      totalCount: 0,
      validReceiptCount: 0,
      malformedCount: 0,
      unsupportedSchemaCount: 0,
      byTrustZone: {},
      byChosenModel: {},
      byDataBoundary: {},
      byModelOriginRisk: {},
      byEstimatedCostBand: {},
      byExecutionStatus: {},
      fallbackCount: 0,
      fallbackBlockedReasons: {},
    };
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const byTrustZone = {};
  const byChosenModel = {};
  const byDataBoundary = {};
  const byModelOriginRisk = {};
  const byEstimatedCostBand = {};
  const byExecutionStatus = {};
  const fallbackBlockedReasons = {};
  let fallbackCount = 0;
  let malformedCount = 0;
  let unsupportedSchemaCount = 0;
  let validReceiptCount = 0;

  for (const line of lines) {
    let receipt = null;
    try {
      receipt = JSON.parse(line);
    } catch {
      malformedCount += 1;
      continue;
    }

    if (!receipt || typeof receipt !== "object" || receipt.schema_version !== "dizzy.router_receipt.v1") {
      unsupportedSchemaCount += 1;
      continue;
    }
    validReceiptCount += 1;

    const tz = ALLOWED_TRUST_ZONES.has(receipt.trust_zone) ? receipt.trust_zone : "unclassified";
    const rawModel = typeof receipt.chosen_model === "string" ? receipt.chosen_model : "";
    const model = sanitizeChosenModel(rawModel);
    const boundary = ALLOWED_BOUNDARIES.has(receipt.data_boundary) ? receipt.data_boundary : "unclassified";
    const originRisk = ALLOWED_ORIGIN_RISKS.has(receipt.model_origin_risk) ? receipt.model_origin_risk : "unclassified";
    const costBand = ALLOWED_COST_BANDS.has(receipt.estimated_cost_band) ? receipt.estimated_cost_band : "unclassified";

    const reasonStr = String(receipt.reason || "");
    const modelStr = String(receipt.chosen_model || "");
    const isFailClosed =
      modelStr.startsWith("none") ||
      reasonStr.startsWith("no_model_execution:") ||
      reasonStr.includes("disallowed") ||
      reasonStr.includes("failed") ||
      reasonStr.includes("offline") ||
      reasonStr.includes("unconfigured");

    const status = isFailClosed ? "fail_closed" : "executed";

    byTrustZone[tz] = (byTrustZone[tz] || 0) + 1;
    byChosenModel[model] = (byChosenModel[model] || 0) + 1;
    byDataBoundary[boundary] = (byDataBoundary[boundary] || 0) + 1;
    byModelOriginRisk[originRisk] = (byModelOriginRisk[originRisk] || 0) + 1;
    byEstimatedCostBand[costBand] = (byEstimatedCostBand[costBand] || 0) + 1;
    byExecutionStatus[status] = (byExecutionStatus[status] || 0) + 1;

    if (receipt.fallback && typeof receipt.fallback === "object") {
      if (receipt.fallback.used === true) {
        fallbackCount += 1;
      }
      if (receipt.fallback.blocked_reason && typeof receipt.fallback.blocked_reason === "string") {
        const reason = sanitizeBlockedReason(receipt.fallback.blocked_reason);
        fallbackBlockedReasons[reason] = (fallbackBlockedReasons[reason] || 0) + 1;
      }
    }
  }

  return {
    hasReceipts: lines.length > 0,
    totalCount: lines.length,
    validReceiptCount,
    malformedCount,
    unsupportedSchemaCount,
    byTrustZone,
    byChosenModel,
    byDataBoundary,
    byModelOriginRisk,
    byEstimatedCostBand,
    byExecutionStatus,
    fallbackCount,
    fallbackBlockedReasons,
  };
}

if (process.argv[1] && path.basename(process.argv[1]) === "usage_report.mjs") {
  const report = generateUsageReport();
  console.log("=== Dizzy Runtime Usage Report ===");
  if (!report.hasReceipts) {
    console.log("No router receipts recorded yet (runtime/router_receipts.jsonl).");
  } else {
    console.log(`Total Rows: ${report.totalCount}`);
    console.log(`Valid v1 Receipt Events: ${report.validReceiptCount}`);
    if (report.malformedCount > 0) {
      console.log(`Malformed JSON Rows: ${report.malformedCount}`);
    }
    if (report.unsupportedSchemaCount > 0) {
      console.log(`Unsupported Schema Rows: ${report.unsupportedSchemaCount}`);
    }
    console.log("\nBy Trust Zone:");
    for (const [tz, count] of Object.entries(report.byTrustZone)) {
      console.log(`  - ${tz}: ${count}`);
    }
    console.log("\nBy Chosen Model:");
    for (const [m, count] of Object.entries(report.byChosenModel)) {
      console.log(`  - ${m}: ${count}`);
    }
    console.log("\nBy Data Boundary:");
    for (const [b, count] of Object.entries(report.byDataBoundary)) {
      console.log(`  - ${b}: ${count}`);
    }
    console.log("\nBy Model Origin Risk:");
    for (const [r, count] of Object.entries(report.byModelOriginRisk)) {
      console.log(`  - ${r}: ${count}`);
    }
    console.log("\nBy Estimated Cost Band:");
    for (const [c, count] of Object.entries(report.byEstimatedCostBand)) {
      console.log(`  - ${c}: ${count}`);
    }
    console.log("\nBy Execution Status:");
    for (const [s, count] of Object.entries(report.byExecutionStatus)) {
      console.log(`  - ${s}: ${count}`);
    }
    console.log(`\nFallback Events Used: ${report.fallbackCount}`);
    if (Object.keys(report.fallbackBlockedReasons).length > 0) {
      console.log("Fallback Blocked Reasons:");
      for (const [reason, count] of Object.entries(report.fallbackBlockedReasons)) {
        console.log(`  - ${reason}: ${count}`);
      }
    }
  }
}
