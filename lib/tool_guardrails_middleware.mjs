/**
 * Tool Sandbox & Guardrails Middleware for Dizzy Runtime.
 *
 * Provides:
 * 1. Trust-zone capability enforcement and tool allowlists/denylists.
 * 2. Input/Argument Guardrails: Path traversal blocking, prompt injection defense, and PII masking.
 * 3. Output Guardrails: Untrusted content neutralization, PII scrubbing, and byte/character clamping.
 * 4. Mechanical Resource Limits: Timeout clamping and output truncation.
 * 5. Verifiable Cryptographic Receipts: Schema dizzy.tool_guardrail_receipt.v1 with SHA-256 digests.
 */

import crypto from "node:crypto";
import { sanitizeUntrustedInput } from "./janitor.mjs";
import { CONSISTENCY_CLASSES } from "./consistency_boundary.mjs";

export const TOOL_GUARDRAIL_RECEIPT_SCHEMA = "dizzy.tool_guardrail_receipt.v1";

export const TOOL_ZONE_POLICIES = Object.freeze({
  paid_public: Object.freeze({
    allowed_tools: Object.freeze(["http_get", "cheerio_extract"]),
    denied_tools: Object.freeze(["read_contract", "exec", "eval", "shell", "file_read", "file_write"]),
    max_timeout_ms: 8000,
    max_output_chars: 10000,
    strict_prompt_injection_defense: true,
    pii_masking: true,
    allow_private_network: false,
    allow_localhost: false,
  }),
  normal: Object.freeze({
    allowed_tools: Object.freeze(["http_get", "cheerio_extract", "read_contract"]),
    denied_tools: Object.freeze(["exec", "eval", "shell"]),
    max_timeout_ms: 15000,
    max_output_chars: 50000,
    strict_prompt_injection_defense: false,
    pii_masking: true,
    allow_private_network: false,
    allow_localhost: false,
  }),
  operator: Object.freeze({
    allowed_tools: Object.freeze(["*"]),
    denied_tools: Object.freeze([]),
    max_timeout_ms: 30000,
    max_output_chars: 200000,
    strict_prompt_injection_defense: false,
    pii_masking: false,
    allow_private_network: true,
    allow_localhost: true,
  }),
  private_self: Object.freeze({
    allowed_tools: Object.freeze(["*"]),
    denied_tools: Object.freeze([]),
    max_timeout_ms: 30000,
    max_output_chars: 200000,
    strict_prompt_injection_defense: false,
    pii_masking: false,
    allow_private_network: true,
    allow_localhost: true,
  }),
  offline_test: Object.freeze({
    allowed_tools: Object.freeze(["*"]),
    denied_tools: Object.freeze([]),
    max_timeout_ms: 10000,
    max_output_chars: 50000,
    strict_prompt_injection_defense: true,
    pii_masking: true,
    allow_private_network: true,
    allow_localhost: true,
  }),
});

const PII_PATTERNS = [
  { name: "EMAIL", regex: /\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b/g, replacement: "[REDACTED_EMAIL]" },
  { name: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED_SSN]" },
  { name: "CREDIT_CARD", regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: "[REDACTED_CARD]" },
  { name: "BEARER_TOKEN", regex: /\bBearer\s+[A-Za-z0-9_\-\.]{20,}\b/g, replacement: "Bearer [REDACTED_TOKEN]" },
  { name: "PRIVATE_KEY_PEM", regex: /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9_-]*PRIVATE KEY-----/g, replacement: "[REDACTED_PRIVATE_KEY]" },
  { name: "HEX_PRIVATE_KEY", regex: /\b0x[a-fA-F0-9]{64}\b/g, replacement: "0x[REDACTED_HEX_KEY]" },
];

const TRAVERSAL_PATTERNS = [
  /\.\.[\/\\]/, // ../ or ..\
  /[\/\\]\.\.$/, // trailing /.. or \..
];

function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Scrub PII from a string value.
 */
