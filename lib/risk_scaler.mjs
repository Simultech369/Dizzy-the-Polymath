import { VALID_DATA_BOUNDARIES } from "./model_router.mjs";

/**
 * W-0067: Risk-Tiered Inference Compute Scaler
 * Mechanically scales inference-time compute (multi-candidate rollouts,
 * adversarial pre-mortems, hard execution gates) based on tool action risk levels.
 */

export const ACTION_RISK_LEVELS = Object.freeze({
  LEVEL_1: "Level 1 - Local Analysis",
  LEVEL_2: "Level 2 - External Queries",
  LEVEL_3: "Level 3 - Economic Actions",
  LEVEL_4: "Level 4 - Irreversible Actions",
});

/**
 * Classifies an incoming tool or execution request into a risk level.
 */
export function classifyActionRisk(actionName = "", opts = {}) {
  const name = String(actionName || "").trim().toLowerCase();
  const isPublicOrExternal = Boolean(opts.isPublic || opts.externalService);
  const isDestructive = Boolean(opts.destructive || name.includes("delete") || name.includes("push") || name.includes("commit") || name.includes("deploy"));

  if (isDestructive || opts.riskLevel === 4 || opts.riskLevel === "Level 4") {
    return ACTION_RISK_LEVELS.LEVEL_4;
  }
  if (opts.economic || name.includes("trade") || name.includes("spend") || opts.riskLevel === 3 || opts.riskLevel === "Level 3") {
    return ACTION_RISK_LEVELS.LEVEL_3;
  }
  if (isPublicOrExternal || opts.riskLevel === 2 || opts.riskLevel === "Level 2") {
    return ACTION_RISK_LEVELS.LEVEL_2;
  }
  return ACTION_RISK_LEVELS.LEVEL_1;
}

/**
 * Calculates inference scaling parameters for a given risk level.
 */
export function evaluateRiskScaling(riskLevel) {
  switch (riskLevel) {
    case ACTION_RISK_LEVELS.LEVEL_4:
      return {
        riskLevel,
        rolloutCount: 3,
        preMortemRequired: true,
        hardGateRequired: true,
        consensusQuorumRequired: true,
        reasoningStrategy: "tri_candidate_adversarial_rollout",
      };

    case ACTION_RISK_LEVELS.LEVEL_3:
      return {
        riskLevel,
        rolloutCount: 2,
        preMortemRequired: true,
        hardGateRequired: false,
        consensusQuorumRequired: false,
        reasoningStrategy: "dual_candidate_pre_mortem",
      };

    case ACTION_RISK_LEVELS.LEVEL_2:
      return {
        riskLevel,
        rolloutCount: 1,
        preMortemRequired: false,
        hardGateRequired: false,
        consensusQuorumRequired: false,
        reasoningStrategy: "monitored_single_pass",
      };

    case ACTION_RISK_LEVELS.LEVEL_1:
    default:
      return {
        riskLevel: ACTION_RISK_LEVELS.LEVEL_1,
        rolloutCount: 1,
        preMortemRequired: false,
        hardGateRequired: false,
        consensusQuorumRequired: false,
        reasoningStrategy: "fast_path_single_pass",
      };
  }
}

/**
 * Generates a risk scaling receipt to bind to capability receipts.
 */
export function buildRiskScalingReceipt(actionName, opts = {}) {
  const riskLevel = classifyActionRisk(actionName, opts);
  const scaling = evaluateRiskScaling(riskLevel);

  return {
    schema: "dizzy.risk_scaling_receipt.v1",
    actionName: String(actionName || "unknown"),
    riskLevel: scaling.riskLevel,
    strategy: scaling.reasoningStrategy,
    rollouts: scaling.rolloutCount,
    preMortemRequired: scaling.preMortemRequired,
    hardGateRequired: scaling.hardGateRequired,
    consensusQuorumRequired: scaling.consensusQuorumRequired,
    timestamp: new Date().toISOString(),
  };
}
