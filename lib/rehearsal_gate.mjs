import fs from "fs";
import path from "path";

/**
 * W-0075: Rehearsal Gate & Focused Outcome Memory
 * Compares candidate implementation plans against historical outcome memory
 * (RCAs, eval drops, harness failures) to rank candidates and issue a recommendation receipt.
 *
 * Enforces strict boundary:
 *   authority: "automation_recommends_simul_approves"
 *   operator_required: true
 */

export const REHEARSAL_SCHEMA = "dizzy.rehearsal_receipt.v1";
export const REHEARSAL_AUTHORITY = "automation_recommends_simul_approves";

/**
 * Matches a candidate plan against a historical outcome memory record.
 * Returns match relevance score (0 to 1) and match reasons.
 */
export function matchOutcomeMemory(candidate = {}, outcome = {}) {
  const cComponents = new Set((candidate.targetComponents || candidate.target_components || []).map((x) => String(x).toLowerCase()));
  const oComponents = (outcome.targetComponents || outcome.target_components || outcome.components || []).map((x) => String(x).toLowerCase());

  const cRisk = String(candidate.riskLevel || candidate.risk_level || "").toLowerCase();
  const oRisk = String(outcome.riskLevel || outcome.risk_level || "").toLowerCase();

  const cKeywords = (candidate.keywords || candidate.changes || []).map((x) => String(x).toLowerCase());
  const oKeywordsList = Array.isArray(outcome.keywords)
    ? outcome.keywords.map((x) => String(x).toLowerCase())
    : [String(outcome.keywords || outcome.rootCause || outcome.root_cause || "").toLowerCase()];

  let componentOverlap = 0;
  for (const comp of oComponents) {
    if (cComponents.has(comp)) componentOverlap += 1;
  }

  const hasComponentMatch = componentOverlap > 0;
  const hasRiskMatch = Boolean(cRisk && oRisk && cRisk === oRisk);
  const hasKeywordMatch = cKeywords.some((kw) => oKeywordsList.some((okw) => okw.includes(kw) || kw.includes(okw)));


  if (!hasComponentMatch && !hasKeywordMatch) {
    return { isMatch: false, weight: 0, reason: null };
  }

  let weight = 0.3;
  if (hasComponentMatch) weight += 0.4;
  if (hasRiskMatch) weight += 0.15;
  if (hasKeywordMatch) weight += 0.15;

  const outcomeType = String(outcome.outcome || outcome.type || "failure").toLowerCase(); // "success" | "failure" | "blocked"
  const severity = String(outcome.severity || "medium").toLowerCase(); // "high" | "medium" | "low"

  return {
    isMatch: true,
    weight: Math.min(1.0, weight),
    outcomeType,
    severity,
    outcomeId: outcome.id || outcome.outcome_id || "memory_record",
    summary: outcome.summary || outcome.lessons || outcome.rootCause || "Past outcome match",
  };
}

/**
 * Scores a single candidate plan against outcome memory and deterministic signals.
 */
export function scoreCandidate(candidate = {}, outcomeMemory = [], deterministicSignals = {}) {
  const candidateId = candidate.id || candidate.candidate_id || "candidate_unknown";
  let baseScore = typeof candidate.baseScore === "number" ? candidate.baseScore : 70;
  let penalty = 0;
  let boost = 0;

  const matchedOutcomes = [];
  const rejectionReasons = [];

  for (const outcome of outcomeMemory) {
    const match = matchOutcomeMemory(candidate, outcome);
    if (!match.isMatch) continue;

    if (match.outcomeType === "failure" || match.outcomeType === "blocked") {
      const penaltyFactor = match.severity === "high" ? 25 : match.severity === "medium" ? 15 : 8;
      const appliedPenalty = Math.round(penaltyFactor * match.weight);
      penalty += appliedPenalty;
      matchedOutcomes.push({
        candidate_id: candidateId,
        matched_outcome_id: match.outcomeId,
        outcome_type: match.outcomeType,
        penalty_or_boost: -appliedPenalty,
        reason: match.summary,
      });
      rejectionReasons.push(`Matches past ${match.severity} severity ${match.outcomeType}: ${match.summary}`);
    } else if (match.outcomeType === "success") {
      const boostFactor = match.severity === "high" ? 20 : 10;
      const appliedBoost = Math.round(boostFactor * match.weight);
      boost += appliedBoost;
      matchedOutcomes.push({
        candidate_id: candidateId,
        matched_outcome_id: match.outcomeId,
        outcome_type: "success",
        penalty_or_boost: appliedBoost,
        reason: match.summary,
      });
    }
  }

  // Factor in deterministic signals (e.g. baseline hit rate, test pass status)
  if (deterministicSignals.retrieval_floor_passed === false) {
    baseScore -= 10;
  }
  if (deterministicSignals.review_loop_blocked === true) {
    baseScore -= 10;
  }

  const finalScore = Math.max(0, Math.min(100, baseScore - penalty + boost));

  return {
    candidate_id: candidateId,
    name: candidate.name || candidateId,
    score: finalScore,
    base_score: baseScore,
    penalty,
    boost,
    matched_outcomes: matchedOutcomes,
    rejection_reasons: rejectionReasons,
  };
}

