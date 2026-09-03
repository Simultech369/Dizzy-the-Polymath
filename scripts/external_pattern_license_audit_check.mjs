import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const AUDIT_PATH = "reviews/external_pattern_license_audit.md";
const REFERENCE_PATH = "REFERENCE_PATTERNS.md";
const FILE_ROLES_PATH = "FILE_ROLES.md";
const GITIGNORE_PATH = ".gitignore";
const NEXT_PATH = "NEXT.md";
const UNIFIED_HANDOFF_PATH = "UNIFIED_HANDOFF_PACKET.md";

const REQUIRED_SECTIONS = [
  "## Why This Exists",
  "## Audit Method",
  "## Known/Carried Sources To Review",
  "## Release Gate",
];

const REQUIRED_SOURCES = [
  "ClaudioDrews/memory-os",
  "ClaudioDrews/project-samantha",
  "ClaudioDrews/icarus-plugin",
  "quarqlabs/agent-oss",
  "polyxmedia/mnemos",
  "EurekaClaw/EurekaClaw",
  "cmxdev1/MNEMOS",
  "Panniantong/Agent-Reach",
  "OpenPipe/ART",
  "henryqin1997/statem",
  "aeonfun/aeon",
  "MiroShark/MiroShark",
];

const REQUIRED_CROSSOVER_CLASSES = [
  "idea_only",
  "mechanism_translation",
  "distinctive_structure",
  "prose",
  "tests_or_fixtures",
  "code",
  "dependency_or_vendor",
];

const REQUIRED_DISPOSITIONS = [
  "ok_no_notice_needed",
  "add_attribution",
  "add_third_party_notice",
  "mark_modified_files",
  "rewrite_from_first_principles",
  "remove",
  "needs_legal_review",
];

function readRequired(relPath) {
  const absPath = path.resolve(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`${relPath}: file missing`);
  }
  return fs.readFileSync(absPath, "utf8");
}

function requireText(issues, relPath, text, needle, label = needle) {
  if (!text.includes(needle)) issues.push(`${relPath}: missing ${label}`);
}

function requirePattern(issues, relPath, text, pattern, label) {
  if (!pattern.test(text)) issues.push(`${relPath}: missing ${label}`);
}

function extractSourceRows(markdown) {
  const rows = new Map();
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("| `")) continue;
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    const source = cells[0]?.replace(/^`|`$/g, "") || `malformed:${rows.size + 1}`;
    if (cells.length !== 6) {
      rows.set(source, { source, malformed: true, text: cells.join(" | ") });
      continue;
    }
    rows.set(source, {
      source,
      status: cells[1],
      borrowingClass: cells[2].replace(/^`|`$/g, ""),
      disposition: cells[3].replace(/^`|`$/g, ""),
      notes: cells[4],
      action: cells[5],
      text: cells.join(" | "),
    });
  }
  return rows;
}

