import assert from "node:assert/strict";
import fs from "node:fs";

const POSTURE_DOC = "docs/external_gateway_posture.md";
const DESIGN_DOC = "DESIGN.md";
const NEXT_DOC = "NEXT.md";
const README_DOC = "README.md";

function read(relPath) {
  return fs.readFileSync(relPath, "utf8");
}

function assertIncludes(text, phrase, label) {
  assert.ok(text.includes(phrase), `${label} missing required phrase: ${phrase}`);
}

console.log("=== External Gateway Posture Test Suite ===");

const posture = read(POSTURE_DOC);
const design = read(DESIGN_DOC);
const next = read(NEXT_DOC);
const readme = read(README_DOC);

assertIncludes(posture, "Dizzy is not trying to win by being the broadest generic LLM gateway", POSTURE_DOC);
assertIncludes(posture, "Execution-facing code resolves the best policy-permitted route available on the current surface", POSTURE_DOC);
assertIncludes(posture, "An external gateway can provide reach. It does not provide authority.", POSTURE_DOC);
assertIncludes(posture, "no cross-zone or cross-client cache reuse", POSTURE_DOC);
assertIncludes(posture, "Do not copy implementation details, command vocabulary, dashboards, prompt text, or distinctive UX flows", POSTURE_DOC);
assertIncludes(posture, "does not treat provider reach as verification authority", POSTURE_DOC);

assertIncludes(design, "D-0062: External Gateways Are Adapter Surfaces, Not Authority", DESIGN_DOC);
assertIncludes(design, "External gateways can provide reach, not authority", DESIGN_DOC);
assertIncludes(next, "W-0137: Defined external gateway posture", NEXT_DOC);
assertIncludes(readme, "External Gateway Posture", README_DOC);

console.log("EXTERNAL_GATEWAY_POSTURE_TESTS_OK");
