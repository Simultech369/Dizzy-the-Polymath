**A. What the code actually does – first‑principles description**  

| Evidence | What we can confirm from the repository itself |
|----------|-----------------------------------------------|
| **README.md** – “Local HTTP runtime” table (lines ≈ 38‑44) | The runtime **exposes** at least four HTTP endpoints: `/health`, `/prompt`, `/governance` and (optionally) `/memory/graph`. |
| **package.json** – `express` dependency (line 6) and `scripts` that start the server (`node ./agent_server.mjs`) | The server is built on **Express 5** and is started by `agent_server.mjs`. |
| **package.json** – `redis` dependency (line 7) | A **Redis** client is available to the runtime, suggesting a queue or cache layer. |
| **package.json** – `ethers` dependency (line 5) | The code can **interact with Ethereum‑compatible blockchains**; no sandboxing is evident from the manifest. |
| **FILE_ROLES.md** – “Core Runtime” list (lines ≈ 21‑26) | The **authoritative runtime files** are `agent_server.mjs`, `worker.mjs`, `smoke_test.mjs`, plus the `package.json` metadata. |
| **README.md** – “Experimental” row (line ≈ 15) | `lib/sqlite_operational_store.mjs` is **present but marked experimental** and only runs on Node ≥ 22. |
| **README.md** – “Safety checks” bullet list (lines ≈ 71‑74) | The repository ships a **test suite** (`npm test`, `npm run smoke`, `npm run check:state`) that is intended to verify safety, but the actual test code is not shown here. |
| **OPERATING_SURFACE.md** – “This is not a constitutional file” (lines ≈ 4‑8) | The **public‑facing surface** is explicitly *non‑authoritative*; it is only documentation. |

From the above we can deduce the **real system** that will execute when the repository is run:

1. **Entry point** – `node agent_server.mjs`.  
2. **Express server** – registers the routes listed in the README.  
3. **Worker process** – `worker.mjs` is spawned (presumably via `child_process` or a simple `node worker.mjs`) and consumes jobs from a Redis queue.  
4. **Prompt handling** – The `/prompt` handler loads *prompt packs* (files such as `PROMPT_CORE.md`, `PROMPT_PACKS.md`, etc.) and applies *budget* checks as described in the README, but the exact loading code is not visible.  
5. **Memory graph** – When the env var `DIZZY_MEMORY_GRAPH_ENABLED=1` is set, an additional route `/memory/graph` becomes active; the implementation is hidden from us.  
6. **Optional SQLite store** – If the runtime is started on Node ≥ 22, `lib/sqlite_operational_store.mjs` may be imported, but we have no code to confirm its activation.  

**B. Runtime‑and‑authority map**  

| Component | File(s) | Authority level (per FILE_ROLES.md) | Trust boundary | What it *does* (evidence‑based) |
|-----------|---------|--------------------------------------|----------------|--------------------------------|
| **HTTP server** | `agent_server.mjs` | Runtime (top‑level) | External operator ↔︎ server (loopback by default) | Serves `/health`, `/prompt`, `/governance`, optional `/memory/graph` (README). |
| **Worker** | `worker.mjs` | Runtime (top‑level) | Internal queue ↔︎ worker | Consumes jobs from Redis (dependency) and performs tool calls / generation (inferred). |
| **Redis client** | `lib/…` (not shown) | Runtime (top‑level) | Internal data store ↔︎ runtime | Provides a durable queue; no auth shown. |
| **Prompt packs / constitution** | `PROMPT_CORE.md`, `PROMPT_PACKS.md`, `CONSTITUTION.md`, `identity/*` | Prompt‑pack (2nd tier) | Governs language‑model prompts but *only* if loaded by code. |
| **Experimental SQLite store** | `lib/sqlite_operational_store.mjs` | Experimental side‑car | Local persistence ↔︎ runtime (optional) | Not loaded on Node < 22; no evidence of usage. |
| **Safety‑check scripts** | `scripts/*.mjs` (referenced in `package.json`) | Tests / checks (3rd‑tier) | CI / developer run‑time | Run via `npm test`, `npm run smoke`, etc.; enforce no‑crash and some policy checks (exact checks unknown). |
| **Public documentation surfaces** | `README.md`, `OPERATING_SURFACE.md`, `REPO_GUIDE.md` | Descriptive (non‑authoritative) | Operator ↔︎ human readers | Explain intent; not executed. |
| **Tool layer** (e.g., `ethers`, `cheerio`) | `package.json` dependencies | Runtime (available to code) | External services (blockchain, HTML) | Can be invoked by worker or server; no sandbox shown. |

**C. Document‑vs‑implementation mismatches (high‑confidence)**  

