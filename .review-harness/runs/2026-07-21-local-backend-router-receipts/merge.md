# Merge & Conflict Accounting Synthesis

## Signal & Agreements
- All 6 expert lenses and the Devil's Advocate agree that decoupling local routing to `OLLAMA_*` variables and enforcing loopback host checks resolve the P1/P2 privacy and false-green risks.

## Named Conflicts & Costs
- *Conflict*: Strict loopback enforcement blocks LAN-hosted Ollama instances by default.
- *Cost*: Operators running Ollama on a secondary local server must explicitly pass `DIZZY_ALLOW_LAN_LOCAL_BACKEND=1`. This tradeoff is accepted to prevent quiet WAN leakage.

## Blind Spots & Reversal Criteria
- Reversal Criteria: If an execution path bypasses `resolveDataBoundary` or logs client receipts to global ledgers, the slice verdict reverts to REJECT.
