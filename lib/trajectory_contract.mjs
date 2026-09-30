import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONSISTENCY_CLASSES,
  CONSISTENCY_BADGES,
  CONSISTENCY_AUTHORITY_RULES,
} from './consistency_boundary.mjs';

export { CONSISTENCY_CLASSES, CONSISTENCY_BADGES, CONSISTENCY_AUTHORITY_RULES };

export const TRAJECTORY_CONTRACT_SCHEMA = 'dizzy.trajectory_contract.v1';
export const TRAJECTORY_STEP_CONTRACT_SCHEMA = 'dizzy.trajectory_step_contract.v1';
export const TRAJECTORY_CONTRACT_RECEIPT_SCHEMA = 'dizzy.trajectory_contract_receipt.v1';
export const TRAJECTORY_STEP_SNAPSHOT_SCHEMA = 'dizzy.trajectory_step_snapshot.v1';

export const FAULT_CLASS_ORCHESTRATION = 'FAULT_CLASS_ORCHESTRATION';
export const FAULT_CLASS_MODEL_LOGIC = 'FAULT_CLASS_MODEL_LOGIC';
export const FAULT_CLASS_NONE = 'FAULT_CLASS_NONE';

export const FAULT_TYPES = Object.freeze({
  // Orchestration & Protocol Faults
  PROTOCOL_VIOLATION: 'PROTOCOL_VIOLATION',
  HANDLE_RESOLUTION_FAILURE: 'HANDLE_RESOLUTION_FAILURE',
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED',
  LOCK_CONTENTION: 'LOCK_CONTENTION',
  BUFFER_OVERFLOW: 'BUFFER_OVERFLOW',
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  POSTCONDITION_FAILED: 'POSTCONDITION_FAILED',
  ENVIRONMENT_IO_ERROR: 'ENVIRONMENT_IO_ERROR',
  ANTI_SPIN_WATCHDOG_HALT: 'ANTI_SPIN_WATCHDOG_HALT',
  REST_API_ENUM_MISMATCH: 'REST_API_ENUM_MISMATCH',
  MENTION_REQUIREMENT_UNMET: 'MENTION_REQUIREMENT_UNMET',

  // Model Logic & Semantic Faults
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  TEST_ASSERTION_FAILED: 'TEST_ASSERTION_FAILED',
  LINT_RULE_VIOLATION: 'LINT_RULE_VIOLATION',
  SPEC_OMISSION: 'SPEC_OMISSION',
  TYPE_ERROR: 'TYPE_ERROR',
  LOGICAL_CONTRADICTION: 'LOGICAL_CONTRADICTION',
});

function stableJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

/**
 * Classifies an error, failure message, or status into non-overlapping classes:
 * FAULT_CLASS_ORCHESTRATION vs FAULT_CLASS_MODEL_LOGIC.
 *
 * @param {Error|string|object} errorOrStatus
 * @param {object} context
 * @returns {{ fault_class: string, fault_type: string, reason: string, actionable_remediation: string, is_retryable: boolean }}
 */
