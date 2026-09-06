import crypto from "node:crypto";
import { Ed25519TrustStore, normalizeEd25519PublicKey, sanitizePromptInjection } from "./a2a_boundary_guard.mjs";

export const A2A_MESSAGE_SCHEMA = "dizzy.a2a_message.v1";
export const A2A_HANDOFF_SCHEMA = "dizzy.a2a_handoff.v1";
export const A2A_MAILBOX_RECEIPT_SCHEMA = "dizzy.a2a_mailbox_receipt.v1";
export const A2A_SIGNED_ENVELOPE_SCHEMA = "dizzy.a2a_signed_envelope.v1";
export const A2A_DISPATCH_RECEIPT_SCHEMA = "dizzy.a2a_dispatch_receipt.v1";

export const VALID_AGENTS = Object.freeze([
  "antigravity",
  "codex",
  "grok",
  "openclaude",
  "zero",
  "oss_council",
  "subagent_researcher",
  "subagent_executor",
  "operator",
]);

export const VALID_MESSAGE_TYPES = Object.freeze([
  "task_delegation",
  "task_result",
  "council_critique",
  "bounty_alert",
  "heartbeat",
  "handoff_packet",
  "memory_update",
  "reconciliation_delta",
]);

export const VALID_TRUST_ZONES = Object.freeze([
  "private_self",
  "trusted_collaborator",
  "outside_contact",
  "paid_public",
]);

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

/**
 * Creates a validated, tamper-evident A2A message envelope.
 */
