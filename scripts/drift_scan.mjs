import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { stripFrontmatter } from "../lib/markdown_frontmatter.mjs";

const SCANNER_VERSION = process.env.DIZZY_SCANNER_VERSION || "1.0.0";

function getGitRevision() {
  if (process.env.DIZZY_GIT_REVISION !== undefined) {
    return process.env.DIZZY_GIT_REVISION;
  }
  try {
    const res = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true });
    return res.status === 0 ? res.stdout.trim() : null;
  } catch {
    return null;
  }
}


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
  scanner_version: SCANNER_VERSION,
  repository_revision: getGitRevision(),
  scanned_at: new Date().toISOString(),
  scope: FILES,
  findings,
  findings_count: findings.length,
  stable_finding_ids: findings.map((f) => `${f.file}:${f.id}`).sort(),
  surprise_hypotheses: findings
    .filter((f) => f.id === "ambient_paid_continuity" || f.id === "doctrine_classifier")
    .map((f) => ({
      source: f.file,
      hypothesis: "A boundary mechanism may be drifting into a broader doctrine or monetization claim.",
      status: "hypothesis",
    })),
};

console.log(JSON.stringify(out, null, 2));
