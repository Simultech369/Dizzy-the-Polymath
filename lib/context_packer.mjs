/**
 * Deterministic 3-Slot Context Packer
 *
 * Enforces structured prompt packing across three distinct slots:
 * 1. MUST_INCLUDE: Canonical constitutional kernel & governing policy
 * 2. OPTIONAL_EVIDENCE: Scoped memory & trajectory context fitted to byte budget
 * 3. FORBIDDEN: Out-of-zone, sensitive, or untrusted artifacts excluded with receipt
 *
 * Schema: dizzy.context_packer.v1
 * Authority: Deterministic machine-enforced prompt budgeting and boundary isolation
 */

import crypto from "node:crypto";

export const CONTEXT_PACKER_SCHEMA = "dizzy.context_packer.v1";

export const DEFAULT_ZONE_BUDGETS = Object.freeze({
  private_self: 32768,        // 32 KB
  trusted_collaborator: 24576, // 24 KB
  outside_contact: 12288,      // 12 KB
  paid_public: 8192            // 8 KB (strict minimization)
});

export class ContextPacker {
  constructor(options = {}) {
    this.defaultMaxBudget = options.defaultMaxBudget || 24576;
    this.zoneBudgets = { ...DEFAULT_ZONE_BUDGETS, ...(options.zoneBudgets || {}) };
  }

  getBudgetForZone(trustZone) {
    return this.zoneBudgets[trustZone] || this.defaultMaxBudget;
  }

  isArtifactAllowedInZone(artifact, trustZone) {
    const sensitivity = artifact.sensitivity_tier || "private_self";
    if (trustZone === "paid_public" || trustZone === "outside_contact") {
      return sensitivity === "public_safe" || sensitivity === "PUBLIC_SAFE";
    }
    if (trustZone === "trusted_collaborator") {
      return sensitivity !== "private_only" && sensitivity !== "LOCAL_ONLY_REQUIRED";
    }
    return true; // private_self allows all verified artifacts
  }

  packContext(inputs = {}) {
    const trustZone = inputs.trust_zone || "private_self";
    const budgetLimit = inputs.max_byte_budget || this.getBudgetForZone(trustZone);
    const mustInclude = inputs.must_include || [];
    const candidateEvidence = inputs.candidate_evidence || [];

    const packedSlots = {
      must_include: [],
      optional_evidence: [],
      forbidden: []
    };

    let currentBytes = 0;

    // 1. Pack MUST_INCLUDE slot
    for (const item of mustInclude) {
      const content = String(item.content || "");
      const itemBytes = Buffer.byteLength(content, "utf8");
      
      packedSlots.must_include.push({
        id: item.id || "must_include_item",
        role: item.role || "doctrine",
        bytes: itemBytes,
        content
      });
      currentBytes += itemBytes;
    }

    if (currentBytes > budgetLimit) {
      throw new Error(`MUST_INCLUDE slots (${currentBytes} bytes) exceeded total budget limit (${budgetLimit} bytes)`);
    }

    // 2. Classify and pack OPTIONAL_EVIDENCE vs FORBIDDEN
    let optionalIncludedCount = 0;
    let optionalOmittedBudgetCount = 0;

    // Sort evidence by priority/weight descending
    const sortedEvidence = [...candidateEvidence].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const item of sortedEvidence) {
      const content = String(item.content || "");
      const itemBytes = Buffer.byteLength(content, "utf8");

      // Check trust-zone boundary
      if (!this.isArtifactAllowedInZone(item, trustZone)) {
        packedSlots.forbidden.push({
          id: item.id || "forbidden_item",
          reason: `Artifact sensitivity '${item.sensitivity_tier}' forbidden in trust zone '${trustZone}'`,
          bytes: itemBytes
        });
        continue;
      }

      // Check byte budget fit
      if (currentBytes + itemBytes <= budgetLimit) {
        packedSlots.optional_evidence.push({
          id: item.id || "evidence_item",
          source: item.source || "memory",
          priority: item.priority || 0,
          bytes: itemBytes,
          content
        });
        currentBytes += itemBytes;
        optionalIncludedCount++;
      } else {
        optionalOmittedBudgetCount++;
      }
    }

    // Compose final unified packed text
    const sections = [];
    if (packedSlots.must_include.length > 0) {
      sections.push("=== [SLOT 1: CANONICAL GOVERNANCE & DOCTRINE (MUST_INCLUDE)] ===");
      sections.push(...packedSlots.must_include.map(m => m.content));
    }
    if (packedSlots.optional_evidence.length > 0) {
      sections.push("\n=== [SLOT 2: VERIFIED CONTEXT EVIDENCE (OPTIONAL_EVIDENCE)] ===");
      sections.push(...packedSlots.optional_evidence.map(e => e.content));
    }

    const composedText = sections.join("\n\n");
    const digest = crypto.createHash("sha256").update(composedText, "utf8").digest("hex");

    const receipt = {
      schema: CONTEXT_PACKER_SCHEMA,
      timestamp: Math.floor(Date.now() / 1000),
      trust_zone: trustZone,
      byte_budget_limit: budgetLimit,
      packed_bytes_total: currentBytes,
      available_headroom_bytes: budgetLimit - currentBytes,
      must_include_count: packedSlots.must_include.length,
      optional_included_count: optionalIncludedCount,
      optional_omitted_budget_count: optionalOmittedBudgetCount,
      forbidden_excluded_count: packedSlots.forbidden.length,
      forbidden_records: packedSlots.forbidden,
      composed_payload_sha256: digest
    };

    return {
      packed_text: composedText,
      receipt
    };
  }
}
