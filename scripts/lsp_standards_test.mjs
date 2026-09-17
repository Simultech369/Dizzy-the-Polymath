import assert from "node:assert";
import {
  LSP6_PERMISSIONS,
  OPERATION_TYPES,
  validateAgentLsp6Permissions,
  decodePermissionNames,
  encodeLsp2DataKey,
  createLspExecutionReceipt,
  LSP_EXECUTION_RECEIPT_SCHEMA,
} from "../lib/lsp_standards.mjs";

console.log("[test:lsp-standards] Starting suite...");

// 1. Valid agent permissions (CALL + SETDATA + STATICCALL)
const validMask = LSP6_PERMISSIONS.CALL | LSP6_PERMISSIONS.SETDATA | LSP6_PERMISSIONS.STATICCALL;
const check1 = validateAgentLsp6Permissions(validMask);
assert.equal(check1.ok, true);
assert.equal(check1.violations.length, 0);
assert.deepEqual(check1.active_permissions.sort(), ["CALL", "SETDATA", "STATICCALL"].sort());

// 2. Prohibited permissions (DELEGATECALL)
const unsafeMask1 = validMask | LSP6_PERMISSIONS.DELEGATECALL;
const check2 = validateAgentLsp6Permissions(unsafeMask1);
assert.equal(check2.ok, false);
assert.ok(check2.violations.some((v) => v.includes("DELEGATECALL")));

// 3. Prohibited permissions (CHANGEOWNER & CHANGEPERMISSIONS)
const unsafeMask2 = validMask | LSP6_PERMISSIONS.CHANGEOWNER | LSP6_PERMISSIONS.CHANGEPERMISSIONS;
const check3 = validateAgentLsp6Permissions(unsafeMask2);
assert.equal(check3.ok, false);
assert.equal(check3.violations.length, 2);

// 4. Hex string input parsing
const hexMask = "0x0c"; // SETDATA (0x04) | CALL (0x08)
const check4 = validateAgentLsp6Permissions(hexMask);
assert.equal(check4.ok, true);
assert.deepEqual(check4.active_permissions.sort(), ["CALL", "SETDATA"].sort());

// 5. Explicit override option
const check5 = validateAgentLsp6Permissions(unsafeMask1, { allowDelegateCall: true });
assert.equal(check5.ok, true);

// 6. LSP2 Data Key generation
const key = encodeLsp2DataKey("DizzyCouncilVerdictLatest");
assert.ok(key.startsWith("0x"));
assert.equal(key.length, 66); // 0x + 64 hex chars

// 7. LSP Execution Receipt emission
const receipt1 = createLspExecutionReceipt({
  account: "0x1111111111111111111111111111111111111111",
  controller: "0x2222222222222222222222222222222222222222",
  operationType: OPERATION_TYPES.CALL,
  target: "0x3333333333333333333333333333333333333333",
  permissions: validMask,
});
assert.equal(receipt1.schema_version, LSP_EXECUTION_RECEIPT_SCHEMA);
assert.equal(receipt1.status, "PASSED");
assert.equal(receipt1.permissions_valid, true);

// 8. LSP Execution Receipt with violated permissions fails closed
const receipt2 = createLspExecutionReceipt({
  account: "0x1111111111111111111111111111111111111111",
  controller: "0x2222222222222222222222222222222222222222",
  operationType: OPERATION_TYPES.CALL,
  target: "0x3333333333333333333333333333333333333333",
  permissions: unsafeMask1,
});
assert.equal(receipt2.status, "FAILED");
assert.equal(receipt2.permissions_valid, false);
assert.ok(receipt2.error.includes("DELEGATECALL"));

console.log("  [PASS] All LSP standard validations, permission bitmasks, and receipt assertions passed.");
console.log("\n[test:lsp-standards] ALL TESTS PASSED CLEANLY.\n");