export function createA2AMessage({
  id,
  senderId,
  recipientId,
  messageType,
  payload,
  trustZone = "trusted_collaborator",
  priority = "normal",
  parentTaskId = null,
  now = () => new Date(),
} = {}) {
  const safeSender = String(senderId || "").trim().toLowerCase();
  const safeRecipient = String(recipientId || "").trim().toLowerCase();
  const safeType = String(messageType || "").trim().toLowerCase();
  const safeZone = String(trustZone || "trusted_collaborator").trim().toLowerCase();

  if (!safeSender) throw new Error("A2A message requires a non-empty senderId");
  if (!safeRecipient) throw new Error("A2A message requires a non-empty recipientId");
  if (!VALID_MESSAGE_TYPES.includes(safeType)) {
    throw new Error(`Invalid A2A messageType: '${safeType}'. Must be one of: ${VALID_MESSAGE_TYPES.join(", ")}`);
  }
  if (!VALID_TRUST_ZONES.includes(safeZone)) {
    throw new Error(`Invalid A2A trustZone: '${safeZone}'. Must be one of: ${VALID_TRUST_ZONES.join(", ")}`);
  }

  // Zone boundary check: outside_contact cannot carry private memory structures
  if (safeZone === "outside_contact" && payload && typeof payload === "object") {
    if (payload.private_memory || payload.keys || payload.credentials) {
      throw new Error("A2A boundary violation: outside_contact message cannot contain private_memory or credentials");
    }
  }

  const payloadString = JSON.stringify(payload ?? null);
  const payloadSha256 = sha256Hex(payloadString);
  const msgId = id || `a2a_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const timestamp = now().toISOString();

  return {
    schema_version: A2A_MESSAGE_SCHEMA,
    message_id: msgId,
    sender_id: safeSender,
    recipient_id: safeRecipient,
    message_type: safeType,
    trust_zone: safeZone,
    priority: String(priority || "normal").toLowerCase(),
    parent_task_id: parentTaskId ? String(parentTaskId) : null,
    payload: payload ?? null,
    payload_sha256: payloadSha256,
    created_at: timestamp,
  };
}

/**
 * Creates a structured, cryptographic handoff packet between primary agents.
 */
export function createA2AHandoffPacket({
  fromAgent,
  toAgent,
  branch,
  headCommit,
  councilReceiptHash,
  councilReceiptTimestamp,
  activeQueue = [],
  completedQueue = [],
  uncommittedFiles = [],
  notes = "",
  now = () => new Date(),
} = {}) {
  const payload = {
    branch: String(branch || "feat/dizzy-general-distro"),
    head_commit: String(headCommit || "unknown"),
    council_receipt: {
      sha256: String(councilReceiptHash || "unverified"),
      timestamp: councilReceiptTimestamp || now().toISOString(),
    },
    active_queue: Array.isArray(activeQueue) ? activeQueue : [],
    completed_queue: Array.isArray(completedQueue) ? completedQueue : [],
    uncommitted_files: Array.isArray(uncommittedFiles) ? uncommittedFiles : [],
    notes: String(notes || "").trim(),
  };

  const handoffSha256 = sha256Hex(JSON.stringify(payload));

  const envelope = createA2AMessage({
    senderId: fromAgent,
    recipientId: toAgent,
    messageType: "handoff_packet",
    payload,
    trustZone: "trusted_collaborator",
    priority: "high",
    now,
  });

  return {
    schema_version: A2A_HANDOFF_SCHEMA,
    handoff_sha256: handoffSha256,
    message: envelope,
  };
}

/**
 * Canonical signing digest representation for A2A message envelopes.
 */
export function computeA2AEnvelopeSigningData(message, timestamp, nonce) {
  return `${timestamp}:${nonce}:${message.message_id}:${message.sender_id}:${message.recipient_id}:${message.payload_sha256}`;
}

/**
 * Signs an A2AMessage (or inner message of A2AHandoffPacket) with Ed25519 or HMAC-SHA256.
 */
export function signA2AMessageEnvelope(message, {
  algorithm = "ed25519",
  privateKey,
  keyId,
  secretKey,
  nonce,
  now = () => new Date(),
} = {}) {
  if (!message || typeof message !== "object") {
    throw new Error("Cannot sign null or non-object message");
  }
  const targetMessage = message.schema_version === A2A_HANDOFF_SCHEMA ? message.message : message;
  if (!targetMessage || targetMessage.schema_version !== A2A_MESSAGE_SCHEMA) {
    throw new Error(`Cannot sign invalid A2A message: expected schema '${A2A_MESSAGE_SCHEMA}'`);
  }

  const algo = String(algorithm || "ed25519").trim().toLowerCase();
  const timestamp = now().toISOString();
  const safeNonce = String(nonce || crypto.randomBytes(16).toString("hex")).trim();
  const safeKeyId = keyId ? String(keyId).trim() : (algo === "ed25519" ? targetMessage.sender_id : "shared-secret");

  const signingData = computeA2AEnvelopeSigningData(targetMessage, timestamp, safeNonce);
  let detachedSig = null;

  if (algo === "ed25519") {
    if (!privateKey) {
      throw new Error("Ed25519 signing requires privateKey");
    }
    const dataBuf = Buffer.from(signingData, "utf8");
    const sigBuf = crypto.sign(null, dataBuf, privateKey);
    detachedSig = sigBuf.toString("hex");
  } else if (algo === "hmac-sha256") {
    if (!secretKey) {
      throw new Error("HMAC-SHA256 signing requires secretKey");
    }
    const hmac = crypto.createHmac("sha256", String(secretKey).trim());
    hmac.update(signingData, "utf8");
    detachedSig = hmac.digest("hex");
  } else {
    throw new Error(`Unsupported signing algorithm: '${algorithm}'. Supported: ed25519, hmac-sha256`);
  }

  const envelopeId = `env_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  return {
    schema_version: A2A_SIGNED_ENVELOPE_SCHEMA,
    envelope_id: envelopeId,
    message_id: targetMessage.message_id,
    sender_id: targetMessage.sender_id,
    recipient_id: targetMessage.recipient_id,
    signature_algorithm: algo,
    signer_key_id: safeKeyId,
    signed_payload_sha256: targetMessage.payload_sha256,
    detached_signature: detachedSig,
    timestamp,
    nonce: safeNonce,
    message: targetMessage,
  };
}

