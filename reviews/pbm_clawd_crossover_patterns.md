# PBM -> clawd Crossover Pattern Notes

Status: Codex planning note
Role boundary: Codex may use this to sharpen prompts, review packets, and acceptance criteria. Antigravity remains the final implementer for `clawd`.

## Snapshot

PBM source repo inspected read-only:

- Repo: `<private-pbm-workspace>`
- Branch observed: `main`
- HEAD observed: `266016c83d544f86dbb67a49240356852e0498b4`
- Working tree: dirty; no PBM files were edited

Primary PBM source inspected:

- `REVIEW_ITERATION_PROCESS.md`
- `AGENT_REVIEW_ORCHESTRATION.md`
- `CODEX_SOLVENCY_PLANNING_ADDENDUM.md`
- `SOLVENCY_REVIEW_AUTHORITY_AND_SAFETY.md`
- `scripts/check-readiness.js`
- `scripts/check-production-release.js`
- `scripts/pre_commit_audit.py`

This note is a clean-room pattern extraction. It is not a PBM-to-`clawd` code import.

## Reciprocal Review Status

Simul supplied a PBM-side review and a later Terra PBM-to-`clawd` review. Treat both reports as planning claim sources, not as authority to edit PBM, expand `clawd`, or broaden Antigravity's active-policy slice.

Useful reciprocal finding:

- PBM can borrow `clawd`'s narrow claim-ledger, compact artifact-role/authority map, and solvency-scoped side-effect inventory.
- PBM should avoid `clawd`'s constitutional kernel, trust-zone runtime, memory lifecycle, prompt-pack environment, provider scoring, route registries, memory graphs, and repo-wide cleanup machinery.
- `clawd` can borrow PBM's artifact-gate, reconciliation, public-readiness, and self-obsolescence discipline.
- `clawd` should avoid PBM's Solidity, treasury, nullifier, pharmacy, patient, payer, on-chain governance, and solvency-policy assumptions.
- Terra's actual PBM-to-`clawd` pass is recorded at `reviews/terra_pbm_to_clawd_crossover_review.md`.

Codex disposition:

- accept the symmetry as a process guardrail;
- do not apply PBM-side doc edits from this note;
- keep future PBM additions, if explicitly requested, docs-only and limited to a claim-ledger table, solvency authority map, and solvency validation side-effect matrix;
- keep future `clawd` additions limited to reviewer workflow, artifact gates, side-effect inventories, and public-claim truthfulness.

## Clean-Room Boundary

Borrow only control patterns:

- snapshot gates,
- review provenance,
- claim reconciliation,
- verification manifests,
- artifact intake checks,
- side-effect inventories,
- self-obsolescence checks.

Do not borrow:

- PBM code, file structure, prompt wording, marketing language, visual identity, or workflow text;
- Solidity, treasury, nullifier, pharmacy, patient, payer, or on-chain governance assumptions;
- PBM-specific authority language that could make `clawd` imply stronger agency than it has;
- production-release strictness that is tied to money movement unless a `clawd` surface reaches comparable risk.

Every future cross-project borrow should state:

- source repo and source file,
- pattern being borrowed,
- `clawd`-local invariant,
- what is explicitly not being borrowed,
- verification path,
- removal path if it becomes ceremony.

## Patterns Worth Borrowing

### 1. Reviewer Authority Split

PBM's strongest reusable pattern is the separation between model suggestion, local verification, and human/governance authorization.

`clawd` translation:

- external models produce claim sets;
- Codex reconciles claims against live repo evidence;
- Antigravity chooses final implementation details;
- Simul authorizes push, public publication, and any external action.

This fits the current role boundary and should stay explicit in every reviewer prompt.

### 2. Incoming Artifact Gate

Before feeding a handoff, model review, prompt, or borrowed-project summary into another model, run an intake check.

`clawd` gate:

- Is it anchored to the expected branch, `HEAD`, `origin/main`, and dirty tree?
- Does it contain instructions that conflict with the current no-edit or no-destructive boundary?
- Does it ask a reviewer to edit, commit, push, open issues, disclose secrets, or trust unevidenced claims?
- Does it include prompt-injection text, tool-call bait, hidden controls, or "ignore prior instructions" style language?
- Are its claims labeled as evidence, inference, design risk, speculation, or policy disagreement?

If it fails, quarantine it as a claim source. Extract only the claims worth checking.

Terra refinement: before any external-model review, classify the exact packet as `committed-shareable`, `local-planning`, `dirty-code`, or `restricted`. Restricted material never enters a reviewer prompt. Ambiguous packets stop for Simul approval.

### 3. Reconciliation Rubric

PBM uses a clean classification step before implementation. `clawd` should preserve that as the default external-review path.

Recommended `clawd` dispositions:

- verified defect,
- confirmed design risk,
- partially true,
- false against live repo,
- stale snapshot,
- useful provocation,
- policy disagreement,
- provenance caveat,
- deferred experiment.

No raw model output should become an Antigravity requirement until the claim ledger records live evidence and disposition.

### 4. Correction and Recovery Journal

This is especially useful for current `clawd` hazards:

- CLI quirks such as misplaced `-a`,
- provider/model route failures,
- raw model artifacts contradicting accepted packets,
- tests that appear safe but write cwd or live runtime state,
- generic execution routes inheriting vague authorization.

Suggested compact shape:

