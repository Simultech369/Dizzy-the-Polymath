# W-0068 Staging Triage

Status: active staging triage
Date: 2026-08-24
Authority: local evidence decides; model and handoff output are claim sources only

## Snapshot

Root: `C:\Users\Josh\clawd`
Branch: `feat/dizzy-general-distro`
HEAD: `c4300eaee587a6f055dc25dedeaaa5957b7af7ea`
Remote posture: ahead of `origin/feat/dizzy-general-distro` by 17 commits
Tracked state: dirty
Draft PR: `https://github.com/Simultech369/Dizzy-the-Polymath/pull/1`

Current local council receipt after the latest supervisor/council run:

```text
Receipt: reviews\oss_council_verdict_latest.json
Timestamp: 2026-08-28T03:10:46.075Z
Verdict: VERIFIED_PASSED
Syntax targets: 105
Execution suites: 51
Governance checks: 2
SHA-256: 7A85640464336AAA9A1E6EBCF3B7FD93DE36CA8AC921FE3CB46A3C5298AB6F61
```

Receipt hashes are per-run evidence. If `npm run check:council` is rerun, refresh every public-facing timestamp/hash claim before reuse.

## Tracked Diff Disposition

| File | Disposition | Reason | Required check |
| --- | --- | --- | --- |
| `agent_server.mjs` | include | Adds operator auth guard to direct local control routes and continuity export/delete/prune, closes optional dashboard sidecars during runtime shutdown, and exposes `/agent/execute/stream` as an authenticated SSE execution surface with stream receipts, event IDs, best-effort disconnect receipts, and partial-failure receipts. | `npm run test:streaming-response`; `npm run check:safety`; `npm run check:council` |
| `lib/dispatch.mjs` | include | Threads caller abort signals into chat dispatch so streaming disconnects can cancel downstream provider work instead of only stopping response writes. | `npm run test:streaming-response`; `npm run test:router`; `npm run check:council` |
| `lib/gemini_client.mjs` | include | Composes caller abort signals with provider timeouts while preserving distinct timeout versus request-aborted diagnostics. | `npm run test:streaming-response`; `npm run test:router`; `npm run check:council` |
| `lib/openai_compat_client.mjs` | include | Fails closed before the first remote fetch when local isolation is required and composes caller abort signals with provider timeouts for streamed execution disconnects. | `npm run test:review-models`; `npm run test:streaming-response`; `npm run check:council` |
| `lib/sse_stream.mjs` | include | Adds deterministic SSE frame writing, bounded drain waits, hash-only stream receipts, enum-only reason/error fields, redacted structural body keys, and evidence-not-authority receipt semantics. | `npm run test:streaming-response`; `npm run check:council` |
| `lib/sandbox_executor.mjs` | include | Adds watchdog kill timer and windowsHide on subprocess execution for deadlock-free execution in Windows and non-interactive environments. | `npm run check:safety`; `npm run check:council` |
| `scripts/openrouter_review.py` | include | Handles EOFError/KeyboardInterrupt cleanly during non-interactive destination confirmation checks. | `npm run check:safety` |
| `lib/review_model_runner.mjs` | include | Prevents private-self review loops from dispatching to remote OpenAI-compatible or Groq-style reviewers even when cloud is otherwise allowed. | `npm run test:review-models`; `npm run review:supervise -- --worktree --changed ...` |
| `lib/review_cycle_runner.mjs` | include | Ignores child stdin and keeps subprocess output bounded for deterministic review harness execution under non-interactive Windows runs. | `npm run test:review-loop`; `npm run check:council` |
| `lib/review_loop_supervisor.mjs` | include | Raises git diff/status output capacity for broad W-0068 worktrees while keeping the supervisor scoped to tracked status unless explicitly given a changed-file list. | `npm run test:review-supervisor`; `npm run check:council` |
| `scripts/review_model_runner_test.mjs` | include | Adds regression coverage proving no remote fetch under local isolation and no private-self cloud reviewer dispatch. | `npm run test:review-models` |
| `scripts/drift_scan.mjs` | include | Replaces shell-string `execSync` git revision probing with argument-vector `spawnSync`, preserving drift-scan metadata while reducing command-injection surface. | `node --check scripts\drift_scan.mjs`; `npm run check:council` |
| `scripts/safety_checks.mjs` | include | Updates continuity lifecycle tests for required operator auth, local-control auth failure coverage, and dashboard structural-cache miss/store/hit receipts. | `npm run check:safety` |
| `scripts/test_active_integration.mjs` | include | Aligns active integration calls with required operator auth while preserving local route receipt behavior. | `node scripts/test_active_integration.mjs`; `npm run check:council` |
| `lib/visual_slop_scanner.mjs` | include | Restores the W-0062b visual-surface scanner claimed by `NEXT.md`; flags private visual leaks, unsupported status claims, motion/accessibility gaps, and decorative excess deterministically. | `npm run eval:anti-slop-visual`; `npm run check:council` |
| `scripts/anti_slop_visual_fixture_check.mjs` | include | Restores the W-0062b fixture gate and prevents the package script from pointing at a missing file. | `npm run eval:anti-slop-visual`; `npm run check:council` |
| `scripts/usage_report_test.mjs` | include | Restores the W-0065a usage-report leak/schema regression test claimed by `NEXT.md`. | `node scripts/usage_report_test.mjs`; `npm run check:council` |
| `scripts/oss_council_audit.mjs` | include | Registers restored harnesses, lifecycle hooks, structural query cache, streaming response hardening, and external pattern provenance guard in the 3-layer council so receipt counts reflect the live verified surface. | `npm run check:council` |
| `lib/lifecycle_hooks.mjs` | include | Implements Node `SessionStart`, `PreToolUse`, `PostToolUse`, and `Stop` hook receipts with hash-only payload/output evidence and fail-closed risky tool preflight. | `npm run test:lifecycle-hooks`; `npm run check:council` |
| `lib/ingress_gateway.mjs` | include | Emits SessionStart/Stop lifecycle receipts around ingress requests after health exemption and before rate/budget gates. | `npm run test:ingress-gateway`; `npm run check:council` |
| `lib/tools.mjs` | include | Makes lifecycle hooks non-bypassable for all callers of the shared Node tool runner. | `npm run test:lifecycle-hooks`; `npm run check:council` |
| `worker.mjs` | include | Passes worker context into the guarded tool runner for queued jobs. | `npm run test:lifecycle-hooks`; `npm run check:council` |
| `scripts/lifecycle_hooks_test.mjs` | include | Verifies ingress SessionStart/Stop, tool Pre/Post failure receipts, risky tool rejection, and no raw query/session/command leakage in receipts. | `npm run test:lifecycle-hooks`; `npm run check:council` |
| `lib/dashboard.mjs` | include | Wraps the local dashboard query route with a minimized, receipt-keyed structural cache while preserving loopback/trust-zone guards and no-store HTTP responses. | `npm run test:dashboard-safety`; `npm run check:safety`; `npm run check:council` |
| `lib/md_retriever.mjs` | include | Exposes a trust-zone-filtered markdown source signature so cache invalidation keys include source hashes and lifecycle metadata. | `npm run eval:retrieval-integrity`; `npm run check:council` |
| `lib/structural_query_cache.mjs` | include | Implements the SQLite-backed reversible sidecar with hash-only query identity, prompt/config and source-signature keys, TTL expiry, and hashed partition enforcement. | `npm run test:structural-query-cache`; `npm run check:council` |
| `scripts/structural_query_cache_test.mjs` | include | Proves deterministic keys, miss/store/hit, prompt/source invalidation, TTL expiry, no raw query persistence, and paid-public partition isolation. | `npm run test:structural-query-cache`; `npm run check:council` |
| `scripts/streaming_response_test.mjs` | include | Proves SSE event shape, scoped execute-token auth, receipt privacy, hostile receipt-field rejection, partial-failure receipts, bounded backpressure/abort behavior, and slow-provider cancellation on client disconnect. | `npm run test:streaming-response`; `npm run check:council` |
| `.env.example` | include | Documents local dashboard structural cache controls and SSE streaming receipt/backpressure knobs without introducing new dependencies or secrets. | `npm run check:docs` |
| `DESIGN.md` | include | Clarifies that structural query caching is a narrow dashboard-query sidecar and that SSE stream receipts are evidence, not the data plane or WebSocket support. | `npm run check:docs`; `npm run check:next` |
| `EXPERIMENT_RECONCILIATION.md` | include | Corrects stale two-branch inventory wording and points at the W-0101 branch-policy receipt. | `npm run check:staging-boundary`; `npm run check:docs` |
| `NEXT.md` | include | Records W-0101/W-0102 progress without marking branch cleanup or retrospective license audit complete. | `npm run check:next`; `npm run check:staging-boundary` |
| `MODEL_INVENTORY.md` | include | W-0093 generated active model capability matrix, preserving installed/callable/json-review-usable/trust-zone distinctions rather than flattening the roster into a single readiness claim. | `node scripts/generate_model_inventory.mjs`; `npm run check:council` |
| `PRODUCTION_READINESS.md` | include | W-0092 launch ledger documenting hosted/public-readiness evidence and remaining implementation gaps without overclaiming production maturity. | `npm run check:production`; `npm run check:docs` |
| `scripts/generate_model_inventory.mjs` | include | Generates the W-0093 model inventory matrix from provider capability metadata so roster status can be refreshed deterministically. | `node --check scripts/generate_model_inventory.mjs`; `node scripts/generate_model_inventory.mjs` |
| `THIRD_PARTY_NOTICES.md` | include candidate / generated | Deterministically generated W-0102 attribution notice from `reviews/external_pattern_license_audit.md`; include if W-0102 provenance artifacts are promoted with this PR. | `node scripts/generate_third_party_notices.mjs`; `npm run test:third-party-notices` |
| `REFERENCE_PATTERNS.md` | include | Keeps external reference material bounded as inspiration/provenance input, not authority, runtime dependency, or clone-based capability proof. | `npm run check:pattern-provenance`; `npm run check:docs` |
| `reviews/external_pattern_license_audit.md` | include | Owns the W-0102 source inventory, borrowing class, disposition, license observation, quarantine path, and release-gate ledger that the deterministic guard reads. | `npm run check:pattern-provenance`; `npm run check:council` |
| `scripts/external_pattern_license_audit_check.mjs` | include | Adds the deterministic W-0102 provenance guard without fetching licenses or claiming legal compliance. | `npm run check:pattern-provenance`; `npm run check:council` |
| `scripts/staging_boundary_check.mjs` | include | Adds the W-0101 local staging-boundary guard that compares dirty tracked files to this triage table without mutating branches. | `npm run check:staging-boundary` |
| `package.json` | include | Adds `test:lifecycle-hooks`, `test:structural-query-cache`, `test:streaming-response`, `check:pattern-provenance` / `check:external-pattern-licenses`, and `check:staging-boundary` for focused operator verification. | `npm run test:lifecycle-hooks`; `npm run test:structural-query-cache`; `npm run test:streaming-response`; `npm run check:pattern-provenance`; `npm run check:staging-boundary` |
| `README.md` | include | Reconciles public count and local-control auth language to the current staging baseline. | `npm run check:docs`; `npm run check:council` |
| `PR_W0068_DESCRIPTION.md` | include | Reconciles stale count/hash claims and names receipt refresh duty. | Manual receipt-hash refresh after final council run |
| `memory/2026-08-21.md` | include if daily logs are part of this PR; otherwise park | Converts stale 69-target wording into a historical snapshot. This is low-risk, but it is operational memory rather than runtime behavior. | `git diff --check`; reviewer decision on PR scope |

