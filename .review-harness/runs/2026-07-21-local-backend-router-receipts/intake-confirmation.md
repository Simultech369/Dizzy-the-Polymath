# Intake Confirmation: Local Backend and Router Receipt Review Gate

status: intake confirmed, not yet accepted
created: 2026-07-22
target_run: 2026-07-21-local-backend-router-receipts
repo: <local-clawd-checkout>

## Purpose

This file reconciles the active Codex and Antigravity conversations into one review intake packet.

It confirms the questions, artifacts, and evidence surfaces that must be reviewed before the local backend and Router Receipt slice can be treated as commit-ready. It does not certify that the implementation is correct, that tests are sufficient, or that the staged slice should be committed.

## Intake Rule

Treat Antigravity status reports, Codex summaries, Grok product critique, and Sol findings as claim sources. The live repository, staged index, clean-checkout behavior, endpoint captures, and filesystem mutation checks are the evidence layer.

## Required Review Gates

### 1. Staged-Slice Privacy Boundary Verification

Question:

> Inspect `git diff --cached`. Does `DIZZY_CHAT_BACKEND=local` strictly decouple execution from hosted OpenAI-compatible settings, or is there any edge case where prompts or bearer tokens could still reach `OPENAI_COMPAT_BASE_URL` when `DIZZY_CHAT_BACKEND=local`?

Required evidence:

- resolved endpoint source for local mode
- credential source for local mode
- behavior when `OPENAI_COMPAT_BASE_URL` points to a hosted provider
- receipt boundary derivation source
- staged-only result, not mixed working-tree result

### 2. Loopback Host Validation Integrity

Question:

> Is the host validation logic in `lib/dispatch.mjs` foolproof in rejecting non-loopback addresses (`127.0.0.1`, `localhost`, `::1`) unless `DIZZY_ALLOW_LAN_LOCAL_BACKEND=1` is explicitly set?

Required evidence:

- accepted loopback cases
- rejected hosted HTTP/HTTPS cases
- rejected LAN cases when LAN override is absent
- explicit allowed LAN behavior when override is present
- IPv6, casing, whitespace, and malformed URL behavior

### 3. Scope-Isolated Receipt Persistence and Lifecycle

Question:

> Does writing client-continuity receipts (`retention_scope === "conversation_only"`) directly into `runtime/conversations/<key>.jsonl` prevent metadata leakage into `runtime/router_receipts.jsonl` while correctly respecting the 7-day prune and delete lifecycle in `lib/client_continuity.mjs`?

Required evidence:

- ephemeral requests leave no durable receipt
- conversation-only receipts are scoped to the conversation artifact
- global `runtime/router_receipts.jsonl` is not used for client continuity
- prune/delete/export behavior covers associated receipts
- failed writes do not report successful persistence

### 4. Offline Integration Test Safety

Question:

> Inspect `scripts/test_active_integration.mjs`. Does the in-memory loopback HTTP mock provider guarantee 100 percent offline test execution without touching production files or making external cloud calls?

Required evidence:

- temporary runtime root or equivalent production-file isolation
- mock provider captures destination, path, model, and authorization behavior
- no ambient hosted provider variables can escape into local-mode tests
- pre-existing receipt files survive the test
- success is based on mock provider response, not only HTTP 200 from `/agent/execute`

### 5. Review Harness Architecture

Question:

> Inspect `.review-harness/runs/2026-07-21-local-backend-router-receipts/`. Does this 7-role adversarial review structure, including the Devil's Advocate pass and conflict-accounting merge, satisfy the requirements for a clean-checkout, theorem-backed verification gate before first commit?

Required evidence:

- roles are biased independently before merge
- devil pass attacks shared assumptions
- merge preserves conflicts instead of averaging them away
- verdict distinguishes evidence-backed blockers from speculative concerns
- clean-checkout/staged-only validation is a hard gate
- human-readable claims are explicit enough to become tests

## Staged Code and Test Slice

Observed in the Git index at intake time:

- `<local-clawd-checkout>\agent_server.mjs`
- `<local-clawd-checkout>\lib\dispatch.mjs`
- `<local-clawd-checkout>\lib\model_router.mjs`
- `<local-clawd-checkout>\lib\runtime_config.mjs`
- `<local-clawd-checkout>\scripts\maintain.mjs`
- `<local-clawd-checkout>\scripts\safety_checks.mjs`
- `<local-clawd-checkout>\scripts\test_active_integration.mjs`

## Documentation and Tracking Files

Observed or included in the intake:

- `<local-clawd-checkout>\MODEL_INVENTORY.md`
- `<local-clawd-checkout>\NEXT.md`
- `<local-clawd-checkout>\reviews\reflection_round_router_receipt_mvp.md`
- `<antigravity-private-brain-artifact>`

Note: the Antigravity brain walkthrough path is outside the Git workspace. It existed at intake time, but it is not repository-controlled evidence unless copied or summarized into a tracked repo artifact.

## Review Harness Infrastructure

Observed under `.review-harness/` at intake time:

- `<local-clawd-checkout>\.review-harness\roles\privacy-boundary.md`
- `<local-clawd-checkout>\.review-harness\roles\staged-only.md`
- `<local-clawd-checkout>\.review-harness\roles\runtime-contract.md`
- `<local-clawd-checkout>\.review-harness\roles\retention-lifecycle.md`
- `<local-clawd-checkout>\.review-harness\roles\docs-skeptic.md`
- `<local-clawd-checkout>\.review-harness\roles\minimal-slice.md`
- `<local-clawd-checkout>\.review-harness\roles\devils-advocate.md`

## Review Harness Run Artifacts

Observed under `.review-harness\runs\2026-07-21-local-backend-router-receipts\` at intake time:

- `task.md`
- `staged-files.txt`
- `expert-privacy.md`
- `expert-staged-only.md`
- `expert-runtime.md`
- `expert-retention.md`
- `expert-docs-skeptic.md`
- `expert-minimal-slice.md`
- `devil.md`
- `merge.md`
- `verdict.md`

This file adds the missing intake anchor for the same run.

## Deferred or Out-of-Scope Working-Tree Surfaces

The following surfaces were not part of the confirmed staged code/test intake and should not be allowed to make staged-only verification appear green:

- `.gitignore`
- `EXPERIMENT_RECONCILIATION.md`
- `FILE_ROLES.md`
- `README.md`
- `REFERENCE_PATTERNS.md`
- `dashboard/index.html`
- `lib/client_continuity.mjs`
- `lib/consensus.mjs`
- `lib/memory_graph.mjs`
- `reviews/openrouter_free_review.md`
- untracked pending modules under `lib/`
- untracked memory notes under `memory/`
- untracked review packets under `reviews/`
- untracked upgrade note under `upgrades/active/`

## Acceptance Standard

The next verifier should produce a verdict with these fields:

- `privacy_boundary`: pass, fail, or unresolved
- `loopback_validation`: pass, fail, or unresolved
- `receipt_lifecycle`: pass, fail, or unresolved
- `offline_test_safety`: pass, fail, or unresolved
- `review_harness_gate`: pass, fail, or unresolved
- `commit_readiness`: ready, not ready, or ready with caveats

No commit-readiness verdict should be based on a dirty mixed worktree. The staged slice must survive clean-checkout or staged-only verification.
