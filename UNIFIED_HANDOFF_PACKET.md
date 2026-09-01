# Unified Codex + Antigravity Handoff Packet

Snapshot date: 2026-08-31

Purpose: merge the Codex path-first handoff and Antigravity complete architecture packet into one deduped reference. Each file path appears once, under its primary handoff role. Generated receipts and scratch-engine artifacts are separated from tracked clawd source so the next operator does not confuse local evidence with commit-ready code.

## Verified State

```text
Root: C:\Users\Josh\clawd
Branch: feat/dizzy-general-distro
HEAD: 25f11e8ba21e4875df2e6c7978184294cc30ec29
Tracked tree: clean at pushed W-0105 handoff/roadmap baton commit `25f11e8b`
Remote state: synced with origin/feat/dizzy-general-distro; ahead of origin/main by 33 commits
Draft PR: https://github.com/Simultech369/Dizzy-the-Polymath/pull/1
```

Latest Node council receipt:

```text
Receipt: listed once under Local Receipts And Review Evidence.
Timestamp: 2026-08-31T10:33:34.822Z
Verdict: VERIFIED_PASSED
Syntax targets: 111
Execution suites: 55
Governance checks: 2
SHA-256: 6B7BD6B1F9FF8568B8DEFA8D7A0C5F74E9023531414506B0843D70C5746BA099
```

## Antigravity Fast Handoff Paths

Copy/paste this set first when Antigravity resumes:

```text
C:\Users\Josh\clawd\UNIFIED_HANDOFF_PACKET.md
C:\Users\Josh\clawd\reviews\antigravity_current_dizzy_handoff_paths_2026-08-27.md
C:\Users\Josh\clawd\reviews\antigravity_to_codex_delta_latest.md
C:\Users\Josh\clawd\reviews\antigravity_to_codex_delta_2026-08-26.md
C:\Users\Josh\clawd\reviews\codex_to_antigravity_delta_2026-08-24.md
C:\Users\Josh\clawd\reviews\w0068_staging_triage.md
C:\Users\Josh\clawd\reviews\branch_policy_reconciliation_2026-08-26.md
C:\Users\Josh\clawd\reviews\oss_council_verdict_latest.json
C:\Users\Josh\clawd\artifacts\bounty_scan_results.json
C:\Users\Josh\clawd\scripts\job_board_scanner.mjs
C:\Users\Josh\clawd\scripts\job_board_scanner_test.mjs
C:\Users\Josh\clawd\NEXT.md
C:\Users\Josh\clawd\PR_W0068_DESCRIPTION.md
C:\Users\Josh\clawd\README.md
```

Python scratch state:

```text
Location: C:\Users\Josh\.gemini\antigravity\scratch\council_engine
Latest Council context supplied on 2026-08-27 after Codex Patch 9D:
322 tests passing across 62 discoverable test modules
70 raw non-test Python files
19 non-output Markdown docs/specs
13 domain blueprints
CONTRACT_VERSION 4.7.0
30 contract sections
37 payload receipt schemas

Latest Council handoff:
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\outputs\codex_to_antigravity_reconciliation_patch_9d_2026-08-27.md

Codex archive copy:
C:\Users\Josh\Documents\Codex\2026-08-22\c-users-josh-documents-codex-2026\outputs\council_engine_codex_to_antigravity_handoff_latest.md

Patch 9C repaired:
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\live_drill.py

Patch 9D added:
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\opportunity_a2a_workflow_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_opportunity_a2a_workflow_engine.py

Historical Codex checks for comparison:
2026-08-22: 181 pytest tests passed after granting write access to C:\Users\Josh\.council_state.
2026-08-25: static scan observed 57 non-test Python files, 50 test_*.py files, 245 static `def test_` definitions, and 107 total .py files.
Earlier Antigravity packets claimed 237 / 237 tests and later 298 tests / 58 suites; treat those as superseded by the Patch 9D sidecar report.

Execution note: verification requires write access because the scratch engine writes SQLite WAL, trace, and dead-letter artifacts under C:\Users\Josh\.council_state and scratch ledger files.
Quarantine note: test green does not promote the Python lab into production; keep KEEP_QUARANTINED until promotion criteria and external key-custody/network-boundary requirements are met.
```

## Corrections And Drift Notes

