import crypto from "node:crypto";

const NONCE_CACHE = new Map();
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_NONCE_CACHE_ENTRIES = 10_000;
const HMAC_SHA256_HEX_LENGTH = 64;

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

export function a2aBoundaryGuard(secretKey, options = {}) {
  const safeSecret = requireA2ASecret(secretKey);
  const maxTimestampAgeMs = Number(options.maxTimestampAgeMs || MAX_TIMESTAMP_AGE_MS);
  const maxNonceCacheEntries = Number(options.maxNonceCacheEntries || MAX_NONCE_CACHE_ENTRIES);
  const nonceCache = options.nonceCache || NONCE_CACHE;
  const nowMs = typeof options.nowMs === "function" ? options.nowMs : () => Date.now();

  return function (req, res, next) {
    try {
      const signature = headerString(req.headers, "x-a2a-signature");
      const timestampStr = headerString(req.headers, "x-a2a-timestamp");
      const nonce = headerString(req.headers, "x-a2a-nonce");

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
      
      const rawBody = req.rawBody;
      const expectedSignature = generateA2ASignature(rawBody, timestampStr, nonce, safeSecret);

      if (!timingSafeSignatureMatch(signature, expectedSignature)) {
        nonceCache.delete(nonce);
        return res.status(401).json({ ok: false, error: "Invalid A2A signature" });
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
