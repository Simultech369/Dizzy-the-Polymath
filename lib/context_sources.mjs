import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

export function createSourceSnapshot(wikiRootPath) {
  const records = [];
  
  if (!wikiRootPath) return { snapshot_id: "empty", as_of: new Date().toISOString(), records: [] };

  const entriesDir = path.join(wikiRootPath, "entries");
  if (fs.existsSync(entriesDir)) {
    const files = fs.readdirSync(entriesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"));
      
    for (const file of files) {
      const filePath = path.join(entriesDir, file.name);
      const markdown = fs.readFileSync(filePath, "utf8");
      
      const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
      const match = markdown.match(frontmatterRegex);
      if (!match) continue; // Skip malformed
      
      const lines = match[1].split(/\r?\n/);
      const metadata = {};
      for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > -1) {
          metadata[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
        }
      }
      
      const rawContent = match[2];
      const contentMarker = "## Content";
      const contentIdx = rawContent.indexOf(contentMarker);
      const content = contentIdx > -1 ? rawContent.slice(contentIdx + contentMarker.length).trim() : rawContent.trim();

      records.push({
        id: metadata.memory_id || file.name,
        kind: "cognitive_memory",
        content,
        source_sha256: sha256Hex(content),
        trust_zone: metadata.trust_zone || "private_self",
        sensitivity_tier: metadata.sensitivity_tier || "normal",
        status: metadata.status || "active",
        is_mandatory: String(metadata.memory_class).toLowerCase() === "durable_rule"
      });
    }
  }
  
  return {
    snapshot_id: `snap_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    as_of: new Date().toISOString(),
    records
  };
}
