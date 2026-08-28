# Codex -> Antigravity Delta Ledger

Status: active low-credit handoff ledger
Date: 2026-08-24
Repository: `C:\Users\Josh\clawd`
Current branch observed by Codex: `feat/dizzy-general-distro`
Current `HEAD` observed by Codex: `c4300eaee587a6f055dc25dedeaaa5957b7af7ea`
Branch relation observed by Codex: ahead of `origin/feat/dizzy-general-distro` by 17 commits

This file records what changed after the latest Antigravity handoff/calibration so the return handoff can be reconstructed without relying on chat memory.

## 2026-08-26 Supersession Note

This file remains useful for W-0098/W-0099/W-0101/W-0102 provenance, but it is no longer the freshest handoff surface. Before acting on counts or next-slice advice, read:

- `C:\Users\Josh\clawd\UNIFIED_HANDOFF_PACKET.md`
- `C:\Users\Josh\clawd\reviews\antigravity_to_codex_delta_latest.md`
- `C:\Users\Josh\clawd\reviews\antigravity_to_codex_delta_2026-08-26.md`
- `C:\Users\Josh\clawd\reviews\w0068_staging_triage.md`
- `C:\Users\Josh\clawd\reviews\oss_council_verdict_latest.json`

Latest local receipt now observed by Codex: `105 syntax detail entries / 51 execution suites / 2 governance checks`, timestamp `2026-08-28T03:10:46.075Z`, SHA-256 `7A85640464336AAA9A1E6EBCF3B7FD93DE36CA8AC921FE3CB46A3C5298AB6F61`.

## Starting Claim To Reconcile

Antigravity's latest W-0068/Council Engine calibration treated the Node council as staging-ready and the Python `council_engine` proving lab as green but quarantined.

Carry these boundaries forward:

- Node receipts are evidence for the local Node runtime only.
- Python scratch remains `KEEP_QUARANTINED` until independent promotion gates pass.
- Passing scratch pytest counts do not authorize production promotion.
- Do not carry forward `CODEX_HANDOFF_AND_PORTFOLIO.md` as a verified path.
- Treat old packet wording such as "all master manifests synchronized" as "loaded/reconciled in the handoff" unless live state is rechecked.

## Current Node Receipt

Superseded W-0099 receipt retained for provenance:

- Path: `C:\Users\Josh\clawd\reviews\oss_council_verdict_latest.json`
- Timestamp: `2026-08-26T09:34:52.844Z`
- Verdict: `VERIFIED_PASSED`
- Syntax: 89 targets
- Governance: 2 checks
- Execution: 43 deterministic suites
- SHA-256: `FCFDCFE38E226F95B7455F561360CB8D5E1FABE0457E1861808BB39B10C63454`

The receipt hash is per-run evidence. If `npm run check:council` is rerun, refresh the timestamp/hash before using this packet publicly.

Antigravity reported an intermediate W-0102 receipt on 2026-08-26 with 85 syntax targets, 42 execution suites, and SHA-256 `3F88F1BC3785590A1F035C02CB436886905B16B9A5A44D6BFC1DAC38F48AB51D`. Codex tightened the ledger schema afterward, then landed W-0099 streaming response hardening and reran the local council. The 89/43 `FCFD...3454` receipt above superseded both the 3F88 and later 18DB local receipt claims for this checkout, and is itself superseded by the 2026-08-28 W-0104 scanner receipt listed in the supersession note.

## Codex Delta Since Antigravity Calibration

### W-0098: Structural Query Cache

Implemented a narrow SQLite-backed structural cache for the local dashboard query surface before any embedding-based semantic cache.

Primary files:

- `C:\Users\Josh\clawd\lib\structural_query_cache.mjs`
- `C:\Users\Josh\clawd\lib\dashboard.mjs`
- `C:\Users\Josh\clawd\lib\md_retriever.mjs`
- `C:\Users\Josh\clawd\scripts\structural_query_cache_test.mjs`
- `C:\Users\Josh\clawd\scripts\safety_checks.mjs`
- `C:\Users\Josh\clawd\scripts\oss_council_audit.mjs`
- `C:\Users\Josh\clawd\package.json`

