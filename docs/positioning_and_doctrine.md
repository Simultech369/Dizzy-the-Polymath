# Dizzy Positioning and Doctrine

## Core Thesis
The market already overbuilt general assistants, agent frameworks, and RAG wrappers. What is still scarce is **context engineering with expiry**, **evals that grade trajectories**, and **cost-aware routing under real trust boundaries**. 

Dizzy is local-first control-plane software for that layer:
- Memory that can expire by zone and sensitivity tier
- Context assembly under deterministic byte and token budgets
- Tamper-evident verification receipts for recorded state transitions
- Human confirmation on irreversible or external actions
- An offline, local verification Council harness

Dizzy is **not** another autopilot, chatbot companion, or MCP-maxed harness.

---

## The Build Matrix: Where Hype Applies vs. Where to Demote

| Priority Pillar | Stance & Mechanism in Dizzy | Anti-Pattern to Reject |
| :--- | :--- | :--- |
| **Context Engineering** | Pure Assembler: `zone -> sources -> budget -> pack -> provenance`. Strict byte budgets, no unmeasured prompt stuffing. | "Bigger context windows solve everything." |
| **Evals & Verification** | Trajectory gates, deterministic test suites, OSS Council receipts, fixture regression. Quality as verifiable machinery. | "Agent vs baseline" vanity slides or LLM-as-a-judge optimism. |
| **Expiring Memory** | Trust-zone decay, sensitivity tiers (`public_safe`, `normal`, `do_not_export`), partitioned disclosure. | "Infinite lifetime memory" assistant bloat. |
| **Cost & Routing** | Effort budgets, tier fallbacks (T0 deterministic to T3 frontier), per-run kill switches (`max_cost_usd`), thinking token clamping on easy tasks. | Building an OmniRoute/vLLM cloud gateway product. |
| **Vertical Workflows** | StateM finite-state machines (`plan -> execute <-> verify -> handoff`) for specific, accountable operator work. | Generic "do anything" autonomous agent swarms. |
| **Operator Centricity** | Forward-deployed, operator-mediated, local-first. System proposes; operator approves. | Autonomous autopilot CEOs / company brains. |
| **Computer Use** | Restricted tools behind consent/sandbox; explicit human approval for external or irreversible actions. | Unrestricted, un-sandboxed browser agents clicking wild web forms. |
| **Open-Weight Stacks** | Local Ollama/llama.cpp models are replaceable execution engines under our control plane. | Proprietary vendor lock-in or training our own base models. |

---

## What Dizzy Avoids Sounding Like (Anti-Positioning)

1. **Not a General AI Assistant**: Dizzy is not a companion; it provides state continuity and judgment under explicit boundaries.
2. **Not an Agent Framework**: Native StateM + tamper-evident verification receipts, not a LangChain/LangGraph-shaped platform.
3. **Not Infinite Multi-Agent Crews**: Small, specialized council roles with typed handoffs, not swarm cosplay.
4. **Not MCP-Maxed**: MCP is an optional external surface, never the product center.
5. **Not a Prompt-Only Startup**: Doctrine + runtime + 57+ deterministic test suites; prompts are not the company.
6. **Not "Just Add RAG"**: Scoped, zone-partitioned retrieval--not "we vectorized the codebase into Pinecone."
7. **Not Autopilot Software**: The operator remains in control; Dizzy proposes, but does not independently authorize external actions.
8. **Not Framework Tribalism**: Mechanisms and proofs matter more than framework fashion.
9. **Not Notebook Portfolios**: Runnable gates, Git-bound verification receipts, and honest documentation.

---

## Pitch Paragraph
> "The market already overbuilt general assistants, agent frameworks, and RAG wrappers. What's still scarce is context engineering with expiry, evals that grade trajectories, and cost-aware routing under real trust boundaries. Dizzy is local-first control-plane software for that layer: memory that can expire by zone, assembly under token budgets, verification receipts, and human confirmation on irreversible actions--not another autopilot or MCP-maxed harness."
