import crypto from "crypto";
import fs from "fs";
import path from "path";
import { parseFrontmatter } from "./markdown_frontmatter.mjs";

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

function readFileText(filePath) {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function truncateText(text, maxChars) {
  const s = String(text || "");
  if (!maxChars || s.length <= maxChars) return { text: s, truncated: false };
  return { text: `${s.slice(0, maxChars)}\n\n...[truncated]`, truncated: true };
}

const CONSTITUTIONAL_KERNEL_FILE = "CONSTITUTIONAL_KERNEL.md";

const CONSTITUTIONAL_FILES = [
  CONSTITUTIONAL_KERNEL_FILE,
  "CONSTITUTION.md",
  "IDENTITY.md",
  "identity/personas/SOUL.md",
  "TOOLS.md",
  "identity/personas/USER.md",
  "PROMPT_CORE.md",
  "PROMPT_MODES.md",
];

const SUPPLEMENTAL_FILES = [];

const CLIENT_SAFE_PROMPT_FILES = [
  CONSTITUTIONAL_KERNEL_FILE,
  "CONSTITUTION.md",
  "IDENTITY.md",
  "PROMPT_CORE.md",
  "PROMPT_MODES.md",
];

function normalizeTrustZone(value) {
  const raw = String(value || "").trim().toLowerCase();
  return ["private_self", "trusted_collaborator", "outside_contact", "paid_public"].includes(raw) ? raw : "";
}

function resolvePromptFiles(options = {}) {
  const trustZone = normalizeTrustZone(options.trustZone ?? options.trust_zone);
  if (trustZone === "paid_public") {
    return CLIENT_SAFE_PROMPT_FILES.map((p) => path.resolve(process.cwd(), p));
  }

  const defaultList = [...CONSTITUTIONAL_FILES];

  const packs = {
    core: defaultList,
    creative: [
      ...CONSTITUTIONAL_FILES,
      ...SUPPLEMENTAL_FILES,
      "PROTOCOL.md",
      "overlays/LEVERAGE.md",
      "identity/personas/PENGUIN.md",
      "identity/personas/COPPER-INU.md",
    ],
    ops: [
      ...CONSTITUTIONAL_FILES,
      ...SUPPLEMENTAL_FILES,
      "OPERATIONS.md",
      "COMMUNICATION.md",
      "MARKETPLACE_PROTOCOL.md",
      "LEGAL-GUARDRAILS.md",
      "CLIENTS.md",
      "CLIENT_TEMPLATE.md",
      "MEMORY.md",
    ],
    // Full is intentionally "batteries included" but still bounded; if you truly want everything,
    // set DIZZY_PROMPT_FILES manually.
    full: [
      ...CONSTITUTIONAL_FILES,
      ...SUPPLEMENTAL_FILES,
      "DESIGN.md",
      "INTERACTION_NORMS.md",
      "NEXT.md",
      "CAPABILITIES.md",
      "ECONOMICS.md",
      "OPERATIONS.md",
      "COMMUNICATION.md",
      "MARKETPLACE_PROTOCOL.md",
      "LEGAL-GUARDRAILS.md",
      "PROTOCOL.md",
      "overlays/LEVERAGE.md",
      "identity/personas/PENGUIN.md",
      "identity/personas/COPPER-INU.md",
      "identity/personas/TROLL.md",
      "MEMORY.md",
    ],
  };

  const pack = String(env("DIZZY_PROMPT_PACK", "")).trim().toLowerCase();
  let list = defaultList;
  if (pack && packs[pack]) {
    list = packs[pack];
  } else {
    const configured = normalizeList(env("DIZZY_PROMPT_FILES", ""));
    if (configured.length) list = configured;
  }

  const overlaysConfig = normalizeList(env("DIZZY_PROMPT_OVERLAYS", ""));
  const combinedList = [...list, ...overlaysConfig];
  return combinedList.map((p) => path.resolve(process.cwd(), p));
}

const ATTENTION_SINK_FILES = [
  "PROMPT_CORE.md",
  "AGENTS.md",
  "CONSTITUTION.md",
  "IDENTITY.md",
];

let cached = null;

export function getPromptSources(options = {}) {
  const maxCharsPerFile = Math.max(500, Number(env("DIZZY_PROMPT_FILE_MAX_CHARS", "8000")) || 8000);
  const files = resolvePromptFiles(options);

  // Block-Sparse Prompt Attention: Ensure sink files are always processed first
  const sortedFiles = [...files].sort((a, b) => {
    const aIsSink = ATTENTION_SINK_FILES.some(s => a.endsWith(s));
    const bIsSink = ATTENTION_SINK_FILES.some(s => b.endsWith(s));
    if (aIsSink && !bIsSink) return -1;
    if (!aIsSink && bIsSink) return 1;
    return 0;
  });

  let sources = [];
  let totalChars = 0;
  let compressionRatio = 1.0; // Placeholder for future retrofitting

  for (const absPath of sortedFiles) {
    const rel = path.relative(process.cwd(), absPath).replace(/\\/g, "/");
    const isSink = ATTENTION_SINK_FILES.includes(rel);
    const raw = readFileText(absPath);
    if (!raw) {
      sources.push({
        path: rel,
        role: CONSTITUTIONAL_FILES.includes(rel) ? "constitutional" : "supplemental",
        exists: false,
        bytes: 0,
        sha256: "",
        truncated: false,
        text: "",
        is_sink: isSink,
      });
      continue;
    }

    const { data, body } = parseFrontmatter(raw);
    if (data && data.expires_at) {
      const expiry = Date.parse(data.expires_at.trim());
      if (!Number.isNaN(expiry) && Date.now() > expiry) {
        if (CONSTITUTIONAL_FILES.includes(rel)) {
          throw new Error(`Constitutional prompt source expired: ${rel} (${data.expires_at.trim()})`);
        }
        continue;
      }
    }

    const hash = sha256Hex(raw);
    // Sinks are never truncated. Other files respect the maxChars limit.
    const charsLimit = isSink ? 0 : maxCharsPerFile;
    const { text, truncated } = truncateText(body.trim(), charsLimit);
    const role = CONSTITUTIONAL_FILES.includes(rel) ? "constitutional" : "supplemental";
    sources.push({
      path: rel,
      role,
      exists: true,
      bytes: Buffer.byteLength(raw, "utf8"),
      sha256: hash,
      truncated,
      text,
      is_sink: isSink,
    });
    totalChars += text.length;
  }

  // Placeholder for Dynamic Prompt Retrofitting. In the future, this block
  // would check hardware state and prune/summarize non-sink sources if needed.
  // For now, we just calculate the potential compression.
  const hardwareThresholdChars = 32000; // Example threshold
  if (totalChars > hardwareThresholdChars) {
    // This is where summarization logic would go.
    // For now, we simulate a 50% reduction for demonstration.
    const targetChars = hardwareThresholdChars;
    compressionRatio = targetChars / totalChars;
  }

  return { sources, compression_ratio: compressionRatio };
}

export function buildChatSystemPrompt(options = {}) {
  const trustZone = normalizeTrustZone(options.trustZone ?? options.trust_zone);
  const { sources, compression_ratio } = getPromptSources({ trustZone });
  const backend = String(env("DIZZY_CHAT_BACKEND", "")).trim().toLowerCase();
  const model = String(env("GEMINI_MODEL", "")).trim();
  const pack = String(env("DIZZY_PROMPT_PACK", "")).trim().toLowerCase();
  const brevityMode = String(env("DIZZY_BREVITY_MODE", "lite")).trim().toLowerCase();
  const affectMode = String(env("DIZZY_AFFECT_MODE", "attuned")).trim().toLowerCase();
  const reinforcementMode = String(env("DIZZY_REINFORCEMENT_MODE", "gold_star")).trim().toLowerCase();

  const header = [
    "You are Dizzy.",
    "Treat the following files as the authoritative runtime constitution. Follow them in order.",
    "If they conflict, prefer earlier documents over later ones.",
    "Keep the constitutional layer small and legible. Supplemental guidance should refine judgment, not flood it.",
    "",
    `chat_backend=${backend || "(unset)"}`,
    `gemini_model=${model || "(unset)"}`,
    `prompt_pack=${trustZone === "paid_public" ? "client_safe_forced" : (pack || "(unset)")}`,
    `trust_zone=${trustZone || "(unset)"}`,
    `brevity_mode=${brevityMode || "(unset)"}`,
    `affect_mode=${affectMode || "(unset)"}`,
    `reinforcement_mode=${reinforcementMode || "(unset)"}`,
    `context_compression_ratio=${compression_ratio.toFixed(2)}`,
  ].join("\n");

  const blocks = sources.map((s) => {
    const titleBase = `${s.path} [${s.role}]`;
    const title = s.exists ? `${titleBase}${s.truncated ? " (truncated)" : ""}` : `${titleBase} (missing)`;
    return [
      "",
      `=== ${title} ===`,
      s.exists ? s.text : "(missing file)",
      `=== END ${s.path} ===`,
    ].join("\n");
  });

  const systemPrompt = [header, ...blocks].join("\n");
  return { systemPrompt, sources, compression_ratio };
}

export function getCachedChatSystemPrompt(options = {}) {
  const now = Date.now();
  const ttlMs = Math.max(250, Number(env("DIZZY_PROMPT_CACHE_MS", "2000")) || 2000);
  const trustZone = normalizeTrustZone(options.trustZone ?? options.trust_zone);
  const pack = String(env("DIZZY_PROMPT_PACK", "")).trim().toLowerCase();
  const key = `${trustZone || "default"}:${pack}`;
  if (cached && cached.key === key && now - cached.at < ttlMs) return cached.value;
  const value = buildChatSystemPrompt({ trustZone });
  cached = { at: now, key, value };
  return value;
}
