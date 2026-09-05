# Sidecar Sandbox and Egress Boundary

This is the W-0116 boundary for using quarantined Python Council sidecar evidence with Dizzy's Node-owned bridge contract.

The rule is intentionally narrow: sidecar receipts may help rehearsal and planning, but they do not authorize live runtime promotion, public claims, external submissions, or untrusted bounty execution unless a later Node council promotion receipt accepts a specific mechanism.

## Receipt Authority

Under D-0043, a receipt proves only the authority level named by that receipt.

- `advisory_receipt`: useful evidence only.
- `rehearsal_receipt`: deterministic dry-run evidence only.
- `promotion_receipt`: accepted by the Node council gate for a narrow promoted mechanism.
- `public_claim_receipt`: safe to cite as a public claim.

Python sidecar and scratch receipts default to `advisory_receipt` or `rehearsal_receipt`.

## Mock Sandbox Boundary

A sidecar receipt is rehearsal-bound when it reports any of these values:

```json
{
  "execution_mode": "SIMULATED",
  "container_engine": "docker_mock",
  "isolation_mode": "LOCAL_SUBPROCESS_MOCK",
  "network_isolated": false
}
```

That evidence may show that a fixture path, router path, or receipt parser behaves deterministically. It does not prove that untrusted code ran in an isolated container. Node bridge validation rejects any mock or simulated sidecar response that tries to carry promotion or public-claim authority.

## Live Execution Claim

A sidecar response that claims `execution_mode: "LIVE"` must include a verified live container proof before Node will accept the execution claim, even at rehearsal authority.

The required proof shape is:

```json
{
  "schema_version": "dizzy.sidecar.live_container_proof.v1",
  "proof_verified": true,
  "isolation_mode": "DOCKER_CONTAINER_ENFORCED",
  "execution_mode": "LIVE",
  "container_engine": "docker",
  "network_isolated": true,
  "egress_chokepoint_verified": true,
  "container_image_digest": "sha256:<64 lowercase hex characters>"
}
```

This proof still does not promote the Python runtime by itself. Runtime promotion requires a separate Node council `promotion_receipt`.

## External Intake Boundary

Get Me A JOB, PBM, and other external opportunity funnels may be mapped into offline bridge fixtures or rehearsal requests. They must not pipe untrusted live bounty text into unsandboxed model execution paths.

Allowed before W-0091 closes:

- deterministic fixture generation;
- scanner-to-bridge request adaptation;
- offline rehearsal receipts;
- receipt validation and rejection tests;
- public-safe documentation of what is not yet proven.

Blocked before W-0091 closes:

- live untrusted code execution without enforced container isolation;
- model egress outside the attested gateway/chokepoint;
- sidecar receipts claiming promotion or public authority;
- public product claims based only on sidecar rehearsal evidence.

## Current Gates

The Node-owned validation gate is:

```powershell
npm run test:node-python-bridge-contract
```

The bridge contract is documented in [`node_python_council_bridge_contract.md`](node_python_council_bridge_contract.md). This W-0116 boundary extends that contract with sandbox and egress evidence rules; it does not claim hosted production readiness or public cross-runtime A2A interoperability.
