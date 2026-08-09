import crypto from "crypto";
import { getAllDivisions } from "./model_router.mjs";

export const REVIEW_STATE_TRANSITIONS = [
  "reject",
  "quarantine",
  "split",
  "fixture-required",
  "ready-for-review",
  "ready-for-push",
];

export const RUNTIME_AUTONOMY_BOUNDARY = Object.freeze({
  meaning: "bounded_local_orchestration",
  allowed_actions: [
    "orchestration",
    "evidence_capture",
    "disagreement_mining",
    "test_execution",
  ],
  may_propose: REVIEW_STATE_TRANSITIONS,
  denied_authority: [
    "external_action",
    "public_action",
    "irreversible_action",
    "expensive_action",
    "shared_state_action",
    "model_vote_as_truth",
  ],
  authority: "automation_proposes_simul_approves",
});

const DOMAIN_KEYWORDS = [
  ["router", /model_router|openai_compat|dispatch\.mjs|dynamic_router|router/i],
  ["ingress", /agent_server|ingress_gateway|rate_limit|gateway|auth|csrf|jwt|oauth/i],
  ["replay", /sqlite_operational_store|queue|idempot|replay|lease|wal/i],
  ["lineage", /trajectory_snapshot|model_registry|lineage|manifest|receipt/i],
  ["dashboard", /dashboard|ui|frontend|html|css/i],
  ["governance", /identity|prompt|tools|agents|next|bootstrap|reviews|council|claim/i],
  ["tests", /scripts|test|fixture|harness|audit/i],
  ["security", /auth|token|secret|csrf|origin|proxy|redirect|isolation|trust/i],
];

const LENS_BY_ROLE = [
  [/adversarial|redteam|security|audit|critic/i, "hostile security and invariant pressure"],
  [/architect|systems|schema|context|repository/i, "architecture and contract coherence"],
  [/local|gemma|qwen|mistral|r1/i, "local/offline execution realism"],
  [/reason|logic|judge|critic/i, "reasoning and disagreement calibration"],
  [/code|synth|coder|devstral|python|git/i, "implementation and fixture adequacy"],
  [/visual|multimodal|ui/i, "operator comprehension and presentation truth"],
];

const HARNESS_DOMAIN_RULES = [
  ["test:model-router", ["router"]],
  ["test:router", ["router", "security"]],
  ["test:ingress-gateway", ["ingress", "security"]],
  ["test:replay-safety", ["replay"]],
  ["test:trajectory-snapshot", ["lineage"]],
  ["test:model-registry", ["lineage"]],
  ["test:risk-scaler", ["security", "governance"]],
  ["check:safety", ["security", "replay", "ingress", "governance"]],
  ["check:council", ["router", "ingress", "replay", "lineage", "governance"]],
  ["test", ["security", "tests"]],
  ["check:fuzzing", ["security"]],
  ["eval:retrieval-golden", ["lineage", "governance"]],
  ["eval:anti-slop-prose", ["governance"]],
  ["eval:anti-slop-visual", ["dashboard"]],
];

const REQUIRED_HARNESSES_BY_DOMAIN = {
  router: ["test:model-router", "test:router"],
  ingress: ["test:ingress-gateway"],
  replay: ["test:replay-safety"],
  lineage: ["test:trajectory-snapshot", "test:model-registry"],
  security: ["test:router", "check:fuzzing"],
  governance: ["check:council"],
};

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256Short(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex").slice(0, 12);
}

