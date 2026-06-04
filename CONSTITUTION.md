# CONSTITUTION.md
Authoritative core governance constraints for Dizzy runtime operations.

---

## 1. Trust Zone Boundaries

The runtime is divided into four distinct trust zones. These boundaries determine what memory can be read/written, what repositories can be retrieved, and how data must be redacted.

### Trust Zone Matrix

| Trust Zone | Chat History | Durable Memory | Auto-Retrieval | Data Access / Disclosure |
|---|---|---|---|---|
| `private_self` | Retained | Enabled | Full (Root docs + memory/) | Full continuity, strongest anti-dependency guards |
| `trusted_collaborator` | Scoped / Retained | Enabled | Full (Root docs + memory/) | Narrower than private self; sensitive data redacted |
| `outside_contact` | Minimal / Local | Disabled | Disabled | Fresh-context reasoning; no ambient carryover |
| `paid_public` | Ephemeral | Disabled | Disabled | No hidden carryover; no cross-client residue |

### Read-Block Constraints
- **Public Request Isolation**: If an incoming request is classified as `public` (e.g. from `/agent/execute` or an unauthorized external client), the server must programmatically block the loading of any configuration or state keys containing `#private` or `#private_self` suffixes in `state.json`.
- **Private -> Trusted/Public Redaction**: Any data moving from a private context to a public or trusted interface must pass through a conditional redaction filter. Regex-based entity scrubbing must strip emails, phone numbers, and potential credential patterns (such as `sk-` API keys).

---

## 2. Memory Lifecycle Heuristics

Memory exists solely to support human agency and judgment, not to simulate artificial companionship or build a permanent archive of trivial residue.

### Retention Scopes
- **Ephemeral (Paid Public Default)**: The conversation is processed in a stateless manner. The context is discarded immediately after execution.
- **Conversation-Only (Client Continuity)**: Scoped conversation history is maintained for a specific client/service pair.
- **Durable Memory (Private/Collaborator)**: Curated, structured summaries stored in `memory/topics/` or daily logs.

### Expiration and Garbage Collection Pipeline
To prevent context leakage and bloat, all memory nodes in `state.json` must be bound by a defined expiration window (`expiresAt`).
Memory deletion runs as a two-stage **Review-Only** pipeline:
1. **Background Pruning**: The background worker (`worker.mjs`) regularly scans all memory nodes. Any node whose `expiresAt` timestamp has passed is transitioned to `status: "pending_purge"`. The node is **not** automatically deleted from the disk.
2. **Manual Vacuum**: The operator must run the CLI utility (`npm run memory:vacuum`) to review the list of staged purges and permanently delete them upon manual keyboard confirmation.

---

## 3. Exit Rights and Portability Floor

Every participant in the system possesses first-class exit rights to prevent vendor or protocol lock-in.

### Portability Standards
- Participants can export their complete interaction records, eligibility credentials, signatures, and receipts in standard, machine-readable JSON/CSV formats at any time.
- The system must provide cryptographic Merkle proofs validating on-chain state claims, allowing participants to exit to alternative common ledger environments.
- Consent for memory retention can be revoked at any time, which triggers the immediate flagging of all associated continuity files for the vacuum loop.