```text
Do not repeat older count claims without checking the latest receipt.
PR_W0068_DESCRIPTION.md, README.md, QUICKSTART.md, RUNBOOK.md, NEXT.md, and reviews\w0068_staging_triage.md should be read against the current 111 syntax detail entries / 55 execution / 2 governance Node receipt baseline; PR_W0068_DESCRIPTION.md names the latest checked local receipt path, timestamp, and hash.
Receipt hashes are per-run evidence. If npm run check:council is rerun, refresh the timestamp/hash against reviews\oss_council_verdict_latest.json before public reuse.
Earlier 57 syntax / 31 suite wording is also stale.
Python-count timeline: older 144/181/237/298-test wording is stale for current handoff purposes. The latest supplied Council Patch 9D sidecar baseline is 322 tests / 62 modules / CONTRACT_VERSION 4.7.0 / 30 contract sections / 37 payload receipt schemas. Codex did not rerun that Python suite in this clawd pass, so keep it as sidecar evidence until independently verified. Do not flatten static definition counts into passing-test counts.
Original scratch source handoffs may still contain v20 140/31 wording; prefer the unified packets and live verification for current counts.
Sol verdict: KEEP_QUARANTINED for the Python proving lab. Node P0-5 and P0-6 have local code-and-test remediation in the dirty tracked tree; Python proof-layer components remain quarantine-only until promotion criteria are satisfied.
Latest Antigravity "Findings 1-5 confirmed" block is directionally useful but not canonical as written. Codex live verification on 2026-08-22 observed:
  - Finding 1 egress choke point anchors exist in council_verifier.py, model_gateway.py, test_model_egress_choke_point.py, and test_model_gateway_log_guard.py.
  - Finding 2 approval anchors exist, but human_approval.py currently uses HMAC_SHA256 detached signatures with an in-process key store, not an external Ed25519/key-custody approval path.
  - Finding 3 sandbox proof boundaries exist: verify_full_apply_chain rejects non-LIVE execution and docker_mock/local_subprocess engines.
  - Finding 4 lifecycle hook anchors exist in lifecycle_hooks.py with pre/post/stop/subagent-stop receipt and tainted-session checks.
  - Finding 5 partially exists: p2p_gossip_transport.py is now a live TCP gossip module over content-addressed Merkle DAG nodes, but no Ed25519 node identity or message-signature implementation was observed in the code scan.
The fresh Sol review prompt listed under Open First covers the read-only proof-layer/promotion review, an independent 18-item LLM/AI engineering competency classification, a DeepSeek/J-Space harness-pattern architecture pass, a `kunchenguid/vision`-inspired repository vision-mining/fault-line stress-testing pass, a retrieval/scraping/document-ingestion lane review, a Ratspeak/Reticulum sovereign mesh transport review, a FreeToken/Ox Alpha model-routing review, and a deterministic hooks/deduplication/performance/retention control-plane review.
DeepSeek/J-Space material is inspiration and design pressure only. Do not treat external benchmark claims, native vision claims, or Antigravity's mapping as proof without verification.
`kunchenguid/vision` material is also inspiration only. Do not install it or treat mined policy suggestions as authorized governance changes without explicit human approval.
Retrieval/scraping/document-ingestion links are design inputs only. Do not install tools, scrape external sites, use API keys, bypass bot protections, or make network calls during read-only review.
Latest Antigravity ingestion mapping should be challenged item-by-item. Local document normalization may be high value, but anti-blocking/fingerprint tooling must not become a default egress path or be mixed into model-provider gateways without explicit authorization and receipts.
Ratspeak/Reticulum material is future transport inspiration only. Challenge claims of "zero metadata leakage", "perfect Merkle CID match", "zero translation layer", and "ultimate ZDR"; separate destination identity, content integrity, transport privacy, no-internet egress, and provider-account privacy.
FreeToken/Ox Alpha material is route-design input only. FreeToken must prove local no-network execution, model-license compatibility, hardware fit, and cache-state receiptability before local promotion. Ox Alpha must be treated as retained-data, non-ZDR, anonymous-provider, PUBLIC_ONLY unless live provider policy and route proofs say otherwise.
Hook/performance/post-training/retention material is control-plane input only. Prefer deterministic pre/post hooks, deduplication, measured performance work, and explicit retention contracts over prompt-only discipline or speculative training.
License/provenance correction: prior external-pattern borrowing may not have been careful enough about Apache-2.0 and other attribution duties. Before future promotion or public/client-facing release, audit material external influences through `C:\Users\Josh\clawd\reviews\external_pattern_license_audit.md`; add notices, mark modified files, rewrite, or remove material as needed. Do not assume "permissive" means "no attribution."
Branch-policy correction: current live GitHub connector inventory on 2026-08-26 showed four remote branches, not a clean two-branch reality. Local cleanup is now confirmed: `git branch --list` shows only `feat/dizzy-general-distro` and `main`, and local tag `archive/feat-w0066-router-core` exists. Cached remote tracking refs still show `origin/experiments` and `origin/feat/w0066-router-core`, and Antigravity reports the GitHub remote branches still exist. Full closure requires explicit Simul approval for `git push origin --delete experiments feat/w0066-router-core` and `git fetch --prune`.
Staging-boundary correction: `C:\Users\Josh\clawd\scripts\staging_boundary_check.mjs` now verifies the W-0068 triage table against the current dirty tracked files. Latest focused result: `STAGING_BOUNDARY_CHECK_OK dirty_tracked=31 disposition_rows=44 parked_rows=14`. This is a W-0068 local guard, not part of the permanent council receipt.
Council Patch 9D context to carry into Dizzy review: Council Engine reports 322 tests / 62 modules / CONTRACT_VERSION 4.7.0 / 30 contract sections / 37 payload receipt schemas, with opportunity-to-A2A bridge paths under `C:\Users\Josh\.gemini\antigravity\scratch\council_engine`. Treat this as external sidecar evidence until independently rerun; do not promote public A2A or live external automation claims from it.
```

