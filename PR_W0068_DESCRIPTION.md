# PR: W-0068 Model Review Loop, Control Plane, & Router Core Clean

**Branch**: [`codex/w0068-review-loop`](https://github.com/Simultech369/Dizzy-the-Polymath/pull/new/codex/w0068-review-loop)
**Base**: `main` (`aa12518`)
**HEAD**: `4727547`
**Commits**: 33 linear commits
**Verdict**: `OSS Council Audit VERIFIED_PASSED` (17 test suites passing)

---

## 🎯 Overview

This PR delivers the consolidated, clean execution stack for:
1. **W-0066 Router Core Clean**: 8-Division 40-Model Guild Router with request-body receipt proof, local fail-closed isolation, and manual 3xx redirect blocks.
2. **W-0067 Control Plane Slice A**: Ingress gateway with IP normalization, trusted proxy handling, token budget controls, provider circuit-breaker primitives, and SQLite WAL replay leases.
3. **W-0067 Control Plane Slice B**: Trajectory snapshot store with SHA-256 integrity, model & data lineage manifest registry.
4. **W-0068 Model Review Loop Engine**:
   - Review cycle orchestrator & loop supervisor (`lib/review_cycle_orchestrator.mjs`, `lib/review_loop_supervisor.mjs`)
   - Local-fast partial review receipts (`reviewProfile: local_fast`)
   - Groq-fast provider review lane (`--groq-fast`, `--provider-models`)
   - DeepSeek R1 reasoning tag stripper & adapter (`stripReasoningContent`)
   - Evidence-based Provider Capability Matrix (`lib/provider_capability_matrix.mjs`)
   - OpenRouter free/batch slug probe harness (`scripts/openrouter_free_slug_probe.mjs`)

---

## 📦 What's Included

### 1. Model Router & Isolation Core (`W-0066`)
- Replaces synthetic debate theater with honest, real model dispatch across 8 divisions (40 models).
- Enforces `isLocalIsolationRequired` to fail closed on remote cloud calls when operating under private-self trust boundaries.
- Disallows automatic 3xx HTTP redirects to cloud backends.

### 2. Ingress Gateway & Replay Safety (`W-0067`)
- Rate limiting and per-client token budget controls (`lib/ingress_gateway.mjs`).
- SQLite WAL operational store (`lib/sqlite_operational_store.mjs`) for idempotent replay leases and claim safety.
- Trajectory snapshot store (`lib/trajectory_snapshot_store.mjs`) with SHA-256 integrity checks.
- Model and data lineage manifest registry (`lib/model_registry.mjs`).

### 3. Model Review Loop Engine (`W-0068`)
- **Orchestrator & Harnesses**: Deterministic review cycle runner that formats diff packets, evaluates changes through local/provider reviewers, and synthesizes findings into review receipts.
- **Provider Lanes**:
  - `local_fast`: Uses local Ollama models (`gemma3:4b`, `qwen2.5-coder:7b`).
  - `groq_fast`: Uses Groq cloud models (`llama-3.1-8b-instant`, `qwen/qwen3.6-27b`, `openai/gpt-oss-120b`). Key read strictly from ignored `runtime/secrets/GROQ_API_KEY.txt`.
- **Reasoning Model Support**: DeepSeek R1 reasoning adapter strips `<think>` tags and handles empty-string content fallbacks.
- **Capability Matrix**: `dizzy.provider_capability_matrix.v1` tracks model availability, json reliability, latency bands, and trust boundaries. Models default to non-callable/non-review-usable until proven by availability receipts.

---

## 🧪 Verification & Proof

All 17 deterministic test suites passed in `npm run check:council`:

```
==================================================
   Dizzy OSS Model Council Verification Engine    
==================================================

[PASS] Layer 1: All target files passed syntax checks.
[PASS] Layer 2: Governance and isolation policies verified.
[PASS] Layer 3: All 17 deterministic test suites passed!

  PASSED: Router Integration Suite
  PASSED: Model Router Suite
  PASSED: Ingress Gateway Suite
  PASSED: Replay Safety Suite
  PASSED: Trajectory Snapshot Suite
  PASSED: Model Registry Suite
  PASSED: Review Cycle Coverage Suite
  PASSED: Review Cycle Orchestrator Suite
  PASSED: Review Cycle Run Suite
  PASSED: Review Loop Supervisor Suite
  PASSED: Model Review Runner Suite
  PASSED: Review Synthesis Suite
  PASSED: Backend Connection RCA Suite
  PASSED: Provider Capability Matrix Suite
  PASSED: Risk Scaler Suite
  PASSED: Golden Retrieval Eval Suite
  PASSED: Safety Checks Suite

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
