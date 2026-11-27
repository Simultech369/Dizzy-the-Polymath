/**
 * Memory Retention (Keep vs Delete) Policy & Bad/Poisoned Stored Content Scanner (Phase 1).
 *
 * Enforces:
 * 1. Explicit rules for keeping vs deleting memory records with hash-backed receipts.
 * 2. Deterministic scanning of stored memory/wiki files for prompt injection, exfiltration
 *    commands, raw secrets/PII, or cross-zone disclosure violations (`do_not_export` in public).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { durableAppendJsonl } from "./durable_write_policy.mjs";

export const MEMORY_RETENTION_RECEIPT_SCHEMA = "dizzy.memory_retention_receipt.v1";
export const MEMORY_HYGIENE_SCAN_SCHEMA = "dizzy.memory_hygiene_scan_receipt.v1";

export const ZONE_MAX_AGE_DAYS = Object.freeze({
  private_self: 365,
  trusted_collaborator: 90,
  outside_contact: 0, // Must not retain durable memory by default
  paid_public: 0,     // Must not retain durable memory; client continuity uses separate 7d TTL
});

const STORED_POISON_PATTERNS = [
  { id: "prompt_override", regex: /ignore\s+(all\s+)?(previous|prior|system)\s+(instructions|rules|prompts)/i },
  { id: "role_delimiter_spoof", regex: /(?:<\|im_start\|>|<\|system\|>|<<SYS>>|\[INST\])/i },
  { id: "stealth_exfiltration_cmd", regex: /\b(?:curl|wget|nc|netcat|Invoke-WebRequest)\b[^\n]*(?:\||;|&&|\$\(|`)/i },
  { id: "privilege_override_directive", regex: /\b(?:grant_admin|bypass_hitl|disable_trust_zone|override_consistency_boundary)\b/i },
];

const STORED_SECRET_PATTERNS = [
  { id: "api_or_bearer_secret", regex: /(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16})/ },
  { id: "private_key_pem", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: "raw_ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/ },
];

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256HexLower(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

/**
 * Scans stored memory content and metadata for poisoned instructions, secrets, or zone bleed.
 */
export function scanStoredMemoryRecord({
  memoryId = "unknown",
  content = "",
  trustZone = "private_self",
  sensitivityTier = "normal",
} = {}) {
  const text = String(content ?? "");
  const findings = [];

  for (const rule of STORED_POISON_PATTERNS) {
    if (rule.regex.test(text)) {
      findings.push({ category: "poisoned_instruction", rule_id: rule.id, severity: "critical" });
    }
  }

  for (const rule of STORED_SECRET_PATTERNS) {
    if (rule.regex.test(text)) {
      findings.push({ category: "stored_secret_or_pii", rule_id: rule.id, severity: "high" });
    }
  }

  if (
    (trustZone === "paid_public" || trustZone === "outside_contact") &&
    sensitivityTier === "do_not_export"
  ) {
    findings.push({
      category: "cross_zone_sensitivity_violation",
      rule_id: "do_not_export_in_public_zone",
      severity: "critical",
    });
  }

  return {
    clean: findings.length === 0,
    memory_id: memoryId,
    trust_zone: trustZone,
    sensitivity_tier: sensitivityTier,
    content_sha256: sha256HexLower(text),
    findings,
  };
}

/**
 * Evaluates explicit keep vs delete rules for a stored memory item and seals a receipt.
 */
