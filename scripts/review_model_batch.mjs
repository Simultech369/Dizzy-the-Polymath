import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { buildReviewCyclePlan } from "../lib/review_cycle_orchestrator.mjs";
import { loadReviewCycleHistory } from "../lib/review_cycle_runner.mjs";
import {
  runModelReviewBatch,
  writeModelReviewBatch,
} from "../lib/review_model_runner.mjs";

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

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", cwd: process.cwd() });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${String(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

function changedFilesFromGit(base, head) {
  return git(["diff", "--name-only", `${base}..${head}`]).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function changedFilesFromWorktree() {
  const files = [];
  for (const line of git(["status", "--short", "--untracked-files=all"]).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const payload = line.slice(3).trim();
    if (!payload) continue;
    const renameParts = payload.split(" -> ");
    files.push(renameParts[renameParts.length - 1]);
  }
  return [...new Set(files)].sort();
}

function diffText({ base, head, changedFiles, useWorktree, maxDiffChars }) {
  const args = useWorktree ? ["diff", "--"] : ["diff", `${base}..${head}`, "--"];
  let out = git([...args, ...changedFiles]).trim();
  if (useWorktree) {
    const untrackedBlocks = [];
    for (const relPath of changedFiles) {
      const tracked = spawnSync("git", ["ls-files", "--error-unmatch", relPath], { encoding: "utf8", cwd: process.cwd() });
      const absPath = path.resolve(process.cwd(), relPath);
      if (tracked.status === 0 || !fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) continue;
      const buf = fs.readFileSync(absPath);
      if (buf.includes(0)) {
        untrackedBlocks.push(`diff --git a/${relPath} b/${relPath}\nnew file mode 100644\n[binary or null-containing file omitted]`);
      } else {
        untrackedBlocks.push(`diff --git a/${relPath} b/${relPath}\nnew file mode 100644\n--- /dev/null\n+++ b/${relPath}\n${buf.toString("utf8").split(/\r?\n/).map((line) => `+${line}`).join("\n")}`);
      }
    }
    if (untrackedBlocks.length) out = [out, ...untrackedBlocks].filter(Boolean).join("\n\n");
  }
  if (out.length <= maxDiffChars) return out;
  return `[truncated ${out.length - maxDiffChars} chars]\n${out.slice(-maxDiffChars)}`;
}

const args = process.argv.slice(2);
const base = argValue(args, "--base", "HEAD~1");
const head = argValue(args, "--head", "HEAD");
const maxReviewers = Number(argValue(args, "--max-reviewers", "8")) || 8;
const maxHarnesses = Number(argValue(args, "--max-harnesses", "6")) || 6;
const maxDiffChars = Number(argValue(args, "--max-diff-chars", "12000")) || 12000;
const timeoutMs = Number(argValue(args, "--timeout-ms", "60000")) || 60000;
const maxTokens = Number(argValue(args, "--max-tokens", "900")) || 900;
const candidateId = argValue(args, "--candidate-id", "");
const changedArg = argValue(args, "--changed", "");
const historyPath = argValue(args, "--history", "reviews/review_cycle_history.json");
const outPath = argValue(args, "--out", "reviews/model_review_batch_latest.json");
const trustZone = argValue(args, "--trust-zone", "private_self");
const useWorktree = args.includes("--worktree");
const executeModels = args.includes("--execute");
const allowCloud = args.includes("--allow-cloud");
const noWrite = args.includes("--no-write");

const changedFiles = changedArg
  ? changedArg.split(",").map((item) => item.trim()).filter(Boolean)
  : useWorktree
    ? changedFilesFromWorktree()
    : changedFilesFromGit(base, head);

const packageJson = readJson("package.json", {});
const history = loadReviewCycleHistory(historyPath);
const plan = buildReviewCyclePlan({
  changedFiles,
  packageJson,
  history,
  maxReviewers,
  maxHarnesses,
  candidateId,
});
const diff = diffText({ base, head, changedFiles, useWorktree, maxDiffChars });
const batch = await runModelReviewBatch({
  plan,
  diffText: diff,
  executeModels,
  allowCloud,
  trustZone,
  timeoutMs,
  maxTokens,
});

let receiptPath = "";
if (!noWrite) receiptPath = writeModelReviewBatch(batch, { outPath });

console.log(JSON.stringify({
  schema_version: "dizzy.model_review_batch_summary.v1",
  batch_id: batch.batch_id,
  candidate_id: batch.candidate_id,
  execute_models: batch.execute_models,
  allow_cloud: batch.allow_cloud,
  packet_count: batch.packets.length,
  review_count: batch.reviews.length,
  statuses: batch.reviews.reduce((acc, review) => {
    const status = review.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}),
  review_results: batch.reviews.map((review) => ({
    role_key: review.role_key || review.source || "",
    status: review.status || "unknown",
    skipped_reason: review.skipped_reason || "",
    error: review.error || "",
    likely_root_cause: review.diagnosis?.likely_root_cause || "",
    next_actions: Array.isArray(review.diagnosis?.next_actions) ? review.diagnosis.next_actions.slice(0, 2) : [],
    findings: Array.isArray(review.findings) ? review.findings.length : 0,
  })),
  receipt_path: receiptPath,
  authority: batch.authority,
}, null, 2));
