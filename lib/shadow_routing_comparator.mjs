/**
 * Shadow Routing Comparator & Offline Evaluation Engine
 *
 * Implements deterministic routing comparison between active and shadow candidate routes:
 * - Compares tier selection, model choice, cost, and latency projections
 * - Categorizes route divergence: EQUIVALENT, OPTIMIZATION_CANDIDATE, REGRESSION_RISK, ESCALATION_CANDIDATE
 * - Runs batch evaluation over golden evaluation queries with pass/fail gates
 * - Emits cryptographic ShadowRoutingComparatorReceipts
 *
 * Schema: dizzy.shadow_routing_comparator_receipt.v1
 * Authority: Safe qualification before route policy promotion.
 */

import crypto from "node:crypto";
import {
  TIER_ORDER,
  TIER_ESTIMATED_COST_PER_1K,
  TIER_BASELINE_LATENCY_MS,
} from "./routing_policy.mjs";

export const SHADOW_ROUTING_COMPARATOR_RECEIPT_SCHEMA = "dizzy.shadow_routing_comparator_receipt.v1";

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

export class ShadowRoutingComparator {
  constructor(opts = {}) {
    this.minConfidenceThreshold = opts.minConfidenceThreshold ?? 0.80;
    this.now = opts.now || (() => new Date());
  }

  /**
   * Compares a single routing decision between primary and candidate.
   *
   * @param {Object} params
   * @param {string} params.queryId
   * @param {Object} params.primaryRoute - { tier, model, estimatedCostUsd, estimatedLatencyMs, confidence }
   * @param {Object} params.candidateRoute - { tier, model, estimatedCostUsd, estimatedLatencyMs, confidence }
   * @returns {Object} Comparison report
   */
  compareSingle({ queryId, primaryRoute, candidateRoute }) {
    const pTier = primaryRoute.tier || "T2";
    const cTier = candidateRoute.tier || "T2";

    const pTierIdx = TIER_ORDER.indexOf(pTier);
    const cTierIdx = TIER_ORDER.indexOf(cTier);
    const tierDelta = cTierIdx - pTierIdx; // negative means candidate is lower tier (cheaper)

    const pCost = Number(primaryRoute.estimatedCostUsd ?? TIER_ESTIMATED_COST_PER_1K[pTier] ?? 0);
    const cCost = Number(candidateRoute.estimatedCostUsd ?? TIER_ESTIMATED_COST_PER_1K[cTier] ?? 0);
    const costDeltaUsd = cCost - pCost;

    const pLat = Number(primaryRoute.estimatedLatencyMs ?? TIER_BASELINE_LATENCY_MS[pTier] ?? 0);
    const cLat = Number(candidateRoute.estimatedLatencyMs ?? TIER_BASELINE_LATENCY_MS[cTier] ?? 0);
    const latencyDeltaMs = cLat - pLat;

    const pConf = Number(primaryRoute.confidence ?? 1.0);
    const cConf = Number(candidateRoute.confidence ?? 1.0);
    const confidenceDelta = cConf - pConf;

    const sameModel = primaryRoute.model === candidateRoute.model;
    const sameTier = pTier === cTier;

    let classification = "EQUIVALENT";
    let regressionDetected = false;

    if (sameModel && sameTier) {
      classification = "EQUIVALENT";
    } else if (tierDelta < 0) {
      // Candidate selected cheaper tier
      if (cConf >= this.minConfidenceThreshold) {
        classification = "OPTIMIZATION_CANDIDATE";
      } else {
        classification = "REGRESSION_RISK";
        regressionDetected = true;
      }
    } else if (tierDelta > 0) {
      // Candidate selected higher tier
      if (primaryRoute.requiresEscalation || candidateRoute.requiresEscalation) {
        classification = "ESCALATION_CANDIDATE";
      } else {
        classification = "REGRESSION_RISK";
        regressionDetected = true; // unnecessary cost inflation
      }
    } else {
      // Same tier, different model
      classification = sameModel ? "EQUIVALENT" : "ALTERNATIVE_MODEL_CHOICE";
    }

    return {
      query_id: queryId,
      same_tier: sameTier,
      same_model: sameModel,
      primary: { tier: pTier, model: primaryRoute.model, cost_usd: pCost, latency_ms: pLat, confidence: pConf },
      candidate: { tier: cTier, model: candidateRoute.model, cost_usd: cCost, latency_ms: cLat, confidence: cConf },
      deltas: {
        tier_delta: tierDelta,
        cost_delta_usd: Math.round(costDeltaUsd * 1e6) / 1e6,
        latency_delta_ms: latencyDeltaMs,
        confidence_delta: Math.round(confidenceDelta * 1e4) / 1e4,
      },
      classification,
      regression_detected: regressionDetected,
    };
  }

