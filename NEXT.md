# NEXT.md
Open decisions and work queue.

Rules:
- Keep items atomic.
- When resolved, move the decision + rationale to `DESIGN.md` (and update the `STATE_JSON` block if needed).
- Prefer links/IDs so you can trace resolution history.

---

## Open Decisions

None at the architecture layer.

Resolved note: D-0039 was closed by the W-0068/W-0104 staging packet, `reviews/w0068_staging_triage.md`, and the refreshed PR wording. Remote branch deletion is still an operator approval action, not an open design decision.

---

## Work Queue

- W-0091: Keep the Python `council_engine` proof lab quarantined until promotion gates are independently satisfied.
  Acceptance: Python pass counts are recorded as scratch/sidecar evidence only. Latest Council context supplied on 2026-08-27 after Codex Patch 9D reports 322 tests passing across 62 discoverable test modules, 70 raw non-test Python files, 19 non-output Markdown docs/specs, 13 domain blueprints, `CONTRACT_VERSION 4.7.0`, 30 contract sections, and 37 payload receipt schemas. Codex did not rerun that Python suite in this clawd pass; older 181/237/298 scratch baselines are superseded by the Patch 9D sidecar report. Promotion remains blocked on independent verification of key custody, Ed25519-authenticated P2P/public A2A boundaries, non-mock sandboxing, network egress chokepoints, provenance, sensitivity, path-jail, and mock-rejection evidence.

---

## Community-Facing Roadmap

These are future focuses for public collaborators, not current completion claims.

- W-0106: Capture a real dashboard walkthrough proof.
  Acceptance: Start the dashboard with `DIZZY_DASHBOARD_ENABLED=1`, verify the first screen in a live browser, and save or attach a screenshot/GIF artifact that confirms the cockpit is usable, sober, and truthful. Operator captured the W-0106 walkthrough screenshots offline. No repository path or PR attachment is recorded in this checkout, so this is operator-observed evidence rather than a repository-verifiable launch artifact. W-0106 is operationally resolved.

- W-0109: Harden the bounty/opportunity lane.
  Acceptance: Keep board ingestion behind domain allowlists, no ambient browser-cookie access, safe offline artifacts, EV triage calibration, and receipt-backed handoff into the local worker queue.

- W-0110: Explain the Memory Wiki.
  Acceptance: Add examples that show capture, consolidate, retrieve, reconcile, and decay flowing into transparent Markdown wiki pages while preserving the separate `cognitive_memory_engine.mjs` and `memory_wiki_adapter.mjs` boundary.

- W-0111: Keep license and provenance audit current.
  Acceptance: Before broad public/client-facing release, review external reference rows, borrowing classes, notices, and clean-room boundaries in `reviews/external_pattern_license_audit.md` and `THIRD_PARTY_NOTICES.md`.








---

## Completed

