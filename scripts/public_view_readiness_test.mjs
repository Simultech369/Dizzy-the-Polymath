import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

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

const docs = {
  "README.md": read("README.md"),
  "QUICKSTART.md": read("QUICKSTART.md"),
  "RUNBOOK.md": read("RUNBOOK.md"),
  "PR_W0068_DESCRIPTION.md": read("PR_W0068_DESCRIPTION.md"),
};

const dashboardAssets = {
  "dashboard/index.html": read("dashboard/index.html"),
  "dashboard/dashboard.js": read("dashboard/dashboard.js"),
};

for (const [relPath, text] of Object.entries(docs)) {
  assertAscii(relPath, text);
}

assertAbsent("README.md", docs["README.md"], [
  /img\.shields\.io/i,
  /github\/actions\/workflow\/status/i,
  /Working runtime/i,
  /branch=main/i,
]);

assertAbsent("public docs", Object.values(docs).join("\n"), [
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
]);

assertPresent("README.md", docs["README.md"], [
  /not a hosted production launch/i,
  /DIZZY_DASHBOARD_ENABLED=1/i,
  /Operator captured the W-0106 walkthrough screenshots offline/i,
  /single-runtime, shared-secret signed JSON ingress proof/i,
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
]);

console.log("PUBLIC_VIEW_READINESS_TESTS_OK");