export function classifyTrajectoryFault(errorOrStatus, context = {}) {
  if (!errorOrStatus) {
    return {
      fault_class: FAULT_CLASS_NONE,
      fault_type: 'NONE',
      reason: 'No fault detected',
      actionable_remediation: 'None required',
      is_retryable: false,
    };
  }

  const rawMessage = typeof errorOrStatus === 'string'
    ? errorOrStatus
    : (errorOrStatus.message || errorOrStatus.reason || errorOrStatus.stderr || errorOrStatus.stdout || JSON.stringify(errorOrStatus));
  
  const text = String(rawMessage || '').toLowerCase();
  const code = String(errorOrStatus.code || context.code || '').toUpperCase();
  const contextType = String(context.type || '').toUpperCase();

  // 1. Explicit override in context
  if (context.explicitFaultClass === FAULT_CLASS_ORCHESTRATION) {
    let defaultType = FAULT_TYPES.PROTOCOL_VIOLATION;
    if (contextType === 'PRECONDITION') defaultType = FAULT_TYPES.PRECONDITION_FAILED;
    else if (contextType === 'POSTCONDITION') defaultType = FAULT_TYPES.POSTCONDITION_FAILED;
    else if (contextType === 'WATCHDOG') defaultType = FAULT_TYPES.ANTI_SPIN_WATCHDOG_HALT;

    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: context.faultType || defaultType,
      reason: rawMessage,
      actionable_remediation: context.remediation || (
        contextType === 'PRECONDITION' ? 'Enforce step barrier ordering; prior step must materialize required artifacts before calling downstream seat.' :
        contextType === 'POSTCONDITION' ? 'Step output failed structural boundary verification. Verify artifact manifests and schemas before downstream mutation.' :
        'Inspect protocol, barrier sequencing, and orchestration handoffs.'
      ),
      is_retryable: context.isRetryable ?? true,
    };
  }
  if (context.explicitFaultClass === FAULT_CLASS_MODEL_LOGIC) {
    return {
      fault_class: FAULT_CLASS_MODEL_LOGIC,
      fault_type: context.faultType || FAULT_TYPES.TEST_ASSERTION_FAILED,
      reason: rawMessage,
      actionable_remediation: context.remediation || 'Revise model logic, code implementation, or test assertions.',
      is_retryable: false,
    };
  }

  // 2. Anti-spin watchdog halts
  if (contextType === 'WATCHDOG' || text.includes('spinning') || text.includes('watchdog halt') || text.includes('consecutive noop')) {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.ANTI_SPIN_WATCHDOG_HALT,
      reason: rawMessage,
      actionable_remediation: 'Agent repeating identical actions without forward progress. Halt, prune context, or replan.',
      is_retryable: false,
    };
  }

  // 3. Precondition / Postcondition failures
  if (text.includes('precondition failed') || contextType === 'PRECONDITION') {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.PRECONDITION_FAILED,
      reason: rawMessage,
      actionable_remediation: 'Enforce step barrier ordering; prior step must materialize required artifacts before calling downstream seat.',
      is_retryable: true,
    };
  }
  if (text.includes('postcondition failed') || contextType === 'POSTCONDITION') {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.POSTCONDITION_FAILED,
      reason: rawMessage,
      actionable_remediation: 'Step output failed structural boundary verification. Verify artifact manifests and schemas before downstream mutation.',
      is_retryable: true,
    };
  }

  // 4. Timeouts & Deadlines
  if (code === 'ETIMEDOUT' || text.includes('timeout') || text.includes('timed out') || text.includes('deadline exceeded')) {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.TIMEOUT_EXCEEDED,
      reason: rawMessage,
      actionable_remediation: 'Step execution exceeded configured timeoutMs. Increase step budget or optimize task decomposition.',
      is_retryable: true,
    };
  }

  // 5. Band SDK / Room Protocol specific faults (Dark Factory findings)
  if (text.includes('oserror: [errno 22]') || text.includes('invalid argument') && (text.includes('\\') || text.includes('/'))) {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.ENVIRONMENT_IO_ERROR,
      reason: rawMessage,
      actionable_remediation: 'Sanitize filesystem paths: strip newlines and unprintable characters from temp and workspace paths.',
      is_retryable: true,
    };
  }

  if (text.includes('mention') && (text.includes('at least one') || text.includes('required') || text.includes('bandtoolerror'))) {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.MENTION_REQUIREMENT_UNMET,
      reason: rawMessage,
      actionable_remediation: 'Provide at least one explicit participant mention handle in SDK tool call mentions array.',
      is_retryable: true,
    };
  }

  if (text.includes('unknown participant') || text.includes('handle resolution') || text.includes('could not find participant')) {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.HANDLE_RESOLUTION_FAILURE,
      reason: rawMessage,
      actionable_remediation: 'Resolve exact room participant handles (e.g. org/handle) before dispatching message or assignment.',
      is_retryable: true,
    };
  }

  if (text.includes('message_type') || text.includes('invalid enum') || text.includes('unsupported event type')) {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.REST_API_ENUM_MISMATCH,
      reason: rawMessage,
      actionable_remediation: 'Use strictly valid REST/SDK event enums (tool_result, tool_call, thought, error, task).',
      is_retryable: false,
    };
  }

  // 6. Network / Socket / System IO faults
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    text.includes('socket hang up') ||
    text.includes('network error') ||
    text.includes('fetch failed')
  ) {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.PROTOCOL_VIOLATION,
      reason: rawMessage,
      actionable_remediation: 'Network connection interrupted or endpoint unreachable. Retry with backoff.',
      is_retryable: true,
    };
  }

  // 7. Lock contention / Mutex
  if (text.includes('lock contention') || text.includes('lease expired') || text.includes('resource locked') || text.includes('ebusy')) {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.LOCK_CONTENTION,
      reason: rawMessage,
      actionable_remediation: 'Resource lock is contended. Back off and re-acquire lease.',
      is_retryable: true,
    };
  }

  // 8. Model Logic & Code Semantic Faults
  if (
    text.includes('syntaxerror') ||
    text.includes('indentationerror') ||
    text.includes('invalid syntax') ||
    text.includes('unexpected token')
  ) {
    return {
      fault_class: FAULT_CLASS_MODEL_LOGIC,
      fault_type: FAULT_TYPES.SYNTAX_ERROR,
      reason: rawMessage,
      actionable_remediation: 'Correct invalid syntax or AST construction in generated source code.',
      is_retryable: false,
    };
  }

  if (
    text.includes('assertionerror') ||
    text.includes('pytest') && text.includes('failed') ||
    text.includes('test failed') ||
    text.includes('assert ')
  ) {
    return {
      fault_class: FAULT_CLASS_MODEL_LOGIC,
      fault_type: FAULT_TYPES.TEST_ASSERTION_FAILED,
      reason: rawMessage,
      actionable_remediation: 'Adjust implementation logic to satisfy test suite invariants and specifications.',
      is_retryable: false,
    };
  }

  if (
    text.includes('ruff') ||
    text.includes('eslint') ||
    text.includes('lint error') ||
    text.includes('style violation')
  ) {
    return {
      fault_class: FAULT_CLASS_MODEL_LOGIC,
      fault_type: FAULT_TYPES.LINT_RULE_VIOLATION,
      reason: rawMessage,
      actionable_remediation: 'Format code and resolve static linter rule violations.',
      is_retryable: false,
    };
  }

  if (
    text.includes('typeerror') ||
    text.includes('attributeerror') ||
    text.includes('nameerror') ||
    text.includes('referenceerror')
  ) {
    return {
      fault_class: FAULT_CLASS_MODEL_LOGIC,
      fault_type: FAULT_TYPES.TYPE_ERROR,
      reason: rawMessage,
      actionable_remediation: 'Fix undefined reference, variable name, or type mismatch in model code.',
      is_retryable: false,
    };
  }

  // Default fallback: classify as orchestration if system-level, model logic otherwise
  if (text.includes('enoent') || text.includes('eacces') || text.includes('permission denied')) {
    return {
      fault_class: FAULT_CLASS_ORCHESTRATION,
      fault_type: FAULT_TYPES.ENVIRONMENT_IO_ERROR,
      reason: rawMessage,
      actionable_remediation: 'Verify file permissions and directory existence in runtime environment.',
      is_retryable: true,
    };
  }

  return {
    fault_class: FAULT_CLASS_MODEL_LOGIC,
    fault_type: FAULT_TYPES.SPEC_OMISSION,
    reason: rawMessage,
    actionable_remediation: 'Review execution trace against expected specification and requirements.',
    is_retryable: false,
  };
}

