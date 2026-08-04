import assert from "assert";
import { ACTION_RISK_LEVELS, buildRiskScalingReceipt, classifyActionRisk, evaluateRiskScaling } from "../lib/risk_scaler.mjs";

console.log("=== W-0067 Risk-Tiered Compute Scaler Test Suite ===");

// Test 1: Classification
assert.equal(classifyActionRisk("view_file"), ACTION_RISK_LEVELS.LEVEL_1);
assert.equal(classifyActionRisk("http_get", { externalService: true }), ACTION_RISK_LEVELS.LEVEL_2);
assert.equal(classifyActionRisk("trade_execution", { economic: true }), ACTION_RISK_LEVELS.LEVEL_3);
assert.equal(classifyActionRisk("git_push", { destructive: true }), ACTION_RISK_LEVELS.LEVEL_4);
console.log("-> Classification checks passed");

// Test 2: Scaling rules
const level1Scaling = evaluateRiskScaling(ACTION_RISK_LEVELS.LEVEL_1);
assert.equal(level1Scaling.rolloutCount, 1);
assert.equal(level1Scaling.preMortemRequired, false);

const level4Scaling = evaluateRiskScaling(ACTION_RISK_LEVELS.LEVEL_4);
assert.equal(level4Scaling.rolloutCount, 3);
assert.equal(level4Scaling.preMortemRequired, true);
assert.equal(level4Scaling.hardGateRequired, true);
assert.equal(level4Scaling.consensusQuorumRequired, true);
console.log("-> Scaling rules evaluation passed");

// Test 3: Receipt construction
const receipt = buildRiskScalingReceipt("git_push", { destructive: true });
assert.equal(receipt.schema, "dizzy.risk_scaling_receipt.v1");
assert.equal(receipt.riskLevel, ACTION_RISK_LEVELS.LEVEL_4);
assert.equal(receipt.rollouts, 3);
assert.equal(receipt.preMortemRequired, true);
assert.equal(receipt.hardGateRequired, true);
console.log("-> Risk scaling receipt construction passed");

console.log("\nRISK_SCALER_TESTS_OK");