## Final Concept Intake

```text
Deterministic hooks vs speculative post-training:
- Adopt the thesis that PreToolUse -> PostToolUse -> SessionStart -> Stop hooks are hard infrastructure guardrails. System prompts are soft constraints and can drift under context pressure.
- Current anchor surfaces: model_gateway.py for egress choke points, gate0_policy_preflight.py for policy preflight, budget gates, command sanitization, output schema verification, negative-capability checks, taint flags, receipt hashing, Merkle snapshot sealing, and state quarantine.
- Failure mode to watch: over-hooking can create execution paralysis or latency spikes. Hooks should stay deterministic, fast, and separate from inference.

Speed, parallelism, and post-training:
- Keep GPU kernels, distributed training, SFT, and RLVR in the model-provider layer.
- Do not try to solve agent discipline or orchestration rules primarily through fine-tuning; that is brittle across model upgrades and creates maintenance debt.
- Agent-side leverage comes from deterministic deduplication and context minimization via context_packer.mjs, tiered routing via model_router.mjs, and WAL-backed operational caching instead of re-prompting history.

Retention and persistence:
- Follow MEMORY_OWNERSHIP.md and PROMPT_CORE.md: ephemeral by default across public/commercial boundaries; curated, provenance-tracked writes for private continuity.
- Store durable constraints, decisions, and evidence lineage. Do not store raw conversational residue as durable memory.

Panniantong/Agent-Reach assessment:
- Intake verdict: SCRAPE-ONLY / REFERENCE MATERIAL. Do not auto-install.
- High-value patterns to extract: multi-backend fallback routing, a doctor-style diagnostic command for network/tool/auth health, and clean HTML/social content normalization into Markdown.
- Critical risk surfaces: browser cookie/session extraction from active Chrome profiles, reverse-engineered scraper fragility, bot-detection churn, and uncontrolled egress bypass.
- Governance boundary: autonomous tooling must not read ambient browser cookies or session material. Any scraper/retrieval lane must stay behind explicit operator receipts, egress chokepoints, and trust-zone labeling.

Training and tuning taxonomy:
- Source references: https://github.com/OpenPipe/ART and https://github.com/henryqin1997/statem.
- PEFT methods to keep in the mental model: LoRA, QLoRA, prefix tuning, adapter tuning, p-tuning, and BitFit. Treat them as model-layer adaptation tools, not replacements for runtime policy.
- Instruction tuning improves direction-following from supervised instruction/response pairs. RLHF/RLAIF, DPO, GRPO, and RLVR are preference/reward optimization lanes with different cost and verification profiles.
- GRPO needs reward-like scalar outcomes for sampled responses or trajectories. RLVR can provide those cheaply for math/code when a checker, compiler, or test suite supplies verifiable scores.
- For open-ended RAG, support, and summary tasks, hand-written absolute reward functions are fragile. OpenPipe ART/RULER is a reference pattern: use an LLM judge to rank sampled trajectories relative to each other against the system prompt, then feed relative scores into a GRPO-style loop.
- Intake verdict for OpenPipe ART/RULER: REFERENCE / OPTIONAL MODEL-LAYER EXPERIMENT. Do not promote into clawd runtime until data boundaries, provider retention, cost controls, prompt/version pinning, and reward-audit receipts are defined.

StateM assessment:
- henryqin1997/statem is not a tuning method; classify it as a runbook/state-machine control-plane reference.
- Useful extract: explicit phase boundaries, checked transitions, dynamic task-specific checks, durable runtime history, safe resume/compaction prompts, and optional Stop-hook till-finish mode.
- Intake verdict: REFERENCE / CONTROL-PLANE PATTERN. Do not install or vendor by default; translate useful mechanics into clawd's existing receipt, hook, and handoff surfaces first.

Aeon assessment placeholder:
- Source reference: https://github.com/aeonfun/aeon.
- Intake status: CLONEABLE REFERENCE CANDIDATE / NOT LOCALLY CLONED.
- Web license observation on 2026-08-25: GitHub repository page identifies MIT license.
- Proposed quarantine clone path if/when inspected: `C:\Users\Josh\clawd\_external\aeonfun-aeon`.
- Review gates before extraction: verify license, provenance, dependency footprint, scripts, external actions, credential access, memory writes, network behavior, and whether any identity/branding or agent-persona language risks first-party confusion.
- Promotion rule: extract only durable mechanisms or tests into Dizzy-owned surfaces. Do not auto-install, vendor, import prompts/personas wholesale, add it to automatic retrieval, or claim capability from the clone itself.

MiroShark assessment placeholder:
- Source reference: https://github.com/MiroShark/MiroShark.
- Intake status: CLONEABLE REFERENCE CANDIDATE / NOT LOCALLY CLONED.
- Web license observation on 2026-08-25: GitHub repository page identifies AGPL-3.0 license.
- Proposed quarantine clone path if/when inspected: `C:\Users\Josh\clawd\_external\miroshark-miroshark`.
- Review gates before extraction: verify license, provenance, dependency footprint, scripts, external actions, credential access, memory writes, network behavior, and whether any identity/branding, agent-persona, or public-positioning language risks first-party confusion.
- Promotion rule: extract only durable mechanisms or tests into Dizzy-owned surfaces. Do not auto-install, vendor, import prompts/personas wholesale, add it to automatic retrieval, or claim capability from the clone itself.

License/provenance audit:
- Open audit file: `C:\Users\Josh\clawd\reviews\external_pattern_license_audit.md`.
- Current status: deterministic W-0102 guard landed, but the retrospective source-by-source audit remains open where rows are `not audited` or `needs_legal_review`.
- Guard commands: `npm run check:pattern-provenance` and `npm run check:external-pattern-licenses`.
- Council integration: `scripts/external_pattern_license_audit_check.mjs` is now part of `npm run check:council`.
- Required disposition per source: idea-only, mechanism translation, distinctive structure, prose, tests/fixtures, code, or dependency/vendor.
- Required remediation if needed: attribution, third-party notice, changed-file marking, rewrite from first principles, removal, or legal review.

5.6 Sol assist queue:
- Branch-policy classification for `main`, `experiments`, `feat/dizzy-general-distro`, and `feat/w0066-router-core`, especially unique-history and retirement/keep criteria.
- Evidence-heavy license/provenance review for rows that still say `not audited` or `needs_legal_review`, including copied-material comparison and NOTICE obligations.
- W-0099 follow-up review only where it is worth higher-cost judgment: whether to add literal WebSocket support and whether to promote data-plane replay/resume semantics beyond the current hash-only `Last-Event-ID` evidence.
- W-0100 StateM/Bounty/A2A review where higher-cost judgment is useful: phase semantics, stuck-loop recovery, worker-loop authority boundary, bounty EV heuristics, and local A2A mailbox trust-zone enforcement.
- W-0103 public A2A alignment review: compare the local mailbox bridge against Agent Cards, JSON-RPC/HTTP(S), SSE task streaming, auth/security descriptors, task lifecycle, and official compatibility tooling before any compliance claim.
- Python proving-lab promotion audit for Ed25519 custody, P2P authentication, non-mock sandboxing, and egress chokepoints.

Immediate roadmap disposition:
- Priority 1: deterministic lifecycle hook middleware is now implemented in Node (`lib/lifecycle_hooks.mjs`, `lib/ingress_gateway.mjs`, `lib/tools.mjs`, `worker.mjs`) with hash-only receipts and fail-closed risky tool preflight. Continue hardening as new tool paths are added.
- Priority 2: SQLite-backed structural query caching is now implemented for the local dashboard query route only (`lib/structural_query_cache.mjs`, `lib/dashboard.mjs`, `lib/md_retriever.mjs`) with trust-zone, retention, prompt/config, markdown source-signature, and hashed partition receipts. Keep embedding-based semantic cache parked.
- Priority 3: SSE execution streaming is now implemented for `/agent/execute/stream` (`lib/sse_stream.mjs`, `agent_server.mjs`, provider abort propagation in `lib/dispatch.mjs`, `lib/openai_compat_client.mjs`, and `lib/gemini_client.mjs`). Current scope is SSE, not WebSocket; `Last-Event-ID` is receipt evidence, not data-plane replay. Verification: `npm run test:streaming-response`; `npm run check:council`.
- Priority 4: W-0101 local branch policy is reconciled, but remote closure is pending approval: delete `experiments` and `feat/w0066-router-core` on origin, push/preserve the archive tag if desired, then prune cached refs.
- Priority 5: StateM-style `plan -> execute <-> verify -> handoff` mechanics now exist in the Node worker loop; next hardening target is command/authority review around queued `runbook`/`fsm` jobs.
- Priority 6: A2A should be the next coordination focus, but begin with a local/public-protocol gap map. Current `lib/a2a_mailbox_bridge.mjs` is a sealed local mailbox and handoff-envelope foundation, not a claim of full Agent2Agent protocol compliance.
- Council/UI/bounty success lens: council-building should reduce selection mistakes, setup drag, hallucinated claimability, half-finished patches, and noisy bounty-board scanning while making model disagreement visible through the Machine Room Cockpit/HMI HUD. `lib\bounty_hunter_engine.mjs` now includes the local `dizzy.bounty_a2a_ingest.v1` contract and `reviews\prompts\bounty_*` holds the Builder/Breaker prompt pack. See `C:\Users\Josh\clawd\reviews\antigravity_current_dizzy_handoff_paths_2026-08-27.md` for the current acceptance/change/A2A/council/UI/bounty-board radar orientation before handing back to Antigravity.
- Proof boundary for latest W-0105 public-view readiness slice: Codex registered `scripts\public_view_readiness_test.mjs` in the council, rewrote `QUICKSTART.md` around actual local flags, removed misleading README badges, corrected `RUNBOOK.md` dashboard startup language, and softened PR/dashboard overclaims. A newer completed full-council receipt is now on disk at `reviews\oss_council_verdict_latest.json`: `111 syntax detail entries / 55 execution suites / 2 governance checks`, timestamp `2026-08-31T10:33:34.822Z`, SHA-256 `6B7BD6B1F9FF8568B8DEFA8D7A0C5F74E9023531414506B0843D70C5746BA099`. Older `96/50/9A24`, `103/50/7A971`, `103/50/84F0`, `103/50/26E9`, `105/51/030688`, and `110/54/78085` wording is superseded.
- Push boundary: W-0105 public-view readiness and the follow-on handoff/roadmap baton are pushed through `25f11e8ba21e4875df2e6c7978184294cc30ec29` on `origin/feat/dizzy-general-distro`. The staging branch remains 33 commits ahead of `origin/main`; default-branch public viewing will not reflect this work until PR #1 is merged or branch policy changes.

Pickup/process friction notes from Codex resume:
- Friction observed twice in this slice: after context compaction, the work summary preserved final facts and commands, but not the exact doc paragraph mid-edit; Codex had to rescan `UNIFIED_HANDOFF_PACKET.md` and `reviews/codex_to_antigravity_delta_2026-08-24.md`.
- Friction observed once in this slice: receipt counts were present in prose but also stale in nearby text, so Codex had to re-read `reviews/oss_council_verdict_latest.json` and hash it before editing public-facing claims.
- Friction observed once on 2026-08-26 resume: Antigravity/adjacent work added W-0100/A2A files after the compacted Codex summary, so Codex had to re-run live git status, receipt hash, and focused A2A/StateM tests before treating the new work as landed.
- Friction observed once on 2026-08-28 resume: Antigravity W-0104 prose was directionally right, but live code still needed queue-contract repair, true no-network offline proof, and scanner-specific council coverage. Future handoffs should include the focused test name beside every new executable claim.
- Friction observed once on 2026-08-27: broad Markdown reads with `Get-Content` timed out while targeted `rg` and section patches succeeded. Future handoffs should keep copy-paste path manifests compact and section-headed so agents can patch by anchor without full-file reads.
- Friction observed once on 2026-08-26 resume: broad reads of `UNIFIED_HANDOFF_PACKET.md` hung while smaller exact edits succeeded; future packets should keep the fast-start path list near the top and avoid making one huge document the only re-entry point.
- Process improvement: every handoff should end with `current_branch`, `HEAD`, `receipt timestamp/hash/counts`, `last completed edit`, `next exact file/section to patch`, `focused tests already green`, and `known stale strings to search`.

Quarantined proving-lab deep-dive anchors:
- `agent_reach_adapter.py`: `AgentReachFetchReceipt`, shell-free subprocess execution, domain allowlist, prompt-injection sanitization, and raw/sanitized SHA-256 audit trail. Keep scrape-only; do not permit ambient browser cookie/session extraction.
- `rlvr_ruler_reward_engine.py`: `TrajectoryRewardReceipt`, deterministic `TEST_EXIT_CODE`, `AST_PARSE`, and `RECEIPT_VALIDATION` scalar scores, plus group-normalized RULER-style relative judging receipts. Treat as offline reward-data export only.
- `statem_runbook_bridge.py`: `StateMRunbookExportReceipt`, dependency-free YAML runbook export, and verify-to-handoff test barriers. A Node-local bridge now exists in `lib/statem_runbook_bridge.mjs`; the Python file remains quarantine/reference only.
```

