function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickTextFromGeminiResponse(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return "";
  return parts
    .filter((p) => p && p.thought !== true && String(p.thought || "").toLowerCase() !== "true")
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

async function fetchJson(url, opts = {}, timeoutMs = 20000) {
  const method = String(opts?.method ?? "POST").toUpperCase();
  const body = opts?.body === undefined ? null : opts.body;
  const headers = opts?.headers ? { ...opts.headers } : {};
  const callerSignal = opts?.signal;
  const ctrl = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => ctrl.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  callerSignal?.addEventListener?.("abort", abortFromCaller, { once: true });
  const t = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  try {
    if (method !== "GET") headers["content-type"] = headers["content-type"] || "application/json";

    const res = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    const json = safeJsonParse(raw);
    if (!res.ok) {
    const err = new Error(`Gemini HTTP ${res.status}`);
    err.status = res.status;
    err.body = raw.slice(0, 4000);
    throw err;
  }
  if (!json) throw new Error("Gemini returned invalid JSON");
  return json;
  } catch (err) {
    if (err.name === "AbortError") {
      const abortErr = new Error(timedOut
        ? `Gemini provider timed out after ${timeoutMs}ms`
        : "Gemini provider request aborted by caller");
      abortErr.code = timedOut ? "TIMEOUT" : "REQUEST_ABORTED";
      throw abortErr;
    }
    throw err;
  } finally {
    clearTimeout(t);
    callerSignal?.removeEventListener?.("abort", abortFromCaller);
  }
}

function toGeminiContents(messages) {
  const out = [];
  for (const m of messages || []) {
    const role = m?.role === "assistant" ? "model" : "user";
    const text = String(m?.text ?? "").trim();
    if (!text) continue;
    out.push({ role, parts: [{ text }] });
  }
  return out;
}

function normalizeModelId(model) {
  let m = String(model ?? "").trim();
  // Accept common prefixes people paste from docs / wrappers.
  m = m.replace(/^models\//i, "");
  m = m.replace(/^google\//i, "");
  m = m.replace(/^gemini\//i, "");
  return m.trim();
}

function buildGenerateContentUrl({ apiVersion, apiKey, model }) {
  return `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function buildListModelsUrl({ apiVersion, apiKey, pageSize = 100, pageToken = "" }) {
  const url = new URL(`https://generativelanguage.googleapis.com/${apiVersion}/models`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("pageSize", String(pageSize));
  if (pageToken) url.searchParams.set("pageToken", String(pageToken));
  return url.toString();
}

async function listModels({ apiVersion, apiKey, timeoutMs, signal }) {
  const models = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const url = buildListModelsUrl({ apiVersion, apiKey, pageSize: 100, pageToken });
    // eslint-disable-next-line no-await-in-loop
    const json = await fetchJson(url, { method: "GET", signal }, timeoutMs);
    const pageModels = Array.isArray(json?.models) ? json.models : [];
    for (const m of pageModels) {
      if (m && typeof m.name === "string") models.push(m);
    }
    pageToken = String(json?.nextPageToken ?? "").trim();
    if (!pageToken) break;
  }
  return models;
}

function supportsGenerateContent(modelObj) {
  const methods = modelObj?.supportedGenerationMethods;
  if (!Array.isArray(methods)) return false;
  return methods.map(String).includes("generateContent");
}

function pickFallbackModelId(modelObjs) {
  const candidates = (modelObjs || []).filter((m) => supportsGenerateContent(m));
  if (!candidates.length) return "";

  // Prefer flash-like generative models over pro/other.
  const scored = candidates.map((m) => {
    const name = String(m.name || "");
    const id = normalizeModelId(name);
    const n = id.toLowerCase();
    let score = 0;
    if (n.includes("gemini")) score += 50;
    if (n.includes("flash")) score += 25;
    if (n.includes("pro")) score += 10;
    if (n.includes("experimental")) score -= 10;
    if (n.includes("embedding") || n.includes("embed")) score -= 100;
    return { id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id || "";
}

export function normalizeGeminiUsage(rawUsage) {
  if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) return null;
  const hasPromptTokenCount = "promptTokenCount" in rawUsage;
  const hasCandidatesTokenCount = "candidatesTokenCount" in rawUsage;

  const rawPrompt = hasPromptTokenCount ? rawUsage.promptTokenCount : rawUsage.prompt_tokens;
  const rawCompletion = hasCandidatesTokenCount ? rawUsage.candidatesTokenCount : rawUsage.completion_tokens;
  if (rawPrompt === undefined && rawCompletion === undefined) return null;
  const promptTokens = parseUsageTokenCount(rawPrompt);
  const completionTokens = parseUsageTokenCount(rawCompletion);
  if (promptTokens === null || completionTokens === null) return null;

  const sum = promptTokens + completionTokens;
  if (!Number.isSafeInteger(sum)) return null;

  let totalTokens = sum;
  const hasTotalTokenCount = "totalTokenCount" in rawUsage;
  const hasTotalTokens = "total_tokens" in rawUsage;
  if (hasTotalTokenCount || hasTotalTokens) {
    const rawTotal = hasTotalTokenCount ? rawUsage.totalTokenCount : rawUsage.total_tokens;
    const parsedTotal = parseUsageTokenCount(rawTotal);
    if (parsedTotal === null || parsedTotal < totalTokens) {
      return null;
    }
    totalTokens = parsedTotal;
  }

  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) return null;

  const cacheCandidates = [];
  if ("cachedContentTokenCount" in rawUsage) {
    cacheCandidates.push(rawUsage.cachedContentTokenCount);
  }
  if ("cached_tokens" in rawUsage) {
    cacheCandidates.push(rawUsage.cached_tokens);
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

export async function geminiGenerate({
  apiKey,
  model,
  systemPrompt = "",
  messages = [],
  timeoutMs = 20000,
  temperature = 0.7,
  maxTokens,
  signal,
}) {
  const key = String(apiKey ?? "").trim();
  const m = normalizeModelId(model);
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  if (!m) throw new Error("Missing GEMINI_MODEL");

  const contents = toGeminiContents(messages);
  const generationConfig = { temperature };
  const mt = Number(maxTokens);
  if (Number.isFinite(mt) && mt > 0) {
    generationConfig.maxOutputTokens = Math.max(1, Math.floor(mt));
  }

  const withSystemInstruction = {
    systemInstruction: systemPrompt
      ? { role: "system", parts: [{ text: String(systemPrompt) }] }
      : undefined,
    contents,
    generationConfig,
  };

  async function runOnce(url, attemptedModel = m) {
    try {
      const json = await fetchJson(url, { method: "POST", body: withSystemInstruction, signal }, timeoutMs);
      const text = pickTextFromGeminiResponse(json);
      if (!text) throw new Error("Gemini returned empty text");
      return {
        text,
        usage: normalizeGeminiUsage(json?.usageMetadata),
        model: attemptedModel,
        raw: json,
      };
    } catch (e) {
      // Fallback: some deployments reject `systemInstruction`. Retry by prepending the system prompt.
      const body = String(e?.body ?? "");
      const looksLikeUnknownField = (e?.status === 400 || e?.status === 422) && /systeminstruction|unknown|unrecognized|invalid/i.test(body);
      if (!systemPrompt || !looksLikeUnknownField) throw e;

      const prefix = String(systemPrompt).trim();
      const firstUser = contents.find((c) => c.role === "user") || null;
      const remaining = firstUser ? contents.slice(contents.indexOf(firstUser) + 1) : contents;
      const combined = firstUser
        ? [{ role: "user", parts: [{ text: `${prefix}\n\n${firstUser.parts?.[0]?.text ?? ""}`.trim() }] }, ...remaining]
        : [{ role: "user", parts: [{ text: prefix }] }, ...contents];

      const json = await fetchJson(url, { method: "POST", body: { contents: combined, generationConfig }, signal }, timeoutMs);
      const text = pickTextFromGeminiResponse(json);
      if (!text) throw new Error("Gemini returned empty text");
      return {
        text,
        usage: normalizeGeminiUsage(json?.usageMetadata),
        model: attemptedModel,
        raw: json,
      };
    }
  }

  // Try v1beta first (common for AI Studio), then v1 for forward-compat if the API/version shifts.
  const urls = [
    buildGenerateContentUrl({ apiVersion: "v1beta", apiKey: key, model: m }),
    buildGenerateContentUrl({ apiVersion: "v1", apiKey: key, model: m }),
  ];

  let lastErr = null;
  for (let idx = 0; idx < urls.length; idx++) {
    const url = urls[idx];
    try {
      // eslint-disable-next-line no-await-in-loop
      return await runOnce(url, m);
    } catch (e) {
      lastErr = e;
      const status = Number(e?.status ?? 0) || 0;
      // Only retry on v1 when v1beta yields a 404.
      if (!(idx === 0 && status === 404)) break;
    }
  }

  // If the requested model isn't found, attempt to auto-select an available model that supports generateContent.
  const lastStatus = Number(lastErr?.status ?? 0) || 0;
  if (lastStatus === 404) {
    try {
      const timeout = Math.max(5000, Number(timeoutMs || 20000) || 20000);
      const versions = ["v1beta", "v1"];
      for (const v of versions) {
        // eslint-disable-next-line no-await-in-loop
        const modelObjs = await listModels({ apiVersion: v, apiKey: key, timeoutMs: timeout, signal });
        const picked = pickFallbackModelId(modelObjs);
        if (!picked) continue;

        const tryUrls = [
          buildGenerateContentUrl({ apiVersion: v, apiKey: key, model: picked }),
        ];

        for (const u of tryUrls) {
          try {
            // eslint-disable-next-line no-await-in-loop
            return await runOnce(u, picked);
          } catch (e) {
            lastErr = e;
          }
        }
      }
    } catch (e) {
      // Ignore auto-pick failures; we'll throw the original error below with context.
    }
  }

  if (lastErr && typeof lastErr === "object") {
    lastErr.model = m;
  }
  throw lastErr || new Error("Gemini request failed");
}

export async function geminiGenerateText(opts) {
  const result = await geminiGenerate(opts);
  return result?.text || "";
}