/**
 * TypeSafe System One Primitive: Choice
 * Bounded selection from an allowlist with confidence score.
 */
export function Choice(selected, allowlist, confidence = 1.0, rationale = '') {
  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    throw new Error('Choice allowlist must be a non-empty array of valid options');
  }
  if (!allowlist.includes(selected)) {
    throw new Error(`Choice '${selected}' is not within valid allowlist: [${allowlist.join(', ')}]`);
  }
  const conf = Number(confidence);
  if (!Number.isFinite(conf) || conf < 0.0 || conf > 1.0) {
    throw new Error(`Choice confidence must be a finite float between 0.0 and 1.0, received: ${confidence}`);
  }

  return Object.freeze({
    type: 'Choice',
    selected,
    allowlist: Object.freeze([...allowlist]),
    confidence: conf,
    rationale: String(rationale || ''),
    timestamp: new Date().toISOString(),
  });
}

/**
 * TypeSafe System One Primitive: Score
 * Continuous scalar value [min, max] with threshold evaluation and confidence.
 */
export function Score(value, { min = 0.0, max = 1.0, threshold = 0.85, confidence = 1.0, metric = '' } = {}) {
  const val = Number(value);
  if (!Number.isFinite(val)) {
    throw new Error(`Score value must be a finite number, received: ${value}`);
  }
  const conf = Number(confidence);
  if (!Number.isFinite(conf) || conf < 0.0 || conf > 1.0) {
    throw new Error(`Score confidence must be between 0.0 and 1.0, received: ${confidence}`);
  }

  const bounded = Math.max(min, Math.min(max, val));
  const exceeds = bounded >= threshold;

  return Object.freeze({
    type: 'Score',
    value: bounded,
    min,
    max,
    threshold,
    exceeds_threshold: exceeds,
    confidence: conf,
    metric: String(metric || ''),
    timestamp: new Date().toISOString(),
  });
}

