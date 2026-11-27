/**
 * Phase 3b Production Hygiene, Extra Hardening, Verified Backup/Restore & Authenticated Telegram Adapter.
 *
 * Implements:
 * - CSPRNG secure random token generation (`generateSecureToken`)
 * - Constant-time secret comparison & key-rotation keyring (`timingSafeSecretEqual`, `verifyAgainstRotationKeyring`)
 * - Prototype-pollution-safe JSON merging (`safeJsonMerge`)
 * - Regex size & complexity guard against ReDoS (`safeRegexExec`)
 * - Algorithm-locked JWT verification rejecting `alg: none` & confusion (`verifyLockedJwtHs256`)
 * - Untrusted client IP header rejection unless `deploymentMode === "proxied"` + `trustedProxies` (`resolveTrustedClientIp`)
 * - Structured JSON logs with secret/PII redaction (`formatStructuredLog`)
 * - Idempotent-only exponential backoff retry (`retrySafeIdempotentOperation`)
 * - SHA-256 manifest-backed runtime backup & tamper-evident restore (`backupRuntimeState`, `restoreRuntimeState`)
 * - Authenticated Telegram intake adapter routing strictly through Dizzy with short replies (`processAuthenticatedTelegramUpdate`)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { redactSecretMaterial } from "./durable_write_policy.mjs";

export const BACKUP_MANIFEST_SCHEMA = "dizzy.runtime_backup_manifest.v1";

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Generates a cryptographically secure random token using OS CSPRNG (`crypto.randomBytes`).
 */
export function generateSecureToken({ bytes = 32, encoding = "base64url", prefix = "" } = {}) {
  const safeBytes = Math.max(16, Math.min(128, Math.floor(Number(bytes) || 32)));
  const raw = crypto.randomBytes(safeBytes).toString(encoding);
  return prefix ? `${prefix}${raw}` : raw;
}

/**
 * Constant-time secret comparison using fixed-width HMAC digests so neither secret
 * content nor length leaks via early string exit.
 */
export function timingSafeSecretEqual(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string") return false;
  if (!candidate || !expected) return false;
  const ephemeralKey = crypto.randomBytes(32);
  const leftDigest = crypto.createHmac("sha256", ephemeralKey).update(candidate, "utf8").digest();
  const rightDigest = crypto.createHmac("sha256", ephemeralKey).update(expected, "utf8").digest();
  const digestsMatch = crypto.timingSafeEqual(leftDigest, rightDigest);
  return digestsMatch && candidate.length === expected.length;
}

/**
 * Evaluates a presented credential against an active secret, optional grace-period
 * rotated secrets, and explicitly revoked/leaked secrets.
 */
export function verifyAgainstRotationKeyring(
  candidate,
  { activeSecret = "", previousSecrets = [], revokedSecrets = [] } = {}
) {
  const token = String(candidate || "");
  if (!token) {
    return { ok: false, reason: "missing_credential" };
  }
  for (const leaked of revokedSecrets) {
    if (leaked && timingSafeSecretEqual(token, String(leaked))) {
      return { ok: false, reason: "revoked_key_rejected" };
    }
  }
  if (activeSecret && timingSafeSecretEqual(token, String(activeSecret))) {
    return { ok: true, key_slot: "active" };
  }
  for (const prev of previousSecrets) {
    if (prev && timingSafeSecretEqual(token, String(prev))) {
      return { ok: true, key_slot: "previous_grace" };
    }
  }
  return { ok: false, reason: "invalid_credential" };
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const FORBIDDEN_MERGE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Deep-merges plain JSON objects while rejecting prototype-pollution vectors and excessive nesting.
 */
export function safeJsonMerge(base, patch, { maxDepth = 16, _depth = 0 } = {}) {
  if (_depth > maxDepth) {
    const err = new Error(`safeJsonMerge exceeded maximum depth (${maxDepth})`);
    err.code = "JSON_MERGE_MAX_DEPTH_EXCEEDED";
    throw err;
  }
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    const err = new Error("safeJsonMerge requires plain object inputs");
    err.code = "JSON_MERGE_INVALID_OBJECT";
    throw err;
  }

  const out = Object.create(null);
  for (const key of Object.keys(base)) {
    if (FORBIDDEN_MERGE_KEYS.has(key)) {
      const err = new Error(`Forbidden prototype key '${key}' in base object`);
      err.code = "PROTOTYPE_POLLUTION_BLOCKED";
      throw err;
    }
    const val = base[key];
    out[key] = isPlainObject(val)
      ? safeJsonMerge(Object.create(null), val, { maxDepth, _depth: _depth + 1 })
      : Array.isArray(val)
        ? structuredClone(val)
        : val;
  }

  for (const key of Object.keys(patch)) {
    if (FORBIDDEN_MERGE_KEYS.has(key)) {
      const err = new Error(`Forbidden prototype key '${key}' in patch object`);
      err.code = "PROTOTYPE_POLLUTION_BLOCKED";
      throw err;
    }
    const nextVal = patch[key];
    if (isPlainObject(nextVal) && isPlainObject(out[key])) {
      out[key] = safeJsonMerge(out[key], nextVal, { maxDepth, _depth: _depth + 1 });
    } else if (isPlainObject(nextVal)) {
      out[key] = safeJsonMerge(Object.create(null), nextVal, { maxDepth, _depth: _depth + 1 });
    } else if (Array.isArray(nextVal)) {
      out[key] = structuredClone(nextVal);
    } else {
      out[key] = nextVal;
    }
  }

  return { ...out };
}