export function scrubPii(text) {
  if (typeof text !== "string") return { text, count: 0 };
  let count = 0;
  let current = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    const matches = current.match(regex);
    if (matches && matches.length > 0) {
      count += matches.length;
      current = current.replace(regex, replacement);
    }
  }
  return { text: current, count };
}

/**
 * Resolve zone policy with fallback to normal.
 */
export function resolveZonePolicy(trustZone) {
  return TOOL_ZONE_POLICIES[trustZone] || TOOL_ZONE_POLICIES.normal;
}

/**
 * Checks if a tool is permitted in the designated trust zone.
 */
export function isToolAllowedInZone(toolName, trustZone) {
  const policy = resolveZonePolicy(trustZone);
  if (policy.denied_tools.includes(toolName)) return false;
  if (policy.allowed_tools.includes("*")) return true;
  return policy.allowed_tools.includes(toolName);
}

/**
 * Deeply sanitizes and inspects input arguments.
 */
export function inspectAndSanitizeInput(toolName, rawPayload = {}, opts = {}) {
  const trustZone = opts.trustZone || "normal";
  const policy = resolveZonePolicy(trustZone);

  // 1. Tool authorization check
  if (!isToolAllowedInZone(toolName, trustZone)) {
    return {
      ok: false,
      status: "BLOCKED",
      block_reason: `tool_not_permitted_in_zone: tool '${toolName}' is forbidden in trust zone '${trustZone}'`,
      sanitized_payload: null,
      injections_detected: 0,
      pii_redactions_count: 0,
      timeout_ms: 0,
      resource_clamped: false,
    };
  }

  let injectionsDetected = 0;
  let piiRedactionsCount = 0;
  let traversalDetected = false;

  function processValue(val, key = "") {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") {
      // Check path traversal if key implies path/file
      if (/(path|file|dir|location|dest|src)/i.test(key)) {
        for (const pat of TRAVERSAL_PATTERNS) {
          if (pat.test(val)) {
            traversalDetected = true;
          }
        }
      }

      // Check injection
      const { sanitized, flagged } = sanitizeUntrustedInput(val);
      if (flagged) {
        injectionsDetected += 1;
        if (policy.strict_prompt_injection_defense) {
          return null; // Will trigger block below
        }
      }

      // Scrub PII if configured
      let cleaned = flagged ? sanitized : val;
      if (policy.pii_masking) {
        const piiResult = scrubPii(cleaned);
        cleaned = piiResult.text;
        piiRedactionsCount += piiResult.count;
      }
      return cleaned;
    }
    if (Array.isArray(val)) {
      return val.map((item) => processValue(item, key));
    }
    if (typeof val === "object") {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = processValue(v, k);
      }
      return out;
    }
    return val;
  }

  const sanitizedPayload = processValue(rawPayload);

  // Rejection check 1: Traversal
  if (traversalDetected) {
    return {
      ok: false,
      status: "BLOCKED",
      block_reason: "path_traversal_attempt_detected: arguments contain prohibited relative path navigation",
      sanitized_payload: null,
      injections_detected: injectionsDetected,
      pii_redactions_count: piiRedactionsCount,
      timeout_ms: 0,
      resource_clamped: false,
    };
  }

  // Rejection check 2: Strict injection
  if (policy.strict_prompt_injection_defense && injectionsDetected > 0) {
    return {
      ok: false,
      status: "BLOCKED",
      block_reason: "prompt_injection_detected: input arguments match quarantined instruction-override patterns",
      sanitized_payload: null,
      injections_detected: injectionsDetected,
      pii_redactions_count: piiRedactionsCount,
      timeout_ms: 0,
      resource_clamped: false,
    };
  }

  // Resource Limit: Clamp timeoutMs
  const requestedTimeout = Number(rawPayload.timeoutMs || rawPayload.timeout || 15000);
  const clampedTimeout = Math.min(
    Math.max(100, Number.isFinite(requestedTimeout) ? requestedTimeout : 15000),
    policy.max_timeout_ms
  );
  const resourceClamped = clampedTimeout !== requestedTimeout;

  sanitizedPayload.timeoutMs = clampedTimeout;

  return {
    ok: true,
    status: injectionsDetected > 0 || piiRedactionsCount > 0 ? "SANITIZED" : "PASSED",
    block_reason: null,
    sanitized_payload: sanitizedPayload,
    injections_detected: injectionsDetected,
    pii_redactions_count: piiRedactionsCount,
    timeout_ms: clampedTimeout,
    resource_clamped: resourceClamped,
  };
}

