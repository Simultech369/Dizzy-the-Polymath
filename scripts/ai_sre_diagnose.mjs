import fs from "fs";
import path from "path";
import { classifyConnectionFailure } from "../lib/backend_connection_rca.mjs";
import {
  redactReviewLoopText,
  summarizeHarnessOutput,
} from "../lib/review_cycle_runner.mjs";
import { generateUsageReport } from "./usage_report.mjs";

export const AI_SRE_DIAGNOSIS_SCHEMA = "dizzy.ai_sre_diagnosis.v1";
export const AI_SRE_AUTHORITY = "diagnostic_evidence_not_authority";

export const FAILURE_CLASSES = Object.freeze([
  "ingress",
  "auth",
  "validation",
  "routing",
  "provider",
  "persistence",
  "retrieval",
  "review-loop",
  "operator-gate",
]);

const INCIDENT_CLASS = Object.freeze({
  "provider-outage": "provider",
  "review-loop-deadlock": "review-loop",
  "hallucination-spike": "operator-gate",
  "retrieval-drift": "retrieval",
  "receipt-write-failure": "persistence",
});

const RUNBOOKS = Object.freeze({
  ingress: "docs/runbooks/ai_sre_incident_response.md#ingress",
  auth: "docs/runbooks/ai_sre_incident_response.md#auth",
  validation: "docs/runbooks/ai_sre_incident_response.md#validation",
  routing: "docs/runbooks/ai_sre_incident_response.md#routing",
  provider: "docs/runbooks/ai_sre_incident_response.md#provider",
  persistence: "docs/runbooks/ai_sre_incident_response.md#persistence",
  retrieval: "docs/runbooks/ai_sre_incident_response.md#retrieval",
  "review-loop": "docs/runbooks/ai_sre_incident_response.md#review-loop",
  "operator-gate": "docs/runbooks/ai_sre_incident_response.md#operator-gate",
});

const DEFAULT_PATHS = Object.freeze({
  retrievalEval: "reviews/retrieval_eval_latest.json",
  reviewCycle: "reviews/review_cycle_latest.json",
  councilVerdict: "reviews/oss_council_verdict_latest.json",
  routerReceipts: "runtime/router_receipts.jsonl",
});

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function safeText(value = "", maxChars = 700) {
  return summarizeHarnessOutput(redactReviewLoopText(String(value ?? "")), maxChars);
}

function readJsonIfPresent(rootDir, relPath) {
  const absPath = path.resolve(rootDir, relPath);
  if (!fs.existsSync(absPath)) return { exists: false, data: null, error: "" };
  try {
    return { exists: true, data: JSON.parse(fs.readFileSync(absPath, "utf8")), error: "" };
  } catch (err) {
    return { exists: true, data: null, error: safeText(err?.message || err, 240) };
  }
}

function statusClass(statusCode) {
  const code = Number(statusCode);
  if (!Number.isFinite(code)) return "";
  if (code === 401 || code === 403) return "auth";
  if (code === 404 || code === 405) return "routing";
  if (code === 408 || code === 409 || code === 429) return "ingress";
  if (code >= 400 && code < 500) return "validation";
  if (code >= 500) return "provider";
  return "";
}

export function buildRequestAutopsy({
  method = "",
  pathname = "",
  statusCode = "",
  routeName = "",
} = {}) {
  const code = Number(statusCode);
  const failureClass = statusClass(code);
  return {
    method: safeText(method || "unknown", 40).toUpperCase(),
    path: safeText(pathname || routeName || "unknown", 160),
    status_code: Number.isFinite(code) ? code : 0,
    failure_class: failureClass || "operator-gate",
    lifecycle_stage: failureClass || "not_classified_by_status",
  };
}

function summarizeRetrievalEval(receipt, thresholds) {
  if (!receipt || typeof receipt !== "object") {
    return {
      present: false,
      status: "missing",
      hit_rate_top_3_pct: 0,
      mrr: 0,
      threshold_hit_rate_top_3_pct: thresholds.retrievalHitRateTop3,
    };
  }

  const hitRate = Number(receipt.metrics?.hit_rate_top_3_pct);
  const mrr = Number(receipt.metrics?.mrr);
  const ok = Number.isFinite(hitRate)
    && Number.isFinite(mrr)
    && hitRate >= thresholds.retrievalHitRateTop3
    && mrr >= thresholds.retrievalMrr;
  return {
    present: true,
    status: ok ? "passed" : "failed",
    hit_rate_top_3_pct: Number.isFinite(hitRate) ? hitRate : 0,
    mrr: Number.isFinite(mrr) ? mrr : 0,
    threshold_hit_rate_top_3_pct: thresholds.retrievalHitRateTop3,
    threshold_mrr: thresholds.retrievalMrr,
  };
}

function reviewState(receipt) {
  return receipt?.reconciliation?.state_transition || receipt?.state_transition || "";
}

