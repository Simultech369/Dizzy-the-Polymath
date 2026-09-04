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
| **👑 Tier 0: Apex Paid Judges** | 7 | Escalation, high-stakes tie-breaking<br>• Route: `APEX_PAID` (SQLite spend ledger reservation)<br>• *Includes ChatGPT 5.6 Trinity:* `Sol` (surgical auditor), `Luna` (operational scanner), `Terra` (crossover gate) | `GPT-5.6 Sol`, `GPT-5.6 Luna`, `GPT-5.6 Terra`, `GPT-5.3 Codex`, `Claude 3.7 Sonnet Thought`, `Gemini 3.1 Pro Preview`, `o3-high` |
| **🚀 Tier 1: Frontier Cloud & SOTA Open Models** | 16 | Frontier synthesis & specialist audits<br>• Route: `HOSTED_NO_TRAIN` / ZDR Verified<br>• Providers: SiliconFlow, Groq, Google AI Studio, Moonshot, Tencent | `Qwen-3.8 Coder`, `GLM-5.3 Cyber`, `qwen/qwen3.6-27b`, `Gemini 3.6 Flash 1M`, `DeepSeek-V3/V4`, `openai/gpt-oss-120b`, `minimax-m3/abab6.5t`, `moonshotai/kimi-k2.7-code`, `tencent/hy3`, `cohere/north-mini-code`, `stepfun-step-2` |
| **💻 Tier 2: Local OSS Fast Workers & Reasoners** | 14 | Rapid local audit, zero data leakage<br>• Route: `LOCAL_ONLY_VERIFIED`<br>• Provider: Air-gapped Ollama / Localhost | `qwen2.5-coder:7b`, `deepseek-r1:7b`, `deepseek-r1:1.5b`, `glm4:latest`, `mistral:latest`, `gemma3:4b`, `gemma3:12b`, `llama-audit:latest`, `phi-4`, `granite-3.1` |
| **🎭 Tier 3: Uncensored Adversarial & Non-Transformer Dynamics** | 8 | Hostile fuzzer, pre-dispatch red-team & continuous dynamics<br>• Route: `LOCAL_ONLY_VERIFIED` / ZDR Verified<br>• Goal: Invariant attack without RLHF refusal filters & SSM dynamics | `Jiunsong SuperGemma-12B/26B GGUFs`, `SuperDeepseek-V4`, `SuperQwen-AgentWorld`, `Hermes 3 (Nous)`, `Tulu 3`, `liquid/lqc-3b / lfm-40b`, `codestral-mamba-7b` |
| **🌀 Tier 4: Emerging Exotic Architectures (Momentum Watch)** | 5 | Exploratory non-standard cognitive architectures<br>• Linear attention, ternary 1-bit, evolutionary merges | `RWKV-v6 Eagle/Finch` (O(1) memory state), `BitNet b1.58` (1-bit ternary airlock filter), `Sakana AI Evo-Merge` (anti-homogenization), `AI21 Jamba 1.5` (SSM-MoE hybrid), `Abacus Smaug-72b` |
| **🚫 Tier 5: Quarantined / Purged Legacy** | 12 | Blocked from active dispatch<br>• Harnesses mislabeled as models, obsolete weights, or integrity-rejected | `Promptfoo`, `Aider`, `DSPy`, `SWE-agent`, `OpenHands`, `WizardCoder`, `Phind`, `StarCoder2`, `Arctic`, `01.AI Zero`, `DeepGrove`, `Poolside Laguna XS 2.1` (§5b integrity rejected) |
| **TOTAL REGISTERED** | **62** | **Tracked with typed qualification status & cognitive division mapping** | |


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

