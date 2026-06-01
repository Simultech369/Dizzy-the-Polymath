const SOCIAL_CLOSERS = new Set([
  "ok",
  "okay",
  "k",
  "kk",
  "thanks",
  "thank you",
  "thx",
  "ty",
  "got it",
  "done",
  "yes",
  "no",
  "yep",
  "nope",
  "sure",
  "cool",
  "nice",
  "great",
  "sounds good",
  "all good",
]);

const DURABLE_SIGNAL_RE = /\b(decide|decision|decided|constraint|preference|important|remember|revisit|next step|plan|changed|shift|policy|rule|success|partial|failure|outcome|pattern|worked|fix|risk|boundary|consent|trust zone|memory|trajectory|maintenance|governance|implementation)\b/i;

function normalizeText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9_'-]+/g)
    .filter((x) => x.length > 0);
}

function textFromPayload(payload) {
  if (!payload || typeof payload !== "object") return "";
  const parts = [
    payload.goal,
    payload.constraints,
    payload.success_criteria,
    payload.outcome,
    payload.reusable_pattern,
    Array.isArray(payload.actions_taken) ? payload.actions_taken.join(" ") : payload.actions_taken,
    Array.isArray(payload.reuse_tags) ? payload.reuse_tags.join(" ") : payload.reuse_tags,
  ];
  return normalizeText(parts.filter(Boolean).join(" "));
}

function textFromHistory(history) {
  if (!Array.isArray(history)) return "";
  return normalizeText(history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .slice(-8)
    .map((m) => m.text)
    .join(" "));
}

export function isSocialCloserText(text) {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return false;
  if (SOCIAL_CLOSERS.has(normalized)) return true;
  if (/^[.!?👍👌✅🙏🙂😀😄❤️]+$/u.test(normalized)) return true;
  const words = tokenize(normalized);
  return words.length <= 3 && SOCIAL_CLOSERS.has(words.join(" "));
}

export function latestUserText(history) {
  if (!Array.isArray(history)) return "";
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];
    if (row?.role === "user" && typeof row.text === "string") return normalizeText(row.text);
  }
  return "";
}

export function assessCaptureEligibility({ kind = "memory", text = "", history = null, payload = null, minWords = 8 } = {}) {
  const body = normalizeText(text || textFromPayload(payload) || textFromHistory(history));
  const words = tokenize(body);
  const latestUser = latestUserText(history);

  if (!body) {
    return { eligible: false, reason: "empty_capture", kind, word_count: 0 };
  }
  if (latestUser && isSocialCloserText(latestUser)) {
    return { eligible: false, reason: "latest_user_social_closer", kind, word_count: words.length };
  }
  if (isSocialCloserText(body)) {
    return { eligible: false, reason: "social_closer", kind, word_count: words.length };
  }
  if (words.length < minWords && !DURABLE_SIGNAL_RE.test(body)) {
    return { eligible: false, reason: "low_substance", kind, word_count: words.length };
  }

  const hasDurableSignal = DURABLE_SIGNAL_RE.test(body);
  const score = Math.min(10, Math.max(1, Math.floor(words.length / 12) + (hasDurableSignal ? 3 : 0)));
  return { eligible: true, reason: "eligible", kind, word_count: words.length, durable_signal: hasDurableSignal, score };
}

export function assertCaptureEligible(input) {
  const assessment = assessCaptureEligibility(input);
  if (!assessment.eligible) {
    const err = new Error(`capture ineligible: ${assessment.reason}`);
    err.assessment = assessment;
    throw err;
  }
  return assessment;
}
