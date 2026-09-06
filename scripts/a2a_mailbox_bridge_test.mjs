import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createA2AMessage,
  createA2AHandoffPacket,
  A2AMailboxQueue,
  signA2AMessageEnvelope,
  verifyA2AMessageEnvelope,
  A2A_MESSAGE_SCHEMA,
  A2A_HANDOFF_SCHEMA,
  A2A_MAILBOX_RECEIPT_SCHEMA,
  A2A_SIGNED_ENVELOPE_SCHEMA,
} from "../lib/a2a_mailbox_bridge.mjs";
import { Ed25519TrustStore } from "../lib/a2a_boundary_guard.mjs";

console.log("[test:a2a-mailbox-bridge] Starting A2A Mailbox Bridge test suite...");

// Test 1: Create and validate A2A message
{
  const msg = createA2AMessage({
    senderId: "antigravity",
    recipientId: "codex",
    messageType: "task_delegation",
    payload: { task: "Run refactoring on router", files: ["lib/dispatch.mjs"] },
    trustZone: "trusted_collaborator",
    priority: "high",
  });

  assert.equal(msg.schema_version, A2A_MESSAGE_SCHEMA);
  assert.equal(msg.sender_id, "antigravity");
  assert.equal(msg.recipient_id, "codex");
  assert.equal(msg.message_type, "task_delegation");
  assert.equal(msg.trust_zone, "trusted_collaborator");
  assert.ok(msg.payload_sha256 && msg.payload_sha256.length === 64);
  console.log("  [PASS] Test 1: Create and validate A2A message");
}

// Test 2: Trust zone boundary violation rejected
{
  assert.throws(() => {
    createA2AMessage({
      senderId: "antigravity",
      recipientId: "grok",
      messageType: "bounty_alert",
      payload: { private_memory: "secret_keys_123" },
      trustZone: "outside_contact",
    });
  }, /boundary violation/);
  console.log("  [PASS] Test 2: Trust zone boundary violation rejected");
}

// Test 3: Create sealed A2A handoff packet
{
  const handoff = createA2AHandoffPacket({
    fromAgent: "antigravity",
    toAgent: "codex",
    branch: "feat/dizzy-general-distro",
    headCommit: "c4300eae",
    councilReceiptHash: "FCA25A8164A408DC543848CB2B17456F697E0C1B1EED46D28E5F81FC17398971",
    activeQueue: ["W-0101", "W-0102"],
    completedQueue: ["W-0099", "W-0100"],
    uncommittedFiles: ["lib/a2a_mailbox_bridge.mjs"],
    notes: "StateM bridge and Bounty engine completed and verified.",
  });

  assert.equal(handoff.schema_version, A2A_HANDOFF_SCHEMA);
  assert.ok(handoff.handoff_sha256 && handoff.handoff_sha256.length === 64);
  assert.equal(handoff.message.sender_id, "antigravity");
  assert.equal(handoff.message.recipient_id, "codex");
  assert.equal(handoff.message.payload.branch, "feat/dizzy-general-distro");
  console.log("  [PASS] Test 3: Create sealed A2A handoff packet");
}

// Test 4: Mailbox Queue lifecycle (Enqueue -> Dequeue with Lease -> Ack)
{
  const mailbox = new A2AMailboxQueue();

  const msg1 = createA2AMessage({
    senderId: "codex",
    recipientId: "antigravity",
    messageType: "reconciliation_delta",
    payload: { delta_id: "delta_401" },
  });

  const enqueueReceipt = mailbox.enqueue(msg1);
  assert.equal(enqueueReceipt.schema_version, A2A_MAILBOX_RECEIPT_SCHEMA);
  assert.equal(enqueueReceipt.action, "ENQUEUED");
  assert.equal(mailbox.getStats().queued_count, 1);

  // Dequeue for antigravity
  const dequeued = mailbox.dequeue({ recipientId: "antigravity", limit: 5 });
  assert.equal(dequeued.length, 1);
  assert.equal(dequeued[0].message.message_id, msg1.message_id);
  assert.ok(dequeued[0].lease_token.startsWith("lease_"));
  assert.equal(mailbox.getStats().leased_count, 1);

  // Attempt ack with invalid lease token fails
  const badAck = mailbox.acknowledge({ messageId: msg1.message_id, leaseToken: "invalid_token" });
  assert.equal(badAck.ok, false);

  // Valid ack succeeds
  const goodAck = mailbox.acknowledge({ messageId: msg1.message_id, leaseToken: dequeued[0].lease_token });
  assert.equal(goodAck.action, "ACKNOWLEDGED");
  assert.equal(mailbox.getStats().total_stored, 0);
  assert.equal(mailbox.getStats().leased_count, 0);
  console.log("  [PASS] Test 4: Mailbox Queue lifecycle (Enqueue -> Dequeue -> Ack)");
}

