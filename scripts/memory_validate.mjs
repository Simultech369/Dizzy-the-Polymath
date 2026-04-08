import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const MAX_LINES = Number(process.env.DIZZY_MEMORY_INDEX_MAX_LINES || 200) || 200;
const MAX_BYTES = Number(process.env.DIZZY_MEMORY_INDEX_MAX_BYTES || 25_000) || 25_000;
const MAX_LINE_CHARS = Number(process.env.DIZZY_MEMORY_INDEX_MAX_LINE_CHARS || 240) || 240;

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function byteLen(s) {
  return Buffer.byteLength(String(s ?? ""), "utf8");
}

function parseMarkdownLinks(markdown) {
  const out = [];
  const re = /\[[^\]]+\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(markdown))) {
    const raw = String(m[1] || "").trim();
    const withoutFragment = raw.split("#")[0] || "";
    out.push(withoutFragment.trim());
  }
  return out;
}

function isRelativePath(p) {
  const x = String(p || "").replace(/\\/g, "/").trim();
  if (!x) return false;
  if (x.startsWith("/") || /^[a-zA-Z]:\//.test(x)) return false;
  if (x.includes("..")) return false;
  return true;
}

function validateMemoryIndex() {
  const filePath = path.resolve(ROOT, "MEMORY.md");
  if (!fs.existsSync(filePath)) {
    console.error("FAIL: MEMORY.md missing.");
    return { ok: false };
  }

  const raw = readText(filePath).replace(/\r\n/g, "\n");
  const trimmed = raw.trim();
  const lines = trimmed ? trimmed.split("\n") : [];
  const bytes = byteLen(raw);

  const errors = [];

  if (lines.length > MAX_LINES) {
    errors.push(`Too many lines: ${lines.length} (max ${MAX_LINES}).`);
  }
  if (bytes > MAX_BYTES) {
    errors.push(`Too many bytes: ${bytes} (max ${MAX_BYTES}).`);
  }

  const longLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (line.length > MAX_LINE_CHARS) {
      longLines.push({ line: i + 1, chars: line.length });
      if (longLines.length >= 10) break;
    }
  }
  if (longLines.length) {
    errors.push(
      `Overlong index lines (first ${longLines.length}): ` +
        longLines.map((x) => `L${x.line}=${x.chars}ch`).join(", "),
    );
  }

  const indexStart = raw.indexOf("\n## Index");
  const indexText = indexStart >= 0 ? raw.slice(indexStart) : raw;

  const links = parseMarkdownLinks(indexText)
    .filter((p) => isRelativePath(p))
    .filter((p) => p.toLowerCase().endsWith(".md"));

  const missing = [];
  for (const rel of links) {
    const abs = path.resolve(ROOT, rel);
    if (!fs.existsSync(abs)) missing.push(rel);
    if (missing.length >= 10) break;
  }
  if (missing.length) {
    errors.push(`Missing linked files (first ${missing.length}): ${missing.join(", ")}`);
  }

  if (errors.length) {
    console.error("FAIL: MEMORY.md validation failed:");
    for (const e of errors) console.error(`- ${e}`);
    return { ok: false };
  }

  console.log(`OK: MEMORY.md (${lines.length} lines, ${bytes} bytes).`);
  return { ok: true };
}

const res = validateMemoryIndex();
process.exit(res.ok ? 0 : 1);
