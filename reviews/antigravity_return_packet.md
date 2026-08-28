# Antigravity Return Packet

Status: Codex-prepared return handoff
Snapshot: `main` at `62acf21b5a0f5e4d811cc9cebb6536931457933b`, matching `origin/main`
Role boundary: Antigravity implements. Codex remains planner/reviewer/reconciliation support.
Packaged entry point: `reviews/antigravity_read_this_first.md`
These roles describe this local handoff workflow only; this packet does not create standing authority, public governance, or maintainer powers.

## Purpose

Use this as the landing packet when Antigravity credits return. It compresses the current planning state into one active implementation slice and the stop conditions that matter most.

The current public checkpoint is real but incomplete: `62acf21b5a0f5e4d811cc9cebb6536931457933b` demonstrates active-policy containment state freshness across engine instances through the committed freshness check. It does not prove correct anomaly behavior through the real friction append path.

## Return Gate

Before implementation:

1. Run:
   - `git branch --show-current`
   - `git rev-parse HEAD`
   - `git rev-parse origin/main`
   - `git status --short`
2. Expected branch: `main`.
3. Expected `HEAD`: `62acf21b5a0f5e4d811cc9cebb6536931457933b`.
4. Expected `origin/main`: `62acf21b5a0f5e4d811cc9cebb6536931457933b`.
5. Expected working tree: intentionally dirty Antigravity/review backlog.
6. Do not reset, clean, stash, delete, move, rename, or reorganize the backlog.
7. Compare primary review docs against `reviews/primary_review_document_hashes.md`, or regenerate the packet and claim dispositions before use.
8. Do not push without explicit Simul approval.

Stop immediately if branch, `HEAD`, `origin/main`, or primary document hashes mismatch and the packet has not been regenerated.

## Accepted Slice

Implement only the active-policy correction slice.

Do not promote:

- HUD or dashboard visual integration,
- dashboard mutation routes,
- memory-graph accepted-bridge ingestion,
- simulation presentation,
- README/public claims,
- broad cleanup,
- route registry implementation,
- bridge lifecycle redesign beyond isolated active-policy veto proof.

## Critical Defect

The real friction append path writes the candidate anomaly before `ActivePolicyEngine` rereads the ledger. The candidate can therefore enter its own baseline and suppress containment.

Required proof:

- five normal friction events,
- one severity-10 chronic anomaly,
- real append API,
- pre-append baseline,
- containment triggers,
- isolated disposable paths only.

## Hard Blockers

The active-policy slice is not accepted until these are proven:

| ID | Blocker | Required evidence |
| --- | --- | --- |
| AP-01 | Real append anomaly triggers containment. | Five normal + one anomaly fixture through real append API. |
| AP-02 | Candidate is excluded from its own baseline. | Fixture or instrumentation proves pre-append baseline. |
| AP-03 | `min_history_entries` and `z_score_threshold` are honored. | Config-variant tests. |
| AP-04 | Partial config/state cannot fail open. | Missing nested fields preserve containment through deep defaults or explicit fail-closed rejection; evaluation errors fail focused checks. |
| AP-05 | Low-variance scale behavior is defined. | Deterministic test names or code constants. |
| AP-06 | Durable writes suspend under containment. | Isolated durable-write fixture. |
| AP-07 | Bridge veto is isolated. | Injectable quarantine root; pre/post proof that no file outside the disposable root changed. |
| AP-08 | Containment resolution requires a reason. | Missing/empty reason rejected; exact reason recorded in history or receipt. |
| AP-09 | Consensus signoff cannot resolve containment. | Route or integration test proves no implicit resolution. |
| AP-10 | Connection scan has real read-only mode. | Named exact invocation produces zero report, quarantine, and bridge writes; direct `connection:scan` remains blocked until then. |

AP-04, AP-07, AP-08, and AP-10 are the newest sharpened blockers from Luna's review. Treat them as hard requirements, not polish.

These are push/public-upgrade blockers for the active-policy slice, not permission to broaden the first candidate commit. A first candidate may repair the inert harness or append-baseline mechanism first, then stop for review.

## Verification Discipline

Run focused isolated checks first. Do not run these as release gates until their exact invocation is marked inert in `reviews/test_side_effect_inventory.md`:

- `npm test`
- `npm run check:safety`
- `npm run check:active-policy`
- `npm run smoke`
- `npm run connection:scan`
- `npm run maintain`

This holds the current package-script invocations. It does not forbid a newly inert, disposable-root focused check whose exact invocation and side-effect receipt are documented.

Every focused check should report:

- command,
- exit code,
- files written,
- files deleted,
- residual files,
- disposable root,
- any environment variables intentionally changed and whether they were restored.

Cleanup is allowed only after resolving and verifying the cleanup target is inside the disposable root.

## First Commit Shape

The first accepted commit should be one mechanism, not a bundle.

The first accepted return should stop after the smallest proof-producing mechanism. If inert verification must be repaired first, make that the first candidate. If it is already inert enough for focused checks, make the active-policy append-baseline correction the first candidate. Do not bundle durable-write, bridge-veto, or resolution changes unless the focused proof requires them.

## Public Language

Before AP-01 through AP-10 pass, only use current-checkpoint language:

> Active-policy containment freshness has landed as a public checkpoint; append-path containment correction remains under review.

After AP-01 through AP-10 pass and the hash gate is current:

> Corrected active-policy anomaly evaluation to prove containment against pre-append friction history using isolated fixtures.

Do not say:

- "Active policy is complete."
- "Dashboard containment is verified."
- "Consensus resolved containment."
- "Cryptographic review/signature/attestation."
- "Sandbox/time-travel rollback."

## Codex Role During Return

Codex should review Antigravity's first candidate commit for:

- scope containment,
- proof quality,
- side effects,
- doc truth,
- public wording,
- whether the commit is safe to push.

Codex should not patch implementation details unless Simul explicitly changes the role boundary.
