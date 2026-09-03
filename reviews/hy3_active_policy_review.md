# Active Policy Review — Hy3

## Provenance
- **Model/lens:** Hy3, long-context systems reconciler. Independent reviewer; claims only, no implementation.
- **Files reviewed (from provided context):**
  - `lib/active_policy_engine.mjs`
  - `lib/friction_anomaly_detector.mjs`
  - `lib/friction_ledger.mjs`
  - `lib/durable_write_policy.mjs`
  - `scripts/check_active_policy_state.mjs`
  - `scripts/test_active_integration.mjs`
  - `scripts/safety_checks.mjs` (excerpt)
  - `scripts/maintain.mjs`
  - `scripts/connection_scan.mjs`
  - `package.json`
  - `reviews/codex_antigravity_handoff_addendum.md`
- **Assumptions:**
  - Repo root is `<local-clawd-checkout>`; runtime artifacts live under `runtime/`.
  - Antigravity is final implementer; Codex maintains acceptance criteria; Hy3 reconciles.
  - Provided code excerpts are current live code; no unshown mutations assumed.
  - Public checkpoint `62acf21` (per handoff) added containment freshness check only.

---

## Contradiction Map

| # | Surface A | Surface B | Contradiction | Classification |
|---|-----------|-----------|---------------|----------------|
| C1 | `friction_ledger.mjs` `appendFrictionSync`/`appendFriction` | Handoff addendum Phase 2 | Ledger appends candidate event **before** `policyEngine.evaluate(entry)`, so candidate is in its own baseline. Handoff says this is a confirmed bug; live code still shows append-then-evaluate. | Correction |
| C2 | `active_policy_engine.mjs` `loadState()` default | `evaluate()` usage of `report.scale`/`mad` | Default state has `scale:0.1` but detector returns computed scale; no migration for old state missing `containment_history` array. | Bounded mechanism |
| C3 | `connection_scan.mjs` writes `runtime/quarantine/bridge_*.json` | Handoff guardrail "tests must be inert", `maintain.mjs` runs `connection:scan` | Scan writes bridges into live quarantine; `maintain` includes it indirectly via `drift`/scripts; not read-only. | Correction (test hygiene) |
| C4 | `test_active_integration.mjs` Test 3 | Handoff claimed `62acf21` incomplete | Integration test asserts anomaly via `detectFrictionAnomaly(history, anomalousEntry)` with history **excluding** candidate — passes, but real append path (C1) fails. Test does not exercise real append. | Stale test claim |
| C5 | Dashboard auto-resolve containment (handoff Phase 2) | `active_policy_engine.mjs` `resolveContainment()` | Handoff says remove dashboard auto-resolve; engine has only explicit `resolveContainment`. No live dashboard code shown, but handoff implies prior coupling existed. | Correction (deferred evidence) |
| C6 | `friction_anomaly_detector.mjs` min 5 entries | `active_policy_engine.mjs` `config.min_history_entries` default 5 | Engine passes full ledger history to detector; detector hardcodes `<5` check ignoring config `min_history_entries`. Config not plumbed to detector. | Bounded mechanism |
| C7 | Consensus language in `test_consensus_state_transitions` (safety_checks) | Handoff "no signatures/live multi-agent" | Code excludes banned phrases; aligned. No contradiction, but public commit messages must not overstate. | Presentation (truthful only after evidence) |

---

## Ranked Implementation Sequence

### 1. Inert verification harness (Correction)
- **Source:** Handoff Phase 1; `connection_scan.mjs` writing quarantine; `maintain.mjs` orchestration.
- **Live evidence needed:** `connection_scan.mjs` creates `runtime/quarantine/bridge_*.json` on run; `maintain` can invoke state-writing scripts.
- **Reversible boundary:** Add `check`/`--dry-run` flag to `connection_scan.mjs`; `maintain.mjs` uses it. No live runtime writes in CI/test.
- **Stop condition:** `connection_scan` with `--check` writes zero files; `maintain` green without mutations.
- **Confidence:** High.

### 2. Exclude candidate from baseline in real append (Correction — critical)
- **Source:** C1; handoff critical confirmed issue; `friction_ledger.mjs` lines `appendFileSync` then `policyEngine.evaluate(entry)`.
- **Live evidence needed:** Five severity-2 once entries + one severity-10 chronic via `appendFriction` triggers `containment_active=true` and `isWriteSuspended()===true`.
- **Reversible boundary:** Modify `evaluate()` to accept `historyOverride` excluding candidate, or read ledger then append then evaluate with pre-append slice. Keep `vetoQuarantinedBridges` side-effect.
- **Stop condition:** Real append path yields threshold; `check_active_policy_state.mjs` still passes for cross-instance freshness.
- **Confidence:** High.

