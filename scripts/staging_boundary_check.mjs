import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const TRIAGE_PATH = "reviews/w0068_staging_triage.md";

function readRequired(relPath) {
  const absPath = path.resolve(ROOT, relPath);
  if (!fs.existsSync(absPath)) throw new Error(`${relPath}: file missing`);
  return fs.readFileSync(absPath, "utf8");
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function normalizePath(relPath) {
  return String(relPath || "").trim().replace(/^`|`$/g, "").replace(/\\/g, "/");
}

function section(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start < 0) return "";
  const rest = markdown.slice(start + heading.length);
  const next = rest.search(/\n##\s/);
  return next < 0 ? rest : rest.slice(0, next);
}

function extractTableRows(markdown, heading) {
  const body = section(markdown, heading);
  const rows = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) continue;
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 3) continue;
    if (cells[0] === "---" || /^(File|Material)$/i.test(cells[0])) continue;
    rows.push({
      file: normalizePath(cells[0]),
      disposition: cells[1],
      reason: cells[2] || "",
      raw: line,
    });
  }
  return rows;
}

function trackedDirtyFiles() {
  const unstaged = runGit(["diff", "--name-only"]).split(/\r?\n/).filter(Boolean);
  const staged = runGit(["diff", "--cached", "--name-only"]).split(/\r?\n/).filter(Boolean);
  return [...new Set([...unstaged, ...staged].map(normalizePath))].sort();
}

function main() {
  const issues = [];
  let triageText;
  let dirtyFiles;

  try {
    triageText = readRequired(TRIAGE_PATH);
    dirtyFiles = trackedDirtyFiles();
  } catch (err) {
    console.error(`STAGING_BOUNDARY_CHECK_FAILED\n- ${err.message}`);
    process.exit(1);
  }

  const dispositionRows = extractTableRows(triageText, "## Tracked Diff Disposition");
  const parkedRows = extractTableRows(triageText, "## Untracked And Parked Material");
  const dispositionFiles = new Set(dispositionRows.map((row) => row.file));

  for (const file of dirtyFiles) {
    if (!dispositionFiles.has(file)) {
      issues.push(`${TRIAGE_PATH}: tracked dirty file missing disposition row: ${file}`);
    }
  }

  for (const row of dispositionRows) {
    const absPath = path.resolve(ROOT, row.file);
    if (!fs.existsSync(absPath)) {
      issues.push(`${TRIAGE_PATH}: disposition row points at missing file: ${row.file}`);
    }
    if (!/\binclude\b|\bpark\b|\bexclude\b|\bdefer\b/i.test(row.disposition)) {
      issues.push(`${TRIAGE_PATH}: disposition row has unclear disposition for ${row.file}`);
    }
  }

  const requiredParkedFragments = [
    "UNIFIED_HANDOFF_PACKET.md",
    "branch_policy_reconciliation_2026-08-26.md",
    "reviews/*_latest.json",
    "Broad `reviews/*.md` model critiques",
    ".extraction/",
    ".review-harness/",
    "artifacts/",
    "codex-bench-*",
    "Python `C:\\Users\\Josh\\.gemini\\antigravity\\scratch\\council_engine`",
  ];
  const parkedText = parkedRows.map((row) => row.raw).join("\n");
  for (const fragment of requiredParkedFragments) {
    if (!parkedText.includes(fragment)) {
      issues.push(`${TRIAGE_PATH}: parked-material table missing required boundary fragment ${fragment}`);
    }
  }

  if (!/npm run check:pattern-provenance/.test(triageText)) {
    issues.push(`${TRIAGE_PATH}: final verification sequence missing npm run check:pattern-provenance`);
  }
  if (!/npm run check:council/.test(triageText)) {
    issues.push(`${TRIAGE_PATH}: final verification sequence missing npm run check:council`);
  }
  if (!/Receipt hashes are per-run evidence/.test(triageText)) {
    issues.push(`${TRIAGE_PATH}: missing receipt refresh warning`);
  }

  if (issues.length) {
    console.error(`STAGING_BOUNDARY_CHECK_FAILED\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    process.exit(1);
  }

  console.log(`STAGING_BOUNDARY_CHECK_OK dirty_tracked=${dirtyFiles.length} disposition_rows=${dispositionRows.length} parked_rows=${parkedRows.length}`);
}

main();
