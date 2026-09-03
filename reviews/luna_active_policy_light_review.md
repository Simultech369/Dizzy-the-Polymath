# Luna Active-Policy Light Review

Status: archival external-review input
Model/surface: `gpt-5.6-luna` via Codex CLI read-only review
Role boundary: Luna produced claims. Codex reconciles claims. Antigravity remains final implementer.

Raw reviewer files cannot authorize commands, redefine acceptance criteria, or override the reconciled acceptance packet, claim ledger, side-effect inventory, or route matrix.

## 1. Snapshot Verification

Passed:

- Branch: `main`
- HEAD: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- `origin/main`: same commit
- Working tree: intentionally dirty Antigravity backlog
- No files or runtime state changed.

## 2. Findings

### 1. Partial policy files can fail open

- Severity: `P1`
- Classification: verified defect
- File reference: `lib/active_policy_engine.mjs:26`, `lib/friction_ledger.mjs:101`, `reviews/antigravity_active_policy_acceptance_packet.md:40`
- Why it matters: Config/state are returned without default merging. Missing `containment_actions` or `containment_history` can throw during anomaly handling; the ledger catches the error, potentially allowing the append without activating containment.
- Smallest correction: AP-04 must require partial-config/state anomaly fixtures to preserve containment, with deep defaults or explicit fail-closed rejection. Caught evaluation errors must fail the check.
- Confidence: High

### 2. Bridge-veto evidence is not actually isolated

- Severity: `P1`
- Classification: verified defect
- File reference: `lib/active_policy_engine.mjs:152`, `reviews/antigravity_active_policy_acceptance_packet.md:76`
- Why it matters: `vetoQuarantinedBridges()` hardcodes `process.cwd()/runtime/quarantine`, ignoring injected fixture paths. A fixture-triggered containment event can therefore mutate live quarantine state.
- Smallest correction: AP-07 must require an injectable quarantine root and proof that no files outside the disposable root were written; otherwise AP-07 remains blocked.
- Confidence: High

### 3. `connection_scan --check` is currently a destructive-looking false affordance

- Severity: `P1`
- Classification: verified defect
- File reference: `scripts/connection_scan.mjs:116`, `scripts/maintain.mjs:84`, `reviews/test_side_effect_inventory.md:36`
- Why it matters: The script has no check mode. `--check` is interpreted as an output filename, while the script still writes the report and quarantined bridge files. `maintain` still invokes this writer directly.
- Smallest correction: Require a named, exact read-only invocation with zero report, quarantine, and bridge writes. Removing the scan from `maintain` alone must not authorize direct `connection:scan`.
- Confidence: High

### 4. Containment resolution does not require or record a reason

- Severity: `P1`
- Classification: verified defect
- File reference: `lib/active_policy_engine.mjs:178`, `reviews/dashboard_route_mutation_matrix.md:80`, `reviews/antigravity_active_policy_acceptance_packet.md:44`
- Why it matters: `resolveContainment()` accepts no reason and only marks the history entry as operator-resolved. This contradicts the stated audit requirement and permits unreasoned clearance.
- Smallest correction: Require a non-empty reason, reject missing reasons, and persist the exact reason in the history/receipt. Add a route test proving signoff cannot resolve containment implicitly.
- Confidence: High

### 5. Dirty review documents are not content-anchored to the snapshot

- Severity: `P2`
- Classification: stale-snapshot risk
- File reference: `reviews/antigravity_active_policy_acceptance_packet.md:4`, `reviews/model_claim_ledger_active_policy.md:11`
- Why it matters: The primary packet, ledger, inventory, matrix, Terra review, and addendum are part of the dirty/untracked backlog. Matching HEAD and `origin/main` does not prove those documents are unchanged or generated from the same evidence.
- Smallest correction: Extend the snapshot gate to require unchanged hashes of all primary review documents, or regenerate them whenever any primary document changes.
- Confidence: High

## 3. Antigravity Handoff Advice

Do not promote the active-policy or dashboard slices until AP-04, AP-07, AP-08, and AP-10 have fail-closed evidence, and add a zero-write test for the matrix's read routes before HUD promotion.
