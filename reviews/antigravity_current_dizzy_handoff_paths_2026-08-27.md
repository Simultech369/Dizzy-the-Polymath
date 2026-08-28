# Antigravity Current Dizzy Handoff Paths

Status: current path-first handoff for Dizzy/clawd
Date: 2026-08-27
Repository: `C:\Users\Josh\clawd`
Branch: `feat/dizzy-general-distro`
HEAD: `c4300eaee587a6f055dc25dedeaaa5957b7af7ea`
Remote posture: ahead of `origin/feat/dizzy-general-distro` by 17 commits

Latest Node council receipt observed locally:

```text
C:\Users\Josh\clawd\reviews\oss_council_verdict_latest.json
Verdict: VERIFIED_PASSED
Timestamp: 2026-08-28T03:10:46.075Z
Syntax detail entries: 105
Execution suites: 51
Governance checks: 2
SHA-256: 7A85640464336AAA9A1E6EBCF3B7FD93DE36CA8AC921FE3CB46A3C5298AB6F61
```

Latest focused handoff gates:

```text
npm run check:staging-boundary -> STAGING_BOUNDARY_CHECK_OK dirty_tracked=31 disposition_rows=44 parked_rows=14
npm run check:docs -> DOC_REFERENCE_CHECK_OK
npm run check:next -> NEXT_CONSISTENCY_OK checked=0
```

## Superseded Receipt Packet Corrections

Treat these as historical/intermediate evidence only unless explicitly discussing chronology:

```text
87 syntax targets / 44 execution suites / A2B7FB1DF0C52319187E68BAB78AEF80F1257AC87389E89C7021404E50166679
88 syntax targets / 45 execution suites / FCA25A8164A408DC543848CB2B17456F697E0C1B1EED46D28E5F81FC17398971
89 syntax targets / 46 execution suites / 31F5A90B50FC0B5E6D86E5B7099A4623D3FB1B49EED611B133C76DD1EEE60A31
91 syntax targets / 47 execution suites / 7DAE5666583DF9C21CDF5EFFD0647E033DB82B9872F995B088ADCAC7755E6C31
94 syntax targets / 49 execution suites / C1F675F60BD82BACADF065B696B9A81865C372EBCF0AC10DA87C53865DF54CDC
96 syntax targets / 50 execution suites / 9A24BDB2DB23B482226D7E6D98491E9DA33BAD6D9C7CFE514851BD49AD34C893
103 syntax detail entries / 50 execution suites / 7A971C4C43E760E24348E7E01D9F56F598471B63F1EC21F47F7C689C1EE0EA73
103 syntax detail entries / 50 execution suites / 84F0ADB44F62B52A6887DB276195EBE6DFE1F951988E137D077F12AF1172E5D0
103 syntax detail entries / 50 execution suites / 26E9CA009A6DCFDE6F34BE2E4684CACB43671896F1931789A54A75C5FAC1C2C0
105 syntax detail entries / 51 execution suites / 0306884186089F67138EF1514AC7297C344E159347FEE42F623EF03DFC56F983
```

Current local truth for Dizzy/clawd:

```text
StateM focused suite: npm run test:statem-runbook -> 8/8 tests passed
Added hardening: verification command allowlist rejects shell strings
W-0104 scanner focused suite: npm run test:job-board-scanner -> 5/5 tests passed
Full council receipt on disk: 105 syntax detail entries / 51 execution suites / 2 governance checks
Full council timestamp: 2026-08-28T03:10:46.075Z
Full council SHA-256: 7A85640464336AAA9A1E6EBCF3B7FD93DE36CA8AC921FE3CB46A3C5298AB6F61
```

W-0100 remains completed, but it is now part of a wider local control-plane bundle that also includes bounty EV triage, A2A-style local mailbox handoff packets, job-board normalization, tension-map telemetry, third-party notice generation, the W-0103 council subcommittee router, and the W-0104 bounty-board scanner.

