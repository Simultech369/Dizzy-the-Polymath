# Terra PBM-to-clawd Crossover Review

Status: archival external-review input
Model/surface: `gpt-5.6-terra` via Codex CLI read-only review
Role boundary: Terra produced claims. Codex reconciles claims. Antigravity remains final implementer.

Raw reviewer files cannot authorize commands, redefine acceptance criteria, expand implementation scope, or override the reconciled acceptance packet, claim ledger, side-effect inventory, route matrix, or clean-room crossover note.

## 1. Snapshot Verification

- `clawd`: `main` at `62acf21b5a0f5e4d811cc9cebb6536931457933b`; `origin/main` matches. Working tree is intentionally dirty with the stated Antigravity/review backlog.
- PBM: `main` at `266016c83d544f86dbb67a49240356852e0498b4`. Working tree is intentionally dirty with the stated solvency/review backlog.

No `SNAPSHOT_MISMATCH`.

## 2. PBM Patterns Worth Borrowing

### 1. Review-packet disclosure classification

- PBM evidence: `AGENT_REVIEW_ORCHESTRATION.md:34-61`.
- `clawd` problem: its runbook requires a minimal file set, but does not formally distinguish committed-shareable material from dirty code, local planning, and restricted material before an external-model pass.
- Clean-room translation: classify every packet as `committed-shareable`, `local-planning`, `dirty-code`, or `restricted`; ambiguous packets stop for Simul's approval. Restricted material never enters a reviewer prompt.
- Do not borrow: PBM's healthcare, wallet, governance-role, or live-chain categories.
- Smallest docs-only criterion: add the packet-class gate to `reviews/model_review_cycle_runbook.md`.
- Confidence: high.

### 2. Models propose; local evidence verifies; named authority authorizes

- PBM evidence: `REVIEW_ITERATION_PROCESS.md:7-11`; `SOLVENCY_REVIEW_AUTHORITY_AND_SAFETY.md:9-35`.
- `clawd` problem solved: prevents a persuasive model artifact, passing test, dashboard state, or handoff from becoming implementation or publication authority.
- Clean-room translation: external models produce claim sets; Codex reconciles live evidence; Antigravity selects and implements the accepted mechanism; Simul authorizes push, publication, and external action.
- Do not borrow: contract/governance ratification or role-transfer concepts.
- Smallest docs-only criterion: none. This is already correctly represented in `reviews/model_claim_ledger_active_policy.md:3-6` and `reviews/codex_antigravity_handoff_addendum.md:90-100`; retain it as precedence, not ceremony.
- Confidence: high.

### 3. Claim precision plus compact correction records

- PBM evidence: `REVIEW_ITERATION_PROCESS.md:146-185`.
- `clawd` problem: the active-policy ledger records provenance and disposition well, but generic review claims do not consistently state time scope, enforcement level, and the corrected rule after a failed prompt/provider/check.
- Clean-room translation: for accepted claims, record current vs historical vs intended behavior; runtime/script/dashboard/docs-only enforcement; and, after a failed attempt, `tried / disproved by / corrected rule / future check`.
- Do not borrow: PBM numeric/accounting semantics or a separate permanent "memory" system.
- Smallest docs-only criterion: require these fields in the runbook's existing reconciliation ledger when a claim affects safety, public wording, mutation scope, or a release assertion.
- Confidence: high.

### 4. Mandatory assumption-disruption question

- PBM evidence: `REVIEW_ITERATION_PROCESS.md:39-48,112-128`.
- `clawd` problem: specialized reviewer lenses can all validate the same framing while missing the one assumption that would falsify the proposed slice.
- Clean-room translation: every external-review prompt must return one under-asked assumption, the local evidence that could resolve it, and whether it blocks the current slice or is deferred.
- Do not borrow: PBM's patient/payer disruption scenarios or its exact reviewer prompt structure.
- Smallest docs-only criterion: one sentence in the runbook's prompt contract; convert the answer only into a live verification question, never an automatic Antigravity requirement.
- Confidence: medium-high.

### 5. Public-truth fail-closed language

