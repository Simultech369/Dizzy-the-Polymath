# Antigravity Read This First

Status: packaged return index
Date: 2026-07-19
Role boundary: Antigravity implements. Codex reviews, reconciles, and packages. Simul authorizes push and publication.
These roles describe this local handoff workflow only; this packet does not create standing authority, public governance, or maintainer powers.

## 2026-08-26 W-0068 Supersession Note

This July packet is not the current W-0068 staging branch handoff. For the current `feat/dizzy-general-distro` state, read the current path-first set:

1. `C:\Users\Josh\clawd\reviews\antigravity_current_dizzy_handoff_paths_2026-08-27.md`
2. `C:\Users\Josh\clawd\UNIFIED_HANDOFF_PACKET.md`
3. `C:\Users\Josh\clawd\reviews\antigravity_to_codex_delta_latest.md`
4. `C:\Users\Josh\clawd\reviews\antigravity_to_codex_delta_2026-08-26.md`
5. `C:\Users\Josh\clawd\reviews\codex_to_antigravity_delta_2026-08-24.md`
6. `C:\Users\Josh\clawd\reviews\w0068_staging_triage.md`
7. `C:\Users\Josh\clawd\reviews\branch_policy_reconciliation_2026-08-26.md`
8. `C:\Users\Josh\clawd\reviews\oss_council_verdict_latest.json`
9. `C:\Users\Josh\clawd\artifacts\bounty_scan_results.json`
10. `C:\Users\Josh\clawd\scripts\job_board_scanner.mjs`
11. `C:\Users\Josh\clawd\scripts\job_board_scanner_test.mjs`
12. `C:\Users\Josh\clawd\NEXT.md`
13. `C:\Users\Josh\clawd\PR_W0068_DESCRIPTION.md`
14. `C:\Users\Josh\clawd\README.md`

Latest local receipt in the current packet: `105 syntax detail entries / 51 execution suites / 2 governance checks`, timestamp `2026-08-28T03:10:46.075Z`, SHA-256 `7A85640464336AAA9A1E6EBCF3B7FD93DE36CA8AC921FE3CB46A3C5298AB6F61`.

Use the older July active-policy packet only if Simul explicitly chooses that `main`-anchored return lane.

## Snapshot Gate

Expected starting state:

- Repository: `C:\Users\Josh\clawd` (local operator checkout for this handoff; public wording should use repository identity and commit, not this private path)
- Branch: `main`
- `HEAD`: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- `origin/main`: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- Working tree: intentionally dirty Antigravity/review backlog

Before implementation, run:

