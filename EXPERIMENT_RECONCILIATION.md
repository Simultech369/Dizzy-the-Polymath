# Experimental Branch Reconciliation

Status: planning map, non-authoritative.

Purpose: preserve experimental work on `codex/context-packs-strange-attractors` while promoting only small, reviewed, independently tested mechanisms into `main`.

This file records reconciliation intent. It does not change runtime behavior, constitutional doctrine, or `NEXT.md` priority by itself.

## Branch State

- Stable branch: `main`
- Experimental branch: `codex/context-packs-strange-attractors`
- Experimental remote tip at review: `2ff8766`
- The experimental branch must not be merged wholesale.
- Experimental work remains non-authoritative until promoted through a focused branch or commit with tests.

## Promotion Rule

For each candidate:

1. Identify the smallest useful mechanism.
2. Separate it from unrelated doctrine, naming, UI, and architecture changes.
3. Define risks and an acceptance test.
4. Implement or extract it on a fresh branch from current `main`.
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
| Time-decay memory | Report-only experiment first | Separate freshness from authority; use memory-class-specific policies |
| Drift and memory dashboard | Keep experimental | Extract from `agent_server.mjs`; make read-only; prove private data cannot cross zones |
| Prompt overlay expiry | Keep experimental | Expiry must be visible and fail legibly; constitutional files must never disappear silently |
| Preventative-economics retrieval boost | Do not promote generically | Allow only in an explicit domain/task overlay, not general relevance ranking |
| HEARTBEAT.md retirement | Migration candidate | Move every retained behavior to a declared owner, close references, and prove behavioral equivalence |
| GOVERNANCE.md rename to INTERACTION_NORMS.md | Migration candidate | Complete namespace migration while retaining `/governance` API compatibility |
| W-0040 Privilege Split | Keep parked until source note changes | Upgrade note status, tier, evidence, and acceptance test must agree before `NEXT.md` promotion |
| W-0041 Telos/Substrate | Keep parked until source note changes | Resolve duplication and doctrine-sprawl risk before `NEXT.md` promotion |

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

Candidate maintenance rule: warn when an active `NEXT.md` item conflicts with the status or tier in its referenced upgrade note.

## Operational Sequence

1. Keep `main` clean and synchronized.
2. Fast-forward the local experimental branch to its remote tip without merging it into `main`.
3. Merge current `main` into the experimental branch so experiments receive current security fixes.
4. Repair active references for the Heartbeat and interaction-norm migrations on the experimental branch.
5. Reconcile W-0040/W-0041 with their source upgrade notes.
6. Run the experimental branch's focused tests and full maintenance suite.
7. Extract BM25 on a new branch from `main`.
8. Evaluate time decay in report-only mode.
9. Keep dashboard and prompt expiry experimental until their acceptance gates pass.
10. Record promote, rework, retain, or reject decisions here.

## Additional Radar

- The local experimental branch trails its remote and should be synchronized before further work.
- The deleted remote `codex/context-pack-core-integration` branch is already contained in `main`; its local branch is archival.
- Backup and pre-sync branches remain local preservation points and should not be treated as active work queues.
- Boundary audit hardening is present on `main` and must be brought into the experimental branch before public dashboard work continues.
- Production-readiness checks currently verify some wiring more strongly than behavior; future improvements should report `implemented`, `documented`, `missing`, or `not_applicable` per area.

## Done Condition

Reconciliation is complete when:

- `main` contains only independently accepted mechanisms.
- Experimental features remain available on an explicitly experimental branch.
- Active file references are coherent after any retirement or rename.
- `NEXT.md` agrees with source upgrade status.
- Security fixes from `main` are present in the experiment.
- Every experimental feature has a recorded disposition and acceptance result.
