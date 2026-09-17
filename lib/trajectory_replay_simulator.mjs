import crypto from "node:crypto";

export const TRAJECTORY_REPLAY_SCHEMA = "dizzy.trajectory_replay.v1";

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",");
  return `{${body}}`;
}

function hashToolInvocation(toolName, toolArgs) {
  const norm = `${String(toolName || "").trim()}:${stableStringify(toolArgs || {})}`;
  return crypto.createHash("sha256").update(norm, "utf8").digest("hex");
}

/**
 * TrajectoryReplaySimulator
 * 
 * Provides an offline, deterministic virtual environment replay buffer
 * derived from historical golden trajectories (Dream-RSI pattern).
 * Evaluates candidate prompt packs and routing policies without executing live side effects.
 */
export class TrajectoryReplaySimulator {
  constructor(trajectory, opts = {}) {
    this.id = trajectory?.id || "anonymous-trajectory";
    const rawSteps = Array.isArray(trajectory) ? trajectory : trajectory?.steps || [];
    
    // Filter only tool-invocation steps for environmental replay
    this.toolSteps = rawSteps
      .filter((step) => step.tool || step.actor === "agent" && step.tool)
      .map((step, idx) => ({
        index: idx,
        tool: step.tool,
        args: step.args || {},
        invocationHash: hashToolInvocation(step.tool, step.args || {}),
        result: step.result !== undefined ? step.result : step.content || "",
        status: step.status || "success",
        error: step.error || null,
      }));

    this.cursor = 0;
    this.diverged = false;
    this.divergenceDetails = null;
    this.replayedHistory = [];
    this.strictOrder = opts.strictOrder !== false;
  }

  /**
   * Attempts to execute a simulated tool call against the replay buffer.
   */
  executeTool(toolName, toolArgs = {}) {
    if (this.diverged) {
      return {
        ok: false,
        cached: false,
        diverged: true,
        error: "Replay has already diverged from golden trajectory",
      };
    }

    if (this.cursor >= this.toolSteps.length) {
      this.diverged = true;
      this.divergenceDetails = {
        point: this.cursor,
        reason: "trajectory_exhausted",
        actual_tool: toolName,
        actual_args: toolArgs,
      };
      return {
        ok: false,
        cached: false,
        diverged: true,
        error: "Candidate attempted additional tool calls beyond golden trajectory",
      };
    }

    const expected = this.toolSteps[this.cursor];
    const actualHash = hashToolInvocation(toolName, toolArgs);

    if (expected.invocationHash !== actualHash) {
      this.diverged = true;
      this.divergenceDetails = {
        point: this.cursor,
        reason: expected.tool !== toolName ? "tool_mismatch" : "args_mismatch",
        expected_tool: expected.tool,
        expected_args: expected.args,
        actual_tool: toolName,
        actual_args: toolArgs,
      };
      return {
        ok: false,
        cached: false,
        diverged: true,
        error: `Replay divergence at step ${this.cursor}: expected ${expected.tool}, got ${toolName}`,
      };
    }

    // Step matched golden replay
    this.cursor += 1;
    this.replayedHistory.push({
      step: this.cursor - 1,
      tool: toolName,
      status: expected.status,
    });

    return {
      ok: true,
      cached: true,
      diverged: false,
      step_index: this.cursor - 1,
      status: expected.status,
      result: expected.result,
      error: expected.error,
    };
  }

  /**
   * Generates a verifiable execution receipt for the replay run.
   */
  emitReceipt(now = () => new Date()) {
    const totalExpected = this.toolSteps.length;
    let status = "MATCHED";
    if (this.diverged) {
      status = "DIVERGED";
    } else if (this.cursor < totalExpected) {
      status = "INCOMPLETE";
    }

    return {
      schema_version: TRAJECTORY_REPLAY_SCHEMA,
      timestamp: now().toISOString(),
      trajectory_id: this.id,
      status,
      total_expected_tool_steps: totalExpected,
      steps_replayed: this.cursor,
      is_fully_matched: status === "MATCHED",
      divergence: this.divergenceDetails,
      history: this.replayedHistory,
    };
  }
}