## Antigravity 3.1 Pro Intake, Codex-Checked

Latest Antigravity claim packet landed directionally correctly, with these local corrections:

```text
W-0092 Production Readiness Ledger:
  C:\Users\Josh\clawd\PRODUCTION_READINESS.md
  npm run check:production -> green wiring across 11 readiness areas.
  Prior yellow rate-limit wording is superseded: runtime rate limiting is wired through ingress middleware and documented in the launch ledger.

W-0093 Dynamic Model Capability Matrix:
  C:\Users\Josh\clawd\MODEL_INVENTORY.md
  C:\Users\Josh\clawd\scripts\generate_model_inventory.mjs
  node --check scripts\generate_model_inventory.mjs -> PASS
  Treat installed/callable/json_review_usable states as separate evidence tiers.

W-0102 External Pattern License & Provenance:
  C:\Users\Josh\clawd\scripts\check_licenses.mjs
  C:\Users\Josh\clawd\reviews\external_pattern_license_audit.md
  C:\Users\Josh\clawd\scripts\generate_third_party_notices.mjs
  C:\Users\Josh\clawd\scripts\third_party_notices_test.mjs
  C:\Users\Josh\clawd\THIRD_PARTY_NOTICES.md
  node scripts\generate_third_party_notices.mjs --write -> THIRD_PARTY_NOTICES_OK sources=12 sha256=F802901EB6487B6230D3A02CEE79C93BC1FC05E4748306CF7FF87572E8F4F4C0
  npm run test:third-party-notices -> ALL TESTS PASSED CLEANLY
```

Proof-boundary corrections for this packet:
- `THIRD_PARTY_NOTICES.md` was not present until Codex ran the generator with `--write`; it now exists locally.
- `NEXT.md` had duplicate W-0102 completed entries; Codex merged them into one.
- Live GitHub license lookup via `scripts\check_licenses.mjs` remains Antigravity-reported in this Codex pass; Codex syntax-checked the script but did not request network access to rerun it.
- Job-board/tension focused suite is now 7/7, not the earlier 5/5.
- Current full-council receipt is `7A85640464336AAA9A1E6EBCF3B7FD93DE36CA8AC921FE3CB46A3C5298AB6F61`, not the intermediate `7DAE`, `C1F675`, `9A24`, `7A971`, `84F0`, `26E9`, or `030688` receipts.
- Proof dossier exists at `C:\Users\Josh\clawd\reviews\proof_dossier_2026-08-27.md`, not root `proof_dossier.md`.
- Local branch cleanup is confirmed locally: `git branch --list` shows only `feat/dizzy-general-distro` and `main`.
- Local archive tag exists: `archive/feat-w0066-router-core`.
- Remote tracking refs still show `origin/experiments` and `origin/feat/w0066-router-core`; Antigravity reports the GitHub remote branches still exist. Full closure requires explicit Simul approval for `git push origin --delete experiments feat/w0066-router-core` and then `git fetch --prune`.
- `reviews\proof_dossier_2026-08-27.md` contains some visible control-character corruption in path strings. Prefer the corrected paths in this handoff when copying to another agent.

## Council Engine Patch 9D Intake For Dizzy

Council Engine context supplied from the Council conversation for Dizzy/clawd review:

```text
Council root:
C:\Users\Josh\.gemini\antigravity\scratch\council_engine

Reported Council baseline after Codex Patch 9D:
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
```

Dizzy meaning:
- Treat Council as a verification/delegation sidecar, not as production authority inside clawd.
- Do not assume public A2A routes are live. A2A remains token-gated/in-process unless proven otherwise.
- Opportunity scouting can route into signed A2A tasks, but not live external automation or public submission.
- Next integration should focus on role boundaries: debugger, security reviewer, test writer, bounty scout, handoff auditor, and final decision owner.
- Delay 5.6 Sol unless exposing public A2A routes, promoting uncensored/abliterated models, automating bounty filings/PRs, borrowing license-sensitive code, or adding a new contract section.

