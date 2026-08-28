import fs from "node:fs";
import path from "node:path";

import { createA2AMessage, sha256Hex } from "./a2a_mailbox_bridge.mjs";

export const COGNITIVE_MEMORY_SCHEMA = "dizzy.cognitive_memory.v1";
export const COGNITIVE_MEMORY_RECEIPT_SCHEMA = "dizzy.cognitive_memory_receipt.v1";
export const COGNITIVE_MEMORY_WIKI_SCHEMA = "dizzy.cognitive_memory_wiki.v1";
export const A2A_MEMORY_UPDATE_SCHEMA = "dizzy.memory_update.v1";

const VALID_MEMORY_CLASSES = new Set(["durable", "expiring"]);
const VALID_TRUST_ZONES = new Set(["private_self", "trusted_collaborator", "outside_contact", "paid_public"]);
const VALID_UPDATE_TYPES = new Set(["capture", "consolidate", "reconcile", "decay", "retrieve"]);
const META_START = "<!-- dizzy-memory-metadata";
const META_END = "-->";

const STOPWORDS = new Set([
  "about", "after", "always", "before", "being", "codex", "could", "every", "from",
  "have", "into", "josh", "need", "needs", "never", "only", "please", "prefer",
  "rather", "should", "that", "their", "there", "these", "this", "those", "through",
  "today", "until", "when", "where", "which", "while", "with", "would",
]);

const DURABLE_CUES = [
  "always", "never", "prefer", "preference", "priority", "invariant", "contract",
  "decision", "handoff", "proof", "boundary", "verify", "test", "license", "public",
  "audited", "trusted", "route", "guardrail", "memory", "receipt", "absolute paths",
];

const EXPIRING_CUES = [
  "today", "tomorrow", "this week", "this sprint", "for now", "currently", "temporary",
  "until", "soon", "latest", "next run", "credit", "credits",
];

const NEGATIVE_CUES = [
  "avoid", "block", "forbid", "never", "no ", "not ", "don't", "do not", "without",
  "must not", "cannot", "can't", "disallow", "reject",
];

const POSITIVE_CUES = [
  "allow", "prefer", "use", "include", "enable", "okay", "fine", "should", "must",
  "prioritize", "route", "accept",
];

function isoNow(now) {
  const value = typeof now === "function" ? now() : now;
  return value instanceof Date ? value.toISOString() : new Date(value || Date.now()).toISOString();
}

function clamp01(value, fallback = 0.5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[`"']/g, "")
    .replace(/[^a-z0-9_./:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length >= 3 && x.length <= 48 && !STOPWORDS.has(x));
}

function unique(items) {
  return [...new Set(items)];
}

function inferCanonicalKey(text) {
  const tokens = unique(tokenize(text));
  return tokens.slice(0, 6).join(":") || sha256Hex(String(text || "")).slice(0, 16).toLowerCase();
}

function inferPolarity(text) {
  const normalized = ` ${normalizeText(text)} `;
  const hasStrongNegative = [" do not ", " dont ", " never ", " must not ", " cannot ", " cant "]
    .some((cue) => normalized.includes(cue));
  if (hasStrongNegative) return -1;
  const hasNegative = NEGATIVE_CUES.some((cue) => normalized.includes(cue));
  const hasPositive = POSITIVE_CUES.some((cue) => normalized.includes(cue));
  if (hasNegative && !hasPositive) return -1;
  if (hasPositive && !hasNegative) return 1;
  if (hasNegative && hasPositive) return 0;
  return 0;
}

function inferMemoryClass(text) {
  const normalized = normalizeText(text);
  if (EXPIRING_CUES.some((cue) => normalized.includes(cue))) return "expiring";
  if (DURABLE_CUES.some((cue) => normalized.includes(cue))) return "durable";
  return "";
}

function jaccard(a, b) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function ensureDir(dirPath) {
  if (dirPath) fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(value) {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug || "memory";
}

function escapeMarkdown(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function resolveWikiRoot(opts = {}) {
  if (opts.wikiRootPath) return path.resolve(process.cwd(), opts.wikiRootPath);
  if (opts.wiki_root_path) return path.resolve(process.cwd(), opts.wiki_root_path);
  if (!opts.storePath && !opts.store_path) return null;
  const legacyStore = path.resolve(process.cwd(), opts.storePath || opts.store_path);
  if (!path.extname(legacyStore)) return legacyStore;
  const baseName = path.basename(legacyStore, path.extname(legacyStore));
  return path.join(path.dirname(legacyStore), `${baseName}_wiki`);
}

function memoryPageRelPath(memory) {
  return path.join("entries", `${slugify(memory.canonical_key)}.md`);
}

function memoryMetadata(memory) {
  const {
    content,
    normalized_content: normalizedContent,
    retrieval_score: retrievalScore,
    retrieval_components: retrievalComponents,
    ...metadata
  } = memory;
  return {
    ...metadata,
    schema_version: COGNITIVE_MEMORY_SCHEMA,
    normalized_content_sha256: sha256Hex(normalizedContent || normalizeText(content)),
  };
}

function memoryToMarkdown(memory) {
  const metadata = memoryMetadata(memory);
  const title = memory.canonical_key || memory.memory_id;
  const links = [
    "- [Wiki Index](../index.md)",
    "- [Wiki Log](../log.md)",
  ];
  if (Array.isArray(memory.links)) {
    for (const link of memory.links) links.push(`- ${escapeMarkdown(link)}`);
  }

  return [
    META_START,
    JSON.stringify(metadata, null, 2),
    META_END,
    "",
    `# ${title}`,
    "",
    `Status: ${memory.status}`,
    `Class: ${memory.memory_class}`,
    `Trust zone: ${memory.trust_zone}`,
    `Confidence: ${Number(memory.confidence || 0).toFixed(6)}`,
    "",
    "## Content",
    "",
    escapeMarkdown(memory.content),
    "",
    "## Traversal Links",
    "",
    ...links,
    "",
  ].join("\n");
}