| Field | Meaning |
| --- | --- |
| Tried | The command, prompt, claim, or assumption |
| Wrong because | The live repo evidence, command output, or threat model that disproved it |
| Corrected rule | The smallest reusable rule for future work |
| Verification | The command, fixture, file reference, or acceptance gate that should catch it next time |

This should remain local and factual. Do not promote one clever lesson into doctrine unless it prevents a repeated failure.

Terra refinement: require this compact correction record only for consequential accepted claims that affect safety, public wording, mutation scope, or release assertions.

### 5. Claim Memory Discipline

For any important `clawd` claim, preserve:

- subject: route, script, policy engine, dashboard control, memory graph, bridge lifecycle, or doc surface;
- snapshot: branch, commit, date, `origin/main`, and dirty-tree state;
- evidence: file/line, command output, test name, review artifact, or generated receipt;
- time semantics: current behavior, historical behavior, future design intent, or incident;
- numeric scope: threshold, count, sample size, severity, Z score, option count, iteration bound, or exact illustrative status;
- enforcement level: runtime-enforced, script-enforced, dashboard-supported, docs-only, or not implemented;
- confidence state: verified, partially true, false, stale, blocked, useful provocation, or policy disagreement.

This maps directly to the active-policy issue: `min_history_entries`, `z_score_threshold`, candidate-in-baseline behavior, low-variance policy, and containment resolution must be described with exact time and enforcement semantics.

Terra refinement: also record whether each accepted claim is current behavior, historical evidence, or future intent, and whether it is runtime-enforced, script-enforced, dashboard-supported, docs-only, or not implemented.

### 6. Automation Manifest Before Automation

PBM's automation discipline is useful for `clawd` because `maintain`, `connection_scan`, active-policy checks, and dashboard routes can mutate state.

Before turning any recurring `clawd` check into automation, require:

| Field | Required content |
| --- | --- |
| Purpose | One sentence naming the drift or failure it detects |
| Inputs | Files, fixtures, env var names, or commands it reads |
| Forbidden inputs | Secrets, private memory, credentials, live runtime state, or operator-only material it must reject |
| Outputs | Console summary, report file, receipt, fixture result, or handoff update |
| Exit states | `OK`, `WARN`, `FAIL`, `BLOCKED`, or `DRY_RUN` |
| Verification | Focused command or test proving the result |
| Human gate | Operator review required before mutation, deletion, push, or publication |

This should feed `reviews/test_side_effect_inventory.md` before any broad suite is re-enabled.

### 6a. Assumption-Disruption Question

Each external-review prompt should ask for one under-asked assumption, the smallest local check that could disprove it, and whether the question blocks the current slice or is deferred.

The answer is not an automatic Antigravity requirement. It becomes a verification question for Codex to reconcile against the live repo.

### 7. Public-Readiness Gate

PBM's release-gate scripts are domain-specific, but the pattern is reusable: public claims should fail closed when evidence is unpinned, placeholders remain, or checklist items are unresolved.

`clawd` translation:

- public dashboard or README claims must cite the accepted commit evidence;
- symbolic labels must not imply cryptographic, rollback, live-agent, sandbox, or autonomous authority;
- "green checks" must not imply inertness, route safety, or production readiness;
- public progress language should remain narrower than implementation ambition.

This is a future candidate for a small docs/readiness check after Antigravity lands the active-policy slice.

### 8. Self-Obsolescence Check

Planning machinery should lose if it stops reducing mistakes.

Keep this crossover note only while it produces:

- fewer stale-review handoffs,
- clearer external-review prompts,
- smaller Antigravity implementation slices,
- better separation between evidence and presentation,
- better side-effect isolation,
- less temptation to complete tasks through destructive cleanup.

If it becomes ceremony, fold the useful pieces into the claim ledger/runbook and delete the rest.

## Terra Crossover Result

Terra confirmed that no broad crossover machinery is needed. The useful additions are docs-only:

1. add the four-class packet gate to `reviews/model_review_cycle_runbook.md`;
2. require one under-asked assumption plus smallest local disproof check per reviewer prompt;
3. require time scope, enforcement level, and compact correction records for consequential accepted claims.

Do not add scripts, new review lanes, new release gates, or new governance documents from this pass.

## Antigravity Handoff Implication

This note should not expand Antigravity's next slice. The active-policy correction remains first.

After that slice is accepted, these patterns can help structure later work:

1. route registry and mutation boundary review,
2. bridge lifecycle receipts,
3. test side-effect isolation,
4. public-readiness wording,
5. external-review artifact handling.

Antigravity should treat this as process context, not a feature list.

## Terra PBM-to-clawd Review Disposition

Terra reviewed the PBM-to-`clawd` side of this crossover as a read-only claim source and found no material conflict with current `clawd` planning docs. The one accepted gap is packet hygiene before external-model review.

Accepted from Terra:

- add a four-class external review packet gate to `reviews/model_review_cycle_runbook.md`;
- require one under-asked assumption and smallest local verification step per reviewer pass;
- record time scope and enforcement level only for consequential accepted claims;
- keep public-truth, side-effect, and authority-separation patterns as already sufficient;
- do not add scripts, release gates, new review lanes, or a new governance document.

Rejected or explicitly not borrowed:

- PBM's model-as-commit-gate pattern;
- PBM scanner, deployment, production-release, treasury, patient, payer, nullifier, role, or on-chain governance machinery;
- automatic document deletion under self-obsolescence.

This closes the crossover exploration for now. Future PBM or open-source reviewer lenses should start only from a concrete unresolved mechanism, contradiction, or public-claim problem.