## Read First

```text
C:\Users\Josh\clawd\reviews\antigravity_current_dizzy_handoff_paths_2026-08-27.md
C:\Users\Josh\clawd\UNIFIED_HANDOFF_PACKET.md
C:\Users\Josh\clawd\reviews\antigravity_to_codex_delta_2026-08-26.md
C:\Users\Josh\clawd\reviews\codex_to_antigravity_delta_2026-08-24.md
C:\Users\Josh\clawd\reviews\w0068_staging_triage.md
C:\Users\Josh\clawd\reviews\branch_policy_reconciliation_2026-08-26.md
C:\Users\Josh\clawd\reviews\oss_council_verdict_latest.json
C:\Users\Josh\clawd\NEXT.md
C:\Users\Josh\clawd\PR_W0068_DESCRIPTION.md
C:\Users\Josh\clawd\README.md
```

## Current Dizzy Runtime Sources

```text
C:\Users\Josh\clawd\agent_server.mjs
C:\Users\Josh\clawd\worker.mjs
C:\Users\Josh\clawd\package.json
C:\Users\Josh\clawd\.env.example
C:\Users\Josh\clawd\lib\dispatch.mjs
C:\Users\Josh\clawd\lib\openai_compat_client.mjs
C:\Users\Josh\clawd\lib\gemini_client.mjs
C:\Users\Josh\clawd\lib\model_router.mjs
C:\Users\Josh\clawd\lib\provider_capability_matrix.mjs
C:\Users\Josh\clawd\lib\review_model_runner.mjs
C:\Users\Josh\clawd\lib\review_cycle_runner.mjs
C:\Users\Josh\clawd\lib\review_loop_supervisor.mjs
C:\Users\Josh\clawd\lib\sqlite_operational_store.mjs
C:\Users\Josh\clawd\lib\trace_chain.mjs
```

## W-0097 Through W-0103 Active Surfaces

```text
C:\Users\Josh\clawd\lib\lifecycle_hooks.mjs
C:\Users\Josh\clawd\lib\structural_query_cache.mjs
C:\Users\Josh\clawd\lib\sse_stream.mjs
C:\Users\Josh\clawd\lib\statem_runbook_bridge.mjs
C:\Users\Josh\clawd\lib\a2a_mailbox_bridge.mjs
C:\Users\Josh\clawd\lib\bounty_hunter_engine.mjs
C:\Users\Josh\clawd\lib\job_board_ingress.mjs
C:\Users\Josh\clawd\lib\tension_map_engine.mjs
C:\Users\Josh\clawd\lib\council_subcommittee_router.mjs
C:\Users\Josh\clawd\lib\sandbox_executor.mjs
```

A2A boundary: `lib\a2a_mailbox_bridge.mjs` is a local sealed mailbox and handoff-envelope foundation. Do not claim public Agent2Agent protocol compliance yet. W-0103 should map gaps against Agent Cards, JSON-RPC/HTTP(S), SSE task streaming, auth/security descriptors, task lifecycle, and official compatibility tooling before any external A2A claim.

Current A2A references for the gap map:

```text
https://a2aproject.github.io/A2A/latest/specification/
https://github.com/a2aproject/a2a-js
```

## Council And Machine Room UI Intake

Treat this as product/architecture orientation, not independent proof of live model quality:

