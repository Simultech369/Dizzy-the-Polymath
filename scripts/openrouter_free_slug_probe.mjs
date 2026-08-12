import fs from "fs";
import path from "path";

const SCHEMA_VERSION = "dizzy.openrouter_availability.v1";

export const OPENROUTER_FREE_PROBES = Object.freeze([
  { role_key: "nemotron_free", model: "nvidia/llama-3.1-nemotron-70b-instruct:free" },
  { role_key: "liquid_free", model: "liquid/lqc-3b-v0.1:free" },
  { role_key: "glm_free", model: "thudm/glm-4-9b-chat:free" },
  { role_key: "kimi_batch", model: "moonshotai/kimi-k2.7-code:batch" },
  { role_key: "qwen_free", model: "qwen/qwen-2.5-coder-32b-instruct:free" },
]);

function argValue(args, name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function boolArg(args, name) {
  return args.includes(name);
}

function nowIso() {
  return new Date().toISOString();
}

function clip(value = "", max = 500) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function parseJsonObjectCandidate(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  if (!candidate || !candidate.startsWith("{")) return false;
  JSON.parse(candidate);
  return true;
}

function readOpenRouterKey() {
  const keyFile = path.resolve(process.cwd(), "runtime/secrets/OPENROUTER_API_KEY.txt");
  if (fs.existsSync(keyFile)) {
    const raw = fs.readFileSync(keyFile, "utf8").trim();
    if (raw) return raw;
  }
  return process.env.OPENROUTER_API_KEY || "";
}

export async function probeOpenRouterSlug({ roleKey = "", model, apiKey, timeoutMs = 10000 }) {
  const started = Date.now();
  if (!apiKey) {
    return {
      role_key: roleKey,
      model,
      slug: model,
      status: "skipped_missing_key",
      runnable: false,
      seconds: 0,
      latency_ms: 0,
      parse_result: "not_run",
      error_class: "missing_key",
      note: "No OpenRouter API key provided or found in runtime/secrets/OPENROUTER_API_KEY.txt",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/Simultech369/Dizzy-the-Polymath",
        "X-Title": "Dizzy OpenRouter Probe",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with JSON: {\"status\":\"ok\"}" }],
        response_format: { type: "json_object" },
        max_tokens: 60,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - started;
    const seconds = Number((latencyMs / 1000).toFixed(2));
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // ignore
    }

    if (!res.ok) {
      const errClass = res.status === 429 ? "rate_limited" : (res.status === 404 ? "model_not_found" : "http_error");
      return {
        role_key: roleKey,
        model,
        slug: model,
        status: errClass,
        runnable: false,
        http_status: res.status,
        seconds,
        latency_ms: latencyMs,
        parse_result: "not_run",
        error_class: errClass,
        error: clip(json?.error?.message || text, 300),
      };
    }

    const choice = json?.choices?.[0];
    const content = String(choice?.message?.content || choice?.text || "").trim();
    let parsedOk = false;
    try {
      parsedOk = parseJsonObjectCandidate(content);
    } catch {
      // ignore
    }

    return {
      role_key: roleKey,
      model,
      slug: model,
      status: parsedOk ? "available" : "content_parse_warning",
      runnable: true,
      seconds,
      latency_ms: latencyMs,
      json_usable: parsedOk,
      parse_result: parsedOk ? "json_valid" : "json_invalid_or_empty",
      error_class: "",
      sample: clip(content, 150),
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const seconds = Number((latencyMs / 1000).toFixed(2));
    const isTimeout = err.name === "AbortError";
    return {
      role_key: roleKey,
      model,
      slug: model,
      status: isTimeout ? "timeout" : "connection_failed",
      runnable: false,
      seconds,
      latency_ms: latencyMs,
      parse_result: "not_run",
      error_class: isTimeout ? "timeout" : "connection_failed",
      error: clip(err?.message || String(err), 300),
    };
  } finally {
    clearTimeout(timer);
  }
}

const args = process.argv.slice(2);
if (process.argv[1] && process.argv[1].endsWith("openrouter_free_slug_probe.mjs")) {
  const writeReceipt = boolArg(args, "--write");
  const outPath = argValue(args, "--out", "reviews/openrouter_availability_latest.json");
  const apiKey = readOpenRouterKey();
  const modelsArg = argValue(args, "--models", "");
  const targets = modelsArg
    ? modelsArg.split(",").map((m) => ({ role_key: "", model: m.trim() })).filter((t) => t.model)
    : OPENROUTER_FREE_PROBES;

  console.log(`[OpenRouter Probe] Probing ${targets.length} free/batch slugs...`);

  const results = [];
  for (const target of targets) {
    results.push(await probeOpenRouterSlug({ roleKey: target.role_key, model: target.model, apiKey }));
  }

  const receipt = {
    schema_version: SCHEMA_VERSION,
    created_at: nowIso(),
    has_api_key: Boolean(apiKey),
    probe_count: results.length,
    results,
    authority: "openrouter_probe_evidence_not_authority",
  };

  if (writeReceipt) {
    const abs = path.resolve(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    receipt.receipt_path = abs;
  }

  console.log(JSON.stringify(receipt, null, 2));
}
