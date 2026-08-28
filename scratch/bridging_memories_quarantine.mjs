import fs from "fs";
import path from "path";

// Tokenize text into lower-case alphanumeric words, filtering out common stop words
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "of", "to", "in", "on", 
  "at", "by", "for", "with", "about", "against", "between", "into", "through",
  "during", "before", "after", "above", "below", "from", "up", "down", "in", 
  "out", "off", "over", "under", "again", "further", "then", "once", "here", 
  "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", 
  "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", 
  "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", 
  "should", "now", "i", "you", "he", "she", "it", "we", "they", "them", "us"
]);

function tokenize(text) {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  return new Set(words.filter(w => w.length > 2 && !STOP_WORDS.has(w)));
}

function computeJaccardSimilarity(setA, setB) {
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  return intersection / union.size;
}

/**
 * Scan historical logs for concept bridging
 * @param {string} memoryDir - Path to memory logs directory
 * @param {string} currentText - Active session content
 * @param {number} threshold - Jaccard threshold (e.g. 0.05 - 0.20)
 * @returns {Array} Quarantine bridging suggestions
 */
export function scanBridgingMemories(memoryDir, currentText, threshold = 0.05) {
  if (!fs.existsSync(memoryDir)) {
    return [];
  }

  const currentTokens = tokenize(currentText);
  if (currentTokens.size === 0) return [];

  const files = fs.readdirSync(memoryDir)
    .filter(name => name.endsWith(".md") && name !== "README.md");

  const bridges = [];

  for (const file of files) {
    const filePath = path.join(memoryDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const fileTokens = tokenize(content);

    const score = computeJaccardSimilarity(currentTokens, fileTokens);

    if (score >= threshold) {
      // Find overlapping words as keywords/bridge concepts
      const overlaps = [...currentTokens].filter(w => fileTokens.has(w));
      bridges.push({
        source_file: file,
        score: Number(score.toFixed(3)),
        bridge_concepts: overlaps.slice(0, 10), // return top 10 concepts
        status: "quarantined",
        suggested_at: new Date().toISOString()
      });
    }
  }

  return bridges.sort((a, b) => b.score - a.score);
}

/**
 * Stage bridges in quarantine directory
 * @param {string} quarantineDir - Path to quarantine storage
 * @param {Array} bridges - Bridges list
 */
export function stageBridges(quarantineDir, bridges) {
  if (bridges.length === 0) return;
  fs.mkdirSync(quarantineDir, { recursive: true });

  for (const bridge of bridges) {
    const filename = `bridge_${bridge.source_file.replace(".md", "")}_${Date.now()}.json`;
    const targetPath = path.join(quarantineDir, filename);
    fs.writeFileSync(targetPath, JSON.stringify(bridge, null, 2), "utf8");
    console.log(`[Quarantine] Bridge suggested for ${bridge.source_file} (similarity: ${bridge.score}) staged at ${targetPath}`);
  }
}

// --- Test Harness ---
const activeSessionText = `
Today we resolved the consensus state transition wording bugs.
We moved from cryptographic signing chain claims to reported review states.
The operator decision field now tracks AWAITING_OPERATOR, ACCEPTED_REPORTED_STATE, and REJECTED_REPORTED_STATE.
This addresses structural drift between the constitution doc and the code.
`;

const memoryDirectory = path.resolve(process.cwd(), "memory");
const quarantineDirectory = path.resolve(process.cwd(), "runtime", "quarantine");

// Run the scan with a low threshold to match simulated/real daily logs
console.log("=== Running Bridging Memory Scan ===");
const suggestions = scanBridgingMemories(memoryDirectory, activeSessionText, 0.03);
console.log("Found suggestions:", JSON.stringify(suggestions, null, 2));

console.log("\n=== Staging Bridges in Quarantine ===");
stageBridges(quarantineDirectory, suggestions);

// Clean up created files in quarantine directory after showing output
if (fs.existsSync(quarantineDirectory)) {
  const stagedFiles = fs.readdirSync(quarantineDirectory);
  for (const file of stagedFiles) {
    fs.rmSync(path.join(quarantineDirectory, file), { force: true });
  }
  fs.rmdirSync(quarantineDirectory);
}