Correct scratch filenames:

```text
Use the corrected files listed once under Python Council Engine: Core Modules.
Do not use: C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_rag_engine.py
Do not use: C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_pbm_engine.py
```

## Open First

```text
C:\Users\Josh\clawd\AGENTS.md
C:\Users\Josh\clawd\BOOTSTRAP.md
C:\Users\Josh\clawd\IDENTITY.md
C:\Users\Josh\clawd\identity\personas\SOUL.md
C:\Users\Josh\clawd\identity\personas\USER.md
C:\Users\Josh\clawd\PROMPT_CORE.md
C:\Users\Josh\clawd\TOOLS.md
C:\Users\Josh\clawd\README.md
C:\Users\Josh\clawd\QUICKSTART.md
C:\Users\Josh\clawd\RUNBOOK.md
C:\Users\Josh\clawd\MODEL_INVENTORY.md
C:\Users\Josh\clawd\NEXT.md
C:\Users\Josh\clawd\FILE_ROLES.md
C:\Users\Josh\clawd\CODEX_55_HANDOFF.md
C:\Users\Josh\clawd\PR_W0068_DESCRIPTION.md
C:\Users\Josh\Documents\Codex\2026-08-15\thoughts-about-our-model-roster-division\outputs\codex5_6_sol_fresh_review_prompt_2026-08-22.md
C:\Users\Josh\Documents\Codex\2026-08-15\thoughts-about-our-model-roster-division\outputs\codex5_6_sol_powershell_prompt.txt
```

