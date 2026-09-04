# External Collaboration & Execution Node Boundary

Status: Core Collaboration Doctrine & Architecture Specification  
Target Audience: Sovereign developers, peer agent creators, external execution engines (e.g., `free-code`, `zero`, `openclaude`), and human collaborators.

---

## 1. The Core Stance: Control Plane vs. Execution Node

Dizzy is architected as an **auditable, local-first control plane**, not a monolithic agent, companion, or IDE wrapper. 

When external systems or peer projects collaborate with Dizzy, the interface must adhere to strict authority boundaries:

```
┌────────────────────────────────────────────────────────┐
│               DIZZY CONTROL PLANE                      │
│ • Trust-Zone Enforcement (private_self / outside)      │
│ • Cognitive Council Arbitration (62-Model Roster)     │
│ • Invariant Verification & Cryptographic Receipts      │
│ • Friction Ledger & Trajectory Memory Distillery      │
└──────────────────────────┬─────────────────────────────┘
                           │
             Signed Receipts & Sealed Envelopes
            (No shared cookies, No shared memory)
                           │
┌──────────────────────────▼─────────────────────────────┐
│             EXTERNAL EXECUTION NODES                   │
│ • free-code (Zero-telemetry terminal pairing)          │
│ • Gitlawb / Zero (Decentralized commit signing)        │
│ • Gitlawb / OpenClaude (MCP coordination seat)         │
│ • Sandboxed Runners (Docker / Wasm / ephemeral tests)  │
└────────────────────────────────────────────────────────┘
```

### The Separation Invariant:
1. **Dizzy does not execute untrusted commands directly on the host.** It plans, sanitizes, issues runbooks, and verifies receipts.
2. **External nodes do not govern policy.** They execute tasks, run test suites, or provide interactive terminal UI, returning deterministic receipts to Dizzy.
3. **The Bridge is Cryptographic Receipts:** Communication between Dizzy and execution nodes occurs exclusively via typed, schema-validated JSON envelopes (`dizzy.router_receipt.v1`, `dizzy.bounty_task.v1`, HMAC-signed A2A payloads). 
4. **No Ambient Trust:** There is no shared cookie/session state, no cross-process memory bleed, and no hidden filesystem trust.

---

## 2. Clean-Room Collaboration Doctrine

When collaborating with peer open-source projects (such as `freecodexyz/free-code` or `Gitlawb/zero`):

### Clean-Room Rules:
* **Zero Code Borrowing:** Do not copy-paste code from external repositories into Dizzy, even from permissive licenses. Dizzy’s runtime is a clean-room implementation governed by its own verifiable invariants.
* **No License Contamination:** All external patterns must be translated into native Dizzy contracts (as documented in `BORROWED_PATTERNS.md`) and verified against `scripts/external_pattern_license_audit_check.mjs`.
* **Propose Interfaces, Not Hacks:** If an external tool requires deeper integration, propose a schema extension or an A2A message bridge rather than modifying internal middleware.

---

## 3. Trust-Zone Boundaries for Collaborators

Collaborators operate across explicit trust zones:

| Trust Zone | Intended Actor | Access Allowed | Access Prohibited |
| :--- | :--- | :--- | :--- |
| `private_self` | Local Operator | Full local access, internal memory wiki, private friction entries | Cloud telemetry, unredacted public export |
| `trusted_collaborator` | Peer Agents & Reviewers | Review packets, public diffs, test receipts, architectural audits | Operator private notes, proprietary domain data (e.g. PBM schemas) |
| `outside_contact` | Unverified External Nodes | Sealed bounty tasks, public issue ingestion, public A2A ping | Local loopback dashboard, internal memory, write authority |
| `paid_public` | External Client Run | Scoped session context, visible capability receipts | Durable memory storage, private repository retrieval |

---

## 4. The "No Perfect Continuity" Principle

A foundational lesson learned from the joint **Codex + Antigravity** operational loops:

> **System reliability increases when collaborating agents assume neither side possesses perfect continuity.**

### Operational Rules:
1. **Catch Leftovers & Overclaims:** Every handoff between agents must be treated with mutual, respectful skepticism. Check git status, verify test matrices, and assert that dirty worktrees or missing docs are surfaced immediately.
2. **Handoff by Receipt, Not Narrative:** Do not rely on conversational memory across session boundaries. Always link to commit SHAs, test receipts (`reviews/oss_council_verdict_latest.json`), and verified diffs.
3. **Friction is Data:** When an agent misinterprets a boundary or fails a verification gate, log it directly into `reviews/` or the friction ledger. Do not smooth over errors with polite prose.

---

## 5. How to Engage (Collaborator Checklist)

If you are building an integration with Dizzy:

1. **Verify Your Environment:** Run `npm run check:council` to confirm the local 56-suite matrix passes on your machine.
2. **Review Borrowed Patterns:** Read `BORROWED_PATTERNS.md` and `CHOKEPOINTS.md` to ensure your proposed mechanism does not introduce dependency lock-in or extraction vectors.
3. **Deliver Deterministic Evidence:** Every PR or collaboration packet must include verifiable receipts, updated test fixtures under `scripts/`, and an updated entry in `NEXT.md`.
