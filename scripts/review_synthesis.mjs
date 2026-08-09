import fs from "fs";
import path from "path";
import {
  synthesizeReviewEvidence,
  writeReviewSynthesis,
} from "../lib/review_synthesis.mjs";

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8"));
  } catch {
    return fallback;
  }
}

function argValue(args, name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function allArgValues(args, name) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && i + 1 < args.length) values.push(args[i + 1]);
  }
  return values;
}

function splitList(value = "") {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function bucketPayload(payload, buckets) {
  if (!payload || typeof payload !== "object") return;
  if (Array.isArray(payload)) {
    buckets.reviews.push(...payload);
    return;
  }
  if (payload.schema_version === "dizzy.model_review_batch.v1") {
    buckets.modelBatches.push(payload);
    return;
  }
  if (payload.schema_version === "dizzy.review_cycle_run.v1") {
    buckets.cycleReceipts.push(payload);
    return;
  }
  if (payload.schema_version === "dizzy.review_loop_supervisor.v1") {
    buckets.supervisorRuns.push(payload);
    return;
  }
  if (Array.isArray(payload.reviews)) buckets.reviews.push(...payload.reviews);
  if (Array.isArray(payload.harnesses)) buckets.harnesses.push(...payload.harnesses);
}

const args = process.argv.slice(2);
const buckets = {
  reviews: [],
  harnesses: [],
  modelBatches: [],
  cycleReceipts: [],
  supervisorRuns: [],
};

for (const filePath of allArgValues(args, "--input")) bucketPayload(readJson(filePath, null), buckets);
for (const filePath of allArgValues(args, "--model-batch")) buckets.modelBatches.push(readJson(filePath, {}));
for (const filePath of allArgValues(args, "--cycle")) buckets.cycleReceipts.push(readJson(filePath, {}));
for (const filePath of allArgValues(args, "--reviews")) bucketPayload(readJson(filePath, []), buckets);
for (const filePath of allArgValues(args, "--harnesses")) bucketPayload({ harnesses: readJson(filePath, []) }, buckets);

const synthesis = synthesizeReviewEvidence({
  candidateId: argValue(args, "--candidate-id", ""),
  changedFiles: splitList(argValue(args, "--changed", "")),
  reviews: buckets.reviews,
  harnesses: buckets.harnesses,
  modelBatches: buckets.modelBatches,
  cycleReceipts: buckets.cycleReceipts,
  supervisorRuns: buckets.supervisorRuns,
  minReviewsForPush: Number(argValue(args, "--min-reviews-for-push", "3")) || 3,
  requireDisagreement: !args.includes("--no-require-disagreement"),
});

let receiptPath = "";
if (args.includes("--write")) {
  receiptPath = writeReviewSynthesis(synthesis, {
    outPath: argValue(args, "--out", "reviews/review_synthesis_latest.json"),
  });
}

console.log(JSON.stringify({
  ...synthesis,
  receipt_path: receiptPath,
}, null, 2));

if (!args.includes("--no-fail-on-transition") && ["reject", "quarantine", "fixture-required"].includes(synthesis.proposed_state_transition)) {
  process.exit(1);
}
