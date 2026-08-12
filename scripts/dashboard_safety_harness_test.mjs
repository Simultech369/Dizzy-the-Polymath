import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.resolve(ROOT, relPath), "utf8");
}

function attrIssues($) {
  const issues = [];
  $("*").each((_, el) => {
    const attribs = el.attribs || {};
    for (const [name, value] of Object.entries(attribs)) {
      const attr = String(name || "").toLowerCase();
      const raw = String(value || "").trim();
      if (attr.startsWith("on")) issues.push(`${el.tagName}[${name}]`);
      if ((attr === "href" || attr === "src") && /^javascript:/i.test(raw)) {
        issues.push(`${el.tagName}[${name}] uses javascript:`);
      }
    }
  });
  return issues;
}

function staticDomIds(jsText) {
  return Array.from(jsText.matchAll(/document\.getElementById\(\s*["']([^"']+)["']\s*\)/g), (match) => match[1]);
}

function svgUpdateIds(jsText) {
  const ids = [];
  for (const match of jsText.matchAll(/updateSvg(?:Node|Line)\(\s*["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?/g)) {
    ids.push(match[1]);
    if (match[2]) ids.push(match[2]);
  }
  return ids;
}

function literalFetchPaths(jsText) {
  const paths = [];
  const fetchPattern = /\bfetch(?:Json)?\(\s*([`"'])(\/[^`"']+)/g;
  for (const match of jsText.matchAll(fetchPattern)) {
    const raw = match[2].split("${", 1)[0].split("?", 1)[0];
    if (raw) paths.push(raw);
  }
  return paths;
}

function unique(values) {
  return Array.from(new Set(values)).sort();
}

console.log("=== W-0064 Dashboard Safety Harness Test Suite ===");

const html = read("dashboard/index.html");
const dashboardJs = read("dashboard/dashboard.js");
const loginJs = read("dashboard/dashboard-login.js");
const dashboardModule = read("lib/dashboard.mjs");
const server = read("agent_server.mjs");
const packageJson = JSON.parse(read("package.json"));

const $ = cheerio.load(html);
const htmlIds = new Set($("[id]").map((_, el) => $(el).attr("id")).get());
const optionalFutureDomIds = new Map([
  ["btn-resolve-containment", "btnResolveContainment"],
]);

const scripts = $("script").map((_, el) => ({
  src: $(el).attr("src") || "",
  defer: $(el).attr("defer") !== undefined,
  inline: Boolean($(el).html()?.trim()),
})).get();

assert.deepEqual(scripts, [{ src: "/assets/dashboard.js", defer: true, inline: false }]);
assert.equal(html.includes("<script>"), false);
assert.equal(html.includes("</script>"), true);
assert.equal(attrIssues($).length, 0, `Unsafe dashboard attributes: ${attrIssues($).join(", ")}`);

const tabTargets = $("[data-tab-target]").map((_, el) => $(el).attr("data-tab-target")).get();
for (const target of tabTargets) {
  assert.equal(htmlIds.has(target), true, `Tab target is missing content panel: ${target}`);
}

const jsIds = unique([...staticDomIds(dashboardJs), ...svgUpdateIds(dashboardJs)]);
const missingIds = jsIds.filter((id) => !htmlIds.has(id) && !optionalFutureDomIds.has(id));
assert.deepEqual(missingIds, [], `dashboard.js references missing DOM ids: ${missingIds.join(", ")}`);
for (const [, variableName] of optionalFutureDomIds) {
  assert.match(dashboardJs, new RegExp(`if \\(${variableName}\\)`));
}

assert.equal(dashboardJs.includes("document.write"), false);
assert.equal(loginJs.includes("document.write"), false);
assert.equal(/eval\s*\(/.test(dashboardJs + loginJs), false);
assert.equal(/new Function\s*\(/.test(dashboardJs + loginJs), false);

const dashboardCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const loginCsp = "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
assert.equal(dashboardModule.includes(`"${dashboardCsp}"`), true);
assert.equal(dashboardModule.includes(`"${loginCsp}"`), true);
assert.doesNotMatch(dashboardCsp, /script-src[^;]*'unsafe-inline'/);
assert.doesNotMatch(loginCsp, /script-src[^;]*'unsafe-inline'/);

const dashboardRoutes = unique([
  ...literalFetchPaths(dashboardJs),
  ...literalFetchPaths(loginJs),
  "/dashboard",
  "/dashboard/login",
  "/dashboard/session",
  "/assets/dashboard.js",
  "/assets/dashboard-login.js",
]);
for (const route of dashboardRoutes) {
  assert.equal(
    server.includes(`"${route}"`),
    true,
    `Dashboard route used by HTML/JS is missing from agent_server.mjs allowlist/fallbacks: ${route}`,
  );
}

assert.equal(packageJson.scripts["test:dashboard-safety"], "node ./scripts/dashboard_safety_harness_test.mjs");

console.log(`DASHBOARD_SAFETY_HARNESS_TESTS_OK ids=${jsIds.length} routes=${dashboardRoutes.length}`);
