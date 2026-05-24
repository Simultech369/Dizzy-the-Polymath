import fs from "fs";
import path from "path";
import { stripFrontmatter } from "../lib/markdown_frontmatter.mjs";

const FILES = [
  "DESIGN.md",
  "PROMPT_CORE.md",
  "MARKETPLACE_PROTOCOL.md",
  "memory/topics/civic-doctrine-kernel.md",
  "upgrades/README.md",
];

const STYLE_PATTERNS = [
  { id: "supremacy_word", re: /\bsupremacy\b/ig, note: "Prestige-coded or ideology-performance wording may be creeping in." },
  { id: "ambient_paid_continuity", re: /\bpaid_public\b[\s\S]{0,180}\b(allows durable memory|durable_memory_allowed:\s*true|repo_retrieval_allowed:\s*true|ambient continuity)\b/ig, note: "Paid/public continuity may be drifting beyond explicit conversation-only scope." },
  { id: "doctrine_classifier", re: /\b(doctrine violation classifier|ideology classifier|moral purity)\b/ig, note: "Boundary guards may be drifting into ideology filtering." },
  { id: "goblin_frequency", re: /\bgoblin(s)?\b/ig, note: "Metaphor may be displacing concrete failure language." },
];

function read(file) {
  try {
    return fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
  } catch {
    return "";
  }
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

function scanFile(file) {
  const raw = read(file);
  const text = stripFrontmatter(raw);
  const findings = [];
  for (const pattern of STYLE_PATTERNS) {
    const matches = [...text.matchAll(pattern.re)];
    if (!matches.length) continue;
    findings.push({
      file,
      id: pattern.id,
      count: matches.length,
      first_line: lineForOffset(text, matches[0].index || 0),
      note: pattern.note,
    });
  }
  return findings;
}

const findings = FILES.flatMap(scanFile);
const out = {
  ok: true,
  scanned_at: new Date().toISOString(),
  scope: FILES,
  findings,
  surprise_hypotheses: findings
    .filter((f) => f.id === "ambient_paid_continuity" || f.id === "doctrine_classifier")
    .map((f) => ({
      source: f.file,
      hypothesis: "A boundary mechanism may be drifting into a broader doctrine or monetization claim.",
      status: "hypothesis",
    })),
};

console.log(JSON.stringify(out, null, 2));