function extractMetadata(markdown) {
  const start = markdown.indexOf(META_START);
  if (start < 0) return null;
  const jsonStart = start + META_START.length;
  const end = markdown.indexOf(META_END, jsonStart);
  if (end < 0) return null;
  return JSON.parse(markdown.slice(jsonStart, end).trim());
}

function extractSection(markdown, heading) {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  if (start < 0) return "";
  const afterHeading = markdown.indexOf("\n", start);
  if (afterHeading < 0) return "";
  const restStart = afterHeading + 1;
  const nextHeading = markdown.slice(restStart).search(/\n##\s+/);
  const end = nextHeading < 0 ? markdown.length : restStart + nextHeading;
  return markdown.slice(restStart, end).trim();
}

function readMemoryPage(filePath) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const metadata = extractMetadata(markdown);
  if (!metadata || metadata.schema_version !== COGNITIVE_MEMORY_SCHEMA) return null;
  const content = extractSection(markdown, "Content");
  return {
    ...metadata,
    content,
    normalized_content: normalizeText(content),
    page_path: path.relative(path.dirname(path.dirname(filePath)), filePath).replace(/\\/g, "/"),
  };
}

function readWikiMemories(wikiRootPath) {
  if (!wikiRootPath) return [];
  const entriesDir = path.join(wikiRootPath, "entries");
  if (!fs.existsSync(entriesDir)) return [];
  return fs.readdirSync(entriesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => readMemoryPage(path.join(entriesDir, entry.name)))
    .filter(Boolean)
    .sort((a, b) => a.canonical_key.localeCompare(b.canonical_key) || a.memory_id.localeCompare(b.memory_id));
}

function buildIndexMarkdown(memories, timestamp) {
  const active = memories.filter((memory) => memory.status === "active");
  const archived = memories.filter((memory) => memory.status !== "active");
  const renderRow = (memory) => {
    const relPath = memoryPageRelPath(memory).replace(/\\/g, "/");
    return [
      `- [${memory.canonical_key}](${relPath})`,
      `class=${memory.memory_class}`,
      `confidence=${Number(memory.confidence || 0).toFixed(3)}`,
      `reinforcement=${Number(memory.reinforcement_count || 0)}`,
      `trust=${memory.trust_zone}`,
      `sensitivity=${memory.sensitivity_tier}`,
      `updated=${memory.updated_at}`,
    ].join(" | ");
  };

  return [
    "# Dizzy Cognitive Memory Wiki Index",
    "",
    `Schema: ${COGNITIVE_MEMORY_WIKI_SCHEMA}`,
    `Generated: ${timestamp}`,
    "",
    "This index is the traversal surface. Read it first, then follow only the links needed for the task.",
    "",
    "## Active Memories",
    "",
    ...(active.length ? active.map(renderRow) : ["(none)"]),
    "",
    "## Archived Memories",
    "",
    ...(archived.length ? archived.map(renderRow) : ["(none)"]),
    "",
  ].join("\n");
}

