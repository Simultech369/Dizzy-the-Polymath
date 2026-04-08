function normalizeLineEndings(s) {
  return String(s ?? "").replace(/\r\n/g, "\n");
}

function pickTextFromChatCompletions(json) {
  const choice = json?.choices?.[0];
  const msg = choice?.message;
  const content = msg?.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // Some providers return an array of content parts.
    const parts = content
      .map((p) => {
        if (!p) return "";
        if (typeof p === "string") return p;
        if (typeof p?.text === "string") return p.text;
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("\n");
  }

  if (typeof choice?.text === "string") return choice.text;
  return "";
}

function toOpenAICompatMessages({ systemPrompt, messages }) {
  const out = [];
  const sys = normalizeLineEndings(systemPrompt).trim();
  if (sys) out.push({ role: "system", content: sys });
  for (const m of messages || []) {
    if (!m) continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = normalizeLineEndings(m.text ?? "").trim();
    if (!content) continue;
    out.push({ role, content });
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
  maxTokens = undefined,
}) {
  const b = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  const m = String(model ?? "").trim();
  if (!b) throw new Error("Missing OPENAI_COMPAT_BASE_URL");
  if (!m) throw new Error("Missing OPENAI_COMPAT_MODEL");

  const url = `${b}/chat/completions`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 20000));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${String(apiKey).trim()}` } : {}),
      },
      body: JSON.stringify({
        model: m,
        temperature,
        ...(Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0 ? { max_tokens: Number(maxTokens) } : {}),
        messages: toOpenAICompatMessages({ systemPrompt, messages }),
      }),
      signal: controller.signal,
    });

    const raw = await res.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      // ignore
    }

    if (!res.ok) {
      const err = new Error(`OpenAI-compat HTTP ${res.status}`);
      err.status = res.status;
      err.body = raw;
      err.model = m;
      throw err;
    }

    const text = pickTextFromChatCompletions(json);
    if (!text) {
      const err = new Error("OpenAI-compat returned empty text");
      err.status = res.status;
      err.body = raw;
      err.model = m;
      throw err;
    }
    return text;
  } finally {
    clearTimeout(t);
  }
}
