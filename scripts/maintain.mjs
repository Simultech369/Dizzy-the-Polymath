import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

import { summarizeFriction } from "../lib/friction_ledger.mjs";
import { summarizeMemoryMetabolism } from "../lib/memory_metabolism.mjs";

const ROOT = process.cwd();

const CHECKS = [
  {
    id: "safety",
    label: "Runtime safety checks",
    command: ["node", "--disable-warning=ExperimentalWarning", "scripts/safety_checks.mjs"],
    severity: "red",
  },
  {
    id: "smoke",
    label: "Smoke test",
    command: ["node", "smoke_test.mjs"],
    severity: "red",
  },
  {
    id: "state",
    label: "DESIGN.md/state.json sync",
    command: ["node", "scripts/sync_state.mjs", "--check"],
    severity: "red",
  },
  {
    id: "memory",
    label: "Memory index validation",
    command: ["node", "scripts/memory_validate.mjs"],
    severity: "yellow",
  },
  {
    id: "prompt",
    label: "Prompt-pack/design drift",
    command: ["node", "scripts/prompt_drift_check.mjs"],
    severity: "yellow",
  },
  {
    id: "production",
    label: "Production readiness wiring",
    command: ["node", "scripts/production_readiness_check.mjs"],
    severity: "yellow",
  },
  {
    id: "dependencies",
    label: "Dependency/API drift gate",
    command: ["node", "scripts/dependency_api_drift_check.mjs"],
    severity: "yellow",
  },
  {
    id: "next",
    label: "NEXT.md upgrade consistency",
    command: ["node", "scripts/next_consistency_check.mjs"],
    severity: "yellow",
  },
  {
    id: "skills",
    label: "Local skill registry",
    command: ["node", "scripts/skill_registry_check.mjs"],
    severity: "yellow",
  },
  {
    id: "docs",
    label: "Document references",
    command: ["node", "scripts/doc_reference_check.mjs"],
    severity: "yellow",
  },
  {
    id: "drift",
    label: "Doctrine drift scan",
    command: ["node", "scripts/drift_scan.mjs"],
    severity: "yellow",
  },
  {
    id: "connections",
    label: "Connection hypothesis scan",
    command: ["node", "scripts/connection_scan.mjs"],
    severity: "yellow",
  },
];

function runCheck(check) {
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
  });

  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  const output = [stdout, stderr].filter(Boolean).join("\n");
  return {
    ...check,
    ok: result.status === 0,
    status: result.status,
    output,
  };
}

