/**
 * Grounding Provenance Engine & Evidence-Gap Verification
 *
 * Implements strict separation between corpus-grounded evidence and model generation:
 * - "Citation != proof": Citations prove local presence in verified corpus, not global factuality.
 * - Evidence-Gap Responses: When source-only claims lack verified support, returns explicit gap instead of confabulation.
 * - Segregates corpus-grounded citations from unverified model proposals.
 * - Enforces synthetic rehearsal labeling.
 * - Off by default: standard answers remain clean unless explicitly requested.
 * - Emits cryptographic GroundingProvenanceReceipts.
 *
 * Schema: dizzy.support_class_receipt.v1
 * Authority: Grounding classification and evidence-gap disclosure.
 */

import crypto from "node:crypto";
import { CitationGroundingVerifier } from "./citation_grounding_verifier.mjs";

export const SUPPORT_CLASS_RECEIPT_SCHEMA = "dizzy.support_class_receipt.v1";
export const GROUNDING_PROVENANCE_RECEIPT_SCHEMA = SUPPORT_CLASS_RECEIPT_SCHEMA;

export const CITATION_NOT_PROOF_DISCLAIMER =
  "Citation proves textual presence in local corpus; citation does not prove global factuality or fiduciary settlement.";

export const GROUNDING_CLASSES = Object.freeze({
  CORPUS_GROUNDED: "CORPUS_GROUNDED",
  UNVERIFIED_MODEL_PROPOSAL: "UNVERIFIED_MODEL_PROPOSAL",
  SYNTHETIC_REHEARSAL: "SYNTHETIC_REHEARSAL",
  EVIDENCE_GAP: "EVIDENCE_GAP",
  // Backwards compatibility aliases
  SUPPORTED_BY_LOCAL_PASSAGE: "CORPUS_GROUNDED",
  UNVERIFIED_MODEL_EXPLANATION: "UNVERIFIED_MODEL_PROPOSAL",
  SYNTHETIC_REASONING_ONLY: "SYNTHETIC_REHEARSAL",
});

export const SUPPORT_CLASSES = GROUNDING_CLASSES;

export const GROUNDING_BADGES = Object.freeze({
  [GROUNDING_CLASSES.CORPUS_GROUNDED]: "[CORPUS_GROUNDED]",
  [GROUNDING_CLASSES.UNVERIFIED_MODEL_PROPOSAL]: "[UNVERIFIED_MODEL_PROPOSAL]",
  [GROUNDING_CLASSES.SYNTHETIC_REHEARSAL]: "[SYNTHETIC_REHEARSAL]",
  [GROUNDING_CLASSES.EVIDENCE_GAP]: "[EVIDENCE_GAP]",
});

