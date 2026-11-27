/**
 * Dependency & Skill Supply-Chain Malicious Package Scanner (Phase 2).
 *
 * Scans:
 * 1. `skills/<name>/SKILL.md` and bundled scripts for Trojan-Source bidi Unicode,
 *    hidden prompt-injection payloads, base64 shell droppers, or curl|sh exfiltration.
 * 2. `package.json` & `package-lock.json` for known typosquat / malicious package names,
 *    insecure `http://` or raw IP tarball registries, and unexpected root-level lifecycle hooks.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SUPPLY_CHAIN_AUDIT_SCHEMA = "dizzy.supply_chain_audit.v1";

const KNOWN_MALICIOUS_OR_TYPOSQUAT_PACKAGES = new Set([
  "crossenv",
  "expresss",
  "lodahs",
  "ethers-js-v6-utils",
  "cheerio-scraper-pro",
  "promptfooo",
  "rediss-client",
  "event-stream-malicious",
  "flatmap-stream",
  "node-ipc-peacenotwar",
]);

const TROJAN_BIDI_RE = /[\u202A-\u202E\u2066-\u2069]/;
const SKILL_POISON_PATTERNS = [
  { id: "prompt_override_in_skill", regex: /ignore\s+(all\s+)?(previous|prior|system)\s+(instructions|rules|prompts)/i },
  { id: "pipe_to_shell_dropper", regex: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:ba)?sh\b/i },
  { id: "base64_eval_dropper", regex: /\bbase64\s+-d\b[^\n|]*\|\s*(?:ba)?sh\b|\beval\s*\(\s*Buffer\.from\([^)]+,\s*['"]base64['"]\)/i },
];

function walkFiles(dirPath, out = []) {
  if (!fs.existsSync(dirPath)) return out;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walkFiles(abs, out);
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

export function auditSkillDirectory(skillsDir = path.resolve(process.cwd(), "skills")) {
  const findings = [];
  const files = walkFiles(skillsDir);

  for (const absFile of files) {
    const rel = path.relative(process.cwd(), absFile).replace(/\\/g, "/");
    const content = fs.readFileSync(absFile, "utf8");

    if (TROJAN_BIDI_RE.test(content)) {
      findings.push({ target: rel, severity: "critical", rule_id: "trojan_bidi_unicode" });
    }
    for (const pat of SKILL_POISON_PATTERNS) {
      if (pat.regex.test(content)) {
        findings.push({ target: rel, severity: "critical", rule_id: pat.id });
      }
    }
  }

  return {
    ok: findings.length === 0,
    scanned_files: files.length,
    findings,
  };
}

export function auditDependencies(rootDir = process.cwd()) {
  const findings = [];
  const pkgPath = path.join(rootDir, "package.json");
  const lockPath = path.join(rootDir, "package-lock.json");

  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.optionalDependencies || {}),
    };

    for (const [name, spec] of Object.entries(allDeps)) {
      const lower = name.toLowerCase();
      if (KNOWN_MALICIOUS_OR_TYPOSQUAT_PACKAGES.has(lower)) {
        findings.push({ target: `package.json:${name}`, severity: "critical", rule_id: "known_typosquat_or_malicious" });
      }
      const specStr = String(spec || "");
      if (/^(?:http:\/\/|git\+http:\/\/)/i.test(specStr)) {
        findings.push({ target: `package.json:${name}`, severity: "high", rule_id: "insecure_http_dependency_spec" });
      }
      if (/https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/i.test(specStr)) {
        findings.push({ target: `package.json:${name}`, severity: "critical", rule_id: "raw_ip_tarball_url" });
      }
    }

    const scripts = pkg.scripts || {};
    for (const hook of ["preinstall", "postinstall", "install"]) {
      if (scripts[hook] && /\b(?:curl|wget|nc|powershell\s+-enc)\b/i.test(scripts[hook])) {
        findings.push({ target: `package.json:scripts.${hook}`, severity: "critical", rule_id: "suspicious_install_hook" });
      }
    }
  }

  let lockPackagesScanned = 0;
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    const packages = lock.packages || {};
    for (const [pkgKey, meta] of Object.entries(packages)) {
      if (!pkgKey) continue;
      lockPackagesScanned += 1;
      const pkgName = pkgKey.replace(/^.*node_modules\//, "").toLowerCase();
      if (KNOWN_MALICIOUS_OR_TYPOSQUAT_PACKAGES.has(pkgName)) {
        findings.push({ target: `package-lock.json:${pkgName}`, severity: "critical", rule_id: "known_typosquat_or_malicious" });
      }
      const resolved = String(meta?.resolved || "");
      if (resolved && /^http:\/\//i.test(resolved)) {
        findings.push({ target: `package-lock.json:${pkgName}`, severity: "high", rule_id: "insecure_http_resolved_tarball" });
      }
    }
  }

  return {
    ok: findings.length === 0,
    lock_packages_scanned: lockPackagesScanned,
    findings,
  };
}

export function runSupplyChainSecurityAudit(rootDir = process.cwd()) {
  const skills = auditSkillDirectory(path.join(rootDir, "skills"));
  const deps = auditDependencies(rootDir);
  const allFindings = [...skills.findings, ...deps.findings];
  const core = {
    schema_version: SUPPLY_CHAIN_AUDIT_SCHEMA,
    timestamp: new Date().toISOString(),
    ok: allFindings.length === 0,
    skill_files_scanned: skills.scanned_files,
    lock_packages_scanned: deps.lock_packages_scanned,
    findings: allFindings,
  };
  const receiptSha256 = crypto.createHash("sha256").update(JSON.stringify(core), "utf8").digest("hex");
  return { ...core, receipt_sha256: receiptSha256 };
}
