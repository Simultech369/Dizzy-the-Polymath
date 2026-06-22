# RUNBOOK.md
How to run Dizzy locally.

Goal: simplest setup first, with optional failure-isolated add-ons.

---

## Quick start: local runtime only

Terminal A:
- `node .\agent_server.mjs`

Terminal B:
- `Invoke-RestMethod http://127.0.0.1:3000/health`
- `Invoke-RestMethod http://127.0.0.1:3000/prompt`
- `Invoke-RestMethod http://127.0.0.1:3000/memory/graph`

This starts the local API, exposes governance/prompt/memory inspection endpoints, and does not require Telegram, Redis, or a model backend.

The optional dashboard is disabled by default. Its read-only routes are isolated in `lib/dashboard.mjs` and its local-only renderer lives at `dashboard/index.html`. Disabled mode does not load the module; module or asset failure leaves core routes such as `/health` available.

Dashboard browser UX is not promotion-ready. When `DIZZY_AUTH_TOKEN` is configured, normal browser navigation and the renderer's follow-on `fetch` calls cannot attach the required bearer header. Header-authenticated API clients remain supported. Do not put credentials in query strings; keep the dashboard disabled unless using an explicit header-capable local client while a loopback-only operator-session design is evaluated.

---

## Quick start: Telegram interface (2 terminals)

Terminal A:
- `node .\agent_server.mjs`

Terminal B:
- ` $env:TELEGRAM_BOT_TOKEN="..." ; $env:TELEGRAM_CHAT_ID="..." ; $env:DIZZY_BASE_URL="http://127.0.0.1:3000" ; node .\scripts\telegram_relay.mjs`

This gives inbound Telegram -> `/dispatch/incoming` -> replies. Tool jobs will fail cleanly unless you also run Redis + worker.

---

## Recommended PowerShell setup (separate windows)

1) Find your chat id (once):
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\get_telegram_chat_id.ps1`

2) Set persistent USER env vars (once per machine/user):
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_user_env_telegram.ps1`

3) Launch server + relay (every time):
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\launch_telegram.ps1`

Doctor (sanity check: server health + Telegram token/chat id):
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor_telegram.ps1`

Add-ons (optional):
- ` $env:DIZZY_ENABLE_WORKER="1"` to also open the Redis-backed worker window
- ` $env:DIZZY_ENABLE_NOTIFY_DRAIN="1"` to also open Telegram “job dead” alerts
- ` $env:TELEGRAM_POLL_JOB_RESULTS="1"` to have the relay poll `/jobs/:id` and post completions
- ` $env:TELEGRAM_SEND_STARTUP_MESSAGE="1"` to send a startup Telegram message after launch

Notes:
- The launcher waits for `GET /health` before starting the relay (prevents “Dispatch error: fetch failed” when the server isn’t up yet).
- By default, the launcher computes `DIZZY_BASE_URL` from `PORT` and ignores any pre-set `DIZZY_BASE_URL`. To override intentionally, set `DIZZY_BASE_URL_OVERRIDE=1`.
- By default, the relay does not send an unsolicited Telegram startup message. Set `TELEGRAM_SEND_STARTUP_MESSAGE=1` if you want that behavior.
- `TELEGRAM_ALLOW_AUTO_BIND=1` prints a one-time nonce; the first private chat must send `/bind <nonce>` before it is accepted.
- In Telegram, use `/help`, `/governance`, `/health`.

---

## 1) Start the runtime API (local-only by default)

In one terminal:

- `node .\agent_server.mjs`

Defaults:
- binds to `127.0.0.1` (override with `DIZZY_BIND_HOST`)
- defaults to `DIZZY_DEPLOYMENT_MODE=direct_local`; use `proxied` behind a reverse proxy or tunnel, and `hosted` for direct non-loopback exposure
- defaults to `DIZZY_PUBLIC_SURFACES=closed`; use `discovery` only when profile, services, portfolio, logo, and governance should remain anonymously readable
- structural transparency doc: `GET /governance`

