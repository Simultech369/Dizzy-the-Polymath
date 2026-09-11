import crypto from "node:crypto";

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

export function assembleContext({
  trust_zone,
  task,
  budget_tokens,
  allowed_sources
}) {
  // 1. Validate
  const budget_bytes = Number(budget_tokens) || 0; // rough proxy
  if (budget_bytes <= 0) throw new Error("budget_bytes must be > 0");
  if (!trust_zone) throw new Error("trust_zone is required");
  if (!allowed_sources || !Array.isArray(allowed_sources.records)) {
    throw new Error("allowed_sources.records must be an array");
  }

  const receipt = {
    snapshot_id: allowed_sources.snapshot_id,
    selected_ids: [],
    omitted: [],
    final_bytes: 0,
    payload_sha256: ""
  };

  const records = allowed_sources.records;

  // 2. Admit
  const admitted = [];
  for (const r of records) {
    if (!r.id || !r.content) {
      receipt.omitted.push({ id: r.id || "unknown", reason: "malformed" });
      continue;
    }
    const status = String(r.status).toLowerCase();
    if (status === "archived" || status === "revoked") {
      receipt.omitted.push({ id: r.id, reason: "status_revoked" });
      continue;
    }
    if (String(r.sensitivity_tier).toLowerCase() === "do_not_export" && trust_zone !== "private_self") {
      receipt.omitted.push({ id: r.id, reason: "zone_restricted" });
      continue;
    }
    admitted.push(r);
  }

  // 3. Select (Score and Sort)
  const taskTokens = (task || "").toLowerCase().match(/\b\w+\b/g) || [];
  
  const scored = [];
  for (const r of admitted) {
    if (r.is_mandatory) {
      scored.push({ record: r, score: Infinity });
      continue;
    }
    const matches = countOverlap(taskTokens, r.content);
    if (matches === 0 && taskTokens.length > 0) {
      receipt.omitted.push({ id: r.id, reason: "zero_overlap" });
      continue;
    }
    scored.push({ record: r, score: matches });
  }

  scored.sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));

  // 4. Deduplicate
  const seenHashes = new Set();
  const deduped = [];
  for (const { record } of scored) {
    if (seenHashes.has(record.source_sha256)) {
      receipt.omitted.push({ id: record.id, reason: "duplicate_content" });
      continue;
    }
    seenHashes.add(record.source_sha256);
    deduped.push(record);
  }

  // 5. Pack
  let packed_context = "";
  let current_bytes = 0;
  
  // Pack mandatory first
  const mandatory = deduped.filter(r => r.is_mandatory);
  const optional = deduped.filter(r => !r.is_mandatory);
  const ordered = [...mandatory, ...optional];

  for (const r of ordered) {
    const rendered = `\n\n--- [Source: ${r.id}] ---\n${r.content}`;
    const renderedBytes = Buffer.byteLength(rendered, "utf8");
    
    if (current_bytes + renderedBytes <= budget_bytes) {
      packed_context += rendered;
      current_bytes += renderedBytes;
      receipt.selected_ids.push(r.id);
    } else {
      if (r.is_mandatory) {
        throw new Error(`BudgetExceededError: Cannot fit mandatory record ${r.id}`);
      } else {
        receipt.omitted.push({ id: r.id, reason: "budget_exceeded" });
      }
    }
  }

  receipt.final_bytes = current_bytes;
  receipt.payload_sha256 = sha256Hex(packed_context);

  return { packed_context, provenance_receipt: receipt };
}
