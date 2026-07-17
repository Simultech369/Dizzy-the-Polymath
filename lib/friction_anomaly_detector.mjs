/**
 * lib/friction_anomaly_detector.mjs
 * ---------------------------------
 * Anomaly detection for friction ledger entries.
 * Replaces standard z-score with Median Absolute Deviation (MAD) for low-variance safety.
 */

// Compute friction weight based on severity and frequency
export function getEntryWeight(entry) {
  const multiplier = entry.frequency === "chronic" ? 3 : entry.frequency === "repeated" ? 2 : 1;
  return entry.severity * multiplier;
}

// Calculate the median of a numeric array
export function calculateMedian(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Run anomaly detection on a new friction entry
 * @param {Array} history - List of historical friction entries
 * @param {Object} newEntry - The new friction entry
 * @returns {Object} Anomaly report
 */
export function detectFrictionAnomaly(history, newEntry) {
  const newWeight = getEntryWeight(newEntry);

  if (history.length < 5) {
    return {
      is_anomaly: false,
      reason: "Insufficient historical data to compute statistical baseline (minimum 5 entries required).",
      new_weight: newWeight,
      median: 0,
      mad: 0,
      robust_z: 0
    };
  }

  const weights = history.map(getEntryWeight);
  const median = calculateMedian(weights);

  // Compute absolute deviations from the median
  const deviations = weights.map(w => Math.abs(w - median));
  const mad = calculateMedian(deviations);

  // Scale MAD by 1.4826 to approximate normal standard deviation
  let scale = 1.4826 * mad;

  let fallbackUsed = false;
  let stdDev = 0;
  if (scale === 0) {
    // If scale is 0 (more than 50% of history is identical), fall back to standard deviation
    const mean = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    const variance = weights.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / weights.length;
    stdDev = Math.sqrt(variance);
    scale = stdDev || 0.1; // fallback to epsilon if stdDev is also 0
    fallbackUsed = true;
  }

  // Calculate robust z-score
  const robustZ = (newWeight - median) / scale;

  // Anomaly defined as robust z-score >= 3 (3-sigma deviation)
  const isAnomaly = robustZ >= 3;

  let prompt = null;
  if (isAnomaly) {
    prompt = `[Notice] This session shows a ${robustZ.toFixed(1)}σ deviation on friction signal: "${newEntry.friction_type}" — review trajectory?`;
  }

  return {
    is_anomaly: isAnomaly,
    robust_z: Number(robustZ.toFixed(2)),
    new_weight: newWeight,
    median: Number(median.toFixed(2)),
    mad: Number(mad.toFixed(2)),
    std_dev: Number(stdDev.toFixed(2)),
    scale: Number(scale.toFixed(2)),
    fallback_used: fallbackUsed,
    prompt
  };
}
