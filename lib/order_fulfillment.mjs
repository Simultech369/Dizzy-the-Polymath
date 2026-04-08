import crypto from "crypto";
import fs from "fs";
import path from "path";

const DEFAULT_CANDIDATE_FILENAME = "candidate.png";
const DEFAULT_CANDIDATE_METADATA_FILENAME = "candidate.json";
const PLACEHOLDER_MODELS = new Set(["placeholder_local_png", "placeholder", "stub"]);

export function sanitizeOrderId(orderId) {
  return String(orderId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",");
  return `{${body}}`;
}

export function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function fileSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function getOrderDir(orderId, runtimeRoot) {
  return path.join(runtimeRoot, sanitizeOrderId(orderId));
}

export function isPathInside(parentDir, childPath) {
  const parent = path.resolve(parentDir);
  const child = path.resolve(childPath);
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function expectedRequestKey(order) {
  return sha256Text(stableStringify({ service_id: order?.service_id ?? null, brief: String(order?.brief ?? "").trim() }));
}

function parseJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { ok: false, value: null, error: "missing" };
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")), error: "" };
  } catch (err) {
    return { ok: false, value: null, error: String(err?.message ?? err) };
  }
}

function metadataPaths(orderId, runtimeRoot, opts = {}) {
  const orderDir = getOrderDir(orderId, runtimeRoot);
  const candidateFileName = String(opts.candidateFileName || DEFAULT_CANDIDATE_FILENAME);
  const metadataFileName = String(opts.metadataFileName || DEFAULT_CANDIDATE_METADATA_FILENAME);
  return {
    orderDir,
    candidatePath: path.join(orderDir, candidateFileName),
    metadataPath: path.join(orderDir, metadataFileName),
  };
}

export function buildPreparedCandidatePayload(order, facts, runtimeRoot, opts = {}) {
  const orderId = String(order?.order_id ?? "").trim();
  if (!orderId) return { ok: false, reason: "missing_order_id" };

  const { candidatePath, metadataPath } = metadataPaths(orderId, runtimeRoot, opts);
  if (!fs.existsSync(candidatePath)) {
    return { ok: false, reason: "prepared_candidate_missing", detail: path.relative(process.cwd(), candidatePath).replace(/\\/g, "/") };
  }

  const metadataResult = parseJsonFile(metadataPath);
  if (!metadataResult.ok) {
    return {
      ok: false,
      reason: metadataResult.error === "missing" ? "prepared_candidate_metadata_missing" : "prepared_candidate_metadata_invalid",
      detail: path.relative(process.cwd(), metadataPath).replace(/\\/g, "/"),
    };
  }

  const metadata = metadataResult.value && typeof metadataResult.value === "object" ? metadataResult.value : {};
  const model = String(metadata.model ?? "").trim().toLowerCase();
  if (!model || PLACEHOLDER_MODELS.has(model) || metadata.placeholder === true) {
    return { ok: false, reason: "prepared_candidate_not_deliverable", detail: "metadata must declare a non-placeholder model" };
  }

  const requestKey = expectedRequestKey(order);
  const fileHash = fileSha256(candidatePath);
  const attempt = Number(facts?.candidateCount ?? 0) + 1;
  const fileStat = fs.statSync(candidatePath);

  return {
    ok: true,
    payload: {
      order_id: orderId,
      request_key: requestKey,
      attempt,
      file_path: candidatePath,
      file_hash: fileHash,
      refined_prompt: String(metadata.refined_prompt ?? order.brief ?? "").trim(),
      model,
      metadata_path: metadataPath,
      source_kind: String(metadata.source_kind ?? "prepared_asset"),
      placeholder: false,
      file_size_bytes: Number(fileStat.size || 0),
    },
  };
}

export function assessCandidatePayload(candidatePayload, order, runtimeRoot) {
  const payload = candidatePayload && typeof candidatePayload === "object" ? candidatePayload : {};
  const orderId = String(order?.order_id ?? "").trim();
  const expectedKey = expectedRequestKey(order);
  const orderDir = getOrderDir(orderId, runtimeRoot);
  const filePath = String(payload.file_path ?? "");
  const model = String(payload.model ?? "").trim().toLowerCase();
  const issues = [];

  if (!orderId) issues.push("missing_order_id");
  if (String(payload.order_id ?? "") !== orderId) issues.push("order_id_mismatch");
  if (!filePath) issues.push("missing_file_path");
  if (filePath && !fs.existsSync(filePath)) issues.push("file_missing");
  if (filePath && !String(filePath).toLowerCase().endsWith(".png")) issues.push("file_not_png");
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).size <= 0) issues.push("file_empty");
  if (filePath && !isPathInside(orderDir, filePath)) issues.push("file_outside_order_dir");
  if (!payload.request_key || String(payload.request_key) !== expectedKey) issues.push("request_key_mismatch");
  if (payload.placeholder === true) issues.push("placeholder_flagged");
  if (!model || PLACEHOLDER_MODELS.has(model)) issues.push("placeholder_model");

  const metadataPath = String(payload.metadata_path ?? "");
  if (!metadataPath) {
    issues.push("missing_metadata_path");
  } else if (!fs.existsSync(metadataPath)) {
    issues.push("metadata_missing");
  } else if (!isPathInside(orderDir, metadataPath)) {
    issues.push("metadata_outside_order_dir");
  }

  return {
    ok: issues.length === 0,
    issues,
    expected_request_key: expectedKey,
  };
}
