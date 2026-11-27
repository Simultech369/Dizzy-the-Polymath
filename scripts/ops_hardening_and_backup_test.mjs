/**
 * Phase 3b Production Hygiene, Hardening, Backup/Restore, Key Rotation & Cache Audit Suite.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  generateSecureToken,
  timingSafeSecretEqual,
  verifyAgainstRotationKeyring,
  safeJsonMerge,
  safeRegexExec,
  verifyLockedJwtHs256,
  resolveTrustedClientIp,
  formatStructuredLog,
  retrySafeIdempotentOperation,
  backupRuntimeState,
  restoreRuntimeState,
  processAuthenticatedTelegramUpdate,
} from "../lib/ops_hardening.mjs";
import { openStructuralQueryCache } from "../lib/structural_query_cache.mjs";
import { a2aBoundaryGuard, generateA2ASignature } from "../lib/a2a_boundary_guard.mjs";

console.log("=== Phase 3b: Ops Hardening, Backup/Restore, Key Rotation & Telegram Adapter Suite ===");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-ops-hardening-"));

try {
  // 1. Secure tokens, constant-time compare & key rotation keyring
  const tokA = generateSecureToken({ bytes: 32, prefix: "dz_" });
  const tokB = generateSecureToken({ bytes: 32, prefix: "dz_" });
  assert.notEqual(tokA, tokB);
  assert.equal(timingSafeSecretEqual(tokA, tokA), true);
  assert.equal(timingSafeSecretEqual(tokA, tokB), false);

  const keyringCheckActive = verifyAgainstRotationKeyring("active_secret_32_chars_minimum_ok!", {
    activeSecret: "active_secret_32_chars_minimum_ok!",
    previousSecrets: ["old_grace_secret_32_chars_minimum!"],
    revokedSecrets: ["leaked_secret_key_32_chars_minimum"],
  });
  assert.equal(keyringCheckActive.ok, true);
  assert.equal(keyringCheckActive.key_slot, "active");

  const keyringCheckGrace = verifyAgainstRotationKeyring("old_grace_secret_32_chars_minimum!", {
    activeSecret: "active_secret_32_chars_minimum_ok!",
    previousSecrets: ["old_grace_secret_32_chars_minimum!"],
    revokedSecrets: ["leaked_secret_key_32_chars_minimum"],
  });
  assert.equal(keyringCheckGrace.ok, true);
  assert.equal(keyringCheckGrace.key_slot, "previous_grace");

  const keyringCheckRevoked = verifyAgainstRotationKeyring("leaked_secret_key_32_chars_minimum", {
    activeSecret: "active_secret_32_chars_minimum_ok!",
    previousSecrets: ["leaked_secret_key_32_chars_minimum"], // revoked overrides grace!
    revokedSecrets: ["leaked_secret_key_32_chars_minimum"],
  });
  assert.equal(keyringCheckRevoked.ok, false);
  assert.equal(keyringCheckRevoked.reason, "revoked_key_rejected");

  // 2. A2A HMAC rotation & revoked key rejection
  const activeA2A = "active_a2a_secret_key_with_36_chars!";
  const graceA2A = "previous_a2a_secret_key_with_38_chars!";
  const leakedA2A = "revoked_leaked_a2a_secret_with_39_ch!";
  const nonceCache = new Map();
  const nowMs = 1_760_000_000_000;
  const guard = a2aBoundaryGuard({
    secretKey: activeA2A,
    previousSecretKeys: [graceA2A],
    revokedSecretKeys: [leakedA2A],
    nonceCache,
    nowMs: () => nowMs,
  });

  function invokeGuard(secretUsed, nonce) {
    const rawBody = JSON.stringify({ hello: "world" });
    const sig = generateA2ASignature(rawBody, String(nowMs), nonce, secretUsed);
    const req = {
      headers: {
        "x-a2a-signature": sig,
        "x-a2a-timestamp": String(nowMs),
        "x-a2a-nonce": nonce,
      },
      rawBody,
      body: { hello: "world" },
    };
    let statusCode = 200;
    let jsonBody = null;
    let nextCalled = false;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonBody = payload;
        return this;
      },
    };
    guard(req, res, () => {
      nextCalled = true;
    });
    return { statusCode, jsonBody, nextCalled, a2aAuth: req.a2aAuth };
  }

  const graceRes = invokeGuard(graceA2A, "nonce_grace_0001");
  assert.equal(graceRes.nextCalled, true);
  assert.equal(graceRes.a2aAuth.keySlot, "previous_grace");

  const leakedRes = invokeGuard(leakedA2A, "nonce_leaked_0002");
  assert.equal(leakedRes.nextCalled, false);
  assert.equal(leakedRes.statusCode, 401);
  assert.match(leakedRes.jsonBody.error, /Revoked A2A key rejected/);
  console.log("  [PASS] Secret rotation keyring and A2A revoked-key rejection verified.");

  // 3. Safe JSON merge, ReDoS guard, locked JWT & untrusted IP headers
  const merged = safeJsonMerge({ a: 1, nested: { keep: true } }, { nested: { added: 2 } });
  assert.deepEqual(merged, { a: 1, nested: { keep: true, added: 2 } });
  const maliciousPatch = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => safeJsonMerge({}, maliciousPatch), /Forbidden prototype key/);
  assert.equal(({}).polluted, undefined);

  assert.equal(safeRegexExec("(a+)+$", "aaaaaaaaaaaaaaaaaaaaaaaa!").code, "UNSAFE_NESTED_QUANTIFIER_REGEX");
  assert.equal(safeRegexExec("^ok_[0-9]+$", "ok_42").matched, true);

  const jwtSecret = "jwt_locked_hs256_secret_at_least_32_bytes!";
  const algNoneToken = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "admin" })).toString("base64url")}.sig`;
  assert.equal(verifyLockedJwtHs256(algNoneToken, jwtSecret).code, "JWT_ALGORITHM_LOCK_REJECTED");

  const validHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const validPayload = Buffer.from(JSON.stringify({ sub: "op_1", exp: Math.floor(nowMs / 1000) + 300 })).toString("base64url");
  const validSig = crypto.createHmac("sha256", jwtSecret).update(`${validHeader}.${validPayload}`).digest("base64url");
  const validJwt = verifyLockedJwtHs256(`${validHeader}.${validPayload}.${validSig}`, jwtSecret, { nowMs: () => nowMs });
  assert.equal(validJwt.ok, true);
  assert.equal(validJwt.claims.sub, "op_1");

  const untrustedSpoof = resolveTrustedClientIp({
    socketRemoteAddress: "203.0.113.50",
    headers: { "x-forwarded-for": "127.0.0.1" },
    deploymentMode: "direct_local",
    trustedProxies: [],
  });
  assert.equal(untrustedSpoof.ip, "203.0.113.50");
  assert.equal(untrustedSpoof.ignored_untrusted_headers, true);

  const logLine = JSON.parse(formatStructuredLog({
    level: "warn",
    event: "auth_attempt",
    message: "Contact admin@example.com with sk-1234567890abcdefghijklmnop",
    meta: { api_key: "super_secret", ok: false },
  }));
  assert.match(logLine.message, /\[REDACTED_EMAIL\]/);
  assert.match(logLine.message, /\[REDACTED_API_KEY\]/);
  assert.equal(logLine.meta.api_key, "[REDACTED]");
  console.log("  [PASS] Safe JSON merge, ReDoS guard, JWT alg-lock, XFF mistrust & structured log redaction verified.");

  // 4. Idempotent-only backoff retry
  let nonIdempCalls = 0;
  await assert.rejects(
    () => retrySafeIdempotentOperation(async () => {
      nonIdempCalls += 1;
      throw new Error("transient_timeout");
    }, { idempotent: false, method: "POST", maxRetries: 3, sleepFn: async () => {} }),
    (err) => err.code === "NON_IDEMPOTENT_RETRY_FORBIDDEN"
  );
  assert.equal(nonIdempCalls, 1, "Non-idempotent mutation must NEVER retry");

  let readCalls = 0;
  const retriedRead = await retrySafeIdempotentOperation(async () => {
    readCalls += 1;
    if (readCalls < 3) throw new Error("temporary_503");
    return "recovered_payload";
  }, { method: "GET", maxRetries: 3, sleepFn: async () => {} });
  assert.equal(retriedRead.ok, true);
  assert.equal(retriedRead.attempts_count, 3);
  assert.equal(retriedRead.value, "recovered_payload");
  console.log("  [PASS] Backoff retry strictly limited to safe/idempotent operations.");

  // 5. Zone-keyed cache audit trail
  const cache = openStructuralQueryCache(":memory:");
  try {
    cache.store({
      route: "/api/dashboard-query",
      projection: "v1",
      trustZone: "private_self",
      retentionScope: "local_conversation",
      query: "audit trail check",
      payload: { snippets: ["ok"] },
    });
    const hit = cache.lookup({
      route: "/api/dashboard-query",
      projection: "v1",
      trustZone: "private_self",
      retentionScope: "local_conversation",
      query: "audit trail check",
    });
    assert.equal(hit.hit, true);
    const trail = cache.getAuditTrail();
    assert.equal(trail.length, 2);
    assert.equal(trail[0].action, "store");
    assert.equal(trail[1].action, "lookup");
    assert.equal(trail[1].cache_hit, true);
  } finally {
    cache.close();
  }
  console.log("  [PASS] Zone-keyed cache audit trail verified.");

  // 6. Verified runtime backup & restore + tamper rejection
  const runtimeSrc = path.join(tempDir, "runtime_src");
  const backupDir = path.join(tempDir, "backup_snap");
  const runtimeRestored = path.join(tempDir, "runtime_restored");
  fs.mkdirSync(path.join(runtimeSrc, "hitl"), { recursive: true });
  fs.mkdirSync(path.join(runtimeSrc, "audit"), { recursive: true });
  fs.writeFileSync(path.join(runtimeSrc, "hitl", "runs.jsonl"), '{"run_id":"r1","workflow_state":"waiting_for_approval"}\n');
  fs.writeFileSync(path.join(runtimeSrc, "audit", "unified_audit_ledger.jsonl"), '{"seq":1,"surface":"dispatch"}\n');

  const manifest = backupRuntimeState({ runtimeDir: runtimeSrc, backupDir });
  assert.equal(manifest.file_count, 2);

  const restoredOk = restoreRuntimeState({ backupDir, targetRuntimeDir: runtimeRestored });
  assert.equal(restoredOk.ok, true);
  assert.equal(restoredOk.restored_files, 2);
  assert.match(fs.readFileSync(path.join(runtimeRestored, "hitl", "runs.jsonl"), "utf8"), /waiting_for_approval/);

  // Tamper a backed-up file and verify fail-closed restore rejection
  fs.writeFileSync(path.join(backupDir, "files", "hitl", "runs.jsonl"), '{"run_id":"r1","workflow_state":"approved"}\n');
  assert.throws(
    () => restoreRuntimeState({ backupDir, targetRuntimeDir: path.join(tempDir, "runtime_tampered") }),
    (err) => err.code === "BACKUP_TAMPER_OR_CORRUPTION_DETECTED"
  );
  console.log("  [PASS] SHA-256 runtime backup, clean restore, and tamper rejection verified.");

  // 7. Authenticated Telegram intake adapter under Dizzy router
  const unauthTg = await processAuthenticatedTelegramUpdate({
    update: { message: { chat: { id: 12345 }, text: "hi" } },
    secretHeader: "wrong",
    expectedSecret: "tg_webhook_secret_32_characters_ok",
    allowedChatIds: ["12345"],
    dispatchFn: async () => ({ text: "unreachable" }),
  });
  assert.equal(unauthTg.ok, false);
  assert.equal(unauthTg.status, 401);

  const longReply = "A".repeat(800);
  const validTg = await processAuthenticatedTelegramUpdate({
    update: { message: { chat: { id: 12345 }, text: "status check" } },
    secretHeader: "tg_webhook_secret_32_characters_ok",
    expectedSecret: "tg_webhook_secret_32_characters_ok",
    allowedChatIds: ["12345"],
    maxReplyChars: 240,
    dispatchFn: async (msg) => {
      assert.equal(msg.channel, "telegram");
      assert.equal(msg.runtime_context.trust_zone, "trusted_collaborator");
      return { text: longReply, router_receipt: { chosen_model: "local:gemma3:4b" } };
    },
  });
  assert.equal(validTg.ok, true);
  assert.ok(validTg.reply_text.length <= 240);
  assert.match(validTg.reply_text, /\[See local Inspect\/Replay\]$/);
  console.log("  [PASS] Authenticated Telegram intake adapter verified under Dizzy router.");

  console.log("OPS_HARDENING_AND_BACKUP_TESTS_OK");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
