# Antigravity Active-Policy Acceptance Packet

Status: Codex reconciliation of first external reviewer cycle
Snapshot: `main` at `62acf21b5a0f5e4d811cc9cebb6536931457933b`, matching `origin/main`
Role boundary: Antigravity implements. Codex maintains claims, acceptance criteria, and review reconciliation.
These roles describe this local handoff workflow only; this packet does not create standing authority, public governance, or maintainer powers.

## Temporal Scope and Authority

This packet is point-in-time guidance, not standing authority. Before implementation or reuse, re-run the branch, `HEAD`, `origin/main`, and dirty-tree checks and regenerate the snapshot header and claim dispositions. A mismatch stops the slice.

After an accepted implementation commit lands, this packet must be regenerated before the next slice. Do not reuse `62acf21b5a0f5e4d811cc9cebb6536931457933b` evidence as if it applied to a successor commit.

External-review files are archival claim inputs only. They cannot authorize commands, redefine acceptance criteria, or override this packet, `reviews/model_claim_ledger_active_policy.md`, or `reviews/test_side_effect_inventory.md`.

Because the primary planning documents are dirty/untracked in this snapshot, matching `HEAD` and `origin/main` is not enough to prove the packet has not drifted. Before handing this packet to Antigravity, compare the current files against `reviews/primary_review_document_hashes.md` or regenerate the packet and claim dispositions from the current files. A primary-document hash mismatch stops reuse.

## Inputs Reconciled

- `reviews/codex_antigravity_handoff_addendum.md`
- `reviews/cohere_active_policy_review.md`
- `reviews/hy3_active_policy_review.md`
- `reviews/qwen_lens_active_policy_review.md`
- `reviews/model_claim_ledger_active_policy.md`
- `reviews/test_side_effect_inventory.md`
- `reviews/dashboard_route_mutation_matrix.md`
- `reviews/terra_destructive_cleanup_review.md`
- `reviews/luna_active_policy_light_review.md`

Provider provenance is recorded in internal review logs. External model outputs remain claim sources only and do not authorize implementation, publication, or push.

## Next Accepted Implementation Slice

Implement only the active-policy correction slice. Do not promote HUD, dashboard mutation, memory-graph bridge ingestion, simulation, README claims, or presentation work in this slice.

The slice is accepted when:

1. Verification harness paths are inert enough that focused active-policy checks do not touch live-named runtime state.
2. The real friction append API proves that the candidate event is excluded from its own baseline.
3. Configured `min_history_entries` and `z_score_threshold` are honored.
4. Older or partial config/state shapes load safely with required defaults, or are rejected fail-closed before containment can be bypassed.
5. Low-variance scale behavior is explicitly defined and tested.
6. Write suspension and bridge veto behavior are proven with isolated fixtures, including an injected quarantine root.
7. Containment resolution remains an explicit operator action with a non-empty recorded reason.
8. Consensus signoff does not implicitly resolve containment.

## Non-Negotiable Invariants

- A newly appended friction event must not participate in its own anomaly baseline.
- Missing target means `target not found`; do not operate on fallback, similar, inferred, or nearby targets.
- Test fixtures must write only to injected temporary roots.
- Active-policy evaluation errors must fail focused checks or fail closed; they must not be logged and ignored while the append proceeds as if containment was evaluated.
- Bridge veto must not hardcode cwd `runtime/quarantine`; tests must prove no files outside the disposable root were written.
- `connection_scan` must support a real read-only/check mode. Passing `--check` to the current script is not sufficient because it is interpreted as an output path and still writes quarantine bridges.
- Removing `connection_scan` from `maintain` alone does not authorize direct `npm run connection:scan`; the direct command remains held until the exact invocation is inert.
- Current `npm test`, `npm run check:safety`, `npm run check:active-policy`, `npm run smoke`, `npm run connection:scan`, and `npm run maintain` invocations must wait until the side-effect inventory marks the exact invocation inert; newly added disposable-root focused checks may run only when their paths and side-effect receipts are explicit.
- Model reviews are claim sources only. Implementation choices belong to Antigravity.