- W-0108: Implemented signed local A2A HTTP ingress boundary (`lib/a2a_boundary_guard.mjs`, `/api/a2a/incoming`, `scripts/a2a_boundary_test.mjs`). The route fails closed without a dedicated 32+ character `DIZZY_A2A_SECRET`, verifies exact raw JSON bytes with HMAC SHA-256, rejects stale timestamps and replayed nonces, validates timestamp/nonce/signature formats, recursively strips known prompt markers only after signature verification, and performs schema/sender checks before dispatch. This is local service-boundary proof, not public cross-runtime A2A interoperability. (Verification: `npm run test:a2a-boundary`; `npm run check:council`; see `reviews/oss_council_verdict_latest.json` for the current aggregate count)
- W-0107: Added contributor onboarding (`CONTRIBUTING.md`) with proof-first contribution rules, scoped good-first issue lanes, local verification commands, no-secret/no-scratch hygiene, and public claim boundaries. (Verification: `npm run check:docs`; `npm run test:public-view-readiness`)
- W-0105: Public surface readiness pass for the staging branch before serious collaborator/public viewing. README, Quickstart, Runbook, PR body, dashboard copy, and handoff surfaces are proof-bound to current local receipts. Dashboard access is documented as opt-in with `DIZZY_DASHBOARD_ENABLED=1`; public A2A interoperability and hosted production readiness are explicitly not claimed. `scripts/dashboard_public_surface_test.mjs` verifies neutral dashboard startup states, stripped decorative glow/gradient/shadow/motion surface terms, idempotent chat initialization, auth/session behavior, and JSON operator telemetry routes. `scripts/public_view_readiness_test.mjs` guards README/Quickstart/Runbook/PR wording against public overclaims. Full live browser screenshot proof remains pending because local Edge/Chrome headless capture failed in this sandbox, so this is collaborator-view readiness rather than product-launch proof. (Verification: `npm run test:dashboard-public-surface`; `npm run test:public-view-readiness`; `npm run test:dashboard-safety`; `npm run check:council`; see `reviews/oss_council_verdict_latest.json` for the current aggregate count)
- W-0104: Implemented and reconciled Bounty Board Scanner (`scripts/job_board_scanner.mjs`, `scripts/job_board_scanner_test.mjs`). Bridges external live APIs/feeds (e.g. GitHub issues) to the internal worker queue using `lib/job_board_ingress.mjs` and the canonical `enqueueJob` contract, automatically sanitizes text, extracts domains (e.g. `ZK_PRIVACY`), calculates Expected Value, and seals listings into `dizzy.bounty_a2a_ingest.v1` envelopes for the OSS Council/StateM worker. Built with a deterministic no-network `--offline-proof` artifact mode that outputs `artifacts/bounty_scan_results.json` when Redis or live fetch is unavailable. (Verification: `npm run test:job-board-scanner`; `npm run test:job-board-tension`; `npm run test:bounty-hunter`; `npm run check:council`; see `reviews/oss_council_verdict_latest.json` for the current aggregate count)
- W-0094: Reconciled experimental mechanisms. The `experiments` branch was audited and found to contain no outstanding unique mechanisms relative to `main`. It was subsequently retired (see W-0101) effectively completing this requirement.
- W-0095: Translated external concept intake into control-plane candidates only. Mapped external clones and patterns (including Agent-Reach, `aeonfun/aeon`, and `MiroShark/MiroShark`) in `reviews/external_pattern_license_audit.md` strictly as `idea_only` or `mechanism_translation` without vendoring or executing external code inside the Node runtime policy.
- W-0099: Hardened streaming response infrastructure (`lib/sse_stream.mjs`, `agent_server.mjs`). SSE execution is implemented at `/agent/execute/stream` with scoped execute-token support, deterministic event IDs via `Idempotency-Key`, bounded backpressure waits, client-disconnect abort propagation, hash-only stream receipts, and terminal partial-failure/disconnect evidence. WebSocket support remains an unmade future product/API decision. (Verification: `npm run test:streaming-response`; `npm run check:council`)
- W-0101: Decided and reconciled GitHub branch policy (`EXPERIMENT_RECONCILIATION.md`). Local branches are now reduced to `main` and active staging branch `feat/dizzy-general-distro`; stale local `experiments`, obsolete local `feat/w0066-router-core`, and scratch `codex/*` branches are gone. Local archive tag `archive/feat-w0066-router-core` exists. Remote closure remains pending explicit Simul approval because deleting `origin/experiments` and `origin/feat/w0066-router-core` is a push operation; cached tracking refs remain until `git fetch --prune`.
- W-0102: Audit borrowed-pattern license and provenance exposure (`scripts/check_licenses.mjs`, `reviews/external_pattern_license_audit.md`, `scripts/generate_third_party_notices.mjs`, `scripts/third_party_notices_test.mjs`, `THIRD_PARTY_NOTICES.md`). External references are mapped by observed license and use class, retrospective pattern rows are compiled into a deterministic third-party notice footprint, and clean-room provenance is verified across 12 reference sources with cryptographic content hashes (`dizzy.third_party_notices.v1`). Treat live GitHub license lookup as Antigravity-reported unless rerun with network access in the active session. (Verification: `node --check scripts/check_licenses.mjs`; `node scripts/generate_third_party_notices.mjs --write`; `npm run test:third-party-notices`; `npm run check:council`; see `reviews/oss_council_verdict_latest.json` for the current aggregate count)
- W-0092: Assembled the production-readiness checklist/evidence packet (`PRODUCTION_READINESS.md`), not a launch approval. Consolidated and attested evidence for route/auth inventory (W-0058), HTTPS/env boundaries (W-0057), rate limits & circuit breakers (W-0084), cache policy & rollback (W-0098), error tracking & accessibility (UI-0001), provider data-flow trust zones (W-0093), and affirmed no DB/RLS dependency (SQLite/Redis/Filesystem only). (Verification: `npm run check:production`)
- W-0093: Refreshed model-roster qualification without collapsing status states (`scripts/generate_model_inventory.mjs`). `MODEL_INVENTORY.md` now auto-generates a structured matrix differentiating installed, callable, and json_review_usable states. (Verification: `npm run check:council`)
- W-0103: Implemented Council Subcommittee Router & Dialectical Tension Consensus Engine (`lib/council_subcommittee_router.mjs`, `scripts/council_subcommittee_router_test.mjs`). Generates deterministic rotation schedules across 6 specialized committee roles (`synthesizer`, `adversary`, `formal_verifier`, `anti_slop`, `security_auditor`, `pragmatic_implementer`), synthesizes multi-model tension vectors across 4 semantic axes (`correctness`, `safety`, `slop_reduction`, `governance`), calculates quorum thresholds, preserves minority dissents in structured receipts (`dizzy.council_subcommittee.verdict.v1`), and outputs authenticated Dizzy-local A2A-shaped verdict packets. External A2A interoperability is not claimed until signed HTTP/WebSocket receipts exist. (Verification: `npm run test:subcommittee-router`; `npm run check:council`; see `reviews/oss_council_verdict_latest.json` for the current aggregate count)
- W-0100: Implemented StateM-style four-phase runbook bridge, FSM execution engine, Bounty Hunter Engine, A2A Mailbox Bridge, Job Board Ingress, Pluralistic Tension Map Engine, and Operator Telemetry Routes in Node runtime (`lib/statem_runbook_bridge.mjs`, `scripts/statem_runbook_bridge_test.mjs`, `lib/bounty_hunter_engine.mjs`, `scripts/bounty_hunter_engine_test.mjs`, `lib/a2a_mailbox_bridge.mjs`, `scripts/a2a_mailbox_bridge_test.mjs`, `lib/job_board_ingress.mjs`, `lib/tension_map_engine.mjs`, `scripts/job_board_and_tension_map_test.mjs`, `scripts/operator_telemetry_routes_test.mjs`, `agent_server.mjs`, `worker.mjs`). Generates StateM-compatible YAML runbooks (`plan -> execute <-> verify -> handoff`), executes bounded FSM tasks with deterministic verification barriers (`dizzy.statem_runbook_execution.v1`), provides bounty EV calculation & adversarial vulnerability scanning, normalizes 13 Web3 job feeds with skill vector extraction, renders dialectical multi-model tension maps (`dizzy.tension_map.v1`), and exposes secure telemetry endpoints on agent server. (Verification: `npm run test:statem-runbook`; `npm run test:bounty-hunter`; `npm run test:a2a-mailbox`; `npm run test:job-board-tension`; `npm run test:operator-telemetry`; `npm run check:council`; see `reviews/oss_council_verdict_latest.json` for the current aggregate count)
- W-0098: Added a SQLite-backed structural query cache for the local dashboard query surface (`lib/structural_query_cache.mjs`, `lib/dashboard.mjs`, `lib/md_retriever.mjs`) before any embedding-based semantic cache. Cache keys and receipts include route, projection, trust zone, retention scope, prompt/config hash, markdown source signature, and hashed cache partition; raw query text, excerpts, paths, and client partition strings are not persisted. The cache is reversible/non-authoritative, degrades closed when `node:sqlite` is unavailable, and the runtime now closes optional sidecars on shutdown. (Verification: `npm run test:structural-query-cache`; `npm run test:dashboard-safety`; `npm run verify:bm25`; `npm run eval:retrieval-integrity`; `npm run test:replay-safety`; `npm run check:safety`; `npm run check:council`)
- W-0097: Implemented deterministic Node lifecycle hook middleware (`lib/lifecycle_hooks.mjs`) with `SessionStart`, `PreToolUse`, `PostToolUse`, and `Stop` receipts. Ingress now emits SessionStart/Stop via `lib/ingress_gateway.mjs`, the shared `runToolJob` path emits Pre/Post receipts with hash-only payload/output evidence, and `worker.mjs` passes worker context into the guarded runner. The W-0097 receipt baseline is now superseded by W-0098. (Verification: `npm run test:lifecycle-hooks`; `npm run test:ingress-gateway`; `npm run check:council`)
- W-0096: Repaired manifest drift in the W-0062b/W-0065a receipt surface by restoring `lib/visual_slop_scanner.mjs`, `scripts/anti_slop_visual_fixture_check.mjs`, and `scripts/usage_report_test.mjs`, then registering the restored harnesses in `scripts/oss_council_audit.mjs`. Intermediate receipt after this repair was 79 syntax targets, 39 execution suites, and 2 governance checks; W-0097 supersedes it. (Verification: `node scripts/usage_report_test.mjs`; `npm run eval:anti-slop-visual`; `npm run check:council`)
- W-0090: Ran a bounded rotating review loop on the W-0068 diff with existing supervisor/harness infrastructure, no model execution, no cloud dispatch, and explicit W-0068 changed-file scope. Result: supervisor proposed `ready-for-push` as automation-only; six local harnesses passed; generated receipts remain local evidence (`reviews/review_loop_supervisor_latest.json`, `reviews/review_cycle_latest.json`, `reviews/review_synthesis_latest.json`, `reviews/review_cycle_history.json`). (Verification: `npm run review:supervise -- --worktree --changed "PR_W0068_DESCRIPTION.md,README.md,agent_server.mjs,lib/openai_compat_client.mjs,lib/review_model_runner.mjs,memory/2026-08-21.md,scripts/review_model_runner_test.mjs,scripts/safety_checks.mjs,scripts/test_active_integration.mjs,reviews/w0068_staging_triage.md,NEXT.md" --candidate-id "W-0068-staging" --max-reviewers 6 --max-harnesses 6 --timeout-ms 180000 --min-reviews-for-push 0 --no-require-disagreement --include-receipt-harnesses --write --write-history`)
- W-0089: Finalized W-0068 staging triage and PR packet boundaries in `reviews/w0068_staging_triage.md`, naming tracked include candidates, untracked parked evidence, Python quarantine, external concept intake, rotating supervisor guardrails, and receipt refresh rules. (Verification: `npm run test:review-models`; `npm run check:safety`; `node scripts/test_active_integration.mjs`; `npm run check:docs`; `npm run check:council`)
- W-0088: Implemented Deterministic Citation Grounding & Evidence Verifier (`lib/citation_grounding_verifier.mjs`, `scripts/citation_grounding_test.mjs`, `scripts/fixtures/citation_grounding_fixtures.json`), validating verbatim/normalized quote existence, detecting phantom citations, line drifts, and out-of-bounds line references with cryptographic receipts (`dizzy.citation_grounding.v1`). (Verification: `npm run test:citation-grounding`; `npm run check:council`)
- W-0087: Implemented Receipt Trace Replay & Machine-Room Audit Engine (`lib/receipt_trace_viewer.mjs`, `scripts/receipt_trace_viewer_test.mjs`, `scripts/fixtures/trace_replay_fixtures.json`), reconstructing lifecycle timelines across ingress, routing, tool evaluation, council verification, and state commit with cryptographic tamper detection. (Verification: `npm run test:trace-replay`; `npm run check:council`)
- W-0086: Implemented Structured Tool-Call Evaluator (`lib/tool_call_evaluator.mjs`, `scripts/tool_call_eval_test.mjs`, `scripts/fixtures/tool_call_eval_fixtures.json`), scoring model tool-calling adherence, parameter hallucination, SSRF loopback escape, sensitive file path targets, and shell injection. (Verification: `npm run test:tool-call-eval`; `npm run check:council`)
- W-0085: Integrated Latency-Cost-Trust Pareto HUD, Live Route Circuit Breakers Grid, and Verification Defense Ledger into Guided Trust Cockpit (`dashboard/index.html`, `dashboard/dashboard.js`, `agent_server.mjs`). (Verification: `npm run test:dashboard-safety`; `npm run check:council`)
- W-0084: Implemented Route-Level Circuit Breaker & Failover Engine (`lib/circuit_breaker.mjs`, `scripts/circuit_breaker_test.mjs`), enforcing closed/open/half-open state transitions and cryptographic route failure receipts (`dizzy.route_failure.v1`). (Verification: `npm run test:circuit-breaker`; `npm run check:council`)
- W-0083: Implemented Deterministic 3-Slot Context Packer (`lib/context_packer.mjs`, `scripts/context_packer_test.mjs`), enforcing `MUST_INCLUDE`, `OPTIONAL_EVIDENCE`, and `FORBIDDEN` slots bounded by trust-zone byte budgets. (Verification: `npm run test:context-packer`; `npm run check:council`)
- W-0082: Implemented Negative Capability & Anti-Confabulation Harness (`lib/negative_capability_harness.mjs`, `scripts/negative_capability_test.mjs`, `scripts/fixtures/negative_capability_fixtures.json`), asserting grounded refusals and missing-evidence reporting. (Verification: `npm run test:negative-capability`; `npm run check:council`)
- W-0081: Implemented 8-Scenario Adversarial Verification Harness (`lib/adversarial_verification_harness.mjs`, `scripts/adversarial_verification_test.mjs`, `scripts/fixtures/adversarial_verification_fixtures.json`), deterministically intercepting hostile memory claims, forged receipt hashes, stale qualifications, malformed tool calls, poisoned contexts, unsafe patch targets, and invalid fallback routes. (Verification: `npm run test:adversarial-verification`; `npm run check:council`)
- W-0080: Added Self-Monitoring Signal Calibration Harness (`lib/self_monitoring_calibration.mjs`) with `dizzy.self_monitoring_calibration.v1`, telemetry-only TP/FP/FN/TN/Unknown classification, narrow model/claim/failure/task scope isolation, no subjective-awareness ontology, and zero recommendation authority. (Verification: `npm run test:self-monitoring`; `npm run check:council`)
- W-0076: Added Context Hygiene Audit & Instruction Pruning (`scripts/context_hygiene_audit.mjs`) to classify always-loaded prompt guidance across standing brief, workflow skill, memory reference, and deterministic gate layers. (Verification: `npm run check:context-hygiene`; `npm run check:council`)
- W-0073: Added Local Chaos & Provider Failure Harness (`scripts/local_chaos_harness_test.mjs`, `scripts/fixtures/local_chaos_fixtures.json`) with offline failure fixtures for provider timeout, malformed JSON, empty reasoning, local backend dropout, 429s, context exhaustion, receipt write failure, and route misuse. Emits in-memory chaos evidence receipts only. (Verification: `npm run test:local-chaos`; `npm run check:council`)
- W-0072: Added Request Trace Receipt Chain (`lib/trace_chain.mjs`) with `dizzy.trace_chain.v1`, nine-stage diagnostic lifecycle metadata, query-string stripping, full-URL route sanitization, SHA-256 `chain_hash`, and prompt/output body leak assertions. (Verification: `npm run test:trace-chain`; `npm run check:council`)
- W-0075: Implemented Rehearsal Gate & Focused Outcome Memory (`lib/rehearsal_gate.mjs`), ranking candidate implementation plans against outcome memory while enforcing authority boundary (`automation_recommends_simul_approves`). (Verification: `npm run test:rehearsal-gate`; `npm run check:council`)
- W-0071: Added AI Reliability Incident Runbooks & Diagnostic Tool (`scripts/ai_sre_diagnose.mjs`, `docs/runbooks/ai_sre_incident_response.md`) with the nine-class failure taxonomy: ingress, auth, validation, routing, provider, persistence, retrieval, review-loop, and operator-gate. (Verification: `npm run test:ai-sre-diagnose`; `npm run check:council`)
- W-0074: Implemented Eval Gate Promotion Policy (`scripts/eval_gate_policy_check.mjs`), enforcing golden retrieval floor (>= 85.0%), review loop safety floor, dashboard safety compliance, and generated receipt exclusion checks. (Verification: `npm run check:eval-gate`; `npm run check:council`)
- W-0069: Implemented Deterministic CI Gate (`.github/workflows/ci.yml`), running Node 20.18.1 offline verification (`npm ci`, static checks, `npm test`, `npm run maintain`, `npm run check:council`). (Verification: GitHub Actions clean run)
- W-0070: Implemented Receipts & Review Observability Panel (`dashboard/index.html`, `dashboard/dashboard.js`, `/api/operator/receipts-telemetry`), displaying model usage, latency bands, trust zones, and cost/budget estimates. (Verification: `npm run test:dashboard-safety`)
- W-0064: Implemented Dashboard Safety & Volatility Harness (`scripts/dashboard_safety_harness_test.mjs`), adding CSP/HTML/JS/route-contract assertions and wiring `test:dashboard-safety` into `maintain.mjs` and `oss_council_audit.mjs`. (Verification: `npm run test:dashboard-safety`)