function summarizeReviewCycle(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return { present: false, status: "missing", state_transition: "", harness_count: 0, review_count: 0 };
  }
  const state = reviewState(receipt);
  const blocked = ["reject", "quarantine", "fixture-required"].includes(state);
  return {
    present: true,
    status: blocked ? "blocked" : "passed",
    state_transition: state || "unknown",
    harness_count: Array.isArray(receipt.harnesses) ? receipt.harnesses.length : Number(receipt.harness_count || 0),
    review_count: Array.isArray(receipt.reviews) ? receipt.reviews.length : Number(receipt.review_count || 0),
  };
}

function summarizeCouncilVerdict(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return { present: false, status: "missing", verdict: "" };
  }
  const verdict = String(receipt.verdict || "UNKNOWN");
  return {
    present: true,
    status: verdict === "VERIFIED_PASSED" ? "passed" : "failed",
    verdict,
    syntax_status: receipt.layers?.syntax?.status || "UNKNOWN",
    governance_status: receipt.layers?.governance?.status || "UNKNOWN",
    execution_status: receipt.layers?.execution?.status || "UNKNOWN",
  };
}

function summarizeReceipts(report) {
  return {
    present: Boolean(report.hasReceipts),
    status: report.malformedCount || report.unsupportedSchemaCount ? "malformed" : "passed",
    total_count: report.totalCount,
    valid_receipt_count: report.validReceiptCount,
    malformed_count: report.malformedCount,
    unsupported_schema_count: report.unsupportedSchemaCount,
    fail_closed_count: report.byExecutionStatus?.fail_closed || 0,
    fallback_count: report.fallbackCount || 0,
  };
}

function rcaFailureClass(rca) {
  switch (rca?.likely_root_cause) {
    case "auth_missing_or_invalid":
      return "auth";
    case "cloud_blocked_by_policy":
      return "operator-gate";
    case "missing_base_url":
      return "routing";
    case "local_backend_unreachable":
    case "local_backend_timeout":
    case "ollama_log_permission_denied":
    case "provider_http_error":
      return "provider";
    default:
      return "";
  }
}

function nextActionsFor(failureClass, incidentType) {
  const common = [
    "Capture the request id, command, route, receipt id, and exact failing gate before changing code.",
    "End the incident with one of: no-op explained, fixture added, gate tightened, runbook updated, outcome memory recorded, or backlog item created.",
  ];
  const specific = {
    ingress: ["Check rate limits, token budget state, idempotency leases, and retry pressure."],
    auth: ["Verify operator/session/capability scope without logging secrets."],
    validation: ["Check request shape, JSON parse errors, required fields, and redaction boundaries."],
    routing: ["Verify route allowlists, model selector binding, and fail-closed default paths."],
    provider: ["Run the backend RCA classifier and verify provider/model slug availability before retrying."],
    persistence: ["Inspect receipt and state-store write paths, permissions, atomicity, and malformed rows."],
    retrieval: ["Run golden retrieval evals, inspect misses, and add or adjust fixtures before promotion."],
    "review-loop": ["Inspect review cycle state transitions, partial receipts, unavailable reviewer lanes, and harness timeouts."],
    "operator-gate": ["Treat the result as blocked until Simul approves the next external action or promotion step."],
  };
  const incidentAction = incidentType === "hallucination-spike"
    ? ["Compare the claim against receipts/evals; tighten a fixture or gate before trusting the output."]
    : [];
  return [...(specific[failureClass] || []), ...incidentAction, ...common];
}

function chooseFailureClass({ incidentType, request, rca, retrieval, reviewCycle, council, receipts }) {
  if (INCIDENT_CLASS[incidentType]) return INCIDENT_CLASS[incidentType];
  const requestClass = request?.status_code ? request.failure_class : "";
  if (requestClass && requestClass !== "operator-gate") return requestClass;
  const rcaClass = rcaFailureClass(rca);
  if (rcaClass) return rcaClass;
  if (receipts.status === "malformed") return "persistence";
  if (retrieval.status === "failed") return "retrieval";
  if (reviewCycle.status === "blocked") return "review-loop";
  if (council.status === "failed") return "operator-gate";
  return "operator-gate";
}

