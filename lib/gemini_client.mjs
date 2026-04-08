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
  return parts.map((p) => (p && typeof p.text === "string" ? p.text : "")).join("").trim();
}

async function fetchJson(url, opts = {}, timeoutMs = 20000) {
  const method = String(opts?.method ?? "POST").toUpperCase();
  const body = opts?.body === undefined ? null : opts.body;
  const headers = opts?.headers ? { ...opts.headers } : {};
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
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
  } finally {
    clearTimeout(t);
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

async function listModels({ apiVersion, apiKey, timeoutMs }) {
  const models = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const url = buildListModelsUrl({ apiVersion, apiKey, pageSize: 100, pageToken });
    // eslint-disable-next-line no-await-in-loop
    const json = await fetchJson(url, { method: "GET" }, timeoutMs);
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

export async function geminiGenerateText({
  apiKey,
  model,
  systemPrompt = "",
  messages = [],
  timeoutMs = 20000,
  temperature = 0.7,
}) {
  const key = String(apiKey ?? "").trim();
  const m = normalizeModelId(model);
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  if (!m) throw new Error("Missing GEMINI_MODEL");

  const contents = toGeminiContents(messages);

  const withSystemInstruction = {
    systemInstruction: systemPrompt
      ? { role: "system", parts: [{ text: String(systemPrompt) }] }
      : undefined,
    contents,
    generationConfig: { temperature },
  };

  async function runOnce(url) {
    try {
      const json = await fetchJson(url, { method: "POST", body: withSystemInstruction }, timeoutMs);
      const text = pickTextFromGeminiResponse(json);
      if (!text) throw new Error("Gemini returned empty text");
      return text;
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

      const json = await fetchJson(url, { method: "POST", body: { contents: combined, generationConfig: { temperature } } }, timeoutMs);
      const text = pickTextFromGeminiResponse(json);
      if (!text) throw new Error("Gemini returned empty text");
      return text;
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
      return await runOnce(url);
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
        const modelObjs = await listModels({ apiVersion: v, apiKey: key, timeoutMs: timeout });
        const picked = pickFallbackModelId(modelObjs);
        if (!picked) continue;

        const tryUrls = [
          buildGenerateContentUrl({ apiVersion: v, apiKey: key, model: picked }),
        ];

        for (const u of tryUrls) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const text = await runOnce(u);
            return text;
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
