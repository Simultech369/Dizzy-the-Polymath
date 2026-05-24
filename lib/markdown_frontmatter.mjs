export function stripFrontmatter(text) {
  const raw = String(text ?? "").replace(/\r\n/g, "\n");
  if (!raw.startsWith("---\n")) return raw;

  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) return raw;

  return raw.slice(end + "\n---\n".length);
}

