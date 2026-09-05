import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BRIDGE_CANONICALIZATION,
  NODE_PYTHON_BRIDGE_CONTRACT_RECEIPT_SCHEMA,
  SIDECAR_LIVE_CONTAINER_PROOF_SCHEMA,
  canonicalBridgePayloadSha256,
  stableJson,
  createBridgeRequest,
  adaptScanResultToBridgeRequest,
  validateBridgeRequest,
  validateBridgeResponse,
} from "../lib/node_python_council_bridge_contract.mjs";

console.log("[test:node-python-council-bridge-contract] Starting W-0112 bridge contract tests...");

const fixturesPath = path.resolve(process.cwd(), "scripts/fixtures/node_python_council_bridge_contract_fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergePatch(target, patch) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (isPlainObject(value) && isPlainObject(target[key])) mergePatch(target[key], value);
    else target[key] = deepClone(value);
  }
}

function applyMutation(target, mutation) {
  const pathParts = mutation.path || [];
  assert.ok(pathParts.length > 0, "mutation path must not be empty");
  let cursor = target;
  for (const part of pathParts.slice(0, -1)) {
    cursor = cursor[part];
    assert.ok(cursor && typeof cursor === "object", `mutation parent missing for ${pathParts.join(".")}`);
  }
  const last = pathParts[pathParts.length - 1];
  if (mutation.delete) delete cursor[last];
  else cursor[last] = mutation.value;
}

const validRequest = fixtures.valid_bridge_request;
assert.equal(validRequest.integrity.canonicalization, BRIDGE_CANONICALIZATION);

const requestResult = validateBridgeRequest(validRequest);
assert.equal(requestResult.ok, true, JSON.stringify(requestResult.errors, null, 2));
assert.equal(requestResult.actual_payload_sha256, validRequest.integrity.payload_sha256);
assert.equal(canonicalBridgePayloadSha256(validRequest.payload), validRequest.integrity.payload_sha256);
assert.notEqual(
  validRequest.payload.bounty_task.payload_sha256.toLowerCase(),
  validRequest.integrity.payload_sha256,
  "task digest must stay distinct from full bridge payload digest"
);
console.log("  [PASS] valid request schema and bridge payload hash");

const reorderedPayload = {
  triage_receipt: validRequest.payload.triage_receipt,
  schema_version: validRequest.payload.schema_version,
  proof_boundaries: validRequest.payload.proof_boundaries,
  operator_approval_required_for: validRequest.payload.operator_approval_required_for,
  notes: validRequest.payload.notes,
  state_machine: validRequest.payload.state_machine,
  council_directives: validRequest.payload.council_directives,
  bounty_task: validRequest.payload.bounty_task,
};
assert.equal(
  canonicalBridgePayloadSha256(reorderedPayload),
  validRequest.integrity.payload_sha256,
  "stable JSON hash must ignore object insertion order"
);
assert.equal(stableJson(reorderedPayload), stableJson(validRequest.payload));
console.log("  [PASS] canonical JSON is stable across key ordering");

for (const fixture of fixtures.negative_request_cases) {
  const request = deepClone(validRequest);
  for (const mutation of fixture.mutations) applyMutation(request, mutation);
  const result = validateBridgeRequest(request);
  const actualCodes = result.errors.map((error) => error.code);
  assert.equal(result.ok, false, `${fixture.name} should fail`);
  for (const expectedCode of fixture.expected_error_codes) {
    assert.ok(
      actualCodes.includes(expectedCode),
      `${fixture.name} expected ${expectedCode}, got ${actualCodes.join(", ")}`
    );
  }
  console.log(`  [PASS] negative request rejected: ${fixture.name}`);
}

const responseResult = validateBridgeResponse(fixtures.valid_bridge_response, validRequest);
assert.equal(responseResult.ok, true, JSON.stringify(responseResult.errors, null, 2));
console.log("  [PASS] valid sidecar response remains rehearsal-only");