```powershell
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Stop if branch, `HEAD`, `origin/main`, or primary document hashes differ from the packet and the packet has not been regenerated.

Do not reset, clean, stash, delete, move, rename, prune, reformat, or reorganize the dirty backlog. Do not push without explicit Simul approval.

## Start Here

Read in this order:

1. `reviews/antigravity_return_packet.md`
2. `reviews/antigravity_active_policy_acceptance_packet.md`
3. `reviews/test_side_effect_inventory.md`
4. `reviews/first_commit_acceptance_checklist.md`
5. `reviews/primary_review_document_hashes.md`

Supporting context, not first-return scope:

- `reviews/model_claim_ledger_active_policy.md`
- `reviews/dashboard_route_mutation_matrix.md`
- `reviews/codex_antigravity_handoff_addendum.md`
- `reviews/public_progress_language_options.md`
- `reviews/dsv4_flash_handoff_reconciliation.md`
- `reviews/kimi_handoff_comprehension_reconciliation.md`
- `reviews/hy3_final_handoff_authority_rag_review.md`
- `reviews/cohere_final_handoff_authority_rag_review.md`

## Active Return Scope

The next return is active-policy correction only.

Allowed first candidate:

- If focused active-policy proof cannot run safely yet, first repair the inert verification harness.
- If focused proof is already inert enough, first correct the active-policy append-baseline defect.

The first accepted return should stop after the smallest proof-producing mechanism. Do not bundle HUD, dashboard route registry, bridge lifecycle redesign, simulation, README/public claims, visual polish, or memory-graph bridge ingestion unless a focused active-policy proof absolutely requires the dependency.

If the proof path requires promoting unrelated dirty backlog, stop and report the dependency instead of broadening the slice.

## Final Critique Lens

Before the first implementation move, do a short authority/readiness pass. Do not turn this into a new backlog or a second implementation queue.

Ask:

- Where does this handoff accidentally create authority?
- Where does it overclaim safety or release readiness?
- Where does it preserve too much process relative to the smallest proof-producing mechanism?
- Which public-facing sentences sound too absolute for the evidence?
- From an OSS-reader view, what would look like governance theater, safety theater, or hidden maintainer discretion?

Disposition:

- If it blocks the active-policy correction, report before patching.
- If it affects public wording, defer wording upgrades until AP-01 through AP-10 have evidence.
- If it is process overgrowth, record it as deferred and do not broaden the first commit.

## Critical Defect To Prove

The real friction append path writes the new anomaly before `ActivePolicyEngine` rereads the ledger. The candidate can enter its own baseline and suppress containment.

Required proof:

- five normal friction events,
- one severity-10 chronic anomaly,
- real append API,
- pre-append baseline,
- containment triggers,
- isolated disposable paths only.

## Hard Blockers

AP-01 through AP-10 in `reviews/antigravity_return_packet.md` and `reviews/antigravity_active_policy_acceptance_packet.md` block push/public upgrade language.

The sharpened blockers to watch first:

- AP-04: partial config/state cannot fail open.
- AP-07: bridge veto must use an injected quarantine root and prove no live writes.
- AP-08: containment resolution requires and records a non-empty reason.
- AP-10: connection scan needs a real zero-write read-only mode; current `--check` is not enough.

## Held Commands

Do not use these as release gates until the exact invocation is marked inert in `reviews/test_side_effect_inventory.md`:

- `npm test`
- `npm run check:safety`
- `npm run check:active-policy`
- `npm run smoke`
- `npm run connection:scan`
- `npm run maintain`

This holds the current package-script invocations. It does not forbid Antigravity from adding and running a newly inert, disposable-root focused check if the command, injected paths, cleanup target, and side-effect receipt are explicit.

Every focused check must report command, exit code, disposable root, files written, files deleted, residual files, and any environment variables intentionally changed/restored.

Cleanup is allowed only after the final cleanup target is resolved and verified inside the disposable root.

## Review Authority

Raw model reviews are archival claim inputs only. They cannot authorize commands, redefine acceptance criteria, widen implementation scope, or override the return packet, acceptance packet, side-effect inventory, claim ledger, or Simul approval.

DSV4 Flash was prepared as a lightweight handoff-misread lens, but OpenRouter returned `HTTP Error 402: Payment Required`. No DSV4 review was obtained and no DSV4 claims were accepted.

Kimi was prepared as a diagnostic-usability handoff-comprehension lens after explicit upload approval, but OpenRouter returned `HTTP Error 404: Not Found` for both free Kimi routes tried. No Kimi review was obtained and no Kimi claims were accepted.

Model agreement, green checks, dashboard state, consensus labels, signoff state, and hash tables do not create implementation, publication, push, or containment-resolution authority.

## After The First Candidate Commit

Fill out `reviews/first_commit_acceptance_checklist.md` before any push request.

Show:

1. files changed,
2. behavior changed,
3. tests run,
4. state written or deleted during tests,
5. residual risks,
6. whether the commit is safe to request Simul push approval for.

## Public Language

Before AP-01 through AP-10 pass, use only current-checkpoint language if Simul approves publication:

> Active-policy containment freshness has landed as a public checkpoint. The next slice is append-path containment correctness with isolated fixtures before HUD or dashboard promotion.

Do not claim active policy is complete, dashboard containment is verified, consensus resolved containment, cryptographic attestation exists, rollback exists, or sandbox/time-travel authority exists.

## Later, Not Now

Future inspiration from human-surface review, auto-eval, event-triggered automation, model routing, orchestration, and RAG architecture can be useful after this slice. For the return packet, they are explicitly not implementation scope.