/**
 * TypeSafe System One Primitive: Noul
 * Typed boolean predicate with confidence score and rationale.
 */
export function Noul(predicate, confidence = 1.0, rationale = '') {
  if (typeof predicate !== 'boolean') {
    throw new Error(`Noul predicate must be a strict boolean, received: ${typeof predicate}`);
  }
  const conf = Number(confidence);
  if (!Number.isFinite(conf) || conf < 0.0 || conf > 1.0) {
    throw new Error(`Noul confidence must be between 0.0 and 1.0, received: ${confidence}`);
  }

  return Object.freeze({
    type: 'Noul',
    predicate,
    confidence: conf,
    rationale: String(rationale || ''),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Evaluates progress across agent steps to detect spinning / infinite loops early.
 * Returns a typed System 1 Choice decision ('continue', 'replan', 'escalate_hitl', or 'kill').
 */
export function evaluateProgressSentinel({
  currentStepIndex = 0,
  history = [],
  deltaBytes = 0,
  diffSummary = '',
  consecutiveNoopThreshold = 3,
  hitlConfidenceThreshold = 0.7,
  isHighStakes = false,
} = {}) {
  const recentSteps = Array.isArray(history) ? history.slice(-consecutiveNoopThreshold) : [];
  
  // Count consecutive steps where deltaBytes == 0 and diffSummary is empty
  let zeroDeltaCount = (deltaBytes === 0 && !diffSummary) ? 1 : 0;
  for (let i = recentSteps.length - 1; i >= 0; i--) {
    const s = recentSteps[i];
    if (s && s.deltaBytes === 0 && (!s.diffSummary || s.diffSummary.trim() === '')) {
      zeroDeltaCount++;
    } else {
      break;
    }
  }

  // Calculate stuckness probability
  const stuckRatio = Math.min(1.0, zeroDeltaCount / Math.max(1, consecutiveNoopThreshold));
  const stuckScore = Score(stuckRatio, {
    min: 0.0,
    max: 1.0,
    threshold: 1.0,
    confidence: 0.95,
    metric: 'stuck_loop_ratio',
  });

  const usefulProgress = Boolean((deltaBytes > 0 || Boolean(diffSummary && diffSummary.length > 0)) && zeroDeltaCount === 0);
  const progressNoul = Noul(
    usefulProgress,
    usefulProgress ? 0.9 : 0.85,
    usefulProgress ? `Progress detected: +${deltaBytes} bytes` : `Zero progress across ${zeroDeltaCount} step(s)`
  );

  let decision;
  const allowlist = ['continue', 'replan', 'escalate_hitl', 'kill'];

  if (stuckScore.exceeds_threshold) {
    decision = Choice(
      'kill',
      allowlist,
      0.95,
      `Anti-spin sentinel triggered: ${zeroDeltaCount} consecutive steps without state delta or progress.`
    );
  } else if (zeroDeltaCount >= consecutiveNoopThreshold - 1 && zeroDeltaCount > 0) {
    decision = Choice(
      'replan',
      allowlist,
      0.85,
      `Step shows no state delta (${zeroDeltaCount}/${consecutiveNoopThreshold} threshold). Replan trajectory.`
    );
  } else if (isHighStakes && progressNoul.confidence < hitlConfidenceThreshold) {
    decision = Choice(
      'escalate_hitl',
      allowlist,
      0.9,
      `High-stakes action with low progress confidence (${progressNoul.confidence} < ${hitlConfidenceThreshold}). Operator review required.`
    );
  } else {
    decision = Choice(
      'continue',
      allowlist,
      progressNoul.confidence,
      'Progress metrics within normal operational bounds.'
    );
  }

  return {
    decision,
    stuck_score: stuckScore,
    progress_noul: progressNoul,
    consecutive_noops: zeroDeltaCount,
    action: decision.selected,
  };
}

/**
 * Creates an immutable Step Contract defining required preconditions,
 * execution parameters, postconditions, and invariants.
 */
export function createStepContract({
  stepId,
  role = 'orchestrator',
  preconditions = [],
  postconditions = [],
  invariants = [],
  timeoutMs = 30000,
  metadata = {},
} = {}) {
  if (!stepId || typeof stepId !== 'string') {
    throw new Error('createStepContract requires a non-empty stepId string');
  }

  const normalizeAssertions = (list) => {
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      if (typeof item === 'function') {
        return { name: item.name || 'anonymous_check', check: item, faultClass: FAULT_CLASS_ORCHESTRATION };
      }
      if (typeof item === 'object' && item !== null && typeof item.check === 'function') {
        return {
          name: item.name || 'named_check',
          check: item.check,
          faultClass: item.faultClass || FAULT_CLASS_ORCHESTRATION,
          remediation: item.remediation || '',
        };
      }
      throw new Error('Contract assertion must be a function or an object with a check() function');
    });
  };

  const contract = {
    schema_version: TRAJECTORY_STEP_CONTRACT_SCHEMA,
    step_id: stepId,
    role: String(role || 'orchestrator'),
    timeout_ms: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
    preconditions: normalizeAssertions(preconditions),
    postconditions: normalizeAssertions(postconditions),
    invariants: normalizeAssertions(invariants),
    metadata: { ...metadata },
    created_at: new Date().toISOString(),
  };

  return Object.freeze(contract);
}

/**
 * Evaluates all preconditions defined in a Step Contract against state.
 */
export function assertStepPreconditions(contract, state = {}) {
  const passed = [];
  const failed = [];

  for (const assertion of contract.preconditions) {
    try {
      const ok = Boolean(assertion.check(state));
      if (ok) {
        passed.push(assertion.name);
      } else {
        failed.push({
          name: assertion.name,
          error: `Precondition '${assertion.name}' failed`,
          faultClass: assertion.faultClass,
          remediation: assertion.remediation,
        });
      }
    } catch (err) {
      failed.push({
        name: assertion.name,
        error: err.message,
        faultClass: assertion.faultClass,
        remediation: assertion.remediation,
      });
    }
  }

  const ok = failed.length === 0;
  let fault = null;
  if (!ok) {
    const primary = failed[0];
    fault = classifyTrajectoryFault(primary.error, {
      explicitFaultClass: primary.faultClass || FAULT_CLASS_ORCHESTRATION,
      faultType: primary.faultType || FAULT_TYPES.PRECONDITION_FAILED,
      remediation: primary.remediation,
      type: 'PRECONDITION',
    });
  }

  return { ok, passed, failed, fault };
}

/**
 * Evaluates all postconditions defined in a Step Contract against output and state.
 */
export function assertStepPostconditions(contract, result, state = {}) {
  const passed = [];
  const failed = [];

  for (const assertion of contract.postconditions) {
    try {
      const ok = Boolean(assertion.check(result, state));
      if (ok) {
        passed.push(assertion.name);
      } else {
        failed.push({
          name: assertion.name,
          error: `Postcondition '${assertion.name}' failed`,
          faultClass: assertion.faultClass,
          remediation: assertion.remediation,
        });
      }
    } catch (err) {
      failed.push({
        name: assertion.name,
        error: err.message,
        faultClass: assertion.faultClass,
        remediation: assertion.remediation,
      });
    }
  }

  const ok = failed.length === 0;
  let fault = null;
  if (!ok) {
    const primary = failed[0];
    fault = classifyTrajectoryFault(primary.error, {
      explicitFaultClass: primary.faultClass || FAULT_CLASS_ORCHESTRATION,
      faultType: primary.faultType || FAULT_TYPES.POSTCONDITION_FAILED,
      remediation: primary.remediation,
      type: 'POSTCONDITION',
    });
  }

  return { ok, passed, failed, fault };
}

/**
 * Wraps execution of a step inside the contract boundaries:
 * 1. Precondition assertion barrier
 * 2. Timed execution with abort timeout
 * 3. Error classification (Orchestration vs Model Logic)
 * 4. Postcondition assertion barrier
 */
export async function evaluateStepExecution(contract, executorFn, state = {}) {
  const startTime = Date.now();

  // 1. Preconditions Barrier
  const preCheck = assertStepPreconditions(contract, state);
  if (!preCheck.ok) {
    const durationMs = Date.now() - startTime;
    return {
      ok: false,
      contract_id: contract.step_id,
      role: contract.role,
      status: 'FAILED_PRECONDITION',
      duration_ms: durationMs,
      result: null,
      preconditions: preCheck,
      postconditions: null,
      fault: preCheck.fault,
      evidence_sha256: sha256Hex(stableJson({ contract_id: contract.step_id, status: 'FAILED_PRECONDITION', fault: preCheck.fault })),
    };
  }

  // 2. Timed Execution
  let result = null;
  let executionError = null;

  try {
    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const timeoutErr = new Error(`Step execution exceeded timeout of ${contract.timeout_ms}ms`);
        timeoutErr.code = 'ETIMEDOUT';
        reject(timeoutErr);
      }, contract.timeout_ms);
      if (typeof timer.unref === 'function') timer.unref();
    });

    result = await Promise.race([
      Promise.resolve().then(() => executorFn(state)),
      timeoutPromise,
    ]);
  } catch (err) {
    executionError = err;
  }

  const execDurationMs = Date.now() - startTime;

  if (executionError) {
    const fault = classifyTrajectoryFault(executionError);
    return {
      ok: false,
      contract_id: contract.step_id,
      role: contract.role,
      status: fault.fault_type === FAULT_TYPES.TIMEOUT_EXCEEDED ? 'FAILED_TIMEOUT' : 'FAILED_EXECUTION',
      duration_ms: execDurationMs,
      result: null,
      preconditions: preCheck,
      postconditions: null,
      fault,
      evidence_sha256: sha256Hex(stableJson({ contract_id: contract.step_id, status: 'FAILED_EXECUTION', fault })),
    };
  }

  // 3. Postconditions Barrier
  const postCheck = assertStepPostconditions(contract, result, state);
  const totalDurationMs = Date.now() - startTime;

  if (!postCheck.ok) {
    return {
      ok: false,
      contract_id: contract.step_id,
      role: contract.role,
      status: 'FAILED_POSTCONDITION',
      duration_ms: totalDurationMs,
      result,
      preconditions: preCheck,
      postconditions: postCheck,
      fault: postCheck.fault,
      evidence_sha256: sha256Hex(stableJson({ contract_id: contract.step_id, status: 'FAILED_POSTCONDITION', fault: postCheck.fault })),
    };
  }

  // All invariants satisfied
  return {
    ok: true,
    contract_id: contract.step_id,
    role: contract.role,
    status: 'PASSED',
    duration_ms: totalDurationMs,
    result,
    preconditions: preCheck,
    postconditions: postCheck,
    fault: null,
    evidence_sha256: sha256Hex(stableJson({ contract_id: contract.step_id, status: 'PASSED', result })),
  };
}

