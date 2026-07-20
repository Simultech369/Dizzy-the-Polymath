import fs from "fs";
import path from "path";

import { getMemoryGraph } from "../lib/memory_graph.mjs";
import { getBridgeId } from "../lib/bridging_scan.mjs";

const ROOT = process.cwd();
const STOPWORDS = new Set([
  "the", "and", "not", "that", "this", "with", "from", "into", "for", "but", "are", "was", "were",
  "you", "your", "all", "can", "should", "would", "could", "has", "have", "had", "they", "their",
  "its", "our", "out", "one", "two", "what", "when", "where", "why", "how",
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sharedNames(a = [], b = []) {
  const left = new Set(a.map((x) => String(x?.name || "").trim()).filter(Boolean));
  return b.map((x) => String(x?.name || "").trim()).filter((name) => left.has(name)).slice(0, 8);
}

function sharedTokens(a = [], b = []) {
  const left = new Set(a.map((x) => String(x?.token || "").trim()).filter((token) => token && !STOPWORDS.has(token)));
  return b
    .map((x) => String(x?.token || "").trim())
    .filter((token) => token && !STOPWORDS.has(token) && left.has(token))
    .slice(0, 10);
}

function sharedSignals(a = {}, b = {}) {
  return Object.keys(a)
    .filter((k) => Number(a[k] || 0) > 0 && Number(b[k] || 0) > 0)
    .slice(0, 8);
}

function linkSet(graph) {
  const out = new Set();
  for (const edge of graph.edges || []) {
    if (edge?.type !== "links_to") continue;
    out.add(`${edge.from}->${edge.to}`);
    out.add(`${edge.to}->${edge.from}`);
  }
  return out;
}

function scorePair(a, b) {
  const entities = sharedNames(a.entities, b.entities);
  const tokens = sharedTokens(a.keywords, b.keywords);
  const signals = sharedSignals(a.signals, b.signals);
  let score = 0;
  score += entities.length * 4;
  score += tokens.length * 2;
  score += signals.length * 2;
  if (a.kind !== b.kind) score += 1;
  return { score, entities, tokens, signals };
}

function buildFindings(graph) {
  const links = linkSet(graph);
  const docs = (graph.docs || [])
    .filter((d) => d && d.path && d.kind !== "memory_index")
    .slice(0, 200);
  const findings = [];

  for (let i = 0; i < docs.length; i += 1) {
    for (let j = i + 1; j < docs.length; j += 1) {
      const a = docs[i];
      const b = docs[j];
      if (links.has(`${a.id}->${b.id}`)) continue;
      const scored = scorePair(a, b);
      if (scored.score < 6) continue;
      if (!scored.entities.length && !scored.tokens.length && scored.signals.length < 3) continue;
      findings.push({ a, b, ...scored });
    }
  }

  return findings
    .sort((x, y) => y.score - x.score || x.a.path.localeCompare(y.a.path) || x.b.path.localeCompare(y.b.path))
    .slice(0, 12);
}

function renderReport(graph, findings) {
  const lines = [
    "# Connection Scan",
    "",
    `- scanned_at: ${new Date().toISOString()}`,
    `- graph_built_at: ${graph.built_at || ""}`,
    `- docs_scanned: ${(graph.docs || []).length}`,
    `- findings: ${findings.length}`,
    "",
    "These are hypotheses, not doctrine and not retrieval authority. Use them as prompts for review.",
    "",
  ];

  if (!findings.length) {
    lines.push("No strong unlinked connection hypotheses found.");
    return lines.join("\n");
  }

  findings.forEach((f, idx) => {
    lines.push(`## ${idx + 1}. ${f.a.path} x ${f.b.path}`);
    lines.push("");
    lines.push(`- score: ${f.score}`);
    if (f.entities.length) lines.push(`- shared_entities: ${f.entities.join(", ")}`);
    if (f.tokens.length) lines.push(`- shared_keywords: ${f.tokens.join(", ")}`);
    if (f.signals.length) lines.push(`- shared_signals: ${f.signals.join(", ")}`);
    lines.push("- hypothesis: These files may contain a reusable connection that has not been made explicit.");
    lines.push("- review_question: Does linking these reduce future search/friction, or would it create false coherence?");
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}

function main() {
  const isCheck = process.argv.includes("--check") || process.argv.includes("--dry-run");
  const graph = getMemoryGraph();
  const findings = buildFindings(graph);
  const report = renderReport(graph, findings);

  if (isCheck) {
    console.log(report);
    console.log(`CONNECTION_SCAN_OK (dry run: 0 files written, ${findings.length} findings)`);
    return;
  }

  const outPath = path.resolve(ROOT, process.argv[2] || "runtime/reports/connections.md");
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, report, "utf8");

  // Stage findings as quarantined bridges
  const quarantineDir = process.env.DIZZY_QUARANTINE_PATH
    ? path.resolve(process.env.DIZZY_QUARANTINE_PATH)
    : path.resolve(ROOT, "runtime/quarantine");
  ensureDir(quarantineDir);
  for (const f of findings) {
    const bridgeId = getBridgeId(f.a.path, f.b.path);
    const bridgeFile = path.join(quarantineDir, `bridge_${bridgeId}.json`);
    const bridgePayload = {
      id: bridgeId,
      source_file: f.a.path,
      target_file: f.b.path,
      score: Number((f.score / 15).toFixed(3)),
      bridge_concepts: f.tokens,
      shared_entities: f.entities,
      shared_signals: f.signals,
      status: "quarantined",
      approved_by_operator: false,
      suggested_at: new Date().toISOString()
    };
    fs.writeFileSync(bridgeFile, JSON.stringify(bridgePayload, null, 2), "utf8");
  }

  console.log(`CONNECTION_SCAN_OK wrote ${path.relative(ROOT, outPath).replace(/\\/g, "/")} (${findings.length} findings)`);
}

main();
