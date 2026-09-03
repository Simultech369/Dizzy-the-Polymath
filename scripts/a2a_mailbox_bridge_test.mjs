import assert from "node:assert/strict";
import {
  createA2AMessage,
  createA2AHandoffPacket,
  A2AMailboxQueue,
  A2A_MESSAGE_SCHEMA,
  A2A_HANDOFF_SCHEMA,
  A2A_MAILBOX_RECEIPT_SCHEMA,
} from "../lib/a2a_mailbox_bridge.mjs";

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

console.log("\n[test:a2a-mailbox-bridge] ALL 5 TESTS PASSED CLEANLY.\n");