Optional auth (recommended if you ever bind beyond loopback):
- set `DIZZY_AUTH_TOKEN` on the server process and also on any client/relay processes
- `proxied` and `hosted` modes require `DIZZY_AUTH_TOKEN`, even when the runtime itself receives the connection on loopback
- `direct_local` rejects forwarding headers because their presence contradicts the declared deployment boundary
- preserve standard forwarding headers for auditability; `proxied` mode still requires authentication if a proxy strips them
- set `DIZZY_ENFORCE_IDENTITY_HEADERS=1` in `proxied` mode to ignore body-supplied `client_id` and `service_id` and read them from `X-Dizzy-Client-Id` and `X-Dizzy-Service-Id`
- identity-header enforcement fails startup unless `DIZZY_TRUSTED_PROXIES` names the proxy socket IPs allowed to supply those headers (for example `127.0.0.1,10.0.0.1`)
- set `DIZZY_EXECUTE_TOKEN` and/or `DIZZY_NOTIFY_TOKEN` alongside `DIZZY_AUTH_TOKEN` to restrict API callers to `/agent/execute` or `/notify`; scoped-token configuration fails startup without the master token
- set `DIZZY_VERIFIED_HTTPS=1` in `proxied` or `hosted` mode when the deployment is served over verified HTTPS. This enables Strict-Transport-Security (HSTS) headers. Enabling verified-HTTPS validation prevents HSTS from interfering with local HTTP development.

---

## 2) (Optional) Enable tool jobs with Redis + worker

Tool invocations (`tool:http_get ...`, `tool:cheerio_extract ...`) require Redis.

Ways to run Redis on Windows (pick one):
- **Memurai (Redis-compatible, easiest on Windows):** install/start Memurai Developer so it listens on `127.0.0.1:6379`.
- **WSL (Ubuntu):** install Redis inside WSL and expose it on `127.0.0.1:6379`.
- **Docker Desktop:** run a Redis container publishing `6379`.

Then (with Redis running):
- set `REDIS_URL` (example: `redis://127.0.0.1:6379`)
- `node .\worker.mjs`

Note:
- The server process must also have `REDIS_URL` set (the `launch_telegram.ps1` script does this automatically when `DIZZY_ENABLE_WORKER=1`).

If you don’t want Redis right now:
- Tool calls can also run **inline** (no worker) by setting `DIZZY_TOOL_MODE=auto` (default) or `DIZZY_TOOL_MODE=inline`.
- Localhost/private-network fetches are denied by default. Only opt in with `DIZZY_TOOL_ALLOW_LOCALHOST=1` and/or `DIZZY_TOOL_ALLOW_PRIVATE_NET=1` when you explicitly need them.
- Redirects are manually validated and capped (`DIZZY_TOOL_MAX_REDIRECTS`, default `3`) so an external URL cannot silently bounce into your local network.
- File-mutating chat commands from Telegram (`/remember`, `/memory_review`, `/improve`, `/apply`) are denied by default. Set `DIZZY_ALLOW_REMOTE_MUTATIONS=1` only if you intentionally want Telegram to be allowed to write local state.

---

## Runtime snapshots and JSONL repair

Stop the server, worker, and relay before backup or restore so the snapshot has no active writers.

- `node .\scripts\backup_restore.mjs backup [destination-directory]` copies `runtime/` into a new directory and refuses to overwrite an existing destination.
- Backups include a `manifest.json` with SHA-256 hashes for every copied file.
- `node .\scripts\backup_restore.mjs restore <snapshot-directory>` verifies the manifest, then renames the current runtime into `backups/` before copying the snapshot. If copying fails, it restores the original runtime.
- `node .\scripts\backup_restore.mjs repair [file-or-directory]` repairs only a malformed final JSONL record and preserves the original beside it as a timestamped `.bak` file. It refuses corruption found earlier in a file.

Snapshots can contain private conversation and execution data. Protect them like the live runtime directory.

SQLite remains an experimental, non-authoritative prototype. The snapshot command checkpoints a prototype database when present, but `DIZZY_OPERATIONAL_STORE=sqlite` is not a supported runtime mode.

---

## 3) Telegram primary interface (inbound relay + replies)

In a third terminal:

- ` $env:TELEGRAM_BOT_TOKEN="..." ; $env:TELEGRAM_CHAT_ID="..." ; $env:DIZZY_BASE_URL="http://127.0.0.1:3000" ; node .\scripts\telegram_relay.mjs`

Optional:
- ` $env:TELEGRAM_POLL_JOB_RESULTS="1"` to post tool job results when they complete
- ` $env:DIZZY_AUTH_TOKEN="..."` if the server requires auth

Telegram commands:
- `/help`
- `/governance`
- `/health`
- `/prompt` (shows which local prompt files are loaded)
- `/reset` (clears Gemini chat memory for this Telegram chat, when enabled)
- `/remember` (writes a compact session summary to `memory/` for durable recall via RAG)
- `/memory_review` (proposes curated updates to `MEMORY.md` + `memory/topics/*.md`; apply with `/apply <id> CONFIRM`)