Behavior:

- Cache keys include route, projection, trust zone, retention scope, query hash, prompt/config hash, markdown source signature, and hashed partition.
- Raw query text, excerpts, local paths, and client partition strings are not persisted.
- `private_self` and `trusted_collaborator` can persist only under local/conversation scopes.
- `paid_public + conversation_only` requires an explicit partition key and is isolated by hashed partition.
- `ephemeral` is not persisted.
- The cache is non-authoritative and degrades to recomputation if `node:sqlite` is unavailable.
- Runtime shutdown now closes optional dashboard sidecars so safety checks do not hang on SQLite handles.

Verification run by Codex:

- `npm run test:structural-query-cache`
- `npm run test:dashboard-safety`
- `npm run verify:bm25`
- `npm run eval:retrieval-integrity`
- `npm run test:replay-safety`
- `npm run check:production`
- `npm run check:dependencies`
- `npm run check:safety`
- `npm run check:docs`
- `npm run check:next`
- `node scripts/test_active_integration.mjs`
- `npm run check:context-tree`
- `npm run check:council`

Known verification caveats:

- `npm run check:production` still reports the known yellow gap that runtime rate limiting is documented but not implemented as middleware.
- `npm run check:context-tree` warns that `context-tree.json` is a reachable snapshot, not current `HEAD`.
- `git diff --check` passed with only the known warning that `memory/2026-08-21.md` will normalize CRLF to LF when Git next touches it.
- A fresh rotating `review:supervise` attempt timed out before writing a new supervisor receipt. Do not claim a fresh supervisor pass for W-0098.

### W-0099: SSE Streaming Response Hardening

Implemented an authenticated SSE execution surface beside the stable JSON `/agent/execute` route.

Primary files:

- `C:\Users\Josh\clawd\agent_server.mjs`
- `C:\Users\Josh\clawd\lib\sse_stream.mjs`
- `C:\Users\Josh\clawd\lib\dispatch.mjs`
- `C:\Users\Josh\clawd\lib\openai_compat_client.mjs`
- `C:\Users\Josh\clawd\lib\gemini_client.mjs`
- `C:\Users\Josh\clawd\scripts\streaming_response_test.mjs`
- `C:\Users\Josh\clawd\scripts\oss_council_audit.mjs`
- `C:\Users\Josh\clawd\package.json`

Behavior:

- `POST /agent/execute/stream` emits SSE `stream_receipt`, `agent_result` or `agent_error`, then terminal `stream_receipt` events.
- The scoped execute token now authorizes both `/agent/execute` and `/agent/execute/stream`; administrative routes still require the master operator token.
- Stream IDs are deterministic when `Idempotency-Key` is present. `Last-Event-ID` is hashed into receipts for traceability but is not yet a data-plane replay cursor.
- Backpressure waits are bounded by `DIZZY_STREAM_DRAIN_TIMEOUT_MS`.
- Client disconnects abort OpenAI-compatible and Gemini provider calls via caller-propagated abort signals.
- Stream receipts use `authority: "stream_evidence_not_authority"` and store body hashes, structural keys, event IDs, frame counts, byte counts, reason codes, and timing only. They do not store prompts, chunks, model text, provider messages, raw idempotency keys, or raw `Last-Event-ID`.
- Result events remain the data plane and may carry the connected client's execution response.

Verification run by Codex:

- `node --check lib\sse_stream.mjs`
- `node --check scripts\streaming_response_test.mjs`
- `node --check agent_server.mjs`
- `node --check lib\dispatch.mjs`
- `node --check lib\openai_compat_client.mjs`
- `node --check lib\gemini_client.mjs`
- `npm run test:streaming-response`
- `npm run test:review-models`
- `npm run test:model-router`
- `npm run test:router`
- `npm run check:staging-boundary`
- `npm run check:pattern-provenance`
- `npm run check:docs`
- `npm run check:next`
- `npm run check:council`