```text
The multi-model council is the intended division of labor for Dizzy: a local-first orchestration kernel routes work across specialized reviewer roles, preserves dissent, and turns model disagreement into operator-visible risk frontiers instead of flattening every pass into bland consensus.

Core runtime anchors:
- Trust zones, ingress gateway, and deterministic lifecycle hooks define the orchestration kernel.
- Review cycle orchestration, review synthesis, and council subcommittee routing define rotating model/harness review.
- Circuit breakers, AI SRE diagnostics, StateM runbook FSMs, and receipt traces define self-repair and failure visibility.

Subcommittee strategy:
- Formal logic/code: Qwen/Coder-style reviewers for syntax, algorithmic rigor, and patch reasoning.
- Adversarial reasoning/privacy: DeepSeek/R1-style reviewers for boundary stress and non-sycophantic critique.
- Anti-theater/pragmatism: Zero/Llama/local reviewers for terse actionable output and fluff removal.
- Offline continuity/satellites: OpenClaude/Ollama/free-code lanes for sovereign, low-cost, or air-gapped execution.
- Frontend governance/UI: Gemma/OpenClaude-style reviewers for layout, accessibility, and design-system discipline.
- Governance drift/coherence: Kimi/long-context reviewers for semantic drift across durable docs.

Proof boundary:
- Do not claim every named model is currently installed, callable, JSON-valid, quality-valid, or review-usable without fresh roster receipts.
- Do not claim all 48 cataloged models run on every prompt. The intended pattern is rotating subcommittees plus deterministic harness gates.
- Preserve minority dissent and tension maps as evidence. Do not let consensus language erase real disagreement.
```

UI direction: Machine Room Cockpit / HMI three-pane HUD.

```text
Zone A: telemetry and lanes
- live circuit breakers
- latency/cost/trust gauges
- anti-slop/realness meters
- memory sieve and WAL state

Zone B: consensus and tension map
- multi-model validator chain
- pluralistic tension grid
- dissent preservation
- operator signoff/veto

Zone C: A2A command and proofs
- agent stream for Codex/Antigravity/subagents
- StateM phase status
- cryptographic receipt ledger
- quarantine and external-pattern fences
```

UI proof boundary:

```text
The cockpit aesthetic should show transparent deliberation, cryptographic receipts, stress-aware bounded panes, and A2A topology. It should not imply invisible autonomy, public A2A compliance, live external broadcasting, or model readiness that has not passed the evidence ladder.
```

## Verification Harnesses

```text
C:\Users\Josh\clawd\scripts\oss_council_audit.mjs
C:\Users\Josh\clawd\scripts\safety_checks.mjs
C:\Users\Josh\clawd\scripts\lifecycle_hooks_test.mjs
C:\Users\Josh\clawd\scripts\structural_query_cache_test.mjs
C:\Users\Josh\clawd\scripts\streaming_response_test.mjs
C:\Users\Josh\clawd\scripts\statem_runbook_bridge_test.mjs
C:\Users\Josh\clawd\scripts\a2a_mailbox_bridge_test.mjs
C:\Users\Josh\clawd\scripts\bounty_hunter_engine_test.mjs
C:\Users\Josh\clawd\scripts\job_board_and_tension_map_test.mjs
C:\Users\Josh\clawd\scripts\operator_telemetry_routes_test.mjs
C:\Users\Josh\clawd\scripts\third_party_notices_test.mjs
C:\Users\Josh\clawd\scripts\council_subcommittee_router_test.mjs
C:\Users\Josh\clawd\scripts\staging_boundary_check.mjs
C:\Users\Josh\clawd\scripts\external_pattern_license_audit_check.mjs
C:\Users\Josh\clawd\scripts\review_model_runner_test.mjs
C:\Users\Josh\clawd\scripts\review_loop_supervisor_test.mjs
C:\Users\Josh\clawd\scripts\drift_scan.mjs
C:\Users\Josh\clawd\scripts\openrouter_review.py
C:\Users\Josh\clawd\scripts\test_active_integration.mjs
```

## Governance And Planning Surfaces

