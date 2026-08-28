# Model Claim Ledger: Active Policy

Status: first reviewer cycle partially completed
Role boundary: models produce claims; Codex reconciles claims; Antigravity implements accepted fixes.

Precedence: raw external-review artifacts are archival claim inputs only. They cannot authorize commands, redefine acceptance criteria, or override the reconciled acceptance packet, this ledger, or the side-effect inventory.

## Snapshot

- Branch: `main`
- HEAD: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- Origin/main: `62acf21b5a0f5e4d811cc9cebb6536931457933b`
- Dirty tree: intentionally dirty Antigravity backlog plus review-cycle docs/artifacts; do not clean, stash, reset, or reorganize.

## Provenance Log

| Source | Model/Lens | Run Surface | Prompt | Files Supplied | Output | Provider Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Cohere | `cohere/north-mini-code:free` | OpenRouter via `scripts/openrouter_review.py` | `reviews/prompts/cohere-active-policy-review.md` | active-policy context list | `reviews/cohere_active_policy_review.md` | completed |
| Qwen | `qwen/qwen3-32b` | OpenRouter via `scripts/openrouter_review.py` | `reviews/prompts/qwen-active-policy-review.md` | active-policy context list | none | failed 402 payment required |
| Qwen lens | `openrouter/free` | OpenRouter via `scripts/openrouter_review.py` | `reviews/prompts/qwen-active-policy-review.md` | active-policy context list | `reviews/qwen_lens_active_policy_review.md` | completed after long quiet period; actual backend model not pinned |
| DeepSeek | `deepseek/deepseek-chat-v3.1:free` | OpenRouter via `scripts/openrouter_review.py` | `reviews/prompts/deepseek-active-policy-review.md` | active-policy context list | none | failed 404 free route unavailable |
| Hy3 | `tencent/hy3:free` | OpenRouter via `scripts/openrouter_review.py` | `reviews/prompts/hy3-active-policy-review.md` | active-policy context list | `reviews/hy3_active_policy_review.md` | completed |
| Terra | `gpt-5.6-terra` | Codex CLI read-only review | user-provided PowerShell prompt | planning artifacts plus optional route/test code | `reviews/terra_destructive_cleanup_review.md` | completed; no files edited by Terra |
| Luna | `gpt-5.6-luna` | Codex CLI read-only review | `reviews/prompts/luna-active-policy-light-review.md` | planning artifacts plus targeted code inspection | `reviews/luna_active_policy_light_review.md` | completed; no files edited by Luna |
| Hy3 final handoff lens | `tencent/hy3:free` | OpenRouter via `scripts/openrouter_review.py` after explicit Simul upload approval | `reviews/prompts/final-handoff-authority-rag-review.md` | final handoff packet only | `reviews/hy3_final_handoff_authority_rag_review.md` | completed |
| Cohere final handoff lens | `cohere/north-mini-code:free` | OpenRouter via `scripts/openrouter_review.py` after explicit Simul upload approval | `reviews/prompts/final-handoff-authority-rag-review.md` | final handoff packet only | `reviews/cohere_final_handoff_authority_rag_review.md` | completed; route needs enough output budget to avoid reasoning-only null content |

## Claims

