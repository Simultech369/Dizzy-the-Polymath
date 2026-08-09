import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const SCHEMA_VERSION = "dizzy.ollama_availability.v1";

const LOCAL_REVIEWER_PROBES = Object.freeze([
  { role_key: "gemma3_local", model: "gemma3:4b" },
  { role_key: "qwen_local", model: "qwen2.5-coder:7b" },
  { role_key: "r1_local", model: "deepseek-r1:7b" },
  { role_key: "mistral_local", model: "mistral:latest" },
  { role_key: "local_security_auditor", model: "llama-audit:latest" },
  { role_key: "local_code_probe", model: "codegemma-7b" },
  { role_key: "fast_local_fallback", model: "deepseek-r1:1.5b" },
]);

function argValue(args, name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function boolArg(args, name) {
  return args.includes(name);
}

function numArg(args, name, fallback) {
  const raw = Number(argValue(args, name, ""));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function clip(value = "", max = 500) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function parseBaseUrl(raw) {
  const value = String(raw || "").trim();
  const url = new URL(value || "http://127.0.0.1:11434/v1");
  return {
    apiOrigin: url.origin,
    compatBaseUrl: url.href.replace(/\/$/, ""),
    ollamaHost: `${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "80")}`,
    display: value || url.href,
  };
}

function defaultModelsDir() {
  return path.join(os.homedir(), ".ollama", "models");
}

function parseModelTargets(args) {
  const modelsArg = argValue(args, "--models", "");
  if (!modelsArg) return LOCAL_REVIEWER_PROBES.map((item) => ({ ...item }));
  return modelsArg
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean)
    .map((model) => ({ role_key: "", model }));
}

function startOllamaServer({ baseUrl, localAppData, modelsDir }) {
  fs.mkdirSync(localAppData, { recursive: true });
  const { ollamaHost } = parseBaseUrl(baseUrl);
  return spawn("ollama", ["serve"], {
    cwd: process.cwd(),
    windowsHide: true,
    env: {
      ...process.env,
      LOCALAPPDATA: localAppData,
      OLLAMA_HOST: ollamaHost,
      OLLAMA_MODELS: modelsDir,
      OLLAMA_NO_CLOUD: "true",
      OLLAMA_NOPRUNE: "true",
      OLLAMA_NUM_PARALLEL: "1",
      OLLAMA_MAX_LOADED_MODELS: "1",
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
}

async function waitForExit(child, timeoutMs = 3000) {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function stopOllamaServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await waitForExit(child, 3000);
  if (child.exitCode === null) {
    try {
      child.kill("SIGKILL");
    } catch {
      // Best-effort cleanup only; the probe receipt records availability, not authority.
    }
  }
}

async function fetchJson(url, {
  method = "GET",
  body,
  timeoutMs = 5000,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${clip(text, 400)}`);
      error.status = response.status;
      error.body = parsed;
      throw error;
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForTags(apiOrigin, {
  timeoutMs = 30000,
  serverProcess,
} = {}) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`ollama serve exited before readiness with code ${serverProcess.exitCode}`);
    }
    try {
      return await fetchJson(`${apiOrigin}/api/tags`, { timeoutMs: 2500 });
    } catch (err) {
      lastError = err?.message || String(err);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`ollama tags endpoint not ready: ${lastError}`);
}

function summarizeInstalled(tags) {
  return (Array.isArray(tags?.models) ? tags.models : [])
    .map((item) => ({
      name: String(item.name || ""),
      size_gb: Number.isFinite(Number(item.size)) ? Number((Number(item.size) / (1024 ** 3)).toFixed(2)) : 0,
    }))
    .filter((item) => item.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function responseTextFromCompat(response) {
  const choice = Array.isArray(response?.choices) ? response.choices[0] : null;
  return String(choice?.message?.content || choice?.text || "");
}

function responseAuxiliaryTextFromCompat(response) {
  const choice = Array.isArray(response?.choices) ? response.choices[0] : null;
  const message = choice?.message || {};
  return String(message.reasoning_content || message.reasoning || message.thinking || "");
}

function responseMessageFieldsFromCompat(response) {
  const choice = Array.isArray(response?.choices) ? response.choices[0] : null;
  const message = choice?.message || {};
  return Object.keys(message).sort();
}

async function probeModel({ compatBaseUrl, target, installedNames, timeoutMs, numPredict }) {
  const started = Date.now();
  if (!installedNames.has(target.model)) {
    return {
      role_key: target.role_key,
      model: target.model,
      status: "missing_manifest",
      runnable: false,
      seconds: 0,
      note: "model not present in local Ollama manifest; skipped to avoid network pull",
    };
  }
  try {
    const body = {
      model: target.model,
      messages: [{ role: "user", content: "Reply with exactly LOCAL_OK." }],
      stream: false,
      temperature: 0,
      max_tokens: numPredict,
    };
    const response = await fetchJson(`${compatBaseUrl}/chat/completions`, {
      method: "POST",
      body,
      timeoutMs,
    });
    const text = responseTextFromCompat(response);
    const auxiliaryText = responseAuxiliaryTextFromCompat(response);
    const messageFields = responseMessageFieldsFromCompat(response);
    const reviewUsable = Boolean(text.trim());
    const hasAuxiliary = Boolean(auxiliaryText.trim());
    return {
      role_key: target.role_key,
      model: target.model,
      status: reviewUsable ? "ok" : (hasAuxiliary ? "ok_auxiliary_only" : "ok_empty_content"),
      runnable: true,
      review_usable: reviewUsable,
      seconds: Number(((Date.now() - started) / 1000).toFixed(2)),
      contains_marker: /LOCAL_OK/i.test(text),
      message_fields: messageFields,
      sample: clip(text, 200),
      auxiliary_present: hasAuxiliary,
      note: hasAuxiliary && !reviewUsable ? "auxiliary reasoning was present but is not counted as review-usable content" : "",
    };
  } catch (err) {
    return {
      role_key: target.role_key,
      model: target.model,
      status: "failed",
      runnable: false,
      seconds: Number(((Date.now() - started) / 1000).toFixed(2)),
      error: clip(err?.message || err, 700),
    };
  }
}

function summarizeResults(results) {
  return results.reduce((acc, result) => {
    const status = result.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

function writeJson(outPath, data) {
  const abs = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return abs;
}

const args = process.argv.slice(2);
const baseUrl = argValue(args, "--base-url", "http://127.0.0.1:11434/v1");
const startServer = boolArg(args, "--start-server");
const writeReceipt = boolArg(args, "--write");
const outPath = argValue(args, "--out", "reviews/ollama_availability_latest.json");
const timeoutMs = numArg(args, "--timeout-ms", 120000);
const readyTimeoutMs = numArg(args, "--ready-timeout-ms", 30000);
const numPredict = numArg(args, "--num-predict", 8);
const localAppData = path.resolve(process.cwd(), argValue(args, "--localappdata", "runtime/ollama-localappdata"));
const modelsDir = path.resolve(argValue(args, "--models-dir", process.env.OLLAMA_MODELS || defaultModelsDir()));
const targets = parseModelTargets(args);
const { apiOrigin, compatBaseUrl } = parseBaseUrl(baseUrl);

let serverProcess = null;
let receiptPath = "";
try {
  if (startServer) {
    serverProcess = startOllamaServer({ baseUrl, localAppData, modelsDir });
  }

  const tags = await waitForTags(apiOrigin, { timeoutMs: readyTimeoutMs, serverProcess });
  const installedModels = summarizeInstalled(tags);
  const installedNames = new Set(installedModels.map((item) => item.name));
  const results = [];

  for (const target of targets) {
    results.push(await probeModel({
      compatBaseUrl,
      target,
      installedNames,
      timeoutMs,
      numPredict,
    }));
  }

  const receipt = {
    schema_version: SCHEMA_VERSION,
    created_at: nowIso(),
    base_url_host: new URL(baseUrl).host,
    server_started_by_probe: startServer,
    localappdata: startServer ? path.relative(process.cwd(), localAppData).replace(/\\/g, "/") : "",
    models_dir: modelsDir,
    installed_count: installedModels.length,
    installed_models: installedModels,
    probe_count: results.length,
    summary: summarizeResults(results),
    results,
    authority: "availability_probe_is_evidence_not_authority",
  };
  if (writeReceipt) receiptPath = writeJson(outPath, receipt);
  console.log(JSON.stringify({ ...receipt, receipt_path: receiptPath }, null, 2));
} finally {
  await stopOllamaServer(serverProcess);
}