```text
C:\Users\Josh\clawd\AGENTS.md
C:\Users\Josh\clawd\BOOTSTRAP.md
C:\Users\Josh\clawd\IDENTITY.md
C:\Users\Josh\clawd\identity\personas\SOUL.md
C:\Users\Josh\clawd\identity\personas\USER.md
C:\Users\Josh\clawd\PROMPT_CORE.md
C:\Users\Josh\clawd\TOOLS.md
C:\Users\Josh\clawd\DESIGN.md
C:\Users\Josh\clawd\OPERATING_LOOP.md
C:\Users\Josh\clawd\EXPERIMENT_RECONCILIATION.md
C:\Users\Josh\clawd\REFERENCE_PATTERNS.md
C:\Users\Josh\clawd\MEMORY_OWNERSHIP.md
C:\Users\Josh\clawd\MEMORY.md
C:\Users\Josh\clawd\memory\2026-08-21.md
C:\Users\Josh\clawd\memory\2026-08-26.md
```

## Provenance, Branch, And PR Evidence

```text
C:\Users\Josh\clawd\reviews\external_pattern_license_audit.md
C:\Users\Josh\clawd\reviews\branch_policy_reconciliation_2026-08-26.md
C:\Users\Josh\clawd\reviews\w0068_staging_triage.md
C:\Users\Josh\clawd\reviews\antigravity_read_this_first.md
C:\Users\Josh\clawd\reviews\antigravity_return_packet.md
C:\Users\Josh\clawd\reviews\codex_antigravity_handoff_addendum.md
C:\Users\Josh\clawd\reviews\primary_review_document_hashes.md
```

## Bounty Lane Orientation

Council-building should maximize bounty success by reducing selection mistakes, setup drag, hallucinated claimability, and half-finished patches:

```text
C:\Users\Josh\clawd\lib\bounty_hunter_engine.mjs
C:\Users\Josh\clawd\lib\job_board_ingress.mjs
C:\Users\Josh\clawd\lib\statem_runbook_bridge.mjs
C:\Users\Josh\clawd\lib\a2a_mailbox_bridge.mjs
C:\Users\Josh\clawd\lib\council_subcommittee_router.mjs
C:\Users\Josh\clawd\scripts\bounty_hunter_engine_test.mjs
C:\Users\Josh\clawd\scripts\job_board_and_tension_map_test.mjs
C:\Users\Josh\clawd\scripts\statem_runbook_bridge_test.mjs
C:\Users\Josh\clawd\scripts\a2a_mailbox_bridge_test.mjs
C:\Users\Josh\clawd\scripts\council_subcommittee_router_test.mjs
```

Recommended council roles for bounty loops: scout/filter, claimability verifier, environment/setup runner, patch implementer, adversarial reviewer, final receipt publisher. The loop should stop hopeless lanes early and repair local verification drift before it compounds.

### Bounty Board Radar Intake From Antigravity

Treat this as an architecture target for the Bounties Project, not as proof that every listed board has been freshly scanned in this repo:

```text
Pipeline shape:
1. Ingress and sieve harvester
   - 13 Web3/crypto boards, bug bounties, SWE-bench, and protocol audits
   - Agent-Reach pattern only under scrape-only quarantine
   - structural query cache for repeated/static scans
   - domain allowlist and prompt-injection scrubbing before context entry

2. OSS council triage and domain committees
   - code/spec feasibility lens
   - adversarial vulnerability/exploit lens
   - bounty ROI and anti-noise lens
   - preserve disagreement as a tension map rather than averaging it away

3. StateM 4-phase execution
   - plan -> execute <-> verify -> handoff
   - no submission packet until local compiler/test/formal-verification evidence passes
   - sealed receipts remain the proof boundary
```

Candidate target landscape named by Antigravity: `midnight.network/careers`, `jobs.solana.com`, `jobs.avax.network`, `ethereumjobboard.com`, `block.xyz/careers`, `jobs.dragonfly.xyz`, `web3.career`, `cryptocurrencyjobs.co`, `cryptojobslist.com`, `jobstash.xyz`, `remote3.co`, `beincrypto.com`, and `crypto-careers.com`.

