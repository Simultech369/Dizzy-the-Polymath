import crypto from "node:crypto";

export const TENSION_MAP_SCHEMA = "dizzy.tension_map.v1";

export const DIALECTICAL_AXES = Object.freeze({
  AXIS_1: { id: "elegance_vs_durability", label: "Elegance (-1.0) <---> Durability (+1.0)" },
  AXIS_2: { id: "velocity_vs_rigor", label: "Fast Velocity (-1.0) <---> Deep Rigor (+1.0)" },
  AXIS_3: { id: "sovereignty_vs_cloud", label: "Local Sovereign (-1.0) <---> Frontier Cloud (+1.0)" },
  AXIS_4: { id: "conservative_vs_frontier", label: "Conservative (-1.0) <---> Frontier Novelty (+1.0)" },
});

export const MODEL_DEFAULT_BIASES = Object.freeze({
  "deepseek-r1": { elegance_vs_durability: 0.8, velocity_vs_rigor: 0.9, sovereignty_vs_cloud: 0.1, conservative_vs_frontier: 0.4 },
  "qwen-2.5-coder-32b": { elegance_vs_durability: -0.2, velocity_vs_rigor: 0.6, sovereignty_vs_cloud: -0.7, conservative_vs_frontier: -0.3 },
  "kimi-moonshot": { elegance_vs_durability: 0.3, velocity_vs_rigor: 0.4, sovereignty_vs_cloud: 0.2, conservative_vs_frontier: 0.1 },
  "codex-5.5": { elegance_vs_durability: 0.5, velocity_vs_rigor: 0.7, sovereignty_vs_cloud: 0.4, conservative_vs_frontier: -0.4 },
  "antigravity-flash": { elegance_vs_durability: 0.4, velocity_vs_rigor: -0.3, sovereignty_vs_cloud: 0.3, conservative_vs_frontier: 0.6 },
  "zero-llama-3.3": { elegance_vs_durability: 0.9, velocity_vs_rigor: -0.5, sovereignty_vs_cloud: -0.9, conservative_vs_frontier: -0.6 },
});

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

function clamp(val, min = -1.0, max = 1.0) {
  return Math.max(min, Math.min(max, Number(val) || 0));
}

/**
 * Calculates pluralistic tension coordinates and divergence across a multi-model council review set.
 */
export function buildTensionMap({
  topicId,
  reviews = [],
  customPositions = {},
  now = () => new Date(),
} = {}) {
  const safeTopic = String(topicId || `topic_${Date.now()}`);
  const modelEntries = [];

  // Populate positions from reviews or default model profiles
  if (Array.isArray(reviews) && reviews.length > 0) {
    for (const rev of reviews) {
      const modelId = String(rev.model || rev.model_id || "unknown").toLowerCase();
      const pos = customPositions[modelId] || MODEL_DEFAULT_BIASES[modelId] || {
        elegance_vs_durability: 0.0,
        velocity_vs_rigor: 0.0,
        sovereignty_vs_cloud: 0.0,
        conservative_vs_frontier: 0.0,
      };

      modelEntries.push({
        model_id: modelId,
        stance: String(rev.stance || rev.verdict || "NEUTRAL"),
        summary: String(rev.summary || rev.critique || "").slice(0, 100),
        coordinates: {
          elegance_vs_durability: clamp(pos.elegance_vs_durability),
          velocity_vs_rigor: clamp(pos.velocity_vs_rigor),
          sovereignty_vs_cloud: clamp(pos.sovereignty_vs_cloud),
          conservative_vs_frontier: clamp(pos.conservative_vs_frontier),
        },
      });
    }
  } else {
    // Use default council models if none supplied
    for (const [modelId, pos] of Object.entries(MODEL_DEFAULT_BIASES)) {
      modelEntries.push({
        model_id: modelId,
        stance: "DEFAULT_PROFILE",
        summary: "Default architectural posture",
        coordinates: {
          elegance_vs_durability: clamp(pos.elegance_vs_durability),
          velocity_vs_rigor: clamp(pos.velocity_vs_rigor),
          sovereignty_vs_cloud: clamp(pos.sovereignty_vs_cloud),
          conservative_vs_frontier: clamp(pos.conservative_vs_frontier),
        },
      });
    }
  }

  // Calculate Centroid (Average Position)
  const count = modelEntries.length || 1;
  const centroid = {
    elegance_vs_durability: 0,
    velocity_vs_rigor: 0,
    sovereignty_vs_cloud: 0,
    conservative_vs_frontier: 0,
  };

  for (const m of modelEntries) {
    centroid.elegance_vs_durability += m.coordinates.elegance_vs_durability;
    centroid.velocity_vs_rigor += m.coordinates.velocity_vs_rigor;
    centroid.sovereignty_vs_cloud += m.coordinates.sovereignty_vs_cloud;
    centroid.conservative_vs_frontier += m.coordinates.conservative_vs_frontier;
  }

  centroid.elegance_vs_durability = Number((centroid.elegance_vs_durability / count).toFixed(3));
  centroid.velocity_vs_rigor = Number((centroid.velocity_vs_rigor / count).toFixed(3));
  centroid.sovereignty_vs_cloud = Number((centroid.sovereignty_vs_cloud / count).toFixed(3));
  centroid.conservative_vs_frontier = Number((centroid.conservative_vs_frontier / count).toFixed(3));

  // Calculate Tension Metric (Variance across all models from centroid)
  let varianceSum = 0;
  for (const m of modelEntries) {
    const d1 = m.coordinates.elegance_vs_durability - centroid.elegance_vs_durability;
    const d2 = m.coordinates.velocity_vs_rigor - centroid.velocity_vs_rigor;
    const d3 = m.coordinates.sovereignty_vs_cloud - centroid.sovereignty_vs_cloud;
    const d4 = m.coordinates.conservative_vs_frontier - centroid.conservative_vs_frontier;
    varianceSum += (d1 * d1 + d2 * d2 + d3 * d3 + d4 * d4);
  }

  const tensionVariance = Number((varianceSum / count).toFixed(3));
  let tensionStatus = "LOW_CONSENSUS";
  if (tensionVariance > 0.45) tensionStatus = "HIGH_CREATIVE_TENSION";
  else if (tensionVariance > 0.20) tensionStatus = "MODERATE_DIVERGENCE";

  const receipt = {
    schema_version: TENSION_MAP_SCHEMA,
    topic_id: safeTopic,
    models_evaluated: modelEntries.length,
    models: modelEntries,
    centroid,
    tension_variance: tensionVariance,
    tension_status: tensionStatus,
    timestamp: now().toISOString(),
    map_sha256: sha256Hex(JSON.stringify({ safeTopic, modelEntries, centroid })),
  };

  return receipt;
}

