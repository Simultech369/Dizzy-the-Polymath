**A.  What the code actually does (first‑principles view)**  

| Component | What the source tells us it *does* at runtime | Key entry points (file : line‑ish) |
|-----------|-----------------------------------------------|-----------------------------------|
| **Process start** | `worker.mjs` is the only entry‑point that is executed as a Node process in the current checkout. It connects to Redis, builds queue‑key helpers and runs an infinite `workerLoop`. | `worker.mjs` – `assertRuntimeSafetyConfig();` (≈ 13) → `connectRedis(redisUrl);` (≈ 15) → `workerLoop(..., async (job) => { … })` (≈ 22) |
| **Safety gate** | Before any other code runs the process validates a *runtime safety config* derived from env‑vars. If any validation error is found the process aborts with an exception. | `runtime_config.mjs` – `assertRuntimeSafetyConfig()` (≈ 71‑77) |
| **Queue handling** | `workerLoop` (imported from `lib/queue.mjs`, not shown) repeatedly pulls jobs from a Redis list identified by a prefix (`DIZZY_QUEUE_PREFIX`). Only jobs with `type === "tool"` are currently handled; everything else throws. | `worker.mjs` – job dispatcher (≈ 24‑27) |
| **Tool execution** | When a tool‑type job arrives it is handed to `runToolJob` from `lib/tools.mjs`. The implementation of tools is not in the provided snapshot. | `worker.mjs` – `runToolJob(job)` (≈ 25) |
| **Prompt construction** | `prompt_bundle.mjs` reads a configurable set of markdown files (constitutional + supplemental), validates front‑matter expiration (errors if a *constitutional* file is expired), truncates each file to a configurable max‑length and builds a system‑prompt that is cached for a short TTL. | `prompt_bundle.mjs` – `getPromptSources` (≈ 40‑94) → expiration check (≈ 71‑79) → `buildChatSystemPrompt` (≈ 102‑131) → `getCachedChatSystemPrompt` (≈ 135‑154) |
| **HTTP Dashboard** | `dashboard.mjs` exports `registerDashboardRoutes(app, options)`. The routes (`/dashboard`, `/api/dashboard-data`, `/api/dashboard-query`) are protected by `dashboardAccessGuard`, which requires a non‑empty `DIZZY_AUTH_TOKEN`, enforces that the request originates from a loopback address **and** that no proxy‑forwarding headers are present, and blocks “paid_public” and “outside_contact” trust zones. | `dashboard.mjs` – `dashboardAccessGuard` (≈ 5‑23) → route registration (≈ 31‑71) |
| **Model routing** | `model_router.mjs` decides which LLM backend to use for a request based on env‑vars (`DIZZY_CHAT_BACKEND`, `DIZZY_UTILITY_BACKEND`). It normalises values, provides a textual `log` field and supplies helper functions to retrieve the exact model name for OpenAI‑compatible or Gemini back‑ends. | `model_router.mjs` – `getModelRoute` (≈ 12‑27) → `getOpenAICompatModelForRoute` (≈ 29‑34) / `getGeminiModelForRoute` (≈ 36‑41) |

**B.  Runtime‑authority map & trust boundaries**

```
┌───────────────────────────────────────────────────────────────┐
│  Process (node) – starts in worker.mjs                         │
│  ├─ Runtime‑safety gate (runtime_config.mjs)  ←  env vars      │
│  │   – enforces deployment‑mode, auth‑token presence, etc.      │
│  └─ Redis connection (lib/queue.mjs)  ←  external state store   │
│      └─ workerLoop (lib/queue.mjs)  ←  consumes jobs            │
│           └─ runToolJob (lib/tools.mjs)  ←  tool implementations│
│
│  Prompt subsystem (prompt_bundle.mjs)                           │
│  └─ Reads files from the process’s cwd (configurable via env)  │
│      – constitutional files are *authoritative* (errors on   │
│        expiration)                                            │
│      – cached for ≤ 2 s (DIZZY_PROMPT_CACHE_MS)                │
│
│  HTTP surface (dashboard.mjs) – mounted by an Express app (not│
│  shown)                                                        │
│  └─ Access guard: requires DIZZY_AUTH_TOKEN, loopback IP,      │
│     no forwarded headers, disallows certain trust zones        │
│  └─ Routes expose:                                            │
│      • static dashboard HTML                                   │
│      • prompt source metadata (via getPromptSources)          │
│      • markdown‑retrieval API (via lib/md_retriever.mjs)      │
│
│  Model routing (model_router.mjs) – consulted by the request   │
│  handling code (not shown) to decide which LLM backend to use.│
└───────────────────────────────────────────────────────────────┘
```

*Authority (behavioural) files* – the code that actually decides what happens:

- `worker.mjs`
- `lib/runtime_config.mjs`
- `lib/queue.mjs` (imported, not shown but critical)
- `lib/tools.mjs` (imported, not shown)
- `lib/prompt_bundle.mjs`
- `lib/dashboard.mjs`
- `lib/model_router.mjs`
- `lib/markdown_frontmatter.mjs` (used by prompt_bundle, not shown)

