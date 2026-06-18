import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function read(rel) {
  const abs = path.resolve(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function requireText(file, text, needle, issues) {
  if (!text.includes(needle)) issues.push(`${file}: missing '${needle}'`);
}

function validateImpactEvidence(reconciliation, issues) {
  const allowed = new Set(["none", "lockfile", "runtime_dependency", "external_contract", "provider_migration"]);
  const lines = reconciliation.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (!line.includes("Dependency/API impact:")) continue;

    const impactText = line.split("Dependency/API impact:", 2)[1]?.split("Evidence:", 1)[0] || "";
    const impacts = impactText
      .replace(/[().]/g, " ")
      .split(/[,;]/)
      .map((value) => value.trim().split(/\s+/)[0])
      .filter(Boolean);

    if (!impacts.length) {
      issues.push(`EXPERIMENT_RECONCILIATION.md:${index + 1}: missing impact classification after Dependency/API impact.`);
      continue;
    }

    for (const impact of impacts) {
      if (!allowed.has(impact)) {
        issues.push(`EXPERIMENT_RECONCILIATION.md:${index + 1}: unknown dependency/API impact '${impact}'.`);
      }
    }

    if (impacts.every((impact) => impact === "none")) continue;

    const evidenceMatches = Array.from(line.matchAll(/Evidence:\s*`([^`]+)`/g));
    if (!evidenceMatches.length) {
      issues.push(`EXPERIMENT_RECONCILIATION.md:${index + 1}: non-none dependency/API impact requires Evidence: \`dependency-evidence/...\`.`);
      continue;
    }

    for (const match of evidenceMatches) {
      const rel = match[1];
      if (!rel.startsWith("dependency-evidence/")) {
        issues.push(`EXPERIMENT_RECONCILIATION.md:${index + 1}: evidence path must live under dependency-evidence/: ${rel}`);
        continue;
      }
      const evidenceText = read(rel);
      if (!evidenceText) {
        issues.push(`EXPERIMENT_RECONCILIATION.md:${index + 1}: evidence file missing: ${rel}`);
        continue;
      }
      for (const heading of ["Impact Classification", "Affected Surface", "Verification", "Result", "Rollback Path", "Live-Check Gap"]) {
        requireText(rel, evidenceText, `## ${heading}`, issues);
      }
    }
  }
}

function main() {
  const issues = [];
  const warnings = [];

  const governance = read("DEPENDENCY_GOVERNANCE.md");
  const packageJsonText = read("package.json");
  const lockfile = read("package-lock.json");
  const maintain = read("scripts/maintain.mjs");
  const workflow = read(".github/workflows/checks.yml");
  const openrouter = read("scripts/openrouter_review.py");
  const reconciliation = read("EXPERIMENT_RECONCILIATION.md");
  const readiness = read("PRODUCTION_READINESS.md");
  const fileRoles = read("FILE_ROLES.md");
  const readme = read("README.md");

  if (!governance) issues.push("DEPENDENCY_GOVERNANCE.md is missing.");

  for (const surface of [
    "Node.js / GitHub Actions",
    "`redis` npm package",
    "`express` npm package",
    "`ethers` npm package",
    "`cheerio` npm package",
    "Redis-compatible server",
    "SQLite operational sidecar",
    "Telegram Bot API",
    "Gemini API",
    "OpenAI-compatible / OpenRouter API",
  ]) {
    requireText("DEPENDENCY_GOVERNANCE.md", governance, surface, issues);
  }

  for (const impact of ["none", "lockfile", "runtime_dependency", "external_contract", "provider_migration"]) {
    requireText("DEPENDENCY_GOVERNANCE.md", governance, impact, issues);
  }

  for (const dep of ["redis", "express", "ethers", "cheerio"]) {
    requireText("package.json", packageJsonText, `"${dep}"`, issues);
    requireText("package-lock.json", lockfile, `"node_modules/${dep}"`, issues);
  }

  requireText("scripts/maintain.mjs", maintain, "Dependency/API drift gate", issues);
  requireText(".github/workflows/checks.yml", workflow, "Dependency/API drift", issues);
  requireText("package.json", packageJsonText, "\"check:dependencies\"", issues);
  requireText("FILE_ROLES.md", fileRoles, "DEPENDENCY_GOVERNANCE.md", issues);
  requireText("README.md", readme, "check:dependencies", issues);
  requireText("PRODUCTION_READINESS.md", readiness, "Dependency and external API drift", issues);
  requireText("EXPERIMENT_RECONCILIATION.md", reconciliation, "Dependency/API impact:", issues);
  requireText("DEPENDENCY_GOVERNANCE.md", governance, "dependency-evidence/", issues);
  validateImpactEvidence(reconciliation, issues);

  if (/add_argument\(\s*["']--key["']/.test(openrouter)) {
    issues.push("scripts/openrouter_review.py still accepts --key; use env vars instead.");
  }
  if (/args\.key/.test(openrouter)) {
    issues.push("scripts/openrouter_review.py still reads args.key; use env vars instead.");
  }
  if (!/OPENROUTER_API_KEY/.test(openrouter) || !/OPENAI_COMPAT_API_KEY/.test(openrouter)) {
    issues.push("scripts/openrouter_review.py must read provider keys from OPENROUTER_API_KEY or OPENAI_COMPAT_API_KEY.");
  }

  if (!/node-version:\s*"20"/.test(workflow)) {
    warnings.push("CI Node version is not visibly pinned to Node 20.");
  }
  if (!/Node\.js 18\+/.test(readme)) {
    warnings.push("README no longer declares the main runtime Node.js support floor.");
  }

  if (issues.length) {
    console.log("[red] Dependency/API drift gate");
    for (const issue of issues) console.log(`- ${issue}`);
    if (warnings.length) {
      console.log("");
      console.log("[yellow] Dependency/API drift warnings");
      for (const warning of warnings) console.log(`- ${warning}`);
    }
    process.exit(1);
  }

  console.log("[green] Dependency/API drift gate");
  console.log("- Dependency matrix, credential rule, promotion impact evidence, and CI wiring are present.");
  if (warnings.length) {
    console.log("");
    console.log("[yellow] Dependency/API drift warnings");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}

main();
