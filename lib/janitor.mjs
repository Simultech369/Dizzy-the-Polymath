/**
 * Quarantined Janitor for untrusted inputs.
 * Neutralizes potential indirect prompt instruction-override attempts
 * and formats untrusted content inside a strict logical envelope.
 */

// These patterns are designed to run on text after all whitespace has been removed,
// making them resilient to obfuscation techniques that use extra spacing.
// Correction: The patterns MUST handle optional whitespace to match originals.
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

function decodeHtmlEntities(text) {
  // A simple decoder for numeric HTML entities.
  return text.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(dec);
  });
}

function decodeBase64(text) {
  // Attempt to decode base64, but fall back gracefully if it fails.
  try {
    // A simple regex to quickly check for plausible base64.
    if (/^[A-Za-z0-9+/=]+$/.test(text)) {
      const decoded = Buffer.from(text, "base64").toString("utf8");
      // Only return the decoded text if it contains ASCII characters,
      // to avoid garbling binary data.
      if (/^[\x00-\x7F]*$/.test(decoded)) {
        return decoded;
      }
    }
  } catch (e) {
    // Not valid base64, fall through and return original text.
  }
  return text;
}

function normalizeWhitespace(text) {
  // Collapse all whitespace and remove it for robust pattern matching.
  return text.replace(/\s+/g, "");
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

  // Pre-process by decoding, normalizing, and stripping tags to expose underlying text.
  const decodedHtml = decodeHtmlEntities(sanitizedText);
  const decodedBase64 = decodeBase64(decodedHtml);
  const normalizedText = normalizeWhitespace(decodedBase64);
  const strippedText = normalizedText.replace(/<[^>]*>/g, "");

  // 1. Escape XML/HTML tags and delimiters to prevent boundary breaking
  let escapedText = sanitizedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/===/g, "&#61;&#61;&#61;");

  // 2. Escape brackets on all inputs to defang any manually-added neutralization markers
  //    intended to bypass security. This makes the sanitization more idempotent.
  escapedText = escapedText.replace(/\[/g, "&#91;").replace(/\]/g, "&#93;");

  // 3. Check for injection patterns and neutralize/flag them.
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(strippedText)) { // Check against the fully decoded and normalized text
      flagged = true;
      escapedText = escapedText.replace(pattern, (match) => `[NEUTRALIZED_INSTRUCTION_TRIGGER: "${match}"]`);
    }
  }

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
