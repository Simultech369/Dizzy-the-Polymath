# Codex Design-Partner Addendum for Antigravity

Status: Accumulating handoff notes
Role boundary: Codex suggests, critiques, and sharpens plans. Antigravity remains the final implementer.

## Purpose

This document is a parallel handoff surface. It does not replace Antigravity's implementation plan or walkthrough. It exists to preserve Codex review findings, guardrails, and acceptance criteria without silently taking ownership of final implementation.

Use this when Antigravity credits return to reconcile the in-progress backlog against current repo state before promoting dashboard, policy, memory graph, or presentation work.

For the next return, start with `reviews/antigravity_read_this_first.md`, then `reviews/antigravity_return_packet.md`. The read-first index is the packaged entry point; this addendum remains a broader backlog map.

## Current Public Checkpoint

- Branch: `main`
- Latest pushed checkpoint observed by Codex: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- Commit message: `Add active policy containment freshness check`
- Public-progress interpretation: real but incomplete active-policy progress.

Known limitation of that checkpoint:

`62acf21` proves persisted containment state freshness across separate `ActivePolicyEngine` instances. It does not prove that the real friction append path triggers containment correctly, because append currently writes the candidate event before evaluating baseline history. Treat it as a useful public checkpoint with a known next correction, not as completed active-policy semantics.

## Standing Guardrails

- Do not perform cleanup as a substitute for understanding.
- Do not reset, clean, stash, delete, move, rename, prune, remove VMs, or clear state unless the exact target is named, verified, and explicitly approved.
- If a named target is missing, stop and report `target not found`; do not operate on nearby, fallback, inferred, or similarly named targets.
- Do not override durable environment variables such as `HOME`, `USERPROFILE`, `PATH`, repo roots, model/provider config, or credential locations merely to make a command pass.
- Tests must be inert verification unless explicitly scoped otherwise. Do not run tests that create irreversible external state, trigger deployments, mutate production/runtime credentials, delete infrastructure, or load state for a later destructive action.
- Classifiers, safety gates, and activation conditions must be inspected before trusting an automation path. A passing test is not proof that the activation boundary is safe.
- Prefer reversible, evidence-producing work over completion theater.
- When completion pressure conflicts with future maintainability, portability, or auditability, preserve future optionality and report the blocked edge plainly.

## Neuro-Symbolic Guardrail

Symbolic states are useful for operator attention, but they must not authorize action by themselves.

- Terms like friction, containment, drift, anomaly, stress, and spectral state must map to explicit machine-readable conditions.
- Every symbolic state should explain: what triggered it, where it was measured, what is blocked, what remains allowed, and how the operator resolves it.
- A UI cue such as red, pulsing, high-friction, or containment is an advisory overlay. Policy gates must remain deterministic and auditable.
- Difficulty signals such as `this is hard`, `think carefully`, or `make no mistakes` should increase grounding, verification, and uncertainty labeling. They must not bypass permissions, sandboxing, destructive-action rules, privacy boundaries, budget gates, or role boundaries.

## Antigravity Implementation Sequence

This is a deferred backlog map, not the return scope. For the next Antigravity return, only steps 1-3 are in scope unless Simul explicitly expands the slice.

1. Reverify branch, `HEAD`, `origin/main`, and dirty-tree inventory. Do not stash, reset, clean, or reorganize the backlog.
2. Make the verification harness inert first:
   - Inject temporary runtime/state paths.
   - Move consensus tests off live-named state.
   - Give connection scan a genuinely read-only/check mode.
   - Keep `maintain` from invoking state-writing checks.
3. Repair active-policy semantics:
   - Exclude the candidate event from its baseline.
   - Honor configured minimum history and threshold.
   - Validate config/state shape.
   - Define the low-variance scale policy.
   - Prove the real append path with isolated fixtures.
   - Decouple consensus signoff from containment resolution.
4. Promote consensus truth-language separately, with migration tests and no HUD dependency.
5. Promote only the memory-graph semantic fixes; keep accepted bridges out.
6. Define one authoritative dashboard route registry used by session authorization, fallback registration, and tests.
7. Decide the dashboard mutation boundary explicitly:
   - Prefer read-only public progress first.
   - Treat bridge approval, deletion, pruning, execution, and containment resolution as separate operator actions.
8. Harden bridge lifecycle:
   - Exact ID validation and path containment.
   - `target not found` behavior.
   - Locking/atomic updates.
   - Rejection tombstones or receipts.
   - Explicit cache invalidation.
   - Connection scan must use the same staging policy and preserve reviewed state.
9. Redesign continuity deletion as preview -> explicit confirmation -> bounded execution -> detailed receipt.
10. Bound and relabel simulation:
    - `Path-isolated telemetry`, not sandbox/time travel.
    - No disk checkpoint on every dashboard poll.
    - Validate initial state, integers, option counts, and iteration budgets.
    - Label the treasury model as a demo fixture.
11. Only then integrate the HUD:
    - Browser-flow tests for every visible control.
    - Confirmation for high-impact hotkeys.
    - No implicit containment resolution.
    - Responsive/reduced-motion/accessibility checks.
    - Remove presentation that implies cryptographic, live-agent, or rollback authority.
12. Update reconciliation, upgrade status, README, and public assets last, using only evidence from final accepted commits.
13. Run the full suite only after destructive fixtures have been isolated. Capture commit-specific evidence before requesting push approval.

## Codex-Only Next Moves

