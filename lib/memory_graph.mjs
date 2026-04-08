import fs from "fs";
import path from "path";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
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

function normalizeList(s) {
  return String(s || "")
    .split(",")
    .map((x) => String(x).trim())
    .filter(Boolean);
}

function listMarkdownFiles(rootDir, ignoreDirs, maxFiles = 1000) {
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

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".md")) continue;
      out.push(full);
      if (out.length >= maxFiles) return out;
    }
  }

  return out;
}

function readTextIfSmall(filePath, maxBytes) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size > maxBytes) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function byteLen(text) {
  return Buffer.byteLength(String(text || ""), "utf8");
}

function topTokens(text, limit = 12) {
  const counts = new Map();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token, count]) => ({ token, count }));
}

function extractMarkdownLinks(text) {
  const out = [];
  const re = /\[[^\]]+\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = String(m[1] || "").trim().split("#")[0].trim();
    if (!raw || !raw.toLowerCase().endsWith(".md")) continue;
    out.push(raw.replace(/\\/g, "/"));
  }
  return out;
}

function extractHeadings(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    out.push({ level: m[1].length, text: m[2].trim() });
  }
  return out;
}

const ENTITY_STOPWORDS = new Set([
  "The", "This", "That", "These", "Those", "What", "How", "Why", "When", "Where", "Which",
  "Summary", "Decisions", "Open Loops", "Preferences", "Constraints", "Next Actions",
  "Memory", "Daily Log", "Index", "Purpose", "Description", "Applications", "Goal",
  "Keep", "Max", "Add", "Put", "Size", "Long", "Non", "Final", "Open", "Practical",
  "Promising", "Best", "For", "But", "They", "Source", "Title", "Governing", "Most",
  "Corpus", "Interpretation", "Constraint", "Notes", "Session",
]);

