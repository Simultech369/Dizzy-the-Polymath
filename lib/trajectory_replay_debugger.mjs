/**
 * Trajectory Replay Debugger & Comparative Divergence Engine
 *
 * Implements complete hop recording, time-travel forking, and automated
 * divergence analysis separating orchestration bugs from model-quality bugs
 * (inspired by Onhand trajectory contracts & BOAR adaptive cascading).
 *
 * Schemas:
 * - dizzy.trajectory_debug_session.v1
 * - dizzy.trajectory_diff_receipt.v1
 * - dizzy.trajectory_fork.v1
 */

import crypto from "node:crypto";

export const TRAJECTORY_DEBUG_SESSION_SCHEMA = "dizzy.trajectory_debug_session.v1";
export const TRAJECTORY_DIFF_RECEIPT_SCHEMA = "dizzy.trajectory_diff_receipt.v1";
export const TRAJECTORY_FORK_SCHEMA = "dizzy.trajectory_fork.v1";

export const DIVERGENCE_CLASSES = Object.freeze({
  PERFECT_MATCH: "PERFECT_MATCH",
  ORCHESTRATION_BUG: "ORCHESTRATION_BUG",
  MODEL_QUALITY_BUG: "MODEL_QUALITY_BUG",
  LATENCY_COST_REGRESSION: "LATENCY_COST_REGRESSION",
  UNCLASSIFIED_DIVERGENCE: "UNCLASSIFIED_DIVERGENCE",
});

function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeTokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(textA, textB) {
  const setA = new Set(normalizeTokens(textA));
  const setB = new Set(normalizeTokens(textB));
  if (!setA.size && !setB.size) return 1.0;
  if (!setA.size || !setB.size) return 0.0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  return intersection / new Set([...setA, ...setB]).size;
}

export class TrajectoryDebugSession {
  constructor(opts = {}) {
    this.sessionId = String(opts.sessionId || `session_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`);
    this.name = String(opts.name || "Default Trajectory Session");
    this.hops = [];
    this.parentSessionId = opts.parentSessionId || null;
    this.forkPoint = opts.forkPoint !== undefined ? opts.forkPoint : null;
    this.createdAt = opts.createdAt || new Date().toISOString();
  }

  recordHop(opts = {}) {
    const stepIndex = this.hops.length;
    const now = opts.now || new Date();
    const timestamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
    const hopId = `hop_${stepIndex}_${crypto.randomBytes(3).toString("hex")}`;

    const resolvedLatency = Math.max(0, Number(opts.latencyMs ?? opts.latency_ms ?? opts.metrics?.latency_ms ?? 0) || 0);
    const resolvedCost = Math.max(0, Number(opts.costUsd ?? opts.cost_usd ?? opts.metrics?.cost_usd ?? 0) || 0);
    const resolvedPromptTokens = Math.max(0, Number(opts.promptTokens ?? opts.prompt_tokens ?? opts.metrics?.prompt_tokens ?? 0) || 0);
    const resolvedCompletionTokens = Math.max(0, Number(opts.completionTokens ?? opts.completion_tokens ?? opts.metrics?.completion_tokens ?? 0) || 0);
    const resolvedConfidence = Math.max(0, Math.min(1, Number(opts.confidence ?? opts.metrics?.confidence ?? 1.0) || 1.0));

    const hopPayload = {
      step_index: stepIndex,
      hop_id: hopId,
      actor: opts.actor || "agent",
      stage: opts.stage || "step",
      tool: opts.tool ? String(opts.tool) : null,
      args: opts.args && typeof opts.args === "object" ? { ...opts.args } : opts.args,
      input: opts.input ?? null,
      output: opts.output ?? null,
      state_delta: opts.stateDelta || opts.state_delta || { bytes_changed: 0, diff_summary: "" },
      metrics: {
        latency_ms: resolvedLatency,
        cost_usd: resolvedCost,
        prompt_tokens: resolvedPromptTokens,
        completion_tokens: resolvedCompletionTokens,
        confidence: resolvedConfidence,
      },
      timestamp,
    };

    const hopHash = sha256Hex(stableJson(hopPayload));
    const sealedHop = Object.freeze({
      ...hopPayload,
      hop_hash: hopHash,
    });

    this.hops.push(sealedHop);
    return sealedHop;
  }

