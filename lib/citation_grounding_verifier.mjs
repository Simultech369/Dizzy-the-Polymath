import crypto from "crypto";
import fs from "fs";
import path from "path";

export const CITATION_GROUNDING_SCHEMA = "dizzy.citation_grounding.v1";
export const CITATION_GROUNDING_AUTHORITY = "deterministic_evidence_not_authority";
export const CITATION_GROUNDING_DISCLAIMER = "Citation proves textual presence in local corpus; citation does not prove global factuality or fiduciary settlement.";

export class CitationGroundingVerifier {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.fuzzyLineSearchWindow = options.fuzzyLineSearchWindow || 20;
  }

  /**
   * Verifies an array of citations against local source files or packet text.
   * Supports options: { requireEvidence: boolean, claimType: "grounded" | "unverified_explanation" }
   */
  verifyCitations(claimId, citations = [], contextPackets = {}, options = {}) {
    // 0. Handle Evidence Gap and Unverified Model Explanations (Strict evidence discipline)
    if (!citations || citations.length === 0) {
      const isUnverifiedExplanation = options.claimType === "unverified_explanation" || options.unverifiedExplanation;
      const verdict = isUnverifiedExplanation ? "UNVERIFIED_MODEL_EXPLANATION" : "EVIDENCE_GAP";
      const provenanceBadge = isUnverifiedExplanation ? "[UNVERIFIED_MODEL_EXPLANATION]" : "[EVIDENCE_GAP]";
      const details = isUnverifiedExplanation
        ? "Model explanation without local source citations; zero grounding authority."
        : "Requested evidence-backed claim contains zero supporting citations; corpus lacks grounded evidence.";

      const receipt = {
        schema_version: CITATION_GROUNDING_SCHEMA,
        authority: CITATION_GROUNDING_AUTHORITY,
        disclaimer: CITATION_GROUNDING_DISCLAIMER,
        claim_id: claimId || `claim_${crypto.randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        citations_evaluated: 0,
        exact_matches: 0,
        normalized_matches: 0,
        line_drifts: 0,
        phantom_citations: 0,
        missing_files: 0,
        accuracy_score: 0,
        evidence_gap: !isUnverifiedExplanation,
        provenance_badge: provenanceBadge,
        grounding_verdict: verdict,
        details,
        citations: []
      };

      const receiptSha256 = crypto
        .createHash("sha256")
        .update(JSON.stringify(receipt))
        .digest("hex");

      return { ...receipt, receipt_sha256: receiptSha256 };
    }

    const verificationResults = [];
    let exactMatches = 0;
    let normalizedMatches = 0;
    let lineDrifts = 0;
    let phantomCitations = 0;
    let missingFiles = 0;
    let poisonedOrSpoofed = 0;

    for (let i = 0; i < citations.length; i++) {
      const cit = citations[i];
      const res = this._verifySingleCitation(cit, contextPackets, options);
      verificationResults.push({
        citation_index: i,
        file_path: cit.file_path || cit.file || "",
        claimed_quote: cit.quote || cit.exact_quote || "",
        claimed_lines: cit.lines || [cit.start_line, cit.end_line],
        ...res
      });

      if (res.status === "EXACT_MATCH") exactMatches++;
      else if (res.status === "WHITESPACE_NORMALIZED_MATCH") normalizedMatches++;
      else if (res.status === "LINE_DRIFT") lineDrifts++;
      else if (res.status === "PHANTOM_CITATION") phantomCitations++;
      else if (res.status === "MISSING_TARGET_DOCUMENT") missingFiles++;
      else if (
        res.status === "POISONED_SOURCE_DETECTED"
        || res.status === "SPOOFED_SOURCE_DIGEST_MISMATCH"
        || res.status === "UNSAFE_SOURCE_PATH"
      ) {
        poisonedOrSpoofed++;
      }
    }

    const total = Math.max(1, citations.length);
    const validCount = exactMatches + normalizedMatches;
    const accuracyScore = Math.round((validCount / total) * 1000) / 1000;
    const isGroundingPassed = phantomCitations === 0 && missingFiles === 0 && poisonedOrSpoofed === 0 && accuracyScore >= 0.8;

    let provenanceBadge = "[PASSAGE_GROUNDED]";
    if (!isGroundingPassed) {
      if (poisonedOrSpoofed > 0) provenanceBadge = "[POISONED_OR_SPOOFED_SOURCE_BLOCKED]";
      else if (phantomCitations > 0) provenanceBadge = "[PHANTOM_CITATION_FAILED]";
      else if (missingFiles > 0) provenanceBadge = "[MISSING_DOCUMENT_FAILED]";
      else provenanceBadge = "[GROUNDING_FAILED]";
    }

    const receipt = {
      schema_version: CITATION_GROUNDING_SCHEMA,
      authority: CITATION_GROUNDING_AUTHORITY,
      disclaimer: CITATION_GROUNDING_DISCLAIMER,
      claim_id: claimId || `claim_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      citations_evaluated: citations.length,
      exact_matches: exactMatches,
      normalized_matches: normalizedMatches,
      line_drifts: lineDrifts,
      phantom_citations: phantomCitations,
      missing_files: missingFiles,
      poisoned_or_spoofed_sources: poisonedOrSpoofed,
      accuracy_score: accuracyScore,
      evidence_gap: false,
      provenance_badge: provenanceBadge,
      grounding_verdict: isGroundingPassed ? "GROUNDING_VERIFIED_PASSED" : "GROUNDING_VERIFICATION_FAILED",
      citations: verificationResults
    };

    const receiptSha256 = crypto
      .createHash("sha256")
      .update(JSON.stringify(receipt))
      .digest("hex");

    return { ...receipt, receipt_sha256: receiptSha256 };
  }

  _verifySingleCitation(cit, contextPackets = {}, options = {}) {
    const filePath = String(cit.file_path || cit.file || "").trim();
    const quote = String(cit.quote || cit.exact_quote || "").trim();
    const lines = Array.isArray(cit.lines) ? cit.lines : [cit.start_line, cit.end_line].filter((n) => typeof n === "number");

    if (!quote) {
      return { status: "EMPTY_QUOTE", verified: false, details: "No quote string supplied" };
    }

    // 1. Resolve Document Content with Workspace Path Jailing
    let docContent = "";
    if (Object.prototype.hasOwnProperty.call(contextPackets, filePath)) {
      docContent = String(contextPackets[filePath] ?? "");
    } else if (filePath) {
      const rootReal = path.resolve(this.rootDir);
      const resolved = path.resolve(rootReal, filePath);
      if (resolved !== rootReal && !resolved.startsWith(rootReal + path.sep)) {
        return {
          status: "UNSAFE_SOURCE_PATH",
          verified: false,
          details: `Citation path '${filePath}' escapes workspace boundary`,
        };
      }
      if (!fs.existsSync(resolved)) {
        return { status: "MISSING_TARGET_DOCUMENT", verified: false, details: `File not found: ${filePath}` };
      }
      try {
        docContent = fs.readFileSync(resolved, "utf8");
      } catch (err) {
        return { status: "READ_ERROR", verified: false, details: String(err.message || err) };
      }
    } else {
      return { status: "MISSING_FILE_PATH", verified: false, details: "No file_path specified" };
    }

    // 1b. Detect Spoofed Source Digest (if expected_sha256 or sourceDigests provided)
    const expectedSha = cit.expected_sha256 || options?.sourceDigests?.[filePath] || null;
    const actualSha = crypto.createHash("sha256").update(docContent, "utf8").digest("hex");
    if (expectedSha && actualSha.toLowerCase() !== String(expectedSha).toLowerCase()) {
      return {
        status: "SPOOFED_SOURCE_DIGEST_MISMATCH",
        verified: false,
        details: `Source SHA-256 mismatch for '${filePath}': expected ${expectedSha}, got ${actualSha}`,
      };
    }

    // 1c. Detect Poisoned or Revoked Source Content
    const poisonPatterns = [
      /ignore\s+(all\s+)?(previous|prior|system)\s+(instructions|rules|prompts)/i,
      /(?:<\|im_start\|>|<\|system\|>|<<SYS>>)/i,
      /^memory_status:\s*revoked\b/im,
    ];
    if (poisonPatterns.some((re) => re.test(docContent))) {
      return {
        status: "POISONED_SOURCE_DETECTED",
        verified: false,
        details: `Target source '${filePath}' contains revoked status or prompt-injection poison markers`,
      };
    }

    const docLines = docContent.split(/\r?\n/);
    const startLine = lines[0] ? Math.max(1, lines[0]) : null;
    const endLine = lines[1] ? Math.min(docLines.length, lines[1]) : startLine;

    // 2. Check Line Bounds if specified
    if (startLine && startLine > docLines.length) {
      return { status: "OUT_OF_BOUNDS", verified: false, details: `Line ${startLine} exceeds total lines ${docLines.length}` };
    }

    // 3. Extract Claimed Block if lines provided
    if (startLine) {
      const extractedLines = docLines.slice(startLine - 1, endLine);
      const extractedText = extractedLines.join("\n");

      if (extractedText.includes(quote)) {
        return { status: "EXACT_MATCH", verified: true, actual_lines: [startLine, endLine], source_sha256: actualSha };
      }

      const normExtracted = extractedText.replace(/\s+/g, " ").trim();
      const normQuote = quote.replace(/\s+/g, " ").trim();
      if (normExtracted.includes(normQuote)) {
        return { status: "WHITESPACE_NORMALIZED_MATCH", verified: true, actual_lines: [startLine, endLine], source_sha256: actualSha };
      }
    }

    // 4. Search Entire Document for Quote
    const fullText = docContent;
    if (fullText.includes(quote) || fullText.replace(/\s+/g, " ").includes(quote.replace(/\s+/g, " "))) {
      const quoteLines = quote.split(/\r?\n/).length;
      for (let idx = 0; idx < docLines.length; idx++) {
        const slice = docLines.slice(idx, idx + quoteLines).join("\n");
        if (slice.includes(quote) || slice.replace(/\s+/g, " ").includes(quote.replace(/\s+/g, " "))) {
          return {
            status: "LINE_DRIFT",
            verified: false,
            claimed_lines: lines,
            actual_lines: [idx + 1, idx + quoteLines],
            details: `Quote found at lines [${idx + 1}, ${idx + quoteLines}] instead of claimed line ${startLine || "unspecified"}`
          };
        }
      }
      return { status: "LINE_DRIFT", verified: false, details: "Quote found in document with line offset" };
    }

    // 5. Quote not found anywhere in document
    return {
      status: "PHANTOM_CITATION",
      verified: false,
      details: "Claimed quote does not exist anywhere in target document"
    };
  }
}
