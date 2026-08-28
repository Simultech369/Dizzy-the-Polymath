import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import {
  reconcileReviewBatch,
  updateReviewHistory,
} from "./review_cycle_orchestrator.mjs";

export const REVIEW_CYCLE_RUN_SCHEMA = "dizzy.review_cycle_run.v1";

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

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function windowsNpmCommandLine(npmBin, script) {
  const safeNpmBin = String(npmBin).replace(/"/g, "");
  if (/[\s&()^]/.test(safeNpmBin)) return `call "${safeNpmBin}" run ${script}`;
  return `${safeNpmBin} run ${script}`;
}

export function redactReviewLoopText(text = "") {
  return String(text ?? "")
    .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*["'`]?[^"'\s`]+["'`]?/gi, "$1=[REDACTED]")
    .replace(/\bauthorization\s*[:=]\s*bearer\s+[^"'\s`]+/gi, "authorization: Bearer [REDACTED]")
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})\b/g, "[REDACTED_TOKEN]");
}

export function summarizeHarnessOutput(text = "", maxChars = 4000) {
  const redacted = redactReviewLoopText(text).trim();
  if (redacted.length <= maxChars) return redacted;
  return `[truncated ${redacted.length - maxChars} chars]\n${redacted.slice(-maxChars)}`;
}

export function runHarnessCommand(harness, {
  rootDir = process.cwd(),
  timeoutMs = 120000,
  npmBin = process.platform === "win32" ? "npm.cmd" : "npm",
} = {}) {
  if (!/^[A-Za-z0-9:_-]+$/.test(String(harness.script || ""))) {
    return {
      name: harness.script || "unknown_harness",
      script: harness.script || "unknown_harness",
      status: "failed",
      exit_code: null,
      signal: "",
      duration_ms: 0,
      timed_out: false,
      side_effect_class: harness.side_effect_class || "unknown",
      stdout_tail: "",
      stderr_tail: "invalid npm script name",
    };
  }
  const started = Date.now();
  const command = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : npmBin;
  const commandArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", windowsNpmCommandLine(npmBin, harness.script)]
    : ["run", harness.script];
  const run = spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
    windowsHide: true,
  });
  const durationMs = Date.now() - started;
  const timedOut = run.error?.code === "ETIMEDOUT";
  const passed = run.status === 0 && !timedOut;
  return {
    name: harness.script,
    script: harness.script,
    status: passed ? "passed" : "failed",
    exit_code: run.status ?? null,
    signal: run.signal ?? "",
    duration_ms: durationMs,
    timed_out: timedOut,
    side_effect_class: harness.side_effect_class || "unknown",
    stdout_tail: summarizeHarnessOutput(run.stdout || ""),
    stderr_tail: summarizeHarnessOutput(run.stderr || run.error?.message || ""),
  };
}

function sanitizeFinding(finding = {}) {
  return {
    kind: String(finding.kind || "").slice(0, 80),
    disposition: String(finding.disposition || "").slice(0, 80),
    severity: String(finding.severity || "").slice(0, 40),
    category: String(finding.category || "").slice(0, 80),
    claim: summarizeHarnessOutput(finding.claim || finding.summary || "", 600),
  };
}

function sanitizeReview(review = {}) {
  const findings = Array.isArray(review.findings) ? review.findings.map(sanitizeFinding) : [];
  return {
    source: String(review.source || review.role_key || "unknown_review").slice(0, 120),
    role_key: String(review.role_key || review.source || "").slice(0, 120),
    status: String(review.status || "submitted").slice(0, 60),
    findings,
  };
}

function normalizeHarnessResult(harness, result = {}) {
  const status = String(result.status || (result.exit_code === 0 ? "passed" : "failed")).toLowerCase();
  return {
    name: result.name || harness.script,
    script: result.script || harness.script,
    status: status === "passed" ? "passed" : "failed",
    exit_code: result.exit_code ?? null,
    signal: result.signal || "",
    duration_ms: safeNumber(result.duration_ms, 0),
    timed_out: Boolean(result.timed_out),
    side_effect_class: result.side_effect_class || harness.side_effect_class || "unknown",
    stdout_tail: summarizeHarnessOutput(result.stdout_tail || result.stdout || ""),
    stderr_tail: summarizeHarnessOutput(result.stderr_tail || result.stderr || result.error || ""),
  };
}

