# Dizzy Master Handoff for Codex

**To:** Codex
**From:** Antigravity 3.1 Pro
**Timestamp:** 2026-08-28
**Status:** DOCKED, SEALED, PUSHED, AND CODEX-RECONCILED

Codex, you are taking over after a large, highly verified 3-day sprint. The user (Simul) authorized the docking sequence, and the project is in a strong local staging state. Keep proof language bounded to the receipts and checks actually run in this repo.

## 1. The Git State & The "Heavy Commit" Fix
*   **Branch:** `feat/dizzy-general-distro` is pushed and live on the remote through HEAD `2b21e22d17741270e86cfdc23a31c0562bcfb680`; the W-0105 public-view readiness edits in this handoff are local working-tree changes until explicitly staged, committed, and pushed.
*   **The Fix:** During docking, GitHub rejected our push because the simulated toolchains (`codex-bench-tools/llvm-mingw` etc.) exceeded 100MB. I intercepted this, performed a `--soft` reset, repaired the `.gitignore` encoding corruption, removed the tracked `artifacts/` and `scratch/` provenance mess via a corrective commit, and re-pushed. The tracked branch is lean; local ignored or untracked scratch artifacts may still exist and are not committed proof.
*   **Decisions:** D-0039 is formally closed. `NEXT.md` now treats public surface readiness as W-0105, not as a new architecture lane.

## 2. Verification State
*   **55 Suites Green:** The latest local OSS Council audit passes with 111 syntax targets, 55 execution suites, and 2 governance checks.
*   **Latest Receipt:** `reviews/oss_council_verdict_latest.json` at `2026-08-31T10:33:34.822Z`, SHA-256 `6B7BD6B1F9FF8568B8DEFA8D7A0C5F74E9023531414506B0843D70C5746BA099`.
*   **Offline Ingress Proven:** `job_board_scanner.mjs` successfully normalizes job descriptions into Dizzy-local A2A-shaped `dizzy.bounty_a2a_ingest.v1` envelopes with cryptographic receipts. External A2A interoperability is not claimed until signed HTTP/WebSocket receipts exist.
*   **Memory Wiki Guard Registered:** `lib/cognitive_memory_engine.mjs` and `lib/memory_wiki_adapter.mjs` remain separate by design and are both covered by focused tests plus the full council audit.
*   **W-0105 Public-View Guards Added:** `scripts/dashboard_public_surface_test.mjs` verifies neutral dashboard startup copy, stripped decorative surface terms, idempotent chat initialization, dashboard auth/session behavior, and operator JSON routes. `scripts/public_view_readiness_test.mjs` guards README/Quickstart/Runbook/PR truthfulness. Visual browser screenshot proof remains pending; local Edge/Chrome headless capture failed in this sandbox and should not be described as completed.

## 3. UI Mission: Impeccable Anti-Slop Polish
Your immediate UI task is wiring `dashboard/index.html` to the API endpoints and styling the "Cockpit".
*   **The Aesthetic:** Apply the `pbakaus/impeccable` design rules. This means strict, functional, brutalist components. NO purple gradients, NO dark neon glows, NO bouncy easings. Think "Air Traffic Control Terminal."
*   **UI Skill Conflict Warning:** If you are running with `nextlevelbuilder/ui-ux-pro-max-skill`, aggressively override its default soft shadows, depth, and glows. We want a machine-room aesthetic. 
*   **Layout:** 3-pane strict grid: [A] Council Tension Map, [B] Ingress Telemetry, [C] Execution Receipts.

## 4. Memory Architecture: 5-Stage Engine plus LLM-Wiki Adapter
The user surfaced a 5-stage memory pipeline (Capture, Consolidate, Retrieve, Reconcile, Decay), mapped in `C:\Users\Josh\clawd\reviews\memory_engine_design_for_codex.md`.

**CRITICAL NEW ARCHITECTURAL DIRECTIVE:**
Do not use a JSON file or SQLite for the storage layer. We are adopting Andrej Karpathy's "LLM-Wiki" concept. The memory engine compiles and consolidates durable facts into a structured, interlinked **Markdown Wiki** directory (e.g., `memory/wiki/`).
*   **Why:** A Wiki is perfectly transparent, easily hashed/audited by the Council, tracks changes via Git, and prevents context dilution by forcing the agent to use "Traversal Skills" (following links) rather than naive semantic vector dumping.
*   **Boundary:** `cognitive_memory_engine.mjs` owns the five-stage lifecycle, scoring, decay, reconciliation, and A2A memory envelopes. `memory_wiki_adapter.mjs` owns file-system execution, Markdown/frontmatter parsing, path confinement, and physical traversal. Keep the physical room separate from the brain.
*   **Status:** Memory engine, wiki adapter, focused tests, and full council audit registration are complete locally in this branch.

## 5. Critical Short-Term Memory (Context Quirks)
Before you build, keep these environmental quirks in mind:
*   **Redis is Offline:** The local Redis container (`127.0.0.1:6379`) refuses connections right now. Do not build strict blocking dependencies on it. Scripts must gracefully fallback to offline/JSON-mock mode (as implemented in `job_board_scanner.mjs`).
*   **Windows / PowerShell Host:** The host OS is Windows. `grep` and `head` are not natively available in the standard shell. Ensure Node paths use `import { fileURLToPath }` and `path.resolve()` rather than hardcoded slashes.
*   **A2A Envelopes:** Treat `artifacts/bounty_scan_results.json` as an untracked local proof artifact, not a production trust source. The receipt schema and signed payload validation should be the protocol boundary.

Proceed with proof-bound surface checks. Do not expand architecture until the public README, PR body, and dashboard proof boundary are clean.
