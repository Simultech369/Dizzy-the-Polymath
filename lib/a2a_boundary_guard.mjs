import crypto from "node:crypto";

const NONCE_CACHE = new Map();
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_NONCE_CACHE_ENTRIES = 10_000;
const HMAC_SHA256_HEX_LENGTH = 64;
const ED25519_SIG_HEX_LENGTH = 128;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
export const SUPPORTED_A2A_ALGORITHMS = Object.freeze(["hmac-sha256", "ed25519"]);

export function validateA2ASecret(secretKey) {
  const secret = String(secretKey ?? "").trim();
  if (!secret) return { ok: false, reason: "DIZZY_A2A_SECRET is required" };
  if (secret === "default_unsafe_secret") return { ok: false, reason: "DIZZY_A2A_SECRET cannot use the unsafe default" };
  if (secret.length < 32) return { ok: false, reason: "DIZZY_A2A_SECRET must be at least 32 characters" };
  return { ok: true, secret };
}

function requireA2ASecret(secretKey) {
  const validation = validateA2ASecret(secretKey);
  if (!validation.ok) throw new Error(validation.reason);
  return validation.secret;
}

export function normalizeEd25519PublicKey(input) {
  if (!input) throw new Error("Ed25519 public key cannot be empty");
  if (typeof input === "object" && input.type === "public" && input.asymmetricKeyType === "ed25519") {
    return input;
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("-----BEGIN")) {
      const key = crypto.createPublicKey(trimmed);
      if (key.asymmetricKeyType !== "ed25519") {
        throw new Error(`Expected ed25519 key, got ${key.asymmetricKeyType}`);
      }
      return key;
    }
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      const der = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(trimmed, "hex")]);
      return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    }
    try {
      const buf = Buffer.from(trimmed, "base64");
      if (buf.length === 32) {
        const der = Buffer.concat([ED25519_SPKI_PREFIX, buf]);
        return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
      }
      return crypto.createPublicKey({ key: buf, format: "der", type: "spki" });
    } catch {
      // fall through
    }
  }
  if (Buffer.isBuffer(input)) {
    if (input.length === 32) {
      const der = Buffer.concat([ED25519_SPKI_PREFIX, input]);
      return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    }
    return crypto.createPublicKey({ key: input, format: "der", type: "spki" });
  }
  throw new Error("Unsupported Ed25519 public key format");
}

export class Ed25519TrustStore {
  constructor(initialKeys = {}) {
    this._keys = new Map();
    if (initialKeys && typeof initialKeys === "object") {
      const entries = initialKeys instanceof Map ? initialKeys.entries() : Object.entries(initialKeys);
      for (const [keyId, keyVal] of entries) {
        this.addKey(keyId, keyVal);
      }
    }
  }

  addKey(keyId, keyMaterial, metadata = {}) {
    const safeKeyId = String(keyId ?? "").trim();
    if (!safeKeyId || !/^[A-Za-z0-9._:-]{1,128}$/.test(safeKeyId)) {
      throw new Error(`Invalid keyId format: '${keyId}'. Must match ^[A-Za-z0-9._:-]{1,128}$`);
    }
    const keyObject = normalizeEd25519PublicKey(keyMaterial);
    this._keys.set(safeKeyId, {
      keyId: safeKeyId,
      keyObject,
      addedAt: new Date().toISOString(),
      metadata: { ...metadata },
    });
    return this;
  }

  getKey(keyId) {
    return this._keys.get(String(keyId ?? "").trim())?.keyObject ?? null;
  }

  hasKey(keyId) {
    return this._keys.has(String(keyId ?? "").trim());
  }

  removeKey(keyId) {
    return this._keys.delete(String(keyId ?? "").trim());
  }

  size() {
    return this._keys.size;
  }

  keys() {
    return Array.from(this._keys.keys());
  }

  static fromEnv(envVar = "DIZZY_A2A_TRUST_STORE") {
    const raw = process.env[envVar];
    if (!raw) return new Ed25519TrustStore();
    try {
      const parsed = JSON.parse(raw);
      return new Ed25519TrustStore(parsed);
    } catch (e) {
      throw new Error(`Failed to parse ${envVar}: ${e.message}`);
    }
  }
}

