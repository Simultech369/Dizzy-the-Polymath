import crypto from "node:crypto";

const NONCE_CACHE = new Map();
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function sanitizePromptInjection(payload) {
  if (typeof payload !== "string") return payload;
  // Basic sanitization: remove common prompt injection markers
  return payload
    .replace(/<\|im_start\|>/g, "")
    .replace(/<\|im_end\|>/g, "")
    .replace(/<\|system\|>/g, "")
    .replace(/<\|user\|>/g, "")
    .replace(/<\|assistant\|>/g, "");
}

export function generateA2ASignature(bodyRaw, timestamp, nonce, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${timestamp}:${nonce}:${bodyRaw}`);
  return hmac.digest("hex");
}

export function a2aBoundaryGuard(secretKey) {
  return function (req, res, next) {
    try {
      const signature = req.headers["x-a2a-signature"];
      const timestampStr = req.headers["x-a2a-timestamp"];
      const nonce = req.headers["x-a2a-nonce"];

      if (!signature || !timestampStr || !nonce) {
        return res.status(401).json({ ok: false, error: "Missing A2A security headers" });
      }

      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp)) {
        return res.status(400).json({ ok: false, error: "Invalid timestamp format" });
      }

      const now = Date.now();
      if (Math.abs(now - timestamp) > MAX_TIMESTAMP_AGE_MS) {
        return res.status(401).json({ ok: false, error: "Stale timestamp rejected" });
      }

      // Cleanup old nonces occasionally
      if (Math.random() < 0.05) {
        for (const [key, time] of NONCE_CACHE.entries()) {
          if (now - time > MAX_TIMESTAMP_AGE_MS) NONCE_CACHE.delete(key);
        }
      }

      if (NONCE_CACHE.has(nonce)) {
        return res.status(401).json({ ok: false, error: "Replayed nonce rejected" });
      }

      const rawBody = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(req.body);
      const expectedSignature = generateA2ASignature(rawBody, timestampStr, nonce, secretKey);

      if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))) {
        return res.status(401).json({ ok: false, error: "Invalid A2A signature" });
      }

      // Record nonce
      NONCE_CACHE.set(nonce, now);

      // Sanitize payload body strings
      if (req.body && typeof req.body === "object") {
        for (const key of Object.keys(req.body)) {
          if (typeof req.body[key] === "string") {
            req.body[key] = sanitizePromptInjection(req.body[key]);
          }
        }
      }

      return next();
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Malformed A2A request" });
    }
  };
}
