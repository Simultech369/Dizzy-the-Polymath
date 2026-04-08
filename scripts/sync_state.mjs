import crypto from "crypto";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd());
const DESIGN_PATH = path.join(ROOT, "DESIGN.md");
const STATE_PATH = path.join(ROOT, "state.json");

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",");
  return `{${body}}`;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function atomicWriteText(filePath, text) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, text, "utf8");
  try {
    fs.renameSync(tmp, filePath);
  } catch {
    // Best-effort fallback for Windows rename semantics.
    fs.copyFileSync(tmp, filePath);
    fs.unlinkSync(tmp);
  }
}

function extractStateJsonFromDesign(designText) {
  const begin = "<!-- STATE_JSON:BEGIN -->";
  const end = "<!-- STATE_JSON:END -->";
  const b = designText.indexOf(begin);
  const e = designText.indexOf(end);
  if (b === -1 || e === -1 || e <= b) return null;

  const inner = designText.slice(b + begin.length, e);
  const fenceMatch = inner.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!fenceMatch) return null;

  const jsonText = fenceMatch[1].trim();
  return { jsonText };
}

function normalizeForCompare(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = JSON.parse(JSON.stringify(obj));
  delete out.updated_at;
  return out;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");

  if (!fs.existsSync(DESIGN_PATH)) {
    console.error(`Missing ${DESIGN_PATH}`);
    process.exit(2);
  }

  const designText = readText(DESIGN_PATH);
  const designHash = sha256Hex(designText);
  const extracted = extractStateJsonFromDesign(designText);
  if (!extracted) {
    console.error("Missing STATE_JSON block in DESIGN.md (<!-- STATE_JSON:BEGIN --> ... <!-- STATE_JSON:END -->).");
    process.exit(2);
  }

  let state;
  try {
    state = JSON.parse(extracted.jsonText);
  } catch (e) {
    console.error(`STATE_JSON block is not valid JSON: ${String(e?.message || e)}`);
    process.exit(2);
  }

  const out = {
    ...state,
    updated_at: new Date().toISOString(),
    canonical_source: "DESIGN.md",
    derived_from: {
      design_md_sha256: designHash,
    },
  };

  const outText = `${JSON.stringify(out, null, 2)}\n`;

  if (checkOnly) {
    if (!fs.existsSync(STATE_PATH)) {
      console.error("STATE_SYNC_OUT_OF_DATE state.json is missing");
      process.exit(1);
    }
    let existingJson;
    try {
      existingJson = JSON.parse(readText(STATE_PATH));
    } catch {
      console.error("STATE_SYNC_OUT_OF_DATE state.json is not valid JSON");
      process.exit(1);
    }

    const want = stableStringify(normalizeForCompare(out));
    const have = stableStringify(normalizeForCompare(existingJson));
    if (want !== have) {
      console.error("STATE_SYNC_OUT_OF_DATE state.json does not match DESIGN.md");
      process.exit(1);
    }
    console.log("STATE_SYNC_OK state.json matches DESIGN.md");
    return;
  }

  atomicWriteText(STATE_PATH, outText);
  console.log(`STATE_SYNC_OK wrote ${path.relative(ROOT, STATE_PATH)}`);
}

main();
