Work in:

C:\Users\Josh\clawd

You are OpenClaude acting as an independent, read-only reviewer.

Review type:
Authority-theater, public-language, and handoff-pressure audit.

Packet class:
`local-planning`

This packet contains local review docs, handoff docs, prompts, and public wording drafts. Treat them as planning artifacts, not product truth. Do not request dirty implementation code, private memory, credentials, provider configuration, runtime state, or broader repository context unless you can name a specific blocker and a redacted alternative.

Hard boundaries:

- Do not edit files.
- Do not stage, commit, branch, push, open issues, publish, or send external messages.
- Do not run tests, builds, maintain scripts, scanners, model calls, network calls, or runtime-writing commands.
- Do not reset, clean, stash, delete, move, rename, or reformat files.
- Do not override `HOME`, `USERPROFILE`, provider config, repo roots, credential paths, or environment variables.
- If a named file or target is missing, report `target not found`; do not inspect similarly named fallback targets.
- Do not propose implementation patches. Convert useful concerns into wording changes, stop conditions, acceptance criteria, or review checklist edits only.

Snapshot gate:

- Expected branch: `main`
- Expected HEAD: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- Expected origin/main: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- Expected working tree: intentionally dirty Antigravity/review backlog

Before reviewing, run only:

- `git branch --show-current`
- `git rev-parse HEAD`
- `git rev-parse origin/main`
- `git status --short`

If branch, HEAD, or origin/main differs, report `SNAPSHOT_MISMATCH` and stop.

Primary files:

- `reviews/antigravity_return_packet.md`
- `reviews/first_commit_acceptance_checklist.md`
- `reviews/public_progress_language_options.md`
- `reviews/optional_language_surface_pack.md`
- `reviews/codex_antigravity_handoff_addendum.md`
- `reviews/antigravity_active_policy_acceptance_packet.md`
- `reviews/model_review_cycle_runbook.md`
- `reviews/primary_review_document_hashes.md`

Optional context only if needed:

- `reviews/model_claim_ledger_active_policy.md`
- `reviews/test_side_effect_inventory.md`
- `reviews/dashboard_route_mutation_matrix.md`
- `reviews/luna_active_policy_light_review.md`
- `reviews/terra_pbm_to_clawd_crossover_review.md`

Review goal:

Find places where the return packet, checklist, public wording, or language surface pack could accidentally:

- imply implementation authority moved from Antigravity to Codex;
- imply Simul has approved a push, publication, PR, or external message;
- imply active policy, dashboard containment, consensus, cryptography, rollback, sandbox, or production readiness beyond evidence;
- turn external model agreement into authority;
- make destructive cleanup sound like normal maintenance;
- make a held command sound safe because it cleans up afterward;
- pressure Antigravity to broaden beyond the active-policy slice;
- disclose private reviewer context, provider details, dirty local paths, or sensitive runtime/private material in public copy;
- preserve too much process after it stops preventing a real failure.

Also identify one under-asked assumption that could falsify this handoff approach, the smallest local check that would test it, and whether it blocks Antigravity's return.

Output Markdown with:

1. Snapshot verification.
2. Packet-class assessment:
   - whether `local-planning` is appropriate,
   - whether any listed file looks like it should be `restricted`,
   - whether any file should be omitted from an external reviewer packet next time.
3. Findings, up to 8, ordered by severity:
   - Severity: `P0`, `P1`, `P2`, or `P3`
   - Classification: authority-theater risk, public-overclaim risk, disclosure risk, implementation-pressure risk, stale-snapshot risk, process-bloat risk, or wording nit
   - File reference
   - Why it matters
   - Exact replacement wording or smallest docs-only correction
   - Confidence
4. Under-asked assumption:
   - assumption,
   - smallest local check,
   - blocks Antigravity return: yes/no,
   - disposition.
5. What looks solid.
6. What to remove, if anything, before Antigravity returns.
7. One-line Antigravity handoff advice.

Keep the review bounded. Do not recommend more model reviews unless you can name a specific unresolved contradiction that this packet cannot answer.

If no material issue is found, say that directly and list residual risks.
