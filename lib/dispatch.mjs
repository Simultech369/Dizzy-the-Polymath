import fs from "fs";
import path from "path";
import { geminiGenerateText } from "./gemini_client.mjs";
import { openaiCompatGenerateText } from "./openai_compat_client.mjs";
import { runToolJob } from "./tools.mjs";
import { getCachedChatSystemPrompt } from "./prompt_bundle.mjs";
import { getRelevantMarkdownSnippets } from "./md_retriever.mjs";
import { getRelevantMemoryGraphContext } from "./memory_graph.mjs";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function parseBoolEnv(name, fallback = false) {
  const raw = String(env(name, fallback ? "1" : "0")).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parseIntEnv(name, fallback) {
  const n = Number(env(name, String(fallback)));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeLineEndings(s) {
  return String(s ?? "").replace(/\r\n/g, "\n");
}

function sanitizeForMemory(text) {
  // Best-effort redaction for common secrets.
  // Not exhaustive; acts as a guardrail against accidental key logging.
  let t = normalizeLineEndings(text);

  // Telegram bot tokens (e.g. 123456789:AA...).
  t = t.replace(/\b(\d{6,}):([A-Za-z0-9_-]{20,})\b/g, "[REDACTED_TELEGRAM_TOKEN]");

  // OpenAI-ish keys (sk-...).
  t = t.replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]");

  // Google API keys (AIza...).
  t = t.replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[REDACTED_API_KEY]");

  // Generic env-style assignments: FOO=bar (only for key-ish names).
  t = t.replace(/\b([A-Z0-9_]{2,64}(?:API|TOKEN|SECRET|KEY)[A-Z0-9_]{0,64})=([^\s]{6,})\b/g, "$1=[REDACTED]");

  return t;
}

function formatLocalDateYYYYMMDD(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderTranscriptForSummary(history, maxTurns) {
  const turns = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .slice(-Math.max(2, maxTurns) * 2);

  const lines = [];
  for (const m of turns) {
    const who = m.role === "user" ? "USER" : "ASSISTANT";
    const body = sanitizeForMemory(m.text).trim();
    if (!body) continue;
    lines.push(`${who}: ${body}`);
  }
  return lines.join("\n");
}

function compactMemoryPreview(text, maxLines = 12) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  return lines.slice(0, maxLines).join("\n");
}

const TRUST_ZONES = new Set([
  "private_self",
  "trusted_collaborator",
  "outside_contact",
  "paid_public",
]);

function getTrustZone(msg) {
  const explicit = String(msg?.runtime_context?.trust_zone ?? "").trim().toLowerCase();
  if (TRUST_ZONES.has(explicit)) return explicit;

  const channel = String(msg?.channel ?? "").trim().toLowerCase();
  if (channel === "execute") return "paid_public";
  if (channel === "local" || channel === "telegram") return "private_self";
  return "outside_contact";
}

export function getContinuityMode(msg) {
  const explicit = String(msg?.runtime_context?.continuity_mode ?? "").trim().toLowerCase();
  if (explicit === "client") return "client";
  if (explicit === "ephemeral") return "ephemeral";
  return "default";
}

export function trustZoneUsesEphemeralChatHistory(msg, trustZone = getTrustZone(msg)) {
  if (trustZone !== "paid_public") return false;
  return getContinuityMode(msg) !== "client";
}

function trustZoneAllowsRepoRetrieval(trustZone) {
  return trustZone === "private_self" || trustZone === "trusted_collaborator";
}

function trustZoneAllowsDurableMemory(trustZone) {
  return trustZone === "private_self" || trustZone === "trusted_collaborator";
}

function autoMemoryStatePath(convoKey) {
  return path.resolve(process.cwd(), "runtime", "auto_memory", `${convoKey}.json`);
}

function autoMemoryCandidatePath(convoKey) {
  return path.resolve(process.cwd(), "runtime", "auto_memory_candidates", `${convoKey}.json`);
}

function normalizeForSignature(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function hashString(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function readJsonFileIfExists(filePath) {
  const raw = readTextFileIfExists(filePath);
  return safeJsonParse(raw);
}

function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function autoRememberSignalScore(history) {
  const recent = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .slice(-8);
  const joined = recent.map((m) => sanitizeForMemory(m.text)).join("\n");
  const lower = joined.toLowerCase();

  let score = 0;
  if (recent.length >= 4) score += 1;
  if (joined.length >= 800) score += 1;
  if (/\b(decide|decision|decided|constraint|preference|important|remember|revisit|next step|plan|changed|shift|should|must|policy|rule)\b/i.test(lower)) score += 2;
  if (/\b(why it matters|trade-?off|cost|value|quality|quantity|leverage|durable|automatic)\b/i.test(lower)) score += 1;
  if (/\b(we should|i want|i don't want|prefer|avoid|default|always|never)\b/i.test(lower)) score += 1;
  if (/\b(housing|instability|precarity|rent|debt|burnout|coercion|injustice|conditions|structure|systemic|autonomy|consent|community|mutual aid|solidarity)\b/i.test(lower)) score += 2;
  if (/\b(body|heart|spirit|wisdom|signal|truth|meaning|responsibility|human spirit|freedom)\b/i.test(lower)) score += 1;
  return score;
}

function clearFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function buildAutoRememberCandidate({ convoKey, history, score, signature, nowMs }) {
  const rememberedTurns = Math.max(4, Number(env("DIZZY_AUTO_REMEMBER_MAX_TURNS", "24")) || 24);
  return {
    convo_key: convoKey,
    created_at: new Date(nowMs).toISOString(),
    signature,
    score,
    max_turns: rememberedTurns,
    transcript: renderTranscriptForSummary(history, rememberedTurns),
  };
}

export function shouldAutoRemember({ convoKey, history, nowMs = Date.now() }) {
  if (!parseBoolEnv("DIZZY_AUTO_REMEMBER", true)) return { ok: false, reason: "disabled" };
  const minScore = Math.max(1, Number(env("DIZZY_AUTO_REMEMBER_MIN_SCORE", "4")) || 4);
  const score = autoRememberSignalScore(history);

  const recent = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .slice(-8);
  const signature = hashString(recent.map((m) => `${m.role}:${normalizeForSignature(m.text)}`).join("\n"));

  const statePath = autoMemoryStatePath(convoKey);
  const candidatePath = autoMemoryCandidatePath(convoKey);
  const state = readJsonFileIfExists(statePath) || {};
  const candidate = readJsonFileIfExists(candidatePath) || null;
  const cooldownMs = Math.max(60_000, Number(env("DIZZY_AUTO_REMEMBER_COOLDOWN_MS", "1800000")) || 1800000);
  const candidateDelayMs = Math.max(30_000, Number(env("DIZZY_AUTO_REMEMBER_DELAY_MS", "180000")) || 180000);
  const candidateMaxAgeMs = Math.max(candidateDelayMs, Number(env("DIZZY_AUTO_REMEMBER_MAX_AGE_MS", "86400000")) || 86400000);
  const lastAt = Date.parse(state.last_at || "");

  if (candidate) {
    const createdAt = Date.parse(candidate.created_at || "");
    if (!Number.isFinite(createdAt) || nowMs - createdAt > candidateMaxAgeMs) {
      return { ok: false, reason: "stale_candidate", score, signature, candidatePath, clearCandidate: true };
    }
    if ((candidate.transcript || "").trim() && nowMs - createdAt >= candidateDelayMs && state.last_signature !== candidate.signature) {
      return { ok: true, action: "promote", score, signature, statePath, candidatePath, candidate };
    }
  }
  if (state.last_signature && state.last_signature === signature) {
    return { ok: false, reason: "duplicate", score, signature, candidatePath };
  }
  if (score < minScore) return { ok: false, reason: "low_signal", score, signature, candidatePath };
  if (Number.isFinite(lastAt) && nowMs - lastAt < cooldownMs) {
    return { ok: false, reason: "cooldown", score, signature, candidatePath };
  }
  if (candidate && candidate.signature === signature) {
    return { ok: false, reason: "pending", score, signature, candidatePath };
  }
  return {
    ok: true,
    action: "stage",
    score,
    signature,
    statePath,
    candidatePath,
    candidate: buildAutoRememberCandidate({ convoKey, history, score, signature, nowMs }),
  };
}

function buildRememberSystemPrompt() {
  return [
    "You are writing durable memory for a private personal assistant.",
    "Convert the transcript into compact durable memory for later retrieval and continuity.",
    "Favor metabolized residue over note-dumping.",
    "Hard rules:",
    "- Do NOT include API keys, tokens, passwords, or secrets (if seen, replace with [REDACTED]).",
    "- Do NOT quote long verbatim blocks; paraphrase.",
    "- Do NOT add a trailing question.",
    "- Do NOT write a generic recap of the conversation.",
    "- Prefer fewer bullets with higher information density.",
    "- Capture only information likely to matter later: conditions, decisions, shifts, constraints, reusable patterns, unresolved questions.",
    "- Treat distress or activation as potentially meaningful signal before treating it as noise.",
    "- Preserve links between lived response and the conditions producing it when that link matters.",
    "- Prefer structural causes, autonomy threats, normalization pressure, and orientation shifts over symptom chatter.",
    "- If nothing durable happened in a section, write `- none`.",
    "- Every important item should be concrete enough that future retrieval can act on it.",
    "- Include why something matters when that is not obvious from the fact itself.",
    "- Name what changed in interpretation or posture when a conversation produced a real shift.",
    "Output format (exact headings):",
    "## Summary",
    "## Decisions",
    "## Open Loops",
    "## Preferences & Constraints",
    "## Next Actions",
  ].join("\n");
}

async function writeRememberedMemory({
  generateText,
  defaultTimeoutMs,
  convoKey,
  msg,
  transcript,
  extra = "",
  maxTokens,
  mode = "manual",
}) {
  const now = new Date();
  const iso = now.toISOString();
  const ymd = formatLocalDateYYYYMMDD(now);

  const memoryDir = path.resolve(process.cwd(), "memory");
  const convoMemoryDir = path.resolve(memoryDir, "conversations");
  const convoMemoryPath = path.resolve(convoMemoryDir, `${convoKey}.md`);
  const dailyPath = path.resolve(memoryDir, `${ymd}.md`);

  const rememberSystem = buildRememberSystemPrompt();
  const transcriptBlock = `TRANSCRIPT (most recent turns; sanitized):\n${transcript}`;
  const noteBlock = extra ? `\n\nUSER NOTE:\n${sanitizeForMemory(extra)}` : "";
  const priorMemory = readTextFileIfExists(convoMemoryPath);
  const priorBlock = priorMemory
    ? `\n\nEXISTING MEMORY PREVIEW:\n${compactMemoryPreview(sanitizeForMemory(priorMemory), 14)}`
    : "";

  const mem = await generateText({
    systemPrompt: rememberSystem,
    messages: [{
      role: "user",
      text: [
        transcriptBlock,
        noteBlock,
        priorBlock,
        "",
        "Compression rule:",
        "- avoid repeating what is already captured in existing memory unless it materially changed",
        "- prefer delta over duplicate summary",
        "- identify the condition, pattern, or threat signal that made this worth remembering",
        "- when relevant, note what autonomy was threatened, preserved, or clarified",
      ].join("\n"),
    }],
    timeoutMs: defaultTimeoutMs,
    temperature: 0.2,
    maxTokens,
  });

  const cleaned = sanitizeForMemory(mem).trim();
  const header = `# Memory — ${convoKey}\n\n- remembered_at: ${iso}\n- source: ${msg?.channel ?? "unknown"}\n- mode: ${mode}\n`;
  const convoDoc = `${header}\n${cleaned}\n`;
  ensureDir(convoMemoryDir);
  fs.writeFileSync(convoMemoryPath, convoDoc, "utf8");

  const sectionTitle = mode === "auto" ? `## Auto Remembered (${convoKey}) — ${iso}` : `## Remembered (${convoKey}) — ${iso}`;
  if (!fs.existsSync(dailyPath)) {
    ensureDir(path.dirname(dailyPath));
    fs.writeFileSync(dailyPath, `# Daily Log — ${ymd}\n\n${sectionTitle}\n${cleaned}\n`, "utf8");
  } else {
    appendSection(dailyPath, `${sectionTitle}\n${cleaned}`);
  }

  return {
    convoMemoryPath,
    dailyPath,
  };
}

async function maybeHandleAutoRemember({ generateText, defaultTimeoutMs, convoKey, msg, history }) {
  if (!trustZoneAllowsDurableMemory(getTrustZone(msg))) {
    return { ok: false, reason: "trust_zone_blocked" };
  }

  const auto = shouldAutoRemember({ convoKey, history });

  if (auto.clearCandidate && auto.candidatePath) {
    clearFileIfExists(auto.candidatePath);
  }
  if (!auto.ok) return auto;

  if (auto.action === "stage") {
    writeJsonFile(auto.candidatePath, auto.candidate);
    return auto;
  }

  if (auto.action === "promote") {
    await writeRememberedMemory({
      generateText,
      defaultTimeoutMs,
      convoKey,
      msg,
      transcript: String(auto.candidate?.transcript || "").trim(),
      maxTokens: Number(env("DIZZY_AUTO_REMEMBER_MAX_TOKENS", env("DIZZY_REMEMBER_MAX_TOKENS", "500"))) || 500,
      mode: "auto",
    });
    writeJsonFile(auto.statePath, {
      last_at: new Date().toISOString(),
      last_signature: auto.candidate?.signature || auto.signature,
      last_score: auto.candidate?.score || auto.score,
    });
    clearFileIfExists(auto.candidatePath);
  }

  return auto;
}

function appendSection(filePath, sectionText) {
  ensureDir(path.dirname(filePath));
  const exists = fs.existsSync(filePath);
  const prefix = exists ? "\n\n" : "";
  fs.appendFileSync(filePath, `${prefix}${sectionText}`, "utf8");
}

function readLastLines(filePath, maxLines = 500) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.slice(Math.max(0, lines.length - maxLines));
  } catch {
    return [];
  }
}

function fallbackUsagePath(convoKey) {
  return path.resolve(process.cwd(), "runtime", "fallback_usage", `${convoKey}.jsonl`);
}

function countRecentFallbackUses(convoKey, windowMs) {
  const filePath = fallbackUsagePath(convoKey);
  const now = Date.now();
  const lines = readLastLines(filePath, 2000);
  let count = 0;
  for (const line of lines) {
    try {
      const j = JSON.parse(line);
      const t = Date.parse(j?.t);
      if (!Number.isFinite(t)) continue;
      if (now - t <= windowMs) count += 1;
    } catch {
      // ignore
    }
  }
  return count;
}

function recordFallbackUse(convoKey) {
  const filePath = fallbackUsagePath(convoKey);
  appendJsonl(filePath, { t: new Date().toISOString(), kind: "chat_fallback" });
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readTextFileIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function improvementDir() {
  return path.resolve(process.cwd(), "runtime", "improvements");
}

function isAllowedSelfModPath(relPath) {
  const p = String(relPath || "").replace(/\\/g, "/").trim();
  if (!p) return false;
  if (p.startsWith("/") || /^[a-zA-Z]:\//.test(p)) return false;
  if (p.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) return false;

  if (p === "PROMPT_CORE.md") return true;
  if (p === "RUNBOOK.md") return true;

  // Durable memory index + topics (non-governing; explicitly curated).
  if (p === "MEMORY.md") return true;
  if (/^memory\/topics\/[A-Za-z0-9][A-Za-z0-9_.-]{0,80}\.md$/.test(p)) return true;

  return false;
}

function makeImproveId() {
  const d = new Date();
  const ts = d.toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(16).slice(2, 8);
  return `${ts}-${rand}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function appendJsonl(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, "utf8");
}

function readLastJsonl(filePath, maxLines = 1000) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const tail = lines.slice(Math.max(0, lines.length - maxLines));
    const out = [];
    for (const line of tail) {
      try {
        const j = JSON.parse(line);
        out.push(j);
      } catch {
        // ignore
      }
    }
    return out;
  } catch {
    return [];
  }
}

function endsWithQuestion(text) {
  const t = String(text ?? "").trim();
  return /\?\s*$/.test(t);
}

function enforceOptionalityQuestion(text) {
  const t = String(text ?? "").trim();
  if (!t) return "What feels like the next good question to ask?";
  if (endsWithQuestion(t)) return t;
  if (parseBoolEnv("DIZZY_ENFORCE_OPTIONALITY_QUESTION", false)) {
    return `${t}\n\nWhat options do you want to explore next?`;
  }
  return t;
}

function buildDegradedModeReply(msg) {
  const text = String(msg?.text || "").trim();
  const channel = String(msg?.channel || "local").trim().toLowerCase() || "local";
  const trustZone = getTrustZone(msg);
  const ephemeralHistory = trustZoneUsesEphemeralChatHistory(msg, trustZone);
  const convoKey = getConversationKey(msg);
  const convoPath = path.relative(
    process.cwd(),
    path.resolve(process.cwd(), "runtime", "conversations", `${convoKey}.jsonl`),
  ).replace(/\\/g, "/");

  const lines = [
    "Chat backend is not configured, so Dizzy is running in local fallback mode.",
    `Message received${text ? `: ${text}` : "."}`,
    "",
    "Available now:",
    "- `/health` to confirm runtime health",
    "- `/prompt` to inspect the active constitutional prompt files",
    "- `/governance` to inspect governance text",
    "- `tool:http_get <url>` or `tool:cheerio_extract <url> <selector>` for explicit tool work",
    "",
    ephemeralHistory
      ? "This trust zone is in ephemeral mode, so chat history is not being retained by default."
      : `Conversation history is still being tracked in ${convoPath}.`,
  ];

  if (channel === "telegram") {
    lines.push("Remote file-mutating commands remain gated unless `DIZZY_ALLOW_REMOTE_MUTATIONS=1`.");
  }

  lines.push("To enable full chat, set `DIZZY_CHAT_BACKEND` and the matching provider credentials.");
  return enforceOptionalityQuestion(lines.join("\n"));
}

function getConversationKey(msg) {
  if (msg?.channel === "telegram") {
    const chatId = msg?.meta?.telegram?.chat_id;
    if (chatId != null && String(chatId).trim() !== "") return `telegram_${String(chatId).trim()}`;
  }

  const runtimeKey = String(msg?.runtime_context?.conversation_key ?? "").trim();
  if (runtimeKey) return runtimeKey;

  const channel = String(msg?.channel ?? "local").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_") || "local";
  const from = String(msg?.from ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return from ? `${channel}_${from}` : channel;
}

function normalizeIdentifier(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

export function isMutationCommandText(text) {
  const t = String(text ?? "").trim().toLowerCase();
  return t === "/remember"
    || t.startsWith("/remember ")
    || t === "/memory_review"
    || t.startsWith("/memory_review ");
}

export function isSelfModifyCommandText(text) {
  const t = String(text ?? "").trim().toLowerCase();
  return t === "/improve" || t.startsWith("/apply ");
}

export function isRemoteMutationAllowed(msg) {
  if (msg?.runtime_context?.trusted_local === true) return true;
  return parseBoolEnv("DIZZY_ALLOW_REMOTE_MUTATIONS", false);
}

export function isSelfModifyAllowed(msg) {
  if (msg?.runtime_context?.trusted_local !== true) return false;
  return parseBoolEnv("DIZZY_ALLOW_SELF_MODIFY", false);
}

function summarizeToolResult(tool, result) {
  const json = JSON.stringify(result ?? null, null, 2);
  const max = Math.max(500, Number(env("DIZZY_TOOL_INLINE_MAX_CHARS", "3500")) || 3500);
  const body = json.length > max ? `${json.slice(0, max)}...` : json;
  return enforceOptionalityQuestion(`Result (${tool}):\n${body}`);
}

function summarizeToolError(tool, err) {
  const msg = String(err?.message ?? err);
  const body = err?.body ? `\n${String(err.body).slice(0, 1200)}` : "";
  return enforceOptionalityQuestion(`Tool error (${tool}): ${msg}${body}`);
}

function truncateText(text, maxChars) {
  const n = Number(maxChars) || 0;
  const s = String(text ?? "");
  if (n <= 0 || s.length <= n) return s;
  return `${s.slice(0, n)}\n\n...[truncated]`;
}

function clampHistoryForFallback(history) {
  const maxTurns = Math.max(2, Number(env("DIZZY_FALLBACK_MAX_TURNS", "6")) || 6);
  const maxMsgChars = Math.max(200, Number(env("DIZZY_FALLBACK_MAX_MESSAGE_CHARS", "1200")) || 1200);

  return history
    .slice(-maxTurns * 2)
    .map((m) => ({ role: m.role, text: truncateText(m.text, maxMsgChars) }));
}

function shouldFallbackFromGeminiError(err) {
  const status = Number(err?.status ?? 0) || 0;
  if (status === 429) return true;
  if (status >= 500) return true;
  if (status === 0) return true; // network/abort/unknown
  return false;
}

async function maybeChat(msg) {
  const backend = String(env("DIZZY_CHAT_BACKEND", "")).trim().toLowerCase();
  const convoKey = getConversationKey(msg);
  const maxTurns = Math.max(2, Number(env("DIZZY_CHAT_MAX_TURNS", "16")) || 16);
  const convoPath = path.resolve(process.cwd(), "runtime", "conversations", `${convoKey}.jsonl`);

  const { systemPrompt: baseSystemPrompt } = getCachedChatSystemPrompt();

  const geminiApiKey = String(env("GEMINI_API_KEY", "")).trim();
  const geminiModel = String(env("GEMINI_MODEL", "gemini-1.5-flash")).trim();

  const compatBaseUrl = String(env("OPENAI_COMPAT_BASE_URL", "")).trim();
  const compatApiKey = String(env("OPENAI_COMPAT_API_KEY", "")).trim();
  const compatModel = String(env("OPENAI_COMPAT_MODEL", "")).trim();

  const defaultTimeoutMs = Math.max(5000, Number(env("DIZZY_CHAT_TIMEOUT_MS", "20000")) || 20000);
  const defaultTemperature = Number(env("DIZZY_CHAT_TEMPERATURE", "0.7")) || 0.7;

  function missingConfigReply() {
    if (backend === "gemini") {
      if (!geminiApiKey) return { kind: "reply", text: enforceOptionalityQuestion("Chat backend is set to gemini, but GEMINI_API_KEY is missing.") };
      if (!geminiModel) return { kind: "reply", text: enforceOptionalityQuestion("Chat backend is set to gemini, but GEMINI_MODEL is missing.") };
      return null;
    }
    if (backend === "openai_compat" || backend === "openrouter") {
      if (!compatBaseUrl) return { kind: "reply", text: enforceOptionalityQuestion("Chat backend is set to openai_compat, but OPENAI_COMPAT_BASE_URL is missing.") };
      if (!compatApiKey) return { kind: "reply", text: enforceOptionalityQuestion("Chat backend is set to openai_compat, but OPENAI_COMPAT_API_KEY is missing.") };
      if (!compatModel) return { kind: "reply", text: enforceOptionalityQuestion("Chat backend is set to openai_compat, but OPENAI_COMPAT_MODEL is missing.") };
      return null;
    }
    return { kind: "reply", text: enforceOptionalityQuestion(`Unknown chat backend '${backend}'. Try: gemini or openai_compat.`) };
  }

  const text = String(msg?.text ?? "").trim();

  if (isMutationCommandText(text) && !isRemoteMutationAllowed(msg)) {
    return {
      kind: "reply",
      text: enforceOptionalityQuestion(
        "Remote file-mutating commands are disabled. Run this from the local channel or set DIZZY_ALLOW_REMOTE_MUTATIONS=1 if you want Telegram to be allowed to write local state.",
      ),
    };
  }

  if (isSelfModifyCommandText(text) && !isSelfModifyAllowed(msg)) {
    return {
      kind: "reply",
      text: enforceOptionalityQuestion(
        "Self-modification commands are disabled. They are treated as a privileged local operator feature. Set DIZZY_ALLOW_SELF_MODIFY=1 in the local environment if you want to enable /improve or /apply.",
      ),
    };
  }

  // Commands that don't require an LLM.
  if (text === "/reset") {
    try {
      fs.unlinkSync(convoPath);
    } catch {
      // ignore
    }
    return { kind: "reply", text: enforceOptionalityQuestion("Conversation reset.") };
  }

  if (text.toLowerCase().startsWith("/apply ")) {
    const parts = text.split(/\s+/).filter(Boolean);
    const id = parts[1] ? String(parts[1]).trim() : "";
    const confirm = parts[2] ? String(parts[2]).trim().toUpperCase() : "";
    if (!id) return { kind: "reply", text: enforceOptionalityQuestion("Usage: /apply <id> CONFIRM") };
    if (confirm !== "CONFIRM") return { kind: "reply", text: enforceOptionalityQuestion("Refusing to apply without explicit CONFIRM. Usage: /apply <id> CONFIRM") };

    const dir = improvementDir();
    const filePath = path.resolve(dir, `${id}.json`);
    const raw = readTextFileIfExists(filePath);
    const json = safeJsonParse(raw);
    const edits = Array.isArray(json?.edits) ? json.edits : [];
    if (!edits.length) return { kind: "reply", text: enforceOptionalityQuestion(`No edits found for id=${id}.`) };

    const backupDir = path.resolve(dir, "backups", id);
    ensureDir(backupDir);

    const applied = [];
    for (const e of edits) {
      const p = String(e?.path ?? "").trim();
      const content = String(e?.content ?? "");
      if (!isAllowedSelfModPath(p)) continue;
      const abs = path.resolve(process.cwd(), p);
      ensureDir(path.dirname(abs));
      const before = readTextFileIfExists(abs);
      const backupPath = path.resolve(backupDir, p.replace(/\//g, "_"));
      fs.writeFileSync(backupPath, before, "utf8");
      fs.writeFileSync(abs, content, "utf8");
      applied.push(p);
    }

    if (!applied.length) return { kind: "reply", text: enforceOptionalityQuestion(`No allowed edits to apply for id=${id}.`) };
    return { kind: "reply", text: enforceOptionalityQuestion(`Applied edits: ${applied.join(", ")}\nBackup: ${path.relative(process.cwd(), backupDir).replace(/\\/g, "/")}`) };
  }

  async function generateText({ systemPrompt, messages, temperature, timeoutMs, maxTokens } = {}) {
    if (backend === "gemini") {
      return geminiGenerateText({
        apiKey: geminiApiKey,
        model: geminiModel,
        systemPrompt: systemPrompt || "",
        messages: messages || [],
        timeoutMs: timeoutMs ?? defaultTimeoutMs,
        temperature: temperature ?? defaultTemperature,
      });
    }

    if (backend === "openai_compat" || backend === "openrouter") {
      const mt = Number(
        maxTokens ?? env("OPENAI_COMPAT_MAX_TOKENS", "500"),
      ) || 500;
      return openaiCompatGenerateText({
        baseUrl: compatBaseUrl,
        apiKey: compatApiKey,
        model: compatModel,
        systemPrompt: systemPrompt || "",
        messages: messages || [],
        timeoutMs: timeoutMs ?? Math.max(5000, Number(env("OPENAI_COMPAT_TIMEOUT_MS", String(defaultTimeoutMs))) || defaultTimeoutMs),
        temperature: temperature ?? (Number(env("OPENAI_COMPAT_TEMPERATURE", String(defaultTemperature))) || defaultTemperature),
        maxTokens: Math.max(32, mt),
      });
    }

    throw new Error(`Unsupported backend: ${backend}`);
  }

  // Memory / improvement commands (use the configured backend).
  if (text === "/improve") {
    const cfgErr = missingConfigReply();
    if (cfgErr) return cfgErr;
    const history = readLastJsonl(convoPath, 500)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string");

    const transcript = renderTranscriptForSummary(history, Math.max(8, Number(env("DIZZY_REMEMBER_MAX_TURNS", "60")) || 60));
    if (!transcript.trim()) return { kind: "reply", text: enforceOptionalityQuestion("No conversation history found yet.") };

    const now = new Date().toISOString();
    const sources = [
      { path: "PROMPT_CORE.md", content: readTextFileIfExists(path.resolve(process.cwd(), "PROMPT_CORE.md")) },
      { path: "RUNBOOK.md", content: readTextFileIfExists(path.resolve(process.cwd(), "RUNBOOK.md")) },
    ];

    const sys = [
      "You are an internal editor for Dizzy's local repository.",
      "Goal: propose minimal, high-leverage improvements based on the transcript.",
      "Hard rules:",
      "- Output STRICT JSON only (no markdown, no code fences).",
      "- Only propose edits to PROMPT_CORE.md and/or RUNBOOK.md.",
      "- Keep edits small and non-theatrical; do not change ontology/identity files.",
      "- Do not add external links or require new services.",
      "JSON schema:",
      "{",
      '  "edits": [',
      '    {"path":"PROMPT_CORE.md","content":"<full new file text>"},',
      '    {"path":"RUNBOOK.md","content":"<full new file text>"}',
      "  ],",
      '  "summary": "<1-3 sentences describing what changed and why>"',
      "}",
    ].join("\n");

    const user = [
      `NOW=${now}`,
      "",
      "TRANSCRIPT:",
      transcript,
      "",
      "CURRENT FILES:",
      ...sources.map((s) => [`--- ${s.path} ---`, truncateText(s.content, 12000)].join("\n")),
    ].join("\n");

    try {
      const out = await generateText({
        systemPrompt: sys,
        messages: [{ role: "user", text: user }],
        timeoutMs: defaultTimeoutMs,
        temperature: 0.2,
        maxTokens: Number(env("DIZZY_IMPROVE_MAX_TOKENS", env("OPENAI_COMPAT_MAX_TOKENS", "900"))) || 900,
      });

      const json = safeJsonParse(String(out || "").trim());
      const edits = Array.isArray(json?.edits) ? json.edits : [];
      const summary = String(json?.summary ?? "").trim();
      if (!edits.length) return { kind: "reply", text: enforceOptionalityQuestion("Improve: model returned no edits.") };

      const cleanedEdits = [];
      for (const e of edits) {
        const p = String(e?.path ?? "").trim();
        const content = String(e?.content ?? "");
        if (!isAllowedSelfModPath(p)) continue;
        if (!content.trim()) continue;
        if (content.length > 200_000) continue;
        cleanedEdits.push({ path: p, content });
      }
      if (!cleanedEdits.length) return { kind: "reply", text: enforceOptionalityQuestion("Improve: no allowed edits produced.") };

      const id = makeImproveId();
      const dir = improvementDir();
      ensureDir(dir);
      const payload = { id, created_at: now, convoKey, summary, edits: cleanedEdits };
      const savePath = path.resolve(dir, `${id}.json`);
      fs.writeFileSync(savePath, JSON.stringify(payload, null, 2), "utf8");

      const rel = path.relative(process.cwd(), savePath).replace(/\\/g, "/");
      const msgTxt = summary ? `Proposed improvements: ${summary}` : "Proposed improvements saved.";
      return { kind: "reply", text: enforceOptionalityQuestion(`${msgTxt}\n\nSaved: ${rel}\n\nTo apply: /apply ${id} CONFIRM`) };
    } catch (e) {
      const msgTxt = String(e?.message ?? e);
      const body = e?.body ? `\n${String(e.body).slice(0, 1200)}` : "";
      return { kind: "reply", text: enforceOptionalityQuestion(`Improve failed: ${msgTxt}${body}`) };
    }
  }

  if (text === "/memory_review" || text.toLowerCase().startsWith("/memory_review ")) {
    const cfgErr = missingConfigReply();
    if (cfgErr) return cfgErr;
    const extra = text.length > "/memory_review".length ? text.slice("/memory_review".length).trim() : "";
    const now = new Date().toISOString();

    const memoryIndexPath = path.resolve(process.cwd(), "MEMORY.md");
    const memoryIndex = readTextFileIfExists(memoryIndexPath);

    const memoryDir = path.resolve(process.cwd(), "memory");
    const topicDir = path.resolve(memoryDir, "topics");

    function listRecentMarkdownFiles(dirPath, limit = 8) {
      let entries = [];
      try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
      } catch {
        return [];
      }

      const files = [];
      for (const e of entries) {
        if (!e.isFile()) continue;
        if (!String(e.name || "").toLowerCase().endsWith(".md")) continue;
        const abs = path.resolve(dirPath, e.name);
        try {
          const st = fs.statSync(abs);
          files.push({ abs, mtimeMs: Number(st.mtimeMs || 0) });
        } catch {
          // ignore
        }
      }

      files.sort((a, b) => b.mtimeMs - a.mtimeMs);
      return files.slice(0, Math.max(0, limit)).map((x) => x.abs);
    }

    const recentDaily = listRecentMarkdownFiles(memoryDir, Math.max(0, Number(env("DIZZY_MEMORY_REVIEW_RECENT_DAILY", "6")) || 6))
      .filter((p) => path.dirname(p) === memoryDir) // only direct children
      .filter((p) => path.basename(p).toLowerCase() !== "memory.md"); // just in case

    const recentTopics = listRecentMarkdownFiles(topicDir, Math.max(0, Number(env("DIZZY_MEMORY_REVIEW_RECENT_TOPICS", "6")) || 6));

    const sources = [
      { path: "MEMORY.md", content: memoryIndex },
      ...recentTopics.map((abs) => ({
        path: path.relative(process.cwd(), abs).replace(/\\/g, "/"),
        content: readTextFileIfExists(abs),
      })),
      ...recentDaily.map((abs) => ({
        path: path.relative(process.cwd(), abs).replace(/\\/g, "/"),
        content: readTextFileIfExists(abs),
      })),
    ];

    const sys = [
      "You are a Memory Review Agent for Dizzy (a private local-first assistant).",
      "Goal: propose minimal, high-leverage updates to durable memory.",
      "",
      "Hard rules:",
      "- Output STRICT JSON only (no markdown, no code fences).",
      "- Do NOT apply changes; only propose edits.",
      "- Allowed paths for edits: MEMORY.md and memory/topics/*.md only.",
      "- Do NOT modify governance files (IDENTITY.md, SOUL.md, HEARTBEAT.md, TOOLS.md, USER.md, PROTOCOL.md, LEGAL-GUARDRAILS.md, etc.).",
      "- Do NOT include secrets (tokens, API keys, passwords). If encountered, replace with [REDACTED].",
      "- Do NOT quote long verbatim blocks; paraphrase.",
      "- Prefer fewer, denser notes over many thin notes.",
      "- Merge overlap instead of creating duplicates.",
      "- Delete or compress vague residue that lacks future retrieval value.",
      "",
      "Index constraints (MEMORY.md):",
      "- MEMORY.md is an index, not a journal.",
      "- Keep each index entry one line: `- [Title](memory/topics/file.md) — one-line hook`",
      "- Hard cap: 200 lines and 25,000 bytes. Keep entries short.",
      "",
      "Content policy:",
      "- Prefer durable facts, decisions, and standing preferences/constraints.",
      "- Avoid copying transient chat; instead extract the stable residue.",
      "- A durable memory should answer at least one of: what changed, what matters, what constraint persists, what should be reused later.",
      "- Drop notes that only restate conversation flow without adding future leverage.",
      "",
      "Topic file shape:",
      "- Begin with a short `## Summary` section.",
      "- Add compact sections only when they earn their keep: `## Why It Matters`, `## Reusable Pattern`, `## Constraints`, `## Open Direction`.",
      "- Use concrete language. Prefer examples or mechanisms over abstractions when possible.",
      "",
      "JSON schema:",
      "{",
      '  "edits": [',
      '    {"path":"MEMORY.md","content":"<full new file text>"},',
      '    {"path":"memory/topics/<topic>.md","content":"<full new file text>"}',
      "  ],",
      '  "summary": "<1-3 sentences describing what changed and why>"',
      "}",
    ].join("\n");

    const user = [
      `NOW=${now}`,
      extra ? `\nUSER NOTE:\n${sanitizeForMemory(extra)}` : "",
      "",
      "CURRENT MEMORY FILES:",
      ...sources
        .filter((s) => s && s.path)
        .map((s) => [`--- ${s.path} ---`, truncateText(String(s.content || ""), 12000)].join("\n")),
    ].join("\n");

    try {
      const out = await generateText({
        systemPrompt: sys,
        messages: [{ role: "user", text: user }],
        timeoutMs: defaultTimeoutMs,
        temperature: 0.2,
        maxTokens: Number(env("DIZZY_MEMORY_REVIEW_MAX_TOKENS", env("OPENAI_COMPAT_MAX_TOKENS", "1200"))) || 1200,
      });

      const json = safeJsonParse(String(out || "").trim());
      const edits = Array.isArray(json?.edits) ? json.edits : [];
      const summary = String(json?.summary ?? "").trim();
      if (!edits.length) return { kind: "reply", text: enforceOptionalityQuestion("Memory review: model returned no edits.") };

      const cleanedEdits = [];
      for (const e of edits) {
        const p = String(e?.path ?? "").trim();
        const content = String(e?.content ?? "");
        if (!isAllowedSelfModPath(p)) continue;
        if (!content.trim()) continue;
        if (content.length > 250_000) continue;
        cleanedEdits.push({ path: p, content });
      }
      if (!cleanedEdits.length) return { kind: "reply", text: enforceOptionalityQuestion("Memory review: no allowed edits produced.") };

      const id = makeImproveId();
      const dir = improvementDir();
      ensureDir(dir);
      const payload = { id, created_at: now, kind: "memory_review", convoKey, summary, edits: cleanedEdits };
      const savePath = path.resolve(dir, `${id}.json`);
      fs.writeFileSync(savePath, JSON.stringify(payload, null, 2), "utf8");

      const rel = path.relative(process.cwd(), savePath).replace(/\\/g, "/");
      const msgTxt = summary ? `Proposed memory updates: ${summary}` : "Proposed memory updates saved.";
      return {
        kind: "reply",
        text: enforceOptionalityQuestion(
          `${msgTxt}\n\nSaved: ${rel}\n\nTo apply: /apply ${id} CONFIRM\nThen validate: node scripts/memory_validate.mjs`,
        ),
      };
    } catch (e) {
      const msgTxt = String(e?.message ?? e);
      const body = e?.body ? `\n${String(e.body).slice(0, 1200)}` : "";
      return { kind: "reply", text: enforceOptionalityQuestion(`Memory review failed: ${msgTxt}${body}`) };
    }
  }

  if (text === "/remember" || text.toLowerCase().startsWith("/remember ")) {
    const cfgErr = missingConfigReply();
    if (cfgErr) return cfgErr;
    const extra = text.length > "/remember".length ? text.slice("/remember".length).trim() : "";
    const rememberMaxTurns = Math.max(6, Number(env("DIZZY_REMEMBER_MAX_TURNS", "60")) || 60);
    const history = readLastJsonl(convoPath, 2000);
    const transcript = renderTranscriptForSummary(history, rememberMaxTurns);
    if (!transcript.trim()) return { kind: "reply", text: enforceOptionalityQuestion("No conversation history found yet.") };

    const now = new Date();
    const iso = now.toISOString();
    const ymd = formatLocalDateYYYYMMDD(now);

    const memoryDir = path.resolve(process.cwd(), "memory");
    const convoMemoryDir = path.resolve(memoryDir, "conversations");
    const convoMemoryPath = path.resolve(convoMemoryDir, `${convoKey}.md`);
    const dailyPath = path.resolve(memoryDir, `${ymd}.md`);

    const rememberSystem = [
      "You are writing durable memory for a private personal assistant.",
      "Convert the transcript into compact durable memory for later retrieval and continuity.",
      "Hard rules:",
      "- Do NOT include API keys, tokens, passwords, or secrets (if seen, replace with [REDACTED]).",
      "- Do NOT quote long verbatim blocks; paraphrase.",
      "- Do NOT add a trailing question.",
      "- Do NOT write a generic recap of the conversation.",
      "- Prefer fewer bullets with higher information density.",
      "- Capture only information likely to matter later: decisions, shifts, constraints, reusable patterns, unresolved questions.",
      "- If nothing durable happened in a section, write `- none`.",
      "- Every important item should be concrete enough that future retrieval can act on it.",
      "- Include why something matters when that is not obvious from the fact itself.",
      "Output format (exact headings):",
      "## Summary",
      "## Decisions",
      "## Open Loops",
      "## Preferences & Constraints",
      "## Next Actions",
    ].join("\n");

    const transcriptBlock = `TRANSCRIPT (most recent turns; sanitized):\n${transcript}`;
    const noteBlock = extra ? `\n\nUSER NOTE:\n${sanitizeForMemory(extra)}` : "";
    const priorMemory = readTextFileIfExists(convoMemoryPath);
    const priorBlock = priorMemory
      ? `\n\nEXISTING MEMORY PREVIEW:\n${compactMemoryPreview(sanitizeForMemory(priorMemory), 14)}`
      : "";

    try {
      const mem = await generateText({
        systemPrompt: rememberSystem,
        messages: [{
          role: "user",
          text: [
            transcriptBlock,
            noteBlock,
            priorBlock,
            "",
            "Compression rule:",
            "- avoid repeating what is already captured in existing memory unless it materially changed",
            "- prefer delta over duplicate summary",
          ].join("\n"),
        }],
        timeoutMs: defaultTimeoutMs,
        temperature: 0.2,
        maxTokens: Number(env("DIZZY_REMEMBER_MAX_TOKENS", env("OPENAI_COMPAT_MAX_TOKENS", "700"))) || 700,
      });

      const cleaned = sanitizeForMemory(mem).trim();
      const header = `# Memory — ${convoKey}\n\n- remembered_at: ${iso}\n- source: ${msg?.channel ?? "unknown"}\n`;
      const convoDoc = `${header}\n${cleaned}\n`;
      ensureDir(convoMemoryDir);
      fs.writeFileSync(convoMemoryPath, convoDoc, "utf8");

      if (!fs.existsSync(dailyPath)) {
        ensureDir(path.dirname(dailyPath));
        fs.writeFileSync(
          dailyPath,
          `# Daily Log — ${ymd}\n\n## Remembered (${convoKey}) — ${iso}\n${cleaned}\n`,
          "utf8",
        );
      } else {
        appendSection(dailyPath, `## Remembered (${convoKey}) — ${iso}\n${cleaned}`);
      }

      const relA = path.relative(process.cwd(), convoMemoryPath).replace(/\\/g, "/");
      const relB = path.relative(process.cwd(), dailyPath).replace(/\\/g, "/");
      return { kind: "reply", text: enforceOptionalityQuestion(`Saved memory:\n- ${relA}\n- ${relB}`) };
    } catch (e) {
      const msgTxt = String(e?.message ?? e);
      const body = e?.body ? `\n${String(e.body).slice(0, 1200)}` : "";
      return { kind: "reply", text: enforceOptionalityQuestion(`Remember failed: ${msgTxt}${body}`) };
    }
  }

  if (!backend) return null;

  const cfgErr = missingConfigReply();
  if (cfgErr) return cfgErr;

  // Normal chat.
  const history = readLastJsonl(convoPath, 500)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .slice(-maxTurns * 2);

  const trustZone = getTrustZone(msg);
  const ephemeralHistory = trustZoneUsesEphemeralChatHistory(msg, trustZone);
  const nowIso = new Date().toISOString();
  if (!ephemeralHistory) {
    appendJsonl(convoPath, { t: nowIso, role: "user", text });
  }
  const workingHistory = ephemeralHistory
    ? [...history, { role: "user", text }]
    : readLastJsonl(convoPath, 500)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
      .slice(-maxTurns * 2);

  const retrievalAllowed = trustZoneAllowsRepoRetrieval(trustZone);
  const rag = retrievalAllowed ? getRelevantMarkdownSnippets(text, { k: parseIntEnv("DIZZY_RAG_TOP_K", 4) }) : [];
  const ragBlock = rag.length
    ? [
      "",
      "=== RELEVANT NOTES (auto-selected per message; may be incomplete) ===",
      ...rag.map((r) => [`--- ${r.path} (score=${r.score.toFixed(2)}) ---`, r.excerpt].join("\n")),
      "=== END RELEVANT NOTES ===",
    ].join("\n")
    : "";
  const graphCtx = retrievalAllowed
    ? getRelevantMemoryGraphContext(text, { k: parseIntEnv("DIZZY_MEMORY_GRAPH_TOP_K", 3) })
    : { docs: [], entities: [], query_signals: null };
  const graphBlock = graphCtx.docs.length
    ? [
      "",
      "=== MEMORY GRAPH CONTEXT (derived from local markdown; use as support, not authority) ===",
      ...graphCtx.docs.map((d) => [
        `--- ${d.path} [${d.kind}] score=${d.score} ---`,
        Array.isArray(d.reasons) && d.reasons.length ? `reasons=${d.reasons.join(", ")}` : "",
        d.signals ? `signals=autonomy:${d.signals.autonomy || 0}, structural:${d.signals.structural || 0}, meaning:${d.signals.meaning || 0}, decisions:${d.signals.decisions || 0}` : "",
        d.headings.length ? `headings=${d.headings.map((h) => h.text).join(" | ")}` : "",
        d.entities.length ? `entities=${d.entities.map((e) => e.name).join(", ")}` : "",
        d.keywords.length ? `keywords=${d.keywords.map((k) => `${k.token}:${k.count}`).join(", ")}` : "",
        d.excerpt,
      ].filter(Boolean).join("\n")),
      graphCtx.query_signals ? `query_signals=autonomy:${graphCtx.query_signals.autonomy || 0}, structural:${graphCtx.query_signals.structural || 0}, meaning:${graphCtx.query_signals.meaning || 0}, decisions:${graphCtx.query_signals.decisions || 0}` : "",
      graphCtx.entities.length ? `top_entities=${graphCtx.entities.map((e) => `${e.name}:${e.mentions}`).join(", ")}` : "",
      "=== END MEMORY GRAPH CONTEXT ===",
    ].filter(Boolean).join("\n")
    : "";
  const trustZoneBlock = [
    "",
    "=== RUNTIME TRUST ZONE ===",
    `trust_zone=${trustZone}`,
    `continuity_mode=${getContinuityMode(msg)}`,
    `repo_retrieval_allowed=${retrievalAllowed ? "1" : "0"}`,
    `durable_memory_allowed=${trustZoneAllowsDurableMemory(trustZone) ? "1" : "0"}`,
    retrievalAllowed
      ? "Use continuity selectively. Retrieve only what improves present judgment."
      : "Do not assume hidden continuity. Reason from the current request unless context was explicitly supplied in this conversation.",
    "=== END RUNTIME TRUST ZONE ===",
  ].join("\n");
  const systemPrompt = `${baseSystemPrompt}${trustZoneBlock}${ragBlock}${graphBlock}`;

  if (backend === "gemini") {
    try {
      const reply = await generateText({
        systemPrompt,
        messages: workingHistory.map((m) => ({ role: m.role, text: m.text })),
      });

      const finalText = enforceOptionalityQuestion(reply);
      if (!ephemeralHistory) {
        appendJsonl(convoPath, { t: new Date().toISOString(), role: "assistant", text: finalText, backend: "gemini" });
      }
      try {
        await maybeHandleAutoRemember({
          generateText,
          defaultTimeoutMs,
          convoKey,
          msg,
          history: [...workingHistory, { role: "assistant", text: finalText }],
        });
      } catch {
        // Best-effort only; never fail the user reply because auto-memory missed.
      }
      return { kind: "reply", text: finalText };
    } catch (e) {
      const fallbackBackend = String(env("DIZZY_CHAT_FALLBACK_BACKEND", "")).trim().toLowerCase();
      const canFallback = fallbackBackend === "openai_compat" && shouldFallbackFromGeminiError(e);

      if (canFallback) {
        const maxPerHour = Number(env("DIZZY_FALLBACK_MAX_CALLS_PER_HOUR", "0")) || 0;
        if (maxPerHour > 0) {
          const used = countRecentFallbackUses(convoKey, 60 * 60 * 1000);
          if (used >= maxPerHour) {
            return {
              kind: "reply",
              text: enforceOptionalityQuestion(
                `Gemini failed and fallback is paused (limit reached: ${used}/${maxPerHour} per hour). Try again later or raise DIZZY_FALLBACK_MAX_CALLS_PER_HOUR.`,
              ),
            };
          }
        }

        try {
          const baseUrl = compatBaseUrl;
          const apiKey = compatApiKey;
          const model = compatModel;
          const temperature = Number(env("OPENAI_COMPAT_TEMPERATURE", env("DIZZY_CHAT_TEMPERATURE", "0.7"))) || 0.7;
          const timeoutMs = Math.max(5000, Number(env("OPENAI_COMPAT_TIMEOUT_MS", env("DIZZY_CHAT_TIMEOUT_MS", "20000"))) || 20000);
          const maxTokens = Math.max(64, Number(env("OPENAI_COMPAT_MAX_TOKENS", env("DIZZY_FALLBACK_MAX_TOKENS", "500"))) || 500);

          const fallbackUseRag = String(env("DIZZY_FALLBACK_USE_RAG", "0")).trim() === "1";
          const fallbackPromptMax = Math.max(800, Number(env("DIZZY_FALLBACK_SYSTEM_PROMPT_MAX_CHARS", "3500")) || 3500);
          const fallbackSystemPrompt = truncateText(fallbackUseRag ? systemPrompt : baseSystemPrompt, fallbackPromptMax);
          const fallbackHistory = clampHistoryForFallback(history);

          const reply = await openaiCompatGenerateText({
            baseUrl,
            apiKey,
            model,
            systemPrompt: fallbackSystemPrompt,
            messages: ephemeralHistory ? clampHistoryForFallback(workingHistory) : fallbackHistory,
            timeoutMs,
            temperature,
            maxTokens,
          });

          const finalText = enforceOptionalityQuestion(reply);
          recordFallbackUse(convoKey);
          if (!ephemeralHistory) {
            appendJsonl(convoPath, { t: new Date().toISOString(), role: "assistant", text: finalText, backend: "openai_compat" });
          }
          return { kind: "reply", text: finalText };
        } catch (fallbackErr) {
          const msgTxt = String(fallbackErr?.message ?? fallbackErr);
          const body = fallbackErr?.body ? `\n${String(fallbackErr.body).slice(0, 1200)}` : "";
          return { kind: "reply", text: enforceOptionalityQuestion(`Gemini failed; fallback failed: ${msgTxt}${body}`) };
        }
      }

      const msgTxt = String(e?.message ?? e);
      const body = e?.body ? `\n${String(e.body).slice(0, 1200)}` : "";
      const model = e?.model ? `\nmodel=${String(e.model)}` : "";
      return { kind: "reply", text: enforceOptionalityQuestion(`Gemini chat error: ${msgTxt}${model}${body}`) };
    }
  }

  if (backend === "openai_compat" || backend === "openrouter") {
    try {
      const reply = await generateText({
        systemPrompt,
        messages: workingHistory.map((m) => ({ role: m.role, text: m.text })),
        maxTokens: Number(env("OPENAI_COMPAT_MAX_TOKENS", "500")) || 500,
      });

      const finalText = enforceOptionalityQuestion(reply);
      if (!ephemeralHistory) {
        appendJsonl(convoPath, { t: new Date().toISOString(), role: "assistant", text: finalText, backend: "openai_compat" });
      }
      try {
        await maybeHandleAutoRemember({
          generateText,
          defaultTimeoutMs,
          convoKey,
          msg,
          history: [...workingHistory, { role: "assistant", text: finalText }],
        });
      } catch {
        // Best-effort only; never fail the user reply because auto-memory missed.
      }
      return { kind: "reply", text: finalText };
    } catch (e) {
      const msgTxt = String(e?.message ?? e);
      const body = e?.body ? `\n${String(e.body).slice(0, 1200)}` : "";
      return { kind: "reply", text: enforceOptionalityQuestion(`OpenAI-compat chat error: ${msgTxt}${body}`) };
    }
  }

  return { kind: "reply", text: enforceOptionalityQuestion(`Unknown chat backend '${backend}'.`) };
}

export function routeIncomingMessage(msg) {
  const text = String(msg?.text || "").trim();
  // Notification shaping is transport hygiene only.
  // The assistant's actual prose is handled elsewhere and should stay expressive.
  const notify = {
    channel: normalizeIdentifier(msg?.channel ?? "local", "local"),
    from: msg?.from == null ? null : normalizeIdentifier(msg?.from, "anon"),
    meta: msg?.meta && typeof msg.meta === "object" && !Array.isArray(msg.meta) ? msg.meta : {},
  };

  // Explicit tool invocation only. Avoid surprise network calls.
  // Examples:
  //   tool:http_get https://example.com
  //   tool:cheerio_extract https://example.com h1
  if (text.toLowerCase().startsWith("tool:")) {
    const parts = text.split(/\s+/);
    const first = parts.shift();
    const tool = first.slice("tool:".length).trim();
    const url = parts.shift();
    const selector = parts.join(" ");

    if (!tool) return { kind: "reply", text: "Missing tool name. Try: tool:http_get <url>" };
    if (!url) return { kind: "reply", text: "Missing URL. Try: tool:http_get <url>" };

    if (tool === "http_get") {
      return { kind: "enqueue", tool: "http_get", payload: { url }, effect: "READ", notify };
    }

    if (tool === "cheerio_extract") {
      return { kind: "enqueue", tool: "cheerio_extract", payload: { url, selector: selector || "body" }, effect: "READ", notify };
    }

    return { kind: "reply", text: `Unknown tool '${tool}'.` };
  }

  // Degraded mode should orient the operator, not just acknowledge receipt.
  return { kind: "reply", text: buildDegradedModeReply(msg) };
}

export async function handleIncomingMessage({ message, enqueue }) {
  // Optional chat backend (explicitly enabled via env) for plain-text messages.
  if (!String(message?.text ?? "").trim().toLowerCase().startsWith("tool:")) {
    const chatOut = await maybeChat(message);
    if (chatOut) return chatOut;
  }

  const routed = routeIncomingMessage(message);

  if (routed.kind === "enqueue") {
    const mode = String(env("DIZZY_TOOL_MODE", "auto")).trim().toLowerCase(); // queue | inline | auto

    if (mode === "inline") {
      try {
        const result = await runToolJob({ id: "inline", type: "tool", tool: routed.tool, payload: routed.payload });
        return { kind: "reply", text: summarizeToolResult(routed.tool, result) };
      } catch (e) {
        return { kind: "reply", text: summarizeToolError(routed.tool, e) };
      }
    }

    try {
      const id = await enqueue({ tool: routed.tool, payload: routed.payload, effect: routed.effect, notify: routed.notify });
      return { kind: "ack", job_id: id, text: enforceOptionalityQuestion(`Queued ${routed.tool}. Job: ${id}`) };
    } catch (e) {
      const msgTxt = String(e?.message ?? e);
      const canFallback = mode === "auto" && /redis not ready/i.test(msgTxt);
      if (!canFallback) return { kind: "reply", text: summarizeToolError(routed.tool, e) };
      try {
        const result = await runToolJob({ id: "inline", type: "tool", tool: routed.tool, payload: routed.payload });
        return { kind: "reply", text: summarizeToolResult(routed.tool, result) };
      } catch (err) {
        return { kind: "reply", text: summarizeToolError(routed.tool, err) };
      }
    }
  }

  return { kind: "reply", text: routed.text };
}
