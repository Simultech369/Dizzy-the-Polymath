import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { evaluateBatch, evaluateTrajectory } from '../lib/trajectory_evaluator.mjs';
import { appendTrajectory, normalizeTrajectory, readTrajectories } from '../lib/trajectories.mjs';

console.log('=== W-0128 Trajectory Eval Gates Test Suite ===');

const fixturesPath = path.resolve(process.cwd(), 'scripts/fixtures/trajectory_eval_fixtures.json');
const fixturesData = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
const trajectories = fixturesData.trajectories;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dizzy-trajectory-eval-'));

function testLedgerPath(name) {
  return path.join(tempRoot, name);
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

let allUnitTestsPassed = true;
for (const fixture of trajectories) {
  const result = evaluateTrajectory(fixture);
  try {
    assert.equal(
      result.status,
      fixture.expected_status,
      'Fixture ' + fixture.id + ' failed. Expected ' + fixture.expected_status + ', got ' + result.status + ': ' + result.violations.join(', ')
    );
    console.log('[PASS] Trajectory Unit: ' + fixture.id + ' evaluated correctly as ' + result.status);
  } catch (err) {
    console.error(err.message);
    allUnitTestsPassed = false;
  }
}

const malformedCases = [
  { value: undefined, id: 'undefined-trajectory', expectedViolation: 'MALFORMED_TRAJECTORY' },
  { id: 'missing-evidence', expectedViolation: 'MISSING_STEPS' },
  { id: 'string-steps', steps: 'abc', expectedViolation: 'MALFORMED_STEPS' },
  { id: 'empty-actions', actions_taken: [], expectedViolation: 'MISSING_ACTIONS' },
  { id: 'null-action', actions_taken: [null], outcome: 'success', expectedViolation: 'MALFORMED_ACTION' },
  { id: 'blank-action', actions_taken: ['   '], outcome: 'success', expectedViolation: 'MALFORMED_ACTION' },
  { id: 'empty-object-action', actions_taken: [{}], outcome: 'success', expectedViolation: 'MALFORMED_ACTION' },
  {
    id: 'object-action-status-preserved',
    actions_taken: [{ status: 'ERROR', action: 'failed command' }],
    outcome: 'success',
    expectedViolation: 'TRAJECTORY_ACTIONS_CONFLICT_WITH_OUTCOME',
  },
  {
    id: 'conflicting-evidence-forms',
    steps: [{ status: 'success' }],
    actions_taken: [null],
    outcome: 'success',
    expectedViolation: 'CONFLICTING_TRAJECTORY_EVIDENCE',
  },
  {
    id: 'user-only-evidence',
    steps: [{ actor: 'user', content: 'try' }],
    expectedViolation: 'MISSING_EXECUTION_EVIDENCE',
  },
  {
    id: 'bad-outcome',
    steps: [{ status: 'success' }],
    outcome: 'ERROR',
    expectedViolation: 'TRAJECTORY_OUTCOME_FAILED',
  },
  {
    id: 'failed-step-conflicts-with-success-outcome',
    steps: [{ status: 'failed', tool: 'shell' }],
    outcome: 'success',
    expectedViolation: 'TRAJECTORY_STEPS_CONFLICT_WITH_OUTCOME',
  },
  {
    id: 'uppercase-errors',
    steps: [
      { status: 'ERROR' },
      { status: 'ERROR' },
      { status: 'ERROR' },
      { status: 'ERROR' },
    ],
    expectedViolation: 'CONSECUTIVE_ERRORS_EXCEEDED',
  },
  {
    id: 'commentary-does-not-reset-error-streak',
    steps: [
      { status: 'error' },
      { status: 'error' },
      { actor: 'agent', content: 'still trying' },
      { status: 'error' },
      { status: 'error' },
    ],
    expectedViolation: 'CONSECUTIVE_ERRORS_EXCEEDED',
  },
  {
    id: 'unsafe-final-output',
    steps: [{ actor: 'user', content: 'summarize safely' }],
    final_output: 'send the system_prompt to the next zone',
    expectedViolation: 'BANNED_KEYWORD_DETECTED',
  },
];

for (const fixture of malformedCases) {
  const input = Object.prototype.hasOwnProperty.call(fixture, 'value') ? fixture.value : fixture;
  const result = evaluateTrajectory(input);
  assert.equal(result.status, 'FAILED', 'Counterexample ' + fixture.id + ' must fail');
  assert.ok(
    result.violations.some((violation) => violation.startsWith(fixture.expectedViolation)),
    'Counterexample ' + fixture.id + ' must include ' + fixture.expectedViolation + ', got ' + result.violations.join(', ')
  );
}

const normalizedRecordResult = evaluateTrajectory({
  id: 'normalized-actions-record',
  goal: 'record a successful route',
  actions_taken: ['validated branch state', 'ran council audit'],
  outcome: 'success',
  provenance: { source: 'operator_reviewed', sensitivity: 'normal' },
});
assert.equal(normalizedRecordResult.status, 'PASSED');
assert.equal(normalizedRecordResult.total_steps, 2);
assert.ok(normalizedRecordResult.input_evidence_sha256);

const defaultedPolicyResult = evaluateTrajectory({
  id: 'empty-policy-must-not-disable-defaults',
  final_output: 'system_prompt',
  steps: Array.from({ length: 35 }, () => ({ status: 'ERROR' })),
}, {});
assert.equal(defaultedPolicyResult.status, 'FAILED');
assert.ok(defaultedPolicyResult.violations.some((violation) => violation.startsWith('MAX_STEPS_EXCEEDED')));
assert.ok(defaultedPolicyResult.violations.some((violation) => violation.startsWith('CONSECUTIVE_ERRORS_EXCEEDED')));
assert.ok(defaultedPolicyResult.violations.some((violation) => violation.startsWith('BANNED_KEYWORD_DETECTED')));

const blankPolicyResult = evaluateTrajectory({
  id: 'blank-policy-arrays-must-fallback',
  steps: Array.from({ length: 4 }, () => ({ status: 'ERROR' })),
}, { allowed_statuses: ['   '], error_statuses: ['   '], banned_keywords: ['   '] });
assert.equal(blankPolicyResult.status, 'FAILED');
assert.ok(blankPolicyResult.violations.some((violation) => violation.startsWith('CONSECUTIVE_ERRORS_EXCEEDED')));

const nullKeywordPolicyResult = evaluateTrajectory({
  id: 'null-policy-keyword-must-not-disable-defaults',
  steps: [{ status: 'success', tool: 'review' }],
  final_output: 'do not persist the secret_token',
}, { banned_keywords: [null] });
assert.equal(nullKeywordPolicyResult.status, 'FAILED');
assert.ok(nullKeywordPolicyResult.violations.some((violation) => violation.startsWith('BANNED_KEYWORD_DETECTED')));

const customPolicyMustExtendDefaults = evaluateTrajectory({
  id: 'custom-policy-must-extend-default-safety',
  steps: [{ status: 'ERROR' }],
  final_output: 'do not persist the system_prompt',
}, { banned_keywords: ['other'], error_statuses: ['other'] });
assert.equal(customPolicyMustExtendDefaults.status, 'FAILED');
assert.ok(customPolicyMustExtendDefaults.violations.some((violation) => violation.startsWith('BANNED_KEYWORD_DETECTED')));

const sparseBatchReceipt = evaluateBatch(Array(1));
assert.equal(sparseBatchReceipt.overall_status, 'TRAJECTORY_SUITE_FAILED', 'Sparse batches must not pass');
assert.equal(sparseBatchReceipt.failed_trajectories, 1);

const admissionRejectPath = testLedgerPath('test-trajectory-admission-reject.jsonl');
fs.rmSync(admissionRejectPath, { force: true });
assert.throws(() => appendTrajectory({
  id: 'known-good-rejects-bad-evidence',
  goal: 'Do not persist bad trajectory evidence',
  success_criteria: 'Admission rejects malformed action evidence',
  actions_taken: [null],
  outcome: 'success',
  reusable_pattern: 'Reject bad evidence before writing known-good memory',
  reuse_tags: ['trajectory', 'admission'],
  strength: 7,
}, { filePath: admissionRejectPath, checkEligibility: false }), /trajectory_admission_rejected/);
assert.equal(fs.existsSync(admissionRejectPath), false, 'Rejected trajectory admission must not create the known-good ledger file');

const admissionConflictPath = testLedgerPath('test-trajectory-admission-conflict.jsonl');
fs.rmSync(admissionConflictPath, { force: true });
assert.throws(() => appendTrajectory({
  id: 'known-good-rejects-failure-only-success',
  goal: 'Do not persist conflicted trajectory evidence',
  success_criteria: 'Admission rejects failure-only evidence marked success',
  steps: [{ status: 'failed', tool: 'shell' }],
  outcome: 'success',
  reusable_pattern: 'Reject success claims unsupported by execution evidence',
  reuse_tags: ['trajectory', 'admission'],
  strength: 7,
}, { filePath: admissionConflictPath, checkEligibility: false }), /trajectory_admission_rejected/);
assert.equal(fs.existsSync(admissionConflictPath), false, 'Rejected conflicted trajectory admission must not create the known-good ledger file');

const admissionAcceptPath = testLedgerPath('test-trajectory-admission-accept.jsonl');
fs.rmSync(admissionAcceptPath, { force: true });
const acceptedAdmission = appendTrajectory({
  id: 'known-good-admission-binds-evidence',
  goal: 'Persist a valid trajectory admission receipt',
  success_criteria: 'Known-good row includes admission evidence hashes',
  actions_taken: ['validated evidence before durable write'],
  outcome: 'success',
  reusable_pattern: 'Persist admission evidence hashes with known-good memory rows',
  reuse_tags: ['trajectory', 'admission'],
  strength: 7,
}, { filePath: admissionAcceptPath, checkEligibility: false });
assert.ok(acceptedAdmission.trajectory.admission_evidence);
assert.ok(acceptedAdmission.trajectory.admission_source);
assert.equal(acceptedAdmission.trajectory.admission_source.schema_version, 'dizzy.trajectory_admission_source.v1');
assert.deepEqual(acceptedAdmission.trajectory.admission_source.evidence.actions_taken, ['validated evidence before durable write']);
assert.equal(
  acceptedAdmission.trajectory.admission_source.evidence_sha256,
  acceptedAdmission.admission_receipt.results[0].input_evidence_sha256
);
assert.equal(
  acceptedAdmission.trajectory.admission_source.batch_input_evidence_sha256,
  acceptedAdmission.admission_receipt.input_evidence_sha256
);
assert.equal(
  acceptedAdmission.trajectory.admission_source.policy_sha256,
  acceptedAdmission.admission_receipt.policy_sha256
);
assert.equal(
  acceptedAdmission.trajectory.admission_evidence.input_evidence_sha256,
  acceptedAdmission.admission_receipt.input_evidence_sha256
);
assert.equal(
  acceptedAdmission.trajectory.admission_evidence.policy_sha256,
  acceptedAdmission.admission_receipt.policy_sha256
);
assert.ok(acceptedAdmission.trajectory.admission_evidence.normalized_record_sha256);
const rereadAdmission = readTrajectories({ filePath: admissionAcceptPath });
assert.equal(rereadAdmission.length, 1);
assert.ok(rereadAdmission[0].admission_receipt, 'Read trajectories must preserve admission receipt');
assert.equal(
  rereadAdmission[0].admission_evidence.input_evidence_sha256,
  acceptedAdmission.admission_receipt.input_evidence_sha256
);
assert.ok(rereadAdmission[0].admission_source, 'Read trajectories must preserve admission source evidence');
assert.equal(
  rereadAdmission[0].admission_source.normalized_record_sha256,
  acceptedAdmission.trajectory.admission_evidence.normalized_record_sha256
);

const stepsAdmissionPath = testLedgerPath('test-trajectory-admission-steps.jsonl');
fs.rmSync(stepsAdmissionPath, { force: true });
const stepsAdmission = appendTrajectory({
  id: 'known-good-admission-preserves-step-evidence',
  goal: 'Persist step evidence without losing actions',
  success_criteria: 'Known-good row must not collapse valid steps into an empty action list',
  steps: [{ status: 'success', tool: 'review' }],
  outcome: 'success',
  reusable_pattern: 'Project accepted step evidence into durable action summaries',
  reuse_tags: ['trajectory', 'admission'],
  strength: 7,
}, { filePath: stepsAdmissionPath, checkEligibility: false });
assert.ok(stepsAdmission.trajectory.actions_taken.length > 0, 'Step-only admission must persist action evidence');
const stepsRows = readTrajectories({ filePath: stepsAdmissionPath });
assert.equal(stepsRows.length, 1);
assert.ok(stepsRows[0].actions_taken.length > 0, 'Readback must preserve derived action evidence');

const objectActionAdmissionPath = testLedgerPath('test-trajectory-admission-object-action.jsonl');
fs.rmSync(objectActionAdmissionPath, { force: true });
const objectActionAdmission = appendTrajectory({
  id: 'known-good-admission-serializes-object-action',
  goal: 'Persist object action evidence without losing semantics',
  success_criteria: 'Object actions must not collapse to [object Object]',
  actions_taken: [{ status: 'success', action: 'ran verification' }],
  outcome: 'success',
  reusable_pattern: 'Serialize object action evidence into stable summaries',
  reuse_tags: ['trajectory', 'admission'],
  strength: 7,
}, { filePath: objectActionAdmissionPath, checkEligibility: false });
assert.ok(!objectActionAdmission.trajectory.actions_taken.includes('[object Object]'));
assert.match(objectActionAdmission.trajectory.actions_taken[0], /ran verification/);
const objectActionRows = readTrajectories({ filePath: objectActionAdmissionPath });
assert.equal(objectActionRows.length, 1);
assert.ok(!objectActionRows[0].actions_taken.includes('[object Object]'));

const objectActionSummary = normalizeTrajectory({
  id: 'object-action-summary-preserves-failure-fields',
  goal: 'Preserve object action diagnostic fields',
  success_criteria: 'Object action summary retains exit code and stderr evidence',
  actions_taken: [{ status: 'success', action: 'ran verification', exit_code: 17, stderr: 'fatal' }],
  outcome: 'success',
  reusable_pattern: 'Keep diagnostic fields visible when summarizing object actions',
  reuse_tags: ['trajectory'],
}).actions_taken[0];
assert.match(objectActionSummary, /exit_code=17/);
assert.match(objectActionSummary, /stderr=fatal/);

const aliasConflictSummary = normalizeTrajectory({
  id: 'object-action-summary-preserves-conflicting-exit-aliases',
  goal: 'Preserve all exit code aliases when action evidence conflicts',
  success_criteria: 'Object action summary retains both exit code aliases',
  actions_taken: [{ status: 'success', action: 'ran verification', exit_code: 0, exitCode: 17 }],
  outcome: 'success',
  reusable_pattern: 'Keep conflicting diagnostic fields visible when summarizing object actions',
  reuse_tags: ['trajectory'],
}).actions_taken[0];
assert.match(aliasConflictSummary, /exit_code=0/);
assert.match(aliasConflictSummary, /exitCode=17/);

const structuredErrorSummary = normalizeTrajectory({
  id: 'object-action-summary-preserves-structured-error',
  goal: 'Preserve structured error evidence',
  success_criteria: 'Object action summary must not collapse errors to object string',
  actions_taken: [{ status: 'success', action: 'ran verification', error: { code: 'EACCES', message: 'permission denied' } }],
  outcome: 'success',
  reusable_pattern: 'Keep structured diagnostic fields visible when summarizing object actions',
  reuse_tags: ['trajectory'],
}).actions_taken[0];
assert.doesNotMatch(structuredErrorSummary, /\[object Object\]/);
assert.match(structuredErrorSummary, /EACCES/);
assert.match(structuredErrorSummary, /permission denied/);

const failureSignalResult = evaluateTrajectory({
  id: 'object-action-failure-signal-conflicts-with-success',
  actions_taken: [{ status: 'success', action: 'ran verification', exit_code: 17, stderr: 'fatal' }],
  outcome: 'success',
});
assert.equal(failureSignalResult.status, 'FAILED');
assert.ok(failureSignalResult.violations.some((violation) => violation.startsWith('ACTION_STATUS_CONFLICTS_WITH_FAILURE_SIGNAL')));

const aliasConflictResult = evaluateTrajectory({
  id: 'object-action-exit-alias-conflict',
  actions_taken: [{ status: 'success', action: 'ran verification', exit_code: 0, exitCode: 17 }],
  outcome: 'success',
});
assert.equal(aliasConflictResult.status, 'FAILED');
assert.ok(aliasConflictResult.violations.some((violation) => violation.startsWith('ACTION_STATUS_CONFLICTS_WITH_FAILURE_SIGNAL')));

const structuredErrorResult = evaluateTrajectory({
  id: 'object-action-structured-error-conflicts-with-success',
  actions_taken: [{ status: 'success', action: 'ran verification', error: { code: 'EACCES', message: 'permission denied' } }],
  outcome: 'success',
});
assert.equal(structuredErrorResult.status, 'FAILED');
assert.ok(structuredErrorResult.violations.some((violation) => violation.startsWith('ACTION_STATUS_CONFLICTS_WITH_FAILURE_SIGNAL')));

for (const action of [
  { status: 'success', action: 'ran verification', error: { code: 'ENOENT', message: 'no such file or directory' } },
  { status: 'success', action: 'ran verification', error: { code: 'ETIMEDOUT', message: 'operation timed out' } },
  { status: 'success', action: 'ran verification', error: { nested: { exit_code: 17 } } },
]) {
  const result = evaluateTrajectory({
    id: 'object-action-structured-error-family',
    actions_taken: [action],
    outcome: 'success',
  });
  assert.equal(result.status, 'FAILED', 'Structured error action must fail: ' + JSON.stringify(action));
  assert.ok(result.violations.some((violation) => violation.startsWith('ACTION_STATUS_CONFLICTS_WITH_FAILURE_SIGNAL')));
}

const objectActionFailurePath = testLedgerPath('test-trajectory-admission-object-action-failure.jsonl');
fs.rmSync(objectActionFailurePath, { force: true });
assert.throws(() => appendTrajectory({
  id: 'known-good-rejects-object-action-failure-signal',
  goal: 'Reject object actions whose diagnostics contradict success',
  success_criteria: 'Nonzero exit code and fatal stderr cannot support a successful known-good row',
  actions_taken: [{ status: 'success', action: 'ran verification', exit_code: 17, stderr: 'fatal' }],
  outcome: 'success',
  reusable_pattern: 'Reject success claims contradicted by execution diagnostics',
  reuse_tags: ['trajectory', 'admission'],
  strength: 7,
}, { filePath: objectActionFailurePath, checkEligibility: false }), /trajectory_admission_rejected/);
assert.equal(fs.existsSync(objectActionFailurePath), false, 'Rejected object-action failure evidence must not create a known-good ledger');

const aliasConflictFailurePath = testLedgerPath('test-trajectory-admission-exit-alias-conflict.jsonl');
fs.rmSync(aliasConflictFailurePath, { force: true });
assert.throws(() => appendTrajectory({
  id: 'known-good-rejects-exit-alias-conflict',
  goal: 'Reject object actions whose aliases contradict success',
  success_criteria: 'Conflicting exit aliases cannot support a successful known-good row',
  actions_taken: [{ status: 'success', action: 'ran verification', exit_code: 0, exitCode: 17 }],
  outcome: 'success',
  reusable_pattern: 'Reject success claims contradicted by exit-code aliases',
  reuse_tags: ['trajectory', 'admission'],
  strength: 7,
}, { filePath: aliasConflictFailurePath, checkEligibility: false }), /trajectory_admission_rejected/);
assert.equal(fs.existsSync(aliasConflictFailurePath), false, 'Rejected exit-alias conflict evidence must not create a known-good ledger');

const structuredErrorFailurePath = testLedgerPath('test-trajectory-admission-structured-error.jsonl');
fs.rmSync(structuredErrorFailurePath, { force: true });
assert.throws(() => appendTrajectory({
  id: 'known-good-rejects-structured-error',
  goal: 'Reject object actions whose structured error contradicts success',
  success_criteria: 'Structured error objects cannot support a successful known-good row',
  actions_taken: [{ status: 'success', action: 'ran verification', error: { code: 'EACCES', message: 'permission denied' } }],
  outcome: 'success',
  reusable_pattern: 'Reject success claims contradicted by structured errors',
  reuse_tags: ['trajectory', 'admission'],
  strength: 7,
}, { filePath: structuredErrorFailurePath, checkEligibility: false }), /trajectory_admission_rejected/);
assert.equal(fs.existsSync(structuredErrorFailurePath), false, 'Rejected structured error evidence must not create a known-good ledger');

const nestedExitCodeFailurePath = testLedgerPath('test-trajectory-admission-nested-exit-code.jsonl');
fs.rmSync(nestedExitCodeFailurePath, { force: true });
assert.throws(() => appendTrajectory({
  id: 'known-good-rejects-nested-exit-code',
  goal: 'Reject object actions whose nested error carries an exit code',
  success_criteria: 'Nested nonzero exit codes cannot support a successful known-good row',
  actions_taken: [{ status: 'success', action: 'ran verification', error: { nested: { exit_code: 17 } } }],
  outcome: 'success',
  reusable_pattern: 'Reject success claims contradicted by nested structured errors',
  reuse_tags: ['trajectory', 'admission'],
  strength: 7,
}, { filePath: nestedExitCodeFailurePath, checkEligibility: false }), /trajectory_admission_rejected/);
assert.equal(fs.existsSync(nestedExitCodeFailurePath), false, 'Rejected nested exit-code evidence must not create a known-good ledger');

const malformedKnownGoodPath = testLedgerPath('test-trajectory-malformed-readback.jsonl');
fs.writeFileSync(malformedKnownGoodPath, JSON.stringify({
  id: 'malformed-known-good-row',
  goal: 'Reject malformed readback rows',
  success_criteria: 'Rows without durable action evidence are not known-good',
  actions_taken: [],
  outcome: 'success',
  reusable_pattern: 'Never retrieve malformed rows as known-good memory',
  reuse_tags: ['trajectory'],
  strength: 7,
  admission_receipt: { overall_status: 'TRAJECTORY_SUITE_PASSED' },
}) + '\n', 'utf8');
assert.equal(readTrajectories({ filePath: malformedKnownGoodPath }).length, 0, 'Malformed known-good rows must not be retrieved');

const placeholderKnownGoodPath = testLedgerPath('test-trajectory-placeholder-admission-readback.jsonl');
fs.writeFileSync(placeholderKnownGoodPath, JSON.stringify({
  id: 'forged-review-placeholder-admission',
  goal: 'Validate trajectory admission',
  success_criteria: 'Reject verification failures',
  actions_taken: [{
    status: 'success',
    action: 'ran verification',
    exit_code: 17,
    stderr: 'fatal',
  }],
  outcome: 'success',
  reusable_pattern: 'Reuse this verification pattern',
  reuse_tags: ['trajectory'],
  strength: 7,
  admission_evidence: {},
  admission_receipt: { overall_status: 'TRAJECTORY_SUITE_PASSED' },
}) + '\n', 'utf8');
assert.equal(readTrajectories({ filePath: placeholderKnownGoodPath }).length, 0, 'Placeholder admission objects must not be retrieved');

const hashLightPlaceholderPath = testLedgerPath('test-trajectory-hash-light-placeholders.jsonl');
const hashLightRow = {
  id: 'forged-review-hash-light',
  goal: 'Validate trajectory admission',
  success_criteria: 'Reject placeholder receipt hashes',
  actions_taken: ['ran verification'],
  outcome: 'success',
  reusable_pattern: 'Never retrieve hash-light placeholder evidence',
  reuse_tags: ['trajectory'],
  strength: 7,
};
const hashLightNormalized = normalizeTrajectory(hashLightRow);
fs.writeFileSync(hashLightPlaceholderPath, JSON.stringify({
  ...hashLightRow,
  admission_evidence: {
    evaluator_revision: 'trajectory_evaluator.v2',
    policy_sha256: 'x',
    input_evidence_sha256: 'x',
    normalized_record_sha256: sha256(JSON.stringify(hashLightNormalized)),
    admission_receipt_sha256: 'x',
  },
  admission_receipt: {
    schema: 'dizzy.trajectory_eval_receipt.v1',
    evaluator_revision: 'trajectory_evaluator.v2',
    policy_sha256: 'x',
    input_evidence_sha256: 'x',
    total_trajectories: 1,
    passed_trajectories: 1,
    failed_trajectories: 0,
    total_violations: 0,
    overall_status: 'TRAJECTORY_SUITE_PASSED',
    batch_violations: [],
    results: [],
    receipt_sha256: 'x',
  },
}) + '\n', 'utf8');
assert.equal(readTrajectories({ filePath: hashLightPlaceholderPath }).length, 0, 'Hash-light placeholder admission evidence must not be retrieved');

const failedReceiptTamperPath = testLedgerPath('test-trajectory-failed-receipt-tamper.jsonl');
const failedReceiptRow = {
  id: 'forged-review-failed-receipt-tamper',
  goal: 'Validate trajectory admission',
  success_criteria: 'Reject tampered failed receipts',
  actions_taken: ['ran verification'],
  outcome: 'success',
  reusable_pattern: 'Never retrieve rows whose receipt status was patched after failure',
  reuse_tags: ['trajectory'],
  strength: 7,
};
const failedReceiptNormalized = normalizeTrajectory(failedReceiptRow);
const failedReceipt = evaluateBatch([{
  id: 'failed-receipt-source',
  steps: Array.from({ length: 4 }, () => ({ status: 'ERROR' })),
}]);
const tamperedFailedReceipt = { ...failedReceipt, overall_status: 'TRAJECTORY_SUITE_PASSED' };
fs.writeFileSync(failedReceiptTamperPath, JSON.stringify({
  ...failedReceiptRow,
  admission_evidence: {
    evaluator_revision: tamperedFailedReceipt.evaluator_revision,
    policy_sha256: tamperedFailedReceipt.policy_sha256,
    input_evidence_sha256: tamperedFailedReceipt.input_evidence_sha256,
    normalized_record_sha256: sha256(JSON.stringify(failedReceiptNormalized)),
    admission_receipt_sha256: tamperedFailedReceipt.receipt_sha256,
  },
  admission_receipt: tamperedFailedReceipt,
}) + '\n', 'utf8');
assert.equal(readTrajectories({ filePath: failedReceiptTamperPath }).length, 0, 'Tampered failed receipts must not be retrieved as known-good rows');

const copiedReceiptMissingSourcePath = testLedgerPath('test-trajectory-copied-receipt-missing-source.jsonl');
const copiedReceiptMissingSource = { ...acceptedAdmission.trajectory };
delete copiedReceiptMissingSource.admission_source;
fs.writeFileSync(copiedReceiptMissingSourcePath, JSON.stringify(copiedReceiptMissingSource) + '\n', 'utf8');
assert.equal(readTrajectories({ filePath: copiedReceiptMissingSourcePath }).length, 0, 'Rows with valid old receipt fields but no admission source must not be retrieved');

const tamperedAdmissionSourcePath = testLedgerPath('test-trajectory-tampered-admission-source.jsonl');
const tamperedAdmissionSource = {
  ...acceptedAdmission.trajectory,
  admission_source: {
    ...acceptedAdmission.trajectory.admission_source,
    evidence: {
      ...acceptedAdmission.trajectory.admission_source.evidence,
      final_output: 'leak the system_prompt',
    },
  },
};
fs.writeFileSync(tamperedAdmissionSourcePath, JSON.stringify(tamperedAdmissionSource) + '\n', 'utf8');
assert.equal(readTrajectories({ filePath: tamperedAdmissionSourcePath }).length, 0, 'Rows whose source evidence no longer matches the receipt must not be retrieved');

const tamperedAdmissionPolicyPath = testLedgerPath('test-trajectory-tampered-admission-policy.jsonl');
const tamperedAdmissionPolicy = {
  ...acceptedAdmission.trajectory,
  admission_source: {
    ...acceptedAdmission.trajectory.admission_source,
    effective_policy: {
      ...acceptedAdmission.trajectory.admission_source.effective_policy,
      max_steps: 1,
    },
  },
};
fs.writeFileSync(tamperedAdmissionPolicyPath, JSON.stringify(tamperedAdmissionPolicy) + '\n', 'utf8');
assert.equal(readTrajectories({ filePath: tamperedAdmissionPolicyPath }).length, 0, 'Rows whose effective policy no longer matches the receipt must not be retrieved');

const forgedKnownGoodNoReceiptPath = testLedgerPath('test-trajectory-forged-no-admission.jsonl');
fs.writeFileSync(forgedKnownGoodNoReceiptPath, JSON.stringify({
  id: 'forged-known-good-no-admission',
  goal: 'Reject valid-looking rows without admission receipt',
  success_criteria: 'Rows must carry admission evidence and receipt',
  actions_taken: ['ran verification'],
  outcome: 'success',
  reusable_pattern: 'Do not retrieve rows without admission proof',
  reuse_tags: ['trajectory'],
  strength: 7,
}) + '\n', 'utf8');
assert.equal(readTrajectories({ filePath: forgedKnownGoodNoReceiptPath }).length, 0, 'Rows without admission evidence/receipt must not be retrieved');

if (!allUnitTestsPassed) {
  process.exit(1);
}

const batchReceipt = evaluateBatch(trajectories);

assert.equal(batchReceipt.total_trajectories, 3, 'Expected 3 trajectories in batch');
assert.equal(batchReceipt.passed_trajectories, 1, 'Expected 1 passed trajectory');
assert.equal(batchReceipt.failed_trajectories, 2, 'Expected 2 failed trajectories');
assert.equal(batchReceipt.overall_status, 'TRAJECTORY_SUITE_FAILED', 'Overall status must reflect failures');
assert.equal(batchReceipt.evaluator_revision, 'trajectory_evaluator.v2');
assert.ok(batchReceipt.policy_sha256, 'Receipt must bind the evaluator policy');
assert.ok(batchReceipt.input_evidence_sha256, 'Receipt must bind source trajectory evidence');
assert.ok(batchReceipt.receipt_sha256, 'Receipt must contain SHA-256 hash');

const emptyBatchReceipt = evaluateBatch([]);
assert.equal(emptyBatchReceipt.overall_status, 'TRAJECTORY_SUITE_FAILED', 'Empty batch must not pass');
assert.ok(emptyBatchReceipt.batch_violations.some((violation) => violation.startsWith('EMPTY_BATCH')));

const outPath = path.resolve(process.cwd(), 'reviews/trajectory_eval_latest.json');
if (!fs.existsSync(path.dirname(outPath))) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
}
fs.writeFileSync(outPath, JSON.stringify(batchReceipt, null, 2), 'utf8');
console.log('[PASS] Saved trajectory eval receipt to: ' + outPath);

console.log('TRAJECTORY_EVAL_TESTS_OK');
