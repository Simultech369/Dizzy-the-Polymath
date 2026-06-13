import { assessCaptureEligibility } from "./capture_eligibility.mjs";

const ALLOWED_DURABLE_ZONES = new Set(["private_self", "trusted_collaborator"]);

const SECRET_PATTERNS = [
  [/\b(\d{6,}):([A-Za-z0-9_-]{20,})\b/g, "[REDACTED_TELEGRAM_TOKEN]"],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]"],
  [/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[REDACTED_API_KEY]"],
  [/\b([A-Z0-9_]{2,64}(?:API|TOKEN|SECRET|KEY)[A-Z0-9_]{0,64})=([^\s]{6,})\b/g, "$1=[REDACTED]"],
];

function payloadText(payload) {
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload ?? "");
  } catch {
    return String(payload ?? "");
  }
}

export function redactSecretMaterial(value) {
  let text = String(value ?? "").replace(/\r\n/g, "\n");
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

export function assessDurableWrite(input = {}) {
  const kind = String(input.kind || "durable_memory").trim() || "durable_memory";
  const trustZone = String(input.trustZone || "private_self").trim().toLowerCase();
  const sensitivity = String(input.sensitivityClass || input.payload?.sensitivity_class || "normal").trim().toLowerCase();
  const raw = payloadText(input.payload);

  if (!ALLOWED_DURABLE_ZONES.has(trustZone)) {
    return { allowed: false, reason: "trust_zone_blocked", kind, trust_zone: trustZone };
  }
  if (["do_not_persist", "ephemeral", "transient"].includes(sensitivity)) {
    return { allowed: false, reason: "sensitivity_blocks_persistence", kind, trust_zone: trustZone };
  }
  if (redactSecretMaterial(raw) !== raw) {
    return { allowed: false, reason: "secret_material_detected", kind, trust_zone: trustZone };
  }

  if (input.requireDurableValue !== false) {
    let eligibility = assessCaptureEligibility({
      kind,
      ...(typeof input.payload === "string" ? { text: input.payload } : { payload: input.payload }),
      minWords: Math.max(1, Number(input.minWords ?? 6) || 6),
    });
    if (!eligibility.eligible && eligibility.reason === "empty_capture" && input.payload && typeof input.payload === "object") {
      eligibility = assessCaptureEligibility({
        kind,
        text: raw,
        minWords: Math.max(1, Number(input.minWords ?? 6) || 6),
      });
    }
    if (!eligibility.eligible) {
      return { allowed: false, reason: `capture_ineligible:${eligibility.reason}`, kind, trust_zone: trustZone, eligibility };
    }
  }

  return { allowed: true, reason: "allowed", kind, trust_zone: trustZone };
}

export function assertDurableWriteAllowed(input = {}) {
  const result = assessDurableWrite(input);
  if (!result.allowed) {
    const error = new Error(`durable write blocked: ${result.reason}`);
    error.code = "DURABLE_WRITE_BLOCKED";
    error.result = result;
    throw error;
  }
  return result;
}
