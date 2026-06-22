import fs from "fs";
import path from "path";

import { parseFrontmatter } from "../lib/markdown_frontmatter.mjs";

const ROOT = process.cwd();

const MAX_LINES = Number(process.env.DIZZY_MEMORY_INDEX_MAX_LINES || 200) || 200;
const MAX_BYTES = Number(process.env.DIZZY_MEMORY_INDEX_MAX_BYTES || 25_000) || 25_000;
const MAX_LINE_CHARS = Number(process.env.DIZZY_MEMORY_INDEX_MAX_LINE_CHARS || 240) || 240;

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function byteLen(s) {
  return Buffer.byteLength(String(s ?? ""), "utf8");
}

function parseMarkdownLinks(markdown) {
  const out = [];
  const re = /\[[^\]]+\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(markdown))) {
    const raw = String(m[1] || "").trim();
    const withoutFragment = raw.split("#")[0] || "";
    out.push(withoutFragment.trim());
  }
  return out;
}

function isRelativePath(p) {
  const x = String(p || "").replace(/\\/g, "/").trim();
  if (!x) return false;
  if (x.startsWith("/") || /^[a-zA-Z]:\//.test(x)) return false;
  if (x.includes("..")) return false;
  return true;
}

function validateMemoryIndex() {
  const filePath = path.resolve(ROOT, "MEMORY.md");
  if (!fs.existsSync(filePath)) {
    console.error("FAIL: MEMORY.md missing.");
    return { ok: false };
  }

  const raw = readText(filePath).replace(/\r\n/g, "\n");
  const trimmed = raw.trim();
  const lines = trimmed ? trimmed.split("\n") : [];
  const bytes = byteLen(raw);

  const errors = [];
  const warnings = [];

  if (lines.length > MAX_LINES) {
    errors.push(`Too many lines: ${lines.length} (max ${MAX_LINES}).`);
  }
  if (bytes > MAX_BYTES) {
    errors.push(`Too many bytes: ${bytes} (max ${MAX_BYTES}).`);
  }

  const longLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (line.length > MAX_LINE_CHARS) {
      longLines.push({ line: i + 1, chars: line.length });
      if (longLines.length >= 10) break;
    }
  }
  if (longLines.length) {
    errors.push(
      `Overlong index lines (first ${longLines.length}): ` +
        longLines.map((x) => `L${x.line}=${x.chars}ch`).join(", "),
    );
  }

  const indexStart = raw.indexOf("\n## Index");
  const indexText = indexStart >= 0 ? raw.slice(indexStart) : raw;

  const links = parseMarkdownLinks(indexText)
    .filter((p) => isRelativePath(p))
    .filter((p) => p.toLowerCase().endsWith(".md"));

  const missing = [];
  for (const rel of links) {
    const abs = path.resolve(ROOT, rel);
    if (!fs.existsSync(abs)) missing.push(rel);
    if (fs.existsSync(abs) && rel.replace(/\\/g, "/").startsWith("memory/topics/")) {
      const metadataIssues = validateTopicMetadata(rel, readText(abs));
      for (const issue of metadataIssues.errors) errors.push(issue);
      for (const issue of metadataIssues.warnings) warnings.push(issue);
    }
    if (missing.length >= 10) break;
  }
  if (missing.length) {
    errors.push(`Missing linked files (first ${missing.length}): ${missing.join(", ")}`);
  }

  if (errors.length) {
    console.error("FAIL: MEMORY.md validation failed:");
    for (const e of errors) console.error(`- ${e}`);
    return { ok: false };
  }

  console.log(`OK: MEMORY.md (${lines.length} lines, ${bytes} bytes).`);
  for (const warning of warnings) console.warn(`WARN: ${warning}`);
  return { ok: true };
}

function validateTopicMetadata(rel, text) {
  const { data } = parseFrontmatter(text);
  const errors = [];
  const warnings = [];
  if (!data) {
    warnings.push(`${rel}: missing memory metadata frontmatter`);
    return { errors, warnings };
  }

  const required = [
    "memory_type",
    "memory_class",
    "captured_at",
    "event_time",
    "event_time_basis",
    "source",
    "confidence",
    "freshness_window",
    "sensitivity_class",
    "quantitative_attribution",
    "zone_origin",
    "zone_allowed",
    "last_reviewed",
    "revocation_path",
  ];
  for (const key of required) {
    if (!data[key]) errors.push(`${rel}: missing ${key}`);
  }

  const enums = {
    memory_type: ["semantic", "episodic"],
    memory_class: ["user_claim", "assistant_observation", "project_decision", "reusable_pattern"],
    source: ["operator_reviewed", "assistant_proposed", "runtime_generated", "imported_reference"],
    scope: ["private", "project", "client", "public", "operational"],
    confidence: ["low", "medium", "high"],
    sensitivity_class: ["normal", "sensitive", "do_not_export"],
    quantitative_attribution: ["none", "required", "present"],
    zone_origin: ["private_self", "trusted_collaborator", "outside_contact", "paid_public", "project"],
    memory_status: ["active", "revoked"],
  };
  for (const [key, allowed] of Object.entries(enums)) {
    if (data[key] && !allowed.includes(String(data[key]).trim().toLowerCase())) {
      errors.push(`${rel}: invalid ${key} '${data[key]}'`);
    }
  }

  for (const key of ["captured_at", "event_time", "last_reviewed"]) {
    if (data[key] && Number.isNaN(new Date(`${data[key]}T00:00:00Z`).getTime())) {
      errors.push(`${rel}: invalid ${key} '${data[key]}'`);
    }
  }

  if (data.zone_allowed) {
    const allowed = String(data.zone_allowed).split(",").map((x) => x.trim()).filter(Boolean);
    const valid = new Set(["private_self", "trusted_collaborator", "outside_contact", "paid_public"]);
    for (const zone of allowed) {
      if (!valid.has(zone)) errors.push(`${rel}: invalid zone_allowed '${zone}'`);
    }
  }

  return { errors, warnings };
}

const res = validateMemoryIndex();
process.exit(res.ok ? 0 : 1);
