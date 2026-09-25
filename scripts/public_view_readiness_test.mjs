import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(process.cwd());

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assertAscii(relPath, text) {
  const bad = [...text].find((ch) => ch.charCodeAt(0) > 127);
  assert.equal(bad, undefined, `${relPath} contains non-ASCII public-surface text`);
}

function assertAbsent(relPath, text, patterns) {
  for (const pattern of patterns) {
    assert.equal(pattern.test(text), false, `${relPath} contains blocked public-view wording: ${pattern}`);
  }
}

function assertPresent(relPath, text, patterns) {
  for (const pattern of patterns) {
    assert.equal(pattern.test(text), true, `${relPath} is missing required public-view wording: ${pattern}`);
  }
}

function trackedMarkdownFiles() {
  try {
    return execFileSync("git", ["ls-files", "*.md"], { cwd: ROOT, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((relPath) => fs.existsSync(path.join(ROOT, relPath)));
  } catch {
    return Object.keys(docs);
  }
}

const asciiDocs = {
  "README.md": read("README.md"),
  "QUICKSTART.md": read("QUICKSTART.md"),
  "RUNBOOK.md": read("RUNBOOK.md"),
  "PR_W0068_DESCRIPTION.md": read("PR_W0068_DESCRIPTION.md"),
  "docs/public_truth_language.md": read("docs/public_truth_language.md"),
  "docs/positioning_and_doctrine.md": read("docs/positioning_and_doctrine.md"),
};

const allDocs = {
  ...asciiDocs,
  "MODEL_INVENTORY.md": read("MODEL_INVENTORY.md"),
};
const docs = allDocs;

const dashboardAssets = {
  "dashboard/index.html": read("dashboard/index.html"),
  "dashboard/dashboard.js": read("dashboard/dashboard.js"),
};

for (const [relPath, text] of Object.entries(asciiDocs)) {
  assertAscii(relPath, text);
}

assertAbsent("README.md", allDocs["README.md"], [
  /img\.shields\.io/i,
  /github\/actions\/workflow\/status/i,
  /Working runtime/i,
  /branch=main/i,
]);

assertAbsent("public docs", Object.values(allDocs).join("\n"), [
  /C:\\Users\\Josh/i,
  /\.gemini/i,
  /enabled by default when running `npm start`/i,
  /`DIZZY_DASHBOARD_ENABLED=1` or `npm start`/i,
  /npm start\s*->\s*`?http:\/\/localhost:3000\/dashboard`?/i,
  /masterpiece/i,
  /Ferrari engine/i,
  /mathematically sound/i,
  /100%\s+ready/i,
  /100%\s+green/i,
  /fully autonomous/i,
  /public A2A interoperability is live/i,
  /hosted production (product|service|launch) is ready/i,
  /113 syntax targets/i,
  /56 deterministic execution suites/i,
  /116 syntax targets/i,
  /57 test suites/i,
  /F1236DF4DFFC1B15BC9958A50D001BA0C0B9B291C887854B34FBF144D4C69C56/i,
  /cryptographic route attestations?/i,
  /production routes are sealed/i,
  /ZDR verified/i,
  /immutable Council verification/i,
  /cryptographic (verification )?receipts? for every transition/i,
  /immutable receipts?/i,
  /offline,? deterministic (verification )?Council/i,
  /48-Model Catalog/i,
  /The 48-Model Roster Breakdown/i,
]);

for (const relPath of trackedMarkdownFiles()) {
  assertAbsent(relPath, read(relPath), [
    /C:\\Users\\Josh/i,
    /\.gemini/i,
    /brain\\[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}/i,
  ]);
}

assertPresent("README.md", docs["README.md"], [
  /not a hosted production launch/i,
  /Public Truth Language/i,
  /DIZZY_DASHBOARD_ENABLED=1/i,
  /Operator captured the W-0106 walkthrough screenshots offline/i,
  /single-runtime, shared-secret signed JSON ingress proof/i,
]);

assertPresent("docs/public_truth_language.md", docs["docs/public_truth_language.md"], [
  /verified/i,
  /rehearsal/i,
  /local/i,
  /operator-mediated/i,
  /sample/i,
  /unknown/i,
  /blocked/i,
  /receipt-scoped evidence/i,
]);

assertPresent("QUICKSTART.md", docs["QUICKSTART.md"], [
  /Dizzy is not a hosted production service/i,
  /single-runtime, shared-secret signed JSON ingress proof/i,
  /DIZZY_DASHBOARD_ENABLED=1/i,
  /Operator captured the W-0106 walkthrough screenshots offline/i,
]);

assertPresent("RUNBOOK.md", docs["RUNBOOK.md"], [
  /dashboard is opt-in/i,
  /set `DIZZY_DASHBOARD_ENABLED=1` before/i,
]);

assertPresent("PR_W0068_DESCRIPTION.md", docs["PR_W0068_DESCRIPTION.md"], [
  /not a hosted production release/i,
  /dashboard proof is source\/API and route-level/i,
]);

assertAbsent("dashboard assets", Object.values(dashboardAssets).join("\n"), [
  /All Routes Operational/i,
  /Greetings\. Chat history cleared/i,
  /Receipt & Capability Proof/i,
  /Live Route Circuit Breakers/i,
  /Latency-Cost-Trust Pareto Frontier HUD/i,
  /Multi-objective frontier plotting/i,
]);

assertPresent("dashboard assets", Object.values(dashboardAssets).join("\n"), [
  /Receipt &(amp;)? Capability Evidence/i,
  /Reported Route Circuit Breakers \(Fixture Data\)/i,
  /Reported Latency-Cost-Trust Map/i,
  /receipt-scoped verification scores/i,
  /Receipt Git State/i,
  /Configured Instruction Sources/i,
  /A complete Current Run Contract is not yet implemented/i,
  /Privacy Note/i,
  /Operator Notice/i,
  /Memory Index/i,
  /Receipt Trail/i,
  /Review Supplied Evidence/i,
  /Advisory local review only/i,
  /no file reads, edits, tests, commits, or promotion authority/i,
  /Simulation only:/i,
]);

for (const relPath of [
  "UNIFIED_HANDOFF_PACKET.md",
  "reviews/w0068_staging_triage.md",
  "reviews/antigravity_to_codex_handoff_latest.md",
  "reviews/antigravity_post_docking_handoff_latest.md",
  "reviews/codex_to_antigravity_public_view_handoff_2026-08-31.md",
]) {
  assert.equal(fs.existsSync(path.join(ROOT, relPath)), false, `${relPath} is an internal handoff artifact and should not be present in the public branch`);
}

console.log("PUBLIC_VIEW_READINESS_TESTS_OK");