function listStaleUpgradeSignals() {
  const findings = [];
  const files = [
    "NEXT.md",
    "upgrades/README.md",
    "upgrades/active/W-0004-continuity-lifecycle.md",
  ];

  for (const file of files) {
    const abs = path.resolve(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    if (/implement next/i.test(text)) {
      findings.push(`${file}: contains stale 'implement next' language`);
    }
    if (/publish and review W-0004/i.test(text)) {
      findings.push(`${file}: W-0004 appears to be described as pre-implementation`);
    }
  }

  return findings;
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return null;

  const block = text.slice(4, end).trim();
  const data = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    data[key] = rawValue.replace(/^["']|["']$/g, "").trim();
  }
  return data;
}

function daysSince(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return Infinity;
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
}

function upgradeStatus() {
  const activeDir = path.resolve(ROOT, "upgrades", "active");
  if (!fs.existsSync(activeDir)) {
    return { status: "green", message: "No upgrades/active directory.", findings: [] };
  }

  const required = ["id", "status", "tier", "owner_surface", "last_reviewed", "next_action"];
  const allowedStatuses = new Set(["active", "integrated", "parked", "archived"]);
  const counts = { active: 0, integrated: 0, parked: 0, archived: 0 };
  const findings = [];

  const files = fs
    .readdirSync(activeDir)
    .filter((name) => name.endsWith(".md"))
    .sort();

  for (const name of files) {
    const rel = path.join("upgrades", "active", name).replaceAll("\\", "/");
    const text = fs.readFileSync(path.join(activeDir, name), "utf8");
    const frontmatter = parseFrontmatter(text);
    if (!frontmatter) {
      findings.push(`${rel}: missing status frontmatter`);
      continue;
    }

    for (const key of required) {
      if (!frontmatter[key]) findings.push(`${rel}: missing ${key}`);
    }

    const status = frontmatter.status;
    if (allowedStatuses.has(status)) {
      counts[status] += 1;
    } else if (status) {
      findings.push(`${rel}: invalid status '${status}'`);
    }

    if (frontmatter.status === "active" && daysSince(frontmatter.last_reviewed) > 45) {
      findings.push(`${rel}: active note has not been reviewed in 45+ days`);
    }
    if (frontmatter.next_action && /^(none|n\/a|tbd)$/i.test(frontmatter.next_action)) {
      findings.push(`${rel}: next_action is not actionable`);
    }
  }

  const countText = Object.entries(counts)
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");

  return {
    status: findings.length ? "yellow" : "green",
    message: `${files.length} active-lane note(s): ${countText}.`,
    findings,
  };
}

function rootFileRoleStatus() {
  const roleMapPath = path.resolve(ROOT, "FILE_ROLES.md");
  if (!fs.existsSync(roleMapPath)) {
    return {
      status: "yellow",
      message: "FILE_ROLES.md is missing.",
      unclassified: [],
    };
  }

  const roleMap = fs.readFileSync(roleMapPath, "utf8");
  const classified = new Set(
    Array.from(roleMap.matchAll(/`([^`]+)`/g), (match) => match[1])
      .filter((entry) => !entry.includes("/") && !entry.includes("\\")),
  );

  const rootFiles = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name !== "FILE_ROLES.md");

  const unclassified = rootFiles.filter((name) => !classified.has(name)).sort();

  return {
    status: unclassified.length ? "yellow" : "green",
    message: unclassified.length
      ? `${unclassified.length} root file(s) missing from FILE_ROLES.md: ${unclassified.join(", ")}.`
      : "All root files are classified.",
    unclassified,
  };
}

function memoryOwnershipStatus() {
  const filePath = path.resolve(ROOT, "MEMORY_OWNERSHIP.md");
  if (!fs.existsSync(filePath)) {
    return { status: "yellow", message: "MEMORY_OWNERSHIP.md is missing." };
  }
  const text = fs.readFileSync(filePath, "utf8");
  const required = [
    "MEMORY.md",
    "memory/topics/*.md",
    "memory/YYYY-MM-DD.md",
    "memory/conversations/*.md",
    "runtime/trajectories/known_good.jsonl",
    "runtime/friction/ledger.jsonl",
    "runtime/auto_memory_candidates/*.json",
    "runtime/auto_memory/*.json",
  ];
  const missing = required.filter((surface) => !text.includes(surface));
  return {
    status: missing.length ? "yellow" : "green",
    message: missing.length
      ? `Missing ownership entries: ${missing.join(", ")}.`
      : "Memory-like durable surfaces have declared owners.",
  };
}

function trajectoryStatus() {
  const filePath = path.resolve(ROOT, process.env.DIZZY_TRAJECTORY_PATH || "runtime/trajectories/known_good.jsonl");
  if (!fs.existsSync(filePath)) {
    return { ok: true, status: "green", message: "No trajectory ledger yet." };
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  let malformed = 0;
  let weak = 0;
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (Number(row?.strength || 0) < 6) weak += 1;
    } catch {
      malformed += 1;
    }
  }

  if (malformed > 0) {
    return {
      ok: false,
      status: "yellow",
      message: `${lines.length} trajectories, ${malformed} malformed row(s).`,
    };
  }

  return {
    ok: true,
    status: weak > 0 ? "yellow" : "green",
    message: `${lines.length} trajectories${weak > 0 ? `, ${weak} below retrieval strength` : ""}.`,
  };
}

function frictionStatus() {
  const summary = summarizeFriction();
  if (summary.total === 0) return { status: "green", message: "No friction ledger yet." };
  if (summary.unresolved === 0) return { status: "green", message: `${summary.total} entries, all resolved.` };
  const top = summary.top.map((x) => `${x.friction_type}:${x.weight}`).join(", ");
  return {
    status: summary.unresolved >= 5 ? "yellow" : "green",
    message: `${summary.total} entries, ${summary.unresolved} unresolved${top ? `; top=${top}` : ""}.`,
  };
}

function latestCommitSummary() {
  const result = spawnSync("git", ["log", "-1", "--oneline"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
  });
  return String(result.stdout || "").trim() || "unknown";
}

function workQueueStatus() {
  const nextPath = path.resolve(ROOT, "NEXT.md");
  if (!fs.existsSync(nextPath)) return { open: 0, tier1: 0, next: "" };
  const text = fs.readFileSync(nextPath, "utf8");
  const workSection = text.split("## Work Queue")[1]?.split("## Completed")[0] || "";
  const work = workSection.split(/\r?\n/).filter((line) => /^- W-\d+/.test(line));
  const tier1 = work.filter((line) => /\[Tier 1\]/.test(line)).length;
  return { open: work.length, tier1, next: work[0] || "" };
}

function color(status) {
  if (status === "green") return "[green]";
  if (status === "yellow") return "[yellow]";
  return "[red]";
}

function checkFileDates() {
  const issues = [];
  const designMdPath = path.resolve(ROOT, "DESIGN.md");
  const stateJsonPath = path.resolve(ROOT, "state.json");

  if (fs.existsSync(designMdPath) && fs.existsSync(stateJsonPath)) {
    const designMtime = fs.statSync(designMdPath).mtimeMs;
    const stateMtime = fs.statSync(stateJsonPath).mtimeMs;
    if (designMtime > stateMtime + 1000) {
      issues.push("state.json is older than DESIGN.md. Run node scripts/sync_state.mjs.");
    }
  }

  return issues;
}

function scanZoneViolations() {
  const violations = [];
  const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true });
  for (const entry of rootFiles) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (name.startsWith("session") || name.startsWith("telegram") || name.endsWith(".jsonl") || name.startsWith("private")) {
      violations.push(`Root file ${name} may contain session/private material.`);
    }
  }

  const sensitivePatterns = [
    /GEMINI_API_KEY\s*=\s*['"](?!(\.\.\.|<.*>))[^'"]+['"]/i,
    /TELEGRAM_BOT_TOKEN\s*=\s*['"](?!(\.\.\.|<.*>))[^'"]+['"]/i,
    /DIZZY_AUTH_TOKEN\s*=\s*['"](?!(\.\.\.|<.*>))[^'"]+['"]/i,
  ];
  for (const entry of rootFiles) {
    if (!entry.isFile() || !/\.(md|json|mjs)$/.test(entry.name)) continue;
    const filePath = path.resolve(ROOT, entry.name);
    const content = fs.readFileSync(filePath, "utf8");
    for (const pattern of sensitivePatterns) {
      if (pattern.test(content)) violations.push(`Root file ${entry.name} appears to contain a hardcoded secret.`);
    }
  }

  return violations;
}

function schemaCheckFiles() {
  const issues = [];
  const trajPath = path.resolve(ROOT, process.env.DIZZY_TRAJECTORY_PATH || "runtime/trajectories/known_good.jsonl");
  if (fs.existsSync(trajPath)) {
    const lines = fs.readFileSync(trajPath, "utf8").split(/\r?\n/).filter(Boolean);
    lines.forEach((line, index) => {
      try {
        const obj = JSON.parse(line);
        if (!obj.goal) issues.push(`Trajectory line ${index + 1}: missing goal.`);
        if (!obj.reusable_pattern) issues.push(`Trajectory line ${index + 1}: missing reusable_pattern.`);
        if (!Array.isArray(obj.reuse_tags) || obj.reuse_tags.length === 0) issues.push(`Trajectory line ${index + 1}: reuse_tags must be non-empty.`);
      } catch (err) {
        issues.push(`Trajectory line ${index + 1}: invalid JSON (${err.message}).`);
      }
    });
  }

  const frictionPath = path.resolve(ROOT, process.env.DIZZY_FRICTION_PATH || "runtime/friction/ledger.jsonl");
  if (fs.existsSync(frictionPath)) {
    const lines = fs.readFileSync(frictionPath, "utf8").split(/\r?\n/).filter(Boolean);
    lines.forEach((line, index) => {
      try {
        const obj = JSON.parse(line);
        if (!obj.description) issues.push(`Friction line ${index + 1}: missing description.`);
        if (!obj.friction_type) issues.push(`Friction line ${index + 1}: missing friction_type.`);
      } catch (err) {
        issues.push(`Friction line ${index + 1}: invalid JSON (${err.message}).`);
      }
    });
  }

  return issues;
}

function main() {
  const results = CHECKS.map(runCheck);
  const staleFindings = listStaleUpgradeSignals();
  const upgrades = upgradeStatus();
  const rootRoles = rootFileRoleStatus();
  const ownership = memoryOwnershipStatus();
  const trajectories = trajectoryStatus();
  const metabolism = summarizeMemoryMetabolism();
  const friction = frictionStatus();
  const queue = workQueueStatus();
  const hardFailures = results.filter((r) => !r.ok && r.severity === "red");
  const softFailures = results.filter((r) => !r.ok && r.severity !== "red");
  const dateIssues = checkFileDates();
  const zoneViolations = scanZoneViolations();
  const schemaFailures = schemaCheckFiles();

  let overall = "green";
  if (
    softFailures.length ||
    staleFindings.length ||
    upgrades.status === "yellow" ||
    rootRoles.status === "yellow" ||
    ownership.status === "yellow" ||
    trajectories.status === "yellow" ||
    metabolism.status === "yellow" ||
    friction.status === "yellow" ||
    dateIssues.length ||
    zoneViolations.length ||
    schemaFailures.length
  ) overall = "yellow";
  if (hardFailures.length) overall = "red";

  console.log(`${color(overall)} Dizzy maintenance status`);
  console.log("");

  console.log("Operator brief:");
  console.log(`  latest_commit: ${latestCommitSummary()}`);
  console.log(`  open_work_items: ${queue.open} (${queue.tier1} Tier 1)`);
  console.log(`  next_queue_item: ${queue.next || "none"}`);
  const promotionDebt = queue.tier1 > 0
    ? `${queue.tier1} Tier 1 work item(s) block promotion`
    : metabolism.status === "yellow"
      ? "review memory metabolism findings"
      : upgrades.status === "yellow"
        ? "review upgrade status findings"
        : "none visible";
  console.log(`  promotion_debt: ${promotionDebt}`);
  console.log("");

  for (const result of results) {
    const status = result.ok ? "green" : result.severity;
    console.log(`${color(status)} ${result.label}`);
    if (!result.ok && result.output) {
      const lines = result.output.split(/\r?\n/).slice(0, 8);
      for (const line of lines) console.log(`  ${line}`);
    }
  }

  if (staleFindings.length) {
    console.log("");
    console.log("[yellow] Stale status signals");
    for (const finding of staleFindings) console.log(`  - ${finding}`);
  }

  console.log("");
  console.log(`${color(upgrades.status)} Upgrade status`);
  console.log(`  ${upgrades.message}`);
  for (const finding of upgrades.findings.slice(0, 8)) console.log(`  - ${finding}`);

  console.log("");
  console.log(`${color(rootRoles.status)} Root file roles`);
  console.log(`  ${rootRoles.message}`);

  console.log("");
  console.log(`${color(ownership.status)} Memory ownership`);
  console.log(`  ${ownership.message}`);

  console.log("");
  console.log(`${color(trajectories.status)} Trajectory ledger`);
  console.log(`  ${trajectories.message}`);

  console.log("");
  console.log(`${color(metabolism.status)} Memory metabolism`);
  console.log(`  ${metabolism.message}`);
  for (const finding of metabolism.findings.slice(0, 5)) {
    console.log(`  - ${finding.kind}: ${finding.message}`);
  }

  console.log("");
  console.log(`${color(friction.status)} Friction ledger`);
  console.log(`  ${friction.message}`);

  if (dateIssues.length) {
    console.log("");
    console.log("[yellow] Date freshness");
    for (const issue of dateIssues) console.log(`  - ${issue}`);
  }

  if (zoneViolations.length) {
    console.log("");
    console.log("[yellow] Zone hygiene");
    for (const issue of zoneViolations) console.log(`  - ${issue}`);
  }

  if (schemaFailures.length) {
    console.log("");
    console.log("[yellow] Ledger schema");
    for (const issue of schemaFailures) console.log(`  - ${issue}`);
  }

  console.log("");
  console.log("Actionable next steps:");
  if (overall === "green") {
    console.log("- No immediate maintenance action required.");
  } else {
    for (const failure of hardFailures) console.log(`- Fix ${failure.id}: ${failure.label}.`);
    for (const failure of softFailures) console.log(`- Review ${failure.id}: ${failure.label}.`);
    for (const finding of staleFindings) console.log(`- Clean stale status: ${finding}`);
    for (const finding of upgrades.findings.slice(0, 5)) console.log(`- Clean upgrade status: ${finding}`);
    if (rootRoles.status === "yellow") console.log("- Classify new root files in FILE_ROLES.md or move/archive them.");
    if (ownership.status === "yellow") console.log("- Update MEMORY_OWNERSHIP.md before adding new durable memory writers.");
    if (trajectories.status === "yellow") console.log("- Review trajectory ledger for malformed or weak entries.");
    if (metabolism.status === "yellow") console.log("- Review memory metabolism findings before adding richer memory automation.");
    if (friction.status === "yellow") console.log("- Review unresolved friction and convert the highest-weight item into a cleanup or experiment.");
    for (const issue of dateIssues) console.log(`- Review date freshness: ${issue}`);
    for (const issue of zoneViolations) console.log(`- Review zone hygiene: ${issue}`);
    for (const issue of schemaFailures) console.log(`- Review ledger schema: ${issue}`);
  }

  process.exit(hardFailures.length ? 1 : 0);
}

main();
