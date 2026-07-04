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
  if (end < 0) {
    return {
      data: null,
      body: raw,
      issues: ["missing closing frontmatter delimiter"],
    };
  }

  const block = raw.slice(4, end);
  const data = {};
  const issues = [];
  for (const [index, line] of block.split("\n").entries()) {
    const lineNumber = index + 2;
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (/^\s/.test(line)) {
      issues.push(`unsupported frontmatter continuation at line ${lineNumber}`);
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      issues.push(`malformed frontmatter line ${lineNumber}`);
      continue;
    }
    const [, key, rawValue] = match;
    if (Object.hasOwn(data, key)) issues.push(`duplicate frontmatter key '${key}' at line ${lineNumber}`);
    data[key] = rawValue.replace(/^["']|["']$/g, "").trim();
  }

  return { data, body: raw.slice(end + "\n---\n".length), issues };
}