/**
 * Loads outcome memory records from disk or returns provided/default array.
 */
export function loadOutcomeMemory(opts = {}) {
  if (Array.isArray(opts.outcomeMemory)) return opts.outcomeMemory;
  const targetPath = opts.outcomeMemoryPath || path.join(process.cwd(), "reviews", "outcome_memory.json");
  if (fs.existsSync(targetPath)) {
    try {
      const text = fs.readFileSync(targetPath, "utf8");
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.outcomes)) return parsed.outcomes;
    } catch {
      // Fall through if file is missing or unparseable
    }
  }
  return opts.fallbackOutcomeMemory || [];
}

/**
 * Evaluates candidate implementation plans using focused outcome memory & deterministic signals.
 * Produces a recommendation receipt (schema: dizzy.rehearsal_receipt.v1).
 */
export function evaluateRehearsalGate(opts = {}) {
  const candidates = opts.candidates || [];
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Rehearsal gate evaluation requires a non-empty candidates array.");
  }

  const outcomeMemory = loadOutcomeMemory(opts);
  const deterministicSignals = opts.deterministicSignals || opts.deterministic_signals || {
    eval_gate: "passed",
    retrieval_floor_passed: true,
    council_audit: "passed",
  };

  const scoredCandidates = candidates.map((cand) => scoreCandidate(cand, outcomeMemory, deterministicSignals));

  // Sort deterministically: descending score, then ascending candidate_id
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.candidate_id.localeCompare(b.candidate_id);
  });

  const candidateScores = scoredCandidates.map((c, index) => ({
    candidate_id: c.candidate_id,
    name: c.name,
    score: c.score,
    rank: index + 1,
  }));

  const recommendedCandidate = scoredCandidates[0];
  const allMatchedOutcomes = scoredCandidates.flatMap((c) => c.matched_outcomes);
  const allRejectionReasons = scoredCandidates.flatMap((c) =>
    c.rejection_reasons.map((r) => ({ candidate_id: c.candidate_id, reason: r }))
  );

  let confidenceBand = "high";
  if (outcomeMemory.length === 0) {
    confidenceBand = "baseline_only";
  } else if (recommendedCandidate.score < 50) {
    confidenceBand = "low";
  } else if (recommendedCandidate.score < 75) {
    confidenceBand = "medium";
  }

  const receipt = {
    schema: REHEARSAL_SCHEMA,
    authority: REHEARSAL_AUTHORITY,
    recommended_candidate_id: recommendedCandidate.candidate_id,
    recommended_candidate_name: recommendedCandidate.name,
    candidate_scores: candidateScores,
    matched_outcomes: allMatchedOutcomes,
    deterministic_signals: deterministicSignals,
    rejection_reasons: allRejectionReasons,
    confidence_band: confidenceBand,
    operator_required: true,
    timestamp: opts.timestamp || new Date().toISOString(),
  };

  // Assert no private body text leaks
  const str = JSON.stringify(receipt);
  if (/prompt_body|user_private|secret/i.test(str)) {
    throw new Error("Rehearsal receipt contains prohibited private text keywords.");
  }

  return receipt;
}
