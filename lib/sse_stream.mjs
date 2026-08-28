import crypto from "node:crypto";

export const STREAM_RECEIPT_SCHEMA = "dizzy.stream_receipt.v1";

const SAFE_BODY_KEYS = new Set([
  "brief",
  "channel",
  "client_id",
  "continuity_mode",
  "effect",
  "from",
  "meta",
  "notify",
  "payload",
  "runtime_context",
  "service_id",
  "text",
  "tool",
  "zone",
]);

const EVENT_TYPES = new Set([
  "backpressure",
  "client_disconnect",
  "stream_complete",
  "stream_error",
  "stream_partial_failure",
  "stream_start",
]);

const STATUSES = new Set([
  "aborted",
  "backpressure",
  "client_aborted",
  "completed",
  "failed",
  "started",
  "unknown",
]);

const REASON_CODES = new Set([
  "",
  "agent_execute_rejected",
  "frame_write_aborted",
  "receipt_frame_too_large",
  "request_aborted",
  "request_accepted",
  "response_buffer_full",
  "response_closed_before_stream_complete",
  "result_emitted",
  "result_frame_too_large",
  "stream_drain_timeout",
  "stream_execution_failed",
  "stream_write_failed",
  "stream_write_closed",
]);

const ERROR_CODES = new Set([
  "",
  "FRAME_TOO_LARGE",
  "STREAM_DRAIN_TIMEOUT",
  "STREAM_EXECUTION_FAILED",
  "STREAM_WRITE_ABORTED",
  "STREAM_WRITE_FAILED",
  "STREAM_WRITE_CLOSED",
  "UNCLASSIFIED_ERROR",
]);

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        out[key] = sortJsonValue(value[key]);
        return out;
      }, {});
  }
  if (typeof value === "bigint") return String(value);
  if (typeof value === "undefined") return null;
  return value;
}

export function stableJson(value) {
  return JSON.stringify(sortJsonValue(value));
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

function cleanToken(value, fallback = "unknown", maxChars = 160) {
  const raw = String(value ?? "").trim().replace(/[\r\n]+/g, " ");
  return raw ? raw.slice(0, maxChars) : fallback;
}

function bodyKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value)
    .sort()
    .slice(0, 80)
    .map((key) => SAFE_BODY_KEYS.has(key) ? key : `sha256:${sha256Hex(key).slice(0, 16)}`);
}

function headerValue(headers, key) {
  if (!headers || typeof headers !== "object") return "";
  const direct = headers[key];
  const lower = headers[String(key).toLowerCase()];
  const value = direct ?? lower ?? "";
  return Array.isArray(value) ? value.join(",") : String(value);
}

export function nextStreamEventId(streamId, sequence) {
  const n = Number(sequence);
  const safeSequence = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  return `${cleanToken(streamId, "stream", 96)}:${String(safeSequence).padStart(6, "0")}`;
}

export function buildSseFrame({ id, event, data, retry } = {}) {
  const safeId = cleanToken(id, "", 180);
  const safeEvent = cleanToken(event, "message", 80).replace(/[^A-Za-z0-9_.:-]/g, "_");
  const payload = stableJson(data ?? null);
  const lines = [];

  if (safeId) lines.push(`id: ${safeId}`);
  lines.push(`event: ${safeEvent}`);
  if (retry !== undefined) {
    const retryMs = Number(retry);
    if (Number.isFinite(retryMs) && retryMs >= 0) lines.push(`retry: ${Math.floor(retryMs)}`);
  }
  for (const line of payload.split(/\r?\n/)) {
    lines.push(`data: ${line}`);
  }
  lines.push("");
  lines.push("");
  return lines.join("\n");
}