export function diagnoseAiSreIncident({
  rootDir = process.cwd(),
  incidentType = "auto",
  request = {},
  provider = {},
  paths = {},
  thresholds = {},
  now = new Date(),
} = {}) {
  const effectivePaths = { ...DEFAULT_PATHS, ...paths };
  const effectiveThresholds = {
    retrievalHitRateTop3: Number(thresholds.retrievalHitRateTop3 ?? 85.0),
    retrievalMrr: Number(thresholds.retrievalMrr ?? 0.60),
  };

  const retrievalRaw = readJsonIfPresent(rootDir, effectivePaths.retrievalEval);
  const reviewRaw = readJsonIfPresent(rootDir, effectivePaths.reviewCycle);
  const councilRaw = readJsonIfPresent(rootDir, effectivePaths.councilVerdict);
  const receiptPath = path.resolve(rootDir, effectivePaths.routerReceipts);
  const usage = generateUsageReport(receiptPath);

  const requestAutopsy = buildRequestAutopsy(request);
  const rca = provider.error || provider.baseUrl || provider.backend
    ? classifyConnectionFailure({
      error: provider.error || "",
      baseUrl: provider.baseUrl || "",
      backend: provider.backend || "",
      model: provider.model || "",
      trustZone: provider.trustZone || "private_self",
      allowCloud: Boolean(provider.allowCloud),
      isLocalIsolationRequired: provider.isLocalIsolationRequired ?? true,
      probes: provider.probes || {},
      now,
    })
    : null;

  const surfaces = {
    request: requestAutopsy,
    provider_rca: rca,
    retrieval_eval: summarizeRetrievalEval(retrievalRaw.data, effectiveThresholds),
    review_cycle: summarizeReviewCycle(reviewRaw.data),
    council_verdict: summarizeCouncilVerdict(councilRaw.data),
    router_receipts: summarizeReceipts(usage),
  };

  const failureClass = chooseFailureClass({
    incidentType,
    request: requestAutopsy,
    rca,
    retrieval: surfaces.retrieval_eval,
    reviewCycle: surfaces.review_cycle,
    council: surfaces.council_verdict,
    receipts: surfaces.router_receipts,
  });

  const evidence = [
    `incident_type=${safeText(incidentType || "auto", 80)}`,
    `failure_class=${failureClass}`,
    `request=${requestAutopsy.method} ${requestAutopsy.path} status=${requestAutopsy.status_code || "unknown"}`,
  ];
  if (rca?.likely_root_cause) evidence.push(`provider_rca=${rca.likely_root_cause}`);
  if (surfaces.retrieval_eval.present) evidence.push(`retrieval_hit_rate_top_3_pct=${surfaces.retrieval_eval.hit_rate_top_3_pct}`);
  if (surfaces.review_cycle.present) evidence.push(`review_cycle_state=${surfaces.review_cycle.state_transition}`);
  if (surfaces.council_verdict.present) evidence.push(`council_verdict=${surfaces.council_verdict.verdict}`);
  if (surfaces.router_receipts.present) evidence.push(`router_receipts_valid=${surfaces.router_receipts.valid_receipt_count}/${surfaces.router_receipts.total_count}`);
  if (retrievalRaw.error) evidence.push(`retrieval_receipt_error=${retrievalRaw.error}`);
  if (reviewRaw.error) evidence.push(`review_cycle_error=${reviewRaw.error}`);
  if (councilRaw.error) evidence.push(`council_verdict_error=${councilRaw.error}`);

  const status = failureClass ? "diagnosed" : "no_signal";
  return {
    schema_version: AI_SRE_DIAGNOSIS_SCHEMA,
    created_at: nowIso(now),
    incident_type: safeText(incidentType || "auto", 80),
    status,
    failure_class: failureClass,
    taxonomy: FAILURE_CLASSES,
    observed_surfaces: surfaces,
    evidence,
    runbook: RUNBOOKS[failureClass],
    next_actions: nextActionsFor(failureClass, incidentType),
    authority: AI_SRE_AUTHORITY,
  };
}

function argValue(args, name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function boolArg(args, name) {
  return args.includes(name);
}

function parseCliArgs(args) {
  const statusCode = argValue(args, "--status-code", "");
  return {
    rootDir: path.resolve(argValue(args, "--root", process.cwd())),
    incidentType: argValue(args, "--incident", "auto").replace(/_/g, "-"),
    request: {
      method: argValue(args, "--method", ""),
      pathname: argValue(args, "--path", ""),
      statusCode,
    },
    provider: {
      backend: argValue(args, "--backend", ""),
      baseUrl: argValue(args, "--base-url", ""),
      model: argValue(args, "--model", ""),
      trustZone: argValue(args, "--trust-zone", "private_self"),
      error: argValue(args, "--error", ""),
      allowCloud: boolArg(args, "--allow-cloud"),
      isLocalIsolationRequired: !boolArg(args, "--allow-remote-private"),
    },
    paths: {
      retrievalEval: argValue(args, "--retrieval-eval", DEFAULT_PATHS.retrievalEval),
      reviewCycle: argValue(args, "--review-cycle", DEFAULT_PATHS.reviewCycle),
      councilVerdict: argValue(args, "--council-verdict", DEFAULT_PATHS.councilVerdict),
      routerReceipts: argValue(args, "--router-receipts", DEFAULT_PATHS.routerReceipts),
    },
    json: boolArg(args, "--json"),
  };
}

function printHuman(report) {
  console.log("=== Dizzy AI SRE Diagnosis ===");
  console.log(`status=${report.status}`);
  console.log(`failure_class=${report.failure_class}`);
  console.log(`runbook=${report.runbook}`);
  console.log("");
  console.log("Evidence:");
  for (const item of report.evidence) console.log(`- ${item}`);
  console.log("");
  console.log("Next actions:");
  for (const action of report.next_actions) console.log(`- ${action}`);
}

if (process.argv[1] && path.basename(process.argv[1]) === "ai_sre_diagnose.mjs") {
  const options = parseCliArgs(process.argv.slice(2));
  const report = diagnoseAiSreIncident(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
}
