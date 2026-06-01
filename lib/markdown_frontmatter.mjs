export function stripFrontmatter(text) {
  const raw = String(text ?? "").replace(/\r\n/g, "\n");
  if (!raw.startsWith("---\n")) return raw;

  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) return raw;

  return raw.slice(end + "\n---\n".length);
}

export function parseFrontmatter(text) {
  const raw = String(text ?? "").replace(/\r\n/g, "\n");
  if (!raw.startsWith("---\n")) return { data: null, body: raw };

  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) return { data: null, body: raw };

  const block = raw.slice(4, end).trim();
  const data = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    data[key] = rawValue.replace(/^["']|["']$/g, "").trim();
  }

  return { data, body: raw.slice(end + "\n---\n".length) };
}
