import crypto from "node:crypto";

export const NODE_PYTHON_BRIDGE_REQUEST_SCHEMA = "dizzy.node_python_council_bridge.request.v1";
export const NODE_PYTHON_BRIDGE_RESPONSE_SCHEMA = "dizzy.node_python_council_bridge.response.v1";
export const NODE_PYTHON_BRIDGE_CONTRACT_RECEIPT_SCHEMA = "dizzy.node_python_council_bridge_contract.v1";
export const BRIDGE_CANONICALIZATION = "dizzy.stable_json.sort_keys.no_whitespace.v1";

export const VALID_REQUEST_RECEIPT_AUTHORITIES = Object.freeze([
  "advisory_receipt",
  "rehearsal_receipt",
]);

export const VALID_RESPONSE_RECEIPT_AUTHORITIES = Object.freeze([
  "rehearsal_receipt",
]);

const LOWER_SHA256_RE = /^[a-f0-9]{64}$/;
const SHA256_RE = /^[A-Fa-f0-9]{64}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

export function normalizeStableJsonValue(value, path = "$", seen = new WeakSet()) {
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeStableJsonValue(item, `${path}[${index}]`, seen));
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") return value;
  if (valueType === "number") {
    if (!Number.isFinite(value)) throw new Error(`Cannot canonicalize non-finite number at ${path}`);
    return value;
  }
  if (valueType === "object") {
    if (seen.has(value)) throw new Error(`Cannot canonicalize cyclic object at ${path}`);
    seen.add(value);
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      const childType = typeof child;
      if (childType === "undefined" || childType === "function" || childType === "symbol") {
        throw new Error(`Cannot canonicalize unsupported value at ${path}.${key}`);
      }
      normalized[key] = normalizeStableJsonValue(child, `${path}.${key}`, seen);
    }
    seen.delete(value);
    return normalized;
  }

  throw new Error(`Cannot canonicalize unsupported ${valueType} at ${path}`);
}

export function stableJson(value) {
  return JSON.stringify(normalizeStableJsonValue(value));
}