/**
 * Generates an SVG 2D scatter plot projection of Axis 1 vs Axis 2 for Cockpit display.
 */
export function renderTensionMapSvg(tensionMap) {
  const width = 400;
  const height = 300;
  const cx = width / 2;
  const cy = height / 2;

  let pointsSvg = "";
  for (const m of tensionMap.models) {
    // Map -1.0..1.0 to SVG coordinates
    const px = cx + (m.coordinates.elegance_vs_durability * (width * 0.4));
    const py = cy - (m.coordinates.velocity_vs_rigor * (height * 0.4));
    pointsSvg += `  <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="#4fc3f7" stroke="#0d47a1" stroke-width="1.5" />\n`;
    pointsSvg += `  <text x="${(px + 7).toFixed(1)}" y="${(py + 3).toFixed(1)}" fill="#cfd8dc" font-size="10" font-family="monospace">${m.model_id}</text>\n`;
  }

  // Centroid marker
  const cpx = cx + (tensionMap.centroid.elegance_vs_durability * (width * 0.4));
  const cpy = cy - (tensionMap.centroid.velocity_vs_rigor * (height * 0.4));

  const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#121820; border-radius:6px;">
  <!-- Axes -->
  <line x1="20" y1="${cy}" x2="${width - 20}" y2="${cy}" stroke="#37474f" stroke-width="1" stroke-dasharray="3,3" />
  <line x1="${cx}" y1="20" x2="${cx}" y2="${height - 20}" stroke="#37474f" stroke-width="1" stroke-dasharray="3,3" />
  <!-- Labels -->
  <text x="25" y="${cy - 6}" fill="#78909c" font-size="9" font-family="monospace">ELEGANCE</text>
  <text x="${width - 75}" y="${cy - 6}" fill="#78909c" font-size="9" font-family="monospace">DURABILITY</text>
  <text x="${cx + 6}" y="30" fill="#78909c" font-size="9" font-family="monospace">RIGOR</text>
  <text x="${cx + 6}" y="${height - 15}" fill="#78909c" font-size="9" font-family="monospace">VELOCITY</text>
  <!-- Model Nodes -->
${pointsSvg}  <!-- Centroid -->
  <polygon points="${cpx.toFixed(1)},${(cpy - 6).toFixed(1)} ${(cpx + 6).toFixed(1)},${(cpy + 5).toFixed(1)} ${(cpx - 6).toFixed(1)},${(cpy + 5).toFixed(1)}" fill="#ffd54f" />
  <text x="${(cpx + 8).toFixed(1)}" y="${(cpy + 4).toFixed(1)}" fill="#ffd54f" font-size="10" font-family="monospace">CENTROID</text>
</svg>`;

  return svg;
}