Codex should continue to:

- Maintain a claim ledger: review claim -> live evidence -> disposition.
- Run capability-specific external reviewer cycles only as claim generation, using `reviews/model_review_cycle_runbook.md`.
- Convert contradictory reviews into acceptance criteria rather than patches.
- Maintain the route/mutation matrix in `reviews/dashboard_route_mutation_matrix.md`, covering authentication, same-origin requirements, state touched, reversibility, and receipts.
- Maintain the test side-effect inventory and disposable-runtime protocol in `reviews/test_side_effect_inventory.md`.
- Use `reviews/pbm_clawd_crossover_patterns.md` only as clean-room process context for reviewer workflow and artifact gates; it is not an implementation backlog.
- Keep `reviews/antigravity_return_packet.md`, `reviews/first_commit_acceptance_checklist.md`, and `reviews/public_progress_language_options.md` ready as drafting surfaces for Antigravity's return.
- Review each Antigravity commit for scope containment, proof quality, and documentation truth.
- Keep the backlog partitioned into correction, bounded mechanism, experiment, and presentation lanes.
- Draft public-progress commit messages and release notes only after evidence exists.

Codex should not select implementation details on Antigravity's behalf where a safety/product decision remains unresolved, and should not turn this review into code.

## Copy-Paste Antigravity Handoff

```text
Work in:

C:\Users\Josh\clawd

You are Antigravity, the final implementer.

Snapshot gate:
- Expected branch: main
- Expected starting HEAD: 62acf21b5a0f5e4d811cc9cebb6536931457933b
- Expected origin/main: same commit
- Expected working tree: intentionally dirty with a large dashboard/policy/review backlog

Before implementation:
1. Run git branch --show-current, git rev-parse HEAD, git rev-parse origin/main, and git status --short.
2. If branch or commit differs, stop and report the mismatch.
3. Do not reset, clean, stash, delete, move, rename, or broadly reformat the backlog.
4. Treat every existing dirty hunk as unapproved review material.
5. Do not push without explicit Simul approval.

Primary objective:
Produce the smallest real, reversible, evidence-producing correction to the active-policy checkpoint before promoting HUD or presentation work.

Critical confirmed issue:
The real friction append path writes the new anomaly before ActivePolicyEngine rereads the ledger. The anomaly is therefore included in its own historical baseline. Five normal severity-2 entries followed by a severity-10 chronic anomaly produce robust_z 2.68 and fail to trigger, although the intended pre-append baseline produces a trigger.

Implementation order:

Phase 1 - Make verification inert
- Move safety/consensus fixtures away from live-named runtime state.
- Ensure tests use injected temporary roots and exact verified cleanup targets.
- Add a read-only/check mode to connection scanning, or remove it from maintain until it is inert.
- Do not run npm test or npm run maintain against the live workspace before this is fixed.

Phase 2 - Correct active policy
- Test through the real append API with five normal events and one anomaly.
- Ensure the candidate is excluded from its baseline.
- Honor configured min_history_entries and z_score_threshold.
- Validate loaded config/state and handle older state lacking required fields.
- Define and test low-variance fallback behavior.
- Prove write suspension and bridge veto using isolated fixture paths.
- Require explicit operator containment resolution with a recorded reason.
- Remove the dashboard behavior that resolves containment automatically when reported reviews are accepted.
- Keep incident/friction audit behavior explicit under containment.

Phase 3 - Small isolated promotions
A. Consensus truth-language:
- Preserve operator-reported labels, basis, and proof_limit.
- Do not imply signatures, live multi-agent consensus, rollback, or routing authority.
- Avoid coupling this commit to HUD/MDS work.

B. Memory graph:
- Promote stopword, secure-default trust-zone, and result-backfill fixes with focused retrieval tests.
- Add mixed-acronym fixtures such as WebGPU and WebGL.
- Do not include accepted-bridge ingestion yet.

Phase 4 - Dashboard route contract
- Use one authoritative route registry for session authorization, fallback routes, and regression tests.
- Cover every displayed bridge, friction, containment, simulation, and prune endpoint through the real loopback login-cookie flow.
- Keep the first dashboard promotion read-only where possible.

Phase 5 - Mutation lifecycle
- Bridge IDs must match the exact expected hash format.
- Reject missing targets with target not found.
- Add path containment, atomic writes/locking, cache invalidation, and receipts.
- Connection scan must preserve existing operator decisions.
- Continuity deletion and pruning require preview, explicit confirmation, exact affected targets, and partial-failure reporting.

Phase 6 - Simulation and HUD
- Describe the simulator as path-isolated telemetry, not a sandbox or historical time machine.
- Remove per-poll temp-file churn and NaN baseline calls.
- Bound state, steps, option count, iteration count, CPU, and cache footprint.
- Label the treasury model as a demo fixture.
- Add the unified HUD only after backend route and mutation tests pass.
- Require confirmation for high-impact keyboard actions.
- Add responsive, reduced-motion, keyboard, focus, and accessibility checks.
- Do not add WebGPU, Houdini, parallax, cryptographic attestations, or premium README claims without measured need and matching evidence.

Commit discipline:
- One mechanism per commit.
- Run focused isolated checks first.
- Run the full suite only after test fixtures are inert.
- After every candidate, show:
  1. files changed,
  2. behavior changed,
  3. tests run,
  4. state written or deleted during tests,
  5. residual risks,
  6. whether the commit is safe to push.
```