/**
 * Creates a cryptographically-bound receipt summarizing trajectory contract execution.
 */
export function createTrajectoryContractReceipt({
  trajectoryId,
  executionResults = [],
  gitBinding = null,
  metadata = {},
} = {}) {
  const steps = Array.isArray(executionResults) ? executionResults : [];
  const totalSteps = steps.length;
  const passedSteps = steps.filter((s) => s.ok).length;
  const failedSteps = steps.filter((s) => !s.ok).length;

  const orchestrationFaults = steps.filter((s) => s.fault && s.fault.fault_class === FAULT_CLASS_ORCHESTRATION).length;
  const modelLogicFaults = steps.filter((s) => s.fault && s.fault.fault_class === FAULT_CLASS_MODEL_LOGIC).length;

  const allPassed = totalSteps > 0 && passedSteps === totalSteps;
  const consistencyClass = metadata.consistency_class
    || (allPassed ? CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED : CONSISTENCY_CLASSES.SYNTHETIC_REHEARSAL);
  const consistencyBadge = CONSISTENCY_BADGES[consistencyClass] || "[SYNTHETIC_REHEARSAL]";
  const authority = CONSISTENCY_AUTHORITY_RULES[consistencyClass] || { promotion_authority: false };

  const payload = {
    schema_version: TRAJECTORY_CONTRACT_RECEIPT_SCHEMA,
    trajectory_id: String(trajectoryId || `traj_${Date.now()}`),
    timestamp: new Date().toISOString(),
    verdict: allPassed ? 'VERIFIED_PASSED' : 'REJECTED_FAILED',
    consistency_class: consistencyClass,
    consistency_badge: consistencyBadge,
    promotion_authority: authority.promotion_authority,
    metrics: {
      total_steps: totalSteps,
      passed_steps: passedSteps,
      failed_steps: failedSteps,
      orchestration_faults: orchestrationFaults,
      model_logic_faults: modelLogicFaults,
    },
    step_results: steps.map((s) => ({
      contract_id: s.contract_id,
      role: s.role,
      status: s.status,
      duration_ms: s.duration_ms,
      ok: s.ok,
      fault: s.fault ? {
        fault_class: s.fault.fault_class,
        fault_type: s.fault.fault_type,
        reason: s.fault.reason,
      } : null,
      evidence_sha256: s.evidence_sha256,
    })),
    git_binding: gitBinding || null,
    metadata: { ...metadata },
  };

  const evidenceDigest = sha256Hex(stableJson(payload));
  return Object.freeze({
    ...payload,
    receipt_sha256: evidenceDigest,
    evidence_digest: evidenceDigest,
  });
}

