import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { buildReviewCyclePlan } from "../lib/review_cycle_orchestrator.mjs";
import {
  loadReviewCycleHistory,
  runReviewCycle,
  updateReviewCycleHistory,
  writeReviewCycleHistory,
  writeReviewCycleReceipt,
} from "../lib/review_cycle_runner.mjs";

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

function changedFilesFromGit(base, head) {
  const range = `${base}..${head}`;
  const result = spawnSync("git", ["diff", "--name-only", range], { encoding: "utf8", cwd: process.cwd() });
  if (result.status !== 0) {
    throw new Error(`git diff failed for ${range}: ${String(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function changedFilesFromWorktree() {
  const result = spawnSync("git", ["status", "--short", "--untracked-files=all"], { encoding: "utf8", cwd: process.cwd() });
  if (result.status !== 0) {
    throw new Error(`git status failed for working tree: ${String(result.stderr || result.stdout).trim()}`);
  }
  const files = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const payload = line.slice(3).trim();
    if (!payload) continue;
    const renameParts = payload.split(" -> ");
    files.push(renameParts[renameParts.length - 1]);
  }
  return [...new Set(files)].sort();
}

const args = process.argv.slice(2);
const base = argValue(args, "--base", "HEAD~1");
const head = argValue(args, "--head", "HEAD");
const maxReviewers = Number(argValue(args, "--max-reviewers", "12")) || 12;
const maxHarnesses = Number(argValue(args, "--max-harnesses", "8")) || 8;
const minReviewsForPush = Number(argValue(args, "--min-reviews-for-push", "3"));
const timeoutMs = Number(argValue(args, "--timeout-ms", "120000")) || 120000;
const candidateId = argValue(args, "--candidate-id", "");
const changedArg = argValue(args, "--changed", "");
const reviewsPath = argValue(args, "--reviews", "");
const historyPath = argValue(args, "--history", "reviews/review_cycle_history.json");
const outPath = argValue(args, "--out", "reviews/review_cycle_latest.json");
const useWorktree = args.includes("--worktree");
const planOnly = args.includes("--plan-only");
const noWrite = args.includes("--no-write");
const noHistory = args.includes("--no-history");
const failFast = args.includes("--fail-fast");
const requireDisagreement = !args.includes("--no-require-disagreement");

const changedFiles = changedArg
  ? changedArg.split(",").map((item) => item.trim()).filter(Boolean)
  : useWorktree
    ? changedFilesFromWorktree()
    : changedFilesFromGit(base, head);

const packageJson = readJson("package.json", {});
const history = loadReviewCycleHistory(historyPath);
const reviewPayload = reviewsPath ? readJson(reviewsPath, {}) : {};
const reviews = Array.isArray(reviewPayload)
  ? reviewPayload
  : Array.isArray(reviewPayload.reviews)
    ? reviewPayload.reviews
    : [];
const plan = buildReviewCyclePlan({
  changedFiles,
  packageJson,
  history,
  maxReviewers,
  maxHarnesses,
  candidateId,
});

if (planOnly) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

const receipt = await runReviewCycle({
  plan,
  reviews,
  rootDir: process.cwd(),
  timeoutMs,
  minReviewsForPush: Number.isFinite(minReviewsForPush) ? minReviewsForPush : 3,
  requireDisagreement,
  failFast,
});

let receiptPath = "";
let updatedHistoryPath = "";
if (!noWrite) receiptPath = writeReviewCycleReceipt(receipt, { outPath });
if (!noHistory) {
  const updatedHistory = updateReviewCycleHistory(history, receipt);
  updatedHistoryPath = writeReviewCycleHistory(updatedHistory, { historyPath });
}

console.log(JSON.stringify({
  schema_version: "dizzy.review_cycle_run_summary.v1",
  run_id: receipt.run_id,
  candidate_id: receipt.candidate_id,
  state_transition: receipt.reconciliation.state_transition,
  reason: receipt.reconciliation.reason,
  harnesses: receipt.harnesses.map((harness) => ({
    script: harness.script,
    status: harness.status,
    duration_ms: harness.duration_ms,
  })),
  receipt_path: receiptPath,
  history_path: updatedHistoryPath,
  authority: receipt.reconciliation.authority,
}, null, 2));

if (["reject", "quarantine", "fixture-required"].includes(receipt.reconciliation.state_transition)) {
  process.exit(1);
}