/**
 * Cryptographically verifies an A2ASignedEnvelope against a trust store or shared secret.
 */
export function verifyA2AMessageEnvelope(envelope, {
  trustStore = null,
  secretKey = null,
  allowedAlgorithms = null,
  maxClockSkewMs = 300_000,
  seenNonces = null,
  now = () => new Date(),
} = {}) {
  if (!envelope || typeof envelope !== "object") {
    return { ok: false, reason: "Envelope must be a non-null object" };
  }
  if (envelope.schema_version !== A2A_SIGNED_ENVELOPE_SCHEMA) {
    return { ok: false, reason: `Invalid envelope schema: '${envelope.schema_version}', expected '${A2A_SIGNED_ENVELOPE_SCHEMA}'` };
  }
  const msg = envelope.message;
  if (!msg || typeof msg !== "object" || msg.schema_version !== A2A_MESSAGE_SCHEMA) {
    return { ok: false, reason: "Envelope does not contain a valid A2A message" };
  }
  if (envelope.sender_id !== msg.sender_id) {
    return { ok: false, reason: "Envelope sender_id does not match inner message sender_id" };
  }
  if (envelope.recipient_id !== msg.recipient_id) {
    return { ok: false, reason: "Envelope recipient_id does not match inner message recipient_id" };
  }
  if (envelope.message_id !== msg.message_id) {
    return { ok: false, reason: "Envelope message_id does not match inner message message_id" };
  }

  // Payload digest integrity check
  const actualPayloadSha256 = sha256Hex(JSON.stringify(msg.payload ?? null));
  if (envelope.signed_payload_sha256 !== actualPayloadSha256 || msg.payload_sha256 !== actualPayloadSha256) {
    return { ok: false, reason: "Payload digest mismatch: message payload has been altered" };
  }

  // Timestamp and clock skew
  const envelopeTime = new Date(envelope.timestamp).getTime();
  if (Number.isNaN(envelopeTime)) {
    return { ok: false, reason: "Invalid envelope timestamp format" };
  }
  const currentTime = now().getTime();
  if (Math.abs(currentTime - envelopeTime) > maxClockSkewMs) {
    return { ok: false, reason: "Envelope timestamp outside allowed clock skew" };
  }

  // Nonce freshness / anti-replay
  const nonce = String(envelope.nonce || "").trim();
  if (!nonce || nonce.length < 8) {
    return { ok: false, reason: "Missing or insufficient envelope nonce" };
  }
  if (seenNonces) {
    const nonceKey = `${envelope.sender_id}:${nonce}`;
    if (seenNonces.has(nonceKey)) {
      return { ok: false, reason: `Replay attack detected: duplicate nonce '${nonce}' for sender '${envelope.sender_id}'` };
    }
  }

  // Algorithm check / anti-downgrade
  const algo = String(envelope.signature_algorithm || "").trim().toLowerCase();
  if (allowedAlgorithms) {
    const allowed = (Array.isArray(allowedAlgorithms) ? allowedAlgorithms : [allowedAlgorithms]).map((a) => a.toLowerCase());
    if (!allowed.includes(algo)) {
      return { ok: false, reason: `Algorithm '${algo}' is not permitted by policy (allowed: ${allowed.join(", ")})` };
    }
  }

  const expectedData = computeA2AEnvelopeSigningData(msg, envelope.timestamp, nonce);
  const dataBuf = Buffer.from(expectedData, "utf8");

  if (algo === "ed25519") {
    if (!trustStore) {
      return { ok: false, reason: "Ed25519 verification requires a configured trustStore" };
    }
    const keyId = String(envelope.signer_key_id || envelope.sender_id).trim();
    const pubKey = trustStore.getKey(keyId);
    if (!pubKey) {
      return { ok: false, reason: `Signer keyId '${keyId}' not found in trustStore` };
    }
    const sigHex = String(envelope.detached_signature || "").trim();
    if (!/^[0-9a-fA-F]{128}$/.test(sigHex)) {
      return { ok: false, reason: "Malformed Ed25519 signature format" };
    }
    try {
      const sigBuf = Buffer.from(sigHex, "hex");
      const verified = crypto.verify(null, dataBuf, pubKey, sigBuf);
      if (!verified) {
        return { ok: false, reason: "Ed25519 cryptographic signature verification failed" };
      }
    } catch (e) {
      return { ok: false, reason: `Ed25519 verification error: ${e.message}` };
    }
  } else if (algo === "hmac-sha256") {
    if (!secretKey) {
      return { ok: false, reason: "HMAC-SHA256 verification requires a configured secretKey" };
    }
    const sigHex = String(envelope.detached_signature || "").trim();
    if (!/^[0-9a-fA-F]{64}$/.test(sigHex)) {
      return { ok: false, reason: "Malformed HMAC-SHA256 signature format" };
    }
    const hmac = crypto.createHmac("sha256", String(secretKey).trim());
    hmac.update(dataBuf);
    const expectedSig = hmac.digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sigHex.toLowerCase(), "hex"), Buffer.from(expectedSig.toLowerCase(), "hex"))) {
      return { ok: false, reason: "HMAC-SHA256 signature mismatch" };
    }
  } else {
    return { ok: false, reason: `Unsupported signature algorithm: '${algo}'` };
  }

  if (seenNonces) {
    seenNonces.add(`${envelope.sender_id}:${nonce}`);
  }

  return {
    ok: true,
    envelope,
    message: msg,
    signer_key_id: envelope.signer_key_id,
    algorithm: algo,
  };
}