/**
 * Verifies the integrity of a TrajectoryContractReceipt.
 */
export function verifyTrajectoryContractReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') {
    return { ok: false, reason: 'Invalid receipt object' };
  }
  if (receipt.schema_version !== TRAJECTORY_CONTRACT_RECEIPT_SCHEMA) {
    return { ok: false, reason: `Schema mismatch: expected ${TRAJECTORY_CONTRACT_RECEIPT_SCHEMA}, got ${receipt.schema_version}` };
  }
  const { receipt_sha256, evidence_digest, ...body } = receipt;
  const recomputed = sha256Hex(stableJson(body));
  if (recomputed !== receipt_sha256) {
    return { ok: false, reason: `Hash mismatch: expected ${receipt_sha256}, got ${recomputed}` };
  }
  return { ok: true, reason: 'Cryptographic receipt digest verified' };
}

/**
 * Captures an immutable workspace snapshot at a specific step.
 */
export function captureStepSnapshot({
  stepId,
  workspaceFiles = {},
  state = {},
  contractVerdict = 'PASSED',
  metadata = {},
} = {}) {
  const normalizedFiles = {};
  for (const [relPath, content] of Object.entries(workspaceFiles)) {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    normalizedFiles[relPath] = {
      content: text,
      sha256: sha256Hex(text),
      bytes: Buffer.byteLength(text, 'utf8'),
    };
  }

  const snapshotBody = {
    schema_version: TRAJECTORY_STEP_SNAPSHOT_SCHEMA,
    step_id: String(stepId),
    contract_verdict: String(contractVerdict),
    timestamp: new Date().toISOString(),
    files: normalizedFiles,
    state: { ...state },
    metadata: { ...metadata },
  };

  const digest = sha256Hex(stableJson(snapshotBody));
  return Object.freeze({
    ...snapshotBody,
    snapshot_sha256: digest,
  });
}

/**
 * Restores or forks workspace state from a verified step snapshot.
 */
export function rehydrateStepSnapshot(snapshot, targetDir = null) {
  if (!snapshot || snapshot.schema_version !== TRAJECTORY_STEP_SNAPSHOT_SCHEMA) {
    throw new Error('Invalid step snapshot object');
  }

  const { snapshot_sha256, ...body } = snapshot;
  const recomputed = sha256Hex(stableJson(body));
  if (recomputed !== snapshot_sha256) {
    throw new Error(`Snapshot hash validation failed: expected ${snapshot_sha256}, got ${recomputed}`);
  }

  if (targetDir) {
    const resolvedDir = path.resolve(targetDir);
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }
    for (const [relPath, fileInfo] of Object.entries(snapshot.files)) {
      const fullPath = path.join(resolvedDir, relPath);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullPath, fileInfo.content, 'utf8');
    }
  }

  return {
    step_id: snapshot.step_id,
    files: snapshot.files,
    state: snapshot.state,
    verified: true,
  };
}