Known verification caveats:

- No WebSocket route or dependency exists in this runtime. Do not claim WebSocket support from W-0099.
- Full SSE data-plane replay/resume is not implemented. Current reconnect support is limited to deterministic IDs and hashed `Last-Event-ID` receipt evidence.
- Stream receipt persistence defaults to `runtime/stream_receipts.jsonl` and can be disabled with `DIZZY_STREAM_RECEIPT_PATH=off`; receipts remain hash-only evidence.

### Docs And Queue Reconciliation

Updated current roadmap/proof wording around W-0098/W-0099:

- `C:\Users\Josh\clawd\NEXT.md`
- `C:\Users\Josh\clawd\README.md`
- `C:\Users\Josh\clawd\DESIGN.md`
- `C:\Users\Josh\clawd\PR_W0068_DESCRIPTION.md`
- `C:\Users\Josh\clawd\UNIFIED_HANDOFF_PACKET.md`
- `C:\Users\Josh\clawd\reviews\w0068_staging_triage.md`

Current work queue after W-0098:

- W-0091: Keep Python proving lab quarantined.
- W-0092: Assemble production launch proof packet before any hosted/client-facing claim.
- W-0093: Refresh model-roster qualification without collapsing status states.
- W-0094: Reconcile experiments one mechanism at a time.
- W-0095: Translate external concept intake into control-plane candidates only.
- W-0099: SSE execution streaming landed; literal WebSocket support remains a future API decision.
- W-0100: Bridge StateM-style four-phase runbooks into the Node worker loop.
- W-0101: Decide and reconcile GitHub branch policy.
- W-0102: Audit borrowed-pattern license and provenance exposure.

Recommended next high-value implementation slice after this W-0099 update: W-0100 StateM-style worker bridge, unless branch cleanup is explicitly approved first.

### W-0102: External Pattern Provenance Guard

Implemented a deterministic docs-only guard so borrowed-pattern provenance cannot drift silently while the retrospective audit remains open.

Primary files:

- `C:\Users\Josh\clawd\scripts\external_pattern_license_audit_check.mjs`
- `C:\Users\Josh\clawd\scripts\staging_boundary_check.mjs`
- `C:\Users\Josh\clawd\reviews\external_pattern_license_audit.md`
- `C:\Users\Josh\clawd\REFERENCE_PATTERNS.md`
- `C:\Users\Josh\clawd\FILE_ROLES.md`
- `C:\Users\Josh\clawd\.gitignore`
- `C:\Users\Josh\clawd\package.json`
- `C:\Users\Josh\clawd\scripts\oss_council_audit.mjs`

Behavior:

- Verifies the audit ledger exists and contains the required sections, crossover classes, remediation dispositions, Apache-2.0 reminder, and release gate.
- Dynamically checks that every source listed under `REFERENCE_PATTERNS.md` Reviewed sources has a row in `reviews/external_pattern_license_audit.md`.
- Keeps the 12-source carried/source-intake matrix present: Memory OS, Project Samantha, Icarus, Quarq Agent OSS, Polyxmedia Mnemos, EurekaClaw, cmxdev1 MNEMOS, Agent-Reach, ART, StateM, Aeon, and MiroShark.
- Requires borrowing class and disposition columns per row.
- Enforces quarantine language for `_ext/` and `_external/`, including the rule that clones are not automatic retrieval roots or proof of implemented capability.
- Does not fetch licenses, decide legal compliance, or mark the retrospective audit complete.

Verification run by Codex:

- `node --check scripts\external_pattern_license_audit_check.mjs`
- `node --disable-warning=ExperimentalWarning .\scripts\external_pattern_license_audit_check.mjs`
- `npm run check:pattern-provenance`
- `npm run check:external-pattern-licenses`
- `npm run check:docs`
- `npm run check:next`
- `npm run check:staging-boundary`
- `npm run check:council`

