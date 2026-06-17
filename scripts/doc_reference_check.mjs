import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const REQUIRED_FILES = [
  "AGENTS.md",
  "BOOTSTRAP.md",
  "IDENTITY.md",
  "identity/personas/SOUL.md",
  "TOOLS.md",
  "identity/personas/USER.md",
  "PROMPT_CORE.md",
  "INTERACTION_NORMS.md",
];
const ACTIVE_DIRS = ["context-packs", "identity/personas", "skills"];
const RETIRED_REFERENCES = ["HEARTBEAT.md", "GOVERNANCE.md"];
const RETIRED_REFERENCE_ALLOWLIST = new Set(["EXPERIMENT_RECONCILIATION.md"]);

function hasStandaloneFileReference(text, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^A-Za-z0-9_-])${escaped}([^A-Za-z0-9_-]|$)`);
  return pattern.test(text);
}

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function listMarkdownFiles() {
  const files = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(ROOT, entry.name));

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(abs);
    }
  }

  for (const rel of ACTIVE_DIRS) walk(path.join(ROOT, rel));
  return files.sort((a, b) => toRepoPath(a).localeCompare(toRepoPath(b)));
}

function localLinkTarget(rawTarget) {
  const target = String(rawTarget || "").trim().replace(/^<|>$/g, "");
  if (!target || target.startsWith("#")) return null;
  if (/^(https?:|mailto:|data:)/i.test(target)) return null;
  if (/^file:/i.test(target)) return { invalidScheme: true, target };

  const withoutAnchor = target.split("#", 1)[0].split("?", 1)[0];
  if (!withoutAnchor) return null;
  try {
    return { target: decodeURIComponent(withoutAnchor) };
  } catch {
    return { target: withoutAnchor };
  }
}

const issues = [];
for (const rel of REQUIRED_FILES) {
  if (!fs.existsSync(path.join(ROOT, rel))) issues.push(`${rel}: required document is missing`);
}

for (const abs of listMarkdownFiles()) {
  const rel = toRepoPath(abs);
  const text = fs.readFileSync(abs, "utf8");
  const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");

  if (!RETIRED_REFERENCE_ALLOWLIST.has(rel)) {
    for (const retired of RETIRED_REFERENCES) {
      if (hasStandaloneFileReference(text, retired)) issues.push(`${rel}: live reference to retired ${retired}`);
    }
  }

  for (const match of prose.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const parsed = localLinkTarget(match[1]);
    if (!parsed) continue;
    if (parsed.invalidScheme) {
      issues.push(`${rel}: machine-specific file URI '${parsed.target}'`);
      continue;
    }
    const resolved = path.resolve(path.dirname(abs), parsed.target);
    if (!fs.existsSync(resolved)) issues.push(`${rel}: broken local link '${parsed.target}'`);
  }
}

if (issues.length) {
  console.error(`DOC_REFERENCE_CHECK_FAILED\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  process.exit(1);
}

console.log("DOC_REFERENCE_CHECK_OK required files, retired references, and local links are valid");
