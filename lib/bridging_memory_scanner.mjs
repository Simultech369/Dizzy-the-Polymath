/**
 * lib/bridging_memory_scanner.mjs
 * --------------------------------
 * Opt-In Quarantine-First Bridging Memory Scanner.
 * Computes Jaccard keyword overlap across historical daily logs to surface
 * cross-session concept connections.
 *
 * Safety invariants:
 * 1. Strictly opt-in: disabled by default unless optIn === true.
 * 2. Zero auto-promotion: suggestions are staged in quarantine (or returned in-memory)
 *    and never directly written to the active memory graph or MEMORY.md without operator review.
 */

import fs from "fs";
import path from "path";

export const BRIDGING_MEMORY_SCHEMA = "dizzy.bridging_memory_quarantine.v1";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "of", "to", "in", "on",
  "at", "by", "for", "with", "about", "against", "between", "into", "through",
  "during", "before", "after", "above", "below", "from", "up", "down",
  "out", "off", "over", "under", "again", "further", "once", "here",
  "there", "when", "where", "why", "how", "all", "any", "both", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "can", "will", "just",
  "should", "now", "you", "they", "them", "this", "that", "these", "those",
  "have", "has", "had", "was", "were", "been", "being"
]);

export function tokenize(text = "") {
  const words = String(text || "").toLowerCase().match(/[a-z0-9_-]+/g) || [];
  return new Set(words.filter((w) => w.length > 2 && !STOP_WORDS.has(w)));
}

export function computeJaccardSimilarity(setA, setB) {
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  return intersection / union.size;
}

/**
 * Scans historical logs for concept bridging with opt-in guard.
 *
 * @param {Object} options
 * @param {string} options.memoryDir - Path to memory logs directory
 * @param {string} options.currentText - Active session content
 * @param {number} [options.threshold=0.05] - Jaccard threshold
 * @param {boolean} [options.optIn=false] - Explicit operator opt-in flag
 * @returns {Object} Bridging report
 */
export function scanBridgingMemories({
  memoryDir,
  currentText = "",
  threshold = 0.05,
  optIn = false,
} = {}) {
  if (!optIn) {
    return {
      schema_version: BRIDGING_MEMORY_SCHEMA,
      opt_in: false,
      status: "disabled_opt_in_required",
      suggestions: [],
      authority: "bridging_memory_is_opt_in_quarantine_only",
    };
  }

  if (!memoryDir || !fs.existsSync(memoryDir)) {
    return {
      schema_version: BRIDGING_MEMORY_SCHEMA,
      opt_in: true,
      status: "memory_dir_not_found",
      suggestions: [],
      authority: "bridging_memory_is_opt_in_quarantine_only",
    };
  }

  const currentTokens = tokenize(currentText);
  if (currentTokens.size === 0) {
    return {
      schema_version: BRIDGING_MEMORY_SCHEMA,
      opt_in: true,
      status: "empty_current_text",
      suggestions: [],
      authority: "bridging_memory_is_opt_in_quarantine_only",
    };
  }

  const files = fs.readdirSync(memoryDir)
    .filter((name) => name.endsWith(".md") && name !== "README.md" && name !== "MEMORY.md");

  const bridges = [];

  for (const file of files) {
    const filePath = path.join(memoryDir, file);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const fileTokens = tokenize(content);
      const score = computeJaccardSimilarity(currentTokens, fileTokens);

      if (score >= threshold) {
        const overlaps = [...currentTokens].filter((w) => fileTokens.has(w));
        bridges.push({
          source_file: file,
          score: Number(score.toFixed(3)),
          bridge_concepts: overlaps.slice(0, 10),
          status: "quarantined",
          suggested_at: new Date().toISOString(),
        });
      }
    } catch {
      // Ignore unreadable files
    }
  }

  bridges.sort((a, b) => b.score - a.score);

  return {
    schema_version: BRIDGING_MEMORY_SCHEMA,
    opt_in: true,
    status: "ok",
    scanned_file_count: files.length,
    suggestion_count: bridges.length,
    suggestions: bridges,
    authority: "bridging_memory_is_opt_in_quarantine_only",
  };
}

/**
 * Stages bridging suggestions in a quarantine directory.
 * @param {string} quarantineDir - Quarantine storage path
 * @param {Array<Object>} suggestions - Bridging suggestions
 * @returns {Array<string>} List of staged file paths
 */
export function stageBridgesInQuarantine(quarantineDir, suggestions = []) {
  if (!suggestions.length || !quarantineDir) return [];
  fs.mkdirSync(quarantineDir, { recursive: true });

  const stagedPaths = [];
  for (const bridge of suggestions) {
    const safeName = String(bridge.source_file || "bridge").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `bridge_${safeName}_${Date.now()}.json`;
    const targetPath = path.join(quarantineDir, filename);
    fs.writeFileSync(targetPath, JSON.stringify(bridge, null, 2), "utf8");
    stagedPaths.push(targetPath);
  }

  return stagedPaths;
}
