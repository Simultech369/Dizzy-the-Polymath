const DEEP_RE = /\b(total|sum|count|how many|timeline|history|all|compare|recommend|recommendation|budget|cost|duration|when did|how long|over time)\b/i;
const REQUIRED_DATA_RE = /\b(exact|specific|source|evidence|quote|date|number|amount|who|which|where|when|how long|total)\b/i;
const STALE_RE = /\b(old|older|previous|past|history|timeline|revisit|stale|last time|before|months?|years?|over time)\b/i;
const EDGE_RE = /\b(connection|surprising|hypothesis|pattern|maybe|possible|speculative|adjacent|analogy|link|synthesis|edge)\b/i;

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
  const allowed = Boolean(retrievalAllowed);
  const pools = [
    {
      id: "core",
      status: allowed ? "candidate" : "blocked_by_trust_zone",
      purpose: "fresh trusted context likely to answer the request directly",
      threshold_hint: mode === "deep" ? "medium_relevance" : "strict_relevance",
      reason: allowed
        ? "default pool for trusted markdown, memory graph, and known-good trajectories"
        : "retrieval is not allowed in this trust zone",
    },
    {
      id: "stale_important",
      status: allowed && (STALE_RE.test(text) || mode === "deep") ? "candidate" : "not_suggested",
      purpose: "older but important context that may need freshness checks before use",
      threshold_hint: "high_importance_with_freshness_warning",
      reason: allowed && (STALE_RE.test(text) || mode === "deep")
        ? "query asks across time or broad history; stale material may matter but needs explicit freshness labeling"
        : "query does not appear to require older context",
    },
    {
      id: "edge_hypothesis",
      status: allowed && EDGE_RE.test(text) ? "candidate" : "not_suggested",
      purpose: "weak or adjacent connections that can inspire hypotheses but not answer as authority",
      threshold_hint: "low_confidence_report_only",
      reason: allowed && EDGE_RE.test(text)
        ? "query asks for patterns, synthesis, or adjacent connections"
        : "query does not ask for speculative connection finding",
    },
  ];

  return {
    mode,
    retrieval_allowed: allowed,
    trust_zone: trustZone,
    threshold_hint: mode === "deep" ? "wide_recall_report_only" : "strict_relevance_report_only",
    keywords,
    pools,
    pool_policy: {
      status: "report_only",
      auto_promote: false,
      auto_write_memory: false,
      note: "Pool labels guide operator/model attention; they do not change retrieval authority yet.",
    },
    required_data_fallback: {
      status: allowed && requiredDataLikely ? "available_report_only" : "not_requested",
      auto_second_pass: false,
      reason: allowed && requiredDataLikely
        ? "question appears evidence-specific; operator/model may request targeted second pass"
        : "no evidence-specific second pass suggested",
    },
  };
}
