/**
 * Prototype for Friction Anomaly Detection.
 * Computes historical baseline metrics (mean, standard deviation)
 * of friction entry weights and checks for 3-sigma anomalies.
 */

// Compute friction weight based on severity and frequency
function getEntryWeight(entry) {
  const multiplier = entry.frequency === "chronic" ? 3 : entry.frequency === "repeated" ? 2 : 1;
  return entry.severity * multiplier;
}

/**
 * Run anomaly detection on friction entries
 * @param {Array} history - List of historical friction entries
 * @param {Object} newEntry - The new friction entry to evaluate
 * @returns {Object} Anomaly detection report
 */
export function detectFrictionAnomaly(history, newEntry) {
  if (history.length < 5) {
    return {
      is_anomaly: false,
      reason: "Insufficient historical data to compute statistical baseline (minimum 5 entries required).",
      new_weight: getEntryWeight(newEntry),
      mean: 0,
      stdDev: 0
    };
  }

  // 1. Calculate weights of historical entries
  const weights = history.map(getEntryWeight);
  const n = weights.length;

  // 2. Calculate mean (μ)
  const mean = weights.reduce((sum, w) => sum + w, 0) / n;

  // 3. Calculate standard deviation (σ)
  const variance = weights.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance) || 0.1; // avoid division by zero

  // 4. Calculate new entry weight
  const newWeight = getEntryWeight(newEntry);

  // 5. Compute z-score (number of standard deviations from the mean)
  const zScore = (newWeight - mean) / stdDev;

  // Anomaly defined as z-score >= 3 (3-sigma deviation)
  const isAnomaly = zScore >= 3;

  let prompt = null;
  if (isAnomaly) {
    prompt = `[Notice] This session shows a ${zScore.toFixed(1)}σ deviation on friction signal: "${newEntry.friction_type}" — review trajectory?`;
  }

  return {
    is_anomaly: isAnomaly,
    z_score: Number(zScore.toFixed(2)),
    new_weight: newWeight,
    mean: Number(mean.toFixed(2)),
    std_dev: Number(stdDev.toFixed(2)),
    prompt
  };
}

// --- Test Harness ---

// 1. Simulated normal historical friction events (mean weight around 5-8)
const mockHistory = [
  { friction_type: "auth_token_expire", severity: 4, frequency: "first" },      // weight = 4
  { friction_type: "doc_reference_stale", severity: 3, frequency: "repeated" }, // weight = 6
  { friction_type: "vram_exhaustion", severity: 8, frequency: "first" },        // weight = 8
  { friction_type: "api_rate_limit", severity: 5, frequency: "repeated" },      // weight = 10
  { friction_type: "skill_registry_missing", severity: 6, frequency: "first" }, // weight = 6
  { friction_type: "auth_token_expire", severity: 3, frequency: "first" },      // weight = 3
  { friction_type: "doc_reference_stale", severity: 2, frequency: "repeated" }, // weight = 4
];

// 2. Test Case A: A typical normal event
const normalEvent = { friction_type: "redis_latency", severity: 5, frequency: "first" }; // weight = 5

// 3. Test Case B: An anomalous, high-severity chronic event (3-sigma outlier)
const anomalousEvent = { friction_type: "persistent_untrusted_injection", severity: 10, frequency: "chronic" }; // weight = 30

console.log("=== Testing normal event ===");
const normalReport = detectFrictionAnomaly(mockHistory, normalEvent);
console.log(JSON.stringify(normalReport, null, 2));

console.log("\n=== Testing anomalous event ===");
const anomalousReport = detectFrictionAnomaly(mockHistory, anomalousEvent);
console.log(JSON.stringify(anomalousReport, null, 2));
