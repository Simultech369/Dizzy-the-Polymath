import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const DEFAULT_RESULTS = path.resolve(process.cwd(), "evaluations", "generative-capability", "results.json");

function tokens(text) {
  return new Set(String(text || "").toLowerCase().match(/[a-z0-9]+/g) || []);
}

function jaccardDistance(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return 1 - (intersection / union.size);
}

function hypothesisDistinctness(hypotheses) {
  const items = Array.isArray(hypotheses) ? hypotheses.map(String).filter(Boolean) : [];
  if (items.length < 2) return 0;
  const distances = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) distances.push(jaccardDistance(items[i], items[j]));
  }
  return distances.reduce((sum, value) => sum + value, 0) / distances.length;
}

function scoreMode(mode = {}) {
  const provenanceTotal = Math.max(0, Number(mode.provenance_total || 0));
  const provenanceCorrect = Math.max(0, Math.min(provenanceTotal, Number(mode.provenance_correct || 0)));
  return {
    insight: Math.max(0, Math.min(5, Number(mode.operator_insight || 0))),
    provenance_quality: provenanceTotal ? provenanceCorrect / provenanceTotal : 0,
    distinctness: hypothesisDistinctness(mode.hypotheses),
    hypothesis_count: Array.isArray(mode.hypotheses) ? mode.hypotheses.filter(Boolean).length : 0,
    selection_recorded: Boolean(String(mode.selection_criteria || "").trim()),
    rejected_alternatives_recorded: Array.isArray(mode.rejected_alternatives) && mode.rejected_alternatives.length > 0,
  };
}

export function evaluateGenerativeCapability(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("results must contain at least one evaluation case");
  const cases = rows.map((row) => ({
    id: String(row.id || ""),
    baseline: scoreMode(row.baseline),
    divergent: scoreMode(row.divergent),
  }));
  if (cases.some((row) => !row.id)) throw new Error("every evaluation case requires an id");

  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const baselineInsight = mean(cases.map((row) => row.baseline.insight));
  const divergentInsight = mean(cases.map((row) => row.divergent.insight));
  const insightImprovement = baselineInsight > 0 ? (divergentInsight - baselineInsight) / baselineInsight : 0;
  const distinctCaseRate = mean(cases.map((row) => row.divergent.hypothesis_count >= 3 && row.divergent.distinctness >= 0.6 ? 1 : 0));
  const provenanceQuality = mean(cases.map((row) => row.divergent.provenance_quality));
  const decisionRecordRate = mean(cases.map((row) => row.divergent.selection_recorded && row.divergent.rejected_alternatives_recorded ? 1 : 0));

  const thresholds = {
    minimum_cases: 20,
    insight_improvement: 0.20,
    distinct_case_rate: 0.80,
    provenance_quality: 0.95,
    decision_record_rate: 1,
  };
  const checks = {
    minimum_cases: cases.length >= thresholds.minimum_cases,
    insight_improvement: insightImprovement >= thresholds.insight_improvement,
    distinct_case_rate: distinctCaseRate >= thresholds.distinct_case_rate,
    provenance_quality: provenanceQuality >= thresholds.provenance_quality,
    decision_record_rate: decisionRecordRate >= thresholds.decision_record_rate,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    case_count: cases.length,
    metrics: {
      baseline_insight: baselineInsight,
      divergent_insight: divergentInsight,
      insight_improvement: insightImprovement,
      distinct_case_rate: distinctCaseRate,
      provenance_quality: provenanceQuality,
      decision_record_rate: decisionRecordRate,
    },
    thresholds,
    checks,
    cases,
  };
}

function main() {
  const resultsPath = path.resolve(process.argv[2] || DEFAULT_RESULTS);
  if (!fs.existsSync(resultsPath)) {
    console.log(`SKIPPED_PRECONDITION: No evaluation results found at ${resultsPath}`);
    console.log("Copy cases.template.json to results.json, run baseline and three-hypothesis generations, then add blinded operator ratings and provenance counts.");
    return;
  }
  const report = evaluateGenerativeCapability(JSON.parse(fs.readFileSync(resultsPath, "utf8")));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