Known verification caveat:

- W-0102 is now mechanically guarded and council-integrated, but source-by-source legal/provenance audit remains open where rows are `not audited` or `needs_legal_review`.

### 5.6 Sol Assist Queue

Use 5.6 Sol selectively where broader judgment or variance reduction is worth the token spend:

- W-0101 branch-policy review: classify live branches, unique history, and whether `experiments` should remain a proving lane.
- W-0102 evidence review: compare copied material risk, exact upstream license text, NOTICE files, and whether `THIRD_PARTY_NOTICES.md` is needed.
- W-0099 follow-up review: literal WebSocket need, data-plane replay/resume semantics, and whether `Last-Event-ID` should stay receipt-only evidence or become a replay cursor.
- W-0100 StateM bridge review: phase semantics, stuck-loop recovery, and worker-loop promotion boundary.
- Python proving-lab promotion audit: Ed25519 custody, P2P signatures, non-mock sandboxing, egress chokepoints, and mock-rejection evidence.

### W-0101: Branch Policy Reconciliation

Created a non-destructive live branch inventory receipt:

- `C:\Users\Josh\clawd\reviews\branch_policy_reconciliation_2026-08-26.md`

Evidence:

- GitHub connector branch API returned four remote branches on 2026-08-26: `main`, `experiments`, `feat/dizzy-general-distro`, and `feat/w0066-router-core`.
- Direct shell `git -c http.sslBackend=openssl ls-remote --heads origin` failed from this sandbox, so connector output is the remote source for this pass.
- Local git shows this checkout is `0 behind / 17 ahead` of `origin/feat/dizzy-general-distro` at `c4300eaee587a6f055dc25dedeaaa5957b7af7ea`, with a dirty worktree.
- `npm run check:staging-boundary` verifies that `reviews/w0068_staging_triage.md` covers every current dirty tracked file. Re-run it after every local handoff edit because the dirty tracked set is still moving.

Classification:

- `main`: stable/proof-bearing target.
- `feat/dizzy-general-distro`: active W-0068 staging/PR branch. Remote compare to `main`: `ahead_by=5`, `behind_by=0`; local checkout has additional unpushed commits.
- `experiments`: stale experiment/proving lane. Remote compare to `main`: `ahead_by=0`, `behind_by=93`; no unique remote commits observed.
- `feat/w0066-router-core`: obsolete candidate/superseded staging branch. Remote compare to `main`: `ahead_by=0`, `behind_by=32`; compare from W-0066 to W-0068 shows W-0068 descends from it.

Decision:

- Keep `experiments` only if it is deliberately resynced and ledger-driven.
- Treat `feat/w0066-router-core` as an archive/delete candidate only after checking PRs, issues, and handoff references.
- Do not mutate branches until Simul explicitly approves staging/push/cleanup.

Branch policy note:

- Live read-only `git ls-remote --heads origin` check on 2026-08-25 confirmed four remote branches: `main`, `experiments`, `feat/dizzy-general-distro`, and `feat/w0066-router-core`.
- `EXPERIMENT_RECONCILIATION.md` previously framed the desired long-lived model as `main` plus `experiments`, but that should be treated as a branch-policy hypothesis to re-evaluate, not automatic cleanup authority.
- The rationale for `experiments`: it has served as a non-authoritative proving lane for BM25 extraction, dashboard route/data-access hardening, memory decay experiments, root-document migration work, paid/public boundary tests, dependency cleanup, and lockfile vulnerability upgrades.
- The argument for using `experiments` more: risky or broad mechanisms can mature there while `main` remains proof-bearing, as long as each promotion is one reviewed mechanism with tests and no wholesale merge.
- The argument for using it less or retiring it: W-0066/W-0068-style feature branches and review packets may already provide cleaner isolation; a stale `experiments` branch becomes cognitive debt.
- Do not delete branches during low-credit handoff. First fetch live GitHub state, classify branch purpose, prove unique history is merged or archived, then propose branch deletion only after Simul approval.

