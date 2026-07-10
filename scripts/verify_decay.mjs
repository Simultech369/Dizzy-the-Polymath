import fs from "fs";
import path from "path";
import { getRelevantMarkdownSnippets } from "../lib/md_retriever.mjs";
import { getPromptSources } from "../lib/prompt_bundle.mjs";

console.log("--- DIZZY MEMORY & DECAY VERIFICATION ---");

// Helper to write temporary files
function writeTempFile(relPath, content) {
  const absPath = path.resolve(process.cwd(), relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, "utf8");
  return absPath;
}

// Helper to delete files safely
function deleteTempFile(relPath) {
  const absPath = path.resolve(process.cwd(), relPath);
  if (fs.existsSync(absPath)) {
    fs.unlinkSync(absPath);
  }
}

// Set up dates
const halfLifeDate = new Date();
halfLifeDate.setDate(halfLifeDate.getDate() - 180);
const dateStr = halfLifeDate.toISOString().split("T")[0];

const decayTempPath = "memory/topics/verify-temp-decay.md";
const decayTempContent = `---
memory_type: semantic
captured_at: ${dateStr}
confidence: high
---
# Decayed Fruit
Apples bananas oranges.
`;

const economicsTempPath = "memory/topics/verify-economics.md";
const economicsTempContent = `---
confidence: high
captured_at: 2026-06-10
---
# Preventative economics topic
Keywords: preventative wellbeing economics capacity leakage
`;

const expiredOverlayPath = "overlays/verify-temp-expired.md";
const expiredOverlayContent = `---
expires_at: 2026-06-01
---
# Expired Prompt Overlay
This should not be included in prompt bundle.
`;

const activeOverlayPath = "overlays/verify-temp-active.md";
const activeOverlayContent = `---
expires_at: 2026-06-20
---
# Active Prompt Overlay
This should be included in prompt bundle.
`;

// Write all files upfront so the index build picks them all up in the first pass
writeTempFile(decayTempPath, decayTempContent);
writeTempFile(economicsTempPath, economicsTempContent);
writeTempFile(expiredOverlayPath, expiredOverlayContent);
writeTempFile(activeOverlayPath, activeOverlayContent);

let exitCode = 0;

try {
  // Test 1: Calibration retrieval (Apples color)
  console.log("\n[Test 1] Verifying Apple Colors topic retrieval...");
  const snippets = getRelevantMarkdownSnippets("apples red green yellow");
  const appleSnippet = snippets.find(s => s.path.includes("calibration-examples.md"));
  
  if (!appleSnippet) {
    console.error("FAIL: Could not retrieve calibration-examples.md with 'apples' query.");
    exitCode = 1;
  } else {
    console.log(`SUCCESS: Retrieved ${appleSnippet.path}`);
    console.log(`- Confidence parsed: ${appleSnippet.confidence} (Expected: 1.0 from 10/10)`);
    console.log(`- Decay factor: ${appleSnippet.decay.toFixed(4)} (Expected: ~1.0 since captured_at is 2026-06-10)`);
    console.log(`- Final score: ${appleSnippet.score.toFixed(4)}`);
    if (appleSnippet.confidence !== 1.0) {
      console.error("FAIL: Confidence was not parsed as 1.0.");
      exitCode = 1;
    }
  }

  // Test 2: Memory decay calculation over time
  console.log("\n[Test 2] Verifying memory decay over time...");
  const decaySnippets = getRelevantMarkdownSnippets("bananas oranges");
  const docSnippet = decaySnippets.find(s => s.path.includes("verify-temp-decay.md"));
  
  if (!docSnippet) {
    console.error("FAIL: Could not retrieve verify-temp-decay.md.");
    exitCode = 1;
  } else {
    console.log(`SUCCESS: Retrieved decayed file with decay factor: ${docSnippet.decay.toFixed(4)}`);
    // Since it is exactly 180 days, it should be close to 0.5
    if (docSnippet.decay < 0.45 || docSnippet.decay > 0.55) {
      console.error(`FAIL: Decay factor ${docSnippet.decay} is not close to 0.5 (180-day half-life).`);
      exitCode = 1;
    } else {
      console.log("SUCCESS: Decay half-life verified (~0.5 after 180 days).");
    }
  }

  // Test 3: Preventative economics signal boost
  console.log("\n[Test 3] Verifying preventative economics signal boost...");
  const econSnippets = getRelevantMarkdownSnippets("economics capacity leakage");
  const econSnippet = econSnippets.find(s => s.path.includes("verify-economics.md"));
  
  if (!econSnippet) {
    console.error("FAIL: Could not retrieve verify-economics.md.");
    exitCode = 1;
  } else {
    console.log(`SUCCESS: Retrieved economics snippet.`);
    console.log(`- Reasons: ${econSnippet.reasons.join(", ")}`);
    if (!econSnippet.reasons.includes("preventative_economics_signal")) {
      console.error("FAIL: preventative_economics_signal reason not found.");
      exitCode = 1;
    } else {
      console.log("SUCCESS: Preventative economics signal boost found.");
    }
  }

  // Test 4: Auto-expiring prompts
  console.log("\n[Test 4] Verifying prompt overlay expiry logic...");
  
  // Set DIZZY_PROMPT_OVERLAYS to load both
  process.env.DIZZY_PROMPT_OVERLAYS = "overlays/verify-temp-expired.md,overlays/verify-temp-active.md";
  
  try {
    const { sources } = getPromptSources();
    const hasExpired = sources.some(s => s.path.includes("verify-temp-expired.md"));
    const hasActive = sources.some(s => s.path.includes("verify-temp-active.md"));
    
    if (hasExpired) {
      console.error("FAIL: Expired prompt overlay was included in prompt sources.");
      exitCode = 1;
    } else {
      console.log("SUCCESS: Expired prompt overlay was correctly excluded.");
    }
    
    if (!hasActive) {
      console.error("FAIL: Active prompt overlay was excluded from prompt sources.");
      exitCode = 1;
    } else {
      console.log("SUCCESS: Active prompt overlay was correctly included.");
    }
  } finally {
    delete process.env.DIZZY_PROMPT_OVERLAYS;
  }

} catch (err) {
  console.error("UNEXPECTED ERROR:", err);
  exitCode = 1;
} finally {
  // Clean up all written test files
  deleteTempFile(decayTempPath);
  deleteTempFile(economicsTempPath);
  deleteTempFile(expiredOverlayPath);
  deleteTempFile(activeOverlayPath);
}

process.exit(exitCode);
