---
name: lsp-standards
description: Construct, validate, and interact with on-chain agent identities using ERC-725 and LUKSO Standard Proposals (LSP0 Universal Profile, LSP6 Key Manager, LSP2 ERC725Y JSON Schema).
version: 1.0.0
provides: on-chain-identity-standards
required_tools: none
permissions: private_self
external_services: none
validation_path: scripts/lsp_standards_test.mjs
rollback_path: none
receipt_fields: account,controller,permissions,schema_version
---

# LSP & ERC-725 Identity Standards for Agents

Use this skill when constructing, validating, or auditing on-chain interactions involving smart contract accounts (Universal Profiles) and permissioned key controllers.

## Core Invariants

1. **No Naked EOAs for High-Autonomy Execution:**
   - Autonomous agents must not execute transactions directly from a root Externally Owned Account (EOA) with unconstrained authority.
   - Agents must execute through an **LSP0 ERC725Account** (Universal Profile) controlled by an **LSP6 Key Manager**.

2. **Least Privilege via LSP6 Permissions:**
   - Operational agent controller keys must only have scoped permissions (e.g., `CALL`, `SETDATA`).
   - Agent keys must **NEVER** possess `CHANGEOWNER`, `CHANGEPERMISSIONS`, or `DELEGATECALL` unless explicitly authorized by offline operator governance.
   - Agent calls should be restricted via `AddressPermissions:AllowedAddresses` and `AddressPermissions:AllowedFunctions`.

3. **Verifiable Receipt Attestations via ERC725Y (LSP2):**
   - Governance receipts and Council verdict digests (`oss_council_verdict_latest.json`) attach to the profile using deterministic **LSP2 ERC725Y JSON Schema** data keys.
   - Data keys are 32-byte values constructed from keccak256 or standard schema prefixes.

## Standard Reference

### LSP0 — ERC725Account
- Implements `ERC725X` (`execute(uint256 operationType, address target, uint256 value, bytes data)`) and `ERC725Y` (`getData(bytes32)`, `setData(bytes32, bytes)`).
- `operationType`:
  - `0`: `CALL`
  - `1`: `CREATE`
  - `2`: `CREATE2`
  - `3`: `STATICCALL`
  - `4`: `DELEGATECALL` (strictly forbidden for untrusted agent controllers)

### LSP6 — Key Manager
- Acts as the owner of the LSP0 contract and dispatches calls based on the caller's permissions bitmask stored in the account's ERC725Y storage.
- Key Permission Bits:
  - `CHANGEOWNER`: `0x0000000000000000000000000000000000000000000000000000000000000001`
  - `CHANGEPERMISSIONS`: `0x0000000000000000000000000000000000000000000000000000000000000002`
  - `SETDATA`: `0x0000000000000000000000000000000000000000000000000000000000000004`
  - `CALL`: `0x0000000000000000000000000000000000000000000000000000000000000008`
  - `STATICCALL`: `0x0000000000000000000000000000000000000000000000000000000000000010`
  - `DELEGATECALL`: `0x0000000000000000000000000000000000000000000000000000000000000020`
  - `DEPLOY`: `0x0000000000000000000000000000000000000000000000000000000000000040`
  - `TRANSFERVALUE`: `0x0000000000000000000000000000000000000000000000000000000000000080`

### LSP2 — ERC725Y JSON Schema
- Maps readable keys (e.g., `LSP3Profile`, `DizzyCouncilVerdictLatest`) into 32-byte hex storage keys.
- Key types: `Singleton`, `Array`, `Mapping`, `MappingWithGrouping`.