  forkAt(stepIndex, newSessionId = null) {
    if (stepIndex < 0 || stepIndex >= this.hops.length) {
      throw new Error(`Invalid fork stepIndex: ${stepIndex}. Trajectory has ${this.hops.length} hop(s).`);
    }

    const forkedSession = new TrajectoryDebugSession({
      sessionId: newSessionId || `${this.sessionId}_fork_at_${stepIndex}`,
      name: `Fork of ${this.name} at step ${stepIndex}`,
      parentSessionId: this.sessionId,
      forkPoint: stepIndex,
    });

    // Copy historical hops up to stepIndex (inclusive)
    for (let i = 0; i <= stepIndex; i++) {
      forkedSession.hops.push({ ...this.hops[i] });
    }

    return forkedSession;
  }

  getSnapshot() {
    const totalLatency = this.hops.reduce((acc, h) => acc + h.metrics.latency_ms, 0);
    const totalCost = this.hops.reduce((acc, h) => acc + h.metrics.cost_usd, 0);
    const totalTokens = this.hops.reduce((acc, h) => acc + h.metrics.prompt_tokens + h.metrics.completion_tokens, 0);

    const snapshotPayload = {
      schema_version: TRAJECTORY_DEBUG_SESSION_SCHEMA,
      session_id: this.sessionId,
      name: this.name,
      parent_session_id: this.parentSessionId,
      fork_point: this.forkPoint,
      hop_count: this.hops.length,
      totals: {
        latency_ms: totalLatency,
        cost_usd: Math.round(totalCost * 1e6) / 1e6,
        tokens: totalTokens,
      },
      hops: this.hops,
    };

    return Object.freeze({
      ...snapshotPayload,
      session_sha256: sha256Hex(stableJson(snapshotPayload)),
    });
  }
}

/**
 * Compares a candidate trajectory against a golden reference trajectory.
 * Disambiguates between Orchestration Bugs (tool/arg sequence divergence)
 * and Model Quality Bugs (semantic drift in outputs).
 */
