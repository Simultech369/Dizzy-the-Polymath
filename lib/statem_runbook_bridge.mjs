import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const STATEM_RUNBOOK_RECEIPT_SCHEMA = "dizzy.statem_runbook_bridge.v1";
export const STATEM_RUNBOOK_EXECUTION_SCHEMA = "dizzy.statem_runbook_execution.v1";

export const REQUIRED_NODES = Object.freeze(["plan", "execute", "verify", "handoff"]);
export const REQUIRED_EDGES = Object.freeze([
  ["plan", "execute"],
  ["execute", "verify"],
  ["verify", "execute"],
  ["verify", "handoff"],
]);

export const DEFAULT_VERIFICATION_COMMAND = "npm run check:next && npm run check:docs";
export const ALLOWED_VERIFICATION_COMMANDS = Object.freeze([
  "npm test",
  "npm run check:next",
  "npm run check:docs",
  "npm run check:staging-boundary",
  "npm run test:safety",
  "npm run test:statem-runbook",
  "npm run test:streaming-response",
  "npm run test:bounty-hunter",
]);

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

function normalizeVerificationCommand(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function parseVerificationCommandPlan(verificationCommand = DEFAULT_VERIFICATION_COMMAND) {
  const text = String(verificationCommand ?? "").trim();
  if (!text) return [];
  const commands = text
    .split(/\s*(?:&&|;)\s*/g)
    .map(normalizeVerificationCommand)
    .filter(Boolean);

  if (commands.length > 6) {
    throw new Error("StateM verification command plan exceeds the maximum of 6 steps");
  }

  return commands.map((commandText) => {
    if (!ALLOWED_VERIFICATION_COMMANDS.includes(commandText)) {
      throw new Error(`Unsupported StateM verification command: ${commandText}`);
    }
    const parts = commandText.split(" ");
    const args = parts[1] === "test" ? ["test"] : ["run", parts[2]];
    return {
      label: commandText,
      command: npmCommand(),
      args,
    };
  });
}

function runVerificationCommandPlan(verificationCommand) {
  const steps = parseVerificationCommandPlan(verificationCommand);
  if (steps.length === 0) return { ok: true, exitCode: 0, stdout: "", stderr: "", steps: [] };

  const receipts = [];
  for (const step of steps) {
    const startedAt = Date.now();
    const isWin = process.platform === "win32";
    const command = isWin ? (process.env.ComSpec || "cmd.exe") : step.command;
    const args = isWin ? ["/d", "/s", "/c", `${step.command} ${step.args.join(" ")}`] : step.args;
    const cmdResult = spawnSync(command, args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180_000,
      windowsHide: true,
    });
    const receipt = {
      label: step.label,
      exitCode: cmdResult.status,
      signal: cmdResult.signal || null,
      duration_ms: Math.max(0, Date.now() - startedAt),
      stdout_tail: String(cmdResult.stdout || "").slice(-1000),
      stderr_tail: String(cmdResult.stderr || "").slice(-1000),
    };
    receipts.push(receipt);
    if (cmdResult.error || cmdResult.status !== 0) {
      return {
        ok: false,
        exitCode: cmdResult.status ?? 1,
        stdout: receipt.stdout_tail,
        stderr: receipt.stderr_tail || String(cmdResult.error?.message || ""),
        steps: receipts,
      };
    }
  }

  const last = receipts[receipts.length - 1] || {};
  return {
    ok: true,
    exitCode: 0,
    stdout: last.stdout_tail || "",
    stderr: last.stderr_tail || "",
    steps: receipts,
  };
}

/**
 * Validates the structure and tokens of a StateM-compatible runbook YAML.
 */
export function validateRunbookYaml(runbookYaml) {
  const text = String(runbookYaml || "");
  const missing = [];

  for (const token of ["name:", "initial: plan", "nodes:", "edges:", "before_transfer:"]) {
    if (!text.includes(token)) missing.push(token);
  }
  for (const node of REQUIRED_NODES) {
    if (!text.includes(`  ${node}:`)) missing.push(`node:${node}`);
  }
  for (const [source, target] of REQUIRED_EDGES) {
    if (!text.includes(`from: ${source}`) || !text.includes(`to: ${target}`)) {
      missing.push(`edge:${source}->${target}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`StateM runbook missing required structure: ${missing.join(", ")}`);
  }
  return true;
}

/**
 * Exports a StateM-compatible 4-phase runbook without external dependencies.
 */
export function exportStateMRunbook({
  name = "dizzy-agent-implementation-loop",
  verificationCommand = DEFAULT_VERIFICATION_COMMAND,
  customPrompts = {},
} = {}) {
  parseVerificationCommandPlan(verificationCommand);
  const planPrompt = customPrompts.plan || "Read the objective, inspect the live repository state, and record exact verification steps.";
  const executePrompt = customPrompts.execute || "Implement the scoped change using deterministic lifecycle hooks around real effects.";
  const verifyPrompt = customPrompts.verify || "Run deterministic verification and repair any fixable failure before handoff.";
  const handoffPrompt = customPrompts.handoff || "Summarize changed files, verification receipts, counts, and remaining risks.";

  const yaml = [
    `name: ${name}`,
    `initial: plan`,
    ``,
    `nodes:`,
    `  plan:`,
    `    prompt: |`,
    `      ${planPrompt}`,
    `    before_transfer:`,
    `      type: checklist`,
    `      items:`,
    `        - Scope and constraints are recorded`,
    `        - Verification steps are defined`,
    ``,
    `  execute:`,
    `    prompt: |`,
    `      ${executePrompt}`,
    `    before_transfer:`,
    `      - type: checklist`,
    `        items:`,
    `          - File changes are limited to the current objective`,
    `          - Hook receipts exist for real tool or sandbox effects`,
    ``,
    `  verify:`,
    `    prompt: |`,
    `      ${verifyPrompt}`,
    `    before_transfer:`,
    `      - type: command`,
    `        run: '${verificationCommand.replace(/'/g, "''")}'`,
    `      - type: checklist`,
    `        items:`,
    `          - Relevant focused tests pass`,
    `          - Full discovery suite pass state is known`,
    ``,
    `  handoff:`,
    `    prompt: |`,
    `      ${handoffPrompt}`,
    ``,
    `edges:`,
    `  - from: plan`,
    `    to: execute`,
    `    condition: The plan is ready and bounded.`,
    `  - from: execute`,
    `    to: verify`,
    `    condition: The implementation is ready for deterministic checks.`,
    `  - from: verify`,
    `    to: execute`,
    `    condition: Verification found a fixable gap.`,
    `  - from: verify`,
    `    to: handoff`,
    `    condition: Implementation and verification are complete.`,
    ``,
  ].join("\n");

  validateRunbookYaml(yaml);
  const runbookSha256 = sha256Hex(yaml);

  const receipt = {
    schema_version: STATEM_RUNBOOK_RECEIPT_SCHEMA,
    runbook_name: name,
    runbook_sha256: runbookSha256,
    initial_state: "plan",
    node_count: REQUIRED_NODES.length,
    edge_count: REQUIRED_EDGES.length,
    verification_command: verificationCommand,
    lifecycle_hooked: true,
    exported_at: new Date().toISOString(),
  };

  return { yaml, receipt };
}

