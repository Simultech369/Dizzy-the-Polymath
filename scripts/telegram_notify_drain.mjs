import fs from "fs";
import path from "path";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function normalizeEnvValue(v) {
  const s = String(v ?? "").trim();
  return s.replace(/^["']|["']$/g, "").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function appendJsonl(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, "utf8");
}

function truncate(s, max = 1800) {
  const text = String(s ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function formatNotification(n) {
  const kind = String(n?.kind ?? "notification");
  if (kind !== "job_dead") {
    return truncate(`[${kind}] ${JSON.stringify(n)}`, 3500);
  }

  const job = n?.job ?? {};
  const id = String(job.id ?? "");
  const tool = String(job.tool ?? "");
  const effect = String(job.effect ?? "");
  const attempts = Number(job.attempts ?? 0);
  const maxAttempts = Number(job.max_attempts ?? 0);
  const retryCount = Number(job.retry_count ?? 0);
  const maxRetries = Number(job.max_retries ?? 0);
  const reason = String(job.last_retry_reason ?? "");
  const dlq = String(job.dead_letter_path ?? "");
  const err = String(job.last_error ?? "");

  const lines = [
    "Dizzy: job dead",
    id ? `id: ${id}` : null,
    tool ? `tool: ${tool}` : null,
    effect ? `effect: ${effect}` : null,
    `attempts: ${attempts}/${maxAttempts || "?"} (retries ${retryCount}/${maxRetries || "?"}${reason ? `, last=${reason}` : ""})`,
    dlq ? `dlq: ${dlq}` : null,
    err ? `error: ${truncate(err, 1200)}` : null,
    "",
    "Next:",
    id ? `- Check: GET /jobs/${id}` : null,
    dlq ? "- Inspect DLQ file path above" : "- Inspect runtime/dlq JSONL",
  ].filter(Boolean);

  return truncate(lines.join("\n"), 3500);
}

async function fetchJson(url, headers, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text();
    const json = safeJsonParse(text);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = text.slice(0, 2000);
      throw err;
    }
    if (!json) throw new Error("Invalid JSON response");
    return json;
  } finally {
    clearTimeout(t);
  }
}

async function telegramSendMessage({ token, chatId, text }) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`Telegram HTTP ${res.status}`);
    err.status = res.status;
    err.body = raw.slice(0, 2000);
    throw err;
  }
  const parsed = safeJsonParse(raw);
  if (parsed?.ok !== true) {
    const err = new Error("Telegram sendMessage failed");
    err.body = raw.slice(0, 2000);
    throw err;
  }
  return parsed;
}

async function main() {
  const baseUrl = normalizeEnvValue(env("DIZZY_BASE_URL", "http://127.0.0.1:3000")).replace(/\/$/, "");
  const channel = normalizeEnvValue(env("DIZZY_NOTIFY_CHANNEL", "telegram"));
  const limit = Math.max(1, Math.min(200, Number(env("DIZZY_NOTIFY_LIMIT", "50")) || 50));
  const pollMs = Math.max(250, Number(env("DIZZY_DRAIN_INTERVAL_MS", "5000")) || 5000);
  const runOnce = env("DIZZY_DRAIN_ONCE", "") === "1";

  const authToken = normalizeEnvValue(env("DIZZY_AUTH_TOKEN", ""));
  const token = normalizeEnvValue(env("TELEGRAM_BOT_TOKEN", ""));
  const chatId = normalizeEnvValue(env("TELEGRAM_CHAT_ID", ""));

  if (!token || !chatId) {
    console.error("Missing env vars: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required.");
    process.exit(2);
  }

  const headers = {};
  if (authToken) headers.authorization = `Bearer ${authToken}`;

  const failedLog = path.resolve(process.cwd(), "runtime", "notify_failed.jsonl");
  console.log(`[telegram_drain] base=${baseUrl} channel=${channel} poll_ms=${pollMs} limit=${limit} once=${runOnce ? "1" : "0"}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let batch;
    try {
      batch = await fetchJson(`${baseUrl}/notify/${encodeURIComponent(channel)}?limit=${limit}`, headers, 15000);
    } catch (e) {
      console.error(`[telegram_drain] notify fetch error: ${String(e?.message ?? e)}`);
      if (runOnce) process.exit(1);
      await sleep(pollMs);
      continue;
    }

    const notifications = Array.isArray(batch?.notifications) ? batch.notifications : [];
    if (notifications.length === 0) {
      if (runOnce) return;
      await sleep(pollMs);
      continue;
    }

    for (const n of notifications) {
      const text = formatNotification(n);
      try {
        await telegramSendMessage({ token, chatId, text });
      } catch (e) {
        const msg = String(e?.message ?? e);
        console.error(`[telegram_drain] send error: ${msg}`);
        appendJsonl(failedLog, { at: nowIso(), error: msg, notification: n });
      }
      await sleep(250);
    }

    if (runOnce) return;
  }
}

main().catch((e) => {
  console.error(`[telegram_drain] fatal: ${String(e?.message ?? e)}`);
  process.exit(1);
});
