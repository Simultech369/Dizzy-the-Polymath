import fs from "fs";
import path from "path";

/**
 * Serializes CognitiveMemoryEngine records to a human-readable Markdown wiki.
 * The wiki is transparent state; receipts remain the immutable audit layer.
 */
export class MemoryWikiAdapter {
  constructor(baseDir) {
    this.baseDir = path.resolve(baseDir || path.join(process.cwd(), "memory", "wiki"));
  }

  init() {
    for (const dir of ["preferences", "projects", "models", "archive"]) {
      fs.mkdirSync(path.join(this.baseDir, dir), { recursive: true });
    }
  }

  _getFolderForCategory(category) {
    const cat = String(category || "archive").toLowerCase();
    if (cat.includes("preference")) return "preferences";
    if (cat.includes("project")) return "projects";
    if (cat.includes("model") || cat.includes("capability")) return "models";
    return "archive";
  }

  _assertInsideBaseDir(candidatePath) {
    const resolved = path.resolve(candidatePath);
    const relative = path.relative(this.baseDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Memory wiki path escapes the configured wiki root.");
    }
    return resolved;
  }

  _frontmatterString(value, fallback = "") {
    const clean = String(value ?? fallback)
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return JSON.stringify(clean || fallback);
  }

  _frontmatterNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : String(fallback);
  }

  _parseFrontmatterValue(value) {
    const raw = String(value || "").trim();
    if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
      try {
        return JSON.parse(raw);
      } catch {
        return raw.slice(1, -1);
      }
    }
    return raw;
  }

  _serializeToMarkdown(memory) {
    const fm = [
      "---",
      `memory_id: ${this._frontmatterString(memory.memory_id, "mem_unknown")}`,
      `memory_class: ${this._frontmatterString(memory.memory_class, "durable")}`,
      `confidence: ${this._frontmatterNumber(memory.confidence, 0)}`,
      `reinforcement_count: ${this._frontmatterNumber(memory.reinforcement_count || 1, 1)}`,
      `freshness_window_days: ${this._frontmatterNumber(memory.freshness_window_days || 60, 60)}`,
      `sensitivity_tier: ${this._frontmatterString(memory.sensitivity_tier, "normal")}`,
      `trust_zone: ${this._frontmatterString(memory.trust_zone, "private_self")}`,
      `last_accessed_at: ${this._frontmatterString(memory.last_accessed_at || new Date().toISOString())}`,
      `status: ${this._frontmatterString(memory.status, "active")}`,
      `source_receipt_sha256: ${this._frontmatterString(memory.source_receipt_sha256, "none")}`,
      "---",
    ].join("\n");

    return `${fm}\n\n${memory.content || ""}\n`;
  }

  _deserializeFromMarkdown(markdown) {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = markdown.match(frontmatterRegex);
    if (!match) {
      throw new Error("Invalid memory format: Missing or malformed frontmatter.");
    }

    const memory = { content: match[2].trim() };
    for (const line of match[1].split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx <= -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = this._parseFrontmatterValue(line.slice(colonIdx + 1).trim());
      if (key === "confidence") memory[key] = parseFloat(value);
      else if (key === "reinforcement_count" || key === "freshness_window_days") memory[key] = parseInt(value, 10);
      else memory[key] = value;
    }
    return memory;
  }

  writeMemory(memory) {
    this.init();
    const folder = this._getFolderForCategory(memory.category);
    const safeName = String(memory.title || memory.memory_id || "unknown")
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "unknown";
    const filePath = this._assertInsideBaseDir(path.join(this.baseDir, folder, `${safeName}.md`));
    fs.writeFileSync(filePath, this._serializeToMarkdown(memory), "utf8");
    return filePath;
  }

  readMemory(filePath) {
    const resolvedPath = this._assertInsideBaseDir(filePath);
    if (!fs.existsSync(resolvedPath)) return null;
    return this._deserializeFromMarkdown(fs.readFileSync(resolvedPath, "utf8"));
  }
}
