import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { performance } from "node:perf_hooks";

import { getRelevantMarkdownSnippets, resetMarkdownIndexCacheForTests } from "../lib/md_retriever.mjs";

const ROOT = process.cwd();
const FIXTURE_REL = "runtime/test-bm25-fixtures";
const FIXTURE_DIR = path.resolve(ROOT, FIXTURE_REL);
const ENV_KEYS = [
  "DIZZY_RAG_ROOT",
  "DIZZY_RAG_ALLOWED_ROOTS",
  "DIZZY_RAG_TOP_K",
  "DIZZY_RAG_CACHE_MS",
];
const previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function writeFixture(name, content) {
  fs.writeFileSync(path.join(FIXTURE_DIR, name), `${content.trim()}\n`, "utf8");
}

function restoreEnvironment() {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
fs.mkdirSync(FIXTURE_DIR, { recursive: true });

writeFixture("compact.md", `
# Compact relevance
quartzneedle quartzneedle quartzneedle quartzneedle quartzneedle concise
`);

writeFixture("incidental.md", `
# Incidental relevance
quartzneedle appears once beside unrelated material
`);

writeFixture("stuffed.md", `
# Stuffed relevance
${`${"quartzneedle ".repeat(20)}${"padding ".repeat(900)}`}
`);

writeFixture("rare.md", `
# Rare term
rarezircon commonword
`);

for (let index = 1; index <= 5; index += 1) {
  writeFixture(`common-${index}.md`, `
# Common term ${index}
commonword commonword commonword baseline document
`);
}

writeFixture("decision.md", `
# Durable decision
The project decision records a constraint and selected implementation route.
`);

writeFixture("frontmatter.md", `
---
private_marker: hiddenfrontmatterterm
---
# Visible body
Only searchable body content belongs here.
`);

writeFixture("revoked.md", `
---
memory_status: revoked
---
# Revoked memory
revokedzircon should never be retrieved
`);

writeFixture("zone-blocked.md", `
---
zone_allowed: paid_public
---
# Zone blocked memory
zonezircon should not cross into private retrieval
`);

writeFixture("a-assistant-source.md", `
---
source: assistant_proposed
---
# Source authority tie
authorityzircon identical claim
`);

writeFixture("z-operator-source.md", `
---
source: operator_reviewed
---
# Source authority tie
authorityzircon identical claim
`);

try {
  process.env.DIZZY_RAG_ROOT = FIXTURE_REL;
  process.env.DIZZY_RAG_ALLOWED_ROOTS = FIXTURE_REL;
  process.env.DIZZY_RAG_TOP_K = "20";
  process.env.DIZZY_RAG_CACHE_MS = "60000";
  resetMarkdownIndexCacheForTests();

  const coldStartedAt = performance.now();
  const termResults = getRelevantMarkdownSnippets("quartzneedle", { k: 20 });
  const coldMs = performance.now() - coldStartedAt;

  const compactIndex = termResults.findIndex((item) => item.path.endsWith("compact.md"));
  const incidentalIndex = termResults.findIndex((item) => item.path.endsWith("incidental.md"));
  const stuffedIndex = termResults.findIndex((item) => item.path.endsWith("stuffed.md"));

  assert.ok(compactIndex >= 0, "compact fixture should be retrieved");
  assert.ok(incidentalIndex >= 0, "incidental fixture should be retrieved");
  assert.ok(stuffedIndex >= 0, "stuffed fixture should be retrieved");
  assert.ok(compactIndex < incidentalIndex, "repeated relevant terms should outrank one incidental mention");
  assert.ok(compactIndex < stuffedIndex, "document length normalization should resist keyword stuffing");

  const rareResults = getRelevantMarkdownSnippets("rarezircon commonword", { k: 20 });
  assert.ok(rareResults[0]?.path.endsWith("rare.md"), "rare query terms should contribute more than corpus-common terms");

  const decisionResults = getRelevantMarkdownSnippets("decision constraint", { k: 20 });
  const decision = decisionResults.find((item) => item.path.endsWith("decision.md"));
  assert.ok(decision, "decision query should retrieve decision material");
  assert.ok(decision.reasons.includes("decision_signal"), "decision signal boost should remain active");

  const frontmatterResults = getRelevantMarkdownSnippets("hiddenfrontmatterterm", { k: 20 });
  assert.equal(frontmatterResults.length, 0, "frontmatter should not be searchable body text");

  const missingResults = getRelevantMarkdownSnippets("termthatdoesnotexistanywhere", { k: 20 });
  assert.equal(missingResults.length, 0, "missing terms should return no snippets");

  const revokedResults = getRelevantMarkdownSnippets("revokedzircon", { k: 20, trustZone: "private_self" });
  assert.equal(revokedResults.length, 0, "explicitly revoked memory should not be retrieved");

  const zoneResults = getRelevantMarkdownSnippets("zonezircon", { k: 20, trustZone: "private_self" });
  assert.equal(zoneResults.length, 0, "zone-ineligible memory should not cross into private retrieval");

  const authorityResults = getRelevantMarkdownSnippets("authorityzircon identical claim", { k: 20, trustZone: "private_self" });
  assert.ok(authorityResults[0]?.path.endsWith("z-operator-source.md"), "operator-reviewed evidence should win an exact relevance tie");
  assert.equal(authorityResults[0]?.source, "operator_reviewed");

  for (const item of termResults) {
    assert.equal(typeof item.path, "string");
    assert.equal(typeof item.source_hash, "string");
    assert.ok(Number.isFinite(Date.parse(item.retrieved_at)));
    assert.equal(typeof item.kind, "string");
    assert.equal(typeof item.score, "number");
    assert.ok(Array.isArray(item.reasons));
    assert.equal(typeof item.signals, "object");
    assert.equal(typeof item.excerpt, "string");
  }

  const warmTimings = [];
  for (let index = 0; index < 25; index += 1) {
    const startedAt = performance.now();
    getRelevantMarkdownSnippets("quartzneedle", { k: 20 });
    warmTimings.push(performance.now() - startedAt);
  }
  const warmMedianMs = median(warmTimings);

  assert.ok(coldMs < 500, `cold fixture indexing took ${coldMs.toFixed(2)}ms; expected under 500ms`);
  assert.ok(warmMedianMs < 25, `warm fixture retrieval median was ${warmMedianMs.toFixed(2)}ms; expected under 25ms`);

  console.log("BM25_VERIFY_OK");
  console.log(`cold_index_ms=${coldMs.toFixed(2)}`);
  console.log(`warm_retrieval_median_ms=${warmMedianMs.toFixed(2)}`);
} finally {
  resetMarkdownIndexCacheForTests();
  restoreEnvironment();
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
}