// Test 5: Lease expiration and recovery
{
  const mailbox = new A2AMailboxQueue();
  const msg = createA2AMessage({
    senderId: "antigravity",
    recipientId: "oss_council",
    messageType: "council_critique",
    payload: { review_target: "PR_W0068" },
  });

  mailbox.enqueue(msg);

  // Dequeue with 10ms lease timeout
  const dequeued = mailbox.dequeue({ recipientId: "oss_council", leaseTimeoutMs: 10 });
  assert.equal(dequeued.length, 1);
  assert.equal(mailbox.getStats().queued_count, 0);
  assert.equal(mailbox.getStats().leased_count, 1);

  // Sleep 25ms to expire lease
  await new Promise((resolve) => setTimeout(resolve, 25));

  // Prune expired leases -> message recovered back to queue
  const pruneResult = mailbox.pruneExpiredLeases();
  assert.equal(pruneResult.recovered_count, 1);
  assert.equal(mailbox.getStats().queued_count, 1);
  assert.equal(mailbox.getStats().leased_count, 0);
  console.log("  [PASS] Test 5: Lease expiration and recovery");
}

// Setup crypto materials for tests 6-13
const edKeypair = crypto.generateKeyPairSync("ed25519");
const edPrivateKey = edKeypair.privateKey;
const edPublicKey = edKeypair.publicKey;
const trustStore = new Ed25519TrustStore();
trustStore.addKey("codex", edPublicKey);

const hmacSecret = "super-secret-hmac-key";

// Test 6: Ed25519 signing and verification (valid flow)
{
  const msg = createA2AMessage({
    senderId: "codex",
    recipientId: "antigravity",
    messageType: "task_result",
  });
  const envelope = signA2AMessageEnvelope(msg, {
    algorithm: "ed25519",
    privateKey: edPrivateKey,
  });
  
  assert.equal(envelope.schema_version, A2A_SIGNED_ENVELOPE_SCHEMA);
  assert.equal(envelope.signature_algorithm, "ed25519");
  
  const result = verifyA2AMessageEnvelope(envelope, { trustStore });
  assert.equal(result.ok, true);
  console.log("  [PASS] Test 6: Ed25519 signing and verification (valid flow)");
}

// Test 7: HMAC-SHA256 signing and verification (valid flow)
{
  const msg = createA2AMessage({
    senderId: "antigravity",
    recipientId: "codex",
    messageType: "heartbeat",
  });
  const envelope = signA2AMessageEnvelope(msg, {
    algorithm: "hmac-sha256",
    secretKey: hmacSecret,
  });
  
  assert.equal(envelope.signature_algorithm, "hmac-sha256");
  
  const result = verifyA2AMessageEnvelope(envelope, { secretKey: hmacSecret });
  assert.equal(result.ok, true);
  console.log("  [PASS] Test 7: HMAC-SHA256 signing and verification (valid flow)");
}

