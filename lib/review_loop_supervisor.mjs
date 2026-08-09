import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { buildReviewCoverageReport } from "./review_cycle_coverage.mjs";
import { buildReviewCyclePlan } from "./review_cycle_orchestrator.mjs";
import {
  loadReviewCycleHistory,
  runHarnessCommand,
  runReviewCycle,
  updateReviewCycleHistory,
  writeReviewCycleHistory,
  writeReviewCycleReceipt,
} from "./review_cycle_runner.mjs";
import {
  runModelReviewBatch,
  writeModelReviewBatch,
} from "./review_model_runner.mjs";

export const REVIEW_LOOP_SUPERVISOR_SCHEMA = "dizzy.review_loop_supervisor.v1";

function sha256Short(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex").slice(0, 12);
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function atomicWriteText(filePath, text) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, text, "utf8");
  try {
    fs.renameSync(tmp, filePath);
  } catch {
    fs.copyFileSync(tmp, filePath);
    fs.unlinkSync(tmp);
  }
}

function readJson(filePath, fallback = {}, { rootDir = process.cwd() } = {}) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(rootDir, filePath), "utf8"));
  } catch {
    return fallback;
  }
}

function git(args, { rootDir = process.cwd() } = {}) {
  const result = spawnSync("git", args, { encoding: "utf8", cwd: rootDir });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${String(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

export function changedFilesFromGit({ base = "HEAD~1", head = "HEAD", rootDir = process.cwd() } = {}) {
  return git(["diff", "--name-only", `${base}..${head}`], { rootDir })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function changedFilesFromWorktree({ rootDir = process.cwd() } = {}) {
  const files = [];
  for (const line of git(["status", "--short", "--untracked-files=all"], { rootDir }).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const payload = line.slice(3).trim();
    if (!payload) continue;
    const renameParts = payload.split(" -> ");
    files.push(renameParts[renameParts.length - 1]);
  }
  return [...new Set(files)].sort();
}

export function diffTextForReview({
  base = "HEAD~1",
  head = "HEAD",
  changedFiles = [],
  useWorktree = false,
  maxDiffChars = 12000,
  rootDir = process.cwd(),
} = {}) {
  const diffArgs = useWorktree ? ["diff", "--"] : ["diff", `${base}..${head}`, "--"];
  let out = git([...diffArgs, ...changedFiles], { rootDir }).trim();
  if (useWorktree) {
    const untrackedBlocks = [];
    for (const relPath of changedFiles) {
      const tracked = spawnSync("git", ["ls-files", "--error-unmatch", relPath], { encoding: "utf8", cwd: rootDir });
      const absPath = path.resolve(rootDir, relPath);
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

function planForNoWrite(plan, { includeReceiptHarnesses = false } = {}) {
  const harnesses = Array.isArray(plan?.harness_plan) ? plan.harness_plan : [];
  const skipped = includeReceiptHarnesses
    ? []
    : harnesses.filter((harness) => harness.side_effect_class === "writes_receipts_context_only");
  return {
    plan: {
      ...plan,
      harness_plan: includeReceiptHarnesses
        ? harnesses
        : harnesses.filter((harness) => harness.side_effect_class !== "writes_receipts_context_only"),
    },
    skipped_receipt_harnesses: skipped.map((harness) => ({
      script: harness.script,
      side_effect_class: harness.side_effect_class,
      reason: "receipt_writing_harness_requires_explicit_opt_in",
    })),
  };
}

function summarizeModelBatch(batch = {}) {
  const reviews = Array.isArray(batch.reviews) ? batch.reviews : [];
  return {
    batch_id: batch.batch_id || "",
    execute_models: Boolean(batch.execute_models),
    allow_cloud: Boolean(batch.allow_cloud),
    packet_count: Array.isArray(batch.packets) ? batch.packets.length : 0,
    review_count: reviews.length,
    statuses: reviews.reduce((acc, review) => {
      const status = review.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}),
    availability_rechecks: reviews
      .filter((review) => review.diagnosis?.likely_root_cause)
      .map((review) => ({
        role_key: review.role_key || review.source || "",
        skipped_reason: review.skipped_reason || "",
        likely_root_cause: review.diagnosis?.likely_root_cause || "",
      })),
    authority: batch.authority || "model_output_is_claims_only_local_evidence_decides",
  };
}

function summarizeCoverage(report = {}) {
  return {
    reviewers: {
      total: report.reviewers?.total || 0,
      attempted: report.reviewers?.attempted || 0,
      touched: report.reviewers?.touched || 0,
      untouched: report.reviewers?.untouched || 0,
      availability_recheck: (report.reviewers?.availability_recheck || []).map((reviewer) => ({
        role_key: reviewer.role_key,
        attempts: reviewer.attempts,
        runs: reviewer.runs,
        last_likely_root_cause: reviewer.last_likely_root_cause,
      })),
    },
    harnesses: {
      total: report.harnesses?.total || 0,
      touched: report.harnesses?.touched || 0,
      untouched: report.harnesses?.untouched || 0,
      unstable: (report.harnesses?.unstable || []).map((harness) => ({
        script: harness.script,
        failures: harness.failures,
        last_status: harness.last_status,
      })),
    },
    authority: report.authority || "coverage_informs_rotation_only",
  };
}

export function writeSupervisorReceipt(receipt, {
  rootDir = process.cwd(),
  outPath = "reviews/review_loop_supervisor_latest.json",
} = {}) {
  const absPath = path.resolve(rootDir, outPath);
  atomicWriteText(absPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return absPath;
}

export async function runReviewLoopSupervisor({
  rootDir = process.cwd(),
  base = "HEAD~1",
  head = "HEAD",
  useWorktree = false,
  changedFiles = null,
  packageJson = null,
  history = null,
  historyPath = "reviews/review_cycle_history.json",
  candidateId = "",
  maxReviewers = 8,
  maxHarnesses = 6,
  maxDiffChars = 12000,
  diffText = null,
  executeModels = false,
  allowCloud = false,
  trustZone = "private_self",
  timeoutMs = 60000,
  maxTokens = 900,
  minReviewsForPush = 3,
  requireDisagreement = true,
  failFast = false,
  includeReceiptHarnesses = false,
  writeReceipts = false,
  writeHistory = false,
  modelReviewOutPath = "reviews/model_review_batch_latest.json",
  reviewCycleOutPath = "reviews/review_cycle_latest.json",
  supervisorOutPath = "reviews/review_loop_supervisor_latest.json",
  runHarness = runHarnessCommand,
  generateText,
  now = new Date(),
} = {}) {
  const files = Array.isArray(changedFiles)
    ? changedFiles
    : useWorktree
      ? changedFilesFromWorktree({ rootDir })
      : changedFilesFromGit({ base, head, rootDir });
  const pkg = packageJson || readJson("package.json", {}, { rootDir });
  const currentHistory = history || loadReviewCycleHistory(historyPath, { rootDir });
  const initialPlan = buildReviewCyclePlan({
    changedFiles: files,
    packageJson: pkg,
    history: currentHistory,
    maxReviewers,
    maxHarnesses,
    candidateId,
    now,
  });
  const effectiveIncludeReceiptHarnesses = Boolean(includeReceiptHarnesses || writeReceipts);
  const { plan, skipped_receipt_harnesses: skippedReceiptHarnesses } = planForNoWrite(initialPlan, {
    includeReceiptHarnesses: effectiveIncludeReceiptHarnesses,
  });
  const reviewDiffText = diffText === null || diffText === undefined
    ? diffTextForReview({
        base,
        head,
        changedFiles: files,
        useWorktree,
        maxDiffChars,
        rootDir,
      })
    : String(diffText);
  const modelBatch = await runModelReviewBatch({
    plan,
    diffText: reviewDiffText,
    executeModels,
    allowCloud,
    trustZone,
    timeoutMs,
    maxTokens,
    ...(generateText ? { generateText } : {}),
    now,
  });
  const cycleReceipt = await runReviewCycle({
    plan,
    reviews: modelBatch.reviews,
    runHarness,
    rootDir,
    now,
    timeoutMs,
    minReviewsForPush,
    requireDisagreement,
    failFast,
  });
  const projectedHistory = updateReviewCycleHistory(currentHistory, cycleReceipt);
  const coverage = buildReviewCoverageReport({
    history: projectedHistory,
    packageJson: pkg,
    now,
  });
  const receiptPaths = {
    model_review_batch: "",
    review_cycle: "",
    review_history: "",
    supervisor: "",
  };
  if (writeReceipts) {
    receiptPaths.model_review_batch = writeModelReviewBatch(modelBatch, { rootDir, outPath: modelReviewOutPath });
    receiptPaths.review_cycle = writeReviewCycleReceipt(cycleReceipt, { rootDir, outPath: reviewCycleOutPath });
    receiptPaths.supervisor = writeSupervisorReceipt({
      schema_version: REVIEW_LOOP_SUPERVISOR_SCHEMA,
      receipt_id: `loop_${sha256Short(JSON.stringify({ candidate_id: plan.candidate_id, created_at: nowIso(now) }))}`,
      candidate_id: plan.candidate_id || "",
      created_at: nowIso(now),
      changed_files: files,
      model_batch: modelBatch,
      cycle_receipt: cycleReceipt,
      coverage,
      authority: "automation_proposes_simul_approves",
    }, { rootDir, outPath: supervisorOutPath });
  }
  if (writeHistory) {
    receiptPaths.review_history = writeReviewCycleHistory(projectedHistory, { rootDir, historyPath });
  }

  return {
    schema_version: REVIEW_LOOP_SUPERVISOR_SCHEMA,
    run_id: `loop_${sha256Short(JSON.stringify({
      candidate_id: plan.candidate_id,
      created_at: nowIso(now),
      files,
    }))}`,
    candidate_id: plan.candidate_id || "",
    created_at: nowIso(now),
    changed_files: files,
    write_mode: {
      receipts: Boolean(writeReceipts),
      history: Boolean(writeHistory),
      receipt_harnesses: effectiveIncludeReceiptHarnesses,
    },
    plan_summary: {
      domains: plan.domains || [],
      blast_radius: plan.blast_radius || "",
      reviewer_count: Array.isArray(plan.reviewer_assignments) ? plan.reviewer_assignments.length : 0,
      harness_count: Array.isArray(plan.harness_plan) ? plan.harness_plan.length : 0,
      skipped_receipt_harnesses: skippedReceiptHarnesses,
    },
    model_batch_summary: summarizeModelBatch(modelBatch),
    run_summary: {
      run_id: cycleReceipt.run_id || "",
      state_transition: cycleReceipt.reconciliation?.state_transition || "",
      reason: cycleReceipt.reconciliation?.reason || "",
      harnesses: (cycleReceipt.harnesses || []).map((harness) => ({
        script: harness.script,
        status: harness.status,
        duration_ms: harness.duration_ms,
        side_effect_class: harness.side_effect_class,
      })),
      failed_harnesses: cycleReceipt.reconciliation?.failed_harnesses || [],
      counts: cycleReceipt.reconciliation?.counts || {},
      authority: cycleReceipt.reconciliation?.authority || "automation_proposes_simul_approves",
    },
    coverage_summary: summarizeCoverage(coverage),
    receipt_paths: receiptPaths,
    authority: "automation_proposes_simul_approves",
  };
}
