import assert from "node:assert/strict";
import { scanVisualSurface } from "../lib/visual_slop_scanner.mjs";

const acceptedHitFixtures = [
  {
    name: "private path and unsupported launch claim",
    surface: {
      visibleText: "VERIFIED_PASSED, production ready. Evidence: C:\\Users\\Josh\\.gemini\\antigravity\\scratch\\council_engine",
      visualEffects: ["gradient orb"],
      imageSources: ["https://example.invalid/product.png"],
      motion: { enabled: true },
      contrastRatio: 3.2,
      statusEncoding: "color-only",
      nestedCards: true,
    },
    expectedRules: [
      "w0062.visual.private_context_exposure",
      "w0062.visual.unsupported_status_claim",
      "w0062.visual.decorative_excess",
      "w0062.visual.unattributed_external_media",
      "w0062.visual.motion_without_reduced_motion",
      "w0062.visual.low_contrast",
      "w0062.visual.color_only_status",
      "w0062.visual.nested_card_layout",
    ],
  },
  {
    name: "unsupported pytest promotion claim",
    surface: {
      title: "181/181 pytest, ready for production",
      caption: "The Python proving lab can be promoted now.",
    },
    expectedRules: ["w0062.visual.unsupported_status_claim"],
  },
];

const rejectedFalsePositiveFixtures = [
  {
    name: "receipt-backed staging status",
    surface: {
      visibleText: "VERIFIED_PASSED, staging only",
      receiptHash: "4E84907B0B3F5355F4B34C3B305A76792C183D32D21423D5E847BFB1A4BC03C5",
      evidencePaths: ["reviews/oss_council_verdict_latest.json"],
      statusEncoding: "text-and-color",
      contrastRatio: 7.1,
    },
  },
  {
    name: "attributed external media with reduced motion",
    surface: {
      visibleText: "Operational dashboard preview",
      imageSources: ["https://example.invalid/preview.png"],
      sourceAttribution: ["synthetic fixture asset"],
      motion: { enabled: true, reducedMotion: true },
      contrastRatio: 5.8,
    },
  },
  {
    name: "plain data table",
    surface: {
      visibleText: "Trust zone, model route, cost band, and execution status",
      statusEncoding: "text-and-icon",
      contrastRatio: 6.0,
      cardDepth: 1,
    },
  },
];

let expectedHitCount = 0;

for (const fixture of acceptedHitFixtures) {
  const result = scanVisualSurface(fixture.surface);
  const ruleIds = new Set(result.findings.map((item) => item.rule_id));
  for (const expected of fixture.expectedRules) {
    expectedHitCount += 1;
    assert.ok(ruleIds.has(expected), `${fixture.name}: expected visual rule ${expected}`);
  }
  assert.equal(result.passed, false, `${fixture.name}: accepted-hit fixture should not pass`);
  for (const finding of result.findings) {
    assert.equal(finding.category, "visual", `${fixture.name}: finding must remain visual scoped`);
    assert.match(finding.rule_id, /^w0062\.visual\./, `${fixture.name}: finding needs a stable rule id`);
  }
}

for (const fixture of rejectedFalsePositiveFixtures) {
  const result = scanVisualSurface(fixture.surface);
  assert.deepEqual(result.findings, [], `${fixture.name}: expected no visual slop findings`);
  assert.equal(result.passed, true, `${fixture.name}: false-positive fixture should pass`);
}

console.log(`ANTI_SLOP_VISUAL_FIXTURES_OK accepted_hits=${expectedHitCount} false_positive_fixtures=${rejectedFalsePositiveFixtures.length}`);