export function sanitizePromptInjection(payload, depth = 0) {
  if (depth > 16) throw new Error("Excessive nesting depth in A2A payload");
  if (typeof payload === "string") {
    return payload
    .replace(/<\|im_start\|>/g, "")
    .replace(/<\|im_end\|>/g, "")
    .replace(/<\|system\|>/g, "")
    .replace(/<\|user\|>/g, "")
    .replace(/<\|assistant\|>/g, "");
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePromptInjection(item, depth + 1));
  }
  if (payload && typeof payload === "object") {
    const clean = Object.create(null);
    for (const key of Object.keys(payload)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        throw new Error("Dangerous key detected in A2A payload");
      }
      clean[key] = sanitizePromptInjection(payload[key], depth + 1);
    }
    return clean;
  }
  return payload;
}

export function generateA2ASignature(bodyRaw, timestamp, nonce, secret) {
  const safeSecret = requireA2ASecret(secret);
  const hmac = crypto.createHmac("sha256", safeSecret);
  hmac.update(`${timestamp}:${nonce}:${bodyRaw}`);
  return hmac.digest("hex");
}

export function generateA2AEd25519Signature(bodyRaw, timestamp, nonce, privateKey) {
  const data = Buffer.from(`${timestamp}:${nonce}:${bodyRaw}`, "utf8");
  const signatureBuffer = crypto.sign(null, data, privateKey);
  return signatureBuffer.toString("hex");
}

export function verifyA2AEd25519Signature(bodyRaw, timestamp, nonce, signatureHex, publicKey) {
  if (typeof signatureHex !== "string" || !/^[a-f0-9]{128}$/i.test(signatureHex)) {
    return false;
  }
  try {
    const keyObject = normalizeEd25519PublicKey(publicKey);
    const data = Buffer.from(`${timestamp}:${nonce}:${bodyRaw}`, "utf8");
    const sigBuffer = Buffer.from(signatureHex, "hex");
    return crypto.verify(null, data, keyObject, sigBuffer);
  } catch {
    return false;
  }
}

function headerString(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value.length === 1 ? String(value[0]).trim() : "";
  return String(value ?? "").trim();
}

