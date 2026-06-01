import fs from "fs";
import path from "path";
import { validateMemoryProvenance } from "./provenance.mjs";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function trajectoryPath() {
  return path.resolve(process.cwd(), String(env("DIZZY_TRAJECTORY_PATH", "runtime/trajectories/known_good.jsonl")));
}

function normalizePattern(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter((row) => row.line.trim());
}

export function summarizeMemoryMetabolism(opts = {}) {
  const filePath = opts.filePath ? path.resolve(process.cwd(), opts.filePath) : trajectoryPath();
  const rows = readJsonl(filePath);
  const findings = [];
  const patternMap = new Map();
  let valid = 0;

  for (const row of rows) {
    let parsed;
    try {
      parsed = JSON.parse(row.line);
    } catch {
      findings.push({
        severity: "yellow",
        kind: "malformed_trajectory",
        message: `trajectory row ${row.lineNumber} is not valid JSON`,
      });
      continue;
    }

    valid += 1;
    const id = String(parsed.id || `line_${row.lineNumber}`);
    const hasMemoryClass = parsed.memory_class === "reusable_pattern";
    const hasProvenance = parsed.provenance && typeof parsed.provenance === "object";
    if (!hasMemoryClass) {
      findings.push({
        severity: "yellow",
        kind: "missing_memory_class",
        id,
        message: `${id} missing memory_class=reusable_pattern`,
      });
    }
    if (!hasProvenance) {
      findings.push({
        severity: "yellow",
        kind: "legacy_missing_provenance",
        id,
        message: `${id} predates provenance metadata; review before migration`,
      });
    }

    try {
      validateMemoryProvenance(parsed.provenance || {});
    } catch (err) {
      findings.push({
        severity: "yellow",
        kind: "invalid_provenance",
        id,
        message: `${id} has invalid provenance: ${String(err?.message || err)}`,
      });
    }

    const strength = Number(parsed.strength || 0);
    const confidence = String(parsed.provenance?.confidence || "").toLowerCase();
    if (strength >= 8 && confidence === "low") {
      findings.push({
        severity: "yellow",
        kind: "high_strength_low_confidence",
        id,
        message: `${id} is high strength but low confidence`,
      });
    }

    const pattern = normalizePattern(parsed.reusable_pattern);
    if (pattern) {
      const existing = patternMap.get(pattern);
      if (existing) {
        findings.push({
          severity: "yellow",
          kind: "duplicate_pattern_candidate",
          id,
          message: `${id} duplicates reusable pattern from ${existing}`,
        });
      } else {
        patternMap.set(pattern, id);
      }
    }
  }

  const status = findings.length ? "yellow" : "green";
  return {
    status,
    filePath,
    total: rows.length,
    valid,
    findings,
    message: rows.length
      ? `${rows.length} trajectory row(s), ${findings.length} metabolism finding(s)`
      : "No memory-like trajectory records yet.",
  };
}
