import {
  isRemoteCloudBackend,
  normalizeOpenAICompatModelForBaseUrl,
  resolveOpenAICompatTimeoutMs,
} from "./model_router.mjs";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function toOpenAICompatMessages({ systemPrompt, messages }) {
  const out = [];
  const sys = String(systemPrompt || "").trim();
  if (sys) out.push({ role: "system", content: sys });

  if (Array.isArray(messages)) {
    for (const m of messages) {
      if (!m || typeof m !== "object") continue;
      const role = String(m.role || "").trim().toLowerCase();
      const text = String(m.text || m.content || "").trim();
      if (!text) continue;
      if (role === "user" || role === "assistant" || role === "system") {
        out.push({ role, content: text });
      }
    }
  }
  return out;
}

export async function openaiCompatGenerateText({
  baseUrl,
  apiKey,
  model,
  systemPrompt,
  messages,
  timeoutMs = 20000,
  temperature = 0.7,
  maxTokens = 500,
  responseFormat,
  isLocalIsolationRequired = false,
}) {
  const url = String(baseUrl || env("OPENAI_COMPAT_BASE_URL", "")).trim();
  const rawModel = String(model || env("OPENAI_COMPAT_MODEL", "")).trim();
  const m = normalizeOpenAICompatModelForBaseUrl({
    baseUrl: url,
    model: rawModel,
    localFallbackModel: env("OLLAMA_MODEL", "gemma3:4b"),
  });
  if (!url) {
    const err = new Error("OPENAI_COMPAT_BASE_URL is missing");
    err.code = "MISSING_BASE_URL";
    throw err;
  }
  if (!m) {
    const err = new Error("OPENAI_COMPAT_MODEL is missing");
    err.code = "MISSING_MODEL";
    throw err;
  }

  const endpoint = `${url.replace(/\/+$/, "")}/chat/completions`;
  const controller = new AbortController();
  const effectiveTimeoutMs = resolveOpenAICompatTimeoutMs({ baseUrl: url, timeoutMs });
  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${String(apiKey).trim()}` } : {}),
      },
      body: JSON.stringify({
        model: m,
        temperature,
        ...(Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0 ? { max_tokens: Number(maxTokens) } : {}),
        ...(responseFormat && typeof responseFormat === "object" ? { response_format: responseFormat } : {}),
        messages: toOpenAICompatMessages({ systemPrompt, messages }),
      }),
      signal: controller.signal,
    });

      // Handle manual redirects
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) {
          const err = new Error(`HTTP redirect ${res.status} missing Location header`);
          err.status = res.status;
          throw err;
        }

        const targetUrl = new URL(location, endpoint).toString();
        const targetIsRemote = isRemoteCloudBackend("openai_compat", targetUrl);
        const err = new Error(
          targetIsRemote || isLocalIsolationRequired
            ? "HTTP redirect disallowed under local isolation policy"
            : "HTTP redirect disallowed for OpenAI-compatible provider",
        );
        err.status = res.status;
        err.code = "REDIRECT_TO_CLOUD_DISALLOWED";
        err.blocked_reason = "redirect_to_cloud_disallowed";
        throw err;
      }

      const raw = await res.text();
      let json = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        // ignore
      }

      if (!res.ok) {
        const message = json?.error?.message || json?.message || raw || `HTTP ${res.status}`;
        const err = new Error(`OpenAI-compat provider error (${res.status}): ${message}`);
        err.status = res.status;
        err.code = "PROVIDER_HTTP_ERROR";
        throw err;
      }

      const choice = json?.choices?.[0];
      const rawContent = choice?.message?.content;
      let content = rawContent;
      if (typeof rawContent === "string" && !rawContent.trim()) {
        content = choice?.message?.reasoning_content || choice?.message?.thinking || choice?.message?.reasoning || choice?.text;
      }
      if (Array.isArray(content)) {
        content = content.map((c) => (typeof c === "string" ? c : c?.text || "")).join("");
      }
      if (typeof content !== "string" || !content.trim()) {
        const err = new Error("OpenAI-compat provider returned empty response content");
        err.code = "EMPTY_RESPONSE";
        throw err;
      }

    return content.trim();
  } catch (err) {
    if (err.name === "AbortError") {
      const timeoutErr = new Error(`OpenAI-compat provider timed out after ${effectiveTimeoutMs}ms`);
      timeoutErr.code = "TIMEOUT";
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
