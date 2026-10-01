/**
 * Inter-Agent Sanitization & Permission Scoping Proxy
 *
 * Implements strict security mediation between autonomous agent processes:
 * - Scopes permitted message types, action boundaries, and trust zones per agent pair
 * - Blocks privilege escalation from lower-trust agents to high-privilege endpoints
 * - Enforces bidirectional PII/secret scrubbing and indirect prompt injection defense
 * - Clamps payload byte sizes to prevent buffer exhaustion and memory pressure
 * - Emits cryptographic InterAgentProxyReceipts
 *
 * Schema: dizzy.inter_agent_proxy_receipt.v1
 * Authority: Security invariant proxy mediating all inter-agent traffic.
 */

import crypto from "node:crypto";
import { scrubPii } from "./tool_guardrails_middleware.mjs";

export const INTER_AGENT_PROXY_RECEIPT_SCHEMA = "dizzy.inter_agent_proxy_receipt.v1";

const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB

export const AGENT_ROLE_POLICIES = Object.freeze({
  core_runtime: Object.freeze({
    trust_zone: "private_self",
    allowed_message_types: Object.freeze(["*"]),
    disallowed_actions: Object.freeze([]),
    max_payload_bytes: 128 * 1024,
    can_escalate_hitl: true,
  }),
  internal_collaborator: Object.freeze({
    trust_zone: "trusted_collaborator",
    allowed_message_types: Object.freeze([
      "memory_update",
      "review_request",
      "review_response",
      "bounty_triage",
      "status_check",
      "status_response",
      "trajectory_hop",
    ]),
    disallowed_actions: Object.freeze([
      "fiduciary_release",
      "override_consistency_boundary",
      "execute_shell",
      "wipe_memory",
    ]),
    max_payload_bytes: 64 * 1024,
    can_escalate_hitl: false,
  }),
  external_peer: Object.freeze({
    trust_zone: "outside_contact",
    allowed_message_types: Object.freeze([
      "status_check",
      "status_response",
      "bounty_inquiry",
    ]),
    disallowed_actions: Object.freeze([
      "fiduciary_release",
      "override_consistency_boundary",
      "execute_shell",
      "wipe_memory",
      "memory_update",
      "internal_route_access",
    ]),
    max_payload_bytes: 16 * 1024,
    can_escalate_hitl: false,
  }),
});

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+rules/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /bypass\s+safety\s+filter/i,
  /dump\s+all\s+(system\s+)?prompts/i,
  /<\|system\|>/i,
  /<\|im_start\|>/i,
  /\[INST\]/i,
  /<<SYS>>/i,
];

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

function sanitizeText(str) {
  if (typeof str !== "string") return { text: str, injectionsNeutralized: 0, piiCount: 0 };

  let text = str;
  let injectionsNeutralized = 0;

  // 1. Neutralize injection triggers
  for (const pat of INJECTION_PATTERNS) {
    if (pat.test(text)) {
      injectionsNeutralized += 1;
      text = text.replace(pat, "[NEUTRALIZED_PROMPT_INJECTION]");
    }
  }

  // 2. Scrub PII / Secrets
  const piiRes = scrubPii(text);
  text = piiRes.text;

  return {
    text,
    injectionsNeutralized,
    piiCount: piiRes.count,
  };
}

function deepSanitize(val) {
  if (val === null || val === undefined) {
    return { val, injectionsNeutralized: 0, piiCount: 0 };
  }
  if (typeof val === "string") {
    const res = sanitizeText(val);
    return { val: res.text, injectionsNeutralized: res.injectionsNeutralized, piiCount: res.piiCount };
  }
  if (Array.isArray(val)) {
    let inj = 0;
    let pii = 0;
    const arr = val.map((item) => {
      const res = deepSanitize(item);
      inj += res.injectionsNeutralized;
      pii += res.piiCount;
      return res.val;
    });
    return { val: arr, injectionsNeutralized: inj, piiCount: pii };
  }
  if (typeof val === "object") {
    let inj = 0;
    let pii = 0;
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      const res = deepSanitize(v);
      inj += res.injectionsNeutralized;
      pii += res.piiCount;
      out[k] = res.val;
    }
    return { val: out, injectionsNeutralized: inj, piiCount: pii };
  }
  return { val, injectionsNeutralized: 0, piiCount: 0 };
}

export class InterAgentSanitizationProxy {
  constructor(opts = {}) {
    this.policies = { ...AGENT_ROLE_POLICIES, ...(opts.policies || {}) };
    this.now = opts.now || (() => new Date());
    this.defaultMaxPayloadBytes = opts.defaultMaxPayloadBytes || DEFAULT_MAX_PAYLOAD_BYTES;
  }

