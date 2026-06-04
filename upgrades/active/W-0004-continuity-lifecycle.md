---
id: W-0004
title: Paid/Client Continuity Lifecycle
status: runtime-enforced
created_at: 2026-05-13
updated_at: 2026-06-03
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
- Deletion/expiry mechanics are not implemented yet and remain required before richer client continuity is offered.

## Rules

- Default: all `paid_public` sessions are ephemeral.
- Explicit opt-in: continuity exists only when `continuity_mode=client` is explicitly requested and acknowledged.
- Retained artifacts:
  - scoped conversation history only, likely `runtime/conversations/<client_id>-<service_id>.jsonl` or the current `execute_client_*` equivalent
  - no automatic durable memory writes
  - no private repo, private memory, or doctrine retrieval unless explicitly enabled per session by the operator
- Expiry: default 7 days of inactivity, configurable per client when a real client lifecycle exists.
- Deletion: operator must have a clear delete or forget path before richer client continuity is offered.
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

1. Add delete/expiry mechanics for scoped paid/client conversation history.
2. Add operator-facing cleanup command once real client continuity is used.
3. Revisit client self-deletion only after authentication and client identity become real.
