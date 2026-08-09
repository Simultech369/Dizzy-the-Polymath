import { runReviewLoopSupervisor } from "../lib/review_loop_supervisor.mjs";

function argValue(args, name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function numArg(args, name, fallback) {
  const n = Number(argValue(args, name, String(fallback)));
  return Number.isFinite(n) ? n : fallback;
}

function listArg(args, name) {
  const raw = argValue(args, name, "");
  return raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : null;
}

const args = process.argv.slice(2);
const summary = await runReviewLoopSupervisor({
  base: argValue(args, "--base", "HEAD~1"),
  head: argValue(args, "--head", "HEAD"),
  useWorktree: args.includes("--worktree"),
  changedFiles: listArg(args, "--changed"),
  candidateId: argValue(args, "--candidate-id", ""),
  historyPath: argValue(args, "--history", "reviews/review_cycle_history.json"),
  maxReviewers: numArg(args, "--max-reviewers", 8),
  maxHarnesses: numArg(args, "--max-harnesses", 6),
  maxDiffChars: numArg(args, "--max-diff-chars", 12000),
  timeoutMs: numArg(args, "--timeout-ms", 60000),
  maxTokens: numArg(args, "--max-tokens", 900),
  minReviewsForPush: numArg(args, "--min-reviews-for-push", 3),
  executeModels: args.includes("--execute-models"),
  allowCloud: args.includes("--allow-cloud"),
  trustZone: argValue(args, "--trust-zone", "private_self"),
  requireDisagreement: !args.includes("--no-require-disagreement"),
  failFast: args.includes("--fail-fast"),
  includeReceiptHarnesses: args.includes("--include-receipt-harnesses"),
  writeReceipts: args.includes("--write"),
  writeHistory: args.includes("--write-history"),
  modelReviewOutPath: argValue(args, "--model-review-out", "reviews/model_review_batch_latest.json"),
  reviewCycleOutPath: argValue(args, "--cycle-out", "reviews/review_cycle_latest.json"),
  reviewSynthesisOutPath: argValue(args, "--synthesis-out", "reviews/review_synthesis_latest.json"),
  supervisorOutPath: argValue(args, "--supervisor-out", "reviews/review_loop_supervisor_latest.json"),
});

console.log(JSON.stringify(summary, null, 2));

if (!args.includes("--no-fail-on-transition") && ["reject", "quarantine", "fixture-required"].includes(summary.run_summary.state_transition)) {
  process.exit(1);
}