| Source | Claim | Classification | Live Evidence | Disposition | Acceptance Criterion | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| Cohere | Real append path includes the candidate event in its own anomaly baseline. | verified defect | `appendFrictionSync` writes before `ActivePolicyEngine.evaluate`; Cohere requests real 5 normal + 1 anomaly fixture. | accept | Real append API fixture must prove candidate exclusion and containment activation. | Antigravity |
| Cohere | `min_history_entries` is not honored by detector. | verified defect | Detector hardcodes minimum history behavior; config value is not plumbed. | accept | Detector or engine must honor configured minimum history with focused tests. | Antigravity |
| Cohere | Older config/state shapes need default merge or migration. | verified defect | `loadState`/`loadConfig` can return parsed objects missing expected keys. | accept | Missing required fields load with safe defaults. | Antigravity |
| Cohere | Low-variance scale fallback should be explicit policy. | plausible risk | Detector fallback exists but is not a named/configured policy. | accept as criterion, not design mandate | Define and test the low-variance scale policy. | Antigravity |
| Hy3 | `connection_scan` writes quarantine state and must become inert before full-suite/maintain use. | verified defect | `connection_scan.mjs` writes `runtime/quarantine/bridge_*.json`; maintain path can invoke scans. | accept | Add read-only/check mode or remove state-writing scan from maintain until inert. | Antigravity |
| Hy3 | `test_active_integration` proves detector math but not the real append path. | stale test claim | Test passes history excluding candidate directly; real ledger path differs. | accept | Relabel or replace with real append fixture. | Antigravity |
| Qwen lens | Route/session tests must exercise real loopback login-cookie flow before dashboard mutation. | plausible risk | Review claims current mocks bypass route contract; live dashboard route file was not fully supplied in this run. | defer pending route-context review | Add to route/mutation matrix and verify with full route context before implementation. | Codex |
| Qwen lens | Atomic writes/file locking may be needed for shared state and quarantine. | plausible risk | Review points to sync/non-atomic writes; concurrency evidence not yet reproduced. | defer as bridge lifecycle criterion | Include atomic write/locking acceptance criteria in bridge lifecycle phase. | Antigravity |
| Terra | `check:active-policy` writes and deletes cwd temp files and should not be listed as acceptable. | verified defect | `scripts/check_active_policy_state.mjs` uses cwd `temp-active-policy-*` paths; side-effect inventory previously called it acceptable. | accept | Hold until injected disposable root and cleanup report exist. | Antigravity |
| Terra | Raw model artifacts can conflict with the reconciled safety sequence. | policy disagreement | Qwen lens asks for maintain/safety/connection-scan as matrix checks while inventory holds them until inert. | accept | Raw reviewer files are archival inputs only; acceptance packet and inventory control. | Codex |
| Terra | Generic operator execution needs the same mutation boundary as delete/prune. | verified defect | Route matrix marked `/api/operator-execute` high-impact but did not require preview/exact target/confirmation/receipt. | accept | Any mutating execution payload requires preview, confirmation, exact targets, reversibility class, and durable receipt. | Antigravity |
| Luna | Partial active-policy config/state can fail open if missing nested fields cause evaluation errors that `appendFrictionSync` catches. | verified defect | `loadConfig` and `loadState` return parsed objects without default merging; `appendFrictionSync` logs and continues on policy evaluation failure. | accept | Partial config/state anomaly fixtures must preserve containment via deep defaults or explicit fail-closed rejection; evaluation errors must fail focused checks. | Antigravity |
| Luna | Bridge veto is not isolated because `vetoQuarantinedBridges` hardcodes `process.cwd()/runtime/quarantine`. | verified defect | `vetoQuarantinedBridges()` resolves cwd `runtime/quarantine` instead of an injected quarantine root. | accept | AP-07 requires injectable quarantine root plus pre/post proof that no files outside the disposable root were written. | Antigravity |
| Luna | `connection_scan --check` is a false affordance because the script treats it as an output filename and still writes quarantine bridges. | verified defect | `connection_scan.mjs` reads `process.argv[2]` as output path and always writes `runtime/quarantine`; `maintain` invokes the writer directly. | accept | Define an exact read-only invocation that creates no report, quarantine, or bridge files; direct `connection:scan` stays held until that invocation exists. | Antigravity |
| Luna | Containment resolution lacks a required reason and does not record one. | verified defect | `resolveContainment()` takes no parameter and only marks last history entry as operator-resolved. | accept | Missing/empty reason is rejected; exact reason is persisted in containment history or receipt; signoff cannot resolve containment implicitly. | Antigravity |
| Luna | Dirty primary review docs are not content-anchored to the snapshot. | stale-snapshot risk | Packet, ledger, inventory, matrix, Terra review, addendum, and newer review notes are dirty/untracked planning surfaces. | accept as process guardrail | Record or regenerate primary document hashes whenever the planning packet is handed off; hash mismatch stops reuse. | Codex |
| Codex | Primary review documents now have point-in-time SHA256 hashes for handoff reuse checks. | process evidence | `reviews/primary_review_document_hashes.md` records hashes after Luna reconciliation. | accept | Antigravity handoff must compare these hashes or regenerate the packet before reuse. | Codex |
| Hy3 final handoff lens | Role boundaries could look like hidden maintainer discretion if read as public governance. | wording risk | Handoff packets name Simul, Codex, and Antigravity roles. | accept as wording guardrail | Clarify that roles describe the local handoff workflow and do not create standing authority or public governance. | Codex |
| Hy3 final handoff lens | "Proves" public-checkpoint wording can sound too absolute without attached evidence command. | public-overclaim risk | `reviews/antigravity_return_packet.md` and public wording drafts used proof/proving language. | accept | Prefer demonstrates, validates, or evidence language for public-facing copy. | Codex |
| Cohere final handoff lens | Held commands can read as monolithic process unless newly inert focused checks are explicitly allowed. | process-overgrowth risk | Current packet holds package-script invocations until exact inertness is documented. | accept as clarification | State that current invocations are held, while newly inert disposable-root focused checks may run with explicit side-effect receipts. | Codex |
| Hy3/Cohere final handoff lens | RAG taxonomy is useful inspiration but should not enter the first Antigravity implementation slice. | scope risk | Final review prompt included RAG taxonomy and both reviewers kept it outside the first slice. | accept | Treat RAG as a later retrieval/auditability lens only; it blocks nothing in active-policy correction. | Codex |

