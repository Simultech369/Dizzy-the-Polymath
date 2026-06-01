const MEMORY_CLASSES = new Set([
  "user_claim",
  "assistant_observation",
  "project_decision",
  "reusable_pattern",
]);

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeEnum(value, allowed, fallback) {
  const raw = clean(value, 80).toLowerCase();
  return allowed.includes(raw) ? raw : fallback;
}

export function normalizeMemoryClass(value) {
  const raw = clean(value, 80).toLowerCase();
  return MEMORY_CLASSES.has(raw) ? raw : "";
}

export function buildReusablePatternProvenance(input = {}) {
  const successCriteria = clean(input.success_criteria, 800);
  const reusablePattern = clean(input.reusable_pattern, 800);
  const outcome = normalizeEnum(input.outcome, ["success", "partial", "failure"], "success");
  const actions = Array.isArray(input.actions_taken) ? input.actions_taken : [];
  const actionEvidence = actions.map((x) => clean(x, 180)).filter(Boolean).slice(0, 4);

  return {
    memory_class: "reusable_pattern",
    source: normalizeEnum(input.provenance?.source ?? input.source, ["operator_reviewed", "assistant_proposed", "runtime_generated"], "operator_reviewed"),
    scope: normalizeEnum(input.provenance?.scope ?? input.scope, ["private", "project", "client", "public", "operational"], "private"),
    confidence: normalizeEnum(input.provenance?.confidence ?? input.confidence, ["low", "medium", "high"], "medium"),
    sensitivity: normalizeEnum(input.provenance?.sensitivity ?? input.sensitivity, ["normal", "sensitive", "do_not_export"], "normal"),
    evidence: {
      outcome,
      success_criteria: successCriteria,
      actions_taken: actionEvidence,
    },
    revocation_path: clean(input.provenance?.revocation_path ?? input.revocation_path, 200) || "delete or edit the trajectory ledger row",
    lossy_risk: normalizeEnum(input.provenance?.lossy_risk ?? input.lossy_risk, ["low", "medium", "high"], "medium"),
    reusable_pattern: reusablePattern,
  };
}

export function validateMemoryProvenance(provenance = {}) {
  const memoryClass = normalizeMemoryClass(provenance.memory_class);
  const errors = [];
  if (!memoryClass) errors.push("memory_class must be one of user_claim, assistant_observation, project_decision, reusable_pattern");

  if (memoryClass === "user_claim") {
    if (!clean(provenance.evidence_quote, 1000)) errors.push("user_claim requires evidence_quote");
    if (clean(provenance.speaker, 80).toLowerCase() !== "user") errors.push("user_claim requires speaker=user");
  }

  if (memoryClass === "assistant_observation") {
    if (!clean(provenance.grounding_quote, 1000)) errors.push("assistant_observation requires grounding_quote");
    if (!["observed", "interpreted", "speculative"].includes(clean(provenance.epistemic_status, 80).toLowerCase())) {
      errors.push("assistant_observation requires epistemic_status");
    }
  }

  if (memoryClass === "project_decision") {
    if (!clean(provenance.decision_source, 500)) errors.push("project_decision requires decision_source");
  }

  if (memoryClass === "reusable_pattern") {
    const evidence = provenance.evidence && typeof provenance.evidence === "object" ? provenance.evidence : {};
    if (!clean(provenance.reusable_pattern, 1000)) errors.push("reusable_pattern requires reusable_pattern");
    if (!clean(evidence.success_criteria, 1000) && !(Array.isArray(evidence.actions_taken) && evidence.actions_taken.length)) {
      errors.push("reusable_pattern requires success_criteria or actions_taken evidence");
    }
  }

  if (errors.length) {
    const err = new Error(`invalid provenance: ${errors.join("; ")}`);
    err.errors = errors;
    throw err;
  }

  return { ...provenance, memory_class: memoryClass };
}