// Heuristic detector for catastrophic nested quantifiers such as (a+)+, (.*)+, ([a-z]+)*
const NESTED_QUANTIFIER_PATTERN = /\([^()]*[+*][^()]*\)[+*?{]/;

/**
 * Guards regular expression evaluation with pattern-complexity, input-size, and elapsed-time limits.
 */
export function safeRegexExec(
  pattern,
  input,
  { flags = "", maxInputChars = 8192, maxPatternChars = 256, maxDurationMs = 25 } = {}
) {
  const source = pattern instanceof RegExp ? pattern.source : String(pattern ?? "");
  const effectiveFlags = pattern instanceof RegExp ? pattern.flags : String(flags || "");
  const text = String(input ?? "");

  if (!source || source.length > maxPatternChars) {
    return { ok: false, matched: false, code: "REGEX_PATTERN_TOO_LARGE" };
  }
  if (NESTED_QUANTIFIER_PATTERN.test(source)) {
    return { ok: false, matched: false, code: "UNSAFE_NESTED_QUANTIFIER_REGEX" };
  }
  if (text.length > maxInputChars) {
    return { ok: false, matched: false, code: "REGEX_INPUT_TOO_LARGE" };
  }

  const compiled = new RegExp(source, effectiveFlags);
  const started = performance.now();
  const match = compiled.exec(text);
  const elapsedMs = performance.now() - started;

  if (elapsedMs > maxDurationMs) {
    return { ok: false, matched: false, code: "REGEX_TIME_BUDGET_EXCEEDED", elapsed_ms: elapsedMs };
  }

  return {
    ok: true,
    matched: Boolean(match),
    match: match ? match[0] : null,
    elapsed_ms: elapsedMs,
  };
}

/**
 * Verifies an HS256 JWT with strict algorithm locking (`alg === "HS256"`), rejecting `alg: "none"`,
 * asymmetric/symmetric confusion, malformed segments, and expired claims.
 */
export function verifyLockedJwtHs256(
  token,
  secret,
  { expectedIssuer = null, expectedAudience = null, clockToleranceSec = 15, nowMs = () => Date.now() } = {}
) {
  if (typeof token !== "string" || typeof secret !== "string" || secret.length < 32) {
    return { ok: false, code: "JWT_INVALID_INPUT_OR_SECRET" };
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !p)) {
    return { ok: false, code: "JWT_MALFORMED_SEGMENTS" };
  }

  let header = null;
  let payload = null;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: "JWT_INVALID_JSON" };
  }

  if (!isPlainObject(header) || !isPlainObject(payload)) {
    return { ok: false, code: "JWT_NON_OBJECT_SEGMENT" };
  }
  if (header.alg !== "HS256") {
    return { ok: false, code: "JWT_ALGORITHM_LOCK_REJECTED", rejected_alg: String(header.alg || "none") };
  }
  if (header.typ && String(header.typ).toUpperCase() !== "JWT") {
    return { ok: false, code: "JWT_INVALID_TYPE" };
  }

  const signingInput = `${parts[0]}.${parts[1]}`;
  const expectedSig = crypto.createHmac("sha256", secret).update(signingInput, "utf8").digest("base64url");
  if (!timingSafeSecretEqual(parts[2], expectedSig)) {
    return { ok: false, code: "JWT_SIGNATURE_INVALID" };
  }

  const nowSec = Math.floor(nowMs() / 1000);
  if (payload.exp !== undefined && Number(payload.exp) + clockToleranceSec <= nowSec) {
    return { ok: false, code: "JWT_EXPIRED" };
  }
  if (payload.nbf !== undefined && Number(payload.nbf) - clockToleranceSec > nowSec) {
    return { ok: false, code: "JWT_NOT_BEFORE_VIOLATION" };
  }
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    return { ok: false, code: "JWT_ISSUER_MISMATCH" };
  }
  if (expectedAudience && payload.aud !== expectedAudience) {
    return { ok: false, code: "JWT_AUDIENCE_MISMATCH" };
  }

  return { ok: true, claims: payload };
}

