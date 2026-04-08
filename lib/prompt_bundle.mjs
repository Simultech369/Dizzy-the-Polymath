import crypto from "crypto";
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

const CONSTITUTIONAL_FILES = [
  "IDENTITY.md",
  "SOUL.md",
  "HEARTBEAT.md",
  "TOOLS.md",
  "USER.md",
  "PROMPT_CORE.md",
  "PROMPT_MODES.md",
];

const SUPPLEMENTAL_FILES = [];

function resolvePromptFiles() {
  const defaultList = [...CONSTITUTIONAL_FILES];

  const packs = {
    core: defaultList,
    creative: [
      ...CONSTITUTIONAL_FILES,
      ...SUPPLEMENTAL_FILES,
      "PROTOCOL.md",
      "LEVERAGE.md",
      "PENGUIN.md",
      "COPPER-INU.md",
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
      "GOVERNANCE.md",
      "NEXT.md",
      "CAPABILITIES.md",
      "ECONOMICS.md",
      "OPERATIONS.md",
      "COMMUNICATION.md",
      "MARKETPLACE_PROTOCOL.md",
      "LEGAL-GUARDRAILS.md",
      "PROTOCOL.md",
      "LEVERAGE.md",
      "PENGUIN.md",
      "COPPER-INU.md",
      "TROLL.md",
      "MEMORY.md",
    ],
  };

  const pack = String(env("DIZZY_PROMPT_PACK", "")).trim().toLowerCase();
  if (pack && packs[pack]) return packs[pack].map((p) => path.resolve(process.cwd(), p));

  const configured = normalizeList(env("DIZZY_PROMPT_FILES", ""));
  const list = configured.length ? configured : defaultList;
  return list.map((p) => path.resolve(process.cwd(), p));
}

let cached = null;

export function getPromptSources() {
  const maxCharsPerFile = Math.max(500, Number(env("DIZZY_PROMPT_FILE_MAX_CHARS", "8000")) || 8000);
  const files = resolvePromptFiles();

  const sources = files.map((absPath) => {
    const rel = path.relative(process.cwd(), absPath).replace(/\\/g, "/");
    const raw = readFileText(absPath);
    const hash = sha256Hex(raw);
    const { text, truncated } = truncateText(raw.trim(), maxCharsPerFile);
    const role = CONSTITUTIONAL_FILES.includes(rel) ? "constitutional" : "supplemental";
    return {
      path: rel,
      role,
      exists: Boolean(raw),
      bytes: raw ? Buffer.byteLength(raw, "utf8") : 0,
      sha256: raw ? hash : "",
      truncated,
      text,
    };
  });

  return sources;
}

export function buildChatSystemPrompt() {
  const sources = getPromptSources();
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
    `prompt_pack=${pack || "(unset)"}`,
    `brevity_mode=${brevityMode || "(unset)"}`,
    `affect_mode=${affectMode || "(unset)"}`,
    `reinforcement_mode=${reinforcementMode || "(unset)"}`,
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
  return { systemPrompt, sources };
}

export function getCachedChatSystemPrompt() {
  const now = Date.now();
  const ttlMs = Math.max(250, Number(env("DIZZY_PROMPT_CACHE_MS", "2000")) || 2000);
  if (cached && now - cached.at < ttlMs) return cached.value;
  const value = buildChatSystemPrompt();
  cached = { at: now, value };
  return value;
}
