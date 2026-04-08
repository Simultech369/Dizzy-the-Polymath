import fs from "fs";
import path from "path";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function normalizeList(s) {
  return String(s || "")
    .split(",")
    .map((x) => String(x).trim())
    .filter(Boolean);
}

function normalizePathSlashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function parseAllowedRoots() {
  const configured = normalizeList(env("DIZZY_RAG_ALLOWED_ROOTS", ""));
  if (configured.length) {
    return configured.map((value) => normalizePathSlashes(value).replace(/^\.\/+/, "").replace(/\/+$/, ""));
  }
  return ["memory"];
}

function isTrustedRepoMarkdown(relPath, allowedRoots) {
  const normalized = normalizePathSlashes(relPath).replace(/^\.\/+/, "");
  const topLevelAllowed = new Set([
    "IDENTITY.md",
    "SOUL.md",
    "HEARTBEAT.md",
    "TOOLS.md",
    "USER.md",
    "PROMPT_CORE.md",
    "PROMPT_MODES.md",
    "PROMPT_PACKS.md",
    "DESIGN.md",
    "GOVERNANCE.md",
    "PROTOCOL.md",
    "OPERATIONS.md",
    "MARKETPLACE_PROTOCOL.md",
    "LEGAL-GUARDRAILS.md",
    "MEMORY.md",
    "RUNBOOK.md",
    "DRIFT_AUDIT.md",
    "CAPABILITIES.md",
    "COMMUNICATION.md",
    "ECONOMICS.md",
    "NEXT.md",
  ]);
  if (topLevelAllowed.has(normalized)) return true;
  return allowedRoots.some((root) => normalized === root || normalized.startsWith(`${root}/`));
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((t) => t.length >= 3 && t.length <= 40);
}

const SIGNAL_GROUPS = {
  autonomy: new Set([
    "autonomy", "consent", "agency", "sovereignty", "freedom", "coercion", "domination",
    "compliance", "normalized", "normalization", "obedience", "colonized",
  ]),
  structural: new Set([
    "housing", "instability", "precarity", "rent", "debt", "institution", "institutions",
    "systemic", "structure", "conditions", "community", "mutual", "solidarity", "extractive",
  ]),
  meaning: new Set([
    "body", "heart", "spirit", "wisdom", "signal", "truth", "meaning", "responsibility",
    "beauty", "creativity", "human", "world",
  ]),
  decisions: new Set([
    "decision", "decisions", "decide", "decided", "constraint", "constraints", "preference",
    "preferences", "changed", "shift", "important", "matters", "reusable", "pattern",
  ]),
};

function listMarkdownFiles(rootDir, ignoreDirs, maxFiles = 5000) {
  const out = [];
  const stack = [rootDir];

  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (ignoreDirs.has(e.name)) continue;
        stack.push(full);
        continue;
      }
      if (!e.isFile()) continue;
      if (!e.name.toLowerCase().endsWith(".md")) continue;
      out.push(full);
      if (out.length >= maxFiles) return out;
    }
  }

  return out;
}