export function compareTrajectories(goldenTrajectory, candidateTrajectory, opts = {}) {
  const goldenHops = Array.isArray(goldenTrajectory) ? goldenTrajectory : (goldenTrajectory?.hops || []);
  const candidateHops = Array.isArray(candidateTrajectory) ? candidateTrajectory : (candidateTrajectory?.hops || []);
  const semanticThreshold = Number.isFinite(opts.semanticThreshold) ? opts.semanticThreshold : 0.70;
  const costRegressionTolerance = Number.isFinite(opts.costRegressionTolerance) ? opts.costRegressionTolerance : 1.50; // +50%

  const divergences = [];
  let primaryClass = DIVERGENCE_CLASSES.PERFECT_MATCH;
  const minLength = Math.min(goldenHops.length, candidateHops.length);

  for (let i = 0; i < minLength; i++) {
    const gHop = goldenHops[i];
    const cHop = candidateHops[i];

    // Check 1: Tool mismatch (Orchestration Bug)
    if (gHop.tool !== cHop.tool) {
      divergences.push({
        step_index: i,
        type: "TOOL_MISMATCH",
        classification: DIVERGENCE_CLASSES.ORCHESTRATION_BUG,
        expected: gHop.tool,
        actual: cHop.tool,
        detail: `Expected tool '${gHop.tool}', got '${cHop.tool}' at hop ${i}`,
      });
      if (primaryClass === DIVERGENCE_CLASSES.PERFECT_MATCH) {
        primaryClass = DIVERGENCE_CLASSES.ORCHESTRATION_BUG;
      }
      continue;
    }

    // Check 2: Tool argument mismatch (Orchestration Bug)
    if (gHop.tool && cHop.tool) {
      const gArgsHash = sha256Hex(stableJson(gHop.args || {}));
      const cArgsHash = sha256Hex(stableJson(cHop.args || {}));
      if (gArgsHash !== cArgsHash) {
        divergences.push({
          step_index: i,
          type: "TOOL_ARGS_MISMATCH",
          classification: DIVERGENCE_CLASSES.ORCHESTRATION_BUG,
          expected_args: gHop.args,
          actual_args: cHop.args,
          detail: `Arguments diverged for tool '${gHop.tool}' at hop ${i}`,
        });
        if (primaryClass === DIVERGENCE_CLASSES.PERFECT_MATCH) {
          primaryClass = DIVERGENCE_CLASSES.ORCHESTRATION_BUG;
        }
        continue;
      }
    }

    // Check 3: Semantic output similarity (Model Quality Bug)
    if (gHop.output && cHop.output) {
      const similarity = jaccardSimilarity(gHop.output, cHop.output);
      if (similarity < semanticThreshold) {
        divergences.push({
          step_index: i,
          type: "SEMANTIC_OUTPUT_DRIFT",
          classification: DIVERGENCE_CLASSES.MODEL_QUALITY_BUG,
          similarity: Math.round(similarity * 1000) / 1000,
          threshold: semanticThreshold,
          detail: `Output similarity (${similarity.toFixed(2)}) fell below threshold (${semanticThreshold}) at hop ${i}`,
        });
        if (primaryClass === DIVERGENCE_CLASSES.PERFECT_MATCH) {
          primaryClass = DIVERGENCE_CLASSES.MODEL_QUALITY_BUG;
        }
      }
    }
  }

  // Check 4: Hop count mismatch
  if (goldenHops.length !== candidateHops.length) {
    divergences.push({
      step_index: minLength,
      type: goldenHops.length > candidateHops.length ? "PREMATURE_TERMINATION" : "EXTRANEOUS_STEPS",
      classification: DIVERGENCE_CLASSES.ORCHESTRATION_BUG,
      expected_hops: goldenHops.length,
      actual_hops: candidateHops.length,
      detail: `Hop count mismatch: expected ${goldenHops.length}, got ${candidateHops.length}`,
    });
    if (primaryClass === DIVERGENCE_CLASSES.PERFECT_MATCH) {
      primaryClass = DIVERGENCE_CLASSES.ORCHESTRATION_BUG;
    }
  }

  // Check 5: Cost / Latency Regression
  const goldenCost = goldenHops.reduce((acc, h) => acc + (h.metrics?.cost_usd || 0), 0);
  const candidateCost = candidateHops.reduce((acc, h) => acc + (h.metrics?.cost_usd || 0), 0);

  if (goldenCost > 0 && candidateCost > goldenCost * costRegressionTolerance) {
    divergences.push({
      step_index: -1,
      type: "COST_REGRESSION",
      classification: DIVERGENCE_CLASSES.LATENCY_COST_REGRESSION,
      expected_cost: goldenCost,
      actual_cost: candidateCost,
      ratio: Math.round((candidateCost / goldenCost) * 100) / 100,
      detail: `Candidate cost ($${candidateCost.toFixed(4)}) exceeded golden baseline ($${goldenCost.toFixed(4)}) by >${Math.round((costRegressionTolerance - 1) * 100)}%`,
    });
    if (primaryClass === DIVERGENCE_CLASSES.PERFECT_MATCH) {
      primaryClass = DIVERGENCE_CLASSES.LATENCY_COST_REGRESSION;
    }
  }

  const receiptPayload = {
    schema_version: TRAJECTORY_DIFF_RECEIPT_SCHEMA,
    timestamp: new Date().toISOString(),
    primary_classification: primaryClass,
    divergence_count: divergences.length,
    golden_hop_count: goldenHops.length,
    candidate_hop_count: candidateHops.length,
    divergences,
  };

  const receiptSha256 = sha256Hex(stableJson(receiptPayload));

  return Object.freeze({
    ...receiptPayload,
    receipt_sha256: receiptSha256,
  });
}
