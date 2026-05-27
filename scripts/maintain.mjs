import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

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

function color(status) {
  if (status === "green") return "[green]";
  if (status === "yellow") return "[yellow]";
  return "[red]";
}

function main() {
  const results = CHECKS.map(runCheck);
  const staleFindings = listStaleUpgradeSignals();
  const hardFailures = results.filter((r) => !r.ok && r.severity === "red");
  const softFailures = results.filter((r) => !r.ok && r.severity !== "red");

  let overall = "green";
  if (softFailures.length || staleFindings.length) overall = "yellow";
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
  console.log("Actionable next steps:");
  if (overall === "green") {
    console.log("- No immediate maintenance action required.");
  } else {
    for (const failure of hardFailures) console.log(`- Fix ${failure.id}: ${failure.label}.`);
    for (const failure of softFailures) console.log(`- Review ${failure.id}: ${failure.label}.`);
    for (const finding of staleFindings) console.log(`- Clean stale status: ${finding}`);
  }

  process.exit(hardFailures.length ? 1 : 0);
}

main();
