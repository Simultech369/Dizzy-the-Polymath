import crypto from "node:crypto";
import { buildTensionMap, TENSION_MAP_SCHEMA } from "./tension_map_engine.mjs";
import { createA2AMessage, A2A_MESSAGE_SCHEMA } from "./a2a_mailbox_bridge.mjs";

export const SUBCOMMITTEE_VERDICT_SCHEMA = "dizzy.council_subcommittee_verdict.v1";

export const SUBCOMMITTEE_ROLES = [
  "synthesizer",
  "adversary",
  "formal_verifier",
  "anti_slop",
  "security_auditor",
  "pragmatic_implementer",
];

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

/**
 * Builds a rotating schedule assigning available model reviewers to specialized subcommittees.
 */
export function buildSubcommitteeRotationSchedule({
  cycleIndex = 0,
  availableModels = [
    "deepseek-reasoner",
    "qwen-coder",
    "gemma-27b",
    "claude-sonnet-compat",
    "cohere-command-r",
    "llama-70b-instruct",
  ],
  roles = SUBCOMMITTEE_ROLES,
} = {}) {
  if (!availableModels || availableModels.length === 0) {
    throw new Error("availableModels cannot be empty");
  }

  const assignments = {};
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    const modelIndex = (cycleIndex + i) % availableModels.length;
    assignments[role] = availableModels[modelIndex];
  }

  const scheduleHash = sha256Hex(JSON.stringify({ cycleIndex, assignments }));

  return {
    cycle_index: cycleIndex,
    assignments,
    schedule_hash: scheduleHash,
    roles_count: roles.length,
    models_count: availableModels.length,
  };
}

/**
 * Evaluates individual subcommittee findings, calculates consensus vs dialectical tension,
 * and determines if a quorum threshold is met.
 */
export function evaluateSubcommitteeFindings({
  topicId,
  findings = [],
  quorumThreshold = 0.66,
  allowMinorityDissent = true,
} = {}) {
  if (!topicId || typeof topicId !== "string") {
    throw new Error("topicId is required and must be a string");
  }

  let passVotes = 0;
  let failVotes = 0;
  const recordedOpinions = [];
  const domainAlerts = [];

  for (const finding of findings) {
    const isPass = finding.verdict === "PASS" || finding.verdict === "VERIFIED_PASSED";
    if (isPass) {
      passVotes++;
    } else {
      failVotes++;
      domainAlerts.push({
        role: finding.role,
        model: finding.model,
        reason: finding.reason || "Subcommittee evaluation flagged issues",
        severity: finding.severity || "HIGH",
      });
    }

    if (finding.dialectical_position) {
      recordedOpinions.push({
        model_id: finding.model || finding.role,
        role: finding.role,
        ...finding.dialectical_position,
      });
    }
  }

  const totalVotes = passVotes + failVotes;
  const passRatio = totalVotes > 0 ? passVotes / totalVotes : 0.0;
  const quorumMet = passRatio >= quorumThreshold;

  // Compute dialectical tension map across committee reviewers
  let tensionMetrics = null;
  if (recordedOpinions.length > 0) {
    const customPositions = {};
    for (const op of recordedOpinions) {
      customPositions[op.model_id.toLowerCase()] = {
        elegance_vs_durability: op.elegance_vs_durability,
        velocity_vs_rigor: op.velocity_vs_rigor ?? op.speed_vs_rigor ?? 0,
        sovereignty_vs_cloud: op.sovereignty_vs_cloud ?? 0,
        conservative_vs_frontier: op.conservative_vs_frontier ?? 0,
      };
    }
    const reviews = recordedOpinions.map((op) => ({
      model_id: op.model_id,
      stance: "SUBCOMMITTEE_OPINION",
    }));
    tensionMetrics = buildTensionMap({
      topicId,
      reviews,
      customPositions,
    });
  }

  const overallVerdict = quorumMet && domainAlerts.filter((a) => a.severity === "CRITICAL").length === 0
    ? "COUNCIL_PASSED"
    : "COUNCIL_REJECTED";

  const payload = {
    schema_version: SUBCOMMITTEE_VERDICT_SCHEMA,
    topic_id: topicId,
    timestamp: new Date().toISOString(),
    overall_verdict: overallVerdict,
    quorum_met: quorumMet,
    pass_ratio: Number(passRatio.toFixed(4)),
    pass_votes: passVotes,
    fail_votes: failVotes,
    total_votes: totalVotes,
    domain_alerts: domainAlerts,
    tension_metrics: tensionMetrics,
    authority: "council_subcommittee_proposes_simul_approves",
  };

  payload.verdict_hash = sha256Hex(JSON.stringify(payload));
  return payload;
}

/**
 * Encapsulates a subcommittee verdict into an authenticated A2A message packet for inter-agent distribution.
 */
export function packetizeSubcommitteeVerdict({
  verdict,
  senderId = "oss_council",
  recipientId = "codex",
} = {}) {
  if (!verdict || verdict.schema_version !== SUBCOMMITTEE_VERDICT_SCHEMA) {
    throw new Error("Invalid subcommittee verdict schema");
  }

  return createA2AMessage({
    senderId,
    recipientId,
    messageType: "council_critique",
    trustZone: "trusted_collaborator",
    payload: verdict,
  });
}
