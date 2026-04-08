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