  resolveSenderPolicy(senderRole = "internal_collaborator") {
    return this.policies[senderRole] || this.policies.internal_collaborator;
  }

  proxyRelayMessage({
    fromAgent = "agent_unknown",
    toAgent = "agent_unknown",
    senderRole = "internal_collaborator",
    messageType,
    payload = {},
    actionRequested = null,
    now = null,
  } = {}) {
    const timestamp = (now || this.now)();
    const timestampIso = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();

    const policy = this.resolveSenderPolicy(senderRole);
    const originalJson = stableJson(payload);
    const originalHash = sha256Hex(originalJson);
    const byteLength = Buffer.byteLength(originalJson, "utf8");

    // 1. Byte length enforcement
    const maxBytes = policy.max_payload_bytes || this.defaultMaxPayloadBytes;
    if (byteLength > maxBytes) {
      return this._reject({
        fromAgent,
        toAgent,
        senderRole,
        messageType,
        actionRequested,
        byteLength,
        originalHash,
        timestampIso,
        status: "BLOCKED",
        reason: `payload_byte_limit_exceeded: ${byteLength} bytes exceeds policy limit of ${maxBytes} bytes`,
      });
    }

    // 2. Message type scoping
    const isWildcard = policy.allowed_message_types.includes("*");
    if (!isWildcard && !policy.allowed_message_types.includes(messageType)) {
      return this._reject({
        fromAgent,
        toAgent,
        senderRole,
        messageType,
        actionRequested,
        byteLength,
        originalHash,
        timestampIso,
        status: "BLOCKED",
        reason: `disallowed_message_type: '${messageType}' is not permitted for sender role '${senderRole}'`,
      });
    }

    // 3. Action privilege boundary check
    if (actionRequested && policy.disallowed_actions.includes(actionRequested)) {
      return this._reject({
        fromAgent,
        toAgent,
        senderRole,
        messageType,
        actionRequested,
        byteLength,
        originalHash,
        timestampIso,
        status: "BLOCKED",
        reason: `privilege_escalation_blocked: action '${actionRequested}' is forbidden for sender role '${senderRole}'`,
      });
    }

    // 4. Bidirectional Sanitization
    const sanitizeResult = deepSanitize(payload);
    const relayedJson = stableJson(sanitizeResult.val);
    const relayedHash = sha256Hex(relayedJson);

    const wasSanitized = sanitizeResult.injectionsNeutralized > 0 || sanitizeResult.piiCount > 0;
    const finalStatus = wasSanitized ? "SANITIZED_RELAYED" : "RELAYED";

    const receiptPayload = {
      schema_version: INTER_AGENT_PROXY_RECEIPT_SCHEMA,
      timestamp: timestampIso,
      status: finalStatus,
      from_agent: fromAgent,
      to_agent: toAgent,
      sender_role: senderRole,
      message_type: messageType,
      action_requested: actionRequested || null,
      byte_length: byteLength,
      injections_neutralized: sanitizeResult.injectionsNeutralized,
      pii_redactions_count: sanitizeResult.piiCount,
      original_payload_sha256: originalHash,
      relayed_payload_sha256: relayedHash,
      block_reason: null,
    };

    const evidenceSha256 = sha256Hex(stableJson(receiptPayload));
    const receipt = Object.freeze({
      ...receiptPayload,
      evidence_sha256: evidenceSha256,
    });

    return {
      ok: true,
      status: finalStatus,
      relayed_payload: sanitizeResult.val,
      receipt,
    };
  }

  _reject({ fromAgent, toAgent, senderRole, messageType, actionRequested, originalHash, byteLength = 0, timestampIso, status, reason }) {
    const receiptPayload = {
      schema_version: INTER_AGENT_PROXY_RECEIPT_SCHEMA,
      timestamp: timestampIso,
      status,
      from_agent: fromAgent,
      to_agent: toAgent,
      sender_role: senderRole || null,
      message_type: messageType,
      action_requested: actionRequested || null,
      byte_length: byteLength,
      injections_neutralized: 0,
      pii_redactions_count: 0,
      original_payload_sha256: originalHash,
      relayed_payload_sha256: null,
      block_reason: reason,
    };

    const evidenceSha256 = sha256Hex(stableJson(receiptPayload));
    const receipt = Object.freeze({
      ...receiptPayload,
      evidence_sha256: evidenceSha256,
    });

    return {
      ok: false,
      status,
      error: reason,
      receipt,
    };
  }
}

export function verifyInterAgentProxyReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") return false;
  if (receipt.schema_version !== INTER_AGENT_PROXY_RECEIPT_SCHEMA) return false;
  const { evidence_sha256, ...payload } = receipt;
  if (!evidence_sha256) return false;
  const expectedHash = sha256Hex(stableJson(payload));
  return evidence_sha256 === expectedHash;
}