## Contradictions

- Cohere suggests filtering candidate inside `ActivePolicyEngine.evaluate`; Qwen lens suggests evaluating before append. Both address the same defect. Disposition: accept the invariant, leave implementation choice to Antigravity.
- Qwen lens suggests async I/O and file locks before dashboard promotion; Hy3 ranks inert tests and candidate exclusion first. Disposition: accept atomicity as lifecycle hardening, but do not let broad async refactor block the narrow active-policy correction unless Antigravity finds a real concurrency failure.

## Accepted Antigravity Criteria

- Make verification inert before full-suite or maintain promotion.
- Prove active-policy containment through the real friction append API with isolated fixtures.
- Exclude the candidate event from its own baseline.
- Honor configured minimum history and threshold.
- Validate or migrate config/state shape.
- Fail closed when active-policy evaluation errors would otherwise be caught and ignored.
- Define and test low-variance scale behavior.
- Decouple consensus signoff from containment resolution.
- Require injected quarantine root proof for bridge veto tests.
- Require a non-empty containment resolution reason and recorded receipt/history.
- Content-anchor dirty primary review documents or regenerate them before handoff reuse.

## Deferred Ideas

- Full async I/O refactor.
- Route registry implementation details until a route/mutation matrix is reconciled against full dashboard/server context.
- HUD/accessibility work until backend route and mutation boundaries are proven.
- Running held commands as validation gates before the side-effect inventory classifies the exact invocation as inert.

## Provider/Run Failures

- Initial external-upload attempt was blocked until operator explicitly approved uploading only the listed active-policy context files.
- Qwen pinned model `qwen/qwen3-32b` failed with 402 payment required.
- Qwen free variant `qwen/qwen3-32b:free` failed with 404 unavailable for free.
- DeepSeek free variant `deepseek/deepseek-chat-v3.1:free` failed with 404 unavailable for free.
- OpenRouter/free Qwen-lens substitute completed, but actual backend model was not pinned.
- A diagnostic process-inspection attempt hung while investigating the generic free route delay; no repo files were changed by that diagnostic.
