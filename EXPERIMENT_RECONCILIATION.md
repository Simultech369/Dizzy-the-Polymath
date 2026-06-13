# Experimental Branch Reconciliation

Status: planning map, non-authoritative.

Purpose: preserve experimental work on `experiments` while promoting only small, reviewed, independently tested mechanisms into `main`.

This file records reconciliation intent. It does not change runtime behavior, constitutional doctrine, or `NEXT.md` priority by itself.

## Branch State

- Stable branch: `main`
- Experimental branch: `experiments`
- Experimental remote tip at review: `6bd5386`
- The experimental branch must not be merged wholesale.
- Experimental work remains non-authoritative until promoted through a focused commit with tests.
- Keep exactly two active branches: `main` and `experiments`. Preserve obsolete unique history as archive tags rather than active branches.

## Promotion Rule

For each candidate:

1. Identify the smallest useful mechanism.
2. Separate it from unrelated doctrine, naming, UI, and architecture changes.
3. Define risks and an acceptance test.
4. Reconcile it against current `main` and prepare the smallest focused commit that can be applied directly to `main`.
5. Run focused tests and `npm run maintain`.
6. Promote with one scoped commit or PR, or leave it experimental with recorded rationale.

No experimental commit receives authority merely because it is pushed, recent, or adjacent to working code.

## Reconciliation Ledger

| Candidate | Current disposition | Promotion condition |
| --- | --- | --- |
| Context packs and strange-attractor ledger | Keep experimental | Demonstrate repeated value in bounded review tasks before changing default loading |
| Skill intake ledger/review skill | Review for selective harvest | Confirm current `main` does not already contain patch-equivalent behavior; preserve supply-chain gates |
| BM25 retrieval | Integrated on `main` in `f4504b8` | Verified with `npm run verify:bm25`; preserve trust-zone blocks and output metadata contract |
| Confidence weighting | Rework experimentally | Define metadata defaults and behavior for missing or malformed confidence |
| Time-decay memory | Class-aware experiment implemented | Project decisions and user claims preserve authority; observations and reusable patterns decay relevance at class-specific rates; review age remains visible |
| Drift and memory dashboard | Keep experimental | Extract from `agent_server.mjs`; make read-only; prove private data cannot cross zones |
| Prompt overlay expiry | Keep experimental | Expiry must be visible and fail legibly; constitutional files must never disappear silently |
| Preventative-economics retrieval boost | Do not promote generically | Allow only in an explicit domain/task overlay, not general relevance ranking |
| HEARTBEAT.md retirement | Completed on `experiments`; promotion candidate | Retained behavior has declared owners; live references are checked by `scripts/doc_reference_check.mjs` |
| GOVERNANCE.md rename to INTERACTION_NORMS.md | Completed on `experiments`; promotion candidate | Namespace migration is complete while `/governance` retains API compatibility |
| W-0040 Privilege Split | Parked after fresh review on 2026-06-11 | Activate only when an untrusted-input path reaches privileged capabilities and the source note's evidence gate is met |
| W-0041 Telos/Substrate | Parked after fresh review on 2026-06-11 | Activate only after measurable trajectory/compression contracts and documented doctrine failures meet the source note's evidence gate |

## HEARTBEAT.md Retirement Map

The goal is to retire a large dedicated file, not to remove calibration behavior.

| Existing function | Proposed owner |
| --- | --- |
| Session initialization | `BOOTSTRAP.md` |
| Tone and epistemic calibration | `PROMPT_CORE.md` |
| Risk and intensity scaling | `PROMPT_CORE.md` and `PROTOCOL.md` |
| Cost and budget gate | `PROMPT_CORE.md` and `TOOLS.md` |
| Drift detection | `DRIFT_AUDIT.md` and `scripts/drift_scan.mjs` |
| Maintenance checks | `scripts/maintain.mjs` |
| Constraint signaling | `PROTOCOL.md` |
| Tool calibration | `TOOLS.md` |
| Heartbeat polling response | Retain only if a real polling interface still uses it |

Required migration surfaces:

- `AGENTS.md`
- `BOOTSTRAP.md`
- `PROMPT_PACKS.md`
- `lib/dispatch.mjs`
- `DESIGN.md`
- `state.json`
- `FILE_ROLES.md`
- prompt budgets and drift tests

Acceptance tests:

- `rg "HEARTBEAT.md" .` returns only historical, provenance, or explicit migration references.
- Risk increases precision rather than rhetoric.
- Expensive batches still trigger a cost gate.
- Public or irreversible action still requires explicit consent.
- Doctrine drift remains visible through maintenance checks.
- Any active heartbeat poll still receives its expected no-action response.

Implementation evidence (2026-06-13): live references migrated; polling ownership retained in `AGENTS.md`; document-reference validation added to maintenance.

## Interaction Norms Rename

Renaming Dizzy's `GOVERNANCE.md` to `INTERACTION_NORMS.md` prevents confusion with institutional governance in Pharmacy Fiduciary Commons and future cross-project work.

