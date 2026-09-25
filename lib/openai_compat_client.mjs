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

export function normalizeOpenAICompatUsage(rawUsage) {
  if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) return null;

  const hasInputTokens = "input_tokens" in rawUsage;
  const hasOutputTokens = "output_tokens" in rawUsage;

  const rawPrompt = hasInputTokens ? rawUsage.input_tokens : rawUsage.prompt_tokens;
  const rawCompletion = hasOutputTokens ? rawUsage.output_tokens : rawUsage.completion_tokens;

  if (rawPrompt === undefined && rawCompletion === undefined) return null;

  const promptTokens = parseUsageTokenCount(rawPrompt);
  const completionTokens = parseUsageTokenCount(rawCompletion);
  if (promptTokens === null || completionTokens === null) return null;

  const sum = promptTokens + completionTokens;
  if (!Number.isSafeInteger(sum)) return null;

  let totalTokens = sum;
  const hasTotal = "total_tokens" in rawUsage;
  if (hasTotal) {
    const parsedTotal = parseUsageTokenCount(rawUsage.total_tokens);
    if (parsedTotal === null || parsedTotal < totalTokens) {
      return null;
    }
    totalTokens = parsedTotal;
  }

  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return null;
  }

  const cacheCandidates = [];
  if (rawUsage.prompt_tokens_details && typeof rawUsage.prompt_tokens_details === "object" && "cached_tokens" in rawUsage.prompt_tokens_details) {
    cacheCandidates.push(rawUsage.prompt_tokens_details.cached_tokens);
  }
  if ("cached_tokens" in rawUsage) {
    cacheCandidates.push(rawUsage.cached_tokens);
  }
  if ("prompt_cache_hit_tokens" in rawUsage) {
    cacheCandidates.push(rawUsage.prompt_cache_hit_tokens);
  }

  let cachedTokens = 0;
  if (cacheCandidates.length > 0) {
    let agreedCache = null;
    for (const candidate of cacheCandidates) {
      const parsed = parseUsageTokenCount(candidate);
      if (parsed === null) return null;
      if (agreedCache === null) {
        agreedCache = parsed;
      } else if (agreedCache !== parsed) {
        return null;
      }
    }
    cachedTokens = agreedCache;
  }
  if (cachedTokens > promptTokens) return null;

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cached_tokens: cachedTokens,
    uncached_prompt_tokens: Math.max(0, promptTokens - cachedTokens),
  };
}

function parseUsageTokenCount(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }
  return null;
}

export async function openaiCompatGenerate({
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
  allowReasoningFallback = false,
  signal,
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
  if (isLocalIsolationRequired && isRemoteCloudBackend("openai_compat", url)) {
    const err = new Error("Remote OpenAI-compatible endpoint disallowed under local isolation policy");
    err.code = "LOCAL_ISOLATION_REMOTE_ENDPOINT_DISALLOWED";
    err.blocked_reason = "local_offline_cloud_blocked";
    throw err;
  }

  const endpoint = `${url.replace(/\/+$/, "")}/chat/completions`;
  const controller = new AbortController();
  const effectiveTimeoutMs = resolveOpenAICompatTimeoutMs({ baseUrl: url, timeoutMs });
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  signal?.addEventListener?.("abort", abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, effectiveTimeoutMs);

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
        const err = new Error("OpenAI-compat provider request failed");
        err.status = res.status;
        err.code = "PROVIDER_HTTP_ERROR";
        const providerCode = String(json?.error?.code || json?.code || "").trim();
        if (/^[A-Za-z0-9_.:-]{1,80}$/.test(providerCode)) err.provider_code = providerCode;
        throw err;
      }

      const choice = json?.choices?.[0];
      const rawContent = choice?.message?.content ?? choice?.text;
      let content = rawContent;
      const reasoningContent = choice?.message?.reasoning_content || choice?.message?.thinking || choice?.message?.reasoning || null;
      if (typeof rawContent === "string" && !rawContent.trim() && allowReasoningFallback) {
        content = reasoningContent;
      }
      if (Array.isArray(content)) {
        content = content.map((c) => (typeof c === "string" ? c : c?.text || "")).join("");
      }
      if (typeof content !== "string" || !content.trim()) {
        const err = new Error("OpenAI-compat provider returned empty response content");
        err.code = "EMPTY_RESPONSE";
        throw err;
      }

      const usage = normalizeOpenAICompatUsage(json?.usage);
      return {
        text: content.trim(),
        usage,
        reasoning_content: reasoningContent || null,
        model: json?.model || m,
        raw: json,
      };
  } catch (err) {
    if (err.name === "AbortError") {
      if (signal?.aborted && !timedOut) {
        const abortErr = new Error("OpenAI-compat provider request aborted by caller");
        abortErr.code = "REQUEST_ABORTED";
        throw abortErr;
      }
      const timeoutErr = new Error(`OpenAI-compat provider timed out after ${effectiveTimeoutMs}ms`);
      timeoutErr.code = "TIMEOUT";
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", abortFromCaller);
  }
}

export async function openaiCompatGenerateText(opts) {
  const result = await openaiCompatGenerate(opts);
  return result?.text || "";
}
