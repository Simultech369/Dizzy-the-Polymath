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

(none)

---

## Completed

- W-0036: Evaluated a bounded SQLite operational sidecar after queue recovery and multi-record conversation ordering exposed concrete JSONL limits; kept it non-authoritative pending independent review (D-0036).
- W-0045: Strengthened the logical untrusted-context boundary by introducing `lib/janitor.mjs` to strip/neutralize instruction triggers, escape HTML/XML tag markers, and wrap untrusted inputs in a strict XML envelope.
- W-0044: Added checked repository revision, scanner version, check timestamp, findings count, and stable finding IDs to drift scans, with safety tests checking simulated overrides.
- W-0043: Added a compact live task-preflight contract with tested skip, proceed, and clarify paths; success criteria stay internal by default and refinement falls back after one minute instead of becoming planning theater.
- W-0042: Added a shared durable-write policy for remembered memory, auto-memory candidates, friction entries, and trajectories; disallowed trust zones, non-persistent sensitivity classes, obvious credentials, and low-value captures fail before a file is written.
- W-0001: Added `node scripts/sync_state.mjs --check` to verify `state.json` matches `DESIGN.md`.
- N-0001: Canonical job state machine defined in `DESIGN.md` (D-0005).
- N-0002: Optional auth token decision defined in `DESIGN.md` (D-0006).
- N-0003: Default is "no" (DLQ JSONL + Redis is enough for now); revisit only if needed.
- N-0004: Default is local-first + explicit consent for external sharing (Benkler anchor); refine if sharing UX emerges.
- N-0005: Default contestability is reason-codes + user can request a compliant version; refine if patterns repeat.
- N-0006: Governance disclosure via the compatible `/governance` endpoint + `INTERACTION_NORMS.md` doc (D-0004).
- N-0007: Default connector is outbound-only Telegram notify drain script (`node scripts/telegram_notify_drain.mjs`).
- W-0002: Added Telegram notify drain script (`scripts/telegram_notify_drain.mjs`) to surface `/notify/:channel` messages in Telegram.
- N-0008: `/health` stays public only on loopback when auth is enabled; otherwise it requires auth.
- O-0001: Inbound Telegram relay (poll getUpdates -> forward to `/dispatch/incoming` -> send reply), implemented as `scripts/telegram_relay.mjs`.
- W-0003: Added `RUNBOOK.md` for the recommended multi-process run setup.
- N-0009: Runtime-governing doctrine must live in the default prompt pack; supplementary docs are explanatory unless compressed into the live core (D-0007).
- W-0004: Defined and implemented the first paid/client continuity lifecycle for `paid_public` with `continuity_mode=client`: conversation-only retention, explicit expiry policy, no durable memory by default, no private repo retrieval by default, visible `/agent/execute` lifecycle fields, safety checks, local operator deletion, and inactivity expiry pruning.
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
- W-0021: Added structured retrieval audit details to capability receipts for RAG, memory graph, and trajectory context.
- W-0022: Added `OPERATING_LOOP.md` as a day-to-day operator workflow for maintain, receipts, friction, trajectories, and session close.
- W-0029-note: Added `BORROWED_PATTERNS.md` and expanded `MECHANISMS.md` with external pattern translations from Memory OS, Samantha, and Icarus.
- W-0029: Added shared capture eligibility gate for auto-memory staging, trajectory distillation, and trajectory append; social closers and low-substance candidates are skipped or rejected.
- W-0030: Added provenance-required memory class helpers and enforced `reusable_pattern` provenance on trajectory rows.
- W-0031: Added source labels and fallback-path details to retrieval capability receipts.
- W-0023: Added status frontmatter for every `upgrades/active/` note and taught `maintain` to summarize active, integrated, parked, and archived upgrade notes while flagging missing metadata or stale active reviews.
- W-0024: Extended memory validation toward lifecycle metadata by adding topic frontmatter for memory class, source, scope, confidence, freshness, sensitivity, and revocation path; malformed present metadata now fails validation.
- W-0025: Added `capability_receipt.boundary_crossing` with purpose, allowed source context, redaction duty, retention scope, deletion/revocation path, default export posture, and blocked context.
- W-0026: Added constitutional claim manifest coverage to `scripts/prompt_drift_check.mjs` so constitution, prompt-pack, and declared runtime/test anchors are checked by claim ID.
- W-0027: Added default prompt-pack byte budgets to `scripts/prompt_drift_check.mjs` so constitutional compression has a mechanical growth check.
- W-0037: Added `CONSTITUTIONAL_KERNEL.md` as the first-loaded compact live kernel and included it in the default prompt pack.
- W-0038: Forced `paid_public` prompt construction to a client-safe allowlist regardless of `DIZZY_PROMPT_PACK`, with safety coverage against `full` pack leakage.
- W-0039: Borrowed selected `quarqlabs/agent-oss` memory patterns as Dizzy-native contracts: typed/temporal/numeric topic metadata and report-only retrieval plans in capability receipts.
- W-0028: Defined the Trajectory Distillery data contract with allowed/excluded content classes, evidence basis, lossy-risk labels, operator-review requirement, auto-save prohibition, safety tests, and metabolism reporting.
- W-0032: Added report-only memory metabolism scan to `maintain` for trajectory ledger provenance, duplicate patterns, malformed rows, and high-strength/low-confidence contradictions.
- W-0033: Added `MEMORY_OWNERSHIP.md` and maintain coverage check for known memory-like durable surfaces.
- W-0034: Added operator brief to `maintain` with latest commit, open work count, Tier 1 count, next queue item, and visible promotion debt.
- W-0034-note: Aligned prompt retrieval block headers with receipt source labels for trusted markdown, memory graph, and trajectory ledger.
- W-0035-note: Moved optional flavor/economic overlay files into `flavor/` and updated prompt-pack references.
- W-0035: Prototyped three-pool retrieval as report-only (`core`, `stale_important`, `edge_hypothesis`) in retrieval plans and capability receipts, with safety checks preventing auto-promotion or memory writes.