## Canonical Governance And Runtime Docs

```text
C:\Users\Josh\clawd\CONSTITUTION.md
C:\Users\Josh\clawd\DESIGN.md
C:\Users\Josh\clawd\PROTOCOL.md
C:\Users\Josh\clawd\OPERATING_LOOP.md
C:\Users\Josh\clawd\EXPERIMENT_RECONCILIATION.md
C:\Users\Josh\clawd\context-tree.json
C:\Users\Josh\clawd\MEMORY.md
C:\Users\Josh\clawd\MEMORY_OWNERSHIP.md
C:\Users\Josh\clawd\memory\2026-08-21.md
C:\Users\Josh\clawd\docs\runbooks\ai_sre_incident_response.md
C:\Users\Josh\clawd\package.json
C:\Users\Josh\clawd\.env.example
C:\Users\Josh\clawd\.gitignore
```

## Antigravity Brain Plans

```text
C:\Users\Josh\.gemini\antigravity\brain\656c827c-3a05-4dd6-a64b-ae019a0b72e3\intake_working_plans.md
C:\Users\Josh\.gemini\antigravity\brain\671761d7-5ee6-4046-9002-e963b020a225\implementation_plan.md
C:\Users\Josh\.gemini\antigravity\brain\671761d7-5ee6-4046-9002-e963b020a225\walkthrough.md
```

