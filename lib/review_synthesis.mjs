import crypto from "crypto";
import fs from "fs";
import path from "path";
import { reconcileReviewBatch } from "./review_cycle_orchestrator.mjs";
import {
  summarizeHarnessOutput,
} from "./review_cycle_runner.mjs";

export const REVIEW_SYNTHESIS_SCHEMA = "dizzy.review_synthesis.v1";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStatus(status = "") {
  return String(status || "submitted").trim().toLowerCase();
}

function isUsableReview(review = {}) {
  return !["skipped", "failed", "errored"].includes(normalizeStatus(review.status));
}

function normalizeSeverity(severity = "") {
  const s = String(severity || "").trim().toLowerCase();
  if (["critical", "high", "medium", "low"].includes(s)) return s;
  return "medium";
}

function severityRank(severity = "") {
  return { critical: 4, high: 3, medium: 2, low: 1 }[normalizeSeverity(severity)] || 2;
}

function normalizeCategory(finding = {}) {
  return String(finding.category || finding.kind || "uncategorized").trim().toLowerCase().slice(0, 80);
}

function tokensForClaim(claim = "") {
  return String(claim || "")
    .toLowerCase()
    .replace(/[^a-z0-9_:/.-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .slice(0, 16)
    .sort();
}

function findingSignature(finding = {}) {
  const category = normalizeCategory(finding);
  const tokens = tokensForClaim(finding.claim || finding.summary || "");
  const tokenPart = tokens.length ? tokens.join("_") : sha256Short(finding.claim || finding.summary || category);
  return `${category}:${tokenPart}`.slice(0, 180);
}

function sanitizeEvidenceList(evidence = []) {
  return asArray(evidence)
    .map((item) => summarizeHarnessOutput(item, 240))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeFinding(finding = {}, review = {}) {
  return {
    signature: findingSignature(finding),
    source: String(review.source || review.role_key || finding.source || "unknown_review").slice(0, 120),
    role_key: String(review.role_key || review.source || "").slice(0, 120),
    kind: String(finding.kind || "").slice(0, 80),
    disposition: String(finding.disposition || "new").slice(0, 80),
    severity: normalizeSeverity(finding.severity),
    category: normalizeCategory(finding),
    claim: summarizeHarnessOutput(finding.claim || finding.summary || "", 700),
    evidence: sanitizeEvidenceList(finding.evidence),
  };
}

function collectReviews({ reviews = [], modelBatches = [], cycleReceipts = [], supervisorRuns = [] } = {}) {
  const out = [...asArray(reviews)];
  for (const batch of asArray(modelBatches)) out.push(...asArray(batch?.reviews));
  for (const cycle of asArray(cycleReceipts)) out.push(...asArray(cycle?.reviews));
  for (const run of asArray(supervisorRuns)) {
    if (run?.model_batch) out.push(...asArray(run.model_batch.reviews));
    if (run?.cycle_receipt) out.push(...asArray(run.cycle_receipt.reviews));
  }
  return out;
}

function collectHarnesses({ harnesses = [], cycleReceipts = [], supervisorRuns = [] } = {}) {
  const out = [...asArray(harnesses)];
  for (const cycle of asArray(cycleReceipts)) out.push(...asArray(cycle?.harnesses));
  for (const run of asArray(supervisorRuns)) {
    if (run?.cycle_receipt) out.push(...asArray(run.cycle_receipt.harnesses));
  }
  return out;
}

function collectChangedFiles({ changedFiles = [], modelBatches = [], cycleReceipts = [], supervisorRuns = [] } = {}) {
  const files = new Set(asArray(changedFiles));
  for (const cycle of asArray(cycleReceipts)) {
    for (const file of asArray(cycle?.changed_files)) files.add(file);
  }
  for (const run of asArray(supervisorRuns)) {
    for (const file of asArray(run?.changed_files)) files.add(file);
  }
  for (const batch of asArray(modelBatches)) {
    for (const packet of asArray(batch?.packets)) {
      for (const line of String(packet?.user_prompt || "").split(/\r?\n/)) {
        if (/^[A-Za-z0-9_.\-/\\]+$/.test(line.trim())) files.add(line.trim());
      }
    }
  }
  return [...files].filter(Boolean).sort();
}

function buildClusters(findings = []) {
  const bySignature = new Map();
  for (const finding of findings) {
    const current = bySignature.get(finding.signature) || {
      signature: finding.signature,
      category: finding.category,
      severity: finding.severity,
      representative_claim: finding.claim,
      sources: [],
      evidence: [],
      findings: [],
    };
    if (severityRank(finding.severity) > severityRank(current.severity)) current.severity = finding.severity;
    current.sources.push(finding.source);
    current.evidence.push(...finding.evidence);
    current.findings.push(finding);
    bySignature.set(finding.signature, current);
  }
  return [...bySignature.values()]
    .map((cluster) => ({
      ...cluster,
      sources: [...new Set(cluster.sources)].sort(),
      source_count: new Set(cluster.sources).size,
      evidence: [...new Set(cluster.evidence)].slice(0, 12),
      finding_count: cluster.findings.length,
    }))
    .sort((a, b) => b.source_count - a.source_count || severityRank(b.severity) - severityRank(a.severity) || a.signature.localeCompare(b.signature));
}

function availabilityFindings(reviews = []) {
  return reviews
    .filter((review) => !isUsableReview(review))
    .map((review) => ({
      source: String(review.source || review.role_key || "unknown_review").slice(0, 120),
      role_key: String(review.role_key || review.source || "").slice(0, 120),
      status: normalizeStatus(review.status),
      skipped_reason: String(review.skipped_reason || "").slice(0, 160),
      error: summarizeHarnessOutput(review.error || "", 400),
      likely_root_cause: String(review.diagnosis?.likely_root_cause || "").slice(0, 160),
      authority: review.diagnosis?.authority || "",
    }));
}

function harnessFailureItems(harnesses = []) {
  return harnesses
    .filter((harness) => String(harness.status || "").toLowerCase() !== "passed")
    .map((harness) => ({
      script: harness.script || harness.name || "unknown_harness",
      status: harness.status || "failed",
      exit_code: harness.exit_code ?? null,
      timed_out: Boolean(harness.timed_out),
      stderr_tail: summarizeHarnessOutput(harness.stderr_tail || harness.stderr || "", 500),
    }));
}

function suggestedTests({ clusters = [], harnessFailures = [] } = {}) {
  const tests = new Set(harnessFailures.map((harness) => harness.script).filter(Boolean));
  for (const cluster of clusters) {
    const haystack = `${cluster.category} ${cluster.representative_claim} ${cluster.evidence.join(" ")}`.toLowerCase();
    if (/router|model_router|dispatch/.test(haystack)) tests.add("test:model-router");
    if (/ingress|gateway|rate|auth|csrf|jwt/.test(haystack)) tests.add("test:ingress-gateway");
    if (/replay|idempot|sqlite|wal|lease/.test(haystack)) tests.add("test:replay-safety");
    if (/lineage|trajectory|registry|manifest/.test(haystack)) tests.add("test:trajectory-snapshot");
    if (/security|token|secret|redirect|isolation/.test(haystack)) tests.add("check:fuzzing");
    if (/fixture|test|harness/.test(haystack)) tests.add("test");
  }
  return [...tests].sort();
}

function nextActions({ reconciliation, clusters, availability, harnessFailures } = {}) {
  const actions = [];
  if (harnessFailures.length) actions.push("Repair failed harnesses before accepting model-review claims.");
  const blockers = clusters.filter((cluster) => /security|fixture|scope|test|auth|trust|isolation/i.test(`${cluster.category} ${cluster.representative_claim}`));
  if (blockers.length) actions.push("Convert blocking synthesis clusters into narrow fixtures or scoped patches.");
  if (availability.length) actions.push("Resolve or explicitly quarantine unavailable reviewer backends before counting them as coverage.");
  if (reconciliation?.state_transition === "ready-for-push") actions.push("Treat ready-for-push as a proposal only; Simul approval is still required.");
  if (!actions.length) actions.push("Run another lens or broaden harness coverage before promotion.");
  return actions;
}

export function synthesizeReviewEvidence({
  candidateId = "",
  changedFiles = [],
  reviews = [],
  harnesses = [],
  modelBatches = [],
  cycleReceipts = [],
  supervisorRuns = [],
  minReviewsForPush = 3,
  requireDisagreement = true,
  now = new Date(),
} = {}) {
  const allReviews = collectReviews({ reviews, modelBatches, cycleReceipts, supervisorRuns });
  const allHarnesses = collectHarnesses({ harnesses, cycleReceipts, supervisorRuns });
  const files = collectChangedFiles({ changedFiles, modelBatches, cycleReceipts, supervisorRuns });
  const usableReviews = allReviews.filter(isUsableReview);
  const findings = usableReviews.flatMap((review) => asArray(review.findings).map((finding) => normalizeFinding(finding, review)));
  const clusters = buildClusters(findings);
  const disagreementClusters = clusters.filter((cluster) => /disagreement/i.test(`${cluster.category} ${cluster.findings.map((finding) => finding.kind).join(" ")}`));
  const agreementClusters = clusters.filter((cluster) => cluster.source_count > 1);
  const blockingClusters = clusters.filter((cluster) => (
    severityRank(cluster.severity) >= 3 ||
    /security|credential|auth|trust|isolation|fixture|test|scope|split/i.test(`${cluster.category} ${cluster.representative_claim}`)
  ));
  const availability = availabilityFindings(allReviews);
  const harnessFailures = harnessFailureItems(allHarnesses);
  const reconciliation = reconcileReviewBatch({
    reviews: allReviews,
    harnesses: allHarnesses,
    minReviewsForPush,
    requireDisagreement,
  });

  return {
    schema_version: REVIEW_SYNTHESIS_SCHEMA,
    synthesis_id: `synthesis_${sha256Short(JSON.stringify({
      candidate_id: candidateId,
      created_at: nowIso(now),
      reviews: allReviews.length,
      harnesses: allHarnesses.length,
    }))}`,
    candidate_id: candidateId || modelBatches.find((batch) => batch?.candidate_id)?.candidate_id || cycleReceipts.find((cycle) => cycle?.candidate_id)?.candidate_id || "",
    created_at: nowIso(now),
    changed_files: files,
    counts: {
      reviews: allReviews.length,
      usable_reviews: usableReviews.length,
      skipped_or_failed_reviews: allReviews.length - usableReviews.length,
      harnesses: allHarnesses.length,
      failed_harnesses: harnessFailures.length,
      findings: findings.length,
      clusters: clusters.length,
      agreement_clusters: agreementClusters.length,
      disagreement_clusters: disagreementClusters.length,
      blocking_clusters: blockingClusters.length,
      availability_rechecks: availability.length,
    },
    clusters,
    agreement_clusters: agreementClusters,
    disagreement_clusters: disagreementClusters,
    blocking_clusters: blockingClusters,
    availability_rechecks: availability,
    harness_failures: harnessFailures,
    suggested_tests: suggestedTests({ clusters, harnessFailures }),
    proposed_state_transition: reconciliation.state_transition,
    reconciliation,
    next_actions: nextActions({ reconciliation, clusters: blockingClusters, availability, harnessFailures }),
    authority: "synthesis_is_triage_not_authority",
  };
}

export function writeReviewSynthesis(synthesis, {
  rootDir = process.cwd(),
  outPath = "reviews/review_synthesis_latest.json",
} = {}) {
  const absPath = path.resolve(rootDir, outPath);
  atomicWriteText(absPath, `${JSON.stringify(synthesis, null, 2)}\n`);
  return absPath;
}
