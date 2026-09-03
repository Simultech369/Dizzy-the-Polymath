# Codex 5.5 Handoff Document

**Date**: 2026-08-11
**Prepared By**: Gemini 3.6 Flash (verified alongside Claude Opus 4.6)
**Target Agent**: Codex 5.5
**Primary Repo**: `<local-clawd-checkout>`
**W-0068 Worktree**: `<local-clawd-checkout>\.extraction\clawd-w0068-review-loop`

---

## 1. Executive Summary & Verification Findings

1. **Clean Commit Lineage Verified**:
   - `origin/main` (`7bce860`) → `main` (`aa12518`) → `codex/w0066-router-core-clean` (`4cef225`) → `codex/w0067-slice-a` (`edb2e04`) → `codex/w0067-slice-b` (`9504a59`).
   - Total **19 linear commits** ahead of `origin/main` on `codex/w0067-slice-b`.
   - Fast-forward merge (`git merge --ff-only`) from `main` to `codex/w0067-slice-b` is tested and **verified safe** (`merge-base --is-ancestor` returned 0).

2. **Isolated Overclaim Branch**:
   - `feat/w0066-router-core` (`610b850`) has 15 exclusive commits containing synthetic multi-agent debate, fake token streaming, self-instruct harvesters, and overclaim text.
   - It is safely isolated on its own branch and does NOT pollute `codex/w0067-slice-b` or `main`.

3. **Zero-Data-Loss Cleanup**:
   - **No files were deleted from disk.**
   - `.gitignore` was updated to ignore `.extraction/`, `reviews/`, `artifacts/`, and `codex-bench-*/` so git status remains clean while retaining all historical reviews, daily logs, and extraction clones on disk.
   - Untracked experimental files (`lib/bridging_scan.mjs`, `lib/options_projection.mjs`, `lib/scenario_simulator.mjs`, `skills/rhythm-coaching/`) are intact and preserved.

---

## 2. Active Worktree State (W-0068 Review Loop)

- **Directory**: `<local-clawd-checkout>\.extraction\clawd-w0068-review-loop`
- **Branch**: `codex/w0068-review-loop`
- **Committed HEAD**: `dc40cd5` ("feat(review): add local-fast partial model review receipts")
- **Uncommitted Groq-Lane Edits**:
  - `lib/review_model_runner.mjs`
  - `scripts/review_model_batch.mjs`
  - `scripts/review_model_runner_test.mjs`
- **Secret Key Boundary**:
  - `.extraction\clawd-w0068-review-loop\runtime\secrets\GROQ_API_KEY.txt` (gitignored, MUST NOT be committed).

### Groq Verification Status
- Deterministic Groq provider path implemented locally.
- Live local-fast Ollama proof: 3 submitted JSON reviews, 0 parse failures.
- Live Groq API check confirmed valid keys for models: `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `qwen/qwen3.6-27b`, `openai/gpt-oss-120b`, `allam-2-7b`.
- **Boundary Warning**: Live Groq review was blocked when attempted because it would upload private workspace diff content to an external provider. Groq reviews must remain operator-triggered only or use sanitized/minimized packets with explicit operator approval.

---

## 3. Recommended Backlog for Codex 5.5

### Immediate Tasks (W-0068 Groq Lane Closure)
1. **Complete Uncommitted Groq Edits**:
   - Add model execution profiles for Groq models (`local_fast`, `groq_fast`, `provider_fast`).
   - Add `--groq-fast` CLI mode.
   - Ensure Groq key is read strictly from `runtime/secrets/GROQ_API_KEY.txt`.
   - Verify receipts remain credential-free.
   - Run verification: `npm run test:review-models`.

2. **Task 1: DeepSeek R1 Adapter / Proof Harness**:
   - `deepseek-r1:7b` must submit valid final JSON twice or remain quarantined as `auxiliary_only` / `callable_but_not_review_usable`.

3. **Task 2: Probe OpenRouter Free Slugs**:
   - Probe exact slugs for Nemotron, Liquid, GLM, Kimi.
   - Write availability receipts with exact slug, status, latency, parse result, and error class.

4. **Task 3: Build Provider/Model Capability Matrix**:
   - Fields: `installed`, `callable`, `returns_normal_content`, `returns_auxiliary_only`, `json_review_usable`, `expected_latency_band`, `preferred_lens`, `avoid_for`, `provider_boundary`.

### Landing & Shipping Strategy (When Ready)
1. Commit W-0068 in the extraction clone.
2. Fast-forward or merge W-0068 into `codex/w0067-slice-b` / `main`.
3. Run full gate verification:
   - `npm run test:model-router`
   - `npm run test:router`
   - `npm run test:ingress-gateway`
   - `npm run test:replay-safety`
   - `npm test`
   - `npm run check:council`
4. Request explicit operator approval, then push to GitHub (`git push origin main`).

---

## 4. Operational Handshake Commands

To inspect w0068 in the extraction directory:
```powershell
cd <local-clawd-checkout>\.extraction\clawd-w0068-review-loop
git status --short --branch
npm run test:review-models
```

To run main repo safety checks:
```powershell
cd <local-clawd-checkout>
npm test
npm run check:council
```
