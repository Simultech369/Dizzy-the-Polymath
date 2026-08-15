# Model Inventory

status: active inventory
reviewed: 2026-07-21

Purpose: keep model availability, routing posture, and data-boundary trade-offs visible. This file is an inventory, not an endorsement list.

## Operating Rule

Use the smallest model surface that can handle the task without crossing an unnecessary data boundary.

- `goal`: concrete execution target with a completion signal.
- `aim`: directional intent.
- `optimizer`: the loop or model selection pressure.
- `constraint`: what the model choice must not sacrifice.
- `data boundary`: where prompt/context leaves this machine.

OSS and open-weight prompting is allowed when it fits the task and the data boundary. Treat model origin, license, provider endpoint, and data sensitivity as separate risk axes.

## Current Runtime Configuration

Observed from this Windows environment on 2026-07-21. Secrets are intentionally redacted.

| Surface | Observed state | Boundary | Notes |
| --- | --- | --- | --- |
| Chat backend | `DIZZY_CHAT_BACKEND=gemini` | Google Gemini API | Primary runtime route today. |
| Gemini model | `GEMINI_MODEL=gemini-2.5-pro` | Google Gemini API | High-capability cloud route; use for higher judgment, planning, synthesis, and user-visible quality. |
| OpenAI-compatible endpoint | `OPENAI_COMPAT_BASE_URL=https://api.groq.com/openai/v1` | Groq API | Configured as the generic OpenAI-compatible surface. |
| OpenAI-compatible model | `OPENAI_COMPAT_MODEL=qwen/qwen3-32b` | Groq API | Model id says Qwen; treat as open-weight/foreign-origin capable until provider details are refreshed. |
| OpenAI-compatible key | `OPENAI_COMPAT_API_KEY=<set>` | Endpoint-specific | Do not send this key to non-approved endpoints. `scripts/openrouter_review.py` has a guard against leaking OpenRouter credentials to custom hosts. |
| OpenRouter key | `OPENROUTER_API_KEY=<set>` | OpenRouter API | Available separately, but not the active `OPENAI_COMPAT_BASE_URL` right now. |
| Groq key | `GROQ_API_KEY=<unset>` | Groq API | The active OpenAI-compatible key may still work with Groq; this named helper key is unset. |
| Ollama | installed at `C:\Users\Josh\AppData\Local\Programs\Ollama\ollama.exe` | local machine | Good for private drafts, probes, and low-risk utility work when quality is adequate. |
| `DIZZY_CHAT_BACKEND=local` | fully mapped in `lib/model_router.mjs` and validated by `lib/runtime_config.mjs` | local/OpenAI-compatible | Maps to local Ollama endpoints, defaulting to `gemma3:4b`. |

## Local Ollama Models

Observed via `ollama list` on 2026-07-21.

| Model | Size | Suggested use | Boundary |
| --- | ---: | --- | --- |
| `mistral:latest` | 4.4 GB | general local drafting and lightweight analysis | local |
| `llama-audit:latest` | 4.9 GB | local review lens, if its Modelfile is understood | local |
| `llama3.1:latest` | 4.9 GB | general local fallback | local |
| `deepseek-coder-v2:16b` | 8.9 GB | local code reasoning, slower/heavier | local |
| `gemma3:4b` | 3.3 GB | default local model in `model_router` when local route is requested and no model is set | local |
| `gemma3:12b` | 8.1 GB | stronger local general model, higher resource cost | local |
| `yi:latest` | 3.5 GB | experimental local general use | local |
| `glm4:latest` | 5.5 GB | experimental local general/coding use | local |
| `qwen2.5-coder:7b` | 4.7 GB | local coding and patch review | local |
| `deepseek-r1:7b` | 4.7 GB | local reasoning experiments | local |
| `deepseek-r1:1.5b` | 1.1 GB | cheap local reasoning probe, low reliability ceiling | local |

## Model Candidate Watchlist & Evidence Matrix

Models move through explicit evidence gates before promotion to active review or router pools:
`unverified_candidate` -> `installed/reachable` -> `callable` -> `json_valid` -> `tool_use_valid` -> `quality_valid` -> `review_usable`.

