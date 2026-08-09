import crypto from "crypto";
import fs from "fs";
import path from "path";
import { durableAppendJsonl, redactSecretMaterial } from "./durable_write_policy.mjs";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

function normalizeString(value, maxChars = 500) {
  return redactSecretMaterial(String(value ?? "").trim()).slice(0, maxChars);
}

function normalizeIsoTimestamp(value, fallback = new Date()) {
  const raw = String(value ?? "").trim();
  const parsed = raw ? new Date(raw) : fallback;
  if (Number.isNaN(parsed.getTime())) throw new Error(`invalid snapshot timestamp: ${raw}`);
  return parsed.toISOString();
}

function compactTimestamp(iso) {
  return String(iso).replace(/[^0-9]/g, "").slice(0, 14);
}

function trajectorySourcePath() {
  return path.resolve(process.cwd(), env("DIZZY_TRAJECTORY_PATH", "runtime/trajectories/known_good.jsonl"));
}

function snapshotLedgerPath() {
  return path.resolve(process.cwd(), env("DIZZY_TRAJECTORY_SNAPSHOT_PATH", "runtime/trajectory_snapshots/snapshots.jsonl"));
}

function normalizeTrajectoryRow(row, { lineNumber, raw }) {
  const timestamp = normalizeIsoTimestamp(row?.timestamp || row?.t || row?.created_at);
  const id = normalizeString(row?.id, 120) || `trajectory_line_${lineNumber}`;
  return {
    id,
    timestamp,
    line_number: lineNumber,
    row_sha256: sha256Text(raw),
    source_hash: normalizeString(row?.source_hash, 128),
    memory_class: normalizeString(row?.memory_class, 80) || "reusable_pattern",
    outcome: normalizeString(row?.outcome, 40),
    strength: Number.isFinite(Number(row?.strength)) ? Number(row.strength) : null,
    reuse_tags: Array.isArray(row?.reuse_tags)
      ? row.reuse_tags.map((tag) => normalizeString(tag, 60)).filter(Boolean).slice(0, 12)
      : [],
    goal_hash: sha256Text(row?.goal || "").slice(0, 16),
    reusable_pattern_hash: sha256Text(row?.reusable_pattern || "").slice(0, 16),
  };
}

export function readTrajectoryRowsForSnapshot({ filePath = trajectorySourcePath(), asOf = new Date(), maxRows = 2000 } = {}) {
  const resolved = path.resolve(process.cwd(), filePath);
  const cutoffIso = normalizeIsoTimestamp(asOf);
  const cutoffMs = Date.parse(cutoffIso);
  if (!fs.existsSync(resolved)) {
    return { filePath: resolved, asOf: cutoffIso, rows: [], malformed: [] };
  }

  const lines = fs.readFileSync(resolved, "utf8").split(/\r?\n/);
  const rows = [];
  const malformed = [];
  let lineNumber = 0;
  for (const rawLine of lines) {
    lineNumber += 1;
    if (!rawLine.trim()) continue;
    try {
      const parsed = JSON.parse(rawLine);
      const normalized = normalizeTrajectoryRow(parsed, { lineNumber, raw: rawLine });
      if (Date.parse(normalized.timestamp) <= cutoffMs) rows.push(normalized);
    } catch (error) {
      malformed.push({
        line_number: lineNumber,
        row_sha256: sha256Text(rawLine),
        reason: normalizeString(error?.message || error, 160),
      });
    }
  }

  rows.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)) || String(a.id).localeCompare(String(b.id)));
  return {
    filePath: resolved,
    asOf: cutoffIso,
    rows: rows.slice(-Math.max(1, Number(maxRows) || 2000)),
    malformed,
  };
}

export function buildTrajectorySnapshot({ filePath = trajectorySourcePath(), asOf = new Date(), label = "", maxRows = 2000 } = {}) {
  const source = readTrajectoryRowsForSnapshot({ filePath, asOf, maxRows });
  const content = {
    as_of: source.asOf,
    source_path: path.relative(process.cwd(), source.filePath).replace(/\\/g, "/"),
    rows: source.rows,
  };
  const contentSha256 = sha256Text(stableStringify(content));
  return {
    schema_version: "dizzy.trajectory_snapshot.v1",
    snapshot_id: `traj_snap_${compactTimestamp(source.asOf)}_${contentSha256.slice(0, 12)}`,
    label: normalizeString(label, 120),
    created_at: new Date().toISOString(),
    point_in_time: {
      as_of: source.asOf,
      clock_source: "operator_or_runtime_iso8601",
    },
    source: {
      path: path.relative(process.cwd(), source.filePath).replace(/\\/g, "/"),
      included_rows: source.rows.length,
      malformed_rows: source.malformed.length,
      max_rows: Math.max(1, Number(maxRows) || 2000),
    },
    content_sha256: contentSha256,
    items: source.rows,
    malformed: source.malformed.slice(0, 50),
    authority: "evidence_not_authority",
    operator_approval_required: true,
  };
}

export function verifyTrajectorySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("snapshot must be an object");
  if (snapshot.schema_version !== "dizzy.trajectory_snapshot.v1") throw new Error("invalid trajectory snapshot schema");
  const content = {
    as_of: snapshot.point_in_time?.as_of,
    source_path: snapshot.source?.path,
    rows: Array.isArray(snapshot.items) ? snapshot.items : [],
  };
  const actual = sha256Text(stableStringify(content));
  if (actual !== snapshot.content_sha256) throw new Error("trajectory snapshot hash mismatch");
  if (snapshot.authority !== "evidence_not_authority") throw new Error("trajectory snapshot authority must remain evidence_not_authority");
  if (snapshot.operator_approval_required !== true) throw new Error("trajectory snapshot requires operator approval");
  return true;
}

export function appendTrajectorySnapshot({ snapshot, filePath = snapshotLedgerPath() } = {}) {
  const row = snapshot || buildTrajectorySnapshot();
  verifyTrajectorySnapshot(row);
  durableAppendJsonl(path.resolve(process.cwd(), filePath), row);
  return row;
}

export function readTrajectorySnapshots({ filePath = snapshotLedgerPath(), maxRows = 200 } = {}) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return [];
  const limit = Math.max(1, Number(maxRows) || 200);
  const lines = fs.readFileSync(resolved, "utf8").split(/\r?\n/).filter(Boolean).slice(-limit);
  const out = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      verifyTrajectorySnapshot(parsed);
      out.push(parsed);
    } catch {
      // Snapshot readers fail soft; maintain/audit can flag malformed evidence rows.
    }
  }
  return out;
}