function normalizeList(value) {
  return (Array.isArray(value) ? value : String(value ?? "").split(/,|\n|;/g))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function getRoleLens(roleKey) {
  for (const [pattern, lens] of LENS_BY_ROLE) {
    if (pattern.test(roleKey)) return lens;
  }
  return "general adversarial code and claim review";
}

export function getReviewerRoster() {
  const divisions = getAllDivisions();
  const reviewers = [];
  for (const [divisionKey, division] of Object.entries(divisions)) {
    for (const [roleKey, role] of Object.entries(division.roles || {})) {
      reviewers.push({
        role_key: roleKey,
        division_key: divisionKey,
        division_name: division.name,
        primary_model: role.primary,
        fallbacks: Array.isArray(role.fallbacks) ? role.fallbacks : [],
        description: role.description || "",
        lens: getRoleLens(roleKey),
      });
    }
  }
  return reviewers.sort((a, b) => a.role_key.localeCompare(b.role_key));
}

export function inferReviewDomains(changedFiles = []) {
  const domains = new Set();
  for (const filePath of normalizeList(changedFiles)) {
    for (const [domain, pattern] of DOMAIN_KEYWORDS) {
      if (pattern.test(filePath)) domains.add(domain);
    }
  }
  if (domains.has("ingress")) domains.add("security");
  if (!domains.size) domains.add("governance");
  return [...domains].sort();
}

export function inferBlastRadius(changedFiles = [], domains = inferReviewDomains(changedFiles)) {
  const files = normalizeList(changedFiles);
  if (domains.some((domain) => ["ingress", "replay", "security"].includes(domain))) return "high";
  if (domains.includes("router") || domains.includes("lineage") || files.some((file) => file.startsWith("lib/"))) return "medium";
  return "low";
}

function reviewerDomainScore(reviewer, domains) {
  const haystack = [
    reviewer.role_key,
    reviewer.division_name,
    reviewer.primary_model,
    reviewer.description,
    reviewer.lens,
  ].join(" ").toLowerCase();
  let score = 0;
  for (const domain of domains) {
    if (domain === "security" && /security|redteam|adversarial|audit|critic/.test(haystack)) score += 4;
    if (domain === "router" && /code|router|schema|repository|systems|architect|qwen|coder/.test(haystack)) score += 3;
    if (domain === "ingress" && /systems|architect|security|schema|judge|critic/.test(haystack)) score += 3;
    if (domain === "replay" && /systems|logic|reason|schema|audit|critic/.test(haystack)) score += 3;
    if (domain === "lineage" && /context|schema|judge|architect|long|retrieval|gemini/.test(haystack)) score += 3;
    if (domain === "dashboard" && /visual|multimodal|judge|schema|critic/.test(haystack)) score += 3;
    if (domain === "governance" && /critic|judge|schema|context|systems|alignment/.test(haystack)) score += 2;
    if (domain === "tests" && /code|python|git|security|repository|audit/.test(haystack)) score += 2;
  }
  return score;
}

function reviewerHistoryScore(reviewer, history = {}) {
  const stats = history.reviewers?.[reviewer.role_key] || {};
  const runs = Math.max(0, Number(stats.runs || 0));
  const confirmed = Math.max(0, Number(stats.confirmed_findings || 0));
  const disagreements = Math.max(0, Number(stats.useful_disagreements || 0));
  const falsePositives = Math.max(0, Number(stats.false_positive_findings || 0));
  const confirmedRate = runs ? confirmed / runs : 0;
  const disagreementRate = runs ? disagreements / runs : 0;
  const falsePositiveRate = runs ? falsePositives / runs : 0;
  const novelty = runs === 0 ? 4 : Math.max(0, 2 - Math.log2(runs + 1) * 0.35);
  return novelty + confirmedRate * 4 + disagreementRate * 2 - falsePositiveRate * 2;
}

function harnessHistoryScore(harness, history = {}) {
  const stats = history.harnesses?.[harness.script] || {};
  const runs = Math.max(0, Number(stats.runs || 0));
  const passes = Math.max(0, Number(stats.passes || 0));
  const failures = Math.max(0, Number(stats.failures || 0));
  const passRate = runs ? passes / runs : 0;
  const failureRate = runs ? failures / runs : 0;
  const novelty = runs === 0 ? 3 : Math.max(0, 1.5 - Math.log2(runs + 1) * 0.25);
  return novelty + passRate - failureRate * 2;
}

function requiredRolesForDomains(domains) {
  const required = new Set();
  if (domains.includes("security") || domains.includes("ingress")) required.add("adversarial_critic");
  if (domains.includes("replay") || domains.includes("lineage")) required.add("schema_compliance_auditor");
  if (domains.includes("router")) required.add("program_synthesis_specialist");
  required.add("systems_architect");
  required.add("gemma3_local");
  return required;
}

export function discoverHarnesses(packageJson = {}) {
  const scripts = packageJson.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {};
  const harnesses = [];
  for (const [scriptName, command] of Object.entries(scripts)) {
    if (!/^(test|check|eval):|^test$/.test(scriptName)) continue;
    const rule = HARNESS_DOMAIN_RULES.find(([name]) => name === scriptName);
    harnesses.push({
      script: scriptName,
      command,
      domains: rule ? rule[1] : ["tests"],
      side_effect_class: scriptName === "check:council" || scriptName === "eval:retrieval-golden"
        ? "writes_receipts_context_only"
        : scriptName === "test" || scriptName === "check:safety"
          ? "mixed_disposable_fixtures"
          : "deterministic_local",
    });
  }
  return harnesses.sort((a, b) => a.script.localeCompare(b.script));
}

function selectHarnesses({ packageJson, domains, history = {}, maxHarnesses }) {
  const harnesses = discoverHarnesses(packageJson);
  const requiredHarnesses = new Set();
  for (const domain of domains) {
    for (const script of REQUIRED_HARNESSES_BY_DOMAIN[domain] || []) requiredHarnesses.add(script);
  }
  requiredHarnesses.add("test");
  requiredHarnesses.add("check:council");

  const scored = harnesses.map((harness) => {
    let score = harness.domains.filter((domain) => domains.includes(domain)).length * 3;
    if (requiredHarnesses.has(harness.script)) score += 20;
    if (["test", "check:council"].includes(harness.script)) score += 2;
    if (harness.side_effect_class === "deterministic_local") score += 1;
    score += harnessHistoryScore(harness, history);
    return {
      ...harness,
      score: Number(score.toFixed(3)),
      reason: requiredHarnesses.has(harness.script)
        ? "required_harness_for_slice"
        : score > 0
          ? "domain_or_release_gate_match"
          : "coverage_rotation",
    };
  });
  return scored
    .sort((a, b) => b.score - a.score || a.script.localeCompare(b.script))
    .slice(0, Math.max(1, Number(maxHarnesses) || 8));
}

export function buildReviewCyclePlan({
  changedFiles = [],
  packageJson = {},
  history = {},
  maxReviewers = 12,
  maxHarnesses = 8,
  candidateId = "",
  now = new Date(),
} = {}) {
  const files = normalizeList(changedFiles);
  const domains = inferReviewDomains(files);
  const blastRadius = inferBlastRadius(files, domains);
  const roster = getReviewerRoster();
  const required = requiredRolesForDomains(domains);
  const scored = roster.map((reviewer) => {
    const domainScore = reviewerDomainScore(reviewer, domains);
    const historyScore = reviewerHistoryScore(reviewer, history);
    const requiredBoost = required.has(reviewer.role_key) ? 10 : 0;
    const score = domainScore + historyScore + requiredBoost;
    return {
      ...reviewer,
      score: Number(score.toFixed(3)),
      reason: required.has(reviewer.role_key)
        ? "required_lens_for_slice"
        : domainScore > 0
          ? "domain_match"
          : "coverage_rotation",
    };
  });

  const selected = [];
  const seen = new Set();
  for (const role of scored.filter((item) => required.has(item.role_key)).sort((a, b) => b.score - a.score)) {
    if (!seen.has(role.role_key)) {
      selected.push(role);
      seen.add(role.role_key);
    }
  }
  for (const role of scored.sort((a, b) => b.score - a.score || a.role_key.localeCompare(b.role_key))) {
    if (selected.length >= Math.max(1, Number(maxReviewers) || 12)) break;
    if (!seen.has(role.role_key)) {
      selected.push(role);
      seen.add(role.role_key);
    }
  }

  const id = candidateId || `review_${sha256Short(stableStringify({ files, domains, t: now.toISOString().slice(0, 10) }))}`;
  return {
    schema_version: "dizzy.review_cycle_plan.v1",
    candidate_id: id,
    created_at: now.toISOString(),
    changed_files: files,
    domains,
    blast_radius: blastRadius,
    available_reviewers: roster.length,
    reviewer_assignments: selected,
    harness_plan: selectHarnesses({ packageJson, domains, history, maxHarnesses }),
    autonomy_boundary: RUNTIME_AUTONOMY_BOUNDARY,
    reconciliation_rule: "model_output_is_claims_only_local_evidence_decides",
    allowed_state_transitions: REVIEW_STATE_TRANSITIONS,
    stop_conditions: [
      "provider_credentials_missing_or_provider_fails_twice",
      "reviewer_requests_mutation_or_public_action",
      "packet_scope_would_expand_beyond_explicit_files",
      "review_output_requires_code_change_before_verification",
      "next_iteration_is_broader_rather_than_narrower",
      "next_action_is_commit_push_or_publication_without_simul_approval",
    ],
  };
}

export function reconcileReviewBatch({
  reviews = [],
  harnesses = [],
  minReviewsForPush = 3,
  requireDisagreement = true,
} = {}) {
  const normalizedReviews = Array.isArray(reviews) ? reviews : [];
  const normalizedHarnesses = Array.isArray(harnesses) ? harnesses : [];
  const failedHarnesses = normalizedHarnesses.filter((harness) => String(harness.status || "").toLowerCase() !== "passed");
  const findings = normalizedReviews.flatMap((review) => Array.isArray(review.findings) ? review.findings.map((finding) => ({ ...finding, source: review.source })) : []);
  const acceptedFindings = findings.filter((finding) => ["accepted", "confirmed", "new"].includes(String(finding.disposition || "").toLowerCase()));
  const criticalFindings = acceptedFindings.filter((finding) => ["critical", "high"].includes(String(finding.severity || "").toLowerCase()));
  const quarantineFindings = criticalFindings.filter((finding) => /security|privacy|credential|auth|trust|isolation/i.test(`${finding.category || ""} ${finding.claim || ""}`));
  const splitFindings = acceptedFindings.filter((finding) => /split|scope|separate|too broad/i.test(`${finding.category || ""} ${finding.claim || ""}`));
  const fixtureFindings = acceptedFindings.filter((finding) => /fixture|test|repro|harness|required/i.test(`${finding.category || ""} ${finding.claim || ""}`));
  const usefulDisagreements = findings.filter((finding) => String(finding.kind || finding.category || "").toLowerCase().includes("disagreement"));

  let state = "ready-for-review";
  let reason = "needs_more_independent_review";
  if (failedHarnesses.length) {
    state = "fixture-required";
    reason = "one_or_more_harnesses_failed";
  } else if (quarantineFindings.length) {
    state = "quarantine";
    reason = "accepted_security_or_trust_zone_finding";
  } else if (criticalFindings.length) {
    state = "reject";
    reason = "accepted_high_or_critical_finding";
  } else if (splitFindings.length) {
    state = "split";
    reason = "accepted_scope_split_finding";
  } else if (fixtureFindings.length) {
    state = "fixture-required";
    reason = "accepted_fixture_gap";
  } else if (normalizedReviews.length >= minReviewsForPush && (!requireDisagreement || usefulDisagreements.length > 0)) {
    state = "ready-for-push";
    reason = "harnesses_passed_and_review_disagreement_resolved";
  }

  return {
    schema_version: "dizzy.review_reconciliation.v1",
    state_transition: state,
    reason,
    counts: {
      reviews: normalizedReviews.length,
      findings: findings.length,
      accepted_findings: acceptedFindings.length,
      failed_harnesses: failedHarnesses.length,
      useful_disagreements: usefulDisagreements.length,
    },
    failed_harnesses: failedHarnesses.map((harness) => harness.name || harness.script || "unknown_harness"),
    blocking_findings: [...quarantineFindings, ...criticalFindings, ...splitFindings, ...fixtureFindings]
      .map((finding) => ({
        source: finding.source || "unknown_review",
        severity: finding.severity || "",
        category: finding.category || finding.kind || "",
        claim: finding.claim || finding.summary || "",
      })),
    authority: "automation_proposes_simul_approves",
  };
}

export function updateReviewHistory(history = {}, reviews = []) {
  const next = {
    ...history,
    reviewers: { ...(history.reviewers || {}) },
  };
  for (const review of Array.isArray(reviews) ? reviews : []) {
    const key = String(review.role_key || review.source || "").trim();
    if (!key) continue;
    const current = next.reviewers[key] || {};
    const findings = Array.isArray(review.findings) ? review.findings : [];
    const confirmed = findings.filter((finding) => ["accepted", "confirmed"].includes(String(finding.disposition || "").toLowerCase())).length;
    const falsePositives = findings.filter((finding) => String(finding.disposition || "").toLowerCase() === "rejected").length;
    const disagreements = findings.filter((finding) => String(finding.kind || finding.category || "").toLowerCase().includes("disagreement")).length;
    next.reviewers[key] = {
      runs: Math.max(0, Number(current.runs || 0)) + 1,
      confirmed_findings: Math.max(0, Number(current.confirmed_findings || 0)) + confirmed,
      false_positive_findings: Math.max(0, Number(current.false_positive_findings || 0)) + falsePositives,
      useful_disagreements: Math.max(0, Number(current.useful_disagreements || 0)) + disagreements,
    };
  }
  return next;
}