## Untracked And Parked Material

| Material | Disposition | Notes |
| --- | --- | --- |
| `UNIFIED_HANDOFF_PACKET.md` | park unless explicitly promoted | Useful local baton pass, but not automatically PR-ready. |
| `reviews/branch_policy_reconciliation_2026-08-26.md` | park unless explicitly promoted | Useful W-0101 branch-policy receipt; not a runtime change and does not authorize branch cleanup. |
| `reviews/*_latest.json` generated receipts | keep local-only unless explicitly promoted | Receipts prove local evidence but should not churn git history by default. |
| W-0100/W-0103/W-0104 local control-plane candidates (`lib/statem_runbook_bridge.mjs`, `scripts/statem_runbook_bridge_test.mjs`, `lib/a2a_mailbox_bridge.mjs`, `scripts/a2a_mailbox_bridge_test.mjs`, `lib/bounty_hunter_engine.mjs`, `scripts/bounty_hunter_engine_test.mjs`, `lib/job_board_ingress.mjs`, `lib/tension_map_engine.mjs`, `scripts/job_board_and_tension_map_test.mjs`, `scripts/operator_telemetry_routes_test.mjs`, `lib/council_subcommittee_router.mjs`, `scripts/council_subcommittee_router_test.mjs`, `scripts/job_board_scanner.mjs`, `scripts/job_board_scanner_test.mjs`, `scripts/generate_third_party_notices.mjs`, `scripts/third_party_notices_test.mjs`) | include candidate / currently untracked | These are now council-covered local evidence surfaces, but they are not yet staged. A2A is a local mailbox bridge, not public Agent2Agent protocol compliance. W-0104 scanner dispatch now uses the canonical worker queue contract and has true no-network offline proof coverage. |
| `artifacts\bounty_scan_results.json` | park as local proof artifact unless explicitly promoted | Generated W-0104 mock/offline proof artifact. Useful for Antigravity/Codex reconciliation, but it should not be treated as live board coverage or automatically committed. |
| Broad `reviews/*.md` model critiques and prompt files | park as claim sources | Reconcile only specific accepted claims into code, tests, or scoped docs. |
| `.extraction/`, `.review-harness/`, `artifacts/`, `codex-bench-*`, `data/`, `scratch/` | park | Generated, experimental, or local working surfaces. |
| Python `C:\Users\Josh\.gemini\antigravity\scratch\council_engine` | keep quarantined | Includes `dizzy_runtime_engine.py`, `long_horizon_terminal_runner.py`, and `docker_sandbox_daemon.py` as proving-lab references. Green tests do not satisfy external key-custody, Ed25519 P2P, non-mock sandbox, egress, provenance, sensitivity, path-jail, or mock-rejection gates. |
| Agent-Reach/Panniantong patterns | scrape-only reference | Do not install cookie/session scraping tooling or bypass egress chokepoints. |
| ART/RULER, LoRA/QLoRA/adapters/RLHF/DPO/GRPO/RLVR/federated tuning | model-layer reference | Training lanes require bounded data, reward signal, retention boundary, rollback, cost, and reward-audit receipts before runtime relevance. |
| StateM | control-plane reference | Translate useful phase/checkpoint mechanics into existing receipts and hooks before installing or vendoring. |
| `agent_reach_adapter.py` | quarantine reference | Useful pattern: shell-free subprocess wrapper, domain allowlist, sanitized Markdown output, and raw/sanitized hash receipts. Still scrape-only and not auto-executable from Node. |
| `rlvr_ruler_reward_engine.py` | quarantine reference | Useful pattern: deterministic scalar receipts for test/AST/receipt checks and group-normalized RULER-style relative scores. Not a runtime training loop. |
| `statem_runbook_bridge.py` | quarantine reference | Useful pattern: dependency-free 4-phase runbook export with verify-to-handoff barriers. Port mechanics into Node only after lifecycle hooks are in place. |

