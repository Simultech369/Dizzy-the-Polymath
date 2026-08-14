/**
 * W-0080: Self-Monitoring Signal Calibration Harness
 *
 * Calibrates model-verbalized uncertainty against trace/eval/diagnostic evidence.
 * The output is telemetry only: diagnostic evidence, not authority.
 */

export const SELF_MONITORING_CALIBRATION_SCHEMA = "dizzy.self_monitoring_calibration.v1";
export const SELF_MONITORING_CALIBRATION_AUTHORITY = "diagnostic_evidence_not_authority";

const UNKNOWN_STATUS = "Unknown";
const KNOWN_STATUSES = Object.freeze(["TP", "FP", "FN", "TN", UNKNOWN_STATUS]);
const RECEIPT_EVIDENCE_ID_LIMIT = 25;
const FAILURE_STATUSES = new Set([
  "failed",
  "fail",
  "error",
  "errored",
  "rejected",
  "blocked",
  "quarantined",
  "quarantine",
  "fixture-required",
  "fixture_required",
]);
const CLEAN_STATUSES = new Set([
  "passed",
  "pass",
  "ok",
  "clean",
  "completed",
  "complete",
  "verified_passed",
  "ready-for-review",
  "ready_for_review",
]);
const FORBIDDEN_RECEIPT_TERMS = Object.freeze([
  "conscious",
  "awareness",
  "sentient",
  "subjective",
  "inner_state",
  "prompt_body",
  "completion_body",
  "raw_prompt",
  "raw_completion",
]);
const FORBIDDEN_RECEIPT_KEYS = Object.freeze([
  "recommendation",
  "recommendedAction",
  "approved",
  "authorization",
  "trustScore",
  "globalTrustScore",
  "useModel",
  "promoteModel",
]);

function normalizePart(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  return normalized.replace(/\s+/g, "_");
}

export function formatScopeKey({ modelId, claimType, failureClass, taskProfile } = {}) {
  return [
    normalizePart(modelId, "unknown_model"),
    normalizePart(claimType, "unknown_claim"),
    normalizePart(failureClass, "unknown_failure"),
    normalizePart(taskProfile, "unknown_task"),
  ].join("::");
}

function scopeFrom(input = {}) {
  return {
    modelId: String(input.modelId || "unknown_model"),
    claimType: String(input.claimType || "unknown_claim"),
    failureClass: String(input.failureClass || "unknown_failure"),
    taskProfile: String(input.taskProfile || "unknown_task"),
  };
}

function evidenceIdFrom(evidence = {}) {
  return evidence.evidenceId
    || evidence.traceId
    || evidence.trace_id
    || evidence.receiptId
    || evidence.receipt_id
    || evidence.evalId
    || evidence.eval_id
    || evidence.diagnosisId
    || evidence.diagnosis_id
    || evidence.id
    || null;
}

function collectFailureClasses(evidence = {}) {
  const classes = new Set();
  const add = (value) => {
    if (!value) return;
    const normalized = normalizePart(value, "");
    if (normalized) classes.add(normalized);
  };

  add(evidence.failureClass);
  add(evidence.failure_class);
  add(evidence.actualFailureClass);
  add(evidence.actual_failure_class);
  add(evidence.diagnostic?.failureClass);
  add(evidence.diagnostic?.failure_class);
  add(evidence.diagnosis?.failureClass);
  add(evidence.diagnosis?.failure_class);
  add(evidence.observed_surfaces?.request?.failure_class);

  if (Array.isArray(evidence.failureClasses)) {
    for (const cls of evidence.failureClasses) add(cls);
  }
  if (Array.isArray(evidence.failure_classes)) {
    for (const cls of evidence.failure_classes) add(cls);
  }
  if (Array.isArray(evidence.steps)) {
    for (const step of evidence.steps) {
      if (isFailureStatus(step?.status)) add(step.stage);
      add(step.failureClass);
      add(step.failure_class);
    }
  }

  return classes;
}

function isFailureStatus(value) {
  const normalized = normalizePart(value, "");
  return FAILURE_STATUSES.has(normalized);
}

function isCleanStatus(value) {
  const normalized = normalizePart(value, "");
  return CLEAN_STATUSES.has(normalized);
}

function inferFailureOccurred(evidence = {}) {
  if (typeof evidence.failureOccurred === "boolean") return evidence.failureOccurred;
  if (typeof evidence.failure_occurred === "boolean") return evidence.failure_occurred;
  if (typeof evidence.hasFailure === "boolean") return evidence.hasFailure;
  if (typeof evidence.has_failure === "boolean") return evidence.has_failure;

  if (isFailureStatus(evidence.final_status)) return true;
  if (isFailureStatus(evidence.status)) return true;
  if (isFailureStatus(evidence.verdict)) return true;
  if (Array.isArray(evidence.steps) && evidence.steps.some((step) => isFailureStatus(step?.status))) {
    return true;
  }

  if (isCleanStatus(evidence.final_status)) return false;
  if (isCleanStatus(evidence.status)) return false;
  if (isCleanStatus(evidence.verdict)) return false;

  return null;
}

