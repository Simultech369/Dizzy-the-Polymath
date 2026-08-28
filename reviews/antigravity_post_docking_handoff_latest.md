# Dizzy Master Handoff for Codex

**To:** Codex
**From:** Antigravity 3.1 Pro
**Timestamp:** 2026-08-28
**Status:** DOCKED, SEALED, AND PUSHED

Codex, you are taking over after a massive, highly-verified 3-day sprint. The user (Simul) authorized the docking sequence, and the project is currently in a mathematically sound, 100% green state.

## 1. The Git State & The "Heavy Commit" Fix
*   **Branch:** `feat/dizzy-general-distro` is pushed and live on the remote.
*   **The Fix:** During docking, GitHub rejected our push because the simulated toolchains (`codex-bench-tools/llvm-mingw` etc.) exceeded 100MB. I intercepted this, performed a `--soft` reset, repaired the `.gitignore` encoding corruption, removed the tracked `artifacts/` and `scratch/` provenance mess via a corrective commit, and re-pushed. The repository is now strictly lean code. 
*   **Decisions:** D-0039 is formally closed. 

## 2. Verification State
*   **51 Suites Green:** The OSS Council audit passes perfectly. We have 105 syntax checks, 51 execution suites (including Anti-Slop Fixtures, SRE bounds, and Circuit Breakers), and 2 governance checks passing.
*   **Offline Ingress Proven:** `job_board_scanner.mjs` successfully normalizes job descriptions into strict `dizzy.bounty_a2a_ingest.v1` A2A envelopes with cryptographic receipts.

## 3. UI Mission: Impeccable Anti-Slop Polish
Your immediate UI task is wiring `dashboard/index.html` to the API endpoints and styling the "Cockpit".
*   **The Aesthetic:** Apply the `pbakaus/impeccable` design rules. This means strict, functional, brutalist components. NO purple gradients, NO dark neon glows, NO bouncy easings. Think "Air Traffic Control Terminal."
*   **UI Skill Conflict Warning:** If you are running with `nextlevelbuilder/ui-ux-pro-max-skill`, aggressively override its default soft shadows, depth, and glows. We want a machine-room aesthetic. 
*   **Layout:** 3-pane strict grid: [A] Council Tension Map, [B] Ingress Telemetry, [C] Execution Receipts.

## 4. Architecture Mission: 5-Stage Memory Engine (LLM-Wiki)
Codex, I see you have already started `lib/cognitive_memory_engine.mjs`. Excellent. 
The user surfaced a brilliant 5-stage memory pipeline (Capture, Consolidate, Retrieve, Reconcile, Decay) inspired by 0xWast3, which I mapped in `C:\Users\Josh\clawd\reviews\memory_engine_design_for_codex.md`.

**CRITICAL NEW ARCHITECTURAL DIRECTIVE:**
Do not use a JSON file or SQLite for the storage layer. We are adopting Andrej Karpathy's "LLM-Wiki" concept. The memory engine must compile and consolidate its facts into a highly structured, interlinked **Markdown Wiki** directory (e.g., `memory/wiki/`). 
*   **Why:** A Wiki is perfectly transparent, easily hashed/audited by the Council, tracks changes via Git, and prevents context dilution by forcing the agent to use "Traversal Skills" (following links) rather than naive semantic vector dumping.
*   **Action:** Wire `lib/cognitive_memory_engine.mjs` to read/write/decay Markdown files. Once complete, register `scripts/cognitive_memory_engine_test.mjs` in `scripts/oss_council_audit.mjs` and run full checks.

## 5. Critical Short-Term Memory (Context Quirks)
Before you build, keep these environmental quirks in mind:
*   **Redis is Offline:** The local Redis container (`127.0.0.1:6379`) refuses connections right now. Do not build strict blocking dependencies on it. Scripts must gracefully fallback to offline/JSON-mock mode (as implemented in `job_board_scanner.mjs`).
*   **Windows / PowerShell Host:** The host OS is Windows. `grep` and `head` are not natively available in the standard shell. Ensure Node paths use `import { fileURLToPath }` and `path.resolve()` rather than hardcoded slashes.
*   **A2A Envelopes:** Trust the generated JSON payload structure in `artifacts/bounty_scan_results.json`. The `CrossProjectDispatchReceipt` and `council_directives` keys are exact and must be maintained.

The engine is lean, fast, and yours to drive. Proceed.
