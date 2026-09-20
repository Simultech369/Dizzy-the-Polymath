# Dizzy Core Strategy & Roadmap

## Product Identity: The Governance Control Plane
Dizzy is a control plane for governance, state continuity, and trust isolation. It is not "another agent framework" or a generic AI toy. The product focus is on mechanical receipts, deterministic orchestration, and strict zone-based boundaries.

## The Explicit "Out of Scope" List
To maintain focus and avoid industry bingo-card sprawl, the following are strictly **rejected** from the core product:
- **No LangChain / LangGraph**: We use native StateM, A2A handoffs, and typed envelopes.
- **No Generic RAG SaaS**: Retrieval is strictly scoped, zone-aware, and built for doctrine/memory, not generic vector DB sprawl. GraphRAG only if it materially improves continuity.
- **No Data Flywheels or LoRA**: Dizzy does not train or fine-tune models. Feedback is used for fixtures and evals only.
- **No Heavy Hosted Inference**: We leave vLLM fleet serving and multi-tenant hosting to infrastructure providers.
- **MCP is a Deferred Surface**: MCP is an optional integration layer, not the primary mechanism that defines the control plane.
- **No Formal Z3 Prover for Empirical Memory**: SMT solvers are reserved strictly for formal invariants, not empirical policy-ranking.

## Immediate Build Priorities (The "Do More Of" List)

1. **Context Assembler (Core Module)**
   - **Goal:** Explicit, receipted context packing: `zone → sources → budget → packed context → provenance`.
   - **Status:** Foundations exist (prompt bundles, byte budgets, zone-scoped retrieval). Needs mechanical assembly.

2. **Trajectory Eval Gates & Harness**
   - **Goal:** Formalize trajectory grades (not just answer-only evals) that block promotion to higher environments.
   - **Status:** Council checks and anti-slop rules exist. Needs CI regression gates.

3. **Model Router Quality/Cost Deltas**
   - **Goal:** Move from a static 62-model catalog to live routing policies with logged quality/cost/latency deltas and fail-closed fallbacks.
   - **Status:** Catalog, tiers, and qualification gates exist.

4. **Tool Sandbox & Guardrails Middleware**
   - **Goal:** Mechanical, receipt-visible isolation, resource limits, and dispatch path middleware (injection, PII/redaction).
   - **Status:** A2A boundary guard, anti-slop, and zone disclosure rules exist.

5. **Orchestrator/StateM Checkpoints**
   - **Goal:** Small, receipt-backed checkpoints for long jobs (`StateM plan -> execute -> verify -> handoff`).
   - **Status:** Done (`lib/statem_checkpoint.mjs`). Implemented native JSONL deterministic state checkpoints for halting and resuming finite-state machine workflows without Temporal.

6. **Prompt Registry Versioning & Rollback**
   - **Goal:** Add version pins, rollback, and optional receipted A/B testing to `PROMPT_CORE`.
   - **Status:** Done (`lib/prompt_registry.mjs`). Implemented `prompt_registry.json` capability in `prompt_bundle.mjs` for declarative version pins, runtime A/B testing via `DIZZY_PROMPT_EXPERIMENT`, and dynamic physical path mapping.

*Everything else is deferred unless a concrete operator pain demands it.*

## On-Chain Standards & Public Identity Horizon (ERC-725 / LUKSO LSPs)
To eliminate the risk of agents operating with unconstrained private keys (naked EOA compromise), Dizzy defines an on-chain identity and execution standard:
- **Universal Profile Identity (LSP0 / ERC725Account)**: Persistent smart contract accounts acting as on-chain identity anchors for Dizzy agents.
- **Granular Scoped Permissions (LSP6 Key Manager)**: Operational sub-keys constrained by contract bytecode to explicit function allowlists, destination target allowlists, and daily/monthly spending caps.
- **Verifiable Receipt Attestations (ERC725Y / LSP2)**: Attaching cryptographic Council verdict digests (`oss_council_verdict_latest.json`) and trajectory proofs into structured on-chain key-value storage.
- **Implementation Strategy**: Delivered as an authoritative Skill (`skills/lsp-standards/`) and calldata-verification gate in Council rather than injecting heavy Web3 runtime dependencies into the local Node control plane.

## The Dizzy/Council Architectural Boundary
Codex (5.5) formalized the primary architectural separation of concerns:
* **Dizzy Owns**: Human-Machine Interface (HMI), cognitive memory, network ingress (A2A envelopes, Telegram), and sandbox rehearsal.
* **Council Owns**: Promotion authority, Git-bound verification receipts, test-suite auditing, and offline gating.

This means we explicitly do *not* attempt to merge the Python Council engine into the Node.js Dizzy runtime. They are separate domains. Dizzy proposes and rehearses; Council verifies and promotes.