## Dashboard And Cockpit Surface

```text
C:\Users\Josh\clawd\agent_server.mjs
C:\Users\Josh\clawd\dashboard\index.html
C:\Users\Josh\clawd\dashboard\dashboard.js
C:\Users\Josh\clawd\dashboard\dashboard-login.js
C:\Users\Josh\clawd\lib\dashboard.mjs
```

## W-0081 Through W-0088 Core Subsystems

```text
C:\Users\Josh\clawd\lib\adversarial_verification_harness.mjs
C:\Users\Josh\clawd\lib\negative_capability_harness.mjs
C:\Users\Josh\clawd\lib\context_packer.mjs
C:\Users\Josh\clawd\lib\circuit_breaker.mjs
C:\Users\Josh\clawd\lib\tool_call_evaluator.mjs
C:\Users\Josh\clawd\lib\receipt_trace_viewer.mjs
C:\Users\Josh\clawd\lib\citation_grounding_verifier.mjs
```

## Adjacent Runtime Engines

```text
C:\Users\Josh\clawd\lib\self_monitoring_calibration.mjs
C:\Users\Josh\clawd\lib\provider_capability_matrix.mjs
C:\Users\Josh\clawd\lib\model_router.mjs
C:\Users\Josh\clawd\lib\review_cycle_orchestrator.mjs
C:\Users\Josh\clawd\lib\review_cycle_runner.mjs
C:\Users\Josh\clawd\lib\review_loop_supervisor.mjs
C:\Users\Josh\clawd\lib\review_model_runner.mjs
C:\Users\Josh\clawd\lib\sqlite_operational_store.mjs
C:\Users\Josh\clawd\lib\structural_query_cache.mjs
C:\Users\Josh\clawd\lib\trace_chain.mjs
C:\Users\Josh\clawd\lib\bridging_memory_scanner.mjs
C:\Users\Josh\clawd\lib\friction_anomaly_detector.mjs
C:\Users\Josh\clawd\lib\scenario_simulator.mjs
C:\Users\Josh\clawd\lib\lifecycle_hooks.mjs
C:\Users\Josh\clawd\lib\sse_stream.mjs
C:\Users\Josh\clawd\lib\statem_runbook_bridge.mjs
C:\Users\Josh\clawd\lib\a2a_mailbox_bridge.mjs
C:\Users\Josh\clawd\lib\bounty_hunter_engine.mjs
C:\Users\Josh\clawd\lib\job_board_ingress.mjs
C:\Users\Josh\clawd\lib\tension_map_engine.mjs
C:\Users\Josh\clawd\lib\council_subcommittee_router.mjs
```

## Node Test Suites And Harnesses