function buildSchemaMarkdown(timestamp) {
  return [
    "# Dizzy Cognitive Memory Wiki Schema",
    "",
    `Schema: ${COGNITIVE_MEMORY_WIKI_SCHEMA}`,
    `Updated: ${timestamp}`,
    "",
    "## Directories",
    "",
    "- `entries/`: compiled memory pages, one canonical key per page.",
    "- `index.md`: traversal-first catalog for active and archived memory pages.",
    "- `log.md`: append-only chronological ledger of memory operations.",
    "",
    "## Rules",
    "",
    "- Do not store a flat JSON or SQLite memory database.",
    "- Raw content is compiled into Markdown pages with parseable metadata.",
    "- Public and outside-contact retrieval must use construction-time separation, not optimistic filtering.",
    "- Durable memory changes must be auditable through normal file diffs.",
    "",
  ].join("\n");
}

function appendLogEntry(wikiRootPath, entry) {
  if (!wikiRootPath) return;
  ensureDir(wikiRootPath);
  const logPath = path.join(wikiRootPath, "log.md");
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, "# Dizzy Cognitive Memory Wiki Log\n\n", "utf8");
  }
  const lines = [
    `## [${entry.timestamp}] ${entry.action} | ${entry.status}`,
    "",
    `- Canonical key: ${entry.canonical_key || ""}`,
    `- Receipt: ${entry.receipt_sha256 || ""}`,
    `- Count: ${Number(entry.count || 0)}`,
    "",
  ];
  fs.appendFileSync(logPath, lines.join("\n"), "utf8");
}

function writeWiki(wikiRootPath, memories, timestamp) {
  if (!wikiRootPath) return;
  const entriesDir = path.join(wikiRootPath, "entries");
  ensureDir(entriesDir);
  for (const memory of memories) {
    const relPath = memoryPageRelPath(memory);
    const pagePath = path.join(wikiRootPath, relPath);
    fs.writeFileSync(pagePath, memoryToMarkdown(memory), "utf8");
  }
  fs.writeFileSync(path.join(wikiRootPath, "index.md"), buildIndexMarkdown(memories, timestamp), "utf8");
  fs.writeFileSync(path.join(wikiRootPath, "SCHEMA.md"), buildSchemaMarkdown(timestamp), "utf8");
  if (!fs.existsSync(path.join(wikiRootPath, "log.md"))) {
    fs.writeFileSync(path.join(wikiRootPath, "log.md"), "# Dizzy Cognitive Memory Wiki Log\n\n", "utf8");
  }
}

function trustZoneAllows(memory, trustZone) {
  const zone = String(trustZone || "private_self").trim().toLowerCase();
  if (zone === "private_self") return true;
  const sensitivity = String(memory.sensitivity_tier || "normal").trim().toLowerCase();
  if (sensitivity === "do_not_export") return false;
  if (zone === "trusted_collaborator") return true;
  if (zone === "outside_contact" || zone === "paid_public") {
    return sensitivity === "public_safe" && memory.trust_zone !== "private_self";
  }
  return false;
}

function makeReceipt(action, details = {}) {
  const payload = {
    schema_version: COGNITIVE_MEMORY_RECEIPT_SCHEMA,
    action,
    status: details.status || "ok",
    timestamp: details.timestamp || new Date().toISOString(),
    storage: "markdown_wiki",
    details: { ...details },
  };
  delete payload.details.timestamp;
  payload.receipt_sha256 = sha256Hex(stableJson(payload.details));
  return payload;
}