## Worktree Posture

Latest observed status:

- Branch: `feat/dizzy-general-distro`
- `HEAD`: `c4300eaee587a6f055dc25dedeaaa5957b7af7ea`
- Dirty tree: yes, intentionally broad.
- Do not reset, clean, stash, delete, move, or reorganize the tree as part of handoff.
- Generated/local evidence and scratch artifacts remain mixed with implementation files. Re-run `git status --short --branch` before any staging decision.

Tracked files touched across the W-0098/W-0099/W-0101/W-0102 slices include:

- `.env.example`
- `DESIGN.md`
- `NEXT.md`
- `PR_W0068_DESCRIPTION.md`
- `README.md`
- `REFERENCE_PATTERNS.md`
- `agent_server.mjs`
- `lib/dashboard.mjs`
- `lib/dispatch.mjs`
- `lib/gemini_client.mjs`
- `lib/ingress_gateway.mjs`
- `lib/md_retriever.mjs`
- `lib/openai_compat_client.mjs`
- `lib/review_model_runner.mjs`
- `lib/tools.mjs`
- `memory/2026-08-21.md`
- `package.json`
- `scripts/oss_council_audit.mjs`
- `scripts/review_model_runner_test.mjs`
- `scripts/safety_checks.mjs`
- `scripts/test_active_integration.mjs`
- `worker.mjs`

New/untracked W-0098 files:

- `lib/structural_query_cache.mjs`
- `scripts/structural_query_cache_test.mjs`

New/untracked W-0099 files:

- `lib/sse_stream.mjs`
- `scripts/streaming_response_test.mjs`

New/untracked W-0102 files:

- `scripts/external_pattern_license_audit_check.mjs`
- `scripts/staging_boundary_check.mjs`
- `reviews/external_pattern_license_audit.md`

Other dirty files and untracked review artifacts existed before or adjacent to this slice. Do not attribute every dirty path to W-0098 without checking the diff.

## Python Scratch Boundary

The Python proving lab remains reference/proving material only:

- `C:\Users\Josh\.gemini\antigravity\scratch\council_engine`

After Codex search on 2026-08-25, Antigravity scratch appeared to have advanced. This section is historical and is superseded by the current Council Patch 9D sidecar report in `C:\Users\Josh\clawd\UNIFIED_HANDOFF_PACKET.md` and `C:\Users\Josh\clawd\reviews\antigravity_current_dizzy_handoff_paths_2026-08-27.md`:

- `CODEX_HANDOFF.md` v25.0 claimed completed patches for model egress choke point, external human/execution proof boundary, deterministic lifecycle hooks, signed webhook fan-out, Ed25519 human approval custody, Ed25519 P2P gossip hardening, and OSS harness/model inventory refresh.
- `MASTER_STATE_CHECKPOINT.md` claimed `237 / 237` unittest tests passing across 50 suites.
- Codex did not rerun the Python suite in this pass.
- Codex static scan observed 107 total `.py` files, 57 non-test `.py` files, 50 `test_*.py` files, and 245 static `def test_` definitions.
- Current supplied Council Patch 9D context reports 322 tests passing across 62 discoverable test modules, 70 raw non-test Python files, 19 non-output Markdown docs/specs, 13 domain blueprints, `CONTRACT_VERSION 4.7.0`, 30 contract sections, and 37 payload receipt schemas.
- Treat Patch 9D as sidecar evidence until rerun; do not confuse static test definitions with executed test count.

Recently discussed scratch modules include:

- `agent_reach_adapter.py`
- `rlvr_ruler_reward_engine.py`
- `statem_runbook_bridge.py`
- `dizzy_runtime_engine.py`
- `long_horizon_terminal_runner.py`
- `docker_sandbox_daemon.py`