export function classifyCalibrationOutcome({ isFailureReport, failureClass }, evidence = null) {
  if (!evidence || typeof evidence !== "object") {
    return UNKNOWN_STATUS;
  }

  const failureOccurred = inferFailureOccurred(evidence);
  if (failureOccurred === null) {
    return UNKNOWN_STATUS;
  }

  let scopedFailureOccurred = false;
  if (failureOccurred) {
    const expectedClass = normalizePart(failureClass, "unknown_failure");
    const evidenceClasses = collectFailureClasses(evidence);
    const broadFailureScope = expectedClass === "any" || expectedClass === "any_failure";

    if (broadFailureScope) {
      scopedFailureOccurred = true;
    } else if (evidenceClasses.size === 0 && expectedClass !== "unknown_failure") {
      return UNKNOWN_STATUS;
    } else if (evidenceClasses.size === 0) {
      scopedFailureOccurred = true;
    } else {
      scopedFailureOccurred = evidenceClasses.has(expectedClass);
    }
  }

  if (isFailureReport) return scopedFailureOccurred ? "TP" : "FP";
  return scopedFailureOccurred ? "FN" : "TN";
}

function assertSafeReceipt(receipt) {
  const json = JSON.stringify(receipt);
  const lowerJson = json.toLowerCase();
  for (const key of FORBIDDEN_RECEIPT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(receipt, key)) {
      throw new Error(`Calibration receipt contains forbidden authority key: ${key}`);
    }
  }
  for (const term of FORBIDDEN_RECEIPT_TERMS) {
    if (lowerJson.includes(term.toLowerCase())) {
      throw new Error(`Calibration receipt contains forbidden term: ${term}`);
    }
  }
}

export class SelfMonitoringCalibrator {
  constructor() {
    this.records = new Map();
  }

  recordSelfReport(claim = {}) {
    if (!claim.claimId) {
      throw new Error("Self-report claim must include claimId");
    }

    const scope = scopeFrom(claim);
    const record = {
      claimId: String(claim.claimId),
      scope,
      scopeKey: formatScopeKey(scope),
      isFailureReport: Boolean(claim.reportsFailure || claim.isUncertain),
      confidenceScore: typeof claim.confidenceScore === "number" ? claim.confidenceScore : null,
      status: UNKNOWN_STATUS,
      evidenceId: null,
      createdAt: claim.createdAt || claim.timestamp || new Date().toISOString(),
    };

    this.records.set(record.claimId, record);
    return { ...record, scope: { ...record.scope } };
  }

  evaluateGroundTruth(claimId, evidence = null) {
    const record = this.records.get(String(claimId));
    if (!record) {
      throw new Error(`Claim ID not found: ${claimId}`);
    }

    record.evidenceId = evidence && typeof evidence === "object"
      ? evidenceIdFrom(evidence)
      : null;
    record.status = classifyCalibrationOutcome({
      isFailureReport: record.isFailureReport,
      failureClass: record.scope.failureClass,
    }, evidence);

    return { ...record, scope: { ...record.scope } };
  }

  computeTelemetry(scopeParams = {}) {
    const scope = scopeFrom(scopeParams);
    const targetKey = formatScopeKey(scope);
    const matrix = { TP: 0, FP: 0, FN: 0, TN: 0, Unknown: 0 };
    const evidenceIds = [];
    const seenEvidenceIds = new Set();

    for (const record of this.records.values()) {
      if (record.scopeKey !== targetKey) continue;
      if (!KNOWN_STATUSES.includes(record.status)) {
        matrix.Unknown += 1;
      } else {
        matrix[record.status] += 1;
      }
      if (record.evidenceId && !seenEvidenceIds.has(record.evidenceId)) {
        seenEvidenceIds.add(record.evidenceId);
        evidenceIds.push(record.evidenceId);
      }
    }

    const precisionDenominator = matrix.TP + matrix.FP;
    const recallDenominator = matrix.TP + matrix.FN;
    const fprDenominator = matrix.FP + matrix.TN;
    const precision = precisionDenominator > 0 ? matrix.TP / precisionDenominator : 0;
    const recall = recallDenominator > 0 ? matrix.TP / recallDenominator : 0;
    const falsePositiveRate = fprDenominator > 0 ? matrix.FP / fprDenominator : 0;
    const sampleCount = matrix.TP + matrix.FP + matrix.FN + matrix.TN;
    const confidenceBand = sampleCount >= 50
      ? "high"
      : sampleCount >= 20
        ? "medium"
        : sampleCount >= 5
          ? "low"
          : "insufficient_data";

    return {
      scope,
      matrix,
      metrics: {
        precision: Number(precision.toFixed(4)),
        recall: Number(recall.toFixed(4)),
        falsePositiveRate: Number(falsePositiveRate.toFixed(4)),
        sampleCount,
        confidenceBand,
      },
      predictiveWeight: sampleCount >= 5 ? Number((precision * recall).toFixed(4)) : 0,
      lastEvaluatedEvidenceIds: evidenceIds.slice(-RECEIPT_EVIDENCE_ID_LIMIT),
    };
  }

  exportCalibrationReceipt(scopeParams = {}) {
    const telemetry = this.computeTelemetry(scopeParams);
    const { modelId, claimType, failureClass, taskProfile } = telemetry.scope;
    const receipt = {
      schema_version: SELF_MONITORING_CALIBRATION_SCHEMA,
      authority: SELF_MONITORING_CALIBRATION_AUTHORITY,
      scope: telemetry.scope,
      matrix: telemetry.matrix,
      metrics: telemetry.metrics,
      predictiveWeight: telemetry.predictiveWeight,
      statement: `This self-monitoring signal has earned ${telemetry.predictiveWeight.toFixed(4)} predictive weight in ${modelId}/${claimType}/${failureClass}/${taskProfile} context.`,
      lastEvaluatedEvidenceIds: telemetry.lastEvaluatedEvidenceIds,
      created_at: new Date().toISOString(),
    };

    assertSafeReceipt(receipt);
    return receipt;
  }
}