Duplicate replies:
- If you see two similar replies to one message, you almost certainly have multiple `telegram_relay` processes running.
- The relay now enforces a single-instance lock by default (`runtime/telegram_relay.lock`). Close extra “Dizzy Telegram Relay” windows and restart.
- To intentionally run multiple relays (not recommended), set `TELEGRAM_ALLOW_MULTI=1`.

---

## 4) Telegram ops channel (dead-letter notifications)

In a fourth terminal:

- ` $env:TELEGRAM_BOT_TOKEN="..." ; $env:TELEGRAM_CHAT_ID="..." ; $env:DIZZY_BASE_URL="http://127.0.0.1:3000" ; node .\scripts\telegram_notify_drain.mjs`

Notes:
- This surfaces `/notify/:channel` messages (currently terminal failures: `kind=job_dead`).
- Set `DIZZY_AUTH_TOKEN` or `DIZZY_NOTIFY_TOKEN` here too if auth is enabled.
- Redis atomically enqueues each dead-job notification with its recovery marker, so an ambiguous Redis response can be retried without adding a second queue item.
- DLQ enqueue and its recovery marker use the same atomic pattern. Retained claims are retried periodically with bounded backoff while the worker remains running; pending counts and recovery errors are logged.
- End-to-end delivery remains at-least-once: Telegram may accept a message before the drain can acknowledge its exact queue receipt, so downstream duplicates remain possible after a drain crash.
- The queue currently supports standalone Redis-compatible servers only. Redis Cluster is not supported because multi-key Lua operations do not use a shared hash slot; ACLs must permit `EVAL` and the commands used by the queue scripts.

---

## 5) (Optional) Gemini chat brain (plain text -> Gemini)

