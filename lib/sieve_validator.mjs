/**
 * Sieve Validator for Dizzy's Continuity & Judgment Loops
 * Checks mechanism proposals against the Wellbeing Commons Kernel and Mechanism Sieve rules.
 */

export function validateMechanismSieve(proposal) {
  const errors = [];
  const warnings = [];

  // Required core keys
  const requiredKeys = [
    "title",
    "capability",
    "ownership",
    "funding",
    "governance",
    "enforcement",
    "exit",
    "captureRisk",
    "simplification",
    "wellbeingMetrics",
  ];

  for (const key of requiredKeys) {
    if (!proposal[key] || typeof proposal[key] !== "string" || proposal[key].trim().length === 0) {
      errors.push(`Missing or empty required sieve field: '${key}'`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  // 1. Exit & Portability validation
  const exitText = proposal.exit.toLowerCase().trim();
  const noExitKeywords = ["none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"];
  if (noExitKeywords.some(kw => exitText.includes(kw)) || exitText.length < 15) {
    errors.push("Sieve Fail: Exit strategy is missing, restricted, or too brief. Participants must have clear data/asset portability.");
  }

  // 2. Anti-chokepoint / Rent-seeking validation
  const capRisk = proposal.captureRisk.toLowerCase().trim();
  const ownershipText = proposal.ownership.toLowerCase().trim();
  if (
    capRisk.includes("no mitigation") || 
    capRisk.includes("operator absolute control") ||
    ownershipText.includes("absolute operator ownership")
  ) {
    errors.push("Sieve Fail: High capture risk. Mechanism does not mitigate chokepoints or absolute operator control.");
  }

  // 3. Wellbeing Metrics check (Anti-metric capture)
  const metrics = proposal.wellbeingMetrics.toLowerCase().trim();
  const badMetrics = ["tvl", "token price", "speculation", "market cap", "transaction volume", "growth rate"];
  const goodMetrics = ["patients", "access", "stabilized", "waste", "carbon", "well-being", "portability"];
  
  const hasBadMetricOnly = badMetrics.some(bm => metrics.includes(bm)) && !goodMetrics.some(gm => metrics.includes(gm));
  if (hasBadMetricOnly || metrics.length < 15) {
    errors.push("Sieve Fail: Metrics capture detected. Optimization targets financial speculation/volume instead of real-world well-being metrics.");
  }

  // Warnings / Recommendations
  const governanceText = proposal.governance.toLowerCase().trim();
  if (!governanceText.includes("appeal") && !governanceText.includes("arbitration")) {
    warnings.push("Proposal lacks explicit dispute appeals or arbitration paths.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