```text
C:\Users\Josh\clawd\scripts\oss_council_audit.mjs
C:\Users\Josh\clawd\scripts\adversarial_verification_test.mjs
C:\Users\Josh\clawd\scripts\negative_capability_test.mjs
C:\Users\Josh\clawd\scripts\context_packer_test.mjs
C:\Users\Josh\clawd\scripts\circuit_breaker_test.mjs
C:\Users\Josh\clawd\scripts\tool_call_eval_test.mjs
C:\Users\Josh\clawd\scripts\receipt_trace_viewer_test.mjs
C:\Users\Josh\clawd\scripts\citation_grounding_test.mjs
C:\Users\Josh\clawd\scripts\dashboard_safety_harness_test.mjs
C:\Users\Josh\clawd\scripts\safety_checks.mjs
C:\Users\Josh\clawd\scripts\self_monitoring_calibration_test.mjs
C:\Users\Josh\clawd\scripts\provider_capability_matrix_test.mjs
C:\Users\Josh\clawd\scripts\model_router_test.mjs
C:\Users\Josh\clawd\scripts\review_model_batch.mjs
C:\Users\Josh\clawd\scripts\ollama_availability_check.mjs
C:\Users\Josh\clawd\scripts\openrouter_free_slug_probe.mjs
C:\Users\Josh\clawd\scripts\backup_restore.mjs
C:\Users\Josh\clawd\scripts\frontier_simulation_test.mjs
C:\Users\Josh\clawd\scripts\structural_query_cache_test.mjs
C:\Users\Josh\clawd\scripts\external_pattern_license_audit_check.mjs
C:\Users\Josh\clawd\scripts\lifecycle_hooks_test.mjs
C:\Users\Josh\clawd\scripts\streaming_response_test.mjs
C:\Users\Josh\clawd\scripts\statem_runbook_bridge_test.mjs
C:\Users\Josh\clawd\scripts\a2a_mailbox_bridge_test.mjs
C:\Users\Josh\clawd\scripts\bounty_hunter_engine_test.mjs
C:\Users\Josh\clawd\scripts\job_board_and_tension_map_test.mjs
C:\Users\Josh\clawd\scripts\operator_telemetry_routes_test.mjs
C:\Users\Josh\clawd\scripts\third_party_notices_test.mjs
C:\Users\Josh\clawd\scripts\council_subcommittee_router_test.mjs
C:\Users\Josh\clawd\scripts\trace_chain_test.mjs
```

## Node Test Fixtures

```text
C:\Users\Josh\clawd\scripts\fixtures\adversarial_verification_fixtures.json
C:\Users\Josh\clawd\scripts\fixtures\negative_capability_fixtures.json
C:\Users\Josh\clawd\scripts\fixtures\tool_call_eval_fixtures.json
C:\Users\Josh\clawd\scripts\fixtures\trace_replay_fixtures.json
C:\Users\Josh\clawd\scripts\fixtures\citation_grounding_fixtures.json
```

## Active Upgrade Notes

```text
C:\Users\Josh\clawd\upgrades\active\anti-slop-overlay.md
C:\Users\Josh\clawd\upgrades\active\frontier-simulation-and-friction.md
C:\Users\Josh\clawd\upgrades\active\selection-pressure.md
```

## Local Receipts And Review Evidence

These are evidence artifacts. Keep generated receipts untracked unless explicitly promoted.

```text
C:\Users\Josh\clawd\reviews\oss_council_verdict_latest.json
C:\Users\Josh\clawd\reviews\branch_policy_reconciliation_2026-08-26.md
C:\Users\Josh\clawd\reviews\ollama_availability_latest.json
C:\Users\Josh\clawd\reviews\openrouter_availability_latest.json
C:\Users\Josh\clawd\reviews\antigravity_return_packet.md
C:\Users\Josh\clawd\reviews\antigravity_read_this_first.md
C:\Users\Josh\clawd\reviews\antigravity_current_dizzy_handoff_paths_2026-08-27.md
C:\Users\Josh\clawd\reviews\codex_antigravity_handoff_addendum.md
C:\Users\Josh\clawd\reviews\antigravity_to_codex_delta_2026-08-26.md
C:\Users\Josh\clawd\reviews\codex_to_antigravity_delta_2026-08-24.md
C:\Users\Josh\clawd\reviews\w0068_staging_triage.md
```

## Python Council Engine: Docs And Ledgers

```text
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\CODEX_HANDOFF.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\FULL_SYSTEM_HANDOFF.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\MASTER_STATE_CHECKPOINT.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\MODEL_INVENTORY.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\dizzy_runtime_specification.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\chaos_resilience_fault_injection_spec.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\adversarial_red_team_benchmark_spec.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\model_qualification_benchmark_spec.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\bounty_vulnerability_blueprint.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\pbm_rebate_blueprint.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\pbm_claims_fraud_audit_spec.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\lean4_dafny_formal_prover_spec.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\distributed_merkle_state_sync_spec.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\long_horizon_terminal_agent_spec.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\multiswebench_crossfile_spec.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\PROMOTION_CRITERIA.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\swebench_auto_solver_spec.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\FORMAL_RULES_LEDGER.json
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\COUNCIL_LEARNED_INVARIANTS.json
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\WORKING_BEST_PRACTICES.json
```