export function classifyForCapture(input = {}) {
  const content = String(input.content || input.text || "").trim();
  const normalized = normalizeText(content);
  if (normalized.length < 16) {
    return { decision: "drop", reason: "low_signal_short_text", memory_class: "" };
  }

  const trustZone = String(input.trustZone || input.trust_zone || "private_self").trim().toLowerCase();
  if (!VALID_TRUST_ZONES.has(trustZone)) {
    return { decision: "reject", reason: "invalid_trust_zone", memory_class: "" };
  }

  const forcedClass = String(input.memoryClass || input.memory_class || "").trim().toLowerCase();
  const inferredClass = forcedClass || inferMemoryClass(content);
  if (!VALID_MEMORY_CLASSES.has(inferredClass)) {
    return { decision: "drop", reason: "no_durable_or_expiring_signal", memory_class: "" };
  }

  return {
    decision: "capture",
    reason: forcedClass ? "operator_forced_capture" : "durable_signal_detected",
    memory_class: inferredClass,
    canonical_key: String(input.canonicalKey || input.canonical_key || inferCanonicalKey(content)).trim().toLowerCase(),
    polarity: inferPolarity(content),
  };
}

export class CognitiveMemoryEngine {
  constructor(opts = {}) {
    this.wikiRootPath = resolveWikiRoot(opts);
    this.storePath = this.wikiRootPath;
    this.now = opts.now || (() => new Date());
    this.decayHalfLifeDays = Math.max(1, Number(opts.decayHalfLifeDays || 60));
    this.archiveBelowConfidence = clamp01(opts.archiveBelowConfidence, 0.15);
    this.duplicateThreshold = clamp01(opts.duplicateThreshold, 0.82);
    this.memories = Array.isArray(opts.memories)
      ? opts.memories.map((m) => ({ ...m }))
      : readWikiMemories(this.wikiRootPath);
  }

  save({ timestamp = isoNow(this.now) } = {}) {
    writeWiki(this.wikiRootPath, this.memories, timestamp);
  }

  list({ includeArchived = false } = {}) {
    return this.memories.filter((m) => includeArchived || m.status === "active").map((m) => ({ ...m }));
  }

