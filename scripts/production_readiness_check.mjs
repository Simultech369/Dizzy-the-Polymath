import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const REQUIRED_AREAS = [
  "Minified front end",
  "Database",
  "Version control",
  "APIs",
  "Hosting and deployment",
  "Rate limiting",
  "Caching",
  "Scaling",
  "Error tracking",
  "Accessibility / ADA",
];

const REQUIRED_ENV_HINTS = [
  "DIZZY_BIND_HOST",
  "DIZZY_AUTH_TOKEN",
  "REDIS_URL",
  "DIZZY_RATE_LIMIT",
  "DIZZY_ERROR_TRACKING",
];

function read(rel) {
  const abs = path.resolve(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function hasFile(rel) {
  return fs.existsSync(path.resolve(ROOT, rel));
}

function checkContains(file, text, needle, issues) {
  if (!text.includes(needle)) issues.push(`${file}: missing '${needle}'`);
}

function main() {
  const issues = [];
  const warnings = [];

  const readiness = read("PRODUCTION_READINESS.md");
  const readme = read("README.md");
  const fileRoles = read("FILE_ROLES.md");
  const packageJson = read("package.json");
  const envExample = read(".env.example");
  const server = read("agent_server.mjs");
  const runtimeConfig = read("lib/runtime_config.mjs");

  if (!readiness) issues.push("PRODUCTION_READINESS.md is missing.");
  for (const area of REQUIRED_AREAS) {
    checkContains("PRODUCTION_READINESS.md", readiness, `| ${area} |`, issues);
  }

  checkContains("README.md", readme, "Production Readiness Checklist", issues);
  checkContains("FILE_ROLES.md", fileRoles, "PRODUCTION_READINESS.md", issues);
  checkContains("package.json", packageJson, "\"check:production\"", issues);

  for (const envName of REQUIRED_ENV_HINTS) {
    checkContains(".env.example", envExample, envName, issues);
  }

  checkContains("agent_server.mjs", server, "DIZZY_AUTH_TOKEN", issues);
  checkContains("lib/runtime_config.mjs", runtimeConfig, "DIZZY_BIND_HOST", issues);

  if (!hasFile("scripts/production_readiness_check.mjs")) {
    issues.push("scripts/production_readiness_check.mjs is missing.");
  }

  if (!/rate limit/i.test(server)) {
    warnings.push("Runtime rate limiting is documented but not yet implemented as middleware.");
  }
  if (!/sentry|error tracking|DIZZY_ERROR_TRACKING/i.test(envExample + server)) {
    warnings.push("External error tracking is not configured yet.");
  }
  if (!/source map|sourcemap/i.test(envExample + readiness)) {
    warnings.push("Source-map policy exists only as readiness documentation.");
  }

  if (issues.length) {
    console.log("[red] Production readiness wiring");
    for (const issue of issues) console.log(`- ${issue}`);
    if (warnings.length) {
      console.log("");
      console.log("[yellow] Production readiness implementation gaps");
      for (const warning of warnings) console.log(`- ${warning}`);
    }
    process.exit(1);
  }

  console.log("[green] Production readiness wiring");
  console.log(`- ${REQUIRED_AREAS.length} readiness areas integrated.`);
  if (warnings.length) {
    console.log("");
    console.log("[yellow] Production readiness implementation gaps");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}

main();