function extractReviewedSources(referenceText) {
  const match = referenceText.match(/Reviewed sources:\s*\r?\n([\s\S]*?)(?:\r?\n##\s|\s*$)/);
  if (!match) return [];
  return [...match[1].matchAll(/^- `([^`]+)`/gm)].map((sourceMatch) => sourceMatch[1]);
}

function assertSourceRow(issues, rows, source, checks) {
  const row = rows.get(source);
  if (!row) {
    issues.push(`${AUDIT_PATH}: missing source row for ${source}`);
    return;
  }
  if (row.malformed) {
    issues.push(`${AUDIT_PATH}: ${source} row must have source, status, borrowing class, disposition, notes, and next action`);
    return;
  }
  for (const check of checks) {
    if (!check.pattern.test(row.text)) {
      issues.push(`${AUDIT_PATH}: ${source} row missing ${check.label}`);
    }
  }
}

function main() {
  const issues = [];
  let auditText;
  let referenceText;
  let fileRolesText;
  let gitignoreText;
  let nextText;
  let unifiedText;

  try {
    auditText = readRequired(AUDIT_PATH);
    referenceText = readRequired(REFERENCE_PATH);
    fileRolesText = readRequired(FILE_ROLES_PATH);
    gitignoreText = readRequired(GITIGNORE_PATH);
    nextText = readRequired(NEXT_PATH);
  } catch (err) {
    console.error(`EXTERNAL_PATTERN_LICENSE_AUDIT_FAILED\n- ${err.message}`);
    process.exit(1);
  }

  for (const section of REQUIRED_SECTIONS) {
    requireText(issues, AUDIT_PATH, auditText, section);
  }

  requireText(
    issues,
    AUDIT_PATH,
    auditText,
    "| Source | Status | Borrowing class | Disposition | Current notes | Required next action |",
    "source table with borrowing class and disposition columns",
  );

  for (const klass of REQUIRED_CROSSOVER_CLASSES) {
    requireText(issues, AUDIT_PATH, auditText, `\`${klass}\``, `crossover class ${klass}`);
  }

  for (const disposition of REQUIRED_DISPOSITIONS) {
    requireText(issues, AUDIT_PATH, auditText, `\`${disposition}\``, `disposition ${disposition}`);
  }

  requireText(issues, AUDIT_PATH, auditText, "https://www.apache.org/licenses/LICENSE-2.0", "Apache-2.0 official license pointer");
  requirePattern(issues, AUDIT_PATH, auditText, /retained notices/i, "retained notices check");
  requirePattern(issues, AUDIT_PATH, auditText, /changed-file marking/i, "changed-file marking check");
  requirePattern(issues, AUDIT_PATH, auditText, /NOTICE carry-forward/i, "NOTICE carry-forward check");
  requirePattern(issues, AUDIT_PATH, auditText, /THIRD_PARTY_NOTICES\.md/i, "third-party notices release gate");
  requirePattern(issues, AUDIT_PATH, auditText, /rewrite\/remove/i, "rewrite/remove release gate");
  requirePattern(issues, AUDIT_PATH, auditText, /public\/client-facing/i, "public/client-facing distribution gate");

  const rows = extractSourceRows(auditText);
  const reviewedSources = extractReviewedSources(referenceText);
  if (reviewedSources.length === 0) {
    issues.push(`${REFERENCE_PATH}: no reviewed sources found`);
  }
  for (const source of reviewedSources) {
    if (!rows.has(source)) issues.push(`${AUDIT_PATH}: source from ${REFERENCE_PATH} missing audit row: ${source}`);
  }

  for (const source of REQUIRED_SOURCES) {
    if (!rows.has(source)) issues.push(`${AUDIT_PATH}: missing source row for ${source}`);
  }

  for (const [source, row] of rows.entries()) {
    if (row.malformed) {
      issues.push(`${AUDIT_PATH}: malformed source row for ${source}`);
      continue;
    }
    if (!REQUIRED_CROSSOVER_CLASSES.includes(row.borrowingClass)) {
      issues.push(`${AUDIT_PATH}: ${source} has invalid borrowing class '${row.borrowingClass}'`);
    }
    if (!REQUIRED_DISPOSITIONS.includes(row.disposition)) {
      issues.push(`${AUDIT_PATH}: ${source} has invalid disposition '${row.disposition}'`);
    }
  }

  assertSourceRow(issues, rows, "Panniantong/Agent-Reach", [
    { pattern: /MIT|not audited/i, label: "license status boundary" },
    { pattern: /cookie|session|egress/i, label: "cookie/session/egress risk" },
    { pattern: /Verify license/i, label: "license verification action" },
  ]);
  assertSourceRow(issues, rows, "OpenPipe/ART", [
    { pattern: /Apache-2\.0|not audited/i, label: "Apache-2.0 status boundary" },
    { pattern: /RULER|GRPO|model-layer/i, label: "model-layer scope" },
    { pattern: /Verify license/i, label: "license verification action" },
  ]);
  assertSourceRow(issues, rows, "henryqin1997/statem", [
    { pattern: /Apache-2\.0|not audited/i, label: "Apache-2.0 status boundary" },
    { pattern: /runbook|FSM|StateM-style/i, label: "runbook/FSM scope" },
    { pattern: /Verify license/i, label: "license verification action" },
  ]);
  assertSourceRow(issues, rows, "aeonfun/aeon", [
    { pattern: /MIT/i, label: "MIT observation" },
    { pattern: /_external\/aeonfun-aeon/i, label: "quarantine clone path" },
    { pattern: /audit exact license file/i, label: "exact license-file audit action" },
  ]);
  assertSourceRow(issues, rows, "MiroShark/MiroShark", [
    { pattern: /AGPL-3\.0/i, label: "AGPL-3.0 observation" },
    { pattern: /_external\/miroshark-miroshark/i, label: "quarantine clone path" },
    { pattern: /architecture-study only/i, label: "architecture-study-only reuse boundary" },
  ]);

  requirePattern(issues, REFERENCE_PATH, referenceText, /Local clones under `_ext\/` and `_external\/` are research inputs/i, "external clone quarantine rule");
  requirePattern(issues, REFERENCE_PATH, referenceText, /copied source code or distinctive structure unless the license and attribution path are explicitly reviewed/i, "copy/structure license boundary");
  requirePattern(issues, REFERENCE_PATH, referenceText, /Track retrospective concerns in `reviews\/external_pattern_license_audit\.md`/i, "audit path pointer");
  requirePattern(issues, REFERENCE_PATH, referenceText, /Complete W-0102 before promoting new external-reference material/i, "W-0102 promotion blocker");

  requirePattern(issues, FILE_ROLES_PATH, fileRolesText, /## Ignored External Reference Clones/i, "ignored external clone role section");
  requirePattern(issues, FILE_ROLES_PATH, fileRolesText, /not automatic retrieval roots/i, "no automatic retrieval-root claim");
  requirePattern(issues, FILE_ROLES_PATH, fileRolesText, /not proof of implemented capability/i, "no clone-as-capability claim");
  requirePattern(issues, GITIGNORE_PATH, gitignoreText, /^_ext\/$/m, "_ext gitignore entry");
  requirePattern(issues, GITIGNORE_PATH, gitignoreText, /^_external\/$/m, "_external gitignore entry");

  requirePattern(issues, NEXT_PATH, nextText, /W-0102: Audit borrowed-pattern license and provenance exposure/i, "W-0102 queue item");
  requirePattern(issues, NEXT_PATH, nextText, /THIRD_PARTY_NOTICES\.md/i, "W-0102 notices acceptance");

  if (issues.length) {
    console.error(`EXTERNAL_PATTERN_LICENSE_AUDIT_FAILED\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    process.exit(1);
  }

  console.log(`EXTERNAL_PATTERN_LICENSE_AUDIT_OK reference_sources=${reviewedSources.length} audit_sources=${rows.size} release_gate=true`);
}

main();