| Model ID | Source URL | Boundary | Local/Cloud | License/Access | Installed | Callable | JSON-Valid | Tool-Valid | Quality-Valid | Review-Usable | Latency Band | Failure Mode | Last Receipt |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `muse-glimmer:latest` | [Ollama Library](https://ollama.com/library/muse-glimmer) | `private_self` | Local | Open | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `local_cpu_slow` | Unproven local pull | None |
| `deepseek-v4-pro` | [DeepSeek Updates](https://api-docs.deepseek.com/updates/) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_fast` | Unproven API route | None |
| `deepseek-v4-flash` | [DeepSeek Updates](https://api-docs.deepseek.com/updates/) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_ultra_fast` | Unproven API route | None |
| `grok-4.5` | [xAI News](https://x.ai/news/grok-4-5) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_fast` | Unproven API route | None |
| `minimax-m3` | [MiniMax M3](https://www.minimax.io/blog/minimax-m3) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_medium` | Unproven API route | None |
| `glm-5.2` | [Z.ai Blog](https://z.ai/blog/glm-5.2) | `public_free` | Cloud | Free API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_medium` | Unproven probe slug | None |
| `qwen/qwen3.6-27b` | [Qwen Blog](https://qwen.ai/blog?id=qwen3.6-27b) | `trusted_collaborator` | Cloud | Open-Weight API | ❌ | ✔️ | ✔️ | ✔️ | ✔️ | ✔️ | `groq_fast_to_medium` | Active Groq route | Matrix profile |
| `qwen3.6-35b-a3b` | [Qwen Blog](https://qwen.ai/blog?id=qwen3.6-27b) | `trusted_collaborator` | Cloud | Open-Weight API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `groq_fast` | Unproven provider slug | None |
| `command-a-plus-05-2026` | [Cohere Blog](https://cohere.com/blog/command-a-plus) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_medium` | Unproven API route | None |
| `north-mini-code` | [Cohere Blog](https://cohere.com/blog/north-mini-code) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_fast` | Unproven API route | None |
| `mistral-medium-3.5` | [Mistral News](https://mistral.ai/news/) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_fast` | Unproven API route | None |
| `leanstral-1.5` | [Mistral News](https://mistral.ai/news/) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_fast` | Unproven API route | None |
| `claude-opus-4-8` | [Anthropic News](https://www.anthropic.com/news/claude-opus-4-8) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_slow` | Unproven API route | None |
| `claude-sonnet-5` | [Anthropic News](https://www.anthropic.com/news/claude-sonnet-5) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_fast` | Unproven API route | None |
| `claude-fable-5` | [Anthropic News](https://www.anthropic.com/news/claude-fable-5-mythos-5) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_medium` | Unproven API route | None |
| `gpt-5.5` | [OpenAI Index](https://openai.com/index/introducing-gpt-5-5/) | `trusted_collaborator` | Cloud | Commercial API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_medium` | Unproven API route | None |
| `gemini-3.1-pro-preview` | [Google AI Docs](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview) | `trusted_collaborator` | Cloud | Preview API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `cloud_fast` | Unproven API route | None |

## Routing Posture

| Task class | Preferred surface | Why |
| --- | --- | --- |
| Private brainstorming, style variants, low-risk drafts | Ollama local | Keeps private texture local; quality can be filtered by operator taste. |
| Code patch planning or high-confidence synthesis | Gemini primary or stronger cloud model | Higher reliability when the cost of being wrong is real. |
| Cheap utility tasks, summaries, extraction, formatting | Utility backend or small local model | Avoid burning the primary route on janitorial work. |
| External reviewer prompt generation | Local first when feasible; cloud if quality needed | Prompt packets can include sensitive repo paths and findings. |
| Public/client output | Cloud only when allowed by task data boundary; otherwise local draft plus human review | Do not leak private continuity into paid/public surfaces. |
| High-stakes legal, medical, financial, security conclusions | Highest-reliability route plus source verification | OSS/local may assist but should not be the final authority without evidence. |

## OSS / Open-Weight Policy Posture

Open-source and open-weight models remain useful because they improve portability, price leverage, private local drafting, and resilience against provider chokepoints.

Current caution:

- Recent reporting on 2026-07-20 and 2026-07-21 describes policy pressure around Chinese/foreign open-weight models, including possible procurement restrictions, Entity List style pressure, or pressure on U.S. firms.
- That is not the same as a universal ban on local OSS use in this workspace.
- Treat Chinese/foreign-origin open-weight models as a higher policy-risk category for regulated, client, government, or public production work.
- For private local exploration, OSS use is acceptable when prompts do not contain credentials, regulated data, or material that should not be exposed under the model/license/provider terms.
- Prefer local OSS for privacy-sensitive drafts only when the model is actually local. Open-weight model served by a hosted API still crosses that provider boundary.

## Inventory Refresh Commands

Local:

```powershell
ollama list
```

Gemini:

```powershell
node .\scripts\gemini_list_models.mjs
```

Groq:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\groq_list_models.ps1
```

Runtime env, redacted:

```powershell
$names = 'DIZZY_CHAT_BACKEND','DIZZY_UTILITY_BACKEND','OPENAI_COMPAT_BASE_URL','OPENAI_COMPAT_MODEL','OPENAI_COMPAT_API_KEY','GEMINI_API_KEY','GEMINI_MODEL','OPENROUTER_API_KEY','GROQ_API_KEY','OLLAMA_HOST'
foreach ($n in $names) {
  $v = [Environment]::GetEnvironmentVariable($n,'Process')
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($n,'User') }
  if ($v) {
    if ($n -match 'KEY|TOKEN|SECRET') { "$n=<set>" } else { "$n=$v" }
  } else {
    "$n=<unset>"
  }
}
```

## Promotion Notes

- Integrated `DIZZY_CHAT_BACKEND=local` mapping and validation (`W-0061` completed).
- Added `data_boundary` and `model_origin_risk` fields to the persisted Router Receipts (`W-0060` completed).
- Refresh live provider model lists only when needed; listing cloud models requires network and valid credentials.