const unsafeResponse = {
  ...fixtures.valid_bridge_response,
  receipt_authority: "public_claim_receipt",
  public_claim_allowed: true,
};
const unsafeResponseResult = validateBridgeResponse(unsafeResponse, validRequest);
const unsafeCodes = unsafeResponseResult.errors.map((error) => error.code);
assert.equal(unsafeResponseResult.ok, false, "unsafe response should fail");
assert.ok(unsafeCodes.includes("UNSAFE_RESPONSE_RECEIPT_AUTHORITY"));
assert.ok(unsafeCodes.includes("PUBLIC_CLAIM_NOT_ALLOWED"));
console.log("  [PASS] sidecar response cannot escalate to public or promotion authority");

for (const fixture of fixtures.response_sandbox_boundary_cases) {
  const response = deepClone(fixtures.valid_bridge_response);
  mergePatch(response, fixture.response_patch);
  const result = validateBridgeResponse(response, validRequest);
  const actualCodes = result.errors.map((error) => error.code);
  assert.equal(result.ok, fixture.expected_ok, `${fixture.name} expected ok=${fixture.expected_ok}, got ${JSON.stringify(result.errors)}`);
  for (const expectedCode of fixture.expected_error_codes || []) {
    assert.ok(
      actualCodes.includes(expectedCode),
      `${fixture.name} expected ${expectedCode}, got ${actualCodes.join(", ")}`
    );
  }
  if (response.execution_environment?.live_container_proof) {
    assert.equal(
      response.execution_environment.live_container_proof.schema_version,
      SIDECAR_LIVE_CONTAINER_PROOF_SCHEMA
    );
  }
  console.log(`  [PASS] sidecar sandbox boundary case: ${fixture.name}`);
}

const mockScanResult = {
  opportunity: {
    opportunity_id: "mock_test_opp",
    title: "Mock Vulnerability Bounty",
  },
  envelope: {
    schema_version: "dizzy.bounty_a2a_ingest.v1",
    payload: validRequest.payload,
  },
};
const adaptedRequest = adaptScanResultToBridgeRequest(mockScanResult);
const adaptedValidation = validateBridgeRequest(adaptedRequest);
assert.equal(adaptedValidation.ok, true, JSON.stringify(adaptedValidation.errors));
assert.equal(adaptedRequest.integrity.payload_sha256, validRequest.integrity.payload_sha256);
assert.equal(adaptedRequest.authority.requested_receipt_authority, "rehearsal_receipt");
console.log("  [PASS] adaptScanResultToBridgeRequest produces verified W-0112 bridge request");

const receipt = {
  schema_version: NODE_PYTHON_BRIDGE_CONTRACT_RECEIPT_SCHEMA,
  timestamp: new Date().toISOString(),
  status: "BRIDGE_CONTRACT_VERIFIED",
  receipt_authority: "promotion_receipt",
  promoted_scope: "node_python_bridge_contract_schema_only",
  runtime_promotion_allowed: false,
  public_claim_allowed: false,
  fixtures_checked: {
    valid_request: true,
    valid_response: true,
    negative_request_cases: fixtures.negative_request_cases.map((fixture) => fixture.name),
    response_sandbox_boundary_cases: fixtures.response_sandbox_boundary_cases.map((fixture) => fixture.name),
    unsafe_response_escalation: true,
  },
  invariants_verified: [
    "bridge_payload_hash_lives_in_integrity_payload_sha256",
    "bounty_task_payload_sha256_remains_task_digest",
    "tampered_payload_reusing_old_hash_is_rejected",
    "sidecar_response_authority_is_rehearsal_only",
    "simulated_sidecar_execution_cannot_promote_or_make_public_claims",
    "live_sidecar_execution_claim_requires_verified_container_and_egress_proof",
    "contract_promotion_does_not_promote_python_runtime",
  ],
};

const receiptPath = path.resolve(process.cwd(), "reviews/node_python_bridge_contract_latest.json");
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(`[PASS] W-0112 contract receipt saved to ${receiptPath}`);
console.log("NODE_PYTHON_COUNCIL_BRIDGE_CONTRACT_TESTS_OK");