// Test 8: Tamper rejection (modify payload after signing)
{
  const msg = createA2AMessage({
    senderId: "codex",
    recipientId: "antigravity",
    messageType: "task_result",
    payload: { valid: true }
  });
  const envelope = signA2AMessageEnvelope(msg, {
    algorithm: "ed25519",
    privateKey: edPrivateKey,
  });
  
  // Tamper!
  envelope.message.payload = { valid: false };
  
  const result = verifyA2AMessageEnvelope(envelope, { trustStore });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Payload digest mismatch/);
  console.log("  [PASS] Test 8: Tamper rejection (modify payload after signing)");
}

// Test 9: Clock skew rejection
{
  const msg = createA2AMessage({
    senderId: "codex",
    recipientId: "antigravity",
    messageType: "heartbeat",
  });
  // Sign with an old timestamp
  const oldNow = () => new Date(Date.now() - 600_000); // 10 minutes ago
  const envelope = signA2AMessageEnvelope(msg, {
    algorithm: "ed25519",
    privateKey: edPrivateKey,
    now: oldNow,
  });
  
  const result = verifyA2AMessageEnvelope(envelope, { trustStore }); // default 5m skew
  assert.equal(result.ok, false);
  assert.match(result.reason, /clock skew/);
  console.log("  [PASS] Test 9: Clock skew rejection");
}

// Test 10: Duplicate nonce / replay rejection
{
  const msg = createA2AMessage({
    senderId: "codex",
    recipientId: "antigravity",
    messageType: "task_result",
  });
  const envelope = signA2AMessageEnvelope(msg, {
    algorithm: "ed25519",
    privateKey: edPrivateKey,
  });
  
  const seenNonces = new Set();
  const res1 = verifyA2AMessageEnvelope(envelope, { trustStore, seenNonces });
  assert.equal(res1.ok, true);
  
  const res2 = verifyA2AMessageEnvelope(envelope, { trustStore, seenNonces });
  assert.equal(res2.ok, false);
  assert.match(res2.reason, /Replay attack detected/);
  console.log("  [PASS] Test 10: Duplicate nonce / replay rejection");
}

// Test 11: Algorithm downgrade attack
{
  const msg = createA2AMessage({
    senderId: "codex",
    recipientId: "antigravity",
    messageType: "heartbeat",
  });
  const envelope = signA2AMessageEnvelope(msg, {
    algorithm: "hmac-sha256",
    secretKey: hmacSecret,
  });
  
  const result = verifyA2AMessageEnvelope(envelope, {
    trustStore,
    secretKey: hmacSecret,
    allowedAlgorithms: ["ed25519"] // Downgrade rejection!
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not permitted by policy/);
  console.log("  [PASS] Test 11: Algorithm downgrade attack");
}

// Test 12: requireSignature queue mechanics
{
  const mailbox = new A2AMailboxQueue({ requireSignature: true, trustStore });
  const msg = createA2AMessage({
    senderId: "codex",
    recipientId: "antigravity",
    messageType: "heartbeat",
  });
  
  // Unsigned should fail
  assert.throws(() => mailbox.enqueue(msg), /requires cryptographically signed envelopes/);
  
  // Signed should pass
  const envelope = signA2AMessageEnvelope(msg, { algorithm: "ed25519", privateKey: edPrivateKey });
  const receipt = mailbox.enqueue(envelope);
  assert.equal(receipt.action, "ENQUEUED");
  assert.equal(receipt.signed, true);
  console.log("  [PASS] Test 12: requireSignature queue mechanics");
}

// Test 13: Invalid signer key rejection
{
  const msg = createA2AMessage({
    senderId: "unknown_agent",
    recipientId: "antigravity",
    messageType: "heartbeat",
  });
  const envelope = signA2AMessageEnvelope(msg, {
    algorithm: "ed25519",
    privateKey: edPrivateKey, // Used codex's key, but sender is unknown_agent
  });
  
  const result = verifyA2AMessageEnvelope(envelope, { trustStore });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not found in trustStore/);
  console.log("  [PASS] Test 13: Invalid signer key rejection");
}

console.log("\n[test:a2a-mailbox-bridge] ALL 13 TESTS PASSED CLEANLY.\n");
