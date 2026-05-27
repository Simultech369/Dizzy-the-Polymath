import crypto from "crypto";
import fs from "fs";
import path from "path";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function hashString(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((t) => t.length >= 3 && t.length <= 40);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function normalizeString(value, maxChars) {
  return String(value ?? "").trim().slice(0, maxChars);
}

function normalizeActions(value) {
  const items = Array.isArray(value) ? value : String(value ?? "").split(/\n|;/g);
  return items
    .map((x) => normalizeString(x, 240))
    .filter(Boolean)
    .slice(0, 8);
}

function trajectoryPath() {
  return path.resolve(process.cwd(), String(env("DIZZY_TRAJECTORY_PATH", "runtime/trajectories/known_good.jsonl")));
}

export function parseTrajectoryInput(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("trajectory payload is empty");
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`trajectory payload must be JSON: ${String(e?.message ?? e)}`);
  }
}

export function normalizeTrajectory(input, opts = {}) {
  const now = opts.now || new Date();
  const timestamp = normalizeString(input?.timestamp, 80) || now.toISOString();
  const goal = normalizeString(input?.goal, 500);
  const constraints = normalizeString(input?.constraints, 800);
  const successCriteria = normalizeString(input?.success_criteria, 800);
  const reusablePattern = normalizeString(input?.reusable_pattern, 800);
  const outcomeRaw = normalizeString(input?.outcome, 40).toLowerCase();
  const outcome = ["success", "partial", "failure"].includes(outcomeRaw) ? outcomeRaw : "success";
  const strength = Math.max(1, Math.min(10, Math.round(Number(input?.strength ?? 6) || 6)));
  const actionsTaken = normalizeActions(input?.actions_taken ?? input?.actions);
  const reuseTags = unique((Array.isArray(input?.reuse_tags) ? input.reuse_tags : String(input?.reuse_tags ?? "").split(/,|\s+/g))
    .map(normalizeTag))
    .slice(0, 12);

  const errors = [];
  if (!goal) errors.push("goal is required");
  if (!reusablePattern) errors.push("reusable_pattern is required");
  if (!reuseTags.length) errors.push("at least one reuse_tag is required");
  if (errors.length) {
    const err = new Error(`invalid trajectory: ${errors.join("; ")}`);
    err.errors = errors;
    throw err;
  }

  const source = [
    timestamp,
    goal,
    constraints,
    successCriteria,
    actionsTaken.join("|"),
    outcome,
    reusablePattern,
    reuseTags.join(","),
    strength,
  ].join("\n");

  return {
    id: normalizeString(input?.id, 80) || `traj_${timestamp.replace(/[^0-9]/g, "").slice(0, 14)}_${hashString(source).slice(0, 8)}`,
    timestamp,
    goal,
    constraints,
    success_criteria: successCriteria,
    actions_taken: actionsTaken,
    outcome,
    reusable_pattern: reusablePattern,
    reuse_tags: reuseTags,
    source_hash: normalizeString(input?.source_hash, 64) || hashString(source).slice(0, 16),
    strength,
  };
}

export function appendTrajectory(input, opts = {}) {
  const trajectory = normalizeTrajectory(input, opts);
  const filePath = opts.filePath ? path.resolve(process.cwd(), opts.filePath) : trajectoryPath();
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(trajectory)}\n`, "utf8");
  return { trajectory, filePath };
}

export function readTrajectories(opts = {}) {
  const filePath = opts.filePath ? path.resolve(process.cwd(), opts.filePath) : trajectoryPath();
  if (!fs.existsSync(filePath)) return [];
  const maxRows = Math.max(1, Number(opts.maxRows ?? env("DIZZY_TRAJECTORY_MAX_ROWS", "500")) || 500);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).slice(-maxRows);
  const out = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      out.push(normalizeTrajectory(parsed, { now: new Date(parsed.timestamp || Date.now()) }));
    } catch {
      // Ignore malformed rows; maintain/reporting can flag corruption later.
    }
  }
  return out;
}

function scoreTrajectory(traj, queryTokens, queryTags) {
  const textTokens = new Set(tokenize([
    traj.goal,
    traj.constraints,
    traj.success_criteria,
    traj.actions_taken?.join(" "),
    traj.reusable_pattern,
    traj.reuse_tags?.join(" "),
  ].join("\n")));
  const tags = new Set((traj.reuse_tags || []).map(normalizeTag));

  let score = 0;
  const reasons = [];
  for (const token of queryTokens) {
    if (textTokens.has(token)) score += 1;
  }
  for (const tag of queryTags) {
    if (tags.has(tag)) {
      score += 4;
      reasons.push(`tag:${tag}`);
    }
  }
  if (traj.outcome === "success") {
    score += 1;
    reasons.push("success");
  }
  if (Number(traj.strength || 0) >= 8) {
    score += 1;
    reasons.push("high_strength");
  }
  return { score, reasons: unique(reasons).slice(0, 5) };
}

export function getRelevantTrajectories(query, opts = {}) {
  if (String(env("DIZZY_TRAJECTORIES_ENABLED", "1")).trim() !== "1") return [];
  const k = Math.max(0, Number(opts.k ?? env("DIZZY_TRAJECTORY_TOP_K", "2")) || 2);
  if (!k) return [];

  const queryTokens = new Set(tokenize(query));
  const queryTags = unique([...queryTokens].map(normalizeTag));
  if (!queryTokens.size && !queryTags.length) return [];

  const minStrength = Math.max(1, Math.min(10, Number(opts.minStrength ?? env("DIZZY_TRAJECTORY_MIN_STRENGTH", "6")) || 6));
  return readTrajectories(opts)
    .filter((traj) => Number(traj.strength || 0) >= minStrength)
    .map((traj) => {
      const scored = scoreTrajectory(traj, queryTokens, queryTags);
      return { ...traj, score: scored.score, reasons: scored.reasons };
    })
    .filter((traj) => traj.score > 0)
    .sort((a, b) => b.score - a.score || String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, k);
}

export function formatTrajectoryContext(query, opts = {}) {
  const trajectories = getRelevantTrajectories(query, opts);
  if (!trajectories.length) return "";
  return [
    "",
    "=== KNOWN-GOOD TRAJECTORIES (distilled local patterns; use as support, not authority) ===",
    ...trajectories.map((t) => [
      `--- ${t.id} score=${t.score} strength=${t.strength} outcome=${t.outcome} ---`,
      t.reuse_tags?.length ? `reuse_tags=${t.reuse_tags.join(", ")}` : "",
      t.goal ? `goal=${t.goal}` : "",
      t.constraints ? `constraints=${t.constraints}` : "",
      t.success_criteria ? `success_criteria=${t.success_criteria}` : "",
      t.actions_taken?.length ? `actions_taken=${t.actions_taken.join(" | ")}` : "",
      `reusable_pattern=${t.reusable_pattern}`,
    ].filter(Boolean).join("\n")),
    "=== END KNOWN-GOOD TRAJECTORIES ===",
  ].join("\n");
}