function timingSafeSignatureMatch(signature, expectedSignature) {
  if (!new RegExp(`^[a-f0-9]{${HMAC_SHA256_HEX_LENGTH}}$`, "i").test(signature)) return false;
  const left = Buffer.from(signature, "hex");
  const right = Buffer.from(expectedSignature, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function rememberNonce(cache, nonce, now, maxTimestampAgeMs, maxNonceCacheEntries) {
  for (const [key, seenAt] of cache.entries()) {
    if (now - seenAt > maxTimestampAgeMs) cache.delete(key);
  }
  if (cache.has(nonce)) return false;

  if (cache.size >= maxNonceCacheEntries) {
    throw new Error("Nonce cache exhausted with unexpired entries");
  }

  cache.set(nonce, now);
  return true;
}

export function a2aBoundaryGuard(secretOrOptions, explicitOptions = {}) {
  let secretKey = null;
  let options = explicitOptions;

  if (typeof secretOrOptions === "string") {
    secretKey = secretOrOptions;
  } else if (secretOrOptions && typeof secretOrOptions === "object") {
    secretKey = secretOrOptions.secretKey ?? secretOrOptions.secret ?? null;
    options = { ...secretOrOptions, ...explicitOptions };
  }

  const allowedAlgorithms = new Set(
    (options.allowedAlgorithms || ["hmac-sha256", "ed25519"]).map((a) => String(a).toLowerCase().trim())
  );

  let trustStore = options.trustStore || options.ed25519TrustStore || null;
  if (trustStore && !(trustStore instanceof Ed25519TrustStore)) {
    trustStore = new Ed25519TrustStore(trustStore);
  }

  let safeSecret = null;
  if (secretKey) {
    safeSecret = requireA2ASecret(secretKey);
  }

  if (!safeSecret && (!trustStore || trustStore.size() === 0)) {
    throw new Error("a2aBoundaryGuard requires either a valid secretKey (for HMAC) or a trustStore with at least one key (for Ed25519)");
  }

  const maxTimestampAgeMs = Number(options.maxTimestampAgeMs || MAX_TIMESTAMP_AGE_MS);
  const maxNonceCacheEntries = Number(options.maxNonceCacheEntries || MAX_NONCE_CACHE_ENTRIES);
  const nonceCache = options.nonceCache || NONCE_CACHE;
  const nowMs = typeof options.nowMs === "function" ? options.nowMs : () => Date.now();

  return function (req, res, next) {
    try {
      const signature = headerString(req.headers, "x-a2a-signature");
      const timestampStr = headerString(req.headers, "x-a2a-timestamp");
      const nonce = headerString(req.headers, "x-a2a-nonce");
      const algorithm = (headerString(req.headers, "x-a2a-algorithm") || "hmac-sha256").toLowerCase();
      const keyId = headerString(req.headers, "x-a2a-key-id");

      if (!signature || !timestampStr || !nonce) {
        return res.status(401).json({ ok: false, error: "Missing A2A security headers" });
      }

      if (!/^\d{10,17}$/.test(timestampStr)) {
        return res.status(400).json({ ok: false, error: "Invalid timestamp format" });
      }
      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(nonce)) {
        return res.status(400).json({ ok: false, error: "Invalid nonce format" });
      }

      const timestamp = Number(timestampStr);
      const now = nowMs();
      if (Math.abs(now - timestamp) > maxTimestampAgeMs) {
        return res.status(401).json({ ok: false, error: "Stale timestamp rejected" });
      }

      if (!rememberNonce(nonceCache, nonce, now, maxTimestampAgeMs, maxNonceCacheEntries)) {
        return res.status(401).json({ ok: false, error: "Replayed nonce rejected" });
      }

      if (typeof req.rawBody !== "string") {
        return res.status(400).json({ ok: false, error: "Raw request body required for A2A signature verification" });
      }

      if (!allowedAlgorithms.has(algorithm)) {
        nonceCache.delete(nonce);
        return res.status(401).json({ ok: false, error: "Unsupported A2A signature algorithm" });
      }

      if (algorithm === "ed25519") {
        if (!keyId) {
          nonceCache.delete(nonce);
          return res.status(401).json({ ok: false, error: "Missing x-a2a-key-id header for Ed25519 signature" });
        }
        if (!trustStore || !trustStore.hasKey(keyId)) {
          nonceCache.delete(nonce);
          return res.status(401).json({ ok: false, error: "Unknown A2A key ID" });
        }
        if (!/^[a-f0-9]{128}$/i.test(signature)) {
          nonceCache.delete(nonce);
          return res.status(401).json({ ok: false, error: "Invalid A2A signature" });
        }
        const pubKey = trustStore.getKey(keyId);
        const valid = verifyA2AEd25519Signature(req.rawBody, timestampStr, nonce, signature, pubKey);
        if (!valid) {
          nonceCache.delete(nonce);
          return res.status(401).json({ ok: false, error: "Invalid A2A signature" });
        }
        req.a2aAuth = {
          algorithm: "ed25519",
          keyId,
          verifiedAt: new Date(now).toISOString(),
        };
      } else if (algorithm === "hmac-sha256") {
        if (!safeSecret) {
          nonceCache.delete(nonce);
          return res.status(401).json({ ok: false, error: "HMAC-SHA256 authentication not configured" });
        }
        const expectedSignature = generateA2ASignature(req.rawBody, timestampStr, nonce, safeSecret);
        if (!timingSafeSignatureMatch(signature, expectedSignature)) {
          nonceCache.delete(nonce);
          return res.status(401).json({ ok: false, error: "Invalid A2A signature" });
        }
        req.a2aAuth = {
          algorithm: "hmac-sha256",
          verifiedAt: new Date(now).toISOString(),
        };
      } else {
        nonceCache.delete(nonce);
        return res.status(401).json({ ok: false, error: "Unsupported A2A signature algorithm" });
      }

      if (req.body && typeof req.body === "object") {
        req.body = sanitizePromptInjection(req.body);
      }

      return next();
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Malformed A2A request" });
    }
  };
}
