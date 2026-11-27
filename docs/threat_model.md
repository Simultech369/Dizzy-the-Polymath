# Unified Control-Plane Threat Model

Status: Runtime-Enforced Security Architecture (Phase 1)  
Scope: Dizzy Local Control Plane (`Dizzy-the-Polymath`) + Offline Council Verifier (`CouncilEngine`)

This unified threat model covers all six attack surfaces of the Dizzy + CouncilEngine stack. (For protocol-specific public A2A federation horizon notes, see [`THREAT_MODEL_A2A.md`](../THREAT_MODEL_A2A.md).)

---

## 1. Six Attack Surfaces & Mitigations

### Surface 1: Prompts (Direct & Indirect Injection)
- **Attack Vectors**:
  - Direct system-override markers (`IGNORE PREVIOUS INSTRUCTIONS`, fake role headers, chat-template delimiters `<|im_start|>`).
  - Indirect prompt injection embedded in retrieved Markdown docs, web extracts, GitHub issues, or multi-turn conversation history.
  - Multi-turn crescendo / gradual escalation jailbreaks attempting to erode safety posture over several turns.
- **Runtime Defenses**:
  - `lib/janitor.mjs` + `lib/a2a_boundary_guard.mjs` (`sanitizePromptInjection`) strip role/delimiter overrides before prompt assembly.
  - `lib/context_assembler.mjs` + `lib/context_packer.mjs` segregate `MUST_INCLUDE` constitutional rules, `OPTIONAL_EVIDENCE` (tagged as untrusted data, never instructions), and `FORBIDDEN` items.
  - Multi-turn threads automatically reset ("start clean") on trust-zone downgrade, policy/prompt-pack hash drift, or detected injection escalation.
- **Proof Commands**: `npm test`, `npm run test:attack-suite`, `npm run test:context-packer`.

---

### Surface 2: Tools (Malformed Inputs, Path Traversal, SSRF, Shell Escape)
- **Attack Vectors**:
  - Path traversal (`../`, `..\\`, symlinks, NUL bytes, Windows drive roots) targeting `.ssh`, `.env`, or outside workspace files.
  - Command injection via metacharacters (`;`, `&&`, `|`, `$()`, backticks) or unauthorized tool invocation from `paid_public` / `outside_contact`.
  - SSRF against loopback (`127.0.0.1`), RFC 1918 private networks, or cloud metadata (`169.254.169.254`), or unbounded response bodies.
  - Poisoned or secret-bearing tool outputs returning raw credentials into model context.
- **Runtime Defenses**:
  - `lib/tool_guardrails_middleware.mjs` enforces per-zone capability allowlists/denylists (`paid_public` blocks `exec`, `read_contract`, and file writes), recursive argument inspection, timeout clamping, and output PII/secret masking with `dizzy.tool_guardrail_receipt.v1` receipts.
  - HTTP tools enforce manual redirect mode (`redirect: "manual"`), private-IP/metadata blocking, and byte caps.
  - Sensitive or state-mutating actions pause at `waiting_for_approval` in `lib/hitl_approval_gateway.mjs`.
- **Proof Commands**: `npm run test:tool-guardrails`, `npm test`.

---

### Surface 3: Memory (Poisoning, Unauthorized Persistence, Cross-Zone Bleed)
- **Attack Vectors**:
  - Storing prompt-injection payloads or fake policy rules inside durable memory so future sessions execute attacker instructions.
  - Cross-zone consolidation bleed (merging `private_self / do_not_export` notes into `paid_public / public_safe` wiki pages).
  - Retaining secrets/PII in Markdown memory or replaying tampered trajectory rows.
- **Runtime Defenses**:
  - `lib/cognitive_memory_engine.mjs` partitions capture, consolidation, and retrieval strictly by `canonical_key + trust_zone + sensitivity_tier` and rejects unknown zones fail-closed (`invalid_trust_zone`).
  - `lib/memory_hygiene_scanner.mjs` scans stored memory/wiki entries for prompt injection, secret material, and invalid retention metadata, quarantining or deleting tainted entries with signed keep/delete receipts.
  - `lib/trajectory_evaluator.mjs` re-verifies admission receipts and hashes on readback, dropping forged rows.