Observed via live local probe and seat verification on 2026-09-04 (`outputs/antigravity_to_codex_ollama_seat_verification_2026-09-04.md`): Local daemon active on `localhost:11434`; Builder seat (`qwen2.5-coder:7b`) and Breaker seat (`mistral:latest`) operational for zero-credit patch synthesis.

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
| 🌐 **Gitlawb / OpenClaude** (`Gitlawb/openclaude`) | Multi-Agent Coordination Seat | Open-source, model-neutral terminal agent CLI supporting MCP tools, per-repo configuration, and scriptable sessions. Wired into Dizzy's consensus signing chain (`lib/consensus.mjs`) and `MULTI_AGENT_PLAYBOOK.md`. |
| ⚡ **free-code** (`freecodexyz/free-code`) | Zero-Telemetry Coding CLI | Community-driven, telemetry-stripped terminal coding agent with multi-backend compatibility (Codex, Anthropic, DeepSeek) for air-gapped terminal pairing. |
| 🐜 **InclusionAI / Ling-3.0** (`inclusionAI`) | Sub-Second Janitor & Local Classifier | Ultra-lightweight open-source models (`Ling-3.0-tiny`, `Ling-3.0-flash`) for instant pre-route sanitization, diff chunk classification, and context budgeting. |
| 🎙️ **InclusionAI / Ming-omni-tts** | Air-Gapped Audio Synthesizer | Local, zero-data-retention speech synthesis engine for Dizzy's voice channel (`TOOLS.md`), eliminating external cloud TTS API dependencies. |
| 👁️ **InclusionAI / LLaDA2.0-Uni** | Multimodal & Visual QC | Diffusion-based large language model for evaluating dashboard layout symmetry, visual diagram truth, and SVG rendering in `eval:anti-slop-visual`. |
| 🎨 **Muse** (`meta-models/muse`) | Generative Visual Substrate | Foundation generative model architecture providing core multimodal representations for UI/visual synthesis without external proprietary cloud endpoints. |
| 🏊 **Poolside / Laguna** (`poolside/laguna`) | Execution-Guided Synthesis (Quarantined) | Program synthesis specialist. Model proposal for unprompted secret scrubbing / git rewrite was permanently rejected under constitutional §5b integrity clause; retained in test fixtures only. |



## 5. Active Model Capability Matrix (Auto-Generated)

*Generated at: 2026-08-27T16:05:51.025Z*

| Model | Provider | Boundary | Installed | Callable | JSON Usable | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `cerebras/qwen-2.5-coder-32b` | cerebras | trusted_collaborator | ❌ | ❌ | ❌ | unproven_requires_adapter_and_key |
| `claude-fable-5` | anthropic | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `claude-opus-4-8` | anthropic | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `claude-sonnet-5` | anthropic | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `command-a-plus-05-2026` | cohere | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `deepseek-r1:1.5b` | ollama | private_self | ❌ | ❌ | ❌ | unproven |
| `deepseek-r1:7b` | ollama | private_self | ✅ | ✅ | ✅ | profile_configured |
| `deepseek-v4-flash` | deepseek | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `deepseek-v4-pro` | deepseek | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `gemini-3.1-pro-preview` | google | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `gemma3:12b` | ollama | private_self | ❌ | ❌ | ❌ | unproven |
| `gemma3:4b` | ollama | private_self | ✅ | ✅ | ✅ | profile_configured |
| `glm-5.2` | openrouter | public_free | ❌ | ❌ | ❌ | unverified_candidate |
| `glm4:latest` | ollama | private_self | ❌ | ❌ | ❌ | unproven |
| `gpt-5.5` | openai | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `grok-4.5` | xai | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `leanstral-1.5` | mistral | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `liquid/lqc-3b-v0.1:free` | openrouter | public_free | ❌ | ❌ | ❌ | unproven_requires_probe |
| `llama-3.1-8b-instant` | groq | trusted_collaborator | ❌ | ✅ | ✅ | tested_available |
| `llama-3.3-70b-versatile` | groq | trusted_collaborator | ❌ | ✅ | ✅ | profile_configured |
| `llama-audit:latest` | ollama | private_self | ❌ | ❌ | ❌ | unproven |
| `minimax-m3` | minimax | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `mistral-medium-3.5` | mistral | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `mistral:latest` | ollama | private_self | ❌ | ❌ | ❌ | unproven |
| `moonshotai/kimi-k2.7-code:batch` | openrouter | public_free | ❌ | ❌ | ❌ | unproven_requires_probe |
| `muse-glimmer:latest` | ollama | private_self | ❌ | ❌ | ❌ | unverified_candidate |
| `north-mini-code` | cohere | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `nvidia/llama-3.1-nemotron-70b-instruct:free` | openrouter | public_free | ❌ | ❌ | ❌ | unproven_requires_probe |
| `openai/gpt-oss-120b` | groq | trusted_collaborator | ❌ | ✅ | ✅ | profile_configured |
| `openai/gpt-oss-20b` | groq | trusted_collaborator | ❌ | ✅ | ✅ | profile_configured |
| `qwen/qwen-2.5-coder-32b-instruct:free` | openrouter | public_free | ❌ | ❌ | ❌ | unproven_requires_probe |
| `qwen/qwen3.6-27b` | groq | trusted_collaborator | ❌ | ✅ | ✅ | profile_configured |
| `qwen2.5-coder:7b` | ollama | private_self | ❌ | ✅ | ✅ | tested_available |
| `qwen3.6-35b-a3b` | groq | trusted_collaborator | ❌ | ❌ | ❌ | unverified_candidate |
| `thudm/glm-4-9b-chat:free` | openrouter | public_free | ❌ | ❌ | ❌ | unproven_requires_probe |
