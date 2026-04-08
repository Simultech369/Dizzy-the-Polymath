import fs from "fs";
import path from "path";
import { assertRuntimeSafetyConfig } from "../lib/runtime_config.mjs";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function parseBoolEnv(name, fallback = false) {
  const raw = String(env(name, fallback ? "1" : "0")).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function normalizeEnvValue(v) {
  const s = String(v ?? "").trim();
  return s.replace(/^["']|["']$/g, "").trim();
}

function parseAllowChatIds(raw) {
  const norm = normalizeEnvValue(raw);
  if (!norm) return [];
  return norm
    .split(",")
    .map((s) => normalizeEnvValue(s))
    .filter(Boolean);
}

function truncate(s, max = 3500) {
  const text = String(s ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function formatError(e) {
  const msg = String(e?.message ?? e);
  const body = e?.body ? String(e.body) : "";
  const cause = e?.cause;
  if (cause && typeof cause === "object") {
    const code = cause.code || cause.errno || "";
    const address = cause.address || "";
    const port = cause.port || "";
    const where = address && port ? `${address}:${port}` : (address || port || "");
    const extra = [code, where].filter(Boolean).join(" ");
    const b = body ? ` body=${body.slice(0, 600)}` : "";
    if (extra) return `${msg} (${extra})${b}`;
    if (b) return `${msg}${b}`;
    return msg;
  }
  if (body) return `${msg} body=${body.slice(0, 600)}`;
  return msg;
}

async function telegramSendLongMessage({ token, chatId, text, replyToMessageId = null }) {
  const msg = String(text ?? "");
  const chunks = [];
  for (let i = 0; i < msg.length; i += 3500) chunks.push(msg.slice(i, i + 3500));
  for (let idx = 0; idx < chunks.length; idx++) {
    // Reply only on the first chunk to avoid noisy threading.
    // eslint-disable-next-line no-await-in-loop
    await telegramSendMessage({
      token,
      chatId,
      replyToMessageId: idx === 0 ? replyToMessageId : null,
      text: chunks[idx],
    });
    // eslint-disable-next-line no-await-in-loop
    await sleep(250);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireSingleInstanceLock(lockPath) {
  const p = String(lockPath || "").trim();
  if (!p) return null;

  ensureDir(path.dirname(p));

  const payload = JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }, null, 2);

  try {
    const fd = fs.openSync(p, "wx");
    try {
      fs.writeFileSync(fd, payload, "utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch (e) {
    if (e && (e.code === "EEXIST" || e.code === "EPERM")) {
      let existing = null;
      try {
        existing = safeJsonParse(fs.readFileSync(p, "utf8"));
      } catch {
        existing = null;
      }

      const otherPid = Number(existing?.pid ?? 0) || 0;
      if (isPidAlive(otherPid)) {
        const msg = `[telegram_relay] Another relay appears to be running (pid=${otherPid}). Close the other 'Dizzy Telegram Relay' window, or set TELEGRAM_ALLOW_MULTI=1 to bypass.`;
        console.error(msg);
        process.exit(7);
      }

      // Stale lock; overwrite.
      atomicWriteText(p, `${payload}\n`);
    } else {
      throw e;
    }
  }

  const cleanup = () => {
    try {
      const cur = safeJsonParse(fs.readFileSync(p, "utf8"));
      if (Number(cur?.pid ?? 0) === process.pid) fs.unlinkSync(p);
    } catch {
      // ignore
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  return p;
}

function atomicWriteText(filePath, text) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, text, "utf8");
  try {
    fs.renameSync(tmp, filePath);
  } catch {
    fs.copyFileSync(tmp, filePath);
    fs.unlinkSync(tmp);
  }
}

function loadOffset(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = safeJsonParse(raw);
    const off = Number(parsed?.update_offset);
    return Number.isFinite(off) ? off : 0;
  } catch {
    return 0;
  }
}

function saveOffset(filePath, offset) {
  atomicWriteText(filePath, `${JSON.stringify({ update_offset: offset }, null, 2)}\n`);
}

async function fetchJson(url, opts = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
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

async function telegramGetUpdates({ token, offset, timeoutSec }) {
  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  if (offset) url.searchParams.set("offset", String(offset));
  url.searchParams.set("timeout", String(timeoutSec));
  const json = await fetchJson(url.toString(), { method: "GET" }, (timeoutSec + 5) * 1000);
  if (json?.ok !== true) throw new Error("Telegram getUpdates failed");
  return Array.isArray(json?.result) ? json.result : [];
}

async function telegramSendMessage({ token, chatId, text, replyToMessageId = null }) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: truncate(text ?? "", 3500),
    disable_web_page_preview: true,
  };
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;

  const json = await fetchJson(
    url,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    20000,
  );
  if (json?.ok !== true) throw new Error("Telegram sendMessage failed");
  return json;
}

async function dizzyDispatch({ baseUrl, headers, message }) {
  const url = `${baseUrl.replace(/\/$/, "")}/dispatch/incoming`;
  const json = await fetchJson(
    url,
    { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(message) },
    20000,
  );
  return json;
}

async function pollJobUntilDone({ baseUrl, headers, jobId, timeoutMs = 60000, pollMs = 1000 }) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const url = `${baseUrl.replace(/\/$/, "")}/jobs/${encodeURIComponent(jobId)}`;
    const json = await fetchJson(url, { method: "GET", headers }, 20000);
    const status = json?.job?.status || "";
    if (status === "succeeded" || status === "dead") return json?.job ?? null;
    await sleep(pollMs);
  }
  return null;
}

function formatDizzyReply(out) {
  if (!out || typeof out !== "object") return String(out);
  if (out.kind === "reply") return String(out.text ?? "");
  if (out.kind === "ack") return String(out.text ?? "");
  return JSON.stringify(out, null, 2);
}

async function processTelegramUpdate({
  update,
  token,
  baseUrl,
  headers,
  allowSet,
  allowAutoBind,
  loggedMismatchRef,
  pollJob,
  jobTimeoutMs,
  debug,
}) {
  const msg = update?.message ?? update?.edited_message ?? null;
  const text = String(msg?.text ?? "").trim();
  const chatId = msg?.chat?.id != null ? String(msg.chat.id) : "";
  const chatType = msg?.chat?.type != null ? String(msg.chat.type) : "";
  const chatTitle = msg?.chat?.title != null ? String(msg.chat.title) : "";
  const messageId = msg?.message_id ?? null;
  const userId = msg?.from?.id != null ? String(msg.from.id) : null;
  const username = msg?.from?.username != null ? String(msg.from.username) : null;

  if (!chatId) return;

  if (!allowSet.size && allowAutoBind) {
    if (chatType !== "private") {
      if (debug) console.log(`[telegram_relay] auto-bind skip non-private chat_id=${chatId} type=${chatType}`);
      return;
    }
    allowSet.add(chatId);
    console.log(`[telegram_relay] auto-bound allow_chat=${chatId}`);
    await telegramSendMessage({
      token,
      chatId,
      text: `Bound this DM as allow_chat=${chatId}. Persist it by setting TELEGRAM_CHAT_ID=${chatId}.`,
    });
  }

  if (!allowSet.has(chatId)) {
    if (!loggedMismatchRef.value) {
      loggedMismatchRef.value = true;
      console.log(
        `[telegram_relay] ignoring chat_id=${chatId} type=${chatType || "?"}${chatTitle ? ` title=${chatTitle}` : ""} (allow_chat=${[...allowSet].join(",") || "(none)"})`,
      );
      console.log(`[telegram_relay] fix: set TELEGRAM_CHAT_ID=${chatId} (or include it in a comma-separated list).`);
    }
    return;
  }
  if (!text) return;

  if (text === "/start" || text === "/help") {
    await telegramSendLongMessage({
      token,
      chatId,
      replyToMessageId: messageId,
      text: [
        "Dizzy relay is online.",
        "",
        "Send plain text to get a reply, or use explicit tool calls:",
        "- tool:http_get https://example.com",
        "- tool:cheerio_extract https://example.com h1",
        "",
        "Job results are polled only if TELEGRAM_POLL_JOB_RESULTS=1.",
        "",
        "Commands:",
        "- /governance (show interaction norms)",
        "- /health (show local runtime health)",
        "- /prompt (show which local prompt files are loaded)",
        "- /remember (write a compact session summary to memory/; remote writes require DIZZY_ALLOW_REMOTE_MUTATIONS=1)",
        "- /memory_review (propose curated memory updates; remote writes require DIZZY_ALLOW_REMOTE_MUTATIONS=1)",
        "- /improve (privileged local operator feature; requires DIZZY_ALLOW_SELF_MODIFY=1 in the local environment)",
        "- /apply <id> CONFIRM (privileged local operator feature; requires DIZZY_ALLOW_SELF_MODIFY=1 in the local environment)",
      ].join("\\n"),
    });
    return;
  }

  if (text === "/governance") {
    const gov = await fetch(`${baseUrl.replace(/\/$/, "")}/governance`, { headers }).then((r) => r.text());
    await telegramSendLongMessage({ token, chatId, replyToMessageId: messageId, text: gov });
    return;
  }

  if (text === "/health") {
    const health = await fetchJson(`${baseUrl.replace(/\/$/, "")}/health`, { method: "GET", headers }, 20000);
    await telegramSendLongMessage({
      token,
      chatId,
      replyToMessageId: messageId,
      text: `Health:\n${JSON.stringify(health, null, 2)}`,
    });
    return;
  }

  if (text === "/prompt") {
    const promptInfo = await fetchJson(`${baseUrl.replace(/\/$/, "")}/prompt`, { method: "GET", headers }, 20000);
    await telegramSendLongMessage({
      token,
      chatId,
      replyToMessageId: messageId,
      text: `Prompt:\n${JSON.stringify(promptInfo, null, 2)}`,
    });
    return;
  }

  const out = await dizzyDispatch({
    baseUrl,
    headers,
    message: {
      channel: "telegram",
      from: userId ? `telegram:${userId}` : "telegram:unknown",
      text,
      meta: { telegram: { chat_id: chatId, message_id: messageId, user_id: userId, username } },
    },
  });

  await telegramSendMessage({
    token,
    chatId,
    replyToMessageId: messageId,
    text: formatDizzyReply(out),
  });

  if (pollJob && out?.kind === "ack" && out?.job_id) {
    const job = await pollJobUntilDone({ baseUrl, headers, jobId: String(out.job_id), timeoutMs: jobTimeoutMs });
    if (job) {
      const status = String(job.status || "");
      const summary = status === "succeeded"
        ? `Job ${job.id} succeeded: ${truncate(JSON.stringify(job.result ?? null), 1500)}`
        : `Job ${job.id} ended as ${status}. Check /notify or /jobs/${job.id}.`;
      await telegramSendMessage({ token, chatId, text: summary });
    } else {
      await telegramSendMessage({ token, chatId, text: `Job ${String(out.job_id)} still running. Check /jobs/${String(out.job_id)} later.` });
    }
  }
}

async function main() {
  assertRuntimeSafetyConfig();
  const token = normalizeEnvValue(env("TELEGRAM_BOT_TOKEN", ""));
  const allowChatIds = parseAllowChatIds(env("TELEGRAM_CHAT_ID", ""));
  const baseUrl = normalizeEnvValue(env("DIZZY_BASE_URL", "http://127.0.0.1:3000"));
  const authToken = normalizeEnvValue(env("DIZZY_AUTH_TOKEN", ""));

  const timeoutSec = Math.max(5, Math.min(50, Number(env("TELEGRAM_POLL_TIMEOUT_SEC", "30")) || 30));
  const idleMs = Math.max(250, Number(env("TELEGRAM_POLL_IDLE_MS", "500")) || 500);
  const pollJob = env("TELEGRAM_POLL_JOB_RESULTS", "") === "1";
  const jobTimeoutMs = Math.max(5000, Number(env("TELEGRAM_JOB_TIMEOUT_MS", "60000")) || 60000);
  const debug = env("TELEGRAM_DEBUG", "") === "1";
  const resetOffset = env("TELEGRAM_OFFSET_RESET", "") === "1";
  const allowAutoBind = env("TELEGRAM_ALLOW_AUTO_BIND", "") === "1";
  const allowMulti = env("TELEGRAM_ALLOW_MULTI", "") === "1";
  const sendStartupMessage = parseBoolEnv("TELEGRAM_SEND_STARTUP_MESSAGE", false);

  if (!allowMulti) {
    const lockPath = path.resolve(process.cwd(), "runtime", "telegram_relay.lock");
    acquireSingleInstanceLock(lockPath);
  }

  if (!token || (!allowChatIds.length && !allowAutoBind)) {
    console.error("Missing env vars: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required (or set TELEGRAM_ALLOW_AUTO_BIND=1).");
    process.exit(2);
  }

  const headers = {};
  if (authToken) headers.authorization = `Bearer ${authToken}`;

  const offsetPath = path.resolve(process.cwd(), "runtime", "telegram_offset.json");
  let offset = loadOffset(offsetPath);
  if (resetOffset) {
    offset = 0;
    saveOffset(offsetPath, 0);
  }

  let allowSet = new Set(allowChatIds.map(String));
  const primaryAllowChat = allowChatIds.length ? allowChatIds[0] : "";

  console.log(
    `[telegram_relay] base=${baseUrl} allow_chat=${allowChatIds.length ? allowChatIds.join(",") : "(auto)"} offset=${offset || 0} poll_job=${pollJob ? "1" : "0"}`,
  );

  const loggedMismatchRef = { value: false };

  if (sendStartupMessage) {
    try {
      if (primaryAllowChat) {
        await telegramSendMessage({ token, chatId: primaryAllowChat, text: "Dizzy relay online. Send /help." });
      } else if (allowAutoBind) {
        console.log("[telegram_relay] auto-bind enabled; waiting for first inbound message to bind chat id.");
      }
    } catch (e) {
      const body = e?.body ? ` body=${String(e.body)}` : "";
      console.error(`[telegram_relay] startup send error: ${String(e?.message ?? e)}${body}`);
    }
  } else if (allowAutoBind) {
    console.log("[telegram_relay] auto-bind enabled; waiting for first inbound message to bind chat id.");
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let updates = [];
    try {
      updates = await telegramGetUpdates({ token, offset: offset ? offset : undefined, timeoutSec });
    } catch (e) {
      const body = debug && e?.body ? ` body=${String(e.body)}` : "";
      console.error(`[telegram_relay] getUpdates error: ${String(e?.message ?? e)}${body}`);
      await sleep(2000);
      continue;
    }

    if (debug) {
      const first = updates.length ? updates[0]?.update_id : null;
      const last = updates.length ? updates[updates.length - 1]?.update_id : null;
      console.log(`[telegram_relay] updates=${updates.length}${first != null ? ` first=${first}` : ""}${last != null ? ` last=${last}` : ""}`);
    }

    if (!updates.length) {
      await sleep(idleMs);
      continue;
    }

    for (const u of updates) {
      const updateId = Number(u?.update_id ?? 0);
      const nextOffset = Number.isFinite(updateId) ? Math.max(offset, updateId + 1) : offset;

      try {
        await processTelegramUpdate({
          update: u,
          token,
          baseUrl,
          headers,
          allowSet,
          allowAutoBind,
          loggedMismatchRef,
          pollJob,
          jobTimeoutMs,
          debug,
        });
        offset = nextOffset;
        saveOffset(offsetPath, offset);
      } catch (e) {
        const msg = u?.message ?? u?.edited_message ?? null;
        const chatId = msg?.chat?.id != null ? String(msg.chat.id) : "";
        const messageId = msg?.message_id ?? null;
        const errText = String(msg?.text ?? "").trim();
        const prefix = errText === "/governance"
          ? "Governance fetch error"
          : errText === "/health"
            ? "Health fetch error"
            : errText === "/prompt"
              ? "Prompt fetch error"
              : "Dispatch error";
        const suffix = prefix === "Dispatch error" ? ". Try /health." : "";

        if (!chatId) {
          console.error(`[telegram_relay] update processing error before chat resolution: ${formatError(e)}`);
          break;
        }

        try {
          await telegramSendMessage({
            token,
            chatId,
            replyToMessageId: messageId,
            text: `${prefix}: ${formatError(e)} (base=${baseUrl})${suffix}`,
          });
          offset = nextOffset;
          saveOffset(offsetPath, offset);
        } catch (sendErr) {
          console.error(`[telegram_relay] failed to send error reply for update ${updateId || "?"}: ${formatError(sendErr)}`);
          break;
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(`[telegram_relay] fatal: ${String(e?.message ?? e)}`);
  process.exit(1);
});
