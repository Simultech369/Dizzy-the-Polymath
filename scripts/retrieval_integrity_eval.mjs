import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

import {
  getRelevantMarkdownSnippets,
  resetMarkdownIndexCacheForTests,
} from "../lib/md_retriever.mjs";

const ROOT = process.cwd();
const FIXTURE_REL = "runtime/test-retrieval-integrity";
const FIXTURE_DIR = path.resolve(ROOT, FIXTURE_REL);
const RESULTS_DIR = path.resolve(ROOT, "evaluations", "retrieval-integrity", "results");
const RESULTS_PATH = path.join(RESULTS_DIR, "latest.json");
const ENV_KEYS = ["DIZZY_RAG_ROOT", "DIZZY_RAG_ALLOWED_ROOTS", "DIZZY_RAG_TOP_K", "DIZZY_RAG_CACHE_MS"];
const previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function fixtureFrontmatter(overrides = {}) {
  const data = {
    memory_type: "semantic",
    memory_class: "assistant_observation",
    captured_at: "2026-06-21",
    event_time: "2026-06-21",
    event_time_basis: "observed",
    source: "operator_reviewed",
    confidence: "high",
    freshness_window: "30d",
    sensitivity_class: "normal",
    quantitative_attribution: "none",
    zone_origin: "private_self",
    zone_allowed: "private_self",
    last_reviewed: "2026-06-21",
    revocation_path: "none",
    memory_status: "active",
    ...overrides,
  };
  return ["---", ...Object.entries(data).map(([key, value]) => `${key}: ${value}`), "---"].join("\n");
}

function writeFixture(name, body, metadata = {}) {
  fs.writeFileSync(path.join(FIXTURE_DIR, name), `${fixtureFrontmatter(metadata)}\n${body.trim()}\n`, "utf8");
}

function restoreEnvironment() {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function ranked(query, opts = {}) {
  resetMarkdownIndexCacheForTests();
  return getRelevantMarkdownSnippets(query, { k: 20, ...opts });
}

function result(id, passed, evidence, expected) {
  return { id, passed: Boolean(passed), expected, evidence };
}

export function runRetrievalIntegrityEvaluation() {
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  writeFixture("current.md", "orchidstatus protocol route is current and green");
  writeFixture("stale.md", "orchidstatus protocol route is historical and red", {
    captured_at: "2024-01-01",
    event_time: "2024-01-01",
    last_reviewed: "2024-01-01",
    freshness_window: "30d",
  });
  writeFixture("revoked.md", "revokeneedle obsolete instruction remains searchable", {
    memory_status: "revoked",
    revocation_path: "operator_restore_or_delete_fixture",
  });
  writeFixture("zone-blocked.md", "zoneonlyneedle paid public material", {
    zone_origin: "paid_public",
    zone_allowed: "paid_public",
  });
  writeFixture("a-assistant-claim.md", "conflictneedle launch state claim", {
    source: "assistant_proposed",
  });
  writeFixture("z-operator-claim.md", "conflictneedle launch state claim", {
    source: "operator_reviewed",
  });

  process.env.DIZZY_RAG_ROOT = FIXTURE_REL;
  process.env.DIZZY_RAG_ALLOWED_ROOTS = FIXTURE_REL;
  process.env.DIZZY_RAG_TOP_K = "20";
  process.env.DIZZY_RAG_CACHE_MS = "60000";

  const temporal = ranked("orchidstatus protocol route");
  const temporalPaths = temporal.map((item) => item.path);
  const currentIndex = temporalPaths.findIndex((item) => item.endsWith("current.md"));
  const staleIndex = temporalPaths.findIndex((item) => item.endsWith("stale.md"));

  const revoked = ranked("revokeneedle obsolete instruction");
  const zoneBlocked = ranked("zoneonlyneedle paid public material", { trustZone: "private_self" });
  const authority = ranked("conflictneedle launch state claim");
  const missing = ranked("absentneedlethatdoesnotexist");
  const replayOne = ranked("orchidstatus protocol route").map(({ path: itemPath, source_hash }) => ({ path: itemPath, source_hash }));
  const replayTwo = ranked("orchidstatus protocol route").map(({ path: itemPath, source_hash }) => ({ path: itemPath, source_hash }));

  const cases = [
    result(
      "temporal_current_over_stale",
      currentIndex >= 0 && staleIndex >= 0 && currentIndex < staleIndex,
      { ranked_paths: temporalPaths, current_index: currentIndex, stale_index: staleIndex },
      "fresh equivalent evidence ranks above stale evidence",
    ),
    result(
      "revoked_excluded",
      !revoked.some((item) => item.path.endsWith("revoked.md")),
      { ranked_paths: revoked.map((item) => item.path) },
      "a record explicitly marked memory_status: revoked is excluded",
    ),
    result(
      "zone_ineligible_excluded",
      !zoneBlocked.some((item) => item.path.endsWith("zone-blocked.md")),
      { ranked_paths: zoneBlocked.map((item) => item.path) },
      "records not allowed in private_self are excluded from private retrieval",
    ),
    result(
      "operator_reviewed_over_assistant_proposed",
      authority[0]?.path.endsWith("z-operator-claim.md"),
      { ranked_paths: authority.map((item) => item.path) },
      "operator-reviewed evidence outranks an otherwise identical assistant proposal",
    ),
    result(
      "missing_evidence_abstains",
      missing.length === 0,
      { result_count: missing.length },
      "a query without evidence returns no snippets",
    ),
    result(
      "deterministic_replay",
      JSON.stringify(replayOne) === JSON.stringify(replayTwo),
      { first: replayOne, second: replayTwo },
      "same corpus and query replay to identical ranked paths and source hashes",
    ),
  ];

  return {
    evaluation: "dizzy-retrieval-integrity-v1",
    status: "report_only",
    passed: cases.every((item) => item.passed),
    passed_count: cases.filter((item) => item.passed).length,
    case_count: cases.length,
    cases,
    promotion: {
      runtime_changed: true,
      auto_fix: false,
      note: "The evaluation verifies narrowly promoted retrieval integrity rules; further failures do not authorize additional automatic changes.",
    },
  };
}

function main() {
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ evaluation: "dizzy-retrieval-integrity-v1", status: "dry_run", fixture_root: FIXTURE_REL }, null, 2));
    return;
  }
  try {
    const report = runRetrievalIntegrityEvaluation();
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
    console.log(`Retrieval integrity report: ${RESULTS_PATH}`);
    if (process.argv.includes("--require-pass") && !report.passed) process.exitCode = 1;
  } finally {
    resetMarkdownIndexCacheForTests();
    restoreEnvironment();
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