export function configureSseResponse(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function buildStreamReceipt({
  streamId,
  eventId,
  eventType,
  route = "/agent/execute/stream",
  method = "POST",
  status,
  reasonCode = "",
  reason,
  requestBody,
  headers,
  retryMs,
  framesAttempted = 0,
  framesWritten = 0,
  bytesWritten = 0,
  backpressureCount = 0,
  startedAtMs,
  completedAtMs,
  errorCode = "",
  now = new Date(),
} = {}) {
  const idempotencyKey = headerValue(headers, "idempotency-key");
  const lastEventId = headerValue(headers, "last-event-id");
  const bodySeen = requestBody !== undefined;
  const event = EVENT_TYPES.has(String(eventType)) ? String(eventType) : "stream_error";
  const safeStatus = STATUSES.has(String(status)) ? String(status) : "unknown";
  const rawReasonCode = String(reasonCode || reason || "");
  const safeReasonCode = REASON_CODES.has(rawReasonCode) ? rawReasonCode : "stream_execution_failed";
  const rawErrorCode = String(errorCode || "");
  const safeErrorCode = ERROR_CODES.has(rawErrorCode) ? rawErrorCode : (rawErrorCode ? "UNCLASSIFIED_ERROR" : "");

  return {
    schema_version: STREAM_RECEIPT_SCHEMA,
    authority: "stream_evidence_not_authority",
    t: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
    stream_id: cleanToken(streamId, "stream", 128),
    event_id: cleanToken(eventId, "none", 180),
    event_type: event,
    route: cleanToken(route, "/agent/execute/stream", 160),
    method: cleanToken(method, "POST", 12).toUpperCase(),
    status: safeStatus,
    reason_code: safeReasonCode,
    request_body_sha256: bodySeen ? sha256Hex(stableJson(requestBody)) : null,
    request_body_keys: bodyKeys(requestBody),
    idempotency_key_sha256: idempotencyKey ? sha256Hex(idempotencyKey) : null,
    last_event_id_sha256: lastEventId ? sha256Hex(lastEventId) : null,
    retry_ms: Number.isFinite(Number(retryMs)) ? Math.max(0, Math.floor(Number(retryMs))) : null,
    frames_attempted: Math.max(0, Math.floor(Number(framesAttempted) || 0)),
    frames_written: Math.max(0, Math.floor(Number(framesWritten) || 0)),
    bytes_written: Math.max(0, Math.floor(Number(bytesWritten) || 0)),
    backpressure_count: Math.max(0, Math.floor(Number(backpressureCount) || 0)),
    started_at_ms: Number.isFinite(Number(startedAtMs)) ? Math.floor(Number(startedAtMs)) : null,
    completed_at_ms: Number.isFinite(Number(completedAtMs)) ? Math.floor(Number(completedAtMs)) : null,
    error_code: safeErrorCode,
  };
}

function addAbortListener(signal, listener) {
  if (!signal?.addEventListener) return () => {};
  signal.addEventListener("abort", listener, { once: true });
  return () => signal.removeEventListener?.("abort", listener);
}

function addEmitterOnce(emitter, event, listener) {
  if (!emitter?.once) return () => {};
  emitter.once(event, listener);
  return () => emitter.removeListener?.(event, listener);
}

export async function writeSseFrame(res, frame, {
  signal,
  maxFrameBytes = 256 * 1024,
  drainTimeoutMs = 30_000,
  onBackpressure,
} = {}) {
  const bytes = Buffer.byteLength(String(frame), "utf8");
  if (Number.isFinite(Number(maxFrameBytes)) && bytes > Number(maxFrameBytes)) {
    return { ok: false, status: "frame_too_large", bytes };
  }
  if (signal?.aborted || res?.writableEnded || res?.destroyed) {
    return { ok: false, status: "aborted", bytes };
  }

  let accepted = false;
  try {
    accepted = res.write(frame);
  } catch {
    return { ok: false, status: "write_failed", bytes };
  }
  if (accepted) return { ok: true, status: "written", bytes };

  onBackpressure?.({ bytes });
  if (signal?.aborted || res?.writableEnded || res?.destroyed) {
    return { ok: false, status: "aborted", bytes };
  }

  const status = await new Promise((resolve) => {
    const cleanups = [];
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      for (const cleanup of cleanups.splice(0)) cleanup();
      resolve(value);
    };
    cleanups.push(addEmitterOnce(res, "drain", () => finish("drained")));
    cleanups.push(addEmitterOnce(res, "close", () => finish("closed")));
    cleanups.push(addAbortListener(signal, () => finish("aborted")));
    const timeoutMs = Number(drainTimeoutMs);
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      const timer = setTimeout(() => finish("drain_timeout"), Math.floor(timeoutMs));
      if (typeof timer.unref === "function") timer.unref();
      cleanups.push(() => clearTimeout(timer));
    }
  });

  return status === "drained"
    ? { ok: true, status, bytes }
    : { ok: false, status, bytes };
}