  capture(input = {}) {
    const timestamp = isoNow(input.now || this.now);
    const classification = classifyForCapture(input);
    if (classification.decision !== "capture") {
      const receipt = makeReceipt("capture", {
        status: classification.decision,
        reason: classification.reason,
        timestamp,
        content_sha256: sha256Hex(String(input.content || input.text || "")),
      });
      appendLogEntry(this.wikiRootPath, {
        timestamp,
        action: "capture",
        status: classification.decision,
        receipt_sha256: receipt.receipt_sha256,
      });
      return { decision: classification.decision, reason: classification.reason, receipt };
    }

    const content = String(input.content || input.text || "").trim();
    const canonicalKey = classification.canonical_key;
    const polarity = classification.polarity;
    const activeSameKey = this.memories.filter((m) => m.status === "active" && m.canonical_key === canonicalKey);
    const conflicts = activeSameKey.filter((m) => Number(m.polarity || 0) !== 0 && polarity !== 0 && Number(m.polarity) !== polarity);
    if (conflicts.length) {
      const receipt = makeReceipt("reconcile", {
        timestamp,
        status: "flag_conflict",
        canonical_key: canonicalKey,
        incoming_sha256: sha256Hex(content),
        conflict_count: conflicts.length,
        conflict_ids: conflicts.map((m) => m.memory_id),
      });
      appendLogEntry(this.wikiRootPath, {
        timestamp,
        action: "reconcile",
        status: "flag_conflict",
        canonical_key: canonicalKey,
        receipt_sha256: receipt.receipt_sha256,
        count: conflicts.length,
      });
      return {
        decision: "flag_conflict",
        conflicts: conflicts.map((m) => ({
          memory_id: m.memory_id,
          canonical_key: m.canonical_key,
          content_sha256: m.content_sha256,
          polarity: m.polarity,
          wiki_page: memoryPageRelPath(m).replace(/\\/g, "/"),
        })),
        receipt,
      };
    }

    const duplicate = activeSameKey.find((m) => {
      const existingPolarity = Number(m.polarity || 0);
      return existingPolarity === polarity || existingPolarity === 0 || polarity === 0;
    });
    if (duplicate) {
      duplicate.reinforcement_count = Number(duplicate.reinforcement_count || 1) + 1;
      duplicate.confidence = clamp01(Math.max(Number(duplicate.confidence || 0.5), clamp01(input.confidence, 0.7)) + 0.04);
      duplicate.last_accessed_at = timestamp;
      duplicate.updated_at = timestamp;
      duplicate.content = `${duplicate.content}\n\nConsolidated note (${timestamp}): ${content}`;
      duplicate.normalized_content = normalizeText(duplicate.content);
      duplicate.content_sha256 = sha256Hex(duplicate.content);
      this.save({ timestamp });
      const receipt = makeReceipt("consolidate", {
        timestamp,
        status: "consolidated",
        target_memory_id: duplicate.memory_id,
        canonical_key: canonicalKey,
        wiki_page: memoryPageRelPath(duplicate).replace(/\\/g, "/"),
        content_sha256: sha256Hex(content),
        reinforcement_count: duplicate.reinforcement_count,
      });
      appendLogEntry(this.wikiRootPath, {
        timestamp,
        action: "consolidate",
        status: "consolidated",
        canonical_key: canonicalKey,
        receipt_sha256: receipt.receipt_sha256,
        count: 1,
      });
      return { decision: "consolidated", memory: { ...duplicate }, receipt };
    }

    const expiresAt = classification.memory_class === "expiring"
      ? isoNow(input.expiresAt || input.expires_at || new Date(new Date(timestamp).getTime() + 14 * 24 * 60 * 60 * 1000))
      : null;
    const memoryId = String(input.id || input.memory_id || `mem_${sha256Hex(`${canonicalKey}:${content}:${timestamp}`).slice(0, 16).toLowerCase()}`);
    const memory = {
      schema_version: COGNITIVE_MEMORY_SCHEMA,
      memory_id: memoryId,
      memory_class: classification.memory_class,
      canonical_key: canonicalKey,
      polarity,
      content,
      normalized_content: normalizeText(content),
      content_sha256: sha256Hex(content),
      source: String(input.source || "operator_reviewed").trim().toLowerCase(),
      trust_zone: String(input.trustZone || input.trust_zone || "private_self").trim().toLowerCase(),
      sensitivity_tier: String(input.sensitivityTier || input.sensitivity_tier || "normal").trim().toLowerCase(),
      confidence: clamp01(input.confidence, 0.7),
      reinforcement_count: Math.max(1, Number(input.reinforcementCount || input.reinforcement_count || 1) || 1),
      status: "active",
      captured_at: timestamp,
      updated_at: timestamp,
      last_accessed_at: timestamp,
      expires_at: expiresAt,
      provenance: input.provenance && typeof input.provenance === "object" ? { ...input.provenance } : {},
      page_path: `entries/${slugify(canonicalKey)}.md`,
    };

    this.memories.push(memory);
    this.save({ timestamp });
    const receipt = makeReceipt("capture", {
      timestamp,
      status: "captured",
      memory_id: memory.memory_id,
      memory_class: memory.memory_class,
      canonical_key: memory.canonical_key,
      wiki_page: memory.page_path,
      content_sha256: memory.content_sha256,
    });
    appendLogEntry(this.wikiRootPath, {
      timestamp,
      action: "capture",
      status: "captured",
      canonical_key: canonicalKey,
      receipt_sha256: receipt.receipt_sha256,
      count: 1,
    });
    return { decision: "captured", memory: { ...memory }, receipt };
  }

