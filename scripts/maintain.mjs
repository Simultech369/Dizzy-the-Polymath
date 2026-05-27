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

function main() {
  const results = CHECKS.map(runCheck);
  const staleFindings = listStaleUpgradeSignals();
  const rootRoles = rootFileRoleStatus();
  const trajectories = trajectoryStatus();
  const friction = frictionStatus();
  const hardFailures = results.filter((r) => !r.ok && r.severity === "red");
  const softFailures = results.filter((r) => !r.ok && r.severity !== "red");

  let overall = "green";
  if (
    softFailures.length ||
    staleFindings.length ||
    rootRoles.status === "yellow" ||
    trajectories.status === "yellow" ||
    friction.status === "yellow"
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
  }

  process.exit(hardFailures.length ? 1 : 0);
}

main();