function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export class GroundingProvenanceEngine {
  constructor(opts = {}) {
    this.rootDir = opts.rootDir || process.cwd();
    this.verifier = opts.verifier || new CitationGroundingVerifier({ rootDir: this.rootDir });
    this.now = opts.now || (() => new Date());
    this.defaultEnabled = opts.enabled ?? false; // OFF by default
  }

  /**
   * Classifies an answer and segregates grounded passages from model speculation.
   *
   * @param {Object} params
   * @param {string} [params.claimId]
   * @param {string} params.query
   * @param {string} [params.answerText]
   * @param {"SOURCE_BACKED_ONLY" | "HYBRID" | "UNVERIFIED_ALLOWED" | "SYNTHETIC_REHEARSAL"} [params.requestMode]
   * @param {Array<Object>} [params.citations] - Array of { file_path, quote, lines }
   * @param {Object} [params.contextPackets] - In-memory map of file_path -> content
   * @param {boolean} [params.isSynthetic] - Flag if executed in synthetic rehearsal
   * @param {boolean} [params.enabled] - Opt-in flag (defaults to false / off)
   * @returns {Object} Classified result with UI rendering blocks and cryptographic receipt
   */
  classifyAnswer({
    claimId = null,
    query,
    answerText = "",
    requestMode = "HYBRID",
    citations = [],
    contextPackets = {},
    isSynthetic = false,
    enabled = null,
  } = {}) {
    const isEnabled = enabled !== null ? Boolean(enabled) : this.defaultEnabled;

    // OFF by default: If not enabled and not strictly requiring source backing, return unmodified plain text
    if (!isEnabled && requestMode !== "SOURCE_BACKED_ONLY" && !isSynthetic) {
      return {
        ok: true,
        enabled: false,
        support_class: null,
        provenance_badge: null,
        answer_text: answerText,
        grounded_citations: [],
        unverified_explanation: answerText,
        evidence_gaps: [],
        rendered_markdown: answerText,
        receipt: null,
      };
    }

    const id = claimId || `sc_${crypto.randomUUID().slice(0, 8)}`;
    const timestampIso = (this.now)().toISOString();

    // 1. Synthetic Rehearsal Guard
    if (isSynthetic || requestMode === "SYNTHETIC_REHEARSAL") {
      return this._formatSyntheticResult({
        id,
        query,
        answerText,
        timestampIso,
      });
    }

    // 2. Evaluate Citations via Grounding Verifier
    const groundingReport = this.verifier.verifyCitations(id, citations, contextPackets, {
      requireEvidence: requestMode === "SOURCE_BACKED_ONLY",
      claimType: citations && citations.length > 0 ? "grounded" : "unverified_explanation",
    });

    const hasCitations = Array.isArray(citations) && citations.length > 0;
    const isGroundingPassed = groundingReport.grounding_verdict === "GROUNDING_VERIFIED_PASSED";

    // 3. Evidence-Gap Check
    // If caller required source-backed only and no valid citations exist or grounding failed:
    if (requestMode === "SOURCE_BACKED_ONLY" && (!hasCitations || !isGroundingPassed)) {
      return this._formatEvidenceGapResult({
        id,
        query,
        groundingReport,
        timestampIso,
      });
    }

    // 4. Grounded Passage Support
    if (hasCitations && isGroundingPassed) {
      return this._formatSupportedResult({
        id,
        query,
        answerText,
        groundingReport,
        timestampIso,
      });
    }

    // 5. Unverified Model Proposal (Fallback for non-source-only queries)
    return this._formatUnverifiedResult({
      id,
      query,
      answerText,
      groundingReport,
      timestampIso,
    });
  }

  _formatSupportedResult({ id, query, answerText, groundingReport, timestampIso }) {
    const supportClass = GROUNDING_CLASSES.CORPUS_GROUNDED;
    const validCitations = (groundingReport.citations || []).filter((c) => c.verified);
    const badge = `[CORPUS_GROUNDED: ${validCitations.length} citation(s)]`;

    const renderedMarkdown = [
      `> [!NOTE]`,
      `> **Provenance Badge**: \`${badge}\``,
      `> **Disclaimer**: ${CITATION_NOT_PROOF_DISCLAIMER}`,
      ``,
      `### Answer`,
      answerText,
      ``,
      `### Grounded Evidence Citations`,
      ...validCitations.map(
        (c) => `- **\`${c.file_path}\`** (Lines ${c.actual_lines ? c.actual_lines.join("-") : "N/A"}):\n  > "${c.claimed_quote}"`
      ),
    ].join("\n");

    const receiptPayload = {
      schema_version: SUPPORT_CLASS_RECEIPT_SCHEMA,
      timestamp: timestampIso,
      claim_id: id,
      support_class: supportClass,
      provenance_badge: badge,
      query_sha256: sha256Hex(query),
      answer_sha256: sha256Hex(answerText),
      citations_count: validCitations.length,
      grounding_receipt_sha256: groundingReport.receipt_sha256 || null,
      disclaimer: CITATION_NOT_PROOF_DISCLAIMER,
      evidence_gap: false,
      gap_reason: null,
    };

    const evidenceSha256 = sha256Hex(stableJson(receiptPayload));
    const receipt = Object.freeze({ ...receiptPayload, evidence_sha256: evidenceSha256 });

    return {
      ok: true,
      enabled: true,
      support_class: supportClass,
      provenance_badge: badge,
      answer_text: answerText,
      grounded_citations: validCitations,
      unverified_explanation: null,
      evidence_gaps: [],
      rendered_markdown: renderedMarkdown,
      receipt,
    };
  }

  _formatEvidenceGapResult({ id, query, groundingReport, timestampIso }) {
    const supportClass = GROUNDING_CLASSES.EVIDENCE_GAP;
    const badge = "[EVIDENCE_GAP]";
    const gapReason = "Requested source-backed claim lacks verified local passages; evidence gap declared to prevent confabulation.";

    const gapAnswer = `[EVIDENCE_GAP] No supporting passages found in local corpus for query: "${query}". Refusing to hallucinate ungrounded response under SOURCE_BACKED_ONLY mode.`;

    const renderedMarkdown = [
      `> [!CAUTION]`,
      `> **Provenance Badge**: \`${badge}\``,
      `> **Evidence Gap**: ${gapReason}`,
      ``,
      gapAnswer,
    ].join("\n");

    const receiptPayload = {
      schema_version: SUPPORT_CLASS_RECEIPT_SCHEMA,
      timestamp: timestampIso,
      claim_id: id,
      support_class: supportClass,
      provenance_badge: badge,
      query_sha256: sha256Hex(query),
      answer_sha256: sha256Hex(gapAnswer),
      citations_count: 0,
      grounding_receipt_sha256: groundingReport.receipt_sha256 || null,
      disclaimer: CITATION_NOT_PROOF_DISCLAIMER,
      evidence_gap: true,
      gap_reason: gapReason,
    };

    const evidenceSha256 = sha256Hex(stableJson(receiptPayload));
    const receipt = Object.freeze({ ...receiptPayload, evidence_sha256: evidenceSha256 });

    return {
      ok: false,
      enabled: true,
      support_class: supportClass,
      provenance_badge: badge,
      answer_text: gapAnswer,
      grounded_citations: [],
      unverified_explanation: null,
      evidence_gaps: [{ query, reason: gapReason }],
      rendered_markdown: renderedMarkdown,
      receipt,
    };
  }

  _formatUnverifiedResult({ id, query, answerText, groundingReport, timestampIso }) {
    const supportClass = GROUNDING_CLASSES.UNVERIFIED_MODEL_PROPOSAL;
    const badge = "[UNVERIFIED_MODEL_PROPOSAL]";

    const renderedMarkdown = [
      `> [!WARNING]`,
      `> **Provenance Badge**: \`${badge}\``,
      `> **Zero Grounding Authority**: Model proposal only; not grounded in verified local corpus.`,
      ``,
      answerText,
    ].join("\n");

    const receiptPayload = {
      schema_version: SUPPORT_CLASS_RECEIPT_SCHEMA,
      timestamp: timestampIso,
      claim_id: id,
      support_class: supportClass,
      provenance_badge: badge,
      query_sha256: sha256Hex(query),
      answer_sha256: sha256Hex(answerText),
      citations_count: 0,
      grounding_receipt_sha256: groundingReport.receipt_sha256 || null,
      disclaimer: CITATION_NOT_PROOF_DISCLAIMER,
      evidence_gap: false,
      gap_reason: null,
    };

    const evidenceSha256 = sha256Hex(stableJson(receiptPayload));
    const receipt = Object.freeze({ ...receiptPayload, evidence_sha256: evidenceSha256 });

    return {
      ok: true,
      enabled: true,
      support_class: supportClass,
      provenance_badge: badge,
      answer_text: answerText,
      grounded_citations: [],
      unverified_explanation: answerText,
      evidence_gaps: [],
      rendered_markdown: renderedMarkdown,
      receipt,
    };
  }

  _formatSyntheticResult({ id, query, answerText, timestampIso }) {
    const supportClass = GROUNDING_CLASSES.SYNTHETIC_REHEARSAL;
    const badge = "[SYNTHETIC_REHEARSAL]";

    const renderedMarkdown = [
      `> [!NOTE]`,
      `> **Provenance Badge**: \`${badge}\``,
      `> **Synthetic Rehearsal**: Generated in sandbox fixture; production authority = false.`,
      ``,
      answerText,
    ].join("\n");

    const receiptPayload = {
      schema_version: SUPPORT_CLASS_RECEIPT_SCHEMA,
      timestamp: timestampIso,
      claim_id: id,
      support_class: supportClass,
      provenance_badge: badge,
      query_sha256: sha256Hex(query),
      answer_sha256: sha256Hex(answerText),
      citations_count: 0,
      grounding_receipt_sha256: null,
      disclaimer: CITATION_NOT_PROOF_DISCLAIMER,
      evidence_gap: false,
      gap_reason: null,
    };

    const evidenceSha256 = sha256Hex(stableJson(receiptPayload));
    const receipt = Object.freeze({ ...receiptPayload, evidence_sha256: evidenceSha256 });

    return {
      ok: true,
      enabled: true,
      support_class: supportClass,
      provenance_badge: badge,
      answer_text: answerText,
      grounded_citations: [],
      unverified_explanation: null,
      evidence_gaps: [],
      rendered_markdown: renderedMarkdown,
      receipt,
    };
  }
}

export function verifyGroundingProvenanceReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") return false;
  if (receipt.schema_version !== SUPPORT_CLASS_RECEIPT_SCHEMA) return false;
  const { evidence_sha256, ...payload } = receipt;
  if (!evidence_sha256) return false;
  const expectedHash = sha256Hex(stableJson(payload));
  return evidence_sha256 === expectedHash;
}

// Aliases for compatibility
export { GroundingProvenanceEngine as SupportClassEngine };
export { verifyGroundingProvenanceReceipt as verifySupportClassReceipt };
