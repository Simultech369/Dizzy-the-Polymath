import { discoverHarnesses, getReviewerRoster } from "./review_cycle_orchestrator.mjs";

export const REVIEW_COVERAGE_SCHEMA = "dizzy.review_cycle_coverage.v1";

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function reviewerScore(stats = {}) {
  const runs = safeNumber(stats.runs, 0);
  if (!runs) return 0;
  const confirmed = safeNumber(stats.confirmed_findings, 0);
  const disagreements = safeNumber(stats.useful_disagreements, 0);
  const falsePositives = safeNumber(stats.false_positive_findings, 0);
  return Number(((confirmed * 3 + disagreements * 1.5 - falsePositives * 2) / runs).toFixed(3));
}

function harnessScore(stats = {}) {
  const runs = safeNumber(stats.runs, 0);
  if (!runs) return 0;
  const passes = safeNumber(stats.passes, 0);
  const failures = safeNumber(stats.failures, 0);
  const avgDuration = runs ? safeNumber(stats.total_duration_ms, 0) / runs : 0;
  const durationPenalty = Math.min(1.5, avgDuration / 120000);
  return Number(((passes - failures * 2) / runs - durationPenalty).toFixed(3));
}

function pct(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

export function buildReviewCoverageReport({
  history = {},
  packageJson = {},
  maxItems = 8,
  now = new Date(),
} = {}) {
  const reviewerHistory = history.reviewers || {};
  const harnessHistory = history.harnesses || {};
  const reviewers = getReviewerRoster().map((reviewer) => {
    const stats = reviewerHistory[reviewer.role_key] || {};
    return {
      role_key: reviewer.role_key,
      division_key: reviewer.division_key,
      primary_model: reviewer.primary_model,
      lens: reviewer.lens,
      runs: safeNumber(stats.runs, 0),
      confirmed_findings: safeNumber(stats.confirmed_findings, 0),
      false_positive_findings: safeNumber(stats.false_positive_findings, 0),
      useful_disagreements: safeNumber(stats.useful_disagreements, 0),
      score: reviewerScore(stats),
    };
  });
  const harnesses = discoverHarnesses(packageJson).map((harness) => {
    const stats = harnessHistory[harness.script] || {};
    return {
      script: harness.script,
      domains: harness.domains,
      side_effect_class: harness.side_effect_class,
      runs: safeNumber(stats.runs, 0),
      passes: safeNumber(stats.passes, 0),
      failures: safeNumber(stats.failures, 0),
      last_status: stats.last_status || "",
      score: harnessScore(stats),
    };
  });

  const reviewerTouched = reviewers.filter((reviewer) => reviewer.runs > 0);
  const harnessTouched = harnesses.filter((harness) => harness.runs > 0);
  const max = Math.max(1, safeNumber(maxItems, 8));
  return {
    schema_version: REVIEW_COVERAGE_SCHEMA,
    created_at: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
    authority: "coverage_informs_rotation_only",
    reviewers: {
      total: reviewers.length,
      touched: reviewerTouched.length,
      untouched: reviewers.length - reviewerTouched.length,
      touched_pct: pct(reviewerTouched.length, reviewers.length),
      next_rotation: reviewers
        .filter((reviewer) => reviewer.runs === 0)
        .sort((a, b) => a.role_key.localeCompare(b.role_key))
        .slice(0, max),
      high_signal: reviewers
        .filter((reviewer) => reviewer.runs > 0)
        .sort((a, b) => b.score - a.score || a.role_key.localeCompare(b.role_key))
        .slice(0, max),
      needs_recheck: reviewers
        .filter((reviewer) => reviewer.false_positive_findings > reviewer.confirmed_findings)
        .sort((a, b) => b.false_positive_findings - a.false_positive_findings || a.role_key.localeCompare(b.role_key))
        .slice(0, max),
    },
    harnesses: {
      total: harnesses.length,
      touched: harnessTouched.length,
      untouched: harnesses.length - harnessTouched.length,
      touched_pct: pct(harnessTouched.length, harnesses.length),
      next_rotation: harnesses
        .filter((harness) => harness.runs === 0)
        .sort((a, b) => a.script.localeCompare(b.script))
        .slice(0, max),
      high_signal: harnesses
        .filter((harness) => harness.runs > 0)
        .sort((a, b) => b.score - a.score || a.script.localeCompare(b.script))
        .slice(0, max),
      unstable: harnesses
        .filter((harness) => harness.failures > 0)
        .sort((a, b) => b.failures - a.failures || a.script.localeCompare(b.script))
        .slice(0, max),
    },
  };
}
