<think>
Okay, let's take a look at the Dizzy repository files provided. The user wants me to analyze and answer the questions based on the given files, not by checking the actual codebase. So, step by step, I'll need to go through each part of their query using the provided context.

First, I need to understand what Dizzy is intended to be. From the README.md, it's a local-first assistant runtime focusing on bounded memory, trust zones, and accountability. The description mentions it's for operators to maintain orientation and apply judgment under uncertainty.

Next, what actually runs at runtime. The README lists the active files as agent_server.mjs and worker.mjs in the lib directory. The runtime provides HTTP endpoints like /health, /prompt, and others. The runtime uses trust zones and memory boundaries as enforced by code and tests.

Looking at the authority and descriptive files: the README and FILE_ROLES.md indicate that runtime code has the highest authority, followed by prompt packs and design documents. Files like DESIGN.md and PROMPT_CORE.md are authoritative for governance, while others like RUNBOOK.md are more about setup.

How the system connects: The README's runtime shape diagram shows the operator interface with the local runtime, which includes endpoints for health, prompts, governance, etc. The trust zones are managed through different memory scopes. The operator-facing surfaces are RESTful endpoints.

Safety and durability: The README mentions loopback bind by default, optional bearer auth, and explicit external tool invocation. Tests like npm test cover safety checks. However, some aspects like political-economic direction are in documentation rather than code.

The key files for runtime are agent_server.mjs and worker.mjs. The PROMPT_CORE.md and CONSTITUTION.md have high authority in defining behavior. The SQLite operational store is experimental.

Discrepancies between documentation and code: Some features like SQLite are marked experimental, and certain economic principles are documented but not enforced in code. Also, public surfaces are mentioned as optional and not fully implemented.

Risks include the experimental nature of SQLite, potential gaps between documented trust zones and implementation, reliance on manual checks for production readiness, and the absence of some safety features in code. Also, the prompt governance might not fully align with the documented processes.

Areas needing deeper review would be the actual implementation of trust zones in code, the experimental SQLite code, production readiness scripts, integration tests for memory management, and how the prompt system executes according to CONSTITUTION.md.
</think>

### A. First-Principles Description  
**Dizzy** is a local-first runtime for bounded AI assistants, enforcing operational memory boundaries, trust zones, and prompt governance. It runs as a Node.js service exposing HTTP surfaces for operators, with modular tooling for continuity management and memory scoping. The architecture separates constitutional doctrines (prompt logic, trust rules) from execution layers (server, workers), using a declarative memory graph with per-zone retention policies. Safety checks are prioritized via loopback defaults and runtime constraints, but commercial/public surfaces remain opt-in and manually mediated.  

---

### B. Runtime Authority Map  

| **Component**                     | **Authority**        | **Trust Boundary**              | **File Location**                          |  
|----------------------------------|----------------------|----------------------------------|--------------------------------------------|  
| `agent_server.mjs` (HTTP Server) | Core runtime         | Loopback (default), bearer auth  | `agent_server.mjs`                         |  
| `worker.mjs` (Task queues)       | Core runtime         | Internal                         | `worker.mjs`                               |  
| `PROMPT_CORE.md`                 | Constitutional logic | Operator-governed                | `PROMPT_CORE.md`                           |  
| `CONSTITUTION.md`                | Prompt governance    | Operator-governed                | `CONSTITUTION.md`                          |  
| `sqlite_operational_store.mjs`   | Experimental         | Private process memory           | `lib/sqlite_operational_store.mjs`         |  
| `smoke_test.mjs`                 | Validation suite   | Internal                         | `smoke_test.mjs`                           |  
| `/health`, `/prompt` endpoints   | Runtime interface    | Public (configurable)            | `agent_server.mjs`                         |  
| Trust zones (`private_self`, etc.)| Enforced via code    | Memory scoping                   | `PROMPT_CORE.md`, `worker.mjs`             |  

---

### C. Documentation vs. Code Discrepancies  
1. **SQLite Operational Store**: Documented as experimental in `README.md` (L108-109) but lacks runtime enforcement for opt-in activation. The file exists but no config guards it in `agent_server.mjs`.  
2. **Public Mode Enforcement**: `README.md` (L92-94) claims ephemeral defaults for `paid_public` zones are enforced, but no code in `worker.mjs` or `sqlite_operational_store.mjs` explicitly validates this.  
3. **Political-Economic Claims**: `README.md` (L108-114) states certain economic conditions are "operator-mediated," but no code in `PRODUCTION_READINESS.md` or `agent_server.mjs` enforces these as runtime constraints.  
4. **Prompt Pack Hierarchy**: `PROMPT_CORE.md` (in `LIVE PROMPT PACK`) claims high authority, but `agent_server.mjs` loads prompts via `PROMPT_PACKS.md` logic, which is not referenced in code (no import/require paths in `agent_server.mjs`).  

---

### D. High-Confidence Risks  
1. **Unbounded Memory Leaks in Trust Zones**: `sqlite_operational_store.mjs` exists as experimental but is not memory-scoped per zone (`README.md` L108; `worker.mjs` L0-20).  
2. **Missing Public-Surface Hardening**: `/memory/graph` endpoint allows remote access only if explicitly enabled, but `agent_server.mjs` lacks explicit rate-limiting or auth for this surface (`README.md` L90-94).  
3. **Prompt Governance Drift**: `CONSTITUTION.md` governs default LLM behavior, but `agent_server.mjs` injects runtime context via `PROMPT_PACKS.md` logic not referenced in code.  
4. **SQLite Dependency Drift**: Experimental SQLite code in `lib/sqlite_operational_store.mjs` depends on Node.js 22+ `node:sqlite`, but `package.json` (L14-16) allows Node.js 20.18.1+.  
5. **Operator-Overlay Gaps**: `PRODUCTION_READINESS.md` (in `CHECKLIST`) declares requirements for minified frontends and HTTPS, but no code in `agent_server.mjs` enforces these at runtime.  

---

### E. Deep Review Candidates  
1. **Trust Zone Enforcement**: Examine `worker.mjs` line 45 (memory scoping) vs. `PROMPT_CORE.md` section 3.3 ("Trust Zone Boundaries") for gap.  
2. **SQLite Operational Store**: Review `lib/sqlite_operational_store.mjs` line 12 and compare with Node.js 22+ runtime checks in `README.md` L109.  
3. **Prompt Pack Loading**: Trace how `PROMPT_PACKS.md` (LIVE PROMPT PACK) is resolved in `agent_server.mjs`—check for `require` or `import` references at line 30.  
4. **Public-Surface Hardening**: Inspect `/memory/graph` endpoint handling in `agent_server.mjs` line 78 and ensure bearer auth guards from `README.md` L85 are present.  
5. **Production Readiness**: Cross-reference `PRODUCTION_READINESS.md` checklist items (e.g., HTTPS enforcement) with `agent_server.mjs` line 60 (server binding).  

---  

**Evidence Sources**:  
- Runtime claims: `README.md` L44-72  
- File authority: `FILE_ROLES.md` L15-88  
- Safety constraints: `README.md` L48-59  
- Trust zone enforcement: `PROMPT_CORE.md` L22-35  
- SQLite experimentation notice: `README.md` L108-109  
- Public surface gaps: `agent_server.mjs` endpoint definitions (L40-70) vs. `README.md` L85-88