Do not auto-promote these. Agent-Reach remains scrape-only/reference due to ambient browser cookie/session risk. RLVR/RULER and StateM are useful patterns, not production runtime authority.

## External Reference Intake

New user-supplied cloneable reference candidates:

- Source: `https://github.com/aeonfun/aeon`
- Status: cloneable later, not locally cloned by Codex in this pass.
- Web license observation on 2026-08-25: GitHub repository page identifies MIT license.
- Proposed quarantine path: `C:\Users\Josh\clawd\_external\aeonfun-aeon`

- Source: `https://github.com/MiroShark/MiroShark`
- Status: cloneable later, not locally cloned by Codex in this pass.
- Web license observation on 2026-08-25: GitHub repository page identifies AGPL-3.0 license.
- Proposed quarantine path: `C:\Users\Josh\clawd\_external\miroshark-miroshark`

- Existing hygiene support: `_external/` is gitignored and classified in `FILE_ROLES.md` as local research input, not a first-party Dizzy surface or automatic retrieval root.

Antigravity/Codex intake gates before extracting anything:

- Verify license, provenance, dependency footprint, scripts, external actions, credential access, memory writes, network behavior, and any first-party confusion risk.
- Classify candidate patterns as adopt, adapt, park, or reject.
- Promote only translated mechanisms, tests, docs, or reviewed local skills into Dizzy-owned surfaces.
- Do not auto-install, vendor, import prompts/personas wholesale, add it to automatic retrieval, or claim capability from the clone itself.

License/provenance correction:

- New audit surface: `C:\Users\Josh\clawd\reviews\external_pattern_license_audit.md`
- Concern: previous external-pattern borrowing may not have carefully separated idea-level learning from copied code/prose/structure or Apache-2.0/NOTICE-style attribution duties.
- Action: before public/client-facing distribution or any new external-source promotion, classify each material source as idea-only, mechanism translation, distinctive structure, prose, tests/fixtures, code, or dependency/vendor.
- Remediation options: add attribution, create `THIRD_PARTY_NOTICES.md`, mark modified files, rewrite from first principles, remove borrowed material, or request legal review.
- Do not treat permissive licenses as attribution-free.

## Return Instructions For Antigravity

Before doing implementation:

```powershell
cd C:\Users\Josh\clawd
git branch --show-current
git rev-parse HEAD
git status --short --branch
npm run check:next
npm run check:docs
```

If Antigravity is resuming W-0068 staging rather than the older July active-policy packet, use this file plus:

- `C:\Users\Josh\clawd\UNIFIED_HANDOFF_PACKET.md`
- `C:\Users\Josh\clawd\PR_W0068_DESCRIPTION.md`
- `C:\Users\Josh\clawd\NEXT.md`
- `C:\Users\Josh\clawd\reviews\w0068_staging_triage.md`
- `C:\Users\Josh\clawd\reviews\oss_council_verdict_latest.json`

Then either:

1. Re-run `npm run check:council` and refresh receipt timestamp/hash, or
2. If credits/time are tight, do not rerun; state that the latest known receipt is the 2026-08-24 local receipt above and may be stale relative to later edits.

Do not claim a fresh rotating reviewer-supervisor pass unless `reviews/review_loop_supervisor_latest.json` has a timestamp after W-0098 and includes W-0098 files in scope.

## After-Search Coordination Recommendation

Until Antigravity credits refresh, Codex should avoid opening another implementation branch of truth. Best shared move:

1. Keep Codex in reconciliation/traffic-controller mode.
2. Let Antigravity produce candidate implementation or scratch review packets.
3. Bring Antigravity comments back to Codex as claim input.
4. Codex reconciles against live Node files, current scratch state, licenses, branches, and receipts.
5. Only then choose one implementation slice: W-0101 branch policy, W-0099 streaming, or W-0100 StateM worker bridge.