function normalizeIpAddr(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v.startsWith("::ffff:")) return v.slice("::ffff:".length);
  return v;
}

/**
 * Resolves client IP without trusting `X-Forwarded-For` / `X-Real-IP` headers unless
 * `deploymentMode === "proxied"` AND the immediate socket peer is in `trustedProxies`.
 */
export function resolveTrustedClientIp({
  socketRemoteAddress = "",
  headers = {},
  deploymentMode = "direct_local",
  trustedProxies = [],
} = {}) {
  const peerIp = normalizeIpAddr(socketRemoteAddress);
  const trustedSet = new Set(trustedProxies.map((ip) => normalizeIpAddr(ip)).filter(Boolean));
  const xff = String(headers?.["x-forwarded-for"] ?? "").trim();
  const xRealIp = String(headers?.["x-real-ip"] ?? "").trim();

  if (deploymentMode === "proxied" && peerIp && trustedSet.has(peerIp)) {
    if (xff) {
      const hops = xff.split(",").map((item) => normalizeIpAddr(item)).filter(Boolean);
      if (hops.length > 0) {
        return { ip: hops[0], trusted_forwarded: true, ignored_untrusted_headers: false };
      }
    }
    if (xRealIp) {
      return { ip: normalizeIpAddr(xRealIp), trusted_forwarded: true, ignored_untrusted_headers: false };
    }
  }

  return {
    ip: peerIp || "unknown",
    trusted_forwarded: false,
    ignored_untrusted_headers: Boolean(xff || xRealIp || headers?.forwarded),
  };
}

function scrubLogValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return "[MAX_DEPTH]";
  if (typeof value === "string") {
    return redactSecretMaterial(value)
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]")
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_API_KEY]")
      .replace(/\b(\d{6,}):([A-Za-z0-9_-]{20,})\b/g, "[REDACTED_TELEGRAM_TOKEN]")
      .slice(0, 1000);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => scrubLogValue(item, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/(?:token|secret|password|authorization|cookie|api_key|apikey)/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = scrubLogValue(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

/**
 * Formats a structured single-line JSON operational log entry with secret/PII redaction.
 */
export function formatStructuredLog({
  level = "info",
  surface = "dizzy_control_plane",
  event = "operational_event",
  message = "",
  meta = {},
  now = () => new Date(),
} = {}) {
  const entry = {
    timestamp: now().toISOString(),
    level: String(level || "info").toLowerCase(),
    surface: String(surface || "dizzy_control_plane"),
    event: String(event || "operational_event"),
    message: scrubLogValue(String(message || "")),
    meta: scrubLogValue(meta),
  };
  return JSON.stringify(entry);
}

/**
 * Executes an operation with bounded exponential backoff ONLY when the caller explicitly
 * marks the operation safe to repeat (`idempotent: true` or READ method).
 */
export async function retrySafeIdempotentOperation(
  operationFn,
  {
    idempotent = false,
    method = "POST",
    idempotencyKey = "",
    maxRetries = 2,
    baseDelayMs = 15,
    sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {}
) {
  const upperMethod = String(method || "POST").toUpperCase();
  const safeByMethod = upperMethod === "GET" || upperMethod === "HEAD";
  const safeToRepeat = Boolean(idempotent) || safeByMethod || Boolean(String(idempotencyKey || "").trim());

  const clampedRetries = safeToRepeat ? Math.max(0, Math.min(4, Math.floor(Number(maxRetries) || 0))) : 0;
  const attempts = [];

  for (let attempt = 1; attempt <= clampedRetries + 1; attempt += 1) {
    try {
      const value = await operationFn({ attempt });
      attempts.push({ attempt, status: "succeeded" });
      return {
        ok: true,
        safe_to_repeat: safeToRepeat,
        attempts_count: attempt,
        attempts,
        value,
      };
    } catch (err) {
      attempts.push({
        attempt,
        status: "failed",
        error: String(err?.message || err).slice(0, 200),
      });
      if (!safeToRepeat) {
        const blocked = new Error(
          `Operation failed and cannot be retried automatically because it is non-idempotent: ${err?.message || err}`
        );
        blocked.code = "NON_IDEMPOTENT_RETRY_FORBIDDEN";
        blocked.attempts = attempts;
        throw blocked;
      }
      if (attempt > clampedRetries) {
        err.attempts = attempts;
        throw err;
      }
      const delayMs = baseDelayMs * (2 ** (attempt - 1));
      await sleepFn(delayMs);
    }
  }
  throw new Error("Unreachable retry loop state");
}

function walkFilesRelative(baseDir, currentRel = "") {
  const absDir = path.join(baseDir, currentRel);
  if (!fs.existsSync(absDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const relPath = currentRel ? path.posix.join(currentRel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      out.push(...walkFilesRelative(baseDir, relPath));
    } else if (entry.isFile()) {
      out.push(relPath);
    }
  }
  return out.sort();
}

/**
 * Backs up runtime state subdirectories (`hitl`, `audit`, `continuity`, `checkpoints`)
 * with SHA-256 per-file digests and a sealed `backup_manifest.json`.
 */
export function backupRuntimeState({
  runtimeDir,
  backupDir,
  surfaces = ["hitl", "audit", "continuity", "checkpoints"],
  now = () => new Date(),
} = {}) {
  const srcRoot = path.resolve(runtimeDir);
  const dstRoot = path.resolve(backupDir);
  fs.mkdirSync(dstRoot, { recursive: true });

  const filesManifest = [];
  for (const surface of surfaces) {
    const safeSurface = String(surface).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeSurface) continue;
    const surfaceRoot = path.join(srcRoot, safeSurface);
    if (!fs.existsSync(surfaceRoot)) continue;

    for (const relInsideSurface of walkFilesRelative(surfaceRoot)) {
      const relFromRuntime = path.posix.join(safeSurface, relInsideSurface);
      const srcFile = path.join(srcRoot, relFromRuntime);
      const dstFile = path.join(dstRoot, "files", relFromRuntime);
      fs.mkdirSync(path.dirname(dstFile), { recursive: true });
      const buf = fs.readFileSync(srcFile);
      fs.writeFileSync(dstFile, buf);
      filesManifest.push({
        relative_path: relFromRuntime,
        bytes: buf.length,
        sha256: sha256Hex(buf),
      });
    }
  }

  const coreManifest = {
    schema_version: BACKUP_MANIFEST_SCHEMA,
    created_at: now().toISOString(),
    file_count: filesManifest.length,
    files: filesManifest,
  };
  const manifestSha256 = sha256Hex(Buffer.from(stableJson(coreManifest), "utf8"));
  const sealedManifest = {
    ...coreManifest,
    manifest_sha256: manifestSha256,
  };
  fs.writeFileSync(path.join(dstRoot, "backup_manifest.json"), JSON.stringify(sealedManifest, null, 2), "utf8");
  return sealedManifest;
}

/**
 * Verifies every file and manifest SHA-256 digest in a backup directory BEFORE restoring
 * into `targetRuntimeDir`. Fails closed if any file or manifest was tampered with or truncated.
 */
export function restoreRuntimeState({ backupDir, targetRuntimeDir } = {}) {
  const srcBackup = path.resolve(backupDir);
  const dstRuntime = path.resolve(targetRuntimeDir);
  const manifestPath = path.join(srcBackup, "backup_manifest.json");

  if (!fs.existsSync(manifestPath)) {
    const err = new Error("Backup manifest missing");
    err.code = "BACKUP_MANIFEST_MISSING";
    throw err;
  }

  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (parsed?.schema_version !== BACKUP_MANIFEST_SCHEMA || !Array.isArray(parsed.files)) {
    const err = new Error("Unsupported backup manifest schema");
    err.code = "BACKUP_MANIFEST_INVALID";
    throw err;
  }

  const { manifest_sha256: recordedManifestHash, ...core } = parsed;
  const expectedManifestHash = sha256Hex(Buffer.from(stableJson(core), "utf8"));
  if (recordedManifestHash !== expectedManifestHash) {
    const err = new Error("Backup manifest SHA-256 mismatch (tampered manifest)");
    err.code = "BACKUP_TAMPER_OR_CORRUPTION_DETECTED";
    throw err;
  }

  // Phase 1: Verify all files in backup before touching targetRuntimeDir
  const stagedBuffers = [];
  for (const entry of parsed.files) {
    const rel = String(entry.relative_path || "");
    if (!rel || rel.includes("..") || path.isAbsolute(rel)) {
      const err = new Error(`Unsafe backup relative path: ${rel}`);
      err.code = "BACKUP_UNSAFE_PATH";
      throw err;
    }
    const backupFile = path.join(srcBackup, "files", rel);
    if (!fs.existsSync(backupFile)) {
      const err = new Error(`Backup file missing: ${rel}`);
      err.code = "BACKUP_TAMPER_OR_CORRUPTION_DETECTED";
      throw err;
    }
    const buf = fs.readFileSync(backupFile);
    if (buf.length !== entry.bytes || sha256Hex(buf) !== entry.sha256) {
      const err = new Error(`Backup file checksum mismatch: ${rel}`);
      err.code = "BACKUP_TAMPER_OR_CORRUPTION_DETECTED";
      throw err;
    }
    stagedBuffers.push({ rel, buf });
  }

  // Phase 2: Write verified files to targetRuntimeDir
  fs.mkdirSync(dstRuntime, { recursive: true });
  for (const item of stagedBuffers) {
    const targetFile = path.join(dstRuntime, item.rel);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, item.buf);
  }

  return {
    ok: true,
    restored_files: stagedBuffers.length,
    manifest_sha256: recordedManifestHash,
  };
}

/**
 * Optional Authenticated Telegram Intake Adapter (Phase 3b).
 * Enforces webhook secret + explicit chat allowlist, routes strictly through Dizzy's
 * router (`dispatchFn`), strips raw JSON/stack traces, and enforces short mobile-safe replies.
 */
export async function processAuthenticatedTelegramUpdate({
  update = {},
  secretHeader = "",
  expectedSecret = "",
  allowedChatIds = [],
  dispatchFn,
  maxReplyChars = 600,
} = {}) {
  if (!expectedSecret || !timingSafeSecretEqual(String(secretHeader || ""), String(expectedSecret))) {
    return {
      ok: false,
      status: 401,
      code: "TELEGRAM_WEBHOOK_UNAUTHORIZED",
      reply_text: null,
    };
  }

  const msg = update?.message || update?.edited_message || null;
  const chatId = msg?.chat?.id !== undefined ? String(msg.chat.id).trim() : "";
  const text = String(msg?.text ?? "").trim();

  const allowSet = new Set(allowedChatIds.map((id) => String(id).trim()).filter(Boolean));
  if (!chatId || !allowSet.has(chatId)) {
    return {
      ok: false,
      status: 403,
      code: "TELEGRAM_CHAT_NOT_ALLOWLISTED",
      reply_text: null,
    };
  }

  if (!text) {
    return {
      ok: true,
      status: 200,
      code: "TELEGRAM_NON_TEXT_IGNORED",
      reply_text: null,
    };
  }

  if (typeof dispatchFn !== "function") {
    throw new Error("processAuthenticatedTelegramUpdate requires Dizzy dispatchFn");
  }

  const routed = await dispatchFn({
    channel: "telegram",
    from: `telegram:${chatId}`,
    text: text.slice(0, 4000),
    runtime_context: {
      trust_zone: "trusted_collaborator",
      conversation_key: `telegram_chat_${chatId.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    },
  });

  const rawReply = String(routed?.text || "Request processed. Inspect local dashboard for full receipt.")
    .replace(/\r?\n{3,}/g, "\n\n")
    .trim();

  const safeLimit = Math.max(120, Math.min(1200, Number(maxReplyChars) || 600));
  const shortReply = rawReply.length <= safeLimit
    ? rawReply
    : `${rawReply.slice(0, safeLimit - 42).trimEnd()}... [See local Inspect/Replay]`;

  return {
    ok: true,
    status: 200,
    code: "TELEGRAM_ROUTED_VIA_DIZZY",
    chat_id: chatId,
    reply_text: shortReply,
    router_receipt: routed?.router_receipt || routed?.execution_metadata || null,
  };
}
