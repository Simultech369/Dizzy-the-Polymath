---
id: W-0004-continuity-lifecycle
status: integrated
tier: 1
owner_surface: lib/client_continuity.mjs
last_reviewed: 2026-06-01
next_action: Full authenticated client account lifecycle remains future; local deletion and inactivity expiry are implemented.
---

# W-0004: Paid/Client Continuity Lifecycle

Status: Implemented first pass; retained as rationale/provenance.

## Goal

Define clear, safe semantics for `continuity_mode=client` in the `paid_public` trust zone.

Implementation status:
- `DESIGN.md` defines the lifecycle semantics.
- `/agent/execute` derives conversation keys from `client_id + service_id` rather than trusting caller-provided keys.
- `/agent/execute` returns continuity, retention, retrieval, durable-memory, expiry, and conversation-key fields.
- Safety checks verify that `paid_public` client continuity still blocks durable memory and repo/private retrieval by default.
- Local operator deletion and inactivity expiry pruning are implemented for scoped paid/client conversation history.

## Rules

- Default: all `paid_public` sessions are ephemeral.
- Explicit opt-in: continuity exists only when `continuity_mode=client` is explicitly requested and acknowledged.
- Retained artifacts:
  - scoped conversation history only, likely `runtime/conversations/<client_id>-<service_id>.jsonl` or the current `execute_client_*` equivalent
  - no automatic durable memory writes
  - no private repo, private memory, or doctrine retrieval unless explicitly enabled per session by the operator
- Expiry: default 7 days of inactivity, with local pruning for scoped paid/client history.
- Deletion: local operator deletion exists for scoped paid/client history.
- Client self-deletion across sessions is not assumed until authentication and client identity are real.

## Response Surface

`/agent/execute` returns:

- `continuity_mode`
- `retention_scope`: `ephemeral` | `conversation_only` | `extended`
- `expiry_policy`
- `repo_retrieval_allowed`: boolean
- `durable_memory_allowed`: boolean
- `conversation_key` or a redacted/safe reference when useful for operator debugging

## Trust-Zone Enforcement

- `paid_public` with continuity still cannot access `private_self` memory by default.
- Cross-zone leakage requires explicit operator approval.
- Explicit `conversation_key` reuse is continuity reuse and should be documented as such.

## Implemented In

- `DESIGN.md`
- `MARKETPLACE_PROTOCOL.md`
- `agent_server.mjs`
- `lib/dispatch.mjs`
- tests in `scripts/safety_checks.mjs`

## Remaining Work

1. Add authenticated client-facing deletion only if real client identity becomes part of the product.
2. Add richer operator cleanup UX if scoped client continuity sees real use.
3. Revisit retention windows after real paid/public workload creates evidence.
