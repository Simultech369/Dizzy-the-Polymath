import crypto from "node:crypto";
import { ContextPacker, DEFAULT_ZONE_BUDGETS, CONTEXT_PACKER_SCHEMA } from "./context_packer.mjs";

export { DEFAULT_ZONE_BUDGETS, CONTEXT_PACKER_SCHEMA };

export const CONTEXT_ASSEMBLER_SCHEMA = "dizzy.context_assembler.v2";

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function countOverlap(taskTokens, content) {
  if (!taskTokens.length || !content) return 0;
  const contentTokens = new Set(content.toLowerCase().match(/\b\w+\b/g) || []);
  let matches = 0;
  for (const token of taskTokens) {
    if (contentTokens.has(token)) matches++;
  }
  return matches;
}

/**
 * Unified Context Assembly Pipeline
 *
 * Implements the full zone → sources → admit → score → dedup → pack → provenance
 * chain by combining the admission/scoring logic with the ContextPacker's 3-slot
 * model (MUST_INCLUDE / OPTIONAL_EVIDENCE / FORBIDDEN).
 *
 * Pipeline stages:
 *   1. Validate inputs and resolve zone budget
 *   2. Admit: reject malformed, archived/revoked, and zone-restricted records
 *   3. Score: rank admitted records by task overlap (mandatory records bypass scoring)
 *   4. Deduplicate: remove content-identical records by source_sha256
 *   5. Pack: delegate to ContextPacker for 3-slot budgeted packing with zone enforcement
 *   6. Receipt: emit unified provenance receipt binding snapshot, slots, and payload hash
 *
 * Security Contract:
 * - Blocks `do_not_export` records from leaking outside `private_self` zone.
 * - Blocks `normal`/`private_only` records from `paid_public` and `outside_contact` zones
 *   via ContextPacker's isArtifactAllowedInZone.
 * - Full origin trust-zone matrix enforcement is assumed upstream in the dispatch pipeline.
 *
 * Schema: dizzy.context_assembler.v2
 */
export function assembleContext({
  trust_zone,
  task,
  budget_bytes,
  allowed_sources,
  zone_budgets,
}) {
  // 1. Validate
  if (!trust_zone) throw new Error("trust_zone is required");
  if (!allowed_sources || !Array.isArray(allowed_sources.records)) {
    throw new Error("allowed_sources.records must be an array");
  }

  const packer = new ContextPacker({
    zoneBudgets: zone_budgets || undefined,
  });

  // Resolve effective budget: explicit budget_bytes overrides zone default
  const zoneBudget = packer.getBudgetForZone(trust_zone);
  const effectiveBudget = Number(budget_bytes) || zoneBudget;
  if (effectiveBudget <= 0) throw new Error("budget_bytes must be > 0");

  const omitted = [];
  const records = allowed_sources.records;

  // 2. Admit — reject malformed, archived/revoked, and zone-restricted
  const admitted = [];
  for (const r of records) {
    if (!r.id || !r.content) {
      omitted.push({ id: r.id || "unknown", reason: "malformed" });
      continue;
    }
    const status = String(r.status).toLowerCase();
    if (status === "archived" || status === "revoked") {
      omitted.push({ id: r.id, reason: "status_revoked" });
      continue;
    }
    if (String(r.sensitivity_tier).toLowerCase() === "do_not_export" && trust_zone !== "private_self") {
      omitted.push({ id: r.id, reason: "zone_restricted" });
      continue;
    }
    admitted.push(r);
  }

  // 3. Score — rank by task-token overlap; mandatory records bypass scoring
  const taskTokens = (task || "").toLowerCase().match(/\b\w+\b/g) || [];

  const scored = [];
  for (const r of admitted) {
    if (r.is_mandatory) {
      scored.push({ record: r, score: Infinity });
      continue;
    }
    const matches = countOverlap(taskTokens, r.content);
    if (matches === 0 && taskTokens.length > 0) {
      omitted.push({ id: r.id, reason: "zero_overlap" });
      continue;
    }
    scored.push({ record: r, score: matches });
  }

  scored.sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));

  // 4. Deduplicate by source_sha256
  const seenHashes = new Set();
  const deduped = [];
  for (const { record } of scored) {
    if (record.source_sha256 && seenHashes.has(record.source_sha256)) {
      omitted.push({ id: record.id, reason: "duplicate_content" });
      continue;
    }
    if (record.source_sha256) seenHashes.add(record.source_sha256);
    deduped.push(record);
  }

  // 5. Pack — split into mandatory (MUST_INCLUDE) and optional (OPTIONAL_EVIDENCE),
  //    delegate to ContextPacker for zone-aware 3-slot packing
  const mustInclude = [];
  const candidateEvidence = [];

  for (const r of deduped) {
    const item = {
      id: r.id,
      content: r.content,
      sensitivity_tier: r.sensitivity_tier,
      source: r.kind || "cognitive_memory",
      priority: r.is_mandatory ? Infinity : (r._score || 0),
    };

    if (r.is_mandatory) {
      mustInclude.push({ ...item, role: "mandatory_rule" });
    } else {
      candidateEvidence.push(item);
    }
  }

  // Assign scored priorities from step 3 onto candidate evidence
  const scoreMap = new Map(scored.map(s => [s.record.id, s.score]));
  for (const c of candidateEvidence) {
    c.priority = scoreMap.get(c.id) || 0;
  }

  let packerResult;
  try {
    packerResult = packer.packContext({
      trust_zone,
      max_byte_budget: effectiveBudget,
      must_include: mustInclude,
      candidate_evidence: candidateEvidence,
    });
  } catch (err) {
    // Re-throw packer budget errors with backward-compatible prefix
    if (err.message && err.message.includes("exceeded total budget limit")) {
      const mandatoryIds = mustInclude.map(m => m.id).join(", ");
      throw new Error(`BudgetExceededError: Cannot fit mandatory records [${mandatoryIds}] — ${err.message}`);
    }
    throw err;
  }

  // Merge packer's forbidden records into our omitted list
  for (const f of packerResult.receipt.forbidden_records || []) {
    omitted.push({ id: f.id, reason: "packer_zone_forbidden" });
  }

  // 6. Build unified provenance receipt
  const selected_ids = [
    ...(packerResult.receipt.must_include_ids || []),
    ...(packerResult.receipt.optional_included_ids || []),
  ];

  const provenance_receipt = {
    schema: CONTEXT_ASSEMBLER_SCHEMA,
    snapshot_id: allowed_sources.snapshot_id,
    trust_zone,
    effective_budget_bytes: effectiveBudget,
    zone_default_budget_bytes: zoneBudget,
    selected_ids,
    omitted,
    slots: {
      must_include_count: packerResult.receipt.must_include_count,
      optional_included_count: packerResult.receipt.optional_included_count,
      optional_omitted_budget_count: packerResult.receipt.optional_omitted_budget_count,
      forbidden_excluded_count: packerResult.receipt.forbidden_excluded_count,
    },
    final_bytes: packerResult.receipt.packed_bytes_total,
    headroom_bytes: packerResult.receipt.available_headroom_bytes,
    payload_sha256: packerResult.receipt.composed_payload_sha256,
    packer_receipt_sha256: sha256Hex(JSON.stringify(packerResult.receipt)),
  };

  // Backward-compatible return shape: packed_context + provenance_receipt
  return {
    packed_context: packerResult.packed_text,
    provenance_receipt,
  };
}