  /**
   * Compares an entire batch of queries and produces a sealed comparison receipt.
   *
   * @param {Object} params
   * @param {string} [params.benchmarkId]
   * @param {Array<Object>} params.evalSet - Array of { queryId, primaryRoute, candidateRoute }
   * @returns {Object} Comprehensive evaluation receipt
   */
  evaluateBatch({ benchmarkId = null, evalSet = [] } = {}) {
    const id = benchmarkId || `bench_${crypto.randomUUID().slice(0, 8)}`;
    const timestampIso = (this.now)().toISOString();

    const comparisons = evalSet.map((item) => this.compareSingle(item));

    const total = comparisons.length;
    let concordantCount = 0;
    let optimizationCount = 0;
    let regressionCount = 0;
    let escalationCount = 0;
    let totalPrimaryCost = 0;
    let totalCandidateCost = 0;

    for (const c of comparisons) {
      if (c.same_tier) concordantCount++;
      if (c.classification === "OPTIMIZATION_CANDIDATE") optimizationCount++;
      if (c.regression_detected) regressionCount++;
      if (c.classification === "ESCALATION_CANDIDATE") escalationCount++;
      totalPrimaryCost += c.primary.cost_usd;
      totalCandidateCost += c.candidate.cost_usd;
    }

    const concordanceRate = total > 0 ? Math.round((concordantCount / total) * 1e4) / 1e4 : 1.0;
    const netCostDeltaUsd = Math.round((totalCandidateCost - totalPrimaryCost) * 1e6) / 1e6;
    const costSavingsPct = totalPrimaryCost > 0
      ? Math.round(((totalPrimaryCost - totalCandidateCost) / totalPrimaryCost) * 1e4) / 1e2
      : 0;

    let verdict = "REJECT";
    if (regressionCount === 0 && concordanceRate >= 0.85) {
      verdict = "PROMOTE";
    } else if (regressionCount <= 1 && optimizationCount > 0) {
      verdict = "NEEDS_HITL_REVIEW";
    }

    const receiptPayload = {
      schema_version: SHADOW_ROUTING_COMPARATOR_RECEIPT_SCHEMA,
      benchmark_id: id,
      timestamp: timestampIso,
      verdict,
      total_queries: total,
      concordant_queries: concordantCount,
      concordance_rate: concordanceRate,
      optimizations_count: optimizationCount,
      regressions_count: regressionCount,
      escalations_count: escalationCount,
      total_primary_cost_usd: Math.round(totalPrimaryCost * 1e6) / 1e6,
      total_candidate_cost_usd: Math.round(totalCandidateCost * 1e6) / 1e6,
      net_cost_delta_usd: netCostDeltaUsd,
      cost_savings_pct: costSavingsPct,
      comparisons_digest: sha256Hex(stableJson(comparisons)),
    };

    const evidenceSha256 = sha256Hex(stableJson(receiptPayload));
    const receipt = Object.freeze({
      ...receiptPayload,
      evidence_sha256: evidenceSha256,
    });

    return {
      ok: verdict === "PROMOTE",
      verdict,
      receipt,
      comparisons,
    };
  }
}

export function verifyShadowRoutingComparatorReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") return false;
  if (receipt.schema_version !== SHADOW_ROUTING_COMPARATOR_RECEIPT_SCHEMA) return false;
  const { evidence_sha256, ...payload } = receipt;
  if (!evidence_sha256) return false;
  const expectedHash = sha256Hex(stableJson(payload));
  return evidence_sha256 === expectedHash;
}
