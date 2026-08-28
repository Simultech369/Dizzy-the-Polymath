Work in both repos, read-only:

Primary target:
C:\Users\Josh\clawd

Reference source:
C:\Users\Josh\Desktop\PBMRebateTreasuryFinal

You are Codex 5.6 terra acting as a cross-project, read-only reviewer.

Question:
What can Dizzy / `clawd` safely borrow from the PBM/pharma project as clean-room process, verification, governance, public-truth, or review-discipline patterns?

This is the other side of the crossover review. The previous reciprocal pass asked what PBM could borrow from `clawd`. This pass asks what `clawd` can borrow from PBM.

Do not treat prior crossover notes as authority. Treat them as claim sources to verify.

Hard boundaries:

- Do not edit files in either repo.
- Do not stage, commit, branch, push, open issues, publish, or run external services.
- Do not run tests, builds, maintain scripts, scanners, OpenRouter calls, or commands that write runtime state.
- Do not reset, clean, stash, delete, move, rename, or reformat files.
- Do not override `HOME`, `USERPROFILE`, provider config, repo roots, credential paths, or environment variables.
- If a named file or target is missing, report `target not found`; do not inspect similarly named fallback targets unless you label that as a separate optional observation.
- Do not propose implementation patches. Convert useful ideas into planning-doc wording, acceptance criteria, or reviewer-workflow guardrails only.

Snapshot gates:

For `C:\Users\Josh\clawd`, expect:

- Branch: `main`
- HEAD: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- `origin/main`: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- Working tree: intentionally dirty Antigravity backlog

For `C:\Users\Josh\Desktop\PBMRebateTreasuryFinal`, expect:

- Branch: `main`
- HEAD: `266016c83d544f86dbb67a49240356852e0498b4`
- Working tree: intentionally dirty PBM solvency/review backlog

Before reviewing, run only these read-only snapshot commands in each repo:

- `git branch --show-current`
- `git rev-parse HEAD`
- `git status --short`

In `clawd` only, also run:

- `git rev-parse origin/main`

If either repo's branch or HEAD differs, report `SNAPSHOT_MISMATCH` and stop.

Primary PBM files to inspect:

- `REVIEW_ITERATION_PROCESS.md`
- `AGENT_REVIEW_ORCHESTRATION.md`
- `CODEX_SOLVENCY_PLANNING_ADDENDUM.md`
- `SOLVENCY_REVIEW_AUTHORITY_AND_SAFETY.md` if present
- `SCANNER_TRIAGE.md`
- `scripts/check-readiness.js`
- `scripts/check-production-release.js`
- `scripts/pre_commit_audit.py`

Primary `clawd` files to inspect:

- `reviews/pbm_clawd_crossover_patterns.md`
- `reviews/codex_antigravity_handoff_addendum.md`
- `reviews/model_review_cycle_runbook.md`
- `reviews/model_claim_ledger_active_policy.md`
- `reviews/test_side_effect_inventory.md`
- `reviews/dashboard_route_mutation_matrix.md`
- `reviews/antigravity_active_policy_acceptance_packet.md`
- `reviews/primary_review_document_hashes.md`

Review goal:

Identify PBM patterns that would make Dizzy / `clawd` more grounded, less destructive, less authority-theatrical, or more evidence-producing while preserving the current role boundary:

- Codex suggests, critiques, and reconciles.
- External models generate claims.
- Antigravity remains final implementer.
- Simul authorizes push, publication, and external action.

Look especially for:

- clean-room intake rules,
- external-review orchestration,
- snapshot and artifact gates,
- claim ledger / correction journal structure,
- high-sensitivity handling,
- public-readiness truth language,
- deterministic validation gates,
- side-effect and cleanup boundaries,
- self-obsolescence rules,
- "models propose, local evidence verifies, operator/governance authorizes" patterns.

Avoid borrowing:

- Solidity, treasury, nullifier, pharmacy, patient, payer, or on-chain governance assumptions;
- PBM marketing language, visual identity, file structure, prompt wording, or code;
- PBM-specific authority claims such as moving funds, granting roles, publishing roots, or ratifying governance;
- production-release strictness tied to money movement unless a `clawd` surface reaches comparable risk;
- broad process machinery that would expand `clawd` scope without preventing a specific repeated failure.

Output Markdown with:

1. Snapshot verification for both repos.
2. Up to 7 PBM patterns `clawd` should borrow.
   For each:
   - Pattern name
   - PBM evidence file reference
   - `clawd` problem it solves
   - Clean-room translation
   - What not to borrow
   - Smallest planning-doc insertion or acceptance criterion
   - Confidence
3. Patterns `clawd` should explicitly not borrow.
4. Any conflict between PBM discipline and current `clawd` planning docs.
5. Minimal `clawd` additions, docs-only, if any.
6. Exact wording block that Codex could paste into `reviews/pbm_clawd_crossover_patterns.md` or `reviews/codex_antigravity_handoff_addendum.md`.
7. One-line Antigravity handoff advice.

Keep the answer grounded. Prefer fewer, sharper borrowable patterns over a broad manifesto.

If no material PBM pattern should be borrowed, say so and list the residual risk that remains in `clawd`.