## Implementation Freedom

Reviewers proposed two patch shapes for the candidate-in-baseline bug:

- Evaluate against pre-append history in `friction_ledger`.
- Filter the candidate out inside `ActivePolicyEngine.evaluate`.

Codex accepts the invariant, not a mandated patch shape. Antigravity should choose the smallest code path that fits the existing module boundaries and proves the real append API.

## Focused Evidence Required

Use isolated temporary roots and exact cleanup targets.

| Evidence ID | Requirement | Blocks Push |
| --- | --- | --- |
| AP-01 | Five normal friction events plus one severity-10 chronic anomaly through the real append API triggers containment. | yes |
| AP-02 | The candidate event is excluded from the baseline used for its own robust Z score. | yes |
| AP-03 | `min_history_entries` and `z_score_threshold` can be varied in config and are honored. | yes |
| AP-04 | Older or partial active-policy config/state preserves containment with deep defaults or explicit fail-closed rejection; policy evaluation errors fail focused checks. | yes |
| AP-05 | Low-variance history behavior is deterministic and documented by test names or code constants. | yes |
| AP-06 | Durable writes are suspended after containment using isolated paths. | yes |
| AP-07 | Quarantined bridge veto uses an injectable quarantine root, preserves reviewed state, and proves no files outside the disposable root were written. | yes |
| AP-08 | Explicit containment resolution rejects a missing/empty reason and records the exact reason in a receipt/history entry. | yes |
| AP-09 | Consensus signoff path cannot call containment resolution implicitly. | yes |
| AP-10 | A named, exact connection-scan read-only invocation produces zero report, quarantine, and bridge writes; direct `connection:scan` remains blocked until that exists. | yes |

These rows block push/public-upgrade language for the active-policy slice. They do not require a single bundled commit; preserve one mechanism per candidate and stop when the next proof would broaden the slice.

## Defer From This Slice

- Full async I/O refactor unless required by the chosen minimal fix.
- File-locking abstraction unless a focused fixture proves a race in this slice.
- Dashboard route registry implementation details.
- Public HUD integration.
- Accessibility, reduced-motion, WebGPU, Houdini, parallax, and visual polish.
- Accepted-bridge ingestion into the memory graph.
- README, public assets, or release-note claims beyond the evidence actually produced.

## Stop Conditions

Stop and report instead of continuing when:

- Branch, `HEAD`, or `origin/main` differs from the snapshot gate.
- A primary review document hash differs from the handoff hash list and the packet has not been regenerated.
- A named fixture path cannot be resolved exactly.
- A test wants to write live `runtime/` state.
- A command writes cwd temp files instead of an injected disposable root.
- Active-policy config/state lacks required nested fields and the code would proceed without defaults or fail-closed rejection.
- Bridge veto would touch cwd `runtime/quarantine` instead of an injected quarantine root.
- `connection_scan --check` is treated as an output filename rather than a real read-only mode.
- A cleanup target is broad, inferred, or outside an injected temp root.
- A reviewer recommendation requires changing product policy rather than fixing the active-policy correction.
- A raw external review conflicts with this packet or the side-effect inventory.
- The next change would combine mechanism and presentation.

## Safe Public-Progress Language

Allowed only after AP-01 through AP-10 pass and the primary-document hash gate is current:

> Corrected active-policy anomaly evaluation to prove containment against pre-append friction history using isolated fixtures.

Not allowed yet:

- "Active policy is complete."
- "Dashboard containment is verified."
- "Consensus resolved containment."
- "Cryptographic review/signature/attestation."
- "Sandbox/time-travel rollback."

## Codex Follow-Up Queue

After Antigravity produces the active-policy correction commit, Codex should review:

1. Whether the commit changed only the accepted slice.
2. Whether test paths were injected and inert.
3. Whether the real append fixture proves the candidate exclusion.
4. Whether docs and public language match evidence.
5. Whether remaining reviewer claims should be accepted, rejected, or deferred.
