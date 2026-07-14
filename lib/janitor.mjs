/**
 * Quarantined Janitor for untrusted inputs.
 * Neutralizes potential indirect prompt instruction-override attempts
 * and formats untrusted content inside a strict logical envelope.
 */

const NEUTRALIZED_MARKER = "[NEUTRALIZED_INSTRUCTION_TRIGGER]";
const BASE64_CANDIDATE_LIMIT = 64;
const BASE64_TOTAL_CHAR_LIMIT = 65536;

// These patterns are evaluated against normalized detection candidates. Whitespace
// and zero-width characters are removed before matching so letter-spaced payloads
// cannot hide instruction triggers.
const INJECTION_PATTERNS = [
  /(ignore|disregard|forget)\s*.+?\s*(instructions|directives|rules|commands|prompt|context)/i,
  /(ignore|disregard|forget)\s*(everything|all)\s*(above|below|before|after)/i,
  /(new|updated|revised|following)\s*(instructions|directives|rules|commands)/i,
  /(you\s*(must|should|will))?\s*now\s*(act|behave)\s*as\s*(a|an)/i,
  /you\s*are\s*now\s*(a|an)/i,
  /(override|bypass|disable|modify|change)\s*(the)?\s*(system|security|safety|sandboxing|rules|instructions|filters)/i,
  /(system\s*command|system\s*prompt|role\s*override|developer\s*mode|god\s*mode)/i,
  /^(stop|halt|end|cease|terminate)\s*\..*you\s*are\s*now/i,
  /translate\s*the\s*following\s*text.*ignore.*(instructions|rules)/i,
  /^(sure,?\s*here\s*are\s*the\s*new\s*instructions|absolutely,?\s*the\s*new\s*instructions\s*are)/i,
  /what\s*is\s*your\s*prompt.*what\s*are\s*your\s*instructions/i,
  /^\s*{\s*"?\s*command\s*"?\s*:\s*"?\s*ignore_previous\s*"?\s*[,}]/i,
  /<\s*<\s*SYS\s*>\s*>/i,
];

function decodeEntityCodePoint(rawValue, radix) {
  const codePoint = Number.parseInt(rawValue, radix);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) return null;
  return String.fromCodePoint(codePoint);
}

function decodeHtmlEntities(text) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: "\"",
  };
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => decodeEntityCodePoint(hex, 16) ?? match)
    .replace(/&#(\d+);/g, (match, dec) => decodeEntityCodePoint(dec, 10) ?? match)
    .replace(/&(amp|apos|gt|lt|quot);/gi, (match, name) => named[String(name).toLowerCase()] ?? match);
}

function decodeBase64Candidate(token) {
  const raw = String(token ?? "").trim();
  const body = raw.replace(/=+$/, "");
  if (body.length < 12 || body.length > 8192 || body.length % 4 === 1 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(raw)) return null;

  try {
    const normalizedBody = body.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${normalizedBody}${"=".repeat((4 - (normalizedBody.length % 4)) % 4)}`;
    const bytes = Buffer.from(padded, "base64");
    if (!bytes.length) return null;
    if (bytes.toString("base64").replace(/=+$/, "") !== normalizedBody) return null;

    const decoded = bytes.toString("utf8");
    if (/^[\x09\x0A\x0D\x20-\x7E]+$/.test(decoded) && /[A-Za-z]{3}/.test(decoded)) return decoded;
  } catch (e) {
    return null;
  }
  return null;
}

function buildDetectionCandidates(text) {
  const decodedHtml = decodeHtmlEntities(String(text).normalize("NFKC"));
  const candidates = [decodedHtml];
  let base64BudgetExceeded = false;
  let base64CandidateCount = 0;
  let base64TotalChars = 0;
  const wholeDecoded = decodeBase64Candidate(decodedHtml);
  if (wholeDecoded) candidates.push(wholeDecoded);

  for (const match of decodedHtml.matchAll(/[A-Za-z0-9+/_-]{12,}={0,2}/g)) {
    const token = match[0];
    base64CandidateCount += 1;
    base64TotalChars += token.length;
    if (base64CandidateCount > BASE64_CANDIDATE_LIMIT || base64TotalChars > BASE64_TOTAL_CHAR_LIMIT) {
      base64BudgetExceeded = true;
      break;
    }

    const decoded = decodeBase64Candidate(token);
    if (decoded) candidates.push(decoded);
  }

  return {
    candidates: [...new Set(candidates)]
      .map((candidate) => normalizeForDetection(candidate).replace(/<[^>]*>/g, ""))
      .filter(Boolean),
    base64BudgetExceeded,
  };
}

function normalizeForDetection(text) {
  return String(text)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Sanitizes untrusted text by neutralizing injection indicators, escaping XML tags,
 * and wrapping it in a logical envelope.
 *
 * @param {string} rawText
 * @returns {{ sanitized: string, flagged: boolean }}
 */
export function sanitizeUntrustedInput(rawText) {
  const text = String(rawText ?? "");
  let sanitizedText = text;
  let flagged = false;

  const detection = buildDetectionCandidates(sanitizedText);

  // 1. Escape XML/HTML tags and delimiters to prevent boundary breaking
  let escapedText = sanitizedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/===/g, "&#61;&#61;&#61;");

  // 2. Escape brackets on all inputs to defang any manually-added neutralization markers
  //    intended to bypass security. This makes the sanitization more idempotent.
  escapedText = escapedText.replace(/\[/g, "&#91;").replace(/\]/g, "&#93;");

  // 3. Flag instruction-like content without replaying the hostile text.
  flagged = detection.base64BudgetExceeded
    || detection.candidates.some((candidate) => INJECTION_PATTERNS.some((pattern) => pattern.test(candidate)));
  if (flagged) escapedText = NEUTRALIZED_MARKER;

  // 4. Build logical untrusted-context envelope
  const envelope = [
    `<untrusted_content_envelope flagged="${flagged}" original_length="${text.length}">`,
    escapedText,
    `</untrusted_content_envelope>`
  ].join("\n");

  return {
    sanitized: envelope,
    flagged,
  };
}

export function renderRetrievedExcerpt(rawText, { redaction = "[REDACTED_PROMPT_INJECTION]" } = {}) {
  const result = sanitizeUntrustedInput(rawText);
  return result.flagged ? redaction : result.sanitized;
}