- **Proof Commands**: `npm run test:cognitive-memory`, `npm run test:memory-wiki`, `npm run test:memory-hygiene`.

---

### Surface 4: Agent-to-Agent (A2A) & Mailbox Messages
- **Attack Vectors**:
  - Forged sender identity (`sender_id: "operator"`), algorithm downgrade (`Ed25519 -> HMAC`), or replayed signed envelopes.
  - Cross-agent prompt injection or privilege-escalation payloads (`approve_promotion`, `override_zone`) inside mailbox bodies.
  - Stale leased tasks hanging indefinitely after worker crash.
- **Runtime Defenses**:
  - `lib/a2a_boundary_guard.mjs` + `lib/a2a_mailbox_bridge.mjs` verify canonical JSON signatures (Ed25519 with scoped signer/zone trust store or pinned HMAC-SHA256), timestamp freshness, and replay nonces.
  - Every mailbox enqueue/dequeue passes through `lib/inter_agent_sanitization_proxy.mjs` + recursive injection/PII sanitization, enforcing sender role message-type allowlists and trust-zone boundaries.
  - Leased dispatch (`queued -> leased -> acked | expired_requeued | dead_letter`) auto-recovers expired leases.
- **Proof Commands**: `npm run test:a2a-boundary`, `npm run test:a2a-mailbox`, `npm run test:inter-agent-proxy`.

---

### Surface 5: Structured External Events ("Triggers")
- **Attack Vectors**:
  - Unauthenticated or noisy webhook/file/CI events triggering expensive LLM calls (economic DoS).
  - Event spoofing or cross-thread hijacking attempting to inject follow-up events into another tenant/worker's active task.
- **Runtime Defenses**:
  - `lib/event_trigger_router.mjs` validates structured event schemas, source allowlists, and payload byte caps using cheap deterministic code filters **before** any optional model call.
  - Task/thread subscriptions (`task_id` / `thread_id -> worker_id + trust_zone`) verify trust-zone and source binding before routing follow-up events directly to the owning task without re-running full global triage.
- **Proof Commands**: `npm run test:event-triggers`.

---

### Surface 6: Hosted Model Calls & Private-Zone Data Exfiltration
- **Attack Vectors**:
  - Sending raw personal data (SSN, email, phone, payment card, API keys, wallet keys, local file paths) to hosted cloud LLM APIs.
  - Exfiltrating `private_self` or `do_not_export` data through cloud fallback routes, HTTP redirects, or downgraded conversation contexts.
- **Runtime Defenses**:
  - `private_self` routes enforce local-only model execution (`LOCAL_ISOLATION_BLOCKED` blocks cloud providers and external redirects).
  - For permitted hosted/advisory routes, `lib/pii_safe_inference_proxy.mjs` replaces sensitive personal data with deterministic surrogates (`{{SURROGATE_*}}`) prior to egress, restores placeholders locally on response, and writes a cryptographic receipt (`dizzy.pii_inference_proxy_receipt.v1`).
  - Outbound private-zone DLP inspection (`inspectPrivateZoneEgress`) detects and blocks `do_not_export` markers, private keys, and high-sensitivity artifacts from leaving private zones.
- **Proof Commands**: `npm run test:pii-proxy`, `npm run test:routing-policy`.

---

## 2. Unified Audit Trail & Fail-Closed Recovery

- All security-relevant decisions (ingress denials, tool guardrails, A2A sanitization, PII masking, memory keep/delete, spend stops, watchdog trips, and HITL transitions) append into the hash-linked audit ledger (`lib/unified_audit_ledger.mjs`, `prev_hash -> entry_hash`).
- Audit traces are exposed under **Inspect / Replay** (`/api/operator/audit-replay`) for operator forensics and never rendered as raw JSON inside user-facing chat.