  consolidate({ now } = {}) {
    const timestamp = isoNow(now || this.now);
    const byKey = new Map();
    for (const memory of this.memories.filter((m) => m.status === "active")) {
      if (!byKey.has(memory.canonical_key)) byKey.set(memory.canonical_key, []);
      byKey.get(memory.canonical_key).push(memory);
    }

    const consolidated = [];
    for (const group of byKey.values()) {
      for (let i = 0; i < group.length; i += 1) {
        const keeper = group[i];
        if (keeper.status !== "active") continue;
        for (let j = i + 1; j < group.length; j += 1) {
          const candidate = group[j];
          if (candidate.status !== "active") continue;
          if (jaccard(keeper.content, candidate.content) < this.duplicateThreshold) continue;
          keeper.reinforcement_count = Number(keeper.reinforcement_count || 1) + Number(candidate.reinforcement_count || 1);
          keeper.confidence = clamp01(Math.max(Number(keeper.confidence || 0.5), Number(candidate.confidence || 0.5)) + 0.05);
          keeper.updated_at = timestamp;
          keeper.content = `${keeper.content}\n\nConsolidated note (${timestamp}): ${candidate.content}`;
          keeper.normalized_content = normalizeText(keeper.content);
          keeper.content_sha256 = sha256Hex(keeper.content);
          candidate.status = "archived";
          candidate.archive_reason = `consolidated_into:${keeper.memory_id}`;
          candidate.updated_at = timestamp;
          consolidated.push({ from: candidate.memory_id, into: keeper.memory_id });
        }
      }
    }

    this.save({ timestamp });
    const receipt = makeReceipt("consolidate", {
      timestamp,
      status: "ok",
      consolidated_count: consolidated.length,
      consolidated,
    });
    appendLogEntry(this.wikiRootPath, {
      timestamp,
      action: "consolidate",
      status: "ok",
      receipt_sha256: receipt.receipt_sha256,
      count: consolidated.length,
    });
    return { consolidated_count: consolidated.length, consolidated, receipt };
  }

  retrieve(query, opts = {}) {
    const timestamp = isoNow(opts.now || this.now);
    const limit = Math.max(0, Number(opts.limit || opts.k || 5) || 5);
    const queryTokens = new Set(tokenize(query));
    if (!queryTokens.size || !limit) {
      return { memories: [], receipt: makeReceipt("retrieve", { timestamp, status: "empty_query" }) };
    }

    const trustZone = String(opts.trustZone || opts.trust_zone || "private_self").trim().toLowerCase();
    const nowMs = new Date(timestamp).getTime();
    const scored = this.memories
      .filter((m) => m.status === "active")
      .filter((m) => trustZoneAllows(m, trustZone))
      .map((memory) => {
        const semantic = jaccard(query, `${memory.canonical_key} ${memory.content}`);
        const lastAccessedMs = new Date(memory.last_accessed_at || memory.captured_at || timestamp).getTime();
        const daysSinceAccess = Math.max(0, (nowMs - lastAccessedMs) / (24 * 60 * 60 * 1000));
        const freshness = Math.max(0, 1 - daysSinceAccess / this.decayHalfLifeDays);
        const reinforcement = Math.min(1, Math.log2(Number(memory.reinforcement_count || 1) + 1) / 4);
        const confidence = clamp01(memory.confidence, 0.5);
        const score = (semantic * 0.45) + (freshness * 0.2) + (reinforcement * 0.2) + (confidence * 0.15);
        return { memory, score, semantic, freshness, reinforcement, confidence };
      })
      .filter((x) => x.score > 0.12)
      .sort((a, b) => b.score - a.score || a.memory.memory_id.localeCompare(b.memory.memory_id))
      .slice(0, limit);

    for (const item of scored) {
      item.memory.last_accessed_at = timestamp;
    }
    if (scored.length) this.save({ timestamp });

    const receipt = makeReceipt("retrieve", {
      timestamp,
      status: "ok",
      query_sha256: sha256Hex(String(query || "")),
      returned_count: scored.length,
      trust_zone: trustZone,
      traversal_index: "index.md",
      memory_pages: scored.map((x) => memoryPageRelPath(x.memory).replace(/\\/g, "/")),
      memory_ids: scored.map((x) => x.memory.memory_id),
    });
    appendLogEntry(this.wikiRootPath, {
      timestamp,
      action: "retrieve",
      status: "ok",
      receipt_sha256: receipt.receipt_sha256,
      count: scored.length,
    });

    return {
      memories: scored.map((item) => ({
        ...item.memory,
        wiki_page: memoryPageRelPath(item.memory).replace(/\\/g, "/"),
        retrieval_score: Number(item.score.toFixed(6)),
        retrieval_components: {
          semantic: Number(item.semantic.toFixed(6)),
          freshness: Number(item.freshness.toFixed(6)),
          reinforcement: Number(item.reinforcement.toFixed(6)),
          confidence: Number(item.confidence.toFixed(6)),
        },
      })),
      receipt,
    };
  }

