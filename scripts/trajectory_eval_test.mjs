import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { evaluateBatch, evaluateTrajectory } from '../lib/trajectory_evaluator.mjs';

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

if (!allUnitTestsPassed) {
  process.exit(1);
}

const batchReceipt = evaluateBatch(trajectories);

assert.equal(batchReceipt.total_trajectories, 3, 'Expected 3 trajectories in batch');
assert.equal(batchReceipt.passed_trajectories, 1, 'Expected 1 passed trajectory');
assert.equal(batchReceipt.failed_trajectories, 2, 'Expected 2 failed trajectories');
assert.equal(batchReceipt.overall_status, 'TRAJECTORY_SUITE_FAILED', 'Overall status must reflect failures');

const outPath = path.resolve(process.cwd(), 'reviews/trajectory_eval_latest.json');
if (!fs.existsSync(path.dirname(outPath))) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
}
fs.writeFileSync(outPath, JSON.stringify(batchReceipt, null, 2), 'utf8');
console.log('[PASS] Saved trajectory eval receipt to: ' + outPath);

console.log('TRAJECTORY_EVAL_TESTS_OK');
