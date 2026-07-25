# Multi-Model OSS Synthesis Ledger

**Date**: 2026-07-23
**Status**: Active Decision Artifact (`Brand & Architecture Gate`)
**Evaluated Snapshot**: `reviews/oss-feedback-20260723-180806/`
**Evaluated Models**: `deepseek-coder-v2:16b`, `gemma3:12b`, `llama3.1:latest`, `qwen2.5-coder:7b` (5.6 pass)

---

## 1. Model Lane Breakdown

| Model Lane | Primary Focus Area | Evaluated File Artifact |
| --- | --- | --- |
| **DeepSeek-Coder-v2:16b** | Runtime JS contract safety, import path stability, dashboard HTML/JS reconciliation | [`deepseek-coder-v2_16b.md`](oss-feedback-20260723-180806/deepseek-coder-v2_16b.md) |
| **Gemma3:12b** | Onboarding ergonomics, README density, documentation legibility, visual identity | [`gemma3_12b.md`](oss-feedback-20260723-180806/gemma3_12b.md) |
| **Llama3.1:latest** | Repo structure, directory categorization, multi-project file organization | [`llama3.1_latest.md`](oss-feedback-20260723-180806/llama3.1_latest.md) |
| **Qwen2.5-Coder:7b (5.6)** | Slice boundary integrity, dependency analysis, hidden coupling risks in `lib/*.mjs` | [`qwen2.5-coder_7b.md`](oss-feedback-20260723-180806/qwen2.5-coder_7b.md) |

---

## 2. Strongest Useful Signal vs. Weak/Rejected Signal

### A. DeepSeek-Coder-v2:16b
* **Strongest Useful Signal**: Identified the high-risk hidden coupling between `dashboard/index.html` and `dashboard/dashboard.js`. Correctly warned that dashboard HTML and JS must be refactored together or not at all to avoid breaking execution receipt UI contracts.
* **Weak / Rejected Signal**: Suggested running early import path refactoring across core libraries (`lib/client_continuity.mjs`, `lib/consensus.mjs`, `lib/memory_graph.mjs`) before completing onboarding documentation.
* **Disposition**: **ACCEPTED (WITH FILTERING)** - Retain dashboard contract warning as a strict exclusion gate.

### B. Gemma3:12b
* **Strongest Useful Signal**: Identified that documentation was too dense and technical for immediate onboarding. Strongly recommended prioritizing a plain-English "First Run" guide (`QUICKSTART.md`) and a high-level "Clawd Navigator" taxonomy map before touching complex JS runtimes.
* **Weak / Rejected Signal**: Suggested deep-diving into individual review artifacts (`reviews/*.md`) to write summaries.
* **Disposition**: **ACCEPTED (HIGH VALUE)** - Directly drove the successful implementation of `QUICKSTART.md` and `REPO_GUIDE.md` (commit `24fe1a3`).

### C. Qwen2.5-Coder:7b (5.6 Pass)
* **Strongest Useful Signal**: Correctly highlighted the risk of hidden runtime coupling and churn when touching multiple core modules (`lib/client_continuity.mjs`, `lib/consensus.mjs`) simultaneously.
* **Weak / Rejected Signal**: Suggested generic, non-repo-accurate verification commands (`npm run lint`, `npm run format`, `npm test -- integration`) that do not match Clawd's native maintenance suite (`npm.cmd run maintain`, `npm.cmd run smoke`).
* **Disposition**: **ACCEPTED (DIRECTIONALLY)** - Used as rationale for keeping the onboarding slice strictly docs-only.

### D. Llama3.1:latest
* **Strongest Useful Signal**: Noticed that the `reviews/` directory contained many scattered review notes that required clear organization and classification in `FILE_ROLES.md`.
* **Weak / Rejected Signal**: Recommended *excluding* documentation updates and focusing immediately on code/scenarios-directly conflicting with the primary goal of making the codebase approachable.
* **Disposition**: **REJECTED** - Excluding documentation would perpetuate the onboarding friction identified by Gemma and DeepSeek.

---

## 3. Consensus Findings & Disagreements