  decay({ now } = {}) {
    const timestamp = isoNow(now || this.now);
    const nowMs = new Date(timestamp).getTime();
    let decayedCount = 0;
    let archivedCount = 0;

    for (const memory of this.memories) {
      if (memory.status !== "active") continue;
      const lastAccessedMs = new Date(memory.last_accessed_at || memory.captured_at || timestamp).getTime();
      const daysSinceAccess = Math.max(0, (nowMs - lastAccessedMs) / (24 * 60 * 60 * 1000));
      const decayMultiplier = Math.pow(0.5, daysSinceAccess / this.decayHalfLifeDays);
      const oldConfidence = clamp01(memory.confidence, 0.5);
      const newConfidence = clamp01(oldConfidence * decayMultiplier, oldConfidence);
      if (newConfidence < oldConfidence) {
        memory.confidence = Number(newConfidence.toFixed(6));
        memory.updated_at = timestamp;
        decayedCount += 1;
      }

      if (memory.expires_at && new Date(memory.expires_at).getTime() <= nowMs) {
        memory.status = "archived";
        memory.archive_reason = "expired";
        memory.updated_at = timestamp;
        archivedCount += 1;
        continue;
      }

      if (memory.confidence < this.archiveBelowConfidence) {
        memory.status = "archived";
        memory.archive_reason = "confidence_decay";
        memory.updated_at = timestamp;
        archivedCount += 1;
      }
    }

    this.save({ timestamp });
    const receipt = makeReceipt("decay", {
      timestamp,
      status: "ok",
      decayed_count: decayedCount,
      archived_count: archivedCount,
    });
    appendLogEntry(this.wikiRootPath, {
      timestamp,
      action: "decay",
      status: "ok",
      receipt_sha256: receipt.receipt_sha256,
      count: decayedCount + archivedCount,
    });
    return { decayed_count: decayedCount, archived_count: archivedCount, receipt };
  }
}

export function createA2AMemoryUpdateEnvelope({
  fromAgent,
  toAgent,
  updateType,
  receipt,
  memories = [],
  trustZone = "trusted_collaborator",
  includeContent = false,
  now = () => new Date(),
} = {}) {
  const safeUpdateType = String(updateType || "").trim().toLowerCase();
  if (!VALID_UPDATE_TYPES.has(safeUpdateType)) {
    throw new Error(`Invalid memory update type: ${safeUpdateType}`);
  }
  const safeTrustZone = String(trustZone || "trusted_collaborator").trim().toLowerCase();
  if (!VALID_TRUST_ZONES.has(safeTrustZone)) {
    throw new Error(`Invalid memory update trust zone: ${safeTrustZone}`);
  }
  if (includeContent && (safeTrustZone === "outside_contact" || safeTrustZone === "paid_public")) {
    throw new Error("Cannot export raw memory content to public or outside-contact A2A zones");
  }

  const exportedMemories = memories
    .filter((memory) => trustZoneAllows(memory, safeTrustZone))
    .map((memory) => {
      const base = {
        memory_id: memory.memory_id,
        memory_class: memory.memory_class,
        canonical_key: memory.canonical_key,
        wiki_page: memory.wiki_page || memory.page_path || memoryPageRelPath(memory).replace(/\\/g, "/"),
        confidence: memory.confidence,
        reinforcement_count: memory.reinforcement_count,
        content_sha256: memory.content_sha256,
        sensitivity_tier: memory.sensitivity_tier,
      };
      if (includeContent && memory.sensitivity_tier !== "do_not_export") {
        base.content = memory.content;
      }
      return base;
    });

  const payload = {
    schema_version: A2A_MEMORY_UPDATE_SCHEMA,
    update_type: safeUpdateType,
    storage: "markdown_wiki",
    receipt_schema: receipt?.schema_version || "",
    receipt_sha256: receipt?.receipt_sha256 || sha256Hex(stableJson(receipt || {})),
    exported_memory_count: exportedMemories.length,
    traversal_index: "memory/wiki/index.md",
    memories: exportedMemories,
    created_at: isoNow(now),
  };
  payload.payload_sha256 = sha256Hex(stableJson(payload));

  return createA2AMessage({
    senderId: fromAgent,
    recipientId: toAgent,
    messageType: "memory_update",
    payload,
    trustZone: safeTrustZone,
    priority: "high",
    now,
  });
}
