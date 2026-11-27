/**
 * Deterministic Repository & PR Secret Scanner (`npm run check:secrets`, Phase 3a/3b).
 *
 * Scans git-tracked files for accidentally committed secrets, private keys, cloud API keys,
 * and forbidden `.env` credential files without external binary dependencies.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const FORBIDDEN_TRACKED_FILENAMES = [
  /^\.env$/i,
  /^\.env\.(?!example$|sample$|template$).+/i,
  /(?:^|\/)id_rsa$/i,
  /(?:^|\/)id_ed25519$/i,
];

// Exclude intentional synthetic unit-test/attack fixtures
const TEST_FIXTURE_ALLOWLIST = new Set([
  "scripts/automated_attack_suite.mjs",
  "scripts/pii_safe_inference_proxy_test.mjs",
  "scripts/inter_agent_sanitization_proxy_test.mjs",
  "scripts/tool_sandbox_guardrails_test.mjs",
  "scripts/unified_audit_ledger_test.mjs",
  "scripts/fuzzing_and_injection_tests.mjs",
  "scripts/ops_hardening_and_backup_test.mjs",
  "scripts/safety_checks.mjs",
]);

const HIGH_CONFIDENCE_SECRET_PATTERNS = [
  { id: "private_key_pem", regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: "github_pat", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/ },
  { id: "aws_access_key_id", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "google_api_key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { id: "slack_token", regex: /\bxox[baprs]-[0-9A-Za-z-]{24,}\b/ },
];

const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const issues = [];

for (const relPath of tracked) {
  if (FORBIDDEN_TRACKED_FILENAMES.some((re) => re.test(relPath))) {
    issues.push(`${relPath}: forbidden credential filename tracked in git`);
    continue;
  }
  if (TEST_FIXTURE_ALLOWLIST.has(relPath)) continue;
  if (/\.(?:png|jpg|jpeg|gif|webp|ico|woff2?|sqlite)$/i.test(relPath)) continue;

  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) continue;
  const stat = fs.statSync(abs);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;

  const content = fs.readFileSync(abs, "utf8");
  for (const rule of HIGH_CONFIDENCE_SECRET_PATTERNS) {
    if (rule.regex.test(content)) {
      issues.push(`${relPath}: matched secret pattern '${rule.id}'`);
    }
  }
}

if (issues.length > 0) {
  console.error("SECRET_SCAN_FAILED");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`SECRET_SCAN_OK scanned_tracked_files=${tracked.length} leaks=0`);