Use `C:\Users\Josh\clawd\lib\job_board_ingress.mjs`, `C:\Users\Josh\clawd\lib\bounty_hunter_engine.mjs`, `C:\Users\Josh\clawd\lib\structural_query_cache.mjs`, `C:\Users\Josh\clawd\lib\statem_runbook_bridge.mjs`, `C:\Users\Josh\clawd\lib\a2a_mailbox_bridge.mjs`, and `C:\Users\Josh\clawd\lib\council_subcommittee_router.mjs` as the Node-side integration surfaces.

Fresh Codex slice in this pass:

```text
C:\Users\Josh\clawd\lib\bounty_hunter_engine.mjs
C:\Users\Josh\clawd\scripts\bounty_hunter_engine_test.mjs
C:\Users\Josh\clawd\reviews\prompts\bounty_clean_room_builder_prompt.md
C:\Users\Josh\clawd\reviews\prompts\bounty_adversarial_breaker_prompt.md
```

`lib\bounty_hunter_engine.mjs` now exposes `createBountyA2AIngestEnvelope()`, sealing a `dizzy.bounty_a2a_ingest.v1` bounty alert for board-scanner to council/StateM handoff. This is still local Dizzy A2A-style infrastructure; do not claim public Agent2Agent compliance from it.

Post-slice verification for this bounty ingest contract:

```text
npm run test:bounty-hunter -> ALL 10 TESTS PASSED CLEANLY
npm run test:a2a-mailbox -> ALL 5 TESTS PASSED CLEANLY
npm run test:statem-runbook -> ALL 8 TESTS PASSED CLEANLY
npm run test:job-board-scanner -> ALL 5 TESTS PASSED CLEANLY
npm run check:docs -> DOC_REFERENCE_CHECK_OK
npm run check:staging-boundary -> STAGING_BOUNDARY_CHECK_OK dirty_tracked=31 disposition_rows=44 parked_rows=14
npm run check:next -> NEXT_CONSISTENCY_OK checked=0
node --check lib\bounty_hunter_engine.mjs -> PASS
node --check scripts\bounty_hunter_engine_test.mjs -> PASS
```

Earlier Codex post-bounty-ingest `npm run check:council` timed out at the outer 5-minute limit after syntax, governance, and initial Layer 3 suites passed. That timeout note is now superseded by the completed full-council receipt currently on disk: `C:\Users\Josh\clawd\reviews\oss_council_verdict_latest.json`, timestamp `2026-08-28T03:10:46.075Z`, SHA-256 `7A85640464336AAA9A1E6EBCF3B7FD93DE36CA8AC921FE3CB46A3C5298AB6F61`, with `105 syntax detail entries / 51 execution suites / 2 governance checks`. Re-run lightweight doc/staging gates after any further handoff edit.

Codex feedback to preserve in the next Antigravity loop:
- Tension maps should be treated as disagreement-preserving risk surfaces, not consensus averages or model-quality proof.
- StateM is the bounty assembly-line gate: `plan -> execute <-> verify -> handoff`, with handoff blocked until deterministic local verification passes.
- The jazz framing is useful as operating posture: accept the chord progression of real constraints, then improvise inside it with mechanisms and receipts.
- The copy-paste manifest should stay sorted by role and backed by live path checks; avoid adding aspirational paths that do not exist locally.
- The bounty lane should optimize for paid success: payout proof, claimability, low setup drag, clean-room provenance, and fast stop conditions for hopeless lanes.

Proof and trust boundaries:
- Do not claim live board coverage, freshness, availability, or payout mechanics until a current scan receipt exists.
- Do not let scrape-only references read ambient browser cookies or bypass egress chokepoints.
- Do not borrow GPL/AGPL/copyleft code into bounty deliverables; preserve clean-room notes and third-party notices.
- Application packets and bounty submissions may be drafted automatically, but public sending, claiming, or relationship outreach requires explicit Simul approval.
- Match against `identity\personas\USER.md` and project values as a local private scoring signal; do not leak raw private memory into public packets.

