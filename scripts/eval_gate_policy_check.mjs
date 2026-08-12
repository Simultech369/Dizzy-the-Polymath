import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { runRetrievalEval } from "./retrieval_eval.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

export const EVAL_GATE_POLICY_SCHEMA = "dizzy.eval_gate_policy.v1";

export const DEFAULT_THRESHOLDS = Object.freeze({
  retrieval_hit_rate_top_3_pct: 85.0,
  retrieval_mrr: 0.60,
});

export const GENERATED_RECEIPT_PATTERNS = Object.freeze([
  /^reviews\/[^/]+_latest\.json$/i,
  /^reviews\/review_cycle_history\.json$/i,
  /^runtime\/router_receipts\.jsonl$/i,
  /^runtime\/automation_receipts\.jsonl$/i,
  /^runtime\/.*_latest\.(json|jsonl)$/i,
]);

const REQUIRED_HARNESSES = Object.freeze([
  {
    id: "dashboard-safety",
    label: "Dashboard Safety Harness",
    command: [process.execPath, ["scripts/dashboard_safety_harness_test.mjs"]],
  },
  {
    id: "review-loop-run",
    label: "Review Loop Run Safety",
    command: [process.execPath, ["scripts/review_cycle_run_test.mjs"]],
  },
  {
    id: "review-loop-supervisor",
    label: "Review Loop Supervisor Safety",
    command: [process.execPath, ["scripts/review_loop_supervisor_test.mjs"]],
  },
  {
    id: "review-model-runner",
    label: "Review Model Runner Safety",
    command: [process.execPath, ["scripts/review_model_runner_test.mjs"]],
  },
]);

function normalizeRepoPath(value = "") {
  return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function tail(text, maxLines = 8) {
  return String(text || "").trim().split(/\r?\n/).filter(Boolean).slice(-maxLines).join("\n");
}

export function isGeneratedReceiptArtifact(filePath) {
  const normalized = normalizeRepoPath(filePath);
  return GENERATED_RECEIPT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function gitLines(args, { rootDir = ROOT_DIR } = {}) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    return {
      ok: false,
      error: tail(result.stderr || result.stdout),
      paths: [],
    };
  }
  return {
    ok: true,
    error: "",
    paths: String(result.stdout || "").split(/\r?\n/).map(normalizeRepoPath).filter(Boolean),
  };
}

export function findGeneratedReceiptMaterial({ rootDir = ROOT_DIR, paths = null } = {}) {
  if (Array.isArray(paths)) {
    return {
      ok: true,
      paths: [...new Set(paths.map(normalizeRepoPath).filter(isGeneratedReceiptArtifact))].sort(),
      error: "",
    };
  }

  const tracked = gitLines(["ls-files"], { rootDir });
  if (!tracked.ok) return { ok: false, paths: [], error: tracked.error };

  const staged = gitLines(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { rootDir });
  if (!staged.ok) return { ok: false, paths: [], error: staged.error };

  const candidates = [...tracked.paths, ...staged.paths];
  return {
    ok: true,
    paths: [...new Set(candidates.filter(isGeneratedReceiptArtifact))].sort(),
    error: "",
  };
}

function runHarness({ id, label, command }, { rootDir = ROOT_DIR } = {}) {
  const [bin, args] = command;
  const result = spawnSync(bin, args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    timeout: 300000,
  });
  return {
    id,
    label,
    status: result.status === 0 ? "passed" : "failed",
    exit_code: result.status,
    stdout_tail: tail(result.stdout),
    stderr_tail: tail(result.stderr),
  };
}

export function evaluateRetrievalPromotion(result, thresholds = DEFAULT_THRESHOLDS) {
  const metrics = result?.receipt?.metrics || {};
  const hitRate = Number(metrics.hit_rate_top_3_pct);
  const mrr = Number(metrics.mrr);
  const ok = Boolean(result?.ok)
    && Number.isFinite(hitRate)
    && Number.isFinite(mrr)
    && hitRate >= thresholds.retrieval_hit_rate_top_3_pct
    && mrr >= thresholds.retrieval_mrr;
  return {
    id: "golden-retrieval",
    label: "Golden Retrieval Promotion Floor",
    status: ok ? "passed" : "failed",
    metrics: {
      hit_rate_top_3_pct: Number.isFinite(hitRate) ? hitRate : 0,
      mrr: Number.isFinite(mrr) ? mrr : 0,
    },
    thresholds,
  };
}

export async function runEvalGatePolicy({
  rootDir = ROOT_DIR,
  thresholds = DEFAULT_THRESHOLDS,
  runHarnesses = true,
  receiptPaths = null,
  logger = console,
} = {}) {
  const checks = [];

  const retrieval = runRetrievalEval({
    writeReceipt: false,
    minHitRateTop3: thresholds.retrieval_hit_rate_top_3_pct,
    minMrr: thresholds.retrieval_mrr,
    logger,
  });
  checks.push(evaluateRetrievalPromotion(retrieval, thresholds));

  if (runHarnesses) {
    for (const harness of REQUIRED_HARNESSES) checks.push(runHarness(harness, { rootDir }));
  }

  const receiptMaterial = findGeneratedReceiptMaterial({ rootDir, paths: receiptPaths });
  checks.push({
    id: "generated-receipt-material",
    label: "Generated Receipt Commit Material",
    status: receiptMaterial.ok && receiptMaterial.paths.length === 0 ? "passed" : "failed",
    paths: receiptMaterial.paths || [],
    error: receiptMaterial.error || "",
  });

  const failed = checks.filter((check) => check.status !== "passed");
  return {
    schema_version: EVAL_GATE_POLICY_SCHEMA,
    authority: "promotion_gate_blocks_only_simul_approves_push",
    status: failed.length ? "failed" : "passed",
    thresholds,
    checks,
  };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("eval_gate_policy_check.mjs")) {
  const report = await runEvalGatePolicy();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "passed") {
    console.error("EVAL_GATE_POLICY_FAIL");
    process.exit(1);
  }
  console.log("EVAL_GATE_POLICY_OK");
}
