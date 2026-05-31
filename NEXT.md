# NEXT.md
Open decisions and work queue.

Rules:
- Keep items atomic.
- When resolved, move the decision + rationale to `DESIGN.md` (and update the `STATE_JSON` block if needed).
- Prefer links/IDs so you can trace resolution history.

---

## Open Decisions

(none)

---

## Work Queue

- W-0021: Add fuller retrieval audit logs for model-backed answers.

---

## Completed

- W-0001: Added `node scripts/sync_state.mjs --check` to verify `state.json` matches `DESIGN.md`.
- N-0001: Canonical job state machine defined in `DESIGN.md` (D-0005).
- N-0002: Optional auth token decision defined in `DESIGN.md` (D-0006).
- N-0003: Default is "no" (DLQ JSONL + Redis is enough for now); revisit only if needed.
- N-0004: Default is local-first + explicit consent for external sharing (Benkler anchor); refine if sharing UX emerges.
- N-0005: Default contestability is reason-codes + user can request a compliant version; refine if patterns repeat.
- N-0006: Governance disclosure via `/governance` endpoint + `GOVERNANCE.md` doc (D-0004).
- N-0007: Default connector is outbound-only Telegram notify drain script (`node scripts/telegram_notify_drain.mjs`).
- W-0002: Added Telegram notify drain script (`scripts/telegram_notify_drain.mjs`) to surface `/notify/:channel` messages in Telegram.
- N-0008: `/health` stays public only on loopback when auth is enabled; otherwise it requires auth.
- O-0001: Inbound Telegram relay (poll getUpdates -> forward to `/dispatch/incoming` -> send reply), implemented as `scripts/telegram_relay.mjs`.
- W-0003: Added `RUNBOOK.md` for the recommended multi-process run setup.
- N-0009: Runtime-governing doctrine must live in the default prompt pack; supplementary docs are explanatory unless compressed into the live core (D-0007).
- W-0004: Defined and implemented the first paid/client continuity lifecycle for `paid_public` with `continuity_mode=client`: conversation-only retention, explicit expiry policy, no durable memory by default, no private repo retrieval by default, visible `/agent/execute` lifecycle fields, and safety checks. Deletion/expiry mechanics remain future work before richer client continuity.
- W-0005: Added `scripts/maintain.mjs` as the single operator maintenance command.
- W-0006: Added prompt-pack / `DESIGN.md` drift validation with `scripts/prompt_drift_check.mjs`.
- W-0007: Added Product Kernel section to `DESIGN.md` and synced `state.json`.
- W-0008: Added first manual Trajectory Distillery path: sparse known-good trajectory capture, schema, tests, and private/trusted retrieval hook.
- W-0009: Added proposal-only `/trajectory distill` command. It can draft a known-good trajectory from recent history but still requires operator review and `/trajectory add` to save.
- W-0010: Added report-only `scripts/connection_scan.mjs` to surface surprising document/memory connections as hypotheses, not retrieval authority.
- W-0011: Added `MECHANISM_SIEVE.md` and compact prompt-core rules to convert anti-extractive values into ownership, funding, governance, enforcement, exit, simplification, and capability mechanisms.
- W-0012: Added first manual Friction Ledger path: sparse stuck-point capture, listing, summary weighting, maintain visibility, and tests.
- W-0013: Added `MECHANISMS.md` as a map of reusable design mechanisms without outreach or borrowing language.
- W-0014: Added `FILE_ROLES.md` to classify root-file authority without moving files prematurely.
- W-0015: Added `dizzy maintain` validation that flags root files missing from `FILE_ROLES.md`.
- W-0016: Marked root flavor/economic overlay files as optional, non-runtime-governing surfaces instead of moving them prematurely.
- W-0017: Added capability-building test to economic doctrine and compact runtime prompt core.
- W-0018: Added `CHOKEPOINTS.md` as an internal anti-extraction self-inspection map for dependency, capture, and exit risks.
- W-0019: Added first-pass capability receipts to dispatch and `/agent/execute`, with safety tests for paid/public blocked context.
- W-0020: Added local deletion and inactivity expiry pruning for scoped paid/client continuity history.