/**
 * Executes a 4-phase finite state machine runbook with deterministic verification barriers.
 */
export async function executeStateMFsm({
  runbookName = "dizzy-agent-task",
  verificationCommand = DEFAULT_VERIFICATION_COMMAND,
  planHandler,
  executeHandler,
  verifyHandler,
  handoffHandler,
  maxVerificationRetries = 3,
  now = () => new Date(),
} = {}) {
  const startedAt = now().toISOString();
  const transitions = [];
  let currentState = "plan";
  let verificationAttempts = 0;
  let verificationPassed = false;
  let executionSuccess = false;
  let error = null;

  try {
    // 1. Phase: PLAN
    transitions.push({ from: "START", to: "plan", timestamp: now().toISOString() });
    const planResult = planHandler ? await planHandler() : { ok: true };
    if (planResult && planResult.ok === false) {
      throw new Error(`Plan phase failed: ${planResult.error || "plan rejected"}`);
    }

    // 2. Loop: EXECUTE <-> VERIFY
    transitions.push({ from: "plan", to: "execute", timestamp: now().toISOString() });
    currentState = "execute";

    while (verificationAttempts < maxVerificationRetries) {
      // Execute phase
      const execResult = executeHandler ? await executeHandler({ attempt: verificationAttempts + 1 }) : { ok: true };
      if (execResult && execResult.ok === false) {
        throw new Error(`Execute phase failed: ${execResult.error || "execution error"}`);
      }

      // Transition to verify
      transitions.push({ from: currentState, to: "verify", timestamp: now().toISOString() });
      currentState = "verify";
      verificationAttempts++;

      let verifyResult;
      if (verifyHandler) {
        verifyResult = await verifyHandler({ attempt: verificationAttempts });
      } else if (verificationCommand) {
        verifyResult = runVerificationCommandPlan(verificationCommand);
      } else {
        verifyResult = { ok: true };
      }

      if (verifyResult.ok) {
        verificationPassed = true;
        break;
      } else {
        if (verificationAttempts < maxVerificationRetries) {
          transitions.push({
            from: "verify",
            to: "execute",
            reason: `Verification attempt ${verificationAttempts} failed`,
            timestamp: now().toISOString(),
          });
          currentState = "execute";
        }
      }
    }

    if (!verificationPassed) {
      throw new Error(`Verification barrier failed after ${verificationAttempts} attempts`);
    }

    // 3. Phase: HANDOFF (Hard barrier: only reachable if verificationPassed is true)
    transitions.push({ from: "verify", to: "handoff", timestamp: now().toISOString() });
    currentState = "handoff";

    const handoffResult = handoffHandler ? await handoffHandler({ verificationAttempts }) : { ok: true };
    if (handoffResult && handoffResult.ok === false) {
      throw new Error(`Handoff phase failed: ${handoffResult.error || "handoff error"}`);
    }

    transitions.push({ from: "handoff", to: "COMPLETED", timestamp: now().toISOString() });
    currentState = "COMPLETED";
    executionSuccess = true;
  } catch (err) {
    error = err.message;
    transitions.push({ from: currentState, to: "FAILED", error: err.message, timestamp: now().toISOString() });
    currentState = "FAILED";
  }

  const completedAt = now().toISOString();
  const executionReceipt = {
    schema_version: STATEM_RUNBOOK_EXECUTION_SCHEMA,
    runbook_name: runbookName,
    status: executionSuccess ? "PASSED" : "FAILED",
    initial_state: "plan",
    terminal_state: currentState,
    verification_passed: verificationPassed,
    verification_attempts: verificationAttempts,
    transitions_count: transitions.length,
    transitions,
    error: error || null,
    started_at: startedAt,
    completed_at: completedAt,
  };

  return {
    ok: executionSuccess,
    receipt: executionReceipt,
  };
}
