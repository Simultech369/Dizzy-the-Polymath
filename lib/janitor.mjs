/**
 * Quarantined Janitor for untrusted inputs.
 * Neutralizes potential indirect prompt instruction-override attempts
 * and formats untrusted content inside a strict logical envelope.
 */

const INJECTION_PATTERNS = [
  /\bignore\s+(?:all\s+)?(?:previous\s+)?instructions\b/i,
  /\bignore\s+(?:everything|all)\s+(?:above|below|before|after)\b/i,
  /\bnew\s+instructions\b/i,
  /\b(?:you\s+must\s+)?now\s+act\s+as\b/i,
  /\b(?:you\s+are\s+)?now\s+a\b/i,
  /\b(?:override|bypass)\s+(?:the\s+)?(?:system|rules|instructions)\b/i,
  /\b(?:system\s+command|system\s+prompt|role\s+override)\b/i,
];

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

  // 1. Check for injection patterns and neutralize/flag them
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      flagged = true;
      sanitizedText = sanitizedText.replace(pattern, (match) => `[NEUTRALIZED_INSTRUCTION_TRIGGER: "${match}"]`);
    }
  }

  // 2. Escape XML/HTML tags and delimiters to prevent boundary breaking
  const escapedText = sanitizedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/===/g, "&#61;&#61;&#61;");

  // 3. Build logical untrusted-context envelope
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
