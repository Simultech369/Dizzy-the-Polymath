import crypto from "node:crypto";

export const LSP_STANDARDS_SCHEMA = "dizzy.lsp_standards.v1";
export const LSP_EXECUTION_RECEIPT_SCHEMA = "dizzy.lsp_execution_receipt.v1";

/**
 * LSP0 ERC725X Operation Types
 */
export const OPERATION_TYPES = Object.freeze({
  CALL: 0,
  CREATE: 1,
  CREATE2: 2,
  STATICCALL: 3,
  DELEGATECALL: 4,
});

/**
 * LSP6 Key Manager Standard Permission Bitmasks (BigInt)
 */
export const LSP6_PERMISSIONS = Object.freeze({
  CHANGEOWNER: 1n << 0n,         // 0x01
  CHANGEPERMISSIONS: 1n << 1n,   // 0x02
  SETDATA: 1n << 2n,             // 0x04
  CALL: 1n << 3n,                // 0x08
  STATICCALL: 1n << 4n,          // 0x10
  DELEGATECALL: 1n << 5n,        // 0x20
  DEPLOY: 1n << 6n,              // 0x40
  TRANSFERVALUE: 1n << 7n,       // 0x80
  SIGN: 1n << 8n,                // 0x100
  ENCRYPT: 1n << 9n,             // 0x200
  SUPER_SETDATA: 1n << 10n,      // 0x400
  SUPER_CALL: 1n << 11n,         // 0x800
  SUPER_STATICCALL: 1n << 12n,   // 0x1000
  SUPER_DELEGATECALL: 1n << 13n, // 0x2000
});

export const FORBIDDEN_AGENT_PERMISSIONS = Object.freeze([
  "CHANGEOWNER",
  "CHANGEPERMISSIONS",
  "DELEGATECALL",
  "SUPER_DELEGATECALL",
]);

/**
 * Parses a hex string or BigInt into a permission bitmask BigInt.
 */
export function parsePermissionBitmask(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    const clean = value.startsWith("0x") ? value : `0x${value}`;
    return BigInt(clean);
  }
  return 0n;
}

/**
 * Converts a bitmask BigInt into an array of readable permission names.
 */
export function decodePermissionNames(bitmask) {
  const mask = parsePermissionBitmask(bitmask);
  const active = [];
  for (const [name, bit] of Object.entries(LSP6_PERMISSIONS)) {
    if ((mask & bit) === bit) {
      active.push(name);
    }
  }
  return active;
}

/**
 * Validates whether an agent's LSP6 permissions comply with least-privilege guardrails.
 * Fails closed if dangerous privileges (CHANGEOWNER, DELEGATECALL, etc.) are present.
 */
export function validateAgentLsp6Permissions(bitmask, opts = {}) {
  const mask = parsePermissionBitmask(bitmask);
  const activePermissions = decodePermissionNames(mask);
  const violations = [];

  const allowChangeOwner = Boolean(opts.allowChangeOwner);
  const allowChangePermissions = Boolean(opts.allowChangePermissions);
  const allowDelegateCall = Boolean(opts.allowDelegateCall);

  if (!allowChangeOwner && (mask & LSP6_PERMISSIONS.CHANGEOWNER) === LSP6_PERMISSIONS.CHANGEOWNER) {
    violations.push("CHANGEOWNER is forbidden for autonomous agent keys");
  }
  if (!allowChangePermissions && (mask & LSP6_PERMISSIONS.CHANGEPERMISSIONS) === LSP6_PERMISSIONS.CHANGEPERMISSIONS) {
    violations.push("CHANGEPERMISSIONS is forbidden for autonomous agent keys");
  }
  if (!allowDelegateCall && (mask & LSP6_PERMISSIONS.DELEGATECALL) === LSP6_PERMISSIONS.DELEGATECALL) {
    violations.push("DELEGATECALL is strictly forbidden for autonomous agent keys");
  }
  if (!allowDelegateCall && (mask & LSP6_PERMISSIONS.SUPER_DELEGATECALL) === LSP6_PERMISSIONS.SUPER_DELEGATECALL) {
    violations.push("SUPER_DELEGATECALL is strictly forbidden for autonomous agent keys");
  }

  return {
    ok: violations.length === 0,
    bitmask: `0x${mask.toString(16).padStart(64, "0")}`,
    active_permissions: activePermissions,
    violations,
  };
}

/**
 * Computes a deterministic 32-byte ERC725Y data key from a readable name.
 */
export function encodeLsp2DataKey(name) {
  const clean = String(name || "").trim();
  const hash = crypto.createHash("sha256").update(clean).digest("hex");
  return `0x${hash}`;
}

/**
 * Emits a structured execution receipt for an LSP interaction.
 */
export function createLspExecutionReceipt({
  account,
  controller,
  operationType = OPERATION_TYPES.CALL,
  target,
  value = "0",
  success = true,
  error = null,
  permissions = 0n,
  now = () => new Date(),
} = {}) {
  const validation = validateAgentLsp6Permissions(permissions);
  return {
    schema_version: LSP_EXECUTION_RECEIPT_SCHEMA,
    timestamp: now().toISOString(),
    account: String(account || "").toLowerCase(),
    controller: String(controller || "").toLowerCase(),
    operation_type: operationType,
    target: String(target || "").toLowerCase(),
    value: String(value),
    status: success && validation.ok ? "PASSED" : "FAILED",
    permissions_valid: validation.ok,
    active_permissions: validation.active_permissions,
    violations: validation.violations,
    error: error || (validation.ok ? null : validation.violations.join("; ")),
  };
}