function extractEntities(text) {
  const counts = new Map();
  const re = /\b([A-Z][a-z0-9]+(?: [A-Z][a-z0-9]+){0,3})\b/g;
  for (const line of String(text || "").split(/\r?\n/)) {
    let m;
    while ((m = re.exec(line))) {
      const entity = String(m[1] || "").trim();
      if (!entity || ENTITY_STOPWORDS.has(entity)) continue;
      if (entity.length < 3 || entity.length > 60) continue;
      counts.set(entity, (counts.get(entity) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([name, count]) => name.includes(" ") || count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));
}

function inferDocKind(relPath) {
  const p = String(relPath || "").replace(/\\/g, "/");
  if (p === "MEMORY.md") return "memory_index";
  if (/^memory\/topics\//.test(p)) return "topic";
  if (/^memory\/conversations\//.test(p)) return "conversation";
  if (/^memory\/\d{4}-\d{2}-\d{2}/.test(p)) return "daily_log";
  return "memory_doc";
}

function makeExcerpt(text, maxChars = 600) {
  const s = String(text || "").trim();
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n\n...[truncated]`;
}

function intersectionCount(a, b) {
  let count = 0;
  for (const item of a) {
    if (b.has(item)) count += 1;
  }
  return count;
}

function collectDocSignals(tokens) {
  const out = {};
  for (const [name, words] of Object.entries(SIGNAL_GROUPS)) {
    out[name] = intersectionCount(words, tokens);
  }
  return out;
}

function getQuerySignals(queryTokens) {
  return collectDocSignals(queryTokens);
}

function scoreDoc(doc, queryTokens, querySignals) {
  let score = 0;
  const reasons = [];

  for (const token of queryTokens) {
    if (doc.titleTokens.has(token)) {
      score += 4;
      reasons.push(`title:${token}`);
    }
    if (doc.headingTokens.has(token)) {
      score += 3;
      reasons.push(`heading:${token}`);
    }
    if (doc.keywordSet.has(token)) {
      score += 2;
      reasons.push(`keyword:${token}`);
    }
    if (doc.bodyTokens.has(token)) {
      score += 1;
    }
  }

  if (querySignals.decisions > 0 && doc.signals.decisions > 0) {
    score += 3;
    reasons.push("decision_signal");
  }
  if ((querySignals.autonomy > 0 || querySignals.structural > 0) && (doc.signals.autonomy > 0 || doc.signals.structural > 0)) {
    score += 3;
    reasons.push("autonomy_structure_signal");
  }
  if (querySignals.meaning > 0 && doc.signals.meaning > 0) {
    score += 2;
    reasons.push("meaning_signal");
  }
  if (doc.kind === "topic") {
    score += 1;
    reasons.push("topic_bias");
  }
  if (doc.kind === "memory_index") {
    score -= 2;
  }
  if (doc.kind === "daily_log") {
    score -= 1;
  }

  return { score, reasons: [...new Set(reasons)].slice(0, 6) };
}

function buildGraph() {
  const rootDir = path.resolve(process.cwd(), String(env("DIZZY_MEMORY_GRAPH_ROOT", "memory")));
  const ignoreDirs = new Set([".git"]);
  for (const x of normalizeList(env("DIZZY_MEMORY_GRAPH_IGNORE_DIRS", ""))) ignoreDirs.add(x);

  const maxBytes = Math.max(10_000, Number(env("DIZZY_MEMORY_GRAPH_MAX_FILE_BYTES", "200000")) || 200000);
  const maxFiles = Math.max(10, Number(env("DIZZY_MEMORY_GRAPH_MAX_FILES", "500")) || 500);
  const excerptChars = Math.max(200, Number(env("DIZZY_MEMORY_GRAPH_EXCERPT_CHARS", "600")) || 600);

  const files = [];
  const memoryIndexPath = path.resolve(process.cwd(), "MEMORY.md");
  if (fs.existsSync(memoryIndexPath)) files.push(memoryIndexPath);
  if (fs.existsSync(rootDir)) files.push(...listMarkdownFiles(rootDir, ignoreDirs, maxFiles));

  const docs = [];
  const entityNodes = new Map();
  const edges = [];
  const docIdByPath = new Map();

  for (const absPath of files) {
    const raw = readTextIfSmall(absPath, maxBytes);
    if (!raw) continue;
    const relPath = path.relative(process.cwd(), absPath).replace(/\\/g, "/");
    if (docIdByPath.has(relPath)) continue;

    const headings = extractHeadings(raw);
    const title = headings[0]?.text || path.basename(relPath, ".md");
    const keywords = topTokens(raw, 12);
    const entities = extractEntities(raw);
    const links = extractMarkdownLinks(raw);
    const bodyTokens = new Set(tokenize(raw));
    const headingTokens = new Set(tokenize(headings.map((h) => h.text).join(" ")));
    const titleTokens = new Set(tokenize(title));
    const keywordSet = new Set(keywords.map((k) => k.token));
    const signals = collectDocSignals(bodyTokens);
    const id = `doc:${relPath}`;

    docs.push({
      id,
      path: relPath,
      kind: inferDocKind(relPath),
      title,
      headings: headings.slice(0, 12),
      keywords,
      entities,
      links,
      excerpt: makeExcerpt(raw, excerptChars),
      bytes: byteLen(raw),
      titleTokens,
      headingTokens,
      keywordSet,
      bodyTokens,
      signals,
    });
    docIdByPath.set(relPath, id);
  }

  for (const doc of docs) {
    for (const entity of doc.entities) {
      const entityId = `entity:${entity.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      if (!entityNodes.has(entityId)) {
        entityNodes.set(entityId, { id: entityId, name: entity.name, kind: "entity", mentions: 0 });
      }
      entityNodes.get(entityId).mentions += entity.count;
      edges.push({
        from: doc.id,
        to: entityId,
        type: "mentions",
        weight: entity.count,
      });
    }
  }

  for (const doc of docs) {
    for (const link of doc.links) {
      const normalized = String(link).replace(/\\/g, "/");
      const targetId = docIdByPath.get(normalized);
      if (!targetId) continue;
      edges.push({
        from: doc.id,
        to: targetId,
        type: "links_to",
        weight: 1,
      });
    }
  }

  return {
    built_at: new Date().toISOString(),
    root: path.relative(process.cwd(), rootDir).replace(/\\/g, "/") || ".",
    counts: {
      docs: docs.length,
      entities: entityNodes.size,
      edges: edges.length,
    },
    docs,
    entities: [...entityNodes.values()].sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name)),
    edges,
  };
}

let cached = null;

export function getMemoryGraph() {
  const ttlMs = Math.max(500, Number(env("DIZZY_MEMORY_GRAPH_CACHE_MS", "10000")) || 10000);
  const now = Date.now();
  if (cached && now - cached.at < ttlMs) return cached.value;
  const value = buildGraph();
  cached = { at: now, value };
  return value;
}

export function getRelevantMemoryGraphContext(query, opts = {}) {
  const enabled = String(env("DIZZY_MEMORY_GRAPH_ENABLED", "1")).trim() === "1";
  if (!enabled) return { docs: [], entities: [], edges: [], built_at: "" };

  const k = Math.max(0, Number(opts.k ?? env("DIZZY_MEMORY_GRAPH_TOP_K", "3")) || 3);
  if (!k) return { docs: [], entities: [], edges: [], built_at: "" };

  const queryTokens = new Set(tokenize(query));
  if (!queryTokens.size) return { docs: [], entities: [], edges: [], built_at: "" };
  const querySignals = getQuerySignals(queryTokens);

  const graph = getMemoryGraph();
  const scored = graph.docs
    .map((doc) => {
      const result = scoreDoc(doc, queryTokens, querySignals);
      return { doc, score: result.score, reasons: result.reasons };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.path.localeCompare(b.doc.path))
    .slice(0, Math.max(k * 3, k));

  const selected = [];
  const seenKinds = new Map();
  for (const item of scored) {
    const kindCount = seenKinds.get(item.doc.kind) || 0;
    if (kindCount >= Math.max(1, k - 1) && item.doc.kind !== "topic") continue;
    selected.push(item);
    seenKinds.set(item.doc.kind, kindCount + 1);
    if (selected.length >= k) break;
  }

  const finalDocs = selected.length ? selected : scored.slice(0, k);
  const docIds = new Set(finalDocs.map((x) => x.doc.id));
  const edgeMatches = graph.edges.filter((e) => docIds.has(e.from)).slice(0, 24);
  const entityIds = new Set(edgeMatches.filter((e) => e.type === "mentions").map((e) => e.to));
  const entities = graph.entities.filter((e) => entityIds.has(e.id)).slice(0, 12);

  return {
    built_at: graph.built_at,
    query_signals: querySignals,
    docs: finalDocs.map((x) => ({
      path: x.doc.path,
      title: x.doc.title,
      kind: x.doc.kind,
      score: x.score,
      reasons: x.reasons,
      signals: x.doc.signals,
      headings: x.doc.headings.slice(0, 4),
      keywords: x.doc.keywords.slice(0, 8),
      entities: x.doc.entities.slice(0, 8),
      excerpt: x.doc.excerpt,
    })),
    entities,
    edges: edgeMatches,
  };
}