### Consensus Points
1. **Onboarding First**: All models (except Llama) agreed that documentation legibility and onboarding orientation are the highest-ROI, lowest-risk immediate wins.
2. **Dashboard Volatility**: DeepSeek, Gemma, and Qwen agreed that `dashboard/index.html` and `dashboard/dashboard.js` carry high contract breakage risk and should not be edited without a dedicated reconciliation plan.
3. **Repository Legibility**: All models agreed that the proliferation of review documents in `reviews/` creates cognitive load unless bounded by a clear navigator.

### Key Disagreements
* **Scope Sequencing**: Llama3.1 recommended diving directly into W-0062 code, whereas Gemma3 and DeepSeek recommended parking code work until onboarding and documentation reconciliation are locked.

---

## 4. Candidate Test Assertions

Derived mechanically from model critiques for future implementation slices:

1. **Dashboard Contract Linter Assertion** (`scripts/check-brand-compliance.js`):
   - Assert zero inline `style="..."` attributes in `dashboard/index.html`.
   - Assert that script imports match exact relative paths without inline execution logic.
2. **Anti-Slop Scanner Assertion** (`lib/anti_slop_scanner.mjs` for W-0062):
   - Assert zero un-themed visual gradient paint in CSS files.
   - Assert sycophancy bounds and sentence rhythm constraints in prompt-pack outputs.
3. **Documentation Reference Integrity** (`scripts/maintain.mjs`):
   - Assert zero machine-specific absolute file URIs (`file:///c:/...`) in markdown documentation.

---

## 5. Next-Slice Recommendation & Exclusions

### Recommended Sequence
1. **Onboarding v0 (DONE)**: Local commit `24fe1a3` (`QUICKSTART.md`, `README.md`, `REPO_GUIDE.md`, `FILE_ROLES.md`).
2. **Synthesis Ledger (THIS SLICE)**: Lock `reviews/oss_model_synthesis_ledger.md` as the authoritative decision artifact.
3. **W-0062 Anti-Slop Scanner Definition (NEXT)**: Define scanner rules, sycophancy parameters, and false-positive boundaries in `upgrades/active/` before writing scanner code.
4. **Dashboard Reconciliation Plan (PARKED)**: Design a joint HTML/JS refactoring plan with CSP test assertions before modifying dashboard files.

### Hard Stop Conditions & Exclusions
In this synthesis slice, DO NOT modify:
- `lib/*`
- `dashboard/*`
- W-0062 scanner runtime code
- Prototype / scenario files
- Memory files

---

## 6. Dropped & Deferred Claims Appendix (W-0062 / W-0063 Discipline)

| Source Model | Claim / Proposal | Classification | Disposition | Rationale & Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **DeepSeek R1 (7B)** | Formal proof verification gating before any UI refactoring | Governance Rule | **ACCEPTED** | Confirms dashboard volatility guardrail; dashboard changes require CSP test harness first. |
| **GLM4 / Kimi (Long-Context)** | Automated CI/CD version control command checks | Feature Proposal | **DEFERRED** | Maintainer script `npm run maintain` already handles local checks; CI automation deferred to avoid scope churn. |
| **Terra / Mistral (Cleanup)** | Forced git worktree cleaning / stashing of untracked backlog | Cleanup Rule | **REJECTED** | Worktree backlog is intentionally dirty/untracked; forced clean or reset violates pause boundary. |
| **Qwen 2.5 Coder 7B** | Automate git snapshot gate into CI/CD pipeline | Feature Proposal | **DEFERRED** | Snapshot gate is an operator-controlled handoff tool; automating into CI/CD prematurely adds pipeline complexity. |
| **Qwen 2.5 Coder 7B** | Continuous background file linter on `lib/*` | Code Change | **REJECTED** | Off-limits rule: `lib/*` is parked until an explicit runtime slice is selected. |
| **Llama-Audit** | Immediate refactoring of dashboard HTML/JS | Code Change | **REJECTED** | Disregards dashboard volatility warning; high breakage risk without CSP test suite. |
| **DeepSeek 16B** | Early import path refactoring across core modules | Refactoring | **REJECTED** | Violates minimality boundary; creates unverified cross-module churn. |
| **Laguna XS 2.1** | Unprompted secret scrubbing / git history rewrite | Provenance Hazard | **REJECTED** | Violates §5b integrity clause; non-auditable history modification. |