| Claim (doc) | Evidence (code / manifest) | Verdict |
|-------------|----------------------------|---------|
| “Local HTTP runtime … `/health`, `/prompt`, `/governance`, plus opt‑in `/memory/graph`” (README, line ≈ 38‑44) | No source code for route registration is provided; we only know the server is started (`agent_server.mjs`). | **Unverified** – claim plausible but not proven. |
| “Safety checks … `npm test`, `npm run smoke`, `npm run check:state`” (README, line ≈ 71‑74) | `package.json` defines those scripts, but the scripts themselves (`scripts/*.mjs`) are not shown. | **Unverified** – we cannot confirm they enforce any safety property. |
| “Optional bearer auth for non‑loopback exposure” (README, Safety Posture) | No authentication middleware appears in the visible files; `express` is the only listed dependency. | **Missing evidence** – could be in `agent_server.mjs` but not visible. |
| “Remote mutations disabled by default” (README, Safety Posture) | No code to confirm that POST/PUT routes are blocked or that write‑capable endpoints are absent. | **Missing evidence**. |
| “Bounded memory – retrieval is scoped by trust zone and allowed surfaces” (README, Runtime Shape) | No implementation of trust‑zone filtering is visible; prompt‑pack files exist but no code shown. | **Unverified**. |
| “Experimental SQLite side‑car runs only on Node 22+ because it uses built‑in `node:sqlite` module” (README, Quick Start) | `lib/sqlite_operational_store.mjs` is listed but its content is not provided. | **Unverified** – we cannot see the conditional import or version check. |

**D. High‑confidence risks / architectural weaknesses**  

1. **Missing authentication / rate‑limiting** – The only evidence of a server is the `express` dependency; no auth middleware is referenced. If the server is bound to `localhost` by default, an accidental exposure (e.g., `0.0.0.0` bind) could allow unauthenticated remote calls to `/prompt` and any future mutation endpoints.  
2. **Unbounded external tool execution** – The presence of `ethers` and `cheerio` indicates the runtime can make **network calls** and **blockchain transactions**. Without a sandbox or explicit allow‑list, a malicious prompt could trigger arbitrary external calls.  
3. **Redis queue without access controls** – `redis` is a top‑level dependency, implying the worker reads/writes from a Redis instance. No configuration or ACL is shown; a default‑installed Redis server is often **open**.  
4. **Prompt‑pack injection surface** – Prompt packs are loaded from markdown files that are part of the repo. If the server loads any file from a configurable path, an attacker with file‑system write access could inject malicious system prompts that steer the language model.  
5. **Experimental persistence not gated** – `lib/sqlite_operational_store.mjs` is marked experimental but could be imported conditionally based on Node version. If the condition fails, the runtime may fall back to an in‑memory store, losing durability guarantees that the docs claim (“durable continuity”). Conversely, if the import succeeds, SQLite may be used without encryption or access control.  

**E. Areas that need deeper, code‑level review**  

| Area | Why it matters | Where to look (based on repo map) |
|------|----------------|-----------------------------------|
| **`agent_server.mjs`** – route registration, auth, input validation | Verify that the claimed safety posture (loopback bind, bearer auth, mutation blocking) is actually implemented. | `agent_server.mjs` (runtime code). |
| **`worker.mjs`** – job handling, tool invocation, external calls | Confirm sandboxing, credential handling, and that only allowed tools are reachable. | `worker.mjs`. |
| **Prompt‑pack loader** – code that reads `PROMPT_CORE.md`, `PROMPT_PACKS.md`, etc. | Check that trust‑zone budgeting and prompt‑drift checks are enforced at runtime. | Likely in `lib/` or `agent_server.mjs`. |
| **Redis connection configuration** | Ensure that the Redis client is not exposed to the network and that ACLs are enforced. | Files under `lib/` that create the Redis client. |
| **Safety‑check scripts** (`scripts/*.mjs`) | Determine which safety properties are actually asserted (e.g., schema validation, rate‑limit tests). | All scripts referenced in `package.json` under `scripts`. |
| **Experimental SQLite store** (`lib/sqlite_operational_store.mjs`) | Validate version gating, schema migrations, and any file‑system permissions. | `lib/sqlite_operational_store.mjs`. |
| **Memory graph endpoint** (`/memory/graph`) | Verify that the env‑var gating works and that no private continuity data is leaked. | Route implementation in `agent_server.mjs` or related module. |
| **Tool wrappers** (`ethers`, `cheerio`, any custom tool code) | Confirm that only explicitly authorized tools can be invoked and that credential leakage is impossible. | Likely in `worker.mjs` or `lib/tools/`. |

---

**Summary (concise)**  

- **Intended system**: a local‑first assistant runtime that runs an Express server, exposes a small set of HTTP endpoints, uses Redis for a background worker queue, and applies “prompt‑pack”‑driven language‑model behavior within defined trust zones. Optional SQLite persistence is experimental.  
- **Observed execution**: The repository contains the manifest (`package.json`) and high‑level documentation that describe the above components, but the actual implementation files (`agent_server.mjs`, `worker.mjs`, `lib/…`) are not present in the supplied context, so we cannot confirm any of the safety or continuity guarantees claimed in the README.  
- **Authority**: Runtime code (`agent_server.mjs`, `worker.mjs`) is highest authority; prompt‑pack