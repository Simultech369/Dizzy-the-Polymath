import crypto from "crypto";
import fs from "fs";
import path from "path";
import { assertCaptureEligible } from "./capture_eligibility.mjs";
import { buildReusablePatternProvenance, validateMemoryProvenance } from "./provenance.mjs";
import { assertDurableWriteAllowed } from "./durable_write_policy.mjs";
import { renderRetrievedExcerpt } from "./janitor.mjs";

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

function normalizeEnum(value, allowed, fallback) {
  const raw = normalizeString(value, 80).toLowerCase();
  return allowed.includes(raw) ? raw : fallback;
}

function normalizeContentClass(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

const ALLOWED_CONTENT_CLASSES = [
  "goal",
  "constraints",
  "success_criteria",
  "actions_taken",
  "outcome",
  "reusable_pattern",
  "reuse_tags",
  "source_hash",
];

const DEFAULT_EXCLUDED_CONTENT_CLASSES = [
  "raw_transcript",
  "secret_material",
  "private_emotional_detail",
  "identity_or_attachment_claim",
  "unverified_user_fact",
];

function normalizeContentClasses(value, fallback) {
  const items = Array.isArray(value) ? value : String(value ?? "").split(/,|\n|;/g);
  const normalized = unique(items.map(normalizeContentClass)).filter(Boolean);
  return normalized.length ? normalized.slice(0, 12) : [...fallback];
}

function normalizeEvidenceBasis(value, fallback = []) {
  const items = Array.isArray(value) ? value : String(value ?? "").split(/\n|;/g);
  const normalized = items.map((x) => normalizeString(x, 220)).filter(Boolean);
  return (normalized.length ? normalized : fallback).slice(0, 6);
}

function buildDistillationContract(input, derived = {}) {
  const contract = input?.distillation_contract && typeof input.distillation_contract === "object"
    ? input.distillation_contract
    : {};
  const evidenceFallback = [
    derived.successCriteria ? `success_criteria: ${derived.successCriteria}` : "",
    ...(derived.actionsTaken || []).slice(0, 3).map((action) => `action: ${action}`),
  ].filter(Boolean);

  return {
    allowed_content_classes: normalizeContentClasses(contract.allowed_content_classes ?? input?.allowed_content_classes, ALLOWED_CONTENT_CLASSES),
    excluded_content_classes: normalizeContentClasses(contract.excluded_content_classes ?? input?.excluded_content_classes, DEFAULT_EXCLUDED_CONTENT_CLASSES),
    evidence_basis: normalizeEvidenceBasis(contract.evidence_basis ?? input?.evidence_basis, evidenceFallback),
    lossy_risk: normalizeEnum(contract.lossy_risk ?? input?.lossy_risk, ["low", "medium", "high"], "medium"),
    operator_review_required: true,
    auto_save_allowed: false,
  };
}

export function validateTrajectoryDistillationContract(contract) {
  const errors = [];
  const allowed = new Set(ALLOWED_CONTENT_CLASSES);
  const excluded = new Set(DEFAULT_EXCLUDED_CONTENT_CLASSES);
  for (const item of contract.allowed_content_classes || []) {
    if (!allowed.has(item)) errors.push(`unknown allowed_content_class '${item}'`);
  }
  for (const item of DEFAULT_EXCLUDED_CONTENT_CLASSES) {
    if (!contract.excluded_content_classes?.includes(item)) errors.push(`excluded_content_classes must include ${item}`);
  }
  for (const item of contract.excluded_content_classes || []) {
    if (!excluded.has(item)) errors.push(`unknown excluded_content_class '${item}'`);
  }
  if (!Array.isArray(contract.evidence_basis) || !contract.evidence_basis.length) {
    errors.push("evidence_basis is required");
  }
  if (!["low", "medium", "high"].includes(contract.lossy_risk)) {
    errors.push("lossy_risk must be low, medium, or high");
  }
  if (contract.operator_review_required !== true) errors.push("operator_review_required must be true");
  if (contract.auto_save_allowed !== false) errors.push("auto_save_allowed must be false");
  if (errors.length) {
    const err = new Error(`invalid trajectory distillation contract: ${errors.join("; ")}`);
    err.errors = errors;
    throw err;
  }
  return contract;
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
  const distillationContract = validateTrajectoryDistillationContract(buildDistillationContract(input, { successCriteria, actionsTaken }));

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
  const provenance = validateMemoryProvenance(buildReusablePatternProvenance({
    ...input,
    success_criteria: successCriteria,
    reusable_pattern: reusablePattern,
    outcome,
    actions_taken: actionsTaken,
  }));
  provenance.lossy_risk = distillationContract.lossy_risk;

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
    memory_class: "reusable_pattern",
    provenance,
    distillation_contract: distillationContract,
    source_hash: normalizeString(input?.source_hash, 64) || hashString(source).slice(0, 16),
    strength,
  };
}

export function appendTrajectory(input, opts = {}) {
  if (opts.checkEligibility !== false) {
    assertCaptureEligible({ kind: "trajectory", payload: input, minWords: 8 });
  }
  const trajectory = normalizeTrajectory(input, opts);
  assertDurableWriteAllowed({
    kind: "trajectory",
    payload: trajectory,
    trustZone: opts.trustZone || "private_self",
    sensitivityClass: input?.sensitivity_class,
    minWords: 8,
  });
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
    "=== RETRIEVAL SOURCE: trajectory_ledger | authority=operator_reviewed_pattern | fallback=local_jsonl_ledger ===",
    ...trajectories.map((t) => {
      const payload = [
        t.reuse_tags?.length ? `reuse_tags=${t.reuse_tags.join(", ")}` : "",
        t.goal ? `goal=${t.goal}` : "",
        t.constraints ? `constraints=${t.constraints}` : "",
        t.success_criteria ? `success_criteria=${t.success_criteria}` : "",
        t.actions_taken?.length ? `actions_taken=${t.actions_taken.join(" | ")}` : "",
        t.distillation_contract?.lossy_risk ? `lossy_risk=${t.distillation_contract.lossy_risk}` : "",
        `reusable_pattern=${t.reusable_pattern}`,
      ].filter(Boolean).join("\n");
      return [
        `--- ${t.id} [source_type=trajectory_ledger memory_class=${t.memory_class || "reusable_pattern"} score=${t.score} strength=${t.strength} outcome=${t.outcome}] ---`,
        renderRetrievedExcerpt(payload),
      ].join("\n");
    }),
    "=== END RETRIEVAL SOURCE: trajectory_ledger ===",
  ].join("\n");
}