/**
 * In-memory / State-backed A2A Mailbox Queue with leased delivery and cryptographic receipts.
 */
export class A2AMailboxQueue {
  constructor({
    requireSignature = false,
    trustStore = null,
    secretKey = null,
    allowedAlgorithms = null,
    maxClockSkewMs = 300_000,
  } = {}) {
    this.messages = new Map(); // id -> { message, envelope }
    this.queue = []; // array of message IDs
    this.leases = new Map(); // messageId -> { token, recipientId, expiresAt, envelopeSha256, dispatchReceipt }
    this.deadLetter = [];
    this.requireSignature = Boolean(requireSignature);
    this.trustStore = trustStore;
    this.secretKey = secretKey;
    this.allowedAlgorithms = allowedAlgorithms;
    this.maxClockSkewMs = maxClockSkewMs;
    this.seenNonces = new Set();
  }

  enqueue(item) {
    if (!item || typeof item !== "object") {
      throw new Error("Cannot enqueue null or invalid item");
    }

    let message;
    let envelope = null;

    if (item.schema_version === A2A_SIGNED_ENVELOPE_SCHEMA) {
      const verification = verifyA2AMessageEnvelope(item, {
        trustStore: this.trustStore,
        secretKey: this.secretKey,
        allowedAlgorithms: this.allowedAlgorithms,
        maxClockSkewMs: this.maxClockSkewMs,
        seenNonces: this.seenNonces,
      });
      if (!verification.ok) {
        throw new Error(`A2A envelope verification failed: ${verification.reason}`);
      }
      envelope = item;
      message = item.message;
    } else if (item.schema_version === A2A_MESSAGE_SCHEMA) {
      if (this.requireSignature) {
        throw new Error(`A2AMailboxQueue requires cryptographically signed envelopes (schema: ${A2A_SIGNED_ENVELOPE_SCHEMA})`);
      }
      message = item;
    } else {
      throw new Error(`Cannot enqueue item with unsupported schema: '${item.schema_version}'`);
    }

    if (this.messages.has(message.message_id)) {
      throw new Error(`Duplicate A2A message ID: ${message.message_id}`);
    }

    this.messages.set(message.message_id, { message, envelope });
    this.queue.push(message.message_id);

    return {
      schema_version: A2A_MAILBOX_RECEIPT_SCHEMA,
      action: "ENQUEUED",
      message_id: message.message_id,
      sender_id: message.sender_id,
      recipient_id: message.recipient_id,
      signed: Boolean(envelope),
      signature_algorithm: envelope?.signature_algorithm || null,
      signer_key_id: envelope?.signer_key_id || null,
      queue_depth: this.queue.length,
      timestamp: new Date().toISOString(),
    };
  }

