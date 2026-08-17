# Model Inventory & OSS Council Architecture

status: active inventory & council specification
reviewed: 2026-08-17

Purpose: maintain model availability, routing posture, 4-gate qualification ladder, route attestations, and dual-chain multi-agent council verification. This file is an operational catalog and authority boundary specification.

---

## 1. Dual-Chain Multi-Agent Council Architecture

```
                              ┌────────────────────────────────────────┐
                              │      Local Repo Snapshot & Diff        │
                              │  (Head commit, staged/unstaged blobs)  │
                              └───────────────────┬────────────────────┘
                                                  │
               ┌──────────────────────────────────┴──────────────────────────────────┐
               ▼                                                                     ▼
 ┌───────────────────────────┐                                         ┌───────────────────────────┐
 │ 🔴 ADVERSARIAL RED-TEAM   │                                         │ 🟢 QUALIFIED VOTER SEATS  │
 │ • Jiunsong Supergemma-12b │                                         │ • Qwen-3.8 / Qwen2.5-Coder│
 │ • Jiunsong SuperDeepseek  │                                         │ • GLM-5.3 / GLM-4         │
 │   (Uncensored GGUFs)      │                                         │ • Mistral Lineage         │
 │                           │                                         │                           │
 │ Role: Construct hostile   │                                         │ Role: Grounded code audit │
 │ receipts without corporate│                                         │ & structured voting.      │
 │ RLHF refusal filters.     │                                         │                           │
 └─────────────┬─────────────┘                                         └─────────────┬─────────────┘
               │                                                                     │
               │                                                                     │
               ▼                                                                     ▼
 ┌───────────────────────────┐                                         ┌───────────────────────────┐
 │ 🛡️ VERIFIER ADVERSARIAL   │                                         │ ⚖️ COUNCIL VOTE BALLOT    │
 │ Assert all 11 invariants, │ ◄───────────────────────────────────────┤ • N=3 distinct families   │
 │ hash-links & constraints. │                                         │ • Approvals >= ceil(2N/3) │
 └─────────────┬─────────────┘                                         └─────────────┬─────────────┘
               │                                                                     │
               ▼                                                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                        Execution Sandbox (Docker --network none, pytest)                        │
 │                                                ▼                                                │
 │                             ApplyAuthorizationReceipt (Human Signed)                            │
 └─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 4-Gate Model Qualification Engine

Every model candidate moves through explicit deterministic qualification gates before promotion to active voting council seats:

```
[MODEL IN CATALOG]
        │
        ▼ (Gate 1: Schema Conformance & Syntax Test — JSON Output Strictness)
        ▼ (Gate 2: Benign Control Test — Zero Phantom Hallucinations on Clean Fixtures)
        ▼ (Gate 3: Grounded Bug Detection — Identifies Exact Vulnerable File & Line)
        ▼ (Gate 4: Issues Sealed ModelQualificationReceipt)
        │
        ├──► Status: REVIEW_USABLE_FRESH ──► Eligible for Frozen Council Roster & Voting Ballot
        └──► Failed Gate ───────────────► Quarantined / Auxiliary Only (Blocked from Voting)