export function evaluateMemoryRetention(record = {}, {
  now = new Date(),
  ledgerPath = null,
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const memoryId = String(record.memory_id || record.id || `mem_${crypto.randomBytes(4).toString("hex")}`);
  const trustZone = String(record.trust_zone || "private_self");
  const sensitivityTier = String(record.sensitivity_tier || "normal");
  const importance = Number.isFinite(Number(record.importance)) ? Number(record.importance) : 0.5;
  const createdMs = record.created_at ? new Date(record.created_at).getTime() : nowDate.getTime();
  const ageDays = Math.max(0, (nowDate.getTime() - createdMs) / (1000 * 60 * 60 * 24));

  const scan = scanStoredMemoryRecord({
    memoryId,
    content: record.content || "",
    trustZone,
    sensitivityTier,
  });

  let decision = "keep";
  let reason = "within_zone_retention_policy";

  if (!scan.clean) {
    decision = "delete";
    reason = `tainted_stored_content:${scan.findings.map((f) => f.rule_id).join(",")}`;
  } else if (!Object.prototype.hasOwnProperty.call(ZONE_MAX_AGE_DAYS, trustZone)) {
    decision = "delete";
    reason = "unknown_trust_zone_fail_closed";
  } else if (ZONE_MAX_AGE_DAYS[trustZone] === 0) {
    decision = "delete";
    reason = `durable_memory_forbidden_in_${trustZone}`;
  } else if (record.operator_delete_requested === true || record.memory_status === "revoked") {
    decision = "delete";
    reason = "explicit_operator_revocation";
  } else if (ageDays > ZONE_MAX_AGE_DAYS[trustZone] && importance < 0.8) {
    decision = "delete";
    reason = `expired_zone_ttl_${ZONE_MAX_AGE_DAYS[trustZone]}d`;
  }

  const receiptCore = {
    schema_version: MEMORY_RETENTION_RECEIPT_SCHEMA,
    timestamp: nowDate.toISOString(),
    memory_id: memoryId,
    trust_zone: trustZone,
    sensitivity_tier: sensitivityTier,
    age_days: Math.round(ageDays * 100) / 100,
    importance,
    hygiene_clean: scan.clean,
    findings: scan.findings,
    content_sha256: scan.content_sha256,
    decision,
    reason,
  };
  const receipt = {
    ...receiptCore,
    receipt_sha256: sha256HexLower(stableJson(receiptCore)),
  };

  if (ledgerPath) {
    durableAppendJsonl(path.resolve(process.cwd(), ledgerPath), receipt);
  }

  return {
    decision,
    reason,
    scan,
    receipt,
  };
}

/**
 * Scans a directory of Markdown memory files for poisoned/tainted content, optionally
 * quarantining and deleting bad files while writing an auditable scan receipt.
 */
export function scanMemoryDirectory(targetDir, {
  remediate = false,
  quarantineDir = null,
  ledgerPath = null,
  trustZone = "private_self",
  now = new Date(),
} = {}) {
  const resolvedDir = path.resolve(process.cwd(), targetDir);
  const nowDate = now instanceof Date ? now : new Date(now);
  const scannedFiles = [];
  const taintedFiles = [];
  const deletedFiles = [];

  if (fs.existsSync(resolvedDir)) {
    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const fullPath = path.join(resolvedDir, entry.name);
      const raw = fs.readFileSync(fullPath, "utf8");
      const scan = scanStoredMemoryRecord({
        memoryId: entry.name,
        content: raw,
        trustZone,
      });
      scannedFiles.push(entry.name);

      if (!scan.clean) {
        taintedFiles.push({
          file: entry.name,
          content_sha256: scan.content_sha256,
          findings: scan.findings,
        });

        if (remediate) {
          if (quarantineDir) {
            const qDir = path.resolve(process.cwd(), quarantineDir);
            fs.mkdirSync(qDir, { recursive: true });
            fs.writeFileSync(
              path.join(qDir, `${entry.name}.quarantined.json`),
              JSON.stringify({ quarantined_at: nowDate.toISOString(), scan }, null, 2),
              "utf8"
            );
          }
          fs.unlinkSync(fullPath);
          deletedFiles.push(entry.name);
        }
      }
    }
  }

  const summaryCore = {
    schema_version: MEMORY_HYGIENE_SCAN_SCHEMA,
    timestamp: nowDate.toISOString(),
    scanned_count: scannedFiles.length,
    tainted_count: taintedFiles.length,
    deleted_count: deletedFiles.length,
    tainted_files: taintedFiles,
    deleted_files: deletedFiles,
  };
  const receipt = {
    ...summaryCore,
    receipt_sha256: sha256HexLower(stableJson(summaryCore)),
  };

  if (ledgerPath) {
    durableAppendJsonl(path.resolve(process.cwd(), ledgerPath), receipt);
  }

  return receipt;
}