### 3. Plumb `min_history_entries` and config validation (Bounded mechanism)
- **Source:** C6; `active_policy_engine.mjs` `loadConfig()` no min-history pass to detector.
- **Live evidence needed:** Detector uses `this.config.min_history_entries` not hardcoded 5; unit test with config=3 triggers on 3 entries.
- **Reversible boundary:** Add param to `detectFrictionAnomaly(history, newEntry, opts)`; default fallback to 5.
- **Stop condition:** Config-driven threshold honored; old tests updated.
- **Confidence:** Medium-High.

### 4. State shape migration & low-variance scale policy (Bounded mechanism)
- **Source:** C2; `loadState()` default lacks `containment_history:[]` guarantee for pre-existing state files.
- **Live evidence needed:** State file missing `containment_history` loads as `[]`; `scale===0` fallback in detector documented and tested.
- **Reversible boundary:** `loadState()` merges defaults; detector fallback kept.
- **Stop condition:** No undefined access on old state; fallback unit in `test_active_integration.mjs`.
- **Confidence:** High.

### 5. Decouple consensus from containment (Correction)
- **Source:** C5; handoff Phase 2 "remove dashboard auto-resolve".
- **Live evidence needed:** No code path calls `resolveContainment()` from consensus signoff; grep shows only explicit operator route.
- **Reversible boundary:** Delete any UI handler; keep `resolveContainment()` explicit.
- **Stop condition:** Containment only cleared by operator action with reason logged.
- **Confidence:** Medium (no dashboard code in context).

### 6. Bridge lifecycle hardening (Bounded mechanism)
- **Source:** Handoff Phase 5; `vetoQuarantinedBridges` uses `status!=="vetoed"`.
- **Live evidence needed:** Quarantine file with `approved_by_operator:false` vetoed on containment; exact ID format from `getBridgeId` validated.
- **Reversible boundary:** Add path containment + atomic write in `vetoQuarantinedBridges`.
- **Stop condition:** Integration test with temp quarantine dir passes.
- **Confidence:** High.

### 7. Dashboard route registry & read-only first (Presentation/Experiment)
- **Source:** Handoff Phase 4; not in provided code, deferred.
- **Live evidence needed:** Route registry file exists; loopback cookie tests pass.
- **Reversible boundary:** Separate operator mutation routes.
- **Stop condition:** After Phases 1–6 merged.
- **Confidence:** Low (out of current context).

---

## Acceptance Criteria (must precede full-suite testing)
1. `appendFriction` with 5 normal + 1 chronic anomaly triggers containment (C1 fixed).
2. `ActivePolicyEngine` excludes candidate from baseline in evaluate path.
3. `min_history_entries` from config used by detector.
4. `loadState` tolerates missing `containment_history`.
5. `connection_scan.mjs --check` writes no files.
6. `check_active_policy_state.mjs` passes (cross-instance freshness).
7. `test_active_integration.mjs` Test 3 uses real append or is relabeled.
8. No test writes to live `runtime/` without injected temp path.

---

## Evidence Required Before Push
- Green `scripts/check_active_policy_state.mjs` on temp paths.
- Green isolated friction append fixture (5+1) proving containment.
- `git log` of active-policy fix shows one mechanism per commit.
- `connection_scan --check` stdout only, `runtime/quarantine` mtime unchanged.
- Public commit message: "Fix active-policy baseline to exclude candidate event" — only after fixture passes.
- No README/HUD claim of "cryptographic consensus" or "auto-resolve" without code.

---

## Deferred Ideas and Why
- **HUD unified view (Phase 6):** Depends on backend route contract; presentation only after mechanism proof.
- **MDS projection caching (Test 4):** Works in excerpt; not contradictory; defer promotion until dashboard needs it.
- **Simulation as time-travel:** Handoff says relabel as path-isolated telemetry; `scenario_simulator.mjs` not in context; defer.
- **Accepted-bridge ingestion:** Explicitly excluded by handoff Phase 3B; memory graph only stopword/zone fixes.
- **WebGPU/Houdini claims:** No measured need; deferred per guardrail.

---

## Final Verdict
The active-policy plan is **narrowed to a safe sequence**: first make verification inert (C3), then correct the candidate-in-baseline defect in the real append path (C1, critical), then plumb config and harden state/bridge mechanics (C2, C6, C5). Full-suite testing is **not** safe until Phases 1–2 are evidenced by isolated fixtures. The `62acf21` checkpoint is a partial proof of state freshness only; claims of completed active-policy semantics are **stale** until the append-path fix is committed with passing fixture evidence. Public-progress messages must state "containment baseline corrected" only after the 5+1 append test is green.