import crypto from "crypto";
import fs from "fs";
import path from "path";
import { assertDurableWriteAllowed } from "./durable_write_policy.mjs";
import { ActivePolicyEngine } from "./active_policy_engine.mjs";

const policyEngine = new ActivePolicyEngine();

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function ledgerPath() {
  return path.resolve(process.cwd(), String(env("DIZZY_FRICTION_PATH", "runtime/friction/ledger.jsonl")));
}

function hashString(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function normalizeString(value, maxChars) {
  return String(value ?? "").trim().slice(0, maxChars);
}

function normalizeType(value) {
  const t = normalizeString(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return t || "general";
}

function normalizeFrequency(value) {
  const f = normalizeString(value, 40).toLowerCase();
  return ["first", "repeated", "chronic"].includes(f) ? f : "first";
}

export function parseFrictionInput(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("friction payload is empty");
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`friction payload must be JSON: ${String(e?.message ?? e)}`);
  }
}

export function normalizeFriction(input, opts = {}) {
  const now = opts.now || new Date();
  const timestamp = normalizeString(input?.timestamp, 80) || now.toISOString();
  const frictionType = normalizeType(input?.friction_type ?? input?.type);
  const description = normalizeString(input?.description, 1000);
  const taskContext = normalizeString(input?.task_context, 800);
  const severity = Math.max(1, Math.min(10, Math.round(Number(input?.severity ?? 5) || 5)));
  const frequency = normalizeFrequency(input?.frequency);
  const suggestedFix = normalizeString(input?.suggested_fix, 1000);
  const resolved = Boolean(input?.resolved);

  if (!description) throw new Error("invalid friction entry: description is required");

  const source = [
    timestamp,
    frictionType,
    description,
    taskContext,
    severity,
    frequency,
    suggestedFix,
    resolved ? "1" : "0",
  ].join("\n");

  return {
    id: normalizeString(input?.id, 80) || `fric_${timestamp.replace(/[^0-9]/g, "").slice(0, 14)}_${hashString(source).slice(0, 8)}`,
    timestamp,
    friction_type: frictionType,
    description,
    task_context: taskContext,
    severity,
    frequency,
    suggested_fix: suggestedFix,
    resolved,
  };
}

/* ---------- Synchronous API (for offline maintenance scripts & safety checks) ---------- */

export function appendFrictionSync(input, opts = {}) {
  const entry = normalizeFriction(input, opts);
  assertDurableWriteAllowed({
    kind: "friction",
    payload: entry,
    trustZone: opts.trustZone || "private_self",
    sensitivityClass: input?.sensitivity_class,
    minWords: 3,
  });
  const filePath = opts.filePath ? path.resolve(process.cwd(), opts.filePath) : ledgerPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  try {
    policyEngine.evaluate(entry);
  } catch (e) {
    console.error(`[friction_ledger] Active policy engine evaluation failed: ${e.message}`);
  }
  return { entry, filePath };
}

export function readFrictionEntriesSync(opts = {}) {
  const filePath = opts.filePath ? path.resolve(process.cwd(), opts.filePath) : ledgerPath();
  if (!fs.existsSync(filePath)) return [];
  const maxRows = Math.max(1, Number(opts.maxRows ?? env("DIZZY_FRICTION_MAX_ROWS", "500")) || 500);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).slice(-maxRows);
  const out = [];
  for (const line of lines) {
    try {
      out.push(normalizeFriction(JSON.parse(line)));
    } catch {
      // Maintain can report malformed rows later; do not fail reads.
    }
  }
  return out;
}