Near-term bounty-success backlog:
1. Wire `dizzy.bounty_a2a_ingest.v1` envelopes into the actual worker queue path.
2. Extend board normalization so raw listings become structured opportunity objects with source URL, payout/role type, claimability state, required stack, and proof requirements.
3. Package a proof dossier that points to `PR_W0068_DESCRIPTION.md`, `MODEL_INVENTORY.md`, `reviews\oss_council_verdict_latest.json`, and relevant StateM/council receipts without overstating readiness.

## Antigravity Concept Intake For This Handoff

Treat this as operating orientation, not as an independent receipt:

```text
Acceptance is not resignation. It means seeing constraints, debt, and friction without distortion.
- Accept credit limits, latency, hardware budgets, and the fact that local tests can be green before remote state is reconciled.
- Accept debt and boundaries: large diffs need staging tables; Python proving labs stay quarantined; Apache-2.0, AGPL-3.0, and other licenses require attribution or clean-room isolation.
- Accept multi-agent friction: Codex + Antigravity diverge unless continuously checked against sealed receipts and files.

Change is the refusal of fatalism. It means turning insights into mechanisms.
- Prefer deterministic hooks, SQLite cache receipts, license guards, StateM phase barriers, A2A envelopes, and bounty EV checks over prose-only agreement.
- Raise the baseline one package at a time so the same failure mode does not keep recurring.
- Build local anti-chokepoint infrastructure that reduces reliance on opaque providers, brittle manual handoffs, and external rent points.

Balance: stay patient while evidence aligns; move precisely when the next repair or construction slice is clear.
```

Council-building for the bounty lane should be judged by practical success:

```text
1. Faster target selection: reject unclaimable, unpaid, stale, overbroad, or negative-EV bounty lanes early.
2. Better setup truth: record install/build/test blockers, platform assumptions, and required credentials before patching.
3. Cleaner task lifecycle: route each candidate through plan -> execute <-> verify -> handoff, with stop conditions.
4. Repair before overwhelm: fix local harness, receipt, branch, or staging drift before opening the next bounty lane.
5. End hopeless loops: after repeated blocked setup, missing assignment, impossible reproduction, or no payout path, park the lane with evidence.
6. Relationship building: where appropriate, use respectful maintainer questions, issue comments, or proposal drafts, but never send externally without Simul approval.
```

## External Scratch Evidence Boundary

Python Council Engine material may inform design, but remains external/quarantined relative to this Node runtime:

```text
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\FULL_SYSTEM_HANDOFF.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\MASTER_STATE_CHECKPOINT.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\outputs\antigravity_return_prompt_council_engine_latest.md
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\a2a_protocol_engine.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\cross_project_federation_bridge.py
C:\Users\Josh\.gemini\antigravity\scratch\council_engine\test_cross_project_federation_bridge.py
```

Treat the latest supplied Council Patch 9D baseline (`322 tests / 62 modules / CONTRACT_VERSION 4.7.0 / 30 contract sections / 37 payload receipt schemas`) as sidecar evidence until independently rerun. Older `237 / 237` and `298 tests / 58 suites` scratch counts are superseded for current handoff purposes. Do not collapse Python scratch readiness into clawd production readiness.

## Verification Commands

```powershell
cd C:\Users\Josh\clawd
git branch --show-current
git rev-parse HEAD
git status --short --branch
npm run check:staging-boundary
npm run check:docs
npm run check:next
npm run test:bounty-hunter
npm run test:job-board-tension
npm run test:statem-runbook
npm run test:a2a-mailbox
npm run test:subcommittee-router
npm run check:council
```

## Guardrails

```text
Do not stage, commit, push, delete branches, clean, reset, or stash without Simul approval.
Do not trust copied handoff counts over live receipt files.
Do not use C:\Users\Josh\clawd\PACKAGE.json; the real file is C:\Users\Josh\clawd\package.json.
Do not treat Python scratch modules as production authority.
Do not claim public A2A compliance from the local mailbox bridge.
Do not install or vendor external reference projects without the license/provenance gate.
```