export async function runReviewCycle({
  plan,
  reviews = [],
  runHarness = runHarnessCommand,
  rootDir = process.cwd(),
  now = new Date(),
  timeoutMs = 120000,
  minReviewsForPush = 3,
  requireDisagreement = true,
  failFast = false,
} = {}) {
  if (!plan || typeof plan !== "object") throw new Error("review cycle plan is required");
  const createdAt = nowIso(now);
  const harnesses = [];
  for (const harness of Array.isArray(plan.harness_plan) ? plan.harness_plan : []) {
    const rawResult = await runHarness(harness, { rootDir, timeoutMs });
    const result = normalizeHarnessResult(harness, rawResult);
    harnesses.push(result);
    if (failFast && result.status !== "passed") break;
  }

  const cleanReviews = (Array.isArray(reviews) ? reviews : []).map(sanitizeReview);
  const reconciliation = reconcileReviewBatch({
    reviews: cleanReviews,
    harnesses,
    minReviewsForPush,
    requireDisagreement,
  });
  const runId = `cycle_${sha256Short(JSON.stringify({
    candidate_id: plan.candidate_id,
    created_at: createdAt,
    harnesses: harnesses.map((harness) => [harness.script, harness.status, harness.exit_code]),
    reviews: cleanReviews.map((review) => review.source),
  }))}`;

  return {
    schema_version: REVIEW_CYCLE_RUN_SCHEMA,
    run_id: runId,
    candidate_id: plan.candidate_id || "",
    created_at: createdAt,
    changed_files: Array.isArray(plan.changed_files) ? plan.changed_files : [],
    domains: Array.isArray(plan.domains) ? plan.domains : [],
    blast_radius: plan.blast_radius || "",
    autonomy_boundary: plan.autonomy_boundary,
    reviewer_assignments: Array.isArray(plan.reviewer_assignments) ? plan.reviewer_assignments : [],
    harnesses,
    reviews: cleanReviews,
    reconciliation,
  };
}

export function loadReviewCycleHistory(filePath = "reviews/review_cycle_history.json", { rootDir = process.cwd() } = {}) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(rootDir, filePath), "utf8"));
  } catch {
    return {};
  }
}

export function writeReviewCycleReceipt(receipt, {
  rootDir = process.cwd(),
  outPath = "reviews/review_cycle_latest.json",
} = {}) {
  const absPath = path.resolve(rootDir, outPath);
  atomicWriteText(absPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return absPath;
}

export function updateReviewCycleHistory(history = {}, receipt = {}) {
  const next = updateReviewHistory(history, receipt.reviews || []);
  next.harnesses = { ...(next.harnesses || {}) };
  for (const harness of Array.isArray(receipt.harnesses) ? receipt.harnesses : []) {
    const key = String(harness.script || harness.name || "").trim();
    if (!key) continue;
    const current = next.harnesses[key] || {};
    const runs = Math.max(0, Number(current.runs || 0)) + 1;
    const passes = Math.max(0, Number(current.passes || 0)) + (harness.status === "passed" ? 1 : 0);
    const failures = Math.max(0, Number(current.failures || 0)) + (harness.status === "passed" ? 0 : 1);
    next.harnesses[key] = {
      runs,
      passes,
      failures,
      total_duration_ms: Math.max(0, Number(current.total_duration_ms || 0)) + safeNumber(harness.duration_ms, 0),
      last_status: harness.status || "unknown",
      last_run_at: receipt.created_at || nowIso(),
    };
  }
  next.cycles = Array.isArray(next.cycles) ? next.cycles.slice(-49) : [];
  next.cycles.push({
    run_id: receipt.run_id || "",
    candidate_id: receipt.candidate_id || "",
    created_at: receipt.created_at || nowIso(),
    state_transition: receipt.reconciliation?.state_transition || "ready-for-review",
    harness_count: Array.isArray(receipt.harnesses) ? receipt.harnesses.length : 0,
    review_count: Array.isArray(receipt.reviews) ? receipt.reviews.length : 0,
  });
  next.last_run_at = receipt.created_at || nowIso();
  return next;
}

export function writeReviewCycleHistory(history, {
  rootDir = process.cwd(),
  historyPath = "reviews/review_cycle_history.json",
} = {}) {
  const absPath = path.resolve(rootDir, historyPath);
  atomicWriteText(absPath, `${JSON.stringify(history, null, 2)}\n`);
  return absPath;
}
