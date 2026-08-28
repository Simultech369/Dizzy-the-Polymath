/**
 * Prototype for MDS Options Coordinates Map layout.
 * Calculates Jaccard distance between option descriptions and applies
 * a force-directed spring embedder layout to project them onto a 2D plane.
 */

// Tokenize text into lower-case alphanumeric words
function tokenize(text) {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) || []);
}

// Compute Jaccard distance: 1 - (Intersection / Union)
function computeDistance(textA, textB) {
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0.5; // default distance
  
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  return 1 - (intersection / union.size);
}

/**
 * Force-Directed Layout projection
 * @param {Array} options - List of option objects
 * @param {number} iterations - Number of optimization steps
 * @returns {Array} List of options with projected x and y percentages (10% to 90%)
 */
export function projectCoordinates(options, iterations = 100) {
  const n = options.length;
  if (n === 0) return [];
  if (n === 1) {
    return [{ ...options[0], left: "50%", top: "50%" }];
  }

  // 1. Initialize coordinates (e.g. circle or random distribution)
  const nodes = options.map((opt, i) => {
    const angle = (i / n) * 2 * Math.PI;
    return {
      id: opt.option_id,
      x: 0.5 + 0.2 * Math.cos(angle),
      y: 0.5 + 0.2 * Math.sin(angle),
      friction: opt.friction || "low",
      opt
    };
  });

  // 2. Precompute pairwise target distances based on text similarity and friction class difference
  const targetDistances = Array(n).fill(null).map(() => Array(n).fill(0));
  const frictionWeights = { low: 0.1, medium: 0.5, high: 0.9 };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const textDist = computeDistance(nodes[i].opt.description, nodes[j].opt.description);
      const fDist = Math.abs(frictionWeights[nodes[i].friction] - frictionWeights[nodes[j].friction]);
      
      // Combined distance metric: 70% semantic text overlap, 30% friction intensity difference
      const d = 0.7 * textDist + 0.3 * fDist;
      
      targetDistances[i][j] = d;
      targetDistances[j][i] = d;
    }
  }

  // 3. Run optimization loop (spring physics)
  let k = 0.1; // Spring constant
  let damping = 0.85;

  for (let step = 0; step < iterations; step++) {
    const fx = Array(n).fill(0);
    const fy = Array(n).fill(0);

    // Pairwise node forces
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

        const target = targetDistances[i][j];
        // Hooke's Law: force is proportional to displacement from target distance
        const displacement = dist - target;
        const force = k * displacement;

        fx[i] += (dx / dist) * force;
        fy[i] += (dy / dist) * force;

        // Add additional local repulsion force to prevent node overlap
        if (dist < 0.15) {
          const repulsion = 0.01 / (dist * dist);
          fx[i] -= (dx / dist) * repulsion;
          fy[i] -= (dy / dist) * repulsion;
        }
      }
    }

    // Apply forces and update positions
    for (let i = 0; i < n; i++) {
      nodes[i].x += fx[i] * damping;
      nodes[i].y += fy[i] * damping;

      // Keep within unit square boundaries (with safe margin)
      nodes[i].x = Math.max(0.1, Math.min(0.9, nodes[i].x));
      nodes[i].y = Math.max(0.1, Math.min(0.9, nodes[i].y));
    }
  }

  // 4. Return as percentage values for easy CSS styling
  return nodes.map(node => ({
    ...node.opt,
    left: `${Math.round(node.x * 100)}%`,
    top: `${Math.round(node.y * 100)}%`
  }));
}

// Simple test output
const testOptions = [
  { option_id: "opt-1", description: "Local speculative serving path (preferred)", friction: "low" },
  { option_id: "opt-2", description: "Quantized fall-back path", friction: "medium" },
  { option_id: "opt-3", description: "Heavy remote API path with external dependencies", friction: "high" },
];

console.log("Projected coordinates prototype output:");
console.log(JSON.stringify(projectCoordinates(testOptions, 100), null, 2));