```

---

## 3. The 48-Model Roster Breakdown

| Tier & Category | Count | Primary Role & Route Compliance | Key Model Instances |
| :--- | :---: | :--- | :--- |
| **👑 Tier 0: Apex Paid Judges** | 5 | Escalation, high-stakes tie-breaking<br>• Route: `APEX_PAID` (SQLite spend ledger reservation) | `GPT-5.6 Sol`, `GPT-5.3 Codex`, `Claude 3.7 Sonnet Thought`, `Gemini 3.1 Pro Preview`, `o3-high` |
| **🚀 Tier 1: Frontier Cloud & SOTA Open Models** | 12 | Frontier synthesis & specialist audits<br>• Route: `HOSTED_NO_TRAIN` / ZDR Verified<br>• Providers: SiliconFlow, Groq, Google AI Studio | `Qwen-3.8 Coder`, `GLM-5.3 Cyber`, `qwen/qwen3.6-27b`, `Gemini 3.6 Flash 1M`, `DeepSeek-V3/V4`, `openai/gpt-oss-120b`, `minimax-m3` |
| **💻 Tier 2: Local OSS Fast Workers & Reasoners** | 14 | Rapid local audit, zero data leakage<br>• Route: `LOCAL_ONLY_VERIFIED`<br>• Provider: Air-gapped Ollama / Localhost | `qwen2.5-coder:7b`, `deepseek-r1:7b`, `deepseek-r1:1.5b`, `glm4:latest`, `mistral:latest`, `gemma3:4b`, `gemma3:12b`, `llama-audit:latest`, `phi-4`, `granite-3.1` |
| **🎭 Tier 3: Uncensored Adversarial Red-Team Scouts** | 6 | Hostile fuzzer & pre-dispatch red-team<br>• Route: `LOCAL_ONLY_VERIFIED`<br>• Goal: Invariant attack without RLHF refusal filters | `Jiunsong SuperGemma-12B/26B GGUFs`, `SuperDeepseek-V4`, `SuperQwen-AgentWorld`, `Hermes 3`, `Tulu 3` |
| **🚫 Tier 4: Quarantined / Purged Legacy** | 11 | Blocked from active dispatch<br>• Harnesses mislabeled as models or obsolete weights | `Promptfoo`, `Aider`, `DSPy`, `SWE-agent`, `OpenHands`, `WizardCoder`, `Phind`, `StarCoder2`, `Arctic`, `01.AI Zero`, `DeepGrove` |
| **TOTAL REGISTERED** | **48** | **Tracked with typed qualification status** | |

---

## 4. Route Attestations & Data Boundaries

Production routes are sealed with cryptographic SHA-256 digests, strict TTL boundaries, and zero-data-retention (ZDR) policy enforcement:

1. **Jiunsong SuperGemma 12B / Local GGUFs**:
   * `route_id`: `route_jiunsong_supergemma_12b_local`
   * `compliance_tier`: `LOCAL_ONLY_VERIFIED` (Air-gapped localhost, zero retention, cloud fallback blocked)
2. **GLM-5.3 Cyber & Code (SiliconFlow / Cloud)**:
   * `route_id`: `route_glm_5_3_siliconflow`
   * `compliance_tier`: `HOSTED_NO_TRAIN` (ZDR verified, cloud fallback blocked)
3. **Qwen-3.8 Frontier (SiliconFlow / Groq)**:
   * `route_id`: `route_qwen_3_8_frontier`
   * `compliance_tier`: `HOSTED_NO_TRAIN` (ZDR verified, cloud fallback blocked)
4. **DeepSeek-R1 Reasoning (SiliconFlow / Local Ollama)**:
   * `route_id`: `route_deepseek_r1_reasoning`
   * `compliance_tier`: `HOSTED_NO_TRAIN` / `LOCAL_ONLY_VERIFIED`
5. **Gemini-3.6-Flash Public 1M Slicer (Google AI Studio)**:
   * `route_id`: `route_gemini_3_6_flash`
   * `compliance_tier`: `PUBLIC_PROVENANCE_ONLY` (Open-source diff slicing and broad repo index analysis)

---

## 5. Current Local Ollama Roster Status

Observed via live local probe on 2026-08-17 (`reviews/ollama_availability_latest.json`):

| Model | Size | Status | Qualification Gate | Lens / Suggested Use |
| :--- | ---: | :--- | :--- | :--- |
| `gemma3:4b` | 3.11 GB | Online (5.41s) | `REVIEW_USABLE_FRESH` | Local/offline sanity, governance bounds |
| `deepseek-r1:1.5b` | 1.04 GB | Online (8.30s) | `REVIEW_USABLE_FRESH` | Cheap local reasoning probe, smoke tests |
| `qwen2.5-coder:7b` | 4.36 GB | Online (60.91s) | `REVIEW_USABLE_FRESH` | Implementation review, fixture adequacy |
| `mistral:latest` | 4.07 GB | Online (43.66s) | `REVIEW_USABLE_FRESH` | Instruction following, wording sanity |
| `llama-audit:latest` | 4.58 GB | Online (70.08s) | `REVIEW_USABLE_FRESH` | Security review, adversarial policy checks |
| `deepseek-r1:7b` | 4.36 GB | Online (29.18s) | `REASONING_ADAPTER_ONLY` | Step-by-step logic, unstripped thinking |
| `glm4:latest` | 5.08 GB | Online | `REVIEW_USABLE_FRESH` | Alternate local synthesis, general critique |
| `gemma3:12b` | 7.59 GB | Online | `REVIEW_USABLE_FRESH` | Deeper local synthesis, high-resource pass |
| `deepseek-coder-v2:16b`| 8.29 GB | Online | `CANDIDATE` | Deep code reasoning |
| `qwen3.6:27b-q4_K_M` | 16.22 GB | Online | `CANDIDATE` | Heavy local coding & architectural review |
| `yi:latest` | 3.24 GB | Online | `CANDIDATE` | General synthesis |

---

## 6. Verification & Governance Invariants

1. **Dual-Chain Verification**:
   * Minimum working quorum requires $N=3$ distinct model families (e.g. Qwen + GLM + Mistral).
   * Consensus threshold requires $\ge \lceil 2N/3 \rceil$ approvals for `APPROVED` verdict.
2. **Authority Separation**:
   * Automation proposes state transitions (`ready-for-review`, `fixture-required`, `quarantine`, `split`, `reject`).
   * Operator human signature is required on `ApplyAuthorizationReceipt` for irreversible execution or deployment.
3. **Spend Ledger**:
   * Windows-native SQLite spend ledger triggers enforce hard token/cost caps before dispatching Tier 0/1 cloud routes.
4. **Receipt Grounding**:
   * All audit and council receipts use `authority: "model_output_is_claims_only_local_evidence_decides"`.

---

## 7. Specialized Harnesses & Pipeline Scaffolds

Harnesses are not voting model weights; they operate as specialized subsystem drivers in Dizzy's build and verification pipeline:

| Harness | Subsystem Role | Mechanism & Dizzy Integration Surface |
| :--- | :--- | :--- |
| 🎯 **Promptfoo** | Invariant Fuzzer & Security Gate | Automated red-teaming CI fuzzer asserting that `private_self` diffs never leak to cloud endpoints and prompt injection attempts are neutralized by `lib/janitor.mjs`. |
| 📐 **DSPy** | Prompt Compiler & Signature Optimizer | Compiles and optimizes JSON-strict prompts and few-shot examples for smaller local models (`gemma3:4b`, `deepseek-r1:1.5b`) against Gate 1 (JSON strictness) and Gate 2 (benign control). |
| ⚡ **Aider** | AST Patch Builder & File Committer | Universal tree-sitter AST repo-map patch generator for executing approved multi-file code modifications in disposable worktrees without manual replacement toil. |
| 🛡️ **SWE-agent** / **OpenHands** | Air-Gapped Rehearsal Sandbox | Isolated container execution environment (`docker --network none`) running rehearsal gate migrations and trajectory replays before `ApplyAuthorizationReceipt` is signed. |

---

## 8. Sovereign Dispatch Satellites & Ecosystem Integrations

| Project | Surface / Role | Architecture & Integration |
| :--- | :--- | :--- |
| 🪐 **Gitlawb / Zero** (`Gitlawb/zero`) | Sovereign Dispatch Satellite | Model-agnostic terminal coding agent supporting decentralized repo collaboration, cryptographic commit signing, and local session isolation. Bridges to Dizzy via signed `dizzy.router_receipt.v1` evidence envelopes. |
| 🐜 **InclusionAI / Ling-3.0** (`inclusionAI`) | Sub-Second Janitor & Local Classifier | Ultra-lightweight open-source models (`Ling-3.0-tiny`, `Ling-3.0-flash`) for instant pre-route sanitization, diff chunk classification, and context budgeting. |
| 🎙️ **InclusionAI / Ming-omni-tts** | Air-Gapped Audio Synthesizer | Local, zero-data-retention speech synthesis engine for Dizzy's voice channel (`TOOLS.md`), eliminating external cloud TTS API dependencies. |
| 👁️ **InclusionAI / LLaDA2.0-Uni** | Multimodal & Visual QC | Diffusion-based large language model for evaluating dashboard layout symmetry, visual diagram truth, and SVG rendering in `eval:anti-slop-visual`. |
