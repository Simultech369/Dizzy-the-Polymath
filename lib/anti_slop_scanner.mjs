/**
 * lib/anti_slop_scanner.mjs
 * -------------------------
 * Rule-based scanner to detect prose slop (AI buzzwords, sycophancy, copula-dodging).
 */

export const BANNED_PROSE_TELLS = [
  "pivotal",
  "watershed",
  "game-changing",
  "groundbreaking",
  "delve",
  "testament",
  "seamless",
  "cutting-edge",
  "robust",
  "vibrant",
  "tapestry",
  "beacon",
  "unwavering",
  "ever-evolving",
  "nestled",
  "beacon of",
  "testament to",
  "serves as",
  "boasts a",
  "features a",
];

export const BANNED_AFFIRMATION_FILLER = [
  "great question",
  "good question",
  "love this",
  "in conclusion",
  "the future looks bright",
  "it is important to note",
  "it's important to remember",
  "in summary",
  "as an ai",
  "as a language model",
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isFenceLine(line) {
  return /^\s*(```|~~~)/.test(line);
}

function hasExampleCue(line) {
  return /\b(allowlist|avoid|banned|catalog|definition|detect|doc|docs|documentation|example|filler|generic affirmation|generic praise|not say|overlay|phrase|prompt pack|quoted|rule|scanner|schema|slop|spec|tell|trigger|warning)\b/i.test(line);
}

function isCatalogLine(line) {
  return /^\s*(\||[-*+]\s+|\d+\.\s+)/.test(line);
}

function containsInlineExample(line, term) {
  const escaped = escapeRegExp(term);
  const quoted = new RegExp(`(["'\`])[^"'\`]*\\b${escaped}\\b[^"'\`]*\\1`, "i");
  const backticked = new RegExp(`\`[^\`]*\\b${escaped}\\b[^\`]*\``, "i");
  const markdownTableOrList = /^\s*(\||[-*]\s+)/.test(line);
  return quoted.test(line) || backticked.test(line) || (markdownTableOrList && hasExampleCue(line));
}

function shouldIgnoreLineForTerm(line, term, options, context = {}) {
  if (options.ignoreExamples === false) return false;
  if (context.inExampleList && isCatalogLine(line)) return true;
  return hasExampleCue(line) && containsInlineExample(line, term);
}

function finding({ type, match, line, context }) {
  return {
    rule_id: `w0062.prose.${type}`,
    category: "prose",
    severity: "advisory",
    type,
    match,
    line,
    context,
  };
}

function overlapsAny(range, ranges) {
  return ranges.some((existing) => range.start < existing.end && range.end > existing.start);
}

/**
 * Scan text for prose slop.
 * @param {string} text
 * @param {object} options
 * @returns {{ score: number, findings: Array<{ type: string, match: string, line?: number }>, passed: boolean }}
 */
export function scanProseSlop(text, options = {}) {
  const maxAllowedFindings = options.maxAllowed ?? 0;
  const str = String(text || "");
  const lines = str.split("\n");
  const findings = [];
  let inFence = false;
  let inExampleList = false;
  let exampleListBlankLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    if (isFenceLine(lineText)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const trimmedLine = lineText.trim();
    if (!trimmedLine) {
      if (inExampleList && exampleListBlankLines < 1) {
        exampleListBlankLines += 1;
        continue;
      }
      inExampleList = false;
      exampleListBlankLines = 0;
      continue;
    }

    const startsExampleList = hasExampleCue(lineText) && /:\s*$/.test(trimmedLine);
    if (!isCatalogLine(lineText) && !startsExampleList && !hasExampleCue(lineText)) {
      inExampleList = false;
      exampleListBlankLines = 0;
    }
    if (startsExampleList) {
      inExampleList = true;
      exampleListBlankLines = 0;
      continue;
    }
    if (isCatalogLine(lineText)) exampleListBlankLines = 0;

    const lowerLine = lineText.toLowerCase();
    const lineMatchRanges = [];

    for (const term of [...BANNED_PROSE_TELLS].sort((a, b) => b.length - a.length)) {
      const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      const match = regex.exec(lowerLine);
      if (match) {
        if (shouldIgnoreLineForTerm(lineText, term, options, { inExampleList })) continue;
        const range = { start: match.index, end: match.index + match[0].length };
        if (overlapsAny(range, lineMatchRanges)) continue;
        lineMatchRanges.push(range);
        findings.push(finding({
          type: "banned_prose_tell",
          match: term,
          line: i + 1,
          context: lineText.trim()
        }));
      }
    }

    for (const phrase of BANNED_AFFIRMATION_FILLER) {
      if (lowerLine.includes(phrase)) {
        if (shouldIgnoreLineForTerm(lineText, phrase, options, { inExampleList })) continue;
        findings.push(finding({
          type: "affirmation_filler",
          match: phrase,
          line: i + 1,
          context: lineText.trim()
        }));
      }
    }
  }

  const passed = findings.length <= maxAllowedFindings;
  const score = Math.max(0, 100 - findings.length * 15);

  return {
    score,
    findings,
    passed
  };
}