export function removeFrictionEntriesByKeySync(conversationKey, opts = {}) {
  const filePath = opts.filePath ? path.resolve(process.cwd(), opts.filePath) : ledgerPath();
  if (!fs.existsSync(filePath)) return 0;

  const entries = readFrictionEntriesSync({ ...opts, maxRows: 1e6 }); // Read all for filtering
  const kept = [];
  let removedCount = 0;

  for (const entry of entries) {
    if (entry.task_context === conversationKey) {
      removedCount++;
    } else {
      kept.push(entry);
    }
  }

  if (removedCount > 0) {
    const body = kept.length ? `${kept.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, body, "utf8");
    fs.renameSync(tempPath, filePath);
  }
  return removedCount;
}

export function summarizeFrictionSync(opts = {}) {
  const entries = readFrictionEntriesSync(opts);
  const unresolved = entries.filter((e) => !e.resolved);
  const weighted = new Map();
  for (const entry of unresolved) {
    const multiplier = entry.frequency === "chronic" ? 3 : entry.frequency === "repeated" ? 2 : 1;
    weighted.set(entry.friction_type, (weighted.get(entry.friction_type) || 0) + entry.severity * multiplier);
  }
  const top = [...weighted.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([friction_type, weight]) => ({ friction_type, weight }));

  return {
    total: entries.length,
    unresolved: unresolved.length,
    top,
  };
}

/* ---------- Asynchronous API (for hot runtime routes & event loops) ---------- */

export async function appendFriction(input, opts = {}) {
  const entry = normalizeFriction(input, opts);
  assertDurableWriteAllowed({
    kind: "friction",
    payload: entry,
    trustZone: opts.trustZone || "private_self",
    sensitivityClass: input?.sensitivity_class,
    minWords: 3,
  });
  const filePath = opts.filePath ? path.resolve(process.cwd(), opts.filePath) : ledgerPath();
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  try {
    policyEngine.evaluate(entry);
  } catch (e) {
    console.error(`[friction_ledger] Active policy engine evaluation failed: ${e.message}`);
  }
  return { entry, filePath };
}

export async function readFrictionEntries(opts = {}) {
  const filePath = opts.filePath ? path.resolve(process.cwd(), opts.filePath) : ledgerPath();
  try {
    await fs.promises.stat(filePath);
  } catch {
    return [];
  }
  const maxRows = Math.max(1, Number(opts.maxRows ?? env("DIZZY_FRICTION_MAX_ROWS", "500")) || 500);
  const content = await fs.promises.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean).slice(-maxRows);
  const out = [];
  for (const line of lines) {
    try {
      out.push(normalizeFriction(JSON.parse(line)));
    } catch {
      // Maintain can report malformed rows later; do not fail reads.
    }
  }
  return out;
}

export async function removeFrictionEntriesByKey(conversationKey, opts = {}) {
  const filePath = opts.filePath ? path.resolve(process.cwd(), opts.filePath) : ledgerPath();
  try {
    await fs.promises.stat(filePath);
  } catch {
    return 0;
  }

  const entries = await readFrictionEntries({ ...opts, maxRows: 1e6 }); // Read all for filtering
  const kept = [];
  let removedCount = 0;

  for (const entry of entries) {
    if (entry.task_context === conversationKey) {
      removedCount++;
    } else {
      kept.push(entry);
    }
  }

  if (removedCount > 0) {
    const body = kept.length ? `${kept.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    await fs.promises.writeFile(tempPath, body, "utf8");
    await fs.promises.rename(tempPath, filePath);
  }
  return removedCount;
}

export async function summarizeFriction(opts = {}) {
  const entries = await readFrictionEntries(opts);
  const unresolved = entries.filter((e) => !e.resolved);
  const weighted = new Map();
  for (const entry of unresolved) {
    const multiplier = entry.frequency === "chronic" ? 3 : entry.frequency === "repeated" ? 2 : 1;
    weighted.set(entry.friction_type, (weighted.get(entry.friction_type) || 0) + entry.severity * multiplier);
  }
  const top = [...weighted.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([friction_type, weight]) => ({ friction_type, weight }));

  return {
    total: entries.length,
    unresolved: unresolved.length,
    top,
  };
}