- W-0062c: Refined Anti-Slop Scanner allowlist and prompt overlay cues (`lib/anti_slop_scanner.mjs`, `scripts/anti_slop_prose_fixture_check.mjs`) for fenced code blocks, inline backticks, and doc examples. (Verification: `node scripts/anti_slop_prose_fixture_check.mjs`)

- W-0065a: Aligned Usage Report Schema (`scripts/usage_report.mjs`, `scripts/usage_report_test.mjs`) with `dizzy.router_receipt.v1` enums and verified zero private text leaks. (Verification: `node scripts/usage_report_test.mjs`)
- W-0062b: Verified Anti-Slop Visual Scanner (`lib/visual_slop_scanner.mjs`, `scripts/anti_slop_visual_fixture_check.mjs`) with explicit visual corpus and non-dashboard targets. (Verification: `node scripts/anti_slop_visual_fixture_check.mjs`)
- W-0067: Implemented Risk-Tiered Inference Compute Scaler (`lib/risk_scaler.mjs`), scaling rollout candidates (1 to 3) and mandatory pre-mortems based on Level 1-4 tool risk levels in `TOOLS.md`. (Verification: `npm run test:risk-scaler`)
- W-0065b: Implemented Golden Retrieval Evaluation Harness (`scripts/retrieval_eval.mjs`) and expanded persona index (`identity/personas/`), surging Hit Rate @ 3 to 90.0% and MRR to 0.758. (Verification: `npm run eval:retrieval-golden`)
- W-0066: Implemented Dynamic Model Routing & Isolation Core (`lib/dispatch.mjs`, `lib/model_router.mjs`), enforcing fail-closed local isolation policy and manual 3xx redirect blocks. (Verification: `npm run test:router`)
- W-0063a: Implemented Context Tree Integrity Hash Alignment (`context-tree.json`), matching `indexed_commit` to live HEAD. (Verification: `npm run check:context-tree`)
- UI-0001: Redesigned Dashboard UI (`dashboard/index.html`) as an Obsidian Control Surface (Obsidian base, Jazz Cyan accents, Warm Amber receipts, 100% offline font compliant).

