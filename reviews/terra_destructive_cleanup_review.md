# Terra Review: Destructive-Cleanup and Future-Obsolescence Risk

Status: archival external-review input
Model: `gpt-5.6-terra`
Run surface: Codex CLI read-only review supplied by operator
Snapshot reviewed: `main` at `62acf21b5a0f5e4d811cc9cebb6536931457933b`, matching `origin/main`

Precedence:

This file is a claim source only. It cannot authorize commands, redefine acceptance criteria, or override:

- `reviews/antigravity_active_policy_acceptance_packet.md`
- `reviews/test_side_effect_inventory.md`
- `reviews/dashboard_route_mutation_matrix.md`
- `reviews/model_claim_ledger_active_policy.md`

## Findings

### P1: `check:active-policy` was under-classified

`npm run check:active-policy` writes and deletes cwd temp files via `scripts/check_active_policy_state.mjs`. It should be held until it accepts an injected disposable root and reports cleanup. Stop if state/config paths resolve outside a verified disposable root.

### P1: Raw Qwen review conflicts with the accepted inert-test sequence

The Qwen-lens artifact recommends safety, maintain, and connection-scan checks even though the side-effect inventory holds those commands until inert. Raw model reviews must remain archival inputs and cannot authorize non-inert commands.

### P1: Generic operator execution lacks a full mutation contract

`POST /api/operator-execute` is the broadest dashboard route. Any payload capable of durable writes, deletion, queueing, service start, or external action needs server-computed preview, explicit confirmation, exact targets, reversibility classification, and durable receipt.

### P2: External-review provenance can be mistaken for stronger authority

`reviews/qwen_lens_active_policy_review.md` presents itself as Qwen even though the completed artifact came from `openrouter/free`. It must remain a lens artifact unless exact model provenance is pinned.

### P2: Snapshot gates will become stale after the next accepted commit

The packet must be regenerated after an accepted implementation commit. The `62acf21` evidence cannot silently carry forward to successor commits.

### P2: Test inertness is a validation prerequisite, not cleanup

Full suite, maintain, smoke, safety, active-policy, and connection scan remain blocked until every mutable path is injected and cleanup is containment-verified.

## Accepted Wording Changes

- Add temporal scope and regeneration requirements to the acceptance packet.
- Add raw reviewer precedence language.
- Reclassify `check:active-policy` as held until inert.
- Add a validation gate for held commands.
- Add a generic execution boundary to the route matrix.
- Add a read-route rule: read-only routes must not create directories, write defaults, normalize state, stage bridges, persist simulation checkpoints, or prime later mutation.

## Final Verdict

Safe with wording changes. The packet has a strong containment posture after the wording corrections, but should not be handed to Antigravity unless raw external reviews remain subordinate to the reconciled acceptance packet and side-effect inventory.