## Roadmap Intake

Priority order from the current consensus:

1. Deterministic lifecycle hook middleware in Node (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`) is implemented for ingress and the shared tool runner; continue extending the same receipt contract to any future tool path.
2. SQLite-backed structural query cache is implemented for the local dashboard query route only; keep embedding-based semantic cache parked until broader cache boundaries and invalidation receipts are proven.
3. SSE streaming backpressure, disconnect aborts, partial-failure receipts, and reconnect-safe event IDs are implemented; literal WebSocket remains a future API decision.
4. StateM-style worker bridge for `plan -> execute <-> verify -> handoff` is implemented as local control-plane mechanics rather than a vendored dependency.
5. A2A should be the next coordination focus, starting with a local/public-protocol gap map before any SDK install, network broadcast, or spec-compliance claim.

## Rotating Review Loop Plan

Use the existing supervisor rather than ad hoc councils:

```powershell
npm run review:supervise -- --worktree --changed "PR_W0068_DESCRIPTION.md,README.md,.env.example,DESIGN.md,REFERENCE_PATTERNS.md,agent_server.mjs,lib/dashboard.mjs,lib/md_retriever.mjs,lib/openai_compat_client.mjs,lib/review_model_runner.mjs,lib/structural_query_cache.mjs,lib/visual_slop_scanner.mjs,lib/lifecycle_hooks.mjs,lib/ingress_gateway.mjs,lib/tools.mjs,worker.mjs,memory/2026-08-21.md,scripts/anti_slop_visual_fixture_check.mjs,scripts/external_pattern_license_audit_check.mjs,scripts/lifecycle_hooks_test.mjs,scripts/oss_council_audit.mjs,scripts/review_model_runner_test.mjs,scripts/safety_checks.mjs,scripts/structural_query_cache_test.mjs,scripts/test_active_integration.mjs,scripts/usage_report_test.mjs,package.json,reviews/external_pattern_license_audit.md,reviews/w0068_staging_triage.md,NEXT.md" --candidate-id "W-0068-staging" --max-reviewers 6 --max-harnesses 6 --timeout-ms 240000 --min-reviews-for-push 0 --no-require-disagreement --include-receipt-harnesses --write --write-history
```

Guardrails:

- Keep `trust_zone` at `private_self`.
- Do not pass `--execute-models` or `--allow-cloud` for dirty code without an explicit packet approval.
- Treat the supervisor's reviewer selection as coverage rotation only.
- Treat generated receipts as local evidence, not commit-ready artifacts.
- If a harness fails, patch the smallest implicated surface and rerun the focused harness before rerunning the full council.

## Final Verification Sequence

Run in this order after edits settle:

```powershell
npm run test:review-models
npm run check:safety
node scripts/test_active_integration.mjs
node scripts/lifecycle_hooks_test.mjs
node scripts/usage_report_test.mjs
npm run eval:anti-slop-visual
npm run check:pattern-provenance
npm run check:staging-boundary
npm run check:docs
npm run test:statem-runbook
npm run test:a2a-mailbox
npm run test:bounty-hunter
npm run test:job-board-tension
npm run test:operator-telemetry
npm run test:third-party-notices
npm run review:supervise -- --worktree --changed "PR_W0068_DESCRIPTION.md,README.md,REFERENCE_PATTERNS.md,agent_server.mjs,lib/openai_compat_client.mjs,lib/review_model_runner.mjs,lib/visual_slop_scanner.mjs,lib/lifecycle_hooks.mjs,lib/ingress_gateway.mjs,lib/tools.mjs,worker.mjs,memory/2026-08-21.md,scripts/anti_slop_visual_fixture_check.mjs,scripts/external_pattern_license_audit_check.mjs,scripts/lifecycle_hooks_test.mjs,scripts/oss_council_audit.mjs,scripts/review_model_runner_test.mjs,scripts/safety_checks.mjs,scripts/test_active_integration.mjs,scripts/usage_report_test.mjs,package.json,reviews/external_pattern_license_audit.md,reviews/w0068_staging_triage.md,NEXT.md" --candidate-id "W-0068-staging" --max-reviewers 6 --max-harnesses 6 --timeout-ms 240000 --min-reviews-for-push 0 --no-require-disagreement --include-receipt-harnesses --write --write-history
npm run check:council
```

After `npm run check:council`, refresh:

- `PR_W0068_DESCRIPTION.md`
- `README.md` counts, if counts change
- `UNIFIED_HANDOFF_PACKET.md`, if retained as local baton
- this triage note's receipt block

## Done Condition

- Tracked W-0068 include set is intentionally scoped.
- Generated receipts and scratch artifacts remain local unless explicitly promoted.
- Python remains `KEEP_QUARANTINED`.
- Public PR language matches the latest local receipt timestamp/hash.
- Rotating review/council output is captured as evidence without external upload or model-output authority drift.