- W-0060: Implemented the Router Receipt MVP, returning a structured execution receipt (schema `dizzy.router_receipt.v1`) on successful `/dispatch/incoming` and `/agent/execute` response wrappers with cost band, model, trust zone, data boundary, and model origin risk details.
- W-0061: Integrated the Local Model Backend, mapping `DIZZY_CHAT_BACKEND=local` to local Ollama endpoints (defaulting to `http://127.0.0.1:11434/v1` and `gemma3:4b`), and added the safety config validation whitelist.
- D-0037: Resolved Local Backend Integration Model by mapping `local` to an OpenAI-compatible/Ollama-style adapter under the hood to maximize code reuse.
- D-0038: Resolved Router Receipt Persistence by dynamically attaching receipts to HTTP responses while persisting them only when retention scope is not ephemeral: `conversation_only` scope persists receipts as conversation `.jsonl` system events, other durable/local-audit scopes persist to `runtime/router_receipts.jsonl`, and ephemeral scope persists to neither.

- W-0058: Added loopback-only dashboard login that exchanges the operator token through a local POST body for a random, expiring, in-memory `HttpOnly; SameSite=Strict` cookie scoped in authorization to dashboard routes only; regression coverage proves login, guarded assets/data/query access, logout, and rejection on `/prompt`, with a live browser pass covering login, render, tab switching, and retrieval.
- W-0059: Minimized dashboard metadata with opaque stable document/source IDs, removed repository paths from API responses, extracted executable JavaScript into a guarded local asset, removed inline event handlers, and tightened `script-src` to same-origin scripts without `'unsafe-inline'`.
- W-0057: Implemented native HTTP security headers middleware in [lib/security_headers.mjs](lib/security_headers.mjs), integrated `DIZZY_VERIFIED_HTTPS` gating in config and Express, documented in [RUNBOOK.md](RUNBOOK.md) and [.env.example](.env.example), and added safety test assertions for CSP routing, 401/404 header coverage, and HSTS.
- W-0056: Extracted the dashboard renderer into local-only `dashboard/index.html`, removed third-party font and placeholder-image requests, added a restrictive content security policy, and proved missing assets cannot break core health.
- W-0055: Extracted dashboard guards and read-only data/query routes into `lib/dashboard.mjs`; disabled mode avoids loading the module, initialization failure cannot break core health, and paid/public or outside-contact zones are denied.
- W-0054: Added an operator-run baseline-versus-three-hypothesis evaluation harness with measurable insight, distinctness, provenance, and decision-record thresholds; it performs no model calls or autonomous writes.
- W-0053: Raised the supported Node floor to 20.18.1, matching the installed Cheerio/Undici engine contract and general CI.
- W-0052: Replaced optional dependency-impact prose scanning with a five-column reconciliation ledger validated row by row.
- W-0051: Bound SQLite idempotency replays to operation fingerprints and reject same-key creation requests whose effect changes.
- W-0050: Added periodic backoff-aware processing-claim recovery, operator-visible pending signals, and atomic DLQ enqueue/marker persistence.
- W-0044: Enforced fail-closed safety for expired SQLite WRITE jobs in `claimNextJob`.
- W-0045: Restricted SQLite transactions to fail-fast on nested transaction calls.
- W-0046: Added marker-based dead-job DLQ recovery and atomic Redis notification enqueue/marker persistence via `dlq_enqueued_at_ms` and `death_notified_at_ms`; ambiguous notification-enqueue responses can be retried without adding another queue item, while downstream delivery remains at-least-once.
- W-0047: Added post-copy restore validation (`verifySnapshotManifest`) so copy failure or target hash mismatch triggers rollback.
- W-0048: Added multi-connection SQLite WAL contention and duplicate notification acknowledgement unit tests.
- W-0049: Documented at-least-once out-of-order notification ack semantics and duplicate delivery risk.
- W-0036: Evaluated a bounded SQLite operational sidecar after queue recovery and multi-record conversation ordering exposed concrete JSONL limits; kept it non-authoritative pending independent review (D-0036).
- Strengthened the logical untrusted-context boundary by introducing `lib/janitor.mjs` to strip/neutralize instruction triggers, escape HTML/XML tag markers, and wrap untrusted inputs in a strict XML envelope.
- Added checked repository revision, scanner version, check timestamp, findings count, and stable finding IDs to drift scans, with safety tests checking simulated overrides.
- W-0043: Added a compact live task-preflight contract with tested skip, proceed, and clarify paths; success criteria stay internal by default and refinement falls back after one minute instead of becoming planning theater.
- W-0042: Added a shared durable-write policy for remembered memory, auto-memory candidates, friction entries, and trajectories; disallowed trust zones, non-persistent sensitivity classes, obvious credentials, and low-value captures fail before a file is written.
- W-0001: Added `node scripts/sync_state.mjs --check` to verify `state.json` matches `DESIGN.md`.
- N-0001: Canonical job state machine defined in `DESIGN.md` (D-0005).
- N-0002: Optional auth token decision defined in `DESIGN.md` (D-0006).
- N-0003: Default is "no" (DLQ JSONL + Redis is enough for now); revisit only if needed.
- N-0004: Default is local-first + explicit consent for external sharing (Benkler anchor); refine if sharing UX emerges.
- N-0005: Default contestability is reason-codes + user can request a compliant version; refine if patterns repeat.
- N-0006: Governance disclosure via the compatible `/governance` endpoint + `INTERACTION_NORMS.md` doc (D-0004).
- N-0007: Default connector is outbound-only Telegram notify drain script (`node scripts/telegram_notify_drain.mjs`).
- W-0002: Added Telegram notify drain script (`scripts/telegram_notify_drain.mjs`) to surface `/notify/:channel` messages in Telegram.
- N-0008: `/health` stays public only on loopback when auth is enabled; otherwise it requires auth.
- O-0001: Inbound Telegram relay (poll getUpdates -> forward to `/dispatch/incoming` -> send reply), implemented as `scripts/telegram_relay.mjs`.
- W-0003: Added `RUNBOOK.md` for the recommended multi-process run setup.
- N-0009: Runtime-governing doctrine must live in the default prompt pack; supplementary docs are explanatory unless compressed into the live core (D-0007).
- W-0004: Defined and implemented the first paid/client continuity lifecycle for `paid_public` with `continuity_mode=client`: conversation-only retention, explicit expiry policy, no durable memory by default, no private repo retrieval by default, visible `/agent/execute` lifecycle fields, safety checks, local operator deletion, and inactivity expiry pruning.
- W-0005: Added `scripts/maintain.mjs` as the single operator maintenance command.
- W-0006: Added prompt-pack / `DESIGN.md` drift validation with `scripts/prompt_drift_check.mjs`.
- W-0007: Added Product Kernel section to `DESIGN.md` and synced `state.json`.
- W-0008: Added first manual Trajectory Distillery path: sparse known-good trajectory capture, schema, tests, and private/trusted retrieval hook.
- W-0009: Added proposal-only `/trajectory distill` command. It can draft a known-good trajectory from recent history but still requires operator review and `/trajectory add` to save.
- W-0010: Added report-only `scripts/connection_scan.mjs` to surface surprising document/memory connections as hypotheses, not retrieval authority.
- W-0011: Added `MECHANISM_SIEVE.md` and compact prompt-core rules to convert anti-extractive values into ownership, funding, governance, enforcement, exit, simplification, and capability mechanisms.
- W-0012: Added first manual Friction Ledger path: sparse stuck-point capture, listing, summary weighting, maintain visibility, and tests.
- W-0013: Added `MECHANISMS.md` as a map of reusable design mechanisms without outreach or borrowing language.
- W-0014: Added `FILE_ROLES.md` to classify root-file authority without moving files prematurely.
- W-0015: Added `dizzy maintain` validation that flags root files missing from `FILE_ROLES.md`.
- W-0016: Marked root flavor/economic overlay files as optional, non-runtime-governing surfaces instead of moving them prematurely.
- W-0017: Added capability-building test to economic doctrine and compact runtime prompt core.
- W-0018: Added `CHOKEPOINTS.md` as an internal anti-extraction self-inspection map for dependency, capture, and exit risks.
- W-0019: Added first-pass capability receipts to dispatch and `/agent/execute`, with safety tests for paid/public blocked context.
- W-0020: Added local deletion and inactivity expiry pruning for scoped paid/client continuity history.
- W-0021: Added structured retrieval audit details to capability receipts for RAG, memory graph, and trajectory context.
- W-0022: Added `OPERATING_LOOP.md` as a day-to-day operator workflow for maintain, receipts, friction, trajectories, and session close.
- W-0029-note: Added `BORROWED_PATTERNS.md` and expanded `MECHANISMS.md` with external pattern translations from Memory OS, Samantha, and Icarus.
- W-0029: Added shared capture eligibility gate for auto-memory staging, trajectory distillation, and trajectory append; social closers and low-substance candidates are skipped or rejected.
- W-0030: Added provenance-required memory class helpers and enforced `reusable_pattern` provenance on trajectory rows.
- W-0031: Added source labels and fallback-path details to retrieval capability receipts.
- W-0023: Added status frontmatter for every `upgrades/active/` note and taught `maintain` to summarize active, integrated, parked, and archived upgrade notes while flagging missing metadata or stale active reviews.
- W-0024: Extended memory validation toward lifecycle metadata by adding topic frontmatter for memory class, source, scope, confidence, freshness, sensitivity, and revocation path; malformed present metadata now fails validation.
- W-0025: Added `capability_receipt.boundary_crossing` with purpose, allowed source context, redaction duty, retention scope, deletion/revocation path, default export posture, and blocked context.
- W-0026: Added constitutional claim manifest coverage to `scripts/prompt_drift_check.mjs` so constitution, prompt-pack, and declared runtime/test anchors are checked by claim ID.
- W-0027: Added default prompt-pack byte budgets to `scripts/prompt_drift_check.mjs` so constitutional compression has a mechanical growth check.
- W-0037: Added `CONSTITUTIONAL_KERNEL.md` as the first-loaded compact live kernel and included it in the default prompt pack.
- W-0038: Forced `paid_public` prompt construction to a client-safe allowlist regardless of `DIZZY_PROMPT_PACK`, with safety coverage against `full` pack leakage.
- W-0039: Borrowed selected `quarqlabs/agent-oss` memory patterns as Dizzy-native contracts: typed/temporal/numeric topic metadata and report-only retrieval plans in capability receipts.
- W-0028: Defined the Trajectory Distillery data contract with allowed/excluded content classes, evidence basis, lossy-risk labels, operator-review requirement, auto-save prohibition, safety tests, and metabolism reporting.
- W-0032: Added report-only memory metabolism scan to `maintain` for trajectory ledger provenance, duplicate patterns, malformed rows, and high-strength/low-confidence contradictions.
- W-0033: Added `MEMORY_OWNERSHIP.md` and maintain coverage check for known memory-like durable surfaces.
- W-0034: Added operator brief to `maintain` with latest commit, open work count, Tier 1 count, next queue item, and visible promotion debt.
- W-0034-note: Aligned prompt retrieval block headers with receipt source labels for trusted markdown, memory graph, and trajectory ledger.
- W-0035-note: Moved optional flavor/economic overlay files into `flavor/` and updated prompt-pack references.
- W-0035: Prototyped three-pool retrieval as report-only (`core`, `stale_important`, `edge_hypothesis`) in retrieval plans and capability receipts, with safety checks preventing auto-promotion or memory writes.
