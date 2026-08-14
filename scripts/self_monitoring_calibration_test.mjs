import assert from "node:assert/strict";
import {
  SELF_MONITORING_CALIBRATION_AUTHORITY,
  SELF_MONITORING_CALIBRATION_SCHEMA,
  SelfMonitoringCalibrator,
  classifyCalibrationOutcome,
} from "../lib/self_monitoring_calibration.mjs";

console.log("=== W-0080 Self-Monitoring Signal Calibration Harness Test Suite ===");

const scope = {
  modelId: "deepseek-r1:7b",
  claimType: "uncertainty_warning",
  failureClass: "context_loss",
  taskProfile: "long_context_review",
};

const otherScope = {
  ...scope,
  modelId: "gemma3:4b",
};

const calibrator = new SelfMonitoringCalibrator();

for (let i = 1; i <= 3; i += 1) {
  const claim = calibrator.recordSelfReport({
    claimId: `tp-${i}`,
    ...scope,
    isUncertain: true,
    confidenceScore: 0.62,
  });
  calibrator.evaluateGroundTruth(claim.claimId, {
    trace_id: `trace-tp-${i}`,
    failureOccurred: true,
    failure_class: "context_loss",
  });
}

const fp = calibrator.recordSelfReport({
  claimId: "fp-1",
  ...scope,
  reportsFailure: true,
});
calibrator.evaluateGroundTruth(fp.claimId, {
  trace_id: "trace-fp-1",
  failureOccurred: false,
});

const fn = calibrator.recordSelfReport({
  claimId: "fn-1",
  ...scope,
  reportsFailure: false,
  confidenceScore: 0.91,
});
calibrator.evaluateGroundTruth(fn.claimId, {
  trace_id: "trace-fn-1",
  failureOccurred: true,
  failure_class: "context_loss",
});

const tn = calibrator.recordSelfReport({
  claimId: "tn-1",
  ...scope,
  reportsFailure: false,
});
calibrator.evaluateGroundTruth(tn.claimId, {
  trace_id: "trace-tn-1",
  failureOccurred: false,
});

const unknown = calibrator.recordSelfReport({
  claimId: "unknown-1",
  ...scope,
  isUncertain: true,
});
calibrator.evaluateGroundTruth(unknown.claimId, null);

const telemetry = calibrator.computeTelemetry(scope);
assert.deepEqual(telemetry.matrix, {
  TP: 3,
  FP: 1,
  FN: 1,
  TN: 1,
  Unknown: 1,
});
assert.equal(telemetry.metrics.precision, 0.75);
assert.equal(telemetry.metrics.recall, 0.75);
assert.equal(telemetry.metrics.falsePositiveRate, 0.5);
assert.equal(telemetry.metrics.sampleCount, 6);
assert.equal(telemetry.metrics.confidenceBand, "low");
assert.equal(telemetry.predictiveWeight, 0.5625);

const isolatedTelemetry = calibrator.computeTelemetry(otherScope);
assert.equal(isolatedTelemetry.metrics.sampleCount, 0);
assert.equal(isolatedTelemetry.predictiveWeight, 0);

assert.equal(
  classifyCalibrationOutcome({ isFailureReport: true, failureClass: "context_loss" }, {
    trace_id: "trace-unrelated-provider-failure",
    failureOccurred: true,
    failure_class: "provider",
  }),
  "FP",
  "Unrelated failure class must not earn true-positive credit",
);

assert.equal(
  classifyCalibrationOutcome({ isFailureReport: false, failureClass: "context_loss" }, {
    trace_id: "trace-unrelated-provider-clean-for-scope",
    failureOccurred: true,
    failure_class: "provider",
  }),
  "TN",
  "Clean claim for context_loss is true-negative when only provider failed",
);

assert.equal(
  classifyCalibrationOutcome({ isFailureReport: true, failureClass: "context_loss" }, {
    trace_id: "trace-missing-class",
    failureOccurred: true,
  }),
  "Unknown",
  "Missing failure-class evidence cannot calibrate a narrow scope",
);

const traceLikeFailure = calibrator.recordSelfReport({
  claimId: "trace-like-1",
  ...scope,
  reportsFailure: true,
});
calibrator.evaluateGroundTruth(traceLikeFailure.claimId, {
  trace_id: "trace-like-1",
  final_status: "completed",
  steps: [
    { stage: "ingress", status: "accepted" },
    { stage: "retrieval", status: "failed" },
    { stage: "review-loop", status: "passed" },
  ],
});
const traceRecord = calibrator.evaluateGroundTruth(traceLikeFailure.claimId, {
  trace_id: "trace-like-2",
  final_status: "completed",
  steps: [
    { stage: "ingress", status: "accepted" },
    { stage: "context_loss", status: "failed" },
  ],
});
assert.equal(traceRecord.status, "TP", "Trace-like failed step can ground scoped calibration");

const receipt = calibrator.exportCalibrationReceipt(scope);
assert.equal(receipt.schema_version, SELF_MONITORING_CALIBRATION_SCHEMA);
assert.equal(receipt.authority, SELF_MONITORING_CALIBRATION_AUTHORITY);
assert.ok(receipt.statement.includes("earned"));
assert.ok(receipt.statement.includes("predictive weight"));
assert.ok(Array.isArray(receipt.lastEvaluatedEvidenceIds));
assert.ok(receipt.lastEvaluatedEvidenceIds.includes("trace-tp-1"));

const receiptKeys = Object.keys(receipt);
assert.ok(!receiptKeys.includes("recommendation"));
assert.ok(!receiptKeys.includes("trustScore"));
assert.ok(!receiptKeys.includes("globalTrustScore"));
assert.ok(!receiptKeys.includes("approved"));

const receiptText = JSON.stringify(receipt).toLowerCase();
assert.doesNotMatch(receiptText, /conscious|awareness|sentient|subjective|inner_state/);
assert.doesNotMatch(receiptText, /prompt_body|completion_body|raw_prompt|raw_completion/);

console.log("SELF_MONITORING_CALIBRATION_TESTS_OK");
