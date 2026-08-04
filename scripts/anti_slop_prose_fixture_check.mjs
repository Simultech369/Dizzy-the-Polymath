import assert from "node:assert/strict";
import { scanProseSlop } from "../lib/anti_slop_scanner.mjs";

const acceptedHitFixtures = [
  {
    name: "affirmation plus promotional tell",
    text: "Great question! This is a seamless cutting-edge solution for every workflow.",
    expectedMatches: ["great question", "seamless", "cutting-edge"],
  },
  {
    name: "throat clearing and copula dodge",
    text: "In summary, this robust platform serves as a beacon of operational excellence.",
    expectedMatches: ["in summary", "robust", "serves as", "beacon of"],
  },
];

const rejectedFalsePositiveFixtures = [
  {
    name: "fenced prompt example",
    text: [
      "```text",
      "Great question! This seamless solution is intentionally shown as a bad example.",
      "```",
    ].join("\n"),
  },
  {
    name: "rule catalog table",
    text: '| Warning trigger | Generic praise ("Great question!") and promotional jargon ("seamless") | Advisory |',
  },
  {
    name: "inline quoted definition",
    text: 'The rule catalog uses the phrase "cutting-edge" as an example, not as produced prose.',
  },
  {
    name: "plain technical prose",
    text: "The Redis queue uses idempotency keys and route-scoped fingerprints to avoid replay drift.",
  },
  {
    name: "prompt rule catalog block",
    text: [
      "Avoid by default:",
      "",
      '* inflated significance ("pivotal", "watershed", "game-changing") when the evidence is ordinary',
      '* frictionless promotional phrasing ("robust", "seamless", "vibrant") when a plain description would do',
      '* copula-dodging constructions ("serves as", "boasts", "features") when "is" or "has" would be clearer',
    ].join("\n"),
  },
  {
    name: "inline code backticks",
    text: "This scanner rule flags `seamless` as a banned word.",
  },
  {
    name: "doc overlay example",
    text: 'The prompt overlay schema allows "robust" when discussing error handling.',
  },
];

let expectedHitCount = 0;
let actualHitCount = 0;

for (const fixture of acceptedHitFixtures) {
  const result = scanProseSlop(fixture.text);
  const matches = new Set(result.findings.map((item) => item.match));
  for (const expected of fixture.expectedMatches) {
    expectedHitCount += 1;
    assert.ok(matches.has(expected), `${fixture.name}: expected match ${expected}`);
  }
  actualHitCount += result.findings.length;
  assert.equal(result.passed, false, `${fixture.name}: accepted-hit fixture should not pass`);
  for (const finding of result.findings) {
    assert.equal(finding.severity, "advisory", `${fixture.name}: finding must remain advisory`);
    assert.equal(finding.category, "prose", `${fixture.name}: finding must be prose scoped`);
    assert.match(finding.rule_id, /^w0062\.prose\./, `${fixture.name}: finding needs a stable rule id`);
  }
}

for (const fixture of rejectedFalsePositiveFixtures) {
  const result = scanProseSlop(fixture.text);
  assert.deepEqual(result.findings, [], `${fixture.name}: expected no prose slop findings`);
  assert.equal(result.passed, true, `${fixture.name}: false-positive fixture should pass`);
}

console.log(`ANTI_SLOP_PROSE_FIXTURES_OK accepted_hits=${expectedHitCount} false_positive_fixtures=${rejectedFalsePositiveFixtures.length}`);