The public/runtime endpoint may remain `/governance` for API compatibility while serving `INTERACTION_NORMS.md`.

Required migration surfaces:

- `README.md`
- `REPO_GUIDE.md`
- `FILE_ROLES.md`
- `DESIGN.md`
- `state.json`
- `PROMPT_PACKS.md`
- `lib/prompt_bundle.mjs`
- `lib/md_retriever.mjs`
- `/governance` endpoint implementation
- Telegram `/governance`
- smoke, prompt-drift, and state-sync tests

Acceptance tests:

- `rg "GOVERNANCE.md" .` returns only historical provenance, explicit Pharmacy references, or compatibility notes.
- `/governance` continues to return the public interaction norms.
- README and repo-guide links resolve.
- Prompt and retrieval allowlists contain the intended renamed file.

Implementation evidence (2026-06-13): active links and references use `INTERACTION_NORMS.md`; `/governance` compatibility remains covered by smoke tests.

## BM25 Extraction

Create a fresh branch from `main` and extract only:

- term frequencies
- document lengths
- average document length
- BM25 scoring
- focused tests

Exclude from the first promotion:

- dashboard code
- Heartbeat migration
- governance rename
- time decay
- prompt expiry
- political-economic relevance boosts

Acceptance tests:

- Existing retrieval tests remain green.
- Repeated relevant terms outrank incidental mentions.
- Long-document normalization prevents keyword stuffing from winning automatically.
- Rare terms contribute more than corpus-common terms.
- Explicit decision queries still retrieve decision material.
- `paid_public` and other blocked zones cannot gain repo retrieval.
- Frontmatter remains excluded from searchable body text.
- Missing terms return no snippets.
- Result metadata remains stable: path, hash, retrieval time, kind, reasons, signals, and excerpt.
- Tests use a deterministic temporary fixture corpus rather than the live repo corpus.
- The retriever exposes a narrow cache-reset hook for test isolation.
- Warm fixture retrieval median stays under 25ms and cold fixture indexing stays under 500ms; production-corpus timing is diagnostic only.

## Time Decay Experiment

Age and authority are different dimensions. Initial decay must be report-only.

Candidate class behavior:

- `project_decision`: no automatic authority decay; show review age.
- `user_claim`: freshness warning after a configurable interval.
- `assistant_observation`: stronger freshness decay.
- `reusable_pattern`: freshness tied to last successful reuse or validation.
- `historical_provenance`: retained for audit without authority boost.

Acceptance tests:

- An old active project decision outranks a recent weak observation.
- Stale claims are labeled rather than silently removed.
- Constitutional and operator-approved material cannot disappear through decay.

## Dashboard Boundary

Keep the dashboard experimental until it is separated from the server core.

Preferred shape:

- `lib/dashboard.mjs`
- a separate static dashboard asset
- explicit read-only routes
- sanitized, zone-aware data responses

Acceptance tests:

- No mutation controls.
- No private memory exposure in paid/public or outside-contact contexts.
- Dashboard failure cannot break the core runtime.
- Server startup does not depend on dashboard assets.

## NEXT.md Consistency

`NEXT.md` must not silently promote parked upgrade notes.

Promotion order:

1. Update the source upgrade note with status, tier, evidence, risks, and acceptance test.
2. Review duplication with existing doctrine/runtime mechanisms.
3. Add or promote the corresponding `NEXT.md` item.

Implemented on `main`: `npm run check:next` and `npm run maintain` warn when an active referenced `NEXT.md` item conflicts with the status or tier in its source upgrade note. Standalone queue items remain valid without a reference.

## Operational Sequence

1. Keep `main` and `experiments` clean and synchronized.
2. Bring current `main` into `experiments` before evaluating promotion candidates.
3. Define one candidate's risks, boundaries, and acceptance tests.
4. Run focused tests and the full maintenance suite on `experiments`.
5. Apply only the candidate's focused commits to `main`; never merge `experiments` wholesale.
6. Run `npm run maintain` on `main` before pushing.
7. Keep time decay report-only until memory-class policies exist.
8. Keep dashboard, prompt expiry, Heartbeat retirement, and interaction-norm migration experimental until their acceptance gates pass.
9. Record promote, rework, retain, or reject decisions here.

## Additional Radar

- Local and remote branch inventories contain only `main` and `experiments`.
- Unique pre-sync history is preserved in `archive/*` tags, not active branches.
- Boundary audit hardening from `main` is present in `experiments`.
- CI runs the full maintenance suite for pull requests and pushes to both active branches.
- Production-readiness checks currently verify some wiring more strongly than behavior; future improvements should report `implemented`, `documented`, `missing`, or `not_applicable` per area.

## Done Condition

Reconciliation is complete when:

- `main` contains only independently accepted mechanisms.
- Experimental features remain available on an explicitly experimental branch.
- Active file references are coherent after any retirement or rename.
- `NEXT.md` agrees with source upgrade status.
- Security fixes from `main` are present in the experiment.
- Every experimental feature has a recorded disposition and acceptance result.
