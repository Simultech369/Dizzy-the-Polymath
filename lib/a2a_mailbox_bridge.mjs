import crypto from "node:crypto";

export const A2A_MESSAGE_SCHEMA = "dizzy.a2a_message.v1";
export const A2A_HANDOFF_SCHEMA = "dizzy.a2a_handoff.v1";
export const A2A_MAILBOX_RECEIPT_SCHEMA = "dizzy.a2a_mailbox_receipt.v1";

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
 * In-memory / State-backed A2A Mailbox Queue with leased delivery.
 */
export class A2AMailboxQueue {
  constructor() {
    this.messages = new Map(); // id -> message
    this.queue = []; // array of message IDs
    this.leases = new Map(); // messageId -> { token, recipientId, expiresAt }
    this.deadLetter = [];
  }

  enqueue(message) {
    if (!message || message.schema_version !== A2A_MESSAGE_SCHEMA) {
      throw new Error("Cannot enqueue invalid A2A message: schema mismatch");
    }
    if (this.messages.has(message.message_id)) {
      throw new Error(`Duplicate A2A message ID: ${message.message_id}`);
    }

    this.messages.set(message.message_id, message);
    this.queue.push(message.message_id);

    return {
      schema_version: A2A_MAILBOX_RECEIPT_SCHEMA,
      action: "ENQUEUED",
      message_id: message.message_id,
      sender_id: message.sender_id,
      recipient_id: message.recipient_id,
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

      const msg = this.messages.get(msgId);
      if (!msg) continue;

      // Filter by recipient (or wildcard "all" / "oss_council")
      if (safeRecipient && msg.recipient_id !== safeRecipient && msg.recipient_id !== "all") {
        remainingQueue.push(msgId);
        continue;
      }

      // Issue lease
      const leaseToken = `lease_${crypto.randomBytes(8).toString("hex")}`;
      this.leases.set(msgId, {
        token: leaseToken,
        recipientId: safeRecipient || msg.recipient_id,
        expiresAt: now + leaseTimeoutMs,
      });

      leasedMessages.push({
        message: msg,
        lease_token: leaseToken,
        lease_expires_at: new Date(now + leaseTimeoutMs).toISOString(),
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

    this.leases.delete(messageId);
    this.messages.delete(messageId);

    return {
      schema_version: A2A_MAILBOX_RECEIPT_SCHEMA,
      action: "ACKNOWLEDGED",
      message_id: messageId,
      outcome: String(outcome),
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
    };
  }
}
