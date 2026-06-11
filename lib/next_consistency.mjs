import fs from "fs";
import path from "path";

const QUEUE_ITEM_RE = /^-\s+([A-Z]+-\d+)\s+\[Tier\s+(\d+)\]:\s+.*?\(ref\s+([^)]+)\)[.!]?\s*$/i;

function parseFrontmatter(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return null;

  const data = {};
  for (const line of normalized.slice(4, end).trim().split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    data[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return data;
}

export function parseReferencedQueueItems(nextText) {
  const queue = String(nextText || "").split("## Work Queue")[1]?.split("## Completed")[0] || "";
  const items = [];
  for (const line of queue.split(/\r?\n/)) {
    const match = line.trim().match(QUEUE_ITEM_RE);
    if (!match) continue;
    items.push({ id: match[1], tier: Number(match[2]), ref: match[3].trim().replaceAll("\\", "/") });
  }
  return items;
}

export function validateNextConsistency({ root = process.cwd(), nextText, readFile = null } = {}) {
  const issues = [];
  const items = parseReferencedQueueItems(nextText ?? fs.readFileSync(path.resolve(root, "NEXT.md"), "utf8"));
  const reader = readFile || ((ref) => fs.readFileSync(path.resolve(root, ref), "utf8"));

  for (const item of items) {
    let noteText = "";
    try {
      noteText = reader(item.ref);
    } catch {
      issues.push(`${item.id}: referenced upgrade note is missing: ${item.ref}`);
      continue;
    }

    const metadata = parseFrontmatter(noteText);
    if (!metadata) {
      issues.push(`${item.id}: referenced upgrade note lacks frontmatter: ${item.ref}`);
      continue;
    }

    const status = String(metadata.status || "").toLowerCase();
    const sourceTier = Number(metadata.tier);
    if (status !== "active") {
      issues.push(`${item.id}: NEXT.md is active, but ${item.ref} has status '${status || "missing"}'`);
    }
    if (!Number.isFinite(sourceTier)) {
      issues.push(`${item.id}: ${item.ref} has no numeric tier`);
    } else if (sourceTier !== item.tier) {
      issues.push(`${item.id}: NEXT.md Tier ${item.tier} conflicts with ${item.ref} Tier ${sourceTier}`);
    }
  }

  return { ok: issues.length === 0, checked: items.length, issues };
}