  dequeue({ recipientId, limit = 10, leaseTimeoutMs = 60_000 } = {}) {
    const safeRecipient = String(recipientId || "").trim().toLowerCase();
    const now = Date.now();
    const leasedMessages = [];
    const remainingQueue = [];

    for (const msgId of this.queue) {
      if (leasedMessages.length >= limit) {
        remainingQueue.push(msgId);
        continue;
      }

      const stored = this.messages.get(msgId);
      if (!stored) continue;
      const { message, envelope } = stored;

      // Filter by recipient (or wildcard "all" / "oss_council")
      if (safeRecipient && message.recipient_id !== safeRecipient && message.recipient_id !== "all") {
        remainingQueue.push(msgId);
        continue;
      }

      // Issue lease
      const leaseToken = `lease_${crypto.randomBytes(8).toString("hex")}`;
      const envelopeSha256 = sha256Hex(JSON.stringify(envelope || message));
      const leaseExpiresAt = new Date(now + leaseTimeoutMs).toISOString();
      const dispatchedAt = new Date(now).toISOString();

      const dispatchReceipt = {
        schema_version: A2A_DISPATCH_RECEIPT_SCHEMA,
        receipt_id: `rcpt_disp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        action: "LEASED_DISPATCH",
        message_id: msgId,
        envelope_sha256: envelopeSha256,
        recipient_id: safeRecipient || message.recipient_id,
        lease_token: leaseToken,
        lease_expires_at: leaseExpiresAt,
        dispatched_at: dispatchedAt,
      };

      this.leases.set(msgId, {
        token: leaseToken,
        recipientId: safeRecipient || message.recipient_id,
        expiresAt: now + leaseTimeoutMs,
        envelopeSha256,
        dispatchReceipt,
      });

      leasedMessages.push({
        message,
        envelope,
        lease_token: leaseToken,
        lease_expires_at: leaseExpiresAt,
        dispatch_receipt: dispatchReceipt,
      });
    }

    this.queue = remainingQueue;
    return leasedMessages;
  }

  acknowledge({ messageId, leaseToken, outcome = "PROCESSED" } = {}) {
    const lease = this.leases.get(messageId);
    if (!lease) {
      return { ok: false, error: "No active lease found for message ID" };
    }
    if (lease.token !== leaseToken) {
      return { ok: false, error: "Invalid lease token" };
    }

    const ackSha256 = sha256Hex(`${messageId}:${leaseToken}:${outcome}:${lease.envelopeSha256}`);
    this.leases.delete(messageId);
    this.messages.delete(messageId);

    return {
      schema_version: A2A_MAILBOX_RECEIPT_SCHEMA,
      action: "ACKNOWLEDGED",
      message_id: messageId,
      outcome: String(outcome),
      ack_sha256: ackSha256,
      timestamp: new Date().toISOString(),
    };
  }

  pruneExpiredLeases() {
    const now = Date.now();
    let recoveredCount = 0;

    for (const [msgId, lease] of this.leases.entries()) {
      if (now > lease.expiresAt) {
        this.leases.delete(msgId);
        if (this.messages.has(msgId)) {
          this.queue.unshift(msgId); // Re-queue at head
          recoveredCount++;
        }
      }
    }

    return { recovered_count: recoveredCount, active_leases: this.leases.size };
  }

  getStats() {
    return {
      total_stored: this.messages.size,
      queued_count: this.queue.length,
      leased_count: this.leases.size,
      dead_letter_count: this.deadLetter.length,
      require_signature: this.requireSignature,
      registered_trust_keys: this.trustStore ? (typeof this.trustStore.size === "function" ? this.trustStore.size() : 0) : 0,
    };
  }
}