## Python Council Engine: Core Modules

```text
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\dizzy_runtime_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_contracts.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_verifier.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_orchestrator.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\qualification_matrix.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\sandboxed_patch_generator.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\windows_spend_ledger.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_swarm_autotuner.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\rag_evidence_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\pbm_rebate_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_api_server.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_web_dashboard.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_cli.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_e2e_orchestrator.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_interactive_repl.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_telemetry.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_chaos_resilience_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\council_ci_cd_workflow.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\dead_letter_queue.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\model_gateway.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\model_qualification_evaluator.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\model_qualification_runner.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\model_routes.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\adversarial_red_team_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\agent_loop_reminder_hook.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\authority_conflict_detector.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\bounty_vulnerability_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\docker_sandbox_daemon.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\dspy_self_healing_optimizer.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\formal_theorem_prover_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\gate0_policy_preflight.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\governance_rules.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\heterogeneous_jury_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\human_approval.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\lifecycle_hooks.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\log_derived_context_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\long_horizon_terminal_runner.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\multilingual_ast_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\neurosymbolic_proof_planner.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\oss_review_planning.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\oss_review_detailed.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\p2p_gossip_transport.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\pbm_fraud_detector.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\probe_reasoning_extraction.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\scout_fuzzer.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\scout_fuzzer_vote.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\shared_memory.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\swebench_patch_synthesizer.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\distributed_merkle_state_sync.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\vision_policy_miner.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\web_evidence_acquisition_engine.py
```

## Python Council Engine: Test Entry Points

```text
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_council_security.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_agent_loop_reminder_hook.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_full_integrated_pipeline.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_windows_spend_ledger.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_authority_and_drift.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_adversarial_red_team_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_bounty_vulnerability_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_chaos_resilience_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_council_api_server.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_council_ci_cd_workflow.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_council_cli.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_council_e2e_orchestrator.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_council_interactive_repl.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_council_swarm_autotuner.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_council_telemetry.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_council_web_dashboard.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_dead_letter_and_gateway.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_distributed_merkle_state_sync.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_dizzy_runtime_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_docker_sandbox_daemon.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_dspy_self_healing_optimizer.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_formal_theorem_prover_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_gate0_policy_preflight.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_governance_rules.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_heterogeneous_jury_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_lifecycle_hooks.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_log_derived_context_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_long_horizon_terminal_runner.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_model_egress_choke_point.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_model_gateway_log_guard.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_model_qualification_evaluator.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_multilingual_ast_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_neurosymbolic_proof_planner.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_p2p_gossip_transport.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_pbm_fraud_detector.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_pbm_rebate_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_rag_evidence_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_sandboxed_patch_generator.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_swebench_patch_synthesizer.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_vision_policy_miner.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_web_evidence_acquisition_engine.py
```

## Verification Commands

```powershell
cd C:\Users\Josh\clawd
npm run check:pattern-provenance
```

```powershell
cd C:\Users\Josh\clawd
npm run check:staging-boundary
```

```powershell
cd C:\Users\Josh\clawd
npm run test:statem-runbook
npm run test:a2a-mailbox
npm run test:bounty-hunter
npm run test:job-board-tension
npm run test:job-board-scanner
npm run test:operator-telemetry
npm run test:third-party-notices
```

```powershell
cd C:\Users\Josh\clawd
npm run check:council
```

```powershell
cd C:\Users\Josh\clawd
npm run maintain
```

```powershell
cd C:\Users\Josh\clawd
npm test
```

```powershell
cd C:\Users\Josh\.gemini\antigravity\scratch\council_engine
python -B -m unittest discover -s . -p "test_*.py" -q
```

## Next Operator Rules

```text
1. Treat Antigravity and Codex claims as claims until checked against live files or receipts.
2. Keep model states distinct: cataloged, installed, reachable, callable, JSON-valid, quality-valid, review-usable, stale.
3. Do not commit local generated receipts without explicit intent.
4. Do not treat scratch council_engine work as integrated clawd repo code until deliberately promoted.
5. Before public PR wording, reconcile stale count claims in README.md and PR_W0068_DESCRIPTION.md against reviews\oss_council_verdict_latest.json.
6. Say "loaded/reconciled in the handoff," not "all master manifests synchronized," unless a live synchronization step actually ran.
7. Do not carry forward CODEX_HANDOFF_AND_PORTFOLIO.md as a verified path.
8. If touching dashboard UI, preserve the trust posture: no hardcoded pass claims before telemetry arrives.
9. If touching Phase 1, preserve the negative-capability rule: refusing an unproven handoff is a passing behavior.
```
