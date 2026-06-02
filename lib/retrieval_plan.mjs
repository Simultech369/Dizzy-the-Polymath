const DEEP_RE = /\b(total|sum|count|how many|timeline|history|all|compare|recommend|recommendation|budget|cost|duration|when did|how long|over time)\b/i;
const REQUIRED_DATA_RE = /\b(exact|specific|source|evidence|quote|date|number|amount|who|which|where|when|how long|total)\b/i;

function keywordList(text) {
  return [...new Set(String(text || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_-]{2,}/g) || [])]
    .filter((token) => !["the", "and", "for", "with", "that", "this", "from", "what", "when", "where"].includes(token))
    .slice(0, 8);
}

export function buildRetrievalPlan(query, { trustZone = "outside_contact", retrievalAllowed = false } = {}) {
  const text = String(query || "").trim();
  const mode = DEEP_RE.test(text) ? "deep" : "standard";
  const keywords = keywordList(text);
  const requiredDataLikely = REQUIRED_DATA_RE.test(text);

  return {
    mode,
    retrieval_allowed: Boolean(retrievalAllowed),
    trust_zone: trustZone,
    threshold_hint: mode === "deep" ? "wide_recall_report_only" : "strict_relevance_report_only",
    keywords,
    required_data_fallback: {
      status: retrievalAllowed && requiredDataLikely ? "available_report_only" : "not_requested",
      auto_second_pass: false,
      reason: retrievalAllowed && requiredDataLikely
        ? "question appears evidence-specific; operator/model may request targeted second pass"
        : "no evidence-specific second pass suggested",
    },
  };
}
