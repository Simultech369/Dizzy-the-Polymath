import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { buildReviewCyclePlan } from "../lib/review_cycle_orchestrator.mjs";
import { loadReviewCycleHistory } from "../lib/review_cycle_runner.mjs";
import {
  runModelReviewBatch,
  writeModelReviewBatch,
} from "../lib/review_model_runner.mjs";

const DEFAULT_REVIEW_CANDIDATE_EXCLUDE_PATTERNS = [
  /^reviews\/[^/]+_latest\.json$/i,
  /^(?:runtime|memory|artifacts|\.review-harness)\//i,
];
const DEFAULT_GROQ_FAST_MODEL = "llama-3.1-8b-instant";

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8"));
  } catch {
    return fallback;
  }
}

function readTextIfExists(filePath = "") {
  if (!filePath) return "";
  try {
    return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8").trim();
  } catch {
    return "";
  }
}

function argValue(args, name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function hasArg(args, name) {
  return args.includes(name);
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", cwd: process.cwd() });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${String(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

function normalizeGitPath(filePath = "") {
  return String(filePath || "").replace(/\\/g, "/").trim();
}

export function isDefaultReviewCandidateExcluded(filePath = "") {
  const normalized = normalizeGitPath(filePath);
  if (!normalized) return false;
  return DEFAULT_REVIEW_CANDIDATE_EXCLUDE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function splitReviewCandidateFiles(files = [], { includeGeneratedEvidence = false } = {}) {
  const included = [];
  const excluded = [];
  for (const filePath of files) {
    const normalized = normalizeGitPath(filePath);
    if (!normalized) continue;
    if (!includeGeneratedEvidence && isDefaultReviewCandidateExcluded(normalized)) {
      excluded.push(normalized);
    } else {
      included.push(normalized);
    }
  }
  return {
    changedFiles: [...new Set(included)].sort(),
    excludedFiles: [...new Set(excluded)].sort(),
  };
}

export function applyReviewerModelRotation(plan = {}, models = []) {
  const providerModels = (Array.isArray(models) ? models : String(models || "").split(","))
    .map((model) => String(model || "").trim())
    .filter(Boolean);
  if (!providerModels.length) return plan;
  const assignments = Array.isArray(plan.reviewer_assignments) ? plan.reviewer_assignments : [];
  return {
    ...plan,
    reviewer_assignments: assignments.map((reviewer, index) => ({
      ...reviewer,
      original_primary_model: reviewer.primary_model || "",
      primary_model: providerModels[index % providerModels.length],
      provider_model_override: true,
    })),
  };
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

export function diffText({ base, head, changedFiles, useWorktree, maxDiffChars }) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return "";
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

export async function main(argv = process.argv.slice(2)) {
  const args = argv;
  const localFast = hasArg(args, "--local-fast");
  const groqFast = hasArg(args, "--groq-fast");
  const compactFast = localFast || groqFast;
  const base = argValue(args, "--base", "HEAD~1");
  const head = argValue(args, "--head", "HEAD");
  const maxReviewers = Number(argValue(args, "--max-reviewers", compactFast ? "4" : "8")) || (compactFast ? 4 : 8);
  const maxHarnesses = Number(argValue(args, "--max-harnesses", "6")) || 6;
  const maxDiffChars = Number(argValue(args, "--max-diff-chars", compactFast ? "1000" : "12000")) || (compactFast ? 1000 : 12000);
  const timeoutMs = Number(argValue(args, "--timeout-ms", localFast ? "220000" : groqFast ? "60000" : "60000")) || (localFast ? 220000 : 60000);
  const maxTokens = Number(argValue(args, "--max-tokens", compactFast ? "320" : "900")) || (compactFast ? 320 : 900);
  const maxFindings = Number(argValue(args, "--max-findings", compactFast ? "2" : "0")) || 0;
  const candidateId = argValue(args, "--candidate-id", "");
  const changedArg = argValue(args, "--changed", "");
  const historyPath = argValue(args, "--history", "reviews/review_cycle_history.json");
  const outPath = argValue(args, "--out", "reviews/model_review_batch_latest.json");
  const partialOutPath = argValue(args, "--partial-out", outPath);
  const resumeFrom = argValue(args, "--resume-from", "");
  const reviewProfile = argValue(args, "--review-profile", localFast ? "local_fast" : groqFast ? "groq_fast" : "standard");
  const trustZone = argValue(args, "--trust-zone", groqFast ? "trusted_collaborator" : "private_self");
  const cloudProvider = argValue(args, "--provider", groqFast ? "groq" : "");
  const cloudBaseUrl = argValue(args, "--base-url", "");
  const apiKeyFile = argValue(args, "--api-key-file", groqFast ? "runtime/secrets/GROQ_API_KEY.txt" : "");
  const cloudApiKey = readTextIfExists(apiKeyFile);
  const allowProviderEnv = !groqFast;
  const apiKeySource = cloudApiKey ? "file" : "";
  const providerModels = argValue(args, "--provider-models", groqFast ? DEFAULT_GROQ_FAST_MODEL : "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const useWorktree = args.includes("--worktree");
  const executeModels = args.includes("--execute");
  const allowCloud = args.includes("--allow-cloud") || groqFast;
  const noWrite = args.includes("--no-write");
  const preferLocalFallbacks = args.includes("--prefer-local-fallbacks") || (localFast && !groqFast);
  const progress = args.includes("--progress") || compactFast;
  const includeGeneratedEvidence = args.includes("--include-generated-evidence");

  const rawChangedFiles = changedArg
    ? changedArg.split(",").map((item) => item.trim()).filter(Boolean)
    : useWorktree
      ? changedFilesFromWorktree()
      : changedFilesFromGit(base, head);
  const { changedFiles, excludedFiles } = splitReviewCandidateFiles(rawChangedFiles, { includeGeneratedEvidence });

  const packageJson = readJson("package.json", {});
  const history = loadReviewCycleHistory(historyPath);
  const resumeBatch = resumeFrom ? readJson(resumeFrom, {}) : {};
  const resumeReviews = Array.isArray(resumeBatch.reviews) ? resumeBatch.reviews : [];
  const plan = applyReviewerModelRotation(buildReviewCyclePlan({
    changedFiles,
    packageJson,
    history,
    maxReviewers,
    maxHarnesses,
    candidateId,
  }), providerModels);
  const diff = diffText({ base, head, changedFiles, useWorktree, maxDiffChars });
  const batch = await runModelReviewBatch({
    plan,
    diffText: diff,
    executeModels,
    allowCloud,
    trustZone,
    timeoutMs,
    maxTokens,
    preferLocalFallbacks,
    cloudProvider,
    cloudBaseUrl,
    cloudApiKey,
    allowProviderEnv,
    reviewProfile,
    maxFindings,
    partialOutPath: noWrite ? "" : partialOutPath,
    resumeReviews,
    ...(progress ? {
      onProgress: (event) => {
        console.error(JSON.stringify({
          schema_version: "dizzy.model_review_progress.v1",
          created_at: new Date().toISOString(),
          ...event,
        }));
      },
    } : {}),
  });

  let receiptPath = "";
  if (!noWrite) receiptPath = writeModelReviewBatch(batch, { outPath });

  console.log(JSON.stringify({
    schema_version: "dizzy.model_review_batch_summary.v1",
    batch_id: batch.batch_id,
    candidate_id: batch.candidate_id,
    execute_models: batch.execute_models,
    allow_cloud: batch.allow_cloud,
    prefer_local_fallbacks: batch.prefer_local_fallbacks,
    trust_zone: trustZone,
    cloud_provider: cloudProvider,
    provider_models: providerModels,
    api_key_source: apiKeySource,
    review_profile: batch.review_profile,
    completion_status: batch.completion_status,
    expected_reviews: batch.expected_reviews,
    completed_reviews: batch.completed_reviews,
    resumed_review_count: batch.resumed_review_count,
    changed_files: changedFiles,
    excluded_candidate_files: excludedFiles,
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
      failure_stage: review.failure_stage || "",
      error: review.error || "",
      likely_root_cause: review.diagnosis?.likely_root_cause || "",
      next_actions: Array.isArray(review.diagnosis?.next_actions) ? review.diagnosis.next_actions.slice(0, 2) : [],
      findings: Array.isArray(review.findings) ? review.findings.length : 0,
    })),
    receipt_path: receiptPath,
    authority: batch.authority,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
