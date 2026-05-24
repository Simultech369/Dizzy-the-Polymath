# W-0004: Paid/Client Continuity Lifecycle

Status: Accepted - implement next.

## Goal

Define clear, safe semantics for `continuity_mode=client` in the `paid_public` trust zone.

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

`/agent/execute` should eventually return:

- `continuity_mode`
- `retention_scope`: `ephemeral` | `conversation_only` | `extended`
- `expires_at` or `expiry_policy`
- `repo_retrieval_allowed`: boolean
- `durable_memory_allowed`: boolean
- `conversation_key` or a redacted/safe reference when useful for operator debugging

## Trust-Zone Enforcement

- `paid_public` with continuity still cannot access `private_self` memory by default.
- Cross-zone leakage requires explicit operator approval.
- Explicit `conversation_key` reuse is continuity reuse and should be documented as such.

## Candidate Insertion Points

- `DESIGN.md`
- `MARKETPLACE_PROTOCOL.md`
- `agent_server.mjs`
- `lib/dispatch.mjs`
- tests in `scripts/safety_checks.mjs`

## Next Actions

1. Document lifecycle semantics in `DESIGN.md` and `MARKETPLACE_PROTOCOL.md`.
2. Add lifecycle fields to `/agent/execute` responses.
3. Add delete/expiry mechanics for scoped paid/client conversation history.
4. Add safety tests proving `paid_public` client continuity still blocks durable memory and repo/private retrieval by default.

