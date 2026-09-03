/**
 * lib/visual_slop_scanner.mjs
 * ---------------------------
 * Rule-based scanner for visual surfaces that may leak private context or overstate evidence.
 */

const PRIVATE_CONTEXT_PATTERNS = [
  /C:\\Users\\/i,
  /\/Users\//i,
  /\.codex\b/i,
  /\.gemini\b/i,
  /runtime[\\/]secrets/i,
  /\.env\b/i,
  /\bsk-[A-Za-z0-9_-]{8,}/,
  /\bghp_[A-Za-z0-9_]{8,}/,
  /\bglpat-[A-Za-z0-9_-]{8,}/,
];

const STATUS_CLAIM_RE = /\b(verified[_ -]?passed|ready for production|production ready|staging ready|approved|certified|181\/181|37\/37|all tests passed)\b/i;
const DECORATIVE_EXCESS_RE = /\b(gradient orb|bokeh|blob background|glowing orb|decorative orb|floating orb)\b/i;

function arrayOf(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function collectStrings(value, out = []) {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

function hasEvidence(surface) {
  return (
    stringValue(surface.receiptHash).match(/^[a-f0-9]{64}$/i) ||
    arrayOf(surface.evidencePaths).length > 0 ||
    arrayOf(surface.receipts).length > 0 ||
    arrayOf(surface.sourceAttribution).length > 0
  );
}

function motionEnabled(surface) {
  if (surface.motion === true) return true;
  if (surface.animation === true || surface.animations === true) return true;
  if (arrayOf(surface.animations).length > 0) return true;
  return Boolean(surface.motion && typeof surface.motion === "object" && surface.motion.enabled === true);
}

function respectsReducedMotion(surface) {
  if (surface.respectsReducedMotion === true) return true;
  if (surface.reducedMotion === true) return true;
  return Boolean(surface.motion && typeof surface.motion === "object" && surface.motion.reducedMotion === true);
}

function imageSources(surface) {
  return [
    ...arrayOf(surface.imageSources),
    ...arrayOf(surface.images).map((image) => (typeof image === "string" ? image : image?.src)),
    ...arrayOf(surface.media).map((item) => (typeof item === "string" ? item : item?.src)),
  ].filter(Boolean).map(String);
}

function pushFinding(findings, ruleId, type, severity, context) {
  findings.push({
    rule_id: `w0062.visual.${ruleId}`,
    category: "visual",
    severity,
    type,
    context,
  });
}

/**
 * Scan a UI/visual-surface descriptor for deterministic visual slop.
 * @param {object|string} surface
 * @param {object} options
 * @returns {{ score: number, findings: Array<object>, passed: boolean }}
 */
export function scanVisualSurface(surface, options = {}) {
  const maxAllowedFindings = options.maxAllowed ?? 0;
  const target = typeof surface === "string" ? { visibleText: surface } : { ...(surface || {}) };
  const findings = [];
  const strings = collectStrings(target).map((item) => item.trim()).filter(Boolean);
  const combinedText = strings.join("\n");

  for (const pattern of PRIVATE_CONTEXT_PATTERNS) {
    const match = pattern.exec(combinedText);
    if (match) {
      pushFinding(findings, "private_context_exposure", "private_context_exposure", "high", match[0]);
      break;
    }
  }

  if (STATUS_CLAIM_RE.test(combinedText) && !hasEvidence(target)) {
    pushFinding(findings, "unsupported_status_claim", "unsupported_status_claim", "warning", "status claim lacks receipt or source attribution");
  }

  if (DECORATIVE_EXCESS_RE.test(combinedText) || arrayOf(target.visualEffects).some((effect) => DECORATIVE_EXCESS_RE.test(String(effect)))) {
    pushFinding(findings, "decorative_excess", "decorative_excess", "advisory", "decorative visual language should not dominate operational surfaces");
  }

  const externalMedia = imageSources(target).filter((src) => /^https?:\/\//i.test(src));
  if (externalMedia.length > 0 && !hasEvidence(target)) {
    pushFinding(findings, "unattributed_external_media", "unattributed_external_media", "warning", externalMedia[0]);
  }

  if (motionEnabled(target) && !respectsReducedMotion(target)) {
    pushFinding(findings, "motion_without_reduced_motion", "motion_without_reduced_motion", "warning", "animation lacks reduced-motion fallback");
  }

  if (Number.isFinite(target.contrastRatio) && target.contrastRatio < 4.5) {
    pushFinding(findings, "low_contrast", "low_contrast", "warning", `contrastRatio=${target.contrastRatio}`);
  }

  if (target.statusEncoding === "color-only" || target.statusEncoding === "color_only") {
    pushFinding(findings, "color_only_status", "color_only_status", "warning", "status cannot rely on color alone");
  }

  if (target.nestedCards === true || Number(target.cardDepth || 0) > 1) {
    pushFinding(findings, "nested_card_layout", "nested_card_layout", "advisory", "nested cards reduce scanability");
  }

  const passed = findings.length <= maxAllowedFindings;
  const score = Math.max(0, 100 - findings.reduce((total, finding) => {
    if (finding.severity === "high") return total + 30;
    if (finding.severity === "warning") return total + 18;
    return total + 10;
  }, 0));

  return { score, findings, passed };
}
