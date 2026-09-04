# Node/Python Council Bridge Contract

This is the W-0112 promotion contract for passing Dizzy Node evidence into a quarantined Python Council sidecar without promoting that sidecar into runtime authority.

## Authority Boundary

- The request schema is `dizzy.node_python_council_bridge.request.v1`.
- The response schema is `dizzy.node_python_council_bridge.response.v1`.
- Python sidecar responses may carry `rehearsal_receipt` authority only.
- A passing sidecar response is not a `promotion_receipt` and is not a `public_claim_receipt`.
- Runtime promotion still requires a Node council `promotion_receipt`.

## Canonical Payload Hash

The full bridge payload hash lives at:

```json
"integrity": {
  "canonicalization": "dizzy.stable_json.sort_keys.no_whitespace.v1",
  "payload_sha256": "<lowercase sha256 of request.payload>"
}
```

The hash is computed over canonical JSON with sorted object keys and no extra whitespace. The canonical payload is the exact `payload` object in the bridge request.

`payload.bounty_task.payload_sha256` remains the bounty-task digest. It must not be reused as the full bridge payload digest.

## Fixture Coverage

The tracked fixture set is [`scripts/fixtures/node_python_council_bridge_contract_fixtures.json`](../scripts/fixtures/node_python_council_bridge_contract_fixtures.json).

It covers:

- a valid Node-to-Python bridge request;
- a valid rehearsal-only sidecar response;
- a tampered payload that reuses the old bridge hash;
- a legacy hash-scope overload where only `bounty_task.payload_sha256` exists;
- a request that improperly asks for runtime promotion authority.

The deterministic validator is [`lib/node_python_council_bridge_contract.mjs`](../lib/node_python_council_bridge_contract.mjs), and its gate is:

```powershell
npm run test:node-python-bridge-contract
```

## Current Sidecar Compatibility Note

The quarantined Python bridge runner has been repaired to reject a tampered payload when its local canonical hash check fails. That repair remains sidecar evidence only.

For promotion, the sidecar must satisfy this Node-owned contract shape: full bridge integrity in `integrity.payload_sha256`, task-level integrity in `payload.bounty_task.payload_sha256`, and rehearsal-only response authority unless a later Node council promotion gate accepts a narrow mechanism.
