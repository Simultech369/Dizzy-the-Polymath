import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TRAJECTORY_CONTRACT_SCHEMA,
  TRAJECTORY_STEP_CONTRACT_SCHEMA,
  TRAJECTORY_CONTRACT_RECEIPT_SCHEMA,
  TRAJECTORY_STEP_SNAPSHOT_SCHEMA,
  FAULT_CLASS_ORCHESTRATION,
  FAULT_CLASS_MODEL_LOGIC,
  FAULT_CLASS_NONE,
  FAULT_TYPES,
  classifyTrajectoryFault,
  Choice,
  Score,
  Noul,
  evaluateProgressSentinel,
  createStepContract,
  assertStepPreconditions,
  assertStepPostconditions,
  evaluateStepExecution,
  createTrajectoryContractReceipt,
  verifyTrajectoryContractReceipt,
  captureStepSnapshot,
  rehydrateStepSnapshot,
} from '../lib/trajectory_contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_TEST_DIR = path.join(__dirname, '..', 'runtime', 'tmp_contract_test');

async function runTests() {
  console.log('=== [Trajectory Invariant Contract Test Suite] ===\n');

  // ----------------------------------------------------
  // Test 1: Fault Taxonomy Classification
  // ----------------------------------------------------
  console.log('Test 1: Fault Taxonomy Classification (Orchestration vs Model Logic)...');

  // A. Null / None
  const noFault = classifyTrajectoryFault(null);
  assert.equal(noFault.fault_class, FAULT_CLASS_NONE);

  // B. Band / Windows Path / Environment Error (Dark Factory finding)
  const pathErr = classifyTrajectoryFault('OSError: [Errno 22] Invalid argument: C:\\temp\\room\n');
  assert.equal(pathErr.fault_class, FAULT_CLASS_ORCHESTRATION);
  assert.equal(pathErr.fault_type, FAULT_TYPES.ENVIRONMENT_IO_ERROR);
  assert.equal(pathErr.is_retryable, true);

  // C. BAND Mention Requirement Unmet (Dark Factory finding)
  const mentionErr = classifyTrajectoryFault('BandToolError: at least one mention is required in tool call');
  assert.equal(mentionErr.fault_class, FAULT_CLASS_ORCHESTRATION);
  assert.equal(mentionErr.fault_type, FAULT_TYPES.MENTION_REQUIREMENT_UNMET);

  // D. REST API Enum Mismatch (Dark Factory finding)
  const enumErr = classifyTrajectoryFault('ValidationError: message_type "audit_check" is invalid enum');
  assert.equal(enumErr.fault_class, FAULT_CLASS_ORCHESTRATION);
  assert.equal(enumErr.fault_type, FAULT_TYPES.REST_API_ENUM_MISMATCH);

  // E. Timeout
  const timeoutErr = classifyTrajectoryFault('Step execution timed out after 30000ms', { code: 'ETIMEDOUT' });
  assert.equal(timeoutErr.fault_class, FAULT_CLASS_ORCHESTRATION);
  assert.equal(timeoutErr.fault_type, FAULT_TYPES.TIMEOUT_EXCEEDED);

  // F. Python / Model Syntax Error
  const syntaxErr = classifyTrajectoryFault('SyntaxError: invalid syntax in payments.py at line 14');
  assert.equal(syntaxErr.fault_class, FAULT_CLASS_MODEL_LOGIC);
  assert.equal(syntaxErr.fault_type, FAULT_TYPES.SYNTAX_ERROR);
  assert.equal(syntaxErr.is_retryable, false);

  // G. Pytest / Assertion Failure
  const testErr = classifyTrajectoryFault('FAILED tests/test_payments.py::test_reconciliation - AssertionError: balance mismatch');
  assert.equal(testErr.fault_class, FAULT_CLASS_MODEL_LOGIC);
  assert.equal(testErr.fault_type, FAULT_TYPES.TEST_ASSERTION_FAILED);

  // H. Ruff Linter Error
  const lintErr = classifyTrajectoryFault('ruff check failed: F401 `os` imported but unused');
  assert.equal(lintErr.fault_class, FAULT_CLASS_MODEL_LOGIC);
  assert.equal(lintErr.fault_type, FAULT_TYPES.LINT_RULE_VIOLATION);

  console.log('✓ Fault taxonomy correctly classifies real-world orchestration and model logic errors.');

  // ----------------------------------------------------
  // Test 2: Jev-Style System One Typed Decision Primitives
  // ----------------------------------------------------
  console.log('\nTest 2: Jev-Style System One Decision Primitives (Choice, Score, Noul)...');

  // Choice
  const tierChoice = Choice('tier1_slm_offline', ['tier0_deterministic', 'tier1_slm_offline', 'tier3_frontier'], 0.92, 'Offline SLM sufficient');
  assert.equal(tierChoice.type, 'Choice');
  assert.equal(tierChoice.selected, 'tier1_slm_offline');
  assert.equal(tierChoice.confidence, 0.92);

  assert.throws(() => {
    Choice('invalid_tier', ['tier0', 'tier1']);
  }, /not within valid allowlist/);

  // Score
  const riskScore = Score(0.78, { min: 0.0, max: 1.0, threshold: 0.75, confidence: 0.9, metric: 'irreversibility' });
  assert.equal(riskScore.type, 'Score');
  assert.equal(riskScore.value, 0.78);
  assert.equal(riskScore.exceeds_threshold, true);

  // Noul
  const progressNoul = Noul(true, 0.95, 'Materialized 2 files and passed AST validation');
  assert.equal(progressNoul.type, 'Noul');
  assert.equal(progressNoul.predicate, true);
  assert.equal(progressNoul.confidence, 0.95);

  assert.throws(() => {
    Noul('not_a_boolean', 0.5);
  }, /strict boolean/);

  console.log('✓ System One typed primitives validated and bounded.');

  // ----------------------------------------------------
  // Test 3: Anti-Spinning Watchdog Sentinel
  // ----------------------------------------------------
  console.log('\nTest 3: Anti-Spinning Watchdog Sentinel...');

  // A. Normal progress
  const sentinelOk = evaluateProgressSentinel({
    currentStepIndex: 1,
    history: [],
    deltaBytes: 1540,
    diffSummary: 'Added payments.py',
  });
  assert.equal(sentinelOk.action, 'continue');
  assert.equal(sentinelOk.progress_noul.predicate, true);

  // B. Spinning loop: 3 consecutive zero-delta steps
  const spinningHistory = [
    { stepIndex: 0, deltaBytes: 100, diffSummary: 'init' },
    { stepIndex: 1, deltaBytes: 0, diffSummary: '' },
    { stepIndex: 2, deltaBytes: 0, diffSummary: '' },
  ];
  const sentinelKill = evaluateProgressSentinel({
    currentStepIndex: 3,
    history: spinningHistory,
    deltaBytes: 0,
    diffSummary: '',
    consecutiveNoopThreshold: 3,
  });
  assert.equal(sentinelKill.action, 'kill');
  assert.equal(sentinelKill.stuck_score.exceeds_threshold, true);
  assert.match(sentinelKill.decision.rationale, /Anti-spin sentinel triggered/);

  // C. High-stakes step with low progress confidence triggers HITL escalation
  const sentinelHitl = evaluateProgressSentinel({
    currentStepIndex: 2,
    history: [],
    deltaBytes: 50,
    diffSummary: 'minor tweak',
    isHighStakes: true,
    hitlConfidenceThreshold: 0.95, // higher than progress confidence
  });
  assert.equal(sentinelHitl.action, 'escalate_hitl');

  console.log('✓ Anti-spin watchdog terminates spinning loops and escalates high-stakes decisions.');

  // ----------------------------------------------------
  // Test 4: Step Contract Preconditions Barrier
  // ----------------------------------------------------
  console.log('\nTest 4: Step Contract Precondition Enforcement...');

  const coderContract = createStepContract({
    stepId: 'step_coder_001',
    role: 'coder',
    preconditions: [
      {
        name: 'plan_artifact_must_exist',
        check: (state) => Boolean(state.plan_artifact && state.plan_artifact.tasks?.length > 0),
        faultClass: FAULT_CLASS_ORCHESTRATION,
        remediation: 'Planner step must complete and emit plan_artifact before Coder execution.',
      },
      {
        name: 'workspace_clean',
        check: (state) => state.is_clean === true,
        faultClass: FAULT_CLASS_ORCHESTRATION,
      },
    ],
    postconditions: [
      {
        name: 'files_materialized',
        check: (result) => Array.isArray(result.files) && result.files.length >= 1,
        faultClass: FAULT_CLASS_ORCHESTRATION,
      },
    ],
    timeoutMs: 5000,
  });

  // Failing precondition test: plan missing
  const failingPreState = { is_clean: true };
  let executorCalled = false;
  const execPreFail = await evaluateStepExecution(
    coderContract,
    async () => {
      executorCalled = true;
      return { files: ['payments.py'] };
    },
    failingPreState
  );

  assert.equal(executorCalled, false, 'Executor must NOT be called if preconditions fail');
  assert.equal(execPreFail.ok, false);
  assert.equal(execPreFail.status, 'FAILED_PRECONDITION');
  assert.equal(execPreFail.fault.fault_class, FAULT_CLASS_ORCHESTRATION);
  assert.equal(execPreFail.fault.fault_type, FAULT_TYPES.PRECONDITION_FAILED);
  assert.match(execPreFail.fault.actionable_remediation, /Planner step must complete/);

  console.log('✓ Precondition barrier halts execution before model seat is invoked.');

  // ----------------------------------------------------
  // Test 5: Step Contract Model Execution Faults
  // ----------------------------------------------------
  console.log('\nTest 5: Step Contract Execution Fault Handling...');

  // Model throws syntax error during generation
  const passingPreState = { plan_artifact: { tasks: ['implement_payments'] }, is_clean: true };
  const execModelFail = await evaluateStepExecution(
    coderContract,
    async () => {
      const err = new SyntaxError('Unexpected token in generated module');
      throw err;
    },
    passingPreState
  );

  assert.equal(execModelFail.ok, false);
  assert.equal(execModelFail.status, 'FAILED_EXECUTION');
  assert.equal(execModelFail.fault.fault_class, FAULT_CLASS_MODEL_LOGIC);
  assert.equal(execModelFail.fault.fault_type, FAULT_TYPES.SYNTAX_ERROR);

  console.log('✓ Model logic syntax failure properly isolated from orchestration boundaries.');

  // ----------------------------------------------------
  // Test 6: Step Contract Postconditions Barrier
  // ----------------------------------------------------
  console.log('\nTest 6: Step Contract Postconditions Enforcement...');

  // Model succeeds in execution but outputs 0 files (violates postcondition)
  const execPostFail = await evaluateStepExecution(
    coderContract,
    async () => {
      return { files: [] }; // empty files!
    },
    passingPreState
  );

  assert.equal(execPostFail.ok, false);
  assert.equal(execPostFail.status, 'FAILED_POSTCONDITION');
  assert.equal(execPostFail.fault.fault_class, FAULT_CLASS_ORCHESTRATION);
  assert.equal(execPostFail.fault.fault_type, FAULT_TYPES.POSTCONDITION_FAILED);

  console.log('✓ Postcondition barrier halts bad state from propagating downstream.');

  // ----------------------------------------------------
  // Test 7: Successful Step Execution & Receipt
  // ----------------------------------------------------
  console.log('\nTest 7: Full Successful Step Execution & Cryptographic Receipt...');

  const execSuccess = await evaluateStepExecution(
    coderContract,
    async () => {
      return { files: ['payments.py', 'test_payments.py'], passed_tests: true };
    },
    passingPreState
  );

  assert.equal(execSuccess.ok, true);
  assert.equal(execSuccess.status, 'PASSED');
  assert.equal(execSuccess.fault, null);
  assert.ok(execSuccess.evidence_sha256);

  // Generate Receipt
  const receipt = createTrajectoryContractReceipt({
    trajectoryId: 'traj_band_dark_factory_001',
    executionResults: [execSuccess],
    gitBinding: {
      schema_version: 'dizzy.git_binding.v1',
      branch: 'main',
      head_commit: 'abcdef0123456789',
      is_dirty: false,
    },
    metadata: { operator: 'Josh', room: 'dark-factory-live' },
  });

  assert.equal(receipt.schema_version, TRAJECTORY_CONTRACT_RECEIPT_SCHEMA);
  assert.equal(receipt.verdict, 'VERIFIED_PASSED');
  assert.equal(receipt.metrics.total_steps, 1);
  assert.equal(receipt.metrics.passed_steps, 1);
  assert.equal(receipt.metrics.orchestration_faults, 0);
  assert.equal(receipt.metrics.model_logic_faults, 0);

  const verification = verifyTrajectoryContractReceipt(receipt);
  assert.equal(verification.ok, true);

  // Verify tampering detection
  const tamperedReceipt = { ...receipt, verdict: 'TAMPERED_VERDICT' };
  const tamperedVerification = verifyTrajectoryContractReceipt(tamperedReceipt);
  assert.equal(tamperedVerification.ok, false);
  assert.match(tamperedVerification.reason, /Hash mismatch/);

  console.log('✓ Cryptographic trajectory contract receipt generated and verified.');

  // ----------------------------------------------------
  // Test 8: Workspace Snapshotting & Rehydration
  // ----------------------------------------------------
  console.log('\nTest 8: Workspace Step Snapshotting & Time-Travel Rehydration...');

  const mockFiles = {
    'pocketful/payments.py': 'def process_payment(amount):\n    return True\n',
    'pocketful/config.json': JSON.stringify({ mode: 'test', fee_bps: 25 }, null, 2),
  };

  const snapshot = captureStepSnapshot({
    stepId: 'step_coder_001',
    workspaceFiles: mockFiles,
    state: { balance: 1000 },
    contractVerdict: 'PASSED',
  });

  assert.equal(snapshot.schema_version, TRAJECTORY_STEP_SNAPSHOT_SCHEMA);
  assert.ok(snapshot.snapshot_sha256);
  assert.equal(snapshot.files['pocketful/payments.py'].bytes > 0, true);

  // Rehydrate into temp directory
  if (fs.existsSync(TEMP_TEST_DIR)) {
    fs.rmSync(TEMP_TEST_DIR, { recursive: true, force: true });
  }

  const restored = rehydrateStepSnapshot(snapshot, TEMP_TEST_DIR);
  assert.equal(restored.verified, true);
  assert.equal(restored.step_id, 'step_coder_001');

  // Verify physical files on disk
  const restoredPyPath = path.join(TEMP_TEST_DIR, 'pocketful', 'payments.py');
  assert.equal(fs.existsSync(restoredPyPath), true);
  assert.equal(fs.readFileSync(restoredPyPath, 'utf8'), mockFiles['pocketful/payments.py']);

  // Clean up temp test directory
  fs.rmSync(TEMP_TEST_DIR, { recursive: true, force: true });

  console.log('✓ Workspace snapshot captured and cleanly rehydrated for time-travel debug.');

  console.log('\n==================================================');
  console.log('   ALL TRAJECTORY CONTRACT INVARIANTS PASSED!     ');
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('\n[FATAL] Test failed:', err);
  process.exit(1);
});