If you want Telegram plain-text messages to get a real model response (instead of `Ack: ...`), set:
- `DIZZY_CHAT_BACKEND=gemini`
- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=...` (default is `gemini-1.5-flash` if omitted)
- Optional: `DIZZY_PROMPT_PACK=core|creative|ops|full` (see `PROMPT_PACKS.md`)
- Optional style defaults:
  - `DIZZY_BREVITY_MODE=lite` (default)
  - `DIZZY_AFFECT_MODE=attuned` (default)
  - `DIZZY_REINFORCEMENT_MODE=gold_star` (default)

Relevant-note injection (uses local `.md` files to reduce genericness without stuffing everything into the prompt):
- Enabled by default: `DIZZY_RAG_ENABLED=1`
- Control: `DIZZY_RAG_TOP_K=4`, `DIZZY_RAG_CACHE_MS=10000`, `DIZZY_RAG_MAX_FILE_BYTES=200000`
- Structural memory graph:
  - Enabled by default: `DIZZY_MEMORY_GRAPH_ENABLED=1`
  - Control: `DIZZY_MEMORY_GRAPH_TOP_K=3`, `DIZZY_MEMORY_GRAPH_CACHE_MS=10000`
  - Inspect live summary: `GET /memory/graph`
  - Query graph context: `GET /memory/graph?q=wikimedia`
  - Write a readable artifact: `node .\scripts\sync_memory_graph.mjs`

Optional knobs:
- `DIZZY_CHAT_MAX_TURNS=16` (short memory window)
- `DIZZY_CHAT_TIMEOUT_MS=20000`
- `DIZZY_CHAT_TEMPERATURE=0.7`

Notes on memory:
- Working chat context is stored as JSONL in `runtime/conversations/telegram_<chat_id>.jsonl` (used as the short history window).
- Durable recall should be written to markdown under `memory/` (use `/remember`).
- Long-term memory is indexed in `MEMORY.md` (keep it small; details live in `memory/topics/*.md`).
- Validate memory index caps: `node scripts/memory_validate.mjs`
- Memory quality rule of thumb: prefer delta over duplicate recap. A good memory captures what changed, why it matters, and what should be reused later.
- Auto-memory is enabled by default when chat is enabled. It writes only on higher-signal turns, with cooldown and dedupe gates to avoid summarizing every exchange.
- Trust-zone note: `/agent/execute` paid/public requests are ephemeral by default. Enable continuity explicitly per client/task with `continuity_mode=client` if you intentionally want retained client-specific chat history.
- Client continuity requires `client_id` and `service_id`; `/agent/execute` derives the conversation key from those fields and ignores caller-provided keys.
- Ephemeral `/agent/execute` requests do not write execution-history entries.
- Markdown auto-retrieval is scoped to trusted root doctrine docs plus `memory/` by default. Imported markdown under `_ext/` and `_external/` is excluded unless you explicitly widen the allowlist.

Optional: automatic chat fallback (keep Gemini as primary)
- `DIZZY_CHAT_FALLBACK_BACKEND=openai_compat` (only triggers on transient Gemini failures like 429/5xx/timeout)
- `OPENAI_COMPAT_BASE_URL=...` (example: Groq OpenAI-compatible base URL, or a local Ollama/vLLM base URL)
- `OPENAI_COMPAT_API_KEY=...` (if required by the endpoint; local may be blank)
- `OPENAI_COMPAT_MODEL=...`
- `DIZZY_FALLBACK_MAX_CALLS_PER_HOUR=10` (optional global safety cap across all conversations)
- `DIZZY_FALLBACK_MAX_CALLS_PER_CONVERSATION_HOUR=3` (optional fairness cap for one conversation)
- DLQ JSONL is a redacted diagnostic record, not a directly replayable job archive; replays must reconstruct credentials from approved runtime configuration.
- Optional: reduce fallback token burn (useful for free tiers):
  - `OPENAI_COMPAT_MAX_TOKENS=500` (caps fallback completion length)
  - `DIZZY_FALLBACK_MAX_TURNS=6` (sends fewer recent turns on fallback)
  - `DIZZY_FALLBACK_SYSTEM_PROMPT_MAX_CHARS=3500` (shrinks fallback system prompt)
  - `DIZZY_FALLBACK_USE_RAG=0` (default; set 1 to include RAG snippets on fallback)

Helper script (sets User env vars + current session):
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_user_env_fallback_openai_compat.ps1`

Helper script (sets User env vars + current session):
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_user_env_gemini.ps1`

Minimal routing roles:
- `chat`: normal replies and final judgment use `DIZZY_CHAT_BACKEND`.
- `utility`: janitorial work (`/remember`, auto-remember, `/memory_review`, `/improve`) uses `DIZZY_UTILITY_BACKEND` when set, otherwise the chat backend.
- `fallback`: transient primary failures can use `DIZZY_CHAT_FALLBACK_BACKEND=openai_compat`.

Keep this small. Start with one primary chat backend, one utility backend, and one fallback. Add providers only when a real task cannot be served through Gemini or an OpenAI-compatible endpoint.

Utility override examples:
- `DIZZY_UTILITY_BACKEND=openai_compat`
- `DIZZY_UTILITY_OPENAI_COMPAT_MODEL=<cheap-or-local-model-id>`
- `DIZZY_UTILITY_OPENAI_COMPAT_MAX_TOKENS=500`

Routing choices are recorded in conversation JSONL entries as `model_route` for later review.

Groq helper (lists available model IDs using your Groq API key):
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\groq_list_models.ps1`

If you get a `Gemini HTTP 404` for the model id:
- This runtime will try to auto-pick a working model via `ListModels`.
- You can also list models yourself:
  - `node .\scripts\gemini_list_models.mjs`

## Fulfillment safety

The order reconciler no longer uses a shared placeholder image.

Before `generate_qc` or `manual_delivery` can progress for an order, stage a real prepared asset under:
- `runtime/orders/<order_id>/candidate.png`
- `runtime/orders/<order_id>/candidate.json`

Minimum metadata example:

```json
{
  "model": "manual_prepared_asset",
  "refined_prompt": "final prompt used for the prepared asset"
}
```

If the asset or metadata is missing, stale, or marked as placeholder-grade, the reconciler writes a diagnostic artifact and blocks upload/delivery.

## 6) (Optional) OpenRouter chat brain (plain text -> OpenAI-compatible)

If you want to use OpenRouter (including `:free` models), set:
- `DIZZY_CHAT_BACKEND=openai_compat`
- `OPENAI_COMPAT_BASE_URL=https://openrouter.ai/api/v1`
- `OPENAI_COMPAT_API_KEY=...`
- `OPENAI_COMPAT_MODEL=...` (example: `openrouter/free` or `qwen/qwen3.6-plus-preview:free`)
- Optional: `OPENAI_COMPAT_MAX_TOKENS=200` (caps response length)

Helper script (sets User env vars + current session):
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set_user_env_openrouter.ps1`
