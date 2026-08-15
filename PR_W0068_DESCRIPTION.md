# PR: W-0068 Guided Trust Cockpit & Model Intake Baseline

**Branch**: [`feat/dizzy-general-distro`](https://github.com/Simultech369/Dizzy-the-Polymath/tree/feat/dizzy-general-distro)
**Base**: `main`
**Verdict**: `OSS Council Audit VERIFIED_PASSED` (54 syntax targets, 27 execution suites passing)

---

## 🎯 Overview

This PR delivers the consolidated, clean execution stack for:
1. **Guided Trust Cockpit & Dashboard HUD**:
   - Fixed structural nesting for `#tab-receipts` and top-level tab reachability.
   - Decoupled first-run telemetry from `data.docs.length` for clean clones.
   - Genericized operator branding and exposed standard entry point (`npm start` -> `http://localhost:3000/dashboard`).
2. **Model Intake & Candidate Watchlist**:
   - Structured 14-column candidate evidence matrix in [`MODEL_INVENTORY.md`](MODEL_INVENTORY.md) tracking 16 candidate models (`muse-glimmer`, `deepseek-v4`, `grok-4.5`, `minimax-m3`).
   - Enforced evidence promotion lifecycle (`unverified_candidate` -> `installed/reachable` -> `callable` -> `json_valid` -> `tool_use_valid` -> `quality_valid` -> `review_usable`).
   - Gated unverified candidate models in [`lib/provider_capability_matrix.mjs`](lib/provider_capability_matrix.mjs) and verified gating with unit tests.
3. **W-0066 Router Core Clean**: 8-Division 40-Model Guild Router with request-body receipt proof, local fail-closed isolation, and manual 3xx redirect blocks.
4. **W-0067 Control Plane**: Ingress gateway with IP normalization, trusted proxy handling, token budget controls, provider circuit-breaker primitives, trajectory snapshot store, and SQLite WAL replay leases.
5. **W-0068 Model Review Loop Engine**: Review cycle orchestrator, local-fast and Groq-fast review profiles, DeepSeek R1 reasoning adapter, and OpenRouter free probe harness.

---

## 📦 What's Included

### 1. Guided Trust Cockpit & Public Branding
- Standard `npm start` entry point launching local server and dashboard.
- Un-nested `#tab-receipts` panel ensuring accessibility from the tab bar.
- First-run telemetry rendering on zero-document initial states.
- Clean generic operator branding for public distribution.

### 2. Model Intake Evidence Pipeline
- Explicit promotion pipeline for newly announced models.
- Gated `muse-glimmer:latest` and candidate models with `callable: false` and `json_review_usable: false` until evidence is produced.
- Clarified probe command boundaries (`openrouter-free` vs `ollama-availability` vs `review-models`).

### 3. Model Router & Isolation Core (`W-0066`)
- Real model dispatch across 8 divisions (40 models).
- Enforces `isLocalIsolationRequired` to fail closed on remote cloud calls under `private_self` trust boundaries.
- Disallows automatic 3xx HTTP redirects to cloud backends.

### 4. Ingress Gateway & Replay Safety (`W-0067`)
- Rate limiting and per-client token budget controls (`lib/ingress_gateway.mjs`).
- SQLite WAL operational store (`lib/sqlite_operational_store.mjs`) for idempotent replay leases and claim safety.
- Trajectory snapshot store (`lib/trajectory_snapshot_store.mjs`) with SHA-256 integrity checks.

---

## 🧪 Verification & Proof

All 54 syntax targets and 27 execution suites passed in `npm run check:council`:

```
==================================================
   Dizzy OSS Model Council Verification Engine    
==================================================

[PASS] Layer 1: All 54 target files passed syntax checks.
[PASS] Layer 2: Governance and isolation policies verified.
[PASS] Layer 3: All 27 deterministic test suites passed!

==================================================
   COUNCIL VERDICT: VERIFIED_PASSED (READY FOR STAGING) 
==================================================
```

---

## 🔒 Security & Privacy Boundaries

- No secrets or API keys are committed in code or receipts (`runtime/secrets/` is gitignored).
- Diff packets are redacted before sending to external providers.
- Local isolation policy blocks cloud dispatch when operating in `private_self` mode.
- Audit receipts use `authority: "evidence_not_authority"`.