/**
 * Deeply sanitizes and bounds output results.
 */
export function inspectAndSanitizeOutput(rawResult, opts = {}) {
  const trustZone = opts.trustZone || "normal";
  const policy = resolveZonePolicy(trustZone);

  let piiRedactionsCount = 0;
  let injectionsDetected = 0;
  let resourceClamped = false;

  function processValue(val) {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") {
      let str = val;
      // In untrusted fetch results, check for indirect injection triggers
      if (opts.toolName === "cheerio_extract" || opts.toolName === "http_get") {
        const { sanitized, flagged } = sanitizeUntrustedInput(str);
        if (flagged) {
          injectionsDetected += 1;
          str = sanitized;
        }
      }
      if (policy.pii_masking) {
        const pii = scrubPii(str);
        str = pii.text;
        piiRedactionsCount += pii.count;
      }
      // Output byte/char clamping
      if (str.length > policy.max_output_chars) {
        resourceClamped = true;
        str = str.slice(0, policy.max_output_chars) + "\n...[TRUNCATED BY TOOL GUARDRAILS BUFFER CLAMP]";
      }
      return str;
    }
    if (Array.isArray(val)) {
      return val.map((item) => processValue(item));
    }
    if (typeof val === "object") {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = processValue(v);
      }
      return out;
    }
    return val;
  }

  const sanitizedResult = processValue(rawResult);

  return {
    sanitized_result: sanitizedResult,
    pii_redactions_count: piiRedactionsCount,
    injections_detected: injectionsDetected,
    resource_clamped: resourceClamped,
  };
}

/**
 * Creates a deterministic, cryptographically signed tool guardrail execution receipt.
 */