export function sha256HexLower(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

export function canonicalBridgePayloadSha256(payload) {
  return sha256HexLower(stableJson(payload));
}

function collectSafePathErrors(errors, paths, basePath) {
  if (!Array.isArray(paths)) {
    addError(errors, "INVALID_TARGET_FILES", basePath, "target files must be an array");
    return;
  }
  for (const [index, filePath] of paths.entries()) {
    const raw = String(filePath || "");
    if (!raw || raw.length > 260) {
      addError(errors, "INVALID_TARGET_FILE", `${basePath}[${index}]`, "target file must be non-empty and under 260 characters");
    }
    if (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith("/") || raw.startsWith("\\") || raw.includes("\\") || raw.includes("..")) {
      addError(errors, "UNSAFE_TARGET_FILE", `${basePath}[${index}]`, "target file must stay a normalized relative POSIX path");
    }
  }
}

function requireBoundary(list, boundary, errors, path) {
  if (!Array.isArray(list) || !list.includes(boundary)) {
    addError(errors, "MISSING_PROOF_BOUNDARY", path, `required proof boundary '${boundary}' is missing`);
  }
}

export function collectBridgeRequestErrors(request) {
  const errors = [];
  if (!isPlainObject(request)) {
    addError(errors, "INVALID_REQUEST", "$", "bridge request must be a JSON object");
    return errors;
  }

  if (request.schema_version !== NODE_PYTHON_BRIDGE_REQUEST_SCHEMA) {
    addError(errors, "INVALID_REQUEST_SCHEMA", "$.schema_version", `expected ${NODE_PYTHON_BRIDGE_REQUEST_SCHEMA}`);
  }
  if (request.source_runtime !== "node_mjs") {
    addError(errors, "INVALID_SOURCE_RUNTIME", "$.source_runtime", "source runtime must be node_mjs");
  }
  if (request.target_runtime !== "python_council_sidecar") {
    addError(errors, "INVALID_TARGET_RUNTIME", "$.target_runtime", "target runtime must be python_council_sidecar");
  }

  const authority = request.authority;
  if (!isPlainObject(authority)) {
    addError(errors, "MISSING_AUTHORITY", "$.authority", "authority block is required");
  } else {
    const requested = String(authority.requested_receipt_authority || "");
    if (!VALID_REQUEST_RECEIPT_AUTHORITIES.includes(requested)) {
      const code = requested === "promotion_receipt" || requested === "public_claim_receipt"
        ? "UNSAFE_REQUESTED_RECEIPT_AUTHORITY"
        : "INVALID_REQUESTED_RECEIPT_AUTHORITY";
      addError(errors, code, "$.authority.requested_receipt_authority", "bridge requests may ask only for advisory or rehearsal authority");
    }
    if (authority.runtime_promotion_allowed !== false) {
      addError(errors, "RUNTIME_PROMOTION_NOT_ALLOWED", "$.authority.runtime_promotion_allowed", "request must not allow runtime promotion");
    }
    if (authority.public_claim_allowed !== false) {
      addError(errors, "PUBLIC_CLAIM_NOT_ALLOWED", "$.authority.public_claim_allowed", "request must not allow public claims");
    }
  }

  const payload = request.payload;
  const bountyTask = isPlainObject(payload) ? payload.bounty_task : null;
  const bridgeHash = request.integrity?.payload_sha256;

  if (!isPlainObject(request.integrity)) {
    addError(errors, "MISSING_INTEGRITY", "$.integrity", "bridge integrity block is required");
    if (bountyTask?.payload_sha256) {
      addError(
        errors,
        "LEGACY_HASH_SCOPE_OVERLOAD",
        "$.payload.bounty_task.payload_sha256",
        "task-level payload_sha256 cannot replace the full bridge payload hash"
      );
    }
  } else {
    if (request.integrity.canonicalization !== BRIDGE_CANONICALIZATION) {
      addError(errors, "INVALID_CANONICALIZATION", "$.integrity.canonicalization", `expected ${BRIDGE_CANONICALIZATION}`);
    }
    if (!LOWER_SHA256_RE.test(String(bridgeHash || ""))) {
      addError(errors, "INVALID_BRIDGE_PAYLOAD_SHA256", "$.integrity.payload_sha256", "bridge payload hash must be lowercase SHA-256 hex");
    }
  }

  if (!isPlainObject(payload)) {
    addError(errors, "MISSING_PAYLOAD", "$.payload", "bridge request payload is required");
    return errors;
  }
  if (payload.schema_version !== "dizzy.bounty_a2a_ingest.v1") {
    addError(errors, "INVALID_PAYLOAD_SCHEMA", "$.payload.schema_version", "payload must be a dizzy.bounty_a2a_ingest.v1 object");
  }
  if (!isPlainObject(bountyTask)) {
    addError(errors, "MISSING_BOUNTY_TASK", "$.payload.bounty_task", "payload must include bounty_task");
  } else {
    if (bountyTask.schema_version !== "dizzy.bounty_task.v1") {
      addError(errors, "INVALID_BOUNTY_TASK_SCHEMA", "$.payload.bounty_task.schema_version", "bounty_task must be dizzy.bounty_task.v1");
    }
    if (!SHA256_RE.test(String(bountyTask.payload_sha256 || ""))) {
      addError(errors, "INVALID_BOUNTY_TASK_SHA256", "$.payload.bounty_task.payload_sha256", "bounty task hash must be SHA-256 hex");
    }
    if (LOWER_SHA256_RE.test(String(bridgeHash || "")) && String(bountyTask.payload_sha256 || "").toLowerCase() === bridgeHash) {
      addError(errors, "HASH_SCOPE_COLLISION", "$.payload.bounty_task.payload_sha256", "task digest must remain distinct from the full bridge payload digest");
    }
    collectSafePathErrors(errors, bountyTask.target_files, "$.payload.bounty_task.target_files");
  }

  requireBoundary(payload.proof_boundaries, "sidecar_rehearsal_is_not_runtime_promotion", errors, "$.payload.proof_boundaries");
  requireBoundary(payload.proof_boundaries, "bridge_payload_hash_lives_in_integrity_payload_sha256", errors, "$.payload.proof_boundaries");
  requireBoundary(payload.proof_boundaries, "bounty_task_payload_sha256_remains_task_digest", errors, "$.payload.proof_boundaries");

  if (LOWER_SHA256_RE.test(String(bridgeHash || ""))) {
    try {
      const actualHash = canonicalBridgePayloadSha256(payload);
      if (actualHash !== bridgeHash) {
        addError(errors, "PAYLOAD_SHA256_MISMATCH", "$.integrity.payload_sha256", "claimed bridge payload hash does not match canonical payload");
      }
    } catch (error) {
      addError(errors, "PAYLOAD_NOT_CANONICALIZABLE", "$.payload", error.message);
    }
  }

  return errors;
}

export function validateBridgeRequest(request) {
  const errors = collectBridgeRequestErrors(request);
  let actualPayloadSha256 = null;
  if (isPlainObject(request?.payload)) {
    try {
      actualPayloadSha256 = canonicalBridgePayloadSha256(request.payload);
    } catch {
      actualPayloadSha256 = null;
    }
  }
  return {
    schema_version: NODE_PYTHON_BRIDGE_CONTRACT_RECEIPT_SCHEMA,
    target_schema: NODE_PYTHON_BRIDGE_REQUEST_SCHEMA,
    ok: errors.length === 0,
    status: errors.length === 0 ? "VALID_BRIDGE_REQUEST" : "INVALID_BRIDGE_REQUEST",
    actual_payload_sha256: actualPayloadSha256,
    errors,
  };
}

export function collectBridgeResponseErrors(response, request = null) {
  const errors = [];
  if (!isPlainObject(response)) {
    addError(errors, "INVALID_RESPONSE", "$", "bridge response must be a JSON object");
    return errors;
  }
  if (response.schema_version !== NODE_PYTHON_BRIDGE_RESPONSE_SCHEMA) {
    addError(errors, "INVALID_RESPONSE_SCHEMA", "$.schema_version", `expected ${NODE_PYTHON_BRIDGE_RESPONSE_SCHEMA}`);
  }
  if (!["VERIFIED_DISPATCH", "REJECTED_TAMPER", "REJECTED_SCHEMA"].includes(response.status)) {
    addError(errors, "INVALID_RESPONSE_STATUS", "$.status", "response status is not allowed");
  }
  if (!VALID_RESPONSE_RECEIPT_AUTHORITIES.includes(response.receipt_authority)) {
    const code = response.receipt_authority === "promotion_receipt" || response.receipt_authority === "public_claim_receipt"
      ? "UNSAFE_RESPONSE_RECEIPT_AUTHORITY"
      : "INVALID_RESPONSE_RECEIPT_AUTHORITY";
    addError(errors, code, "$.receipt_authority", "sidecar responses may carry rehearsal authority only");
  }
  if (response.runtime_promotion_allowed !== false) {
    addError(errors, "RUNTIME_PROMOTION_NOT_ALLOWED", "$.runtime_promotion_allowed", "sidecar response must not allow runtime promotion");
  }
  if (response.public_claim_allowed !== false) {
    addError(errors, "PUBLIC_CLAIM_NOT_ALLOWED", "$.public_claim_allowed", "sidecar response must not allow public claims");
  }
  if (response.promotion_receipt_required !== true) {
    addError(errors, "PROMOTION_RECEIPT_REQUIRED", "$.promotion_receipt_required", "response must require a later Node promotion receipt");
  }
  if (!response.assigned_lane || typeof response.assigned_lane !== "string") {
    addError(errors, "MISSING_ASSIGNED_LANE", "$.assigned_lane", "response must include assigned_lane");
  }
  collectSafePathErrors(errors, response.sanitized_target_files, "$.sanitized_target_files");

  const expectedHash = request?.integrity?.payload_sha256 || null;
  if (!LOWER_SHA256_RE.test(String(response.request_payload_sha256 || ""))) {
    addError(errors, "INVALID_RESPONSE_PAYLOAD_SHA256", "$.request_payload_sha256", "response request hash must be lowercase SHA-256 hex");
  } else if (expectedHash && response.request_payload_sha256 !== expectedHash) {
    addError(errors, "RESPONSE_PAYLOAD_SHA256_MISMATCH", "$.request_payload_sha256", "response hash must bind back to request integrity hash");
  }

  return errors;
}

export function validateBridgeResponse(response, request = null) {
  const errors = collectBridgeResponseErrors(response, request);
  return {
    schema_version: NODE_PYTHON_BRIDGE_CONTRACT_RECEIPT_SCHEMA,
    target_schema: NODE_PYTHON_BRIDGE_RESPONSE_SCHEMA,
    ok: errors.length === 0,
    status: errors.length === 0 ? "VALID_BRIDGE_RESPONSE" : "INVALID_BRIDGE_RESPONSE",
    errors,
  };
}
