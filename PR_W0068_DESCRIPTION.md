# PR: W-0068 Guided Trust Cockpit & Model Intake Baseline

**Branch**: [`feat/dizzy-general-distro`](https://github.com/Simultech369/Dizzy-the-Polymath/tree/feat/dizzy-general-distro)
**Base**: `main`
**Verdict**: `OSS Council Audit VERIFIED_PASSED` (105 syntax detail entries, 51 execution suites, 2 governance checks; anchored to latest checked local receipt `reviews/oss_council_verdict_latest.json` as of `2026-08-28T03:10:46.075Z`, SHA-256 `7A85640464336AAA9A1E6EBCF3B7FD93DE36CA8AC921FE3CB46A3C5298AB6F61`)

---

## Overview

This PR delivers the consolidated, clean execution stack for:
1. **Guided Trust Cockpit & Dashboard HUD**:
   - Fixed structural nesting for `#tab-receipts` and top-level tab reachability.
   - Decoupled first-run telemetry from `data.docs.length` for clean clones.
   - Genericized operator branding and exposed standard entry point (`npm start` -> `http://localhost:3000/dashboard`).
2. **Model Intake & Candidate Watchlist**:
   - Structured 14-column candidate evidence matrix in [`MODEL_INVENTORY.md`](MODEL_INVENTORY.md) tracking 16 candidate models (`muse-glimmer`, `deepseek-v4`, `grok-4.5`, `minimax-m3`).
   - Enforced evidence promotion lifecycle (`unverified_candidate` -> `installed/reachable` -> `callable` -> `json_valid` -> `tool_use_valid` -> `quality_valid` -> `review_usable`).
   - Gated unverified candidate models in [`lib/provider_capability_matrix.mjs`](lib/provider_capability_matrix.mjs) and verified gating with unit tests.
3. **Probe Harness Hardening (Windows Environment)**:
   - Preserved system `LOCALAPPDATA` in Ollama probe runner so Windows native runner binaries/DLLs are located properly.
   - Added graceful offline recovery in [`scripts/ollama_availability_check.mjs`](scripts/ollama_availability_check.mjs) so probe runs return structured JSON receipts without throwing unhandled exceptions.
4. **W-0066 Router Core Clean**: 8-Division 40-Model Guild Router with request-body receipt proof, local fail-closed isolation, and manual 3xx redirect blocks.
5. **W-0067 Control Plane**: Ingress gateway with IP normalization, trusted proxy handling, token budget controls, provider circuit-breaker primitives, trajectory snapshot store, and SQLite WAL replay leases.
6. **W-0068 Model Review Loop Engine**: Review cycle orchestrator, local-fast and Groq-fast review profiles, DeepSeek R1 reasoning adapter, and OpenRouter free probe harness.
7. **W-0097 Deterministic Lifecycle Hooks**: SessionStart/Stop receipts at ingress plus PreToolUse/PostToolUse receipts around the shared Node tool runner, with hash-only payload/output evidence and fail-closed risky tool preflight.
8. **W-0098 Structural Query Cache**: Local dashboard query cache with receipt-keyed trust-zone, retention, prompt/config, markdown source-signature, and hashed partition boundaries before any embedding-based semantic cache.
9. **W-0099 Streaming Response Hardening**: Authenticated SSE execution route with event IDs, bounded backpressure waits, request-abort propagation into provider calls, hash-only stream receipts, and terminal partial-failure/disconnect evidence.
10. **W-0102 External Pattern Provenance Guard**: Deterministic audit-ledger check for borrowed-pattern source inventory, borrowing class, disposition, quarantine clone paths, Apache/NOTICE reminders, and public-release remediation gates.
11. **W-0100 Control-Plane Bridges**: StateM-style runbook FSM, bounty EV triage, A2A-style local mailbox handoff packets, job-board normalization, tension-map telemetry, and third-party notice generation under local receipt gates.
12. **W-0103 Council Subcommittee Router**: Role rotation scheduler across 6 committee archetypes, dialectical tension synthesis, quorum calculation, and A2A verdict packetizing.
13. **W-0104 Bounty Board Scanner**: External listing ingress scanner with canonical worker-queue dispatch, deterministic offline proof artifacts, and council-registered scanner coverage.

---

## What's Included

### 1. Guided Trust Cockpit & Public Branding
- Standard `npm start` entry point launching local server and dashboard.
- Un-nested `#tab-receipts` panel ensuring accessibility from the tab bar.
- First-run telemetry rendering on zero-document initial states.
- Clean generic operator branding for public distribution.

### 2. Model Intake Evidence Pipeline
- Explicit promotion pipeline for newly announced models.
- Gated `muse-glimmer:latest` and candidate models with `callable: false` and `json_review_usable: false` until evidence is produced.
- Clarified probe command boundaries (`openrouter-free` vs `ollama-availability` vs `review-models`).

### 3. Model Router & Isolation Core (W-0066)
- Real model dispatch across 8 divisions (40 models).
- Enforces `isLocalIsolationRequired` to fail closed before the first network fetch on remote cloud calls under `private_self` trust boundaries.
- Disallows automatic 3xx HTTP redirects to cloud backends.

### 4. Ingress Gateway & Replay Safety (W-0067)
- Rate limiting and per-client token budget controls (`lib/ingress_gateway.mjs`).
- SQLite WAL operational store (`lib/sqlite_operational_store.mjs`) for idempotent replay leases and claim safety.
- Trajectory snapshot store (`lib/trajectory_snapshot_store.mjs`) with SHA-256 integrity checks.

---

## Verification & Proof

All 105 syntax detail entries, 51 execution suites, and 2 governance checks passed in the latest local `npm run check:council` receipt:

```
==================================================
   Dizzy OSS Model Council Verification Engine
==================================================

[PASS] Layer 1: All target files passed syntax checks. (105 checked)
[PASS] Layer 2: Governance and isolation policies verified.
[PASS] Layer 3: All deterministic test suites passed. (51 checked)

==================================================
   COUNCIL VERDICT: VERIFIED_PASSED (READY FOR STAGING)
==================================================
```

Receipt: `reviews/oss_council_verdict_latest.json`
Timestamp: `2026-08-28T03:10:46.075Z`
SHA-256: `7A85640464336AAA9A1E6EBCF3B7FD93DE36CA8AC921FE3CB46A3C5298AB6F61`

Receipt hashes are per-run evidence. If `npm run check:council` is rerun, refresh the timestamp/hash against the local receipt before public reuse.

Focused W-0099 guard: `npm run test:streaming-response`
Focused W-0100 guards: `npm run test:statem-runbook`; `npm run test:a2a-mailbox`; `npm run test:bounty-hunter`; `npm run test:job-board-tension`; `npm run test:operator-telemetry`
Focused W-0102 guard: `npm run check:pattern-provenance`
Focused W-0103 guard: `npm run test:subcommittee-router`
Focused W-0104 guard: `npm run test:job-board-scanner`

---

## Security & Privacy Boundaries

- No secrets or API keys are committed in code or receipts (`runtime/secrets/` is gitignored).
- Diff packets are redacted before sending to external providers.
- Direct local control routes require operator authentication by default; loopback alone is not treated as identity.
- Local isolation policy blocks cloud dispatch when operating in `private_self` mode, even when cloud execution is otherwise allowed.
- Audit receipts use `authority: "evidence_not_authority"`.
- Local availability and council receipts (`reviews/*_latest.json`) remain local-only untracked evidence files to prevent git history receipt churn.