export function createToolGuardrailReceipt({
  toolName,
  actorId = "tool_runner",
  sessionId = "inline",
  trustZone = "normal",
  inputPayload = {},
  outputResult = null,
  status = "PASSED",
  blockReason = null,
  injectionsDetected = 0,
  piiRedactionsCount = 0,
  resourceClamped = false,
  durationMs = 0,
  errorMessage = null,
}) {
  const receiptId = `tg_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const inputSha = sha256Hex(stableJson(inputPayload));
  const outputSha = sha256Hex(stableJson(outputResult));

  const payloadToSign = {
    schema: TOOL_GUARDRAIL_RECEIPT_SCHEMA,
    receipt_id: receiptId,
    timestamp: new Date().toISOString(),
    tool_name: String(toolName || "unknown"),
    actor_id: String(actorId),
    session_id: String(sessionId),
    trust_zone: String(trustZone),
    status: String(status),
    block_reason: blockReason ? String(blockReason) : null,
    error_message: errorMessage ? String(errorMessage) : null,
    input_sha256: inputSha,
    output_sha256: outputSha,
    injections_detected: Number(injectionsDetected || 0),
    pii_redactions_count: Number(piiRedactionsCount || 0),
    resource_clamped: Boolean(resourceClamped),
    duration_ms: Math.max(0, Math.floor(durationMs || 0)),
    consistency_class: CONSISTENCY_CLASSES.LOCAL_RECEIPT_VERIFIED,
  };

  const receiptSha = sha256Hex(stableJson(payloadToSign));

  return Object.freeze({
    ...payloadToSign,
    receipt_sha256: receiptSha,
  });
}

/**
 * Validates cryptographic integrity of a tool guardrail receipt.
 */
export function verifyToolGuardrailReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") return false;
  if (receipt.schema !== TOOL_GUARDRAIL_RECEIPT_SCHEMA) return false;
  if (!receipt.receipt_sha256) return false;

  const { receipt_sha256, ...coreFields } = receipt;
  const computedSha = sha256Hex(stableJson(coreFields));
  return computedSha === receipt_sha256;
}

/**
 * Higher-order runner executing a tool function under guardrail middleware.
 *
 * @param {object} job - The job envelope { id, tool, payload, trustZone }
 * @param {function} runFn - The underlying tool execution function (e.g. runToolJobUnchecked)
 * @param {object} opts - Additional execution context { actorId, sessionId, trustZone }
 * @returns {Promise<{ result: any, receipt: object }>}
 */
export async function executeGuardedToolJob(job, runFn, opts = {}) {
  const toolName = job?.tool;
  const rawPayload = job?.payload || {};
  const trustZone = job?.trustZone || opts.trustZone || "normal";
  const actorId = opts.actorId || "tool_runner";
  const sessionId = opts.sessionId || `tool_${job?.id || "inline"}`;

  const startTime = Date.now();

  // 1. Input Inspection & Sanitization Barrier
  const inputCheck = inspectAndSanitizeInput(toolName, rawPayload, { trustZone });

  if (!inputCheck.ok) {
    const receipt = createToolGuardrailReceipt({
      toolName,
      actorId,
      sessionId,
      trustZone,
      inputPayload: rawPayload,
      outputResult: null,
      status: inputCheck.status,
      blockReason: inputCheck.block_reason,
      injectionsDetected: inputCheck.injections_detected,
      piiRedactionsCount: inputCheck.pii_redactions_count,
      resourceClamped: inputCheck.resource_clamped,
      durationMs: Date.now() - startTime,
    });

    const err = new Error(`Tool execution blocked by guardrails: ${inputCheck.block_reason}`);
    err.status = 403;
    err.receipt = receipt;
    throw err;
  }

  // 2. Underlying Execution Barrier
  let rawResult;
  let executionError = null;
  const activeJob = {
    ...job,
    payload: inputCheck.sanitized_payload,
  };

  try {
    rawResult = await runFn(activeJob);
  } catch (err) {
    executionError = err;
  }

  const durationMs = Date.now() - startTime;

  if (executionError) {
    const receipt = createToolGuardrailReceipt({
      toolName,
      actorId,
      sessionId,
      trustZone,
      inputPayload: inputCheck.sanitized_payload,
      outputResult: null,
      status: "EXECUTION_FAILED",
      blockReason: null,
      injectionsDetected: inputCheck.injections_detected,
      piiRedactionsCount: inputCheck.pii_redactions_count,
      resourceClamped: inputCheck.resource_clamped,
      durationMs,
      errorMessage: executionError.message,
    });
    executionError.receipt = receipt;
    throw executionError;
  }

  // 3. Output Inspection & Sanitization Barrier
  const outputCheck = inspectAndSanitizeOutput(rawResult, {
    trustZone,
    toolName,
  });

  const finalStatus =
    inputCheck.status === "SANITIZED" ||
    outputCheck.injections_detected > 0 ||
    outputCheck.pii_redactions_count > 0
      ? "SANITIZED"
      : "PASSED";

  const receipt = createToolGuardrailReceipt({
    toolName,
    actorId,
    sessionId,
    trustZone,
    inputPayload: inputCheck.sanitized_payload,
    outputResult: outputCheck.sanitized_result,
    status: finalStatus,
    blockReason: null,
    injectionsDetected: inputCheck.injections_detected + outputCheck.injections_detected,
    piiRedactionsCount: inputCheck.pii_redactions_count + outputCheck.pii_redactions_count,
    resourceClamped: inputCheck.resource_clamped || outputCheck.resource_clamped,
    durationMs,
  });

  return {
    result: outputCheck.sanitized_result,
    receipt,
  };
}
