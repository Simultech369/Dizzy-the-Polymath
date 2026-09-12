import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { evaluateBatch, evaluateTrajectory } from '../lib/trajectory_evaluator.mjs';
import { appendTrajectory, readTrajectories } from '../lib/trajectories.mjs';

console.log('=== W-0128 Trajectory Eval Gates Test Suite ===');

const fixturesPath = path.resolve(process.cwd(), 'scripts/fixtures/trajectory_eval_fixtures.json');
const fixturesData = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
const trajectories = fixturesData.trajectories;

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

const admissionRejectPath = path.resolve(process.cwd(), 'runtime/test-trajectory-admission-reject.jsonl');
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

const admissionConflictPath = path.resolve(process.cwd(), 'runtime/test-trajectory-admission-conflict.jsonl');
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

const admissionAcceptPath = path.resolve(process.cwd(), 'runtime/test-trajectory-admission-accept.jsonl');
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

const stepsAdmissionPath = path.resolve(process.cwd(), 'runtime/test-trajectory-admission-steps.jsonl');
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

const malformedKnownGoodPath = path.resolve(process.cwd(), 'runtime/test-trajectory-malformed-readback.jsonl');
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