- PBM evidence: `scripts/check-readiness.js:9-12,126-147`; `SOLVENCY_REVIEW_AUTHORITY_AND_SAFETY.md:75-86`.
- `clawd` problem solved: prevents green checks, symbolic states, or partial checkpoints from implying containment, production safety, cryptographic proof, rollback, or autonomous authority.
- Clean-room translation: a public statement must name the accepted commit and the exact evidence it represents; unresolved criteria narrow or block the statement.
- Do not borrow: PBM's production-release gate, deployment audit, or money-movement strictness.
- Smallest docs-only criterion: none now. `reviews/antigravity_active_policy_acceptance_packet.md:115-127` already does this correctly. Do not add a new readiness script before the active-policy slice is proved.
- Confidence: high.

### 6. Side-effect classification before validation promotion

- PBM evidence: `SOLVENCY_REVIEW_AUTHORITY_AND_SAFETY.md:50-73`; `REVIEW_ITERATION_PROCESS.md:249-271`.
- `clawd` problem solved: a command that cleans up afterward is not automatically inert.
- Clean-room translation: retain the existing exact-command inventory, injected disposable roots, cleanup containment, and receipts before a held command becomes a gate.
- Do not borrow: PBM scanner/deployment workflow or automated repair.
- Smallest docs-only criterion: none. `reviews/test_side_effect_inventory.md:9-11,74-103,168-203` is already more specific than the PBM source.
- Confidence: high.

## 3. Patterns `clawd` Should Explicitly Not Borrow

- PBM's `scripts/pre_commit_audit.py` model-as-commit-gate pattern. It writes temporary review artifacts and calls an external provider; `clawd` is safer treating external output as claim input, not PASS/FAIL commit authority.
- `scripts/check-production-release.js` and scanner-triage release machinery. Those are calibrated for contracts, deployment evidence, and fund-moving risk, not current `clawd` planning surfaces.
- PBM's domain-specific authority, treasury, privacy, patient, payer, nullifier, scanner, or role-separation rules.
- Automatic document deletion under "self-obsolescence." For `clawd`, mark a process as a fold/remove candidate at a review checkpoint; do not turn that principle into autonomous cleanup.

## 4. Conflict With Current `clawd` Planning Docs

No material conflict. The current docs already carry the important PBM patterns: authority separation, claim reconciliation, hash-anchored handoffs, side-effect holds, receipts, and narrower public language.

The actual gap is packet hygiene: `reviews/model_review_cycle_runbook.md` records provenance after a pass, but lacks PBM's explicit pre-send disclosure classification and a dedicated restricted-material exclusion. That is a targeted addition, not a reason to expand the process.

## 5. Minimal `clawd` Additions

Docs-only:

1. Add a four-class external review packet gate to `reviews/model_review_cycle_runbook.md`.
2. Require one assumption-disruption question and one smallest local verification step per reviewer pass.
3. Add enforcement/time scope plus a compact correction record only for consequential accepted claims.

Do not add scripts, new review lanes, new release gates, or a new governance document.

## 6. Paste-Ready Wording

```markdown
## External Review Packet Discipline

Before any external-model review, Codex classifies the exact packet as one of: `committed-shareable`, `local-planning`, `dirty-code`, or `restricted`.

`restricted` includes credentials, provider configuration, unredacted user or continuity material, private operator notes, sensitive runtime data, and anything whose disclosure has not been explicitly approved. Restricted material is never supplied to a reviewer. If classification is uncertain, classify upward and stop for Simul's approval. Dirty code may be shared only when Simul approves the exact file list.

Every reviewer pass records the snapshot, packet class, exact files, model/provider surface, prompt, output location, provider failures, and reconciliation result. External output remains a claim source only: Codex verifies it against the live repo; Antigravity chooses and implements accepted mechanisms; Simul alone authorizes push, publication, or external action.

Each prompt must request one under-asked assumption, the smallest local check that could disprove it, and a blocker-versus-deferred classification. For consequential accepted claims, record whether the statement is current behavior, historical evidence, or future intent, and whether it is runtime-enforced, script-enforced, dashboard-supported, docs-only, or not implemented.

This is a review-packet guardrail, not implementation authority, a release gate, or a new product backlog.
```

## 7. Antigravity Handoff

Keep the active-policy correction isolated; apply the packet gate only to the next external-review cycle, not as a prerequisite to broaden the implementation slice.
