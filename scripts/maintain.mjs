import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

import { summarizeFriction } from "../lib/friction_ledger.mjs";

const ROOT = process.cwd();

const CHECKS = [
  {
    id: "safety",
    label: "Runtime safety checks",
    command: ["node", "scripts/safety_checks.mjs"],
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
    Array.from(roleMap.matchAll(/`([^`/\\]+)`/g), (match) => match[1]),
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

function color(status) {
  if (status === "green") return "[green]";
  if (status === "yellow") return "[yellow]";
  return "[red]";
}

function checkFileDates() {
  const issues = [];
  const memoryMdPath = path.resolve(ROOT, "MEMORY.md");
  const designMdPath = path.resolve(ROOT, "DESIGN.md");
  const stateJsonPath = path.resolve(ROOT, "state.json");
  
  if (fs.existsSync(designMdPath) && fs.existsSync(stateJsonPath)) {
    const designMtime = fs.statSync(designMdPath).mtimeMs;
    const stateMtime = fs.statSync(stateJsonPath).mtimeMs;
    if (designMtime > stateMtime + 1000) {
      issues.push("state.json is older than DESIGN.md. Needs sync (node scripts/sync_state.mjs).");
    }
  }
  
  if (fs.existsSync(memoryMdPath)) {
    const memoryMtime = fs.statSync(memoryMdPath).mtimeMs;
    const topicsDir = path.resolve(ROOT, "memory/topics");
    if (fs.existsSync(topicsDir)) {
      const topicFiles = fs.readdirSync(topicsDir).filter(f => f.endsWith(".md"));
      let topicNewerThanIndex = false;
      for (const file of topicFiles) {
        const topicMtime = fs.statSync(path.resolve(topicsDir, file)).mtimeMs;
        if (topicMtime > memoryMtime + 1000) {
          topicNewerThanIndex = true;
          break;
        }
      }
      if (topicNewerThanIndex) {
        issues.push("One or more memory/topics files are newer than MEMORY.md. The long-term memory index may need an update.");
      }
    }
  }
  return issues;
}

function scanZoneViolations() {
  const violations = [];
  const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true });
  for (const entry of rootFiles) {
    if (entry.isFile()) {
      const name = entry.name;
      if (name.startsWith("session") || name.startsWith("telegram") || name.endsWith(".jsonl") || name.startsWith("private")) {
        violations.push(`File ${name} in root directory might violate trust zone boundaries (contains session or private data).`);
      }
    }
  }
  
  const filesToScan = rootFiles.filter(e => e.isFile() && (e.name.endsWith(".md") || e.name.endsWith(".json") || e.name.endsWith(".mjs")));
  const sensitiveKeywords = [
    /GEMINI_API_KEY\s*=\s*['"](?!(\.\.\.|\<.*\>))[^'"]+['"]/i,
    /TELEGRAM_BOT_TOKEN\s*=\s*['"](?!(\.\.\.|\<.*\>))[^'"]+['"]/i,
    /DIZZY_AUTH_TOKEN\s*=\s*['"](?!(\.\.\.|\<.*\>))[^'"]+['"]/i
  ];
  for (const file of filesToScan) {
    const filePath = path.resolve(ROOT, file.name);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      for (const pattern of sensitiveKeywords) {
        if (pattern.test(content)) {
          violations.push(`File ${file.name} contains hardcoded API key or token (zone violation).`);
        }
      }
    } catch {
      // Ignore
    }
  }

  return violations;
}

function schemaCheckFiles() {
  const issues = [];
  
  // 1. Validate Trajectories
  const trajPath = path.resolve(ROOT, process.env.DIZZY_TRAJECTORY_PATH || "runtime/trajectories/known_good.jsonl");
  if (fs.existsSync(trajPath)) {
    const lines = fs.readFileSync(trajPath, "utf8").split(/\r?\n/).filter(Boolean);
    lines.forEach((line, index) => {
      try {
        const obj = JSON.parse(line);
        if (!obj.goal) issues.push(`Trajectory line ${index + 1}: missing 'goal'`);
        if (!obj.reusable_pattern) issues.push(`Trajectory line ${index + 1}: missing 'reusable_pattern'`);
        if (!obj.reuse_tags || !Array.isArray(obj.reuse_tags) || obj.reuse_tags.length === 0) {
          issues.push(`Trajectory line ${index + 1}: 'reuse_tags' must be a non-empty array`);
        }
        if (obj.strength !== undefined && (typeof obj.strength !== "number" || obj.strength < 1 || obj.strength > 10)) {
          issues.push(`Trajectory line ${index + 1}: 'strength' must be a number between 1 and 10`);
        }
      } catch (e) {
        issues.push(`Trajectory line ${index + 1}: invalid JSON: ${e.message}`);
      }
    });
  }

  // 2. Validate Friction Ledger
  const fricPath = path.resolve(ROOT, process.env.DIZZY_FRICTION_PATH || "runtime/friction/ledger.jsonl");
  if (fs.existsSync(fricPath)) {
    const lines = fs.readFileSync(fricPath, "utf8").split(/\r?\n/).filter(Boolean);
    lines.forEach((line, index) => {
      try {
        const obj = JSON.parse(line);
        if (!obj.description) issues.push(`Friction line ${index + 1}: missing 'description'`);
        if (!obj.friction_type) issues.push(`Friction line ${index + 1}: missing 'friction_type'`);
        if (obj.severity !== undefined && (typeof obj.severity !== "number" || obj.severity < 1 || obj.severity > 10)) {
          issues.push(`Friction line ${index + 1}: 'severity' must be a number between 1 and 10`);
        }
      } catch (e) {
        issues.push(`Friction line ${index + 1}: invalid JSON: ${e.message}`);
      }
    });
  }
  
  return issues;
}

function checkUpgradeProposalsFrontmatter() {
  const issues = [];
  const activeDir = path.resolve(ROOT, "upgrades/active");
  if (!fs.existsSync(activeDir)) return issues;

  const files = fs.readdirSync(activeDir).filter(f => f.endsWith(".md"));
  const validStatuses = [
    "runtime-enforced",
    "constitutional",
    "operator overlay",
    "planning candidate",
    "historical provenance",
    "deprecated"
  ];

  for (const file of files) {
    const filePath = path.resolve(activeDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    
    const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (!match) {
      issues.push(`Upgrade proposal ${file} is missing YAML frontmatter.`);
      continue;
    }

    const yamlLines = match[1].split(/\r?\n/);
    const meta = {};
    for (const line of yamlLines) {
      const parts = line.split(":");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(":").trim().replace(/^['"]|['"]$/g, "");
        meta[key] = value;
      }
    }

    if (!meta.status) {
      issues.push(`Upgrade proposal ${file} frontmatter is missing 'status' field.`);
    } else if (!validStatuses.includes(meta.status)) {
      issues.push(`Upgrade proposal ${file} has invalid status '${meta.status}'. Must be one of: ${validStatuses.join(", ")}`);
    }

    if (!meta.id && file.startsWith("W-")) {
      issues.push(`Upgrade proposal ${file} is missing 'id' field in frontmatter.`);
    }
  }

  return issues;
}

function updateNextMdWithIssues(issues) {
  const filePath = path.resolve(ROOT, "NEXT.md");
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, "utf8");
  content = content.replace(/\r\n/g, "\n");

  const lines = content.split("\n");
  const workQueueIndex = lines.findIndex((line) => line.trim().startsWith("## Work Queue"));
  if (workQueueIndex === -1) return;

  let nextSectionIndex = -1;
  for (let i = workQueueIndex + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("##") || lines[i].trim().startsWith("---")) {
      nextSectionIndex = i;
      break;
    }
  }
  if (nextSectionIndex === -1) nextSectionIndex = lines.length;

  const workQueueLines = lines.slice(workQueueIndex + 1, nextSectionIndex);
  
  const newTasks = [];
  issues.forEach((issue) => {
    const exists = workQueueLines.some((line) => line.toLowerCase().includes(issue.toLowerCase()));
    if (!exists) {
      newTasks.push(`- [ ] Maintenance: ${issue}`);
    }
  });

  if (newTasks.length === 0) return;

  const before = lines.slice(0, workQueueIndex + 1);
  const queueContent = [];
  for (const line of workQueueLines) {
    if (line.trim() || queueContent.length > 0) {
      queueContent.push(line);
    }
  }

  while (queueContent.length > 0 && !queueContent[queueContent.length - 1].trim()) {
    queueContent.pop();
  }

  if (queueContent.length > 0 && queueContent[queueContent.length - 1].trim()) {
    queueContent.push("");
  }
  
  newTasks.forEach((task) => {
    queueContent.push(task);
  });
  
  queueContent.push("");
  
  const after = lines.slice(nextSectionIndex);
  
  const updatedContent = [...before, ...queueContent, ...after].join("\n");
  fs.writeFileSync(filePath, updatedContent, "utf8");
}

function main() {
  const results = CHECKS.map(runCheck);
  const staleFindings = listStaleUpgradeSignals();
  const rootRoles = rootFileRoleStatus();
  const trajectories = trajectoryStatus();
  const friction = frictionStatus();
  const hardFailures = results.filter((r) => !r.ok && r.severity === "red");
  const softFailures = results.filter((r) => !r.ok && r.severity !== "red");

  const dateIssues = checkFileDates();
  const zoneViolations = scanZoneViolations();
  const schemaFailures = schemaCheckFiles();
  const frontmatterIssues = checkUpgradeProposalsFrontmatter();

  const allIssues = [];
  for (const check of results) {
    if (!check.ok) allIssues.push(`Check failed: ${check.label} (${check.id})`);
  }
  for (const finding of staleFindings) {
    allIssues.push(`Stale signal: ${finding}`);
  }
  if (rootRoles.status === "yellow") {
    rootRoles.unclassified.forEach(file => {
      allIssues.push(`Unclassified root file: ${file}`);
    });
  }
  allIssues.push(...dateIssues);
  allIssues.push(...zoneViolations);
  allIssues.push(...schemaFailures);
  allIssues.push(...frontmatterIssues);

  const isReport = process.argv.includes("--report");

  if (isReport) {
    updateNextMdWithIssues(allIssues);

    console.log("# Dizzy Maintenance Report");
    console.log(`Generated on: ${new Date().toISOString()}`);
    console.log("");
    console.log(`Overall Status: ${hardFailures.length ? "RED" : (allIssues.length ? "YELLOW" : "GREEN")}`);
    console.log("");
    console.log("## Standard Checks");
    for (const result of results) {
      console.log(`- [${result.ok ? "OK" : "FAIL"}] ${result.label} (${result.id})`);
    }
    console.log("");
    console.log("## Additional Diagnostics");
    console.log(`- **Date Issues**: ${dateIssues.length ? dateIssues.join("; ") : "None"}`);
    console.log(`- **Zone Violations**: ${zoneViolations.length ? zoneViolations.join("; ") : "None"}`);
    console.log(`- **Schema Failures**: ${schemaFailures.length ? schemaFailures.join("; ") : "None"}`);
    console.log(`- **Upgrade Proposal Frontmatter**: ${frontmatterIssues.length ? frontmatterIssues.join("; ") : "None"}`);
    console.log(`- **Root File Roles**: ${rootRoles.message}`);
    console.log(`- **Trajectories**: ${trajectories.message}`);
    console.log(`- **Friction**: ${friction.message}`);
    console.log("");
    console.log("## Actions Taken");
    if (allIssues.length) {
      console.log(`- Synchronized ${allIssues.length} maintenance issues to NEXT.md Work Queue.`);
    } else {
      console.log("- No issues found. Work Queue is clean.");
    }
    process.exit(hardFailures.length ? 1 : 0);
    return;
  }

  let overall = "green";
  if (
    softFailures.length ||
    staleFindings.length ||
    rootRoles.status === "yellow" ||
    trajectories.status === "yellow" ||
    friction.status === "yellow" ||
    dateIssues.length ||
    zoneViolations.length ||
    schemaFailures.length ||
    frontmatterIssues.length
  ) overall = "yellow";
  if (hardFailures.length) overall = "red";

  console.log(`${color(overall)} Dizzy maintenance status`);
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
  console.log(`${color(rootRoles.status)} Root file roles`);
  console.log(`  ${rootRoles.message}`);

  console.log("");
  console.log(`${color(trajectories.status)} Trajectory ledger`);
  console.log(`  ${trajectories.message}`);

  console.log("");
  console.log(`${color(friction.status)} Friction ledger`);
  console.log(`  ${friction.message}`);

  if (dateIssues.length) {
    console.log("");
    console.log("[yellow] Date Issues");
    for (const issue of dateIssues) console.log(`  - ${issue}`);
  }

  if (zoneViolations.length) {
    console.log("");
    console.log("[yellow] Zone Violations");
    for (const v of zoneViolations) console.log(`  - ${v}`);
  }

  if (schemaFailures.length) {
    console.log("");
    console.log("[yellow] Schema Failures");
    for (const f of schemaFailures) console.log(`  - ${f}`);
  }

  if (frontmatterIssues.length) {
    console.log("");
    console.log("[yellow] Upgrade Frontmatter Failures");
    for (const f of frontmatterIssues) console.log(`  - ${f}`);
  }

  console.log("");
  console.log("Actionable next steps:");
  if (overall === "green") {
    console.log("- No immediate maintenance action required.");
  } else {
    for (const failure of hardFailures) console.log(`- Fix ${failure.id}: ${failure.label}.`);
    for (const failure of softFailures) console.log(`- Review ${failure.id}: ${failure.label}.`);
    for (const finding of staleFindings) console.log(`- Clean stale status: ${finding}`);
    if (rootRoles.status === "yellow") console.log("- Classify new root files in FILE_ROLES.md or move/archive them.");
    if (trajectories.status === "yellow") console.log("- Review trajectory ledger for malformed or weak entries.");
    if (friction.status === "yellow") console.log("- Review unresolved friction and convert the highest-weight item into a cleanup or experiment.");
    for (const issue of dateIssues) console.log(`- Date Sync Issue: ${issue}`);
    for (const v of zoneViolations) console.log(`- Zone boundary violation: ${v}`);
    for (const f of schemaFailures) console.log(`- Schema failure: ${f}`);
    for (const f of frontmatterIssues) console.log(`- Upgrade proposal frontmatter error: ${f}`);
  }

  process.exit(hardFailures.length ? 1 : 0);
}

main();
