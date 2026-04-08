function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function normalizeModelId(model) {
  let m = String(model ?? "").trim();
  m = m.replace(/^models\//i, "");
  m = m.replace(/^google\//i, "");
  m = m.replace(/^gemini\//i, "");
  return m.trim();
}

async function fetchJson(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: ctrl.signal });
    const raw = await res.text();
    let json = null;
    try { json = JSON.parse(raw); } catch {}
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = raw.slice(0, 4000);
      throw err;
    }
    if (!json) throw new Error("Invalid JSON");
    return json;
  } finally {
    clearTimeout(t);
  }
}

async function listModels(apiVersion, apiKey) {
  const models = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const url = new URL(`https://generativelanguage.googleapis.com/${apiVersion}/models`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    // eslint-disable-next-line no-await-in-loop
    const json = await fetchJson(url.toString(), 20000);
    const pageModels = Array.isArray(json?.models) ? json.models : [];
    for (const m of pageModels) models.push(m);
    pageToken = String(json?.nextPageToken ?? "").trim();
    if (!pageToken) break;
  }
  return models;
}

function supportsGenerateContent(m) {
  const methods = m?.supportedGenerationMethods;
  if (!Array.isArray(methods)) return false;
  return methods.map(String).includes("generateContent");
}

async function main() {
  const apiKey = String(env("GEMINI_API_KEY", "")).trim();
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY in env.");
    process.exit(2);
  }

  const versions = ["v1beta", "v1"];
  const rows = [];
  for (const v of versions) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const models = await listModels(v, apiKey);
      for (const m of models) {
        if (!m?.name) continue;
        const id = normalizeModelId(m.name);
        if (!supportsGenerateContent(m)) continue;
        rows.push({ api: v, id, methods: (m.supportedGenerationMethods || []).join(",") });
      }
    } catch (e) {
      const body = e?.body ? `\n${String(e.body).slice(0, 1200)}` : "";
      console.error(`[${v}] listModels failed: ${String(e?.message ?? e)}${body}`);
    }
  }

  rows.sort((a, b) => a.id.localeCompare(b.id));
  if (!rows.length) {
    console.log("No models with generateContent found.");
    process.exit(0);
  }

  console.log("Models supporting generateContent:");
  for (const r of rows) {
    console.log(`- ${r.id} (api=${r.api})`);
  }
}

main().catch((e) => {
  console.error(String(e?.stack ?? e?.message ?? e));
  process.exit(1);
});