function readTextIfSmall(filePath, maxBytes) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return "";
    if (st.size > maxBytes) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function truncateText(text, maxChars) {
  const s = String(text || "").trim();
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n\n...[truncated]`;
}

function inferDocKind(relPath) {
  const p = String(relPath || "").replace(/\\/g, "/");
  if (p === "MEMORY.md") return "memory_index";
  if (/^memory\/topics\//.test(p)) return "topic";
  if (/^memory\/conversations\//.test(p)) return "conversation";
  if (/^memory\/\d{4}-\d{2}-\d{2}/.test(p)) return "daily_log";
  return "memory_doc";
}

function intersectionCount(a, b) {
  let count = 0;
  for (const item of a) {
    if (b.has(item)) count += 1;
  }
  return count;
}

function collectSignals(tokens) {
  const out = {};
  for (const [name, words] of Object.entries(SIGNAL_GROUPS)) {
    out[name] = intersectionCount(words, tokens);
  }
  return out;
}

let cached = null;

function buildIndex() {
  const rootDir = path.resolve(process.cwd(), String(env("DIZZY_RAG_ROOT", ".")));
  const allowedRoots = parseAllowedRoots();
  const ignoreDirs = new Set([
    ".git",
    "node_modules",
    "runtime",
    "_ext",
    "_external",
  ]);
  for (const x of normalizeList(env("DIZZY_RAG_IGNORE_DIRS", ""))) ignoreDirs.add(x);

  const maxBytes = Math.max(10_000, Number(env("DIZZY_RAG_MAX_FILE_BYTES", "200000")) || 200000);
  const maxFiles = Math.max(100, Number(env("DIZZY_RAG_MAX_FILES", "3000")) || 3000);

  const files = listMarkdownFiles(rootDir, ignoreDirs, maxFiles);
  const docs = [];
  const df = new Map();

  for (const absPath of files) {
    const raw = readTextIfSmall(absPath, maxBytes);
    if (!raw) continue;
    const relPath = path.relative(process.cwd(), absPath).replace(/\\/g, "/");
    if (!isTrustedRepoMarkdown(relPath, allowedRoots)) continue;
    const tokens = tokenize(raw);
    if (!tokens.length) continue;
    const uniq = new Set(tokens);
    for (const t of uniq) df.set(t, (df.get(t) || 0) + 1);
    docs.push({
      absPath,
      relPath,
      kind: inferDocKind(path.relative(process.cwd(), absPath).replace(/\\/g, "/")),
      tokens: uniq,
      signals: collectSignals(uniq),
      excerpt: truncateText(raw, Math.max(500, Number(env("DIZZY_RAG_EXCERPT_CHARS", "1800")) || 1800)),
    });
  }

  const N = docs.length || 1;
  const idf = new Map();
  for (const [t, n] of df.entries()) {
    idf.set(t, Math.log((N + 1) / (n + 1)) + 1);
  }

  return { builtAt: Date.now(), docs, idf };
}

function getIndex() {
  const ttlMs = Math.max(500, Number(env("DIZZY_RAG_CACHE_MS", "10000")) || 10000);
  const now = Date.now();
  if (cached && now - cached.builtAt < ttlMs) return cached;
  cached = buildIndex();
  return cached;
}

function scoreDoc(doc, qTokens, qSignals, idf) {
  let score = 0;
  const reasons = [];

  for (const t of qTokens) {
    if (!doc.tokens.has(t)) continue;
    score += idf.get(t) || 0;
  }

  if (qSignals.decisions > 0 && doc.signals.decisions > 0) {
    score += 2.5;
    reasons.push("decision_signal");
  }
  if ((qSignals.autonomy > 0 || qSignals.structural > 0) && (doc.signals.autonomy > 0 || doc.signals.structural > 0)) {
    score += 2.5;
    reasons.push("autonomy_structure_signal");
  }
  if (qSignals.meaning > 0 && doc.signals.meaning > 0) {
    score += 1.5;
    reasons.push("meaning_signal");
  }
  if (doc.kind === "topic") {
    score += 1;
    reasons.push("topic_bias");
  }
  if (doc.kind === "memory_index") {
    score -= 1.5;
  }
  if (doc.kind === "daily_log") {
    score -= 0.5;
  }

  return { score, reasons: [...new Set(reasons)].slice(0, 6) };
}

export function getRelevantMarkdownSnippets(query, opts = {}) {
  const enabled = String(env("DIZZY_RAG_ENABLED", "1")).trim() === "1";
  if (!enabled) return [];

  const k = Math.max(0, Number(opts.k ?? env("DIZZY_RAG_TOP_K", "4")) || 4);
  if (!k) return [];

  const qTokens = new Set(tokenize(query));
  if (!qTokens.size) return [];
  const qSignals = collectSignals(qTokens);

  const index = getIndex();
  const scored = [];

  for (const d of index.docs) {
    const result = scoreDoc(d, qTokens, qSignals, index.idf);
    if (result.score <= 0) continue;
    scored.push({ doc: d, score: result.score, reasons: result.reasons });
  }

  scored.sort((a, b) => b.score - a.score || a.doc.relPath.localeCompare(b.doc.relPath));
  const selected = [];
  const seenKinds = new Map();
  for (const item of scored.slice(0, Math.max(k * 3, k))) {
    const kindCount = seenKinds.get(item.doc.kind) || 0;
    if (kindCount >= Math.max(1, k - 1) && item.doc.kind !== "topic") continue;
    selected.push(item);
    seenKinds.set(item.doc.kind, kindCount + 1);
    if (selected.length >= k) break;
  }

  return (selected.length ? selected : scored.slice(0, k)).map((x) => ({
    path: x.doc.relPath,
    kind: x.doc.kind,
    score: x.score,
    reasons: x.reasons,
    signals: x.doc.signals,
    excerpt: x.doc.excerpt,
  }));
}