*Descriptive / aspirational* – any documentation or README (not in the snapshot) that claims, e.g., “Dizzy supports remote self‑modifying commands” is **not** enforced by the code; the only enforcement points are the warnings emitted in `validateRuntimeSafetyConfig` (lines 44‑56) and the guard in `dashboard.mjs`.

**C.  Disagreements between code, tests (none supplied) and documentation (inferred)**  

| Expected claim | Evidence in code | Gap / conflict |
|----------------|------------------|----------------|
| “Self‑modifying chat commands are disabled by default but can be turned on with `DIZZY_ALLOW_SELF_MODIFY`.” | The flag is parsed in `runtime_config.mjs` (line 21) and a *warning* is emitted in `validateRuntimeSafetyConfig` (lines 48‑49). No other component checks this flag – the flag has **no enforcement**. | Documentation (if any) would over‑promise a safety barrier that does not exist. |
| “Tool execution can be run inline, queued or auto‑selected.” | `runtime_config.mjs` validates `DIZZY_TOOL_MODE` (lines 33‑38) but `worker.mjs` only ever processes jobs of type “tool” via the queue; there is no code that respects the `toolMode` value. | The runtime‑config validation suggests three modes, yet the actual runtime supports only a single mode (queue). |
| “Public API surfaces are optional and can be opened with `DIZZY_PUBLIC_SURFACES=discovery`.” | The only public‑surface check is in `dashboardAccessGuard` which *rejects* requests when `trust_zone` is `"paid_public"` or `"outside_contact"` (lines 16‑19). No check for `publicSurfaceMode`. | The `publicSurfaceMode` config is parsed (line 8) and validated (line 43) but never consulted; the claim is unimplemented. |
| “Expired constitutional prompts are ignored gracefully.” | In `prompt_bundle.mjs` an expired *constitutional* file triggers `throw new Error(...)` (lines 71‑79). This aborts the call that built the system prompt, potentially bubbling up to the HTTP handler or worker. | The behaviour is harsher than “graceful ignore”. |
| “Dashboard is available on any host when a valid token is supplied.” | `dashboardAccessGuard` explicitly denies non‑loopback or proxied connections (lines 9‑14). | Documentation that suggests a token alone is sufficient would be inaccurate. |

**D.  High‑confidence risks / architectural weaknesses**

1. **Unvalidated `toolMode` flag** – The environment variable `DIZZY_TOOL_MODE` is validated but never used. Deployers may think they can switch to “inline” execution, but the system will still enqueue jobs, possibly leading to unexpected latency or dead‑letter queues.

2. **Expiration‑induced crashes** – `prompt_bundle.mjs` throws an exception if a *constitutional* markdown file has an `expires_at` date in the past (lines 71‑79). This exception propagates to any caller (e.g., the dashboard API or a worker that builds a prompt) and can crash the entire process, providing a denial‑of‑service vector simply by letting a file expire.

3. **Weak authentication for non‑dashboard surfaces** – Only the dashboard routes enforce `DIZZY_AUTH_TOKEN` and loopback restrictions. No other HTTP endpoints (the main chat API is not shown) are guarded here, meaning an attacker could reach the LLM backend or tool runner if those routes lack similar checks.

4. **Trust‑zone bypass via environment** – The list of prompt files is ultimately driven by `process.env.DIZZY_PROMPT_FILES` and `DIZZY_PROMPT_PACK`. A malicious operator with write access to environment variables can cause the system to load arbitrary markdown files, potentially injecting harmful instructions into the LLM’s system prompt (no sandboxing).

5. **Short cache TTL and shared mutable state** – `getCachedChatSystemPrompt` caches the built prompt for as little as 250 ms (line 138). In a high‑concurrency server this shared mutable `cached` object can be read/written concurrently without synchronization, leading to race conditions where one request sees a partially constructed prompt.

**E.  Areas that need deeper inspection**

| Area | Why it matters | What to look for |
|------|----------------|------------------|
| **`lib/queue.mjs` & `workerLoop`** | Core of job consumption; need to verify error handling, back‑off, graceful shutdown, and whether the loop respects the runtime safety config. | Queue key semantics, job ack/retry, handling of unknown job types. |
| **`lib/tools.mjs`** | Executes external code; must enforce the `allowRemoteMutations` / `allowSelfModify` flags (currently only warned about). | Sandbox boundaries, network/file access, privilege escalation. |
| **`lib/md_retriever.mjs`** (used by dashboard) | Provides the relevance‑ranking used by `/api/dashboard-query`. Needs to ensure it cannot be abused to read arbitrary files. | Index building, input sanitisation, path traversal. |
| **Express app wiring** (the `app` instance that receives `registerDashboardRoutes`) | Authentication and IP checks are only applied to the dashboard; we must verify that the main chat endpoint also uses