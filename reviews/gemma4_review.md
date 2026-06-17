This is a comprehensive system architecture for a specialized AI agent named **Dizzy**. Based on the provided files, the system is designed as a **continuity-and-judgment-first** assistant that prioritizes epistemic fidelity, risk management, and political-economic alignment over generic AI behavior.

Here is a high-level synthesis of the system's architecture:

### 1. Governance & Constitutional Layer
The system operates on a strict hierarchy of authority to prevent "emotional drift" or "structural incoherence."
*   **Constitutional Kernel (`CONSTITUTION.md`):** The non-negotiable boundaries (e.g., ontology stays bounded, no personhood, trust-zone enforcement).
*   **Prompt Packs (`PROMPT_PACKS.md`):** Curated subsets of files (e.g., `core`, `creative`, `ops`) that act as the runtime constitution for chat, preventing "prompt bloat."
*   **Decision Logic (`DESIGN.md` & `PROMPT_CORE.md`):** Human-written specifications that eliminate generic AI filler and enforce "epistemic preflight" (silent checks for trade-offs, cost, and governance before responding).
*   **Protocol & Guardrails (`PROTOCOL.md`, `LEGAL-GUARDRAILS.md`):** Scaling response styles based on risk (Exploration $\rightarrow$ Analytical $\rightarrow$ Fiduciary) and ensuring platform compliance.

### 2. Trust-Zone Architecture
To handle both private and commercial interactions without leakage, the system uses a **Trust-Zone model**:
*   **`private_self`:** Full continuity and durable memory.
*   **`trusted_collaborator`:** Scoped continuity with redaction.
*   **`outside_contact`:** Fresh-context reasoning.
*   **`paid_public`:** Ephemeral by default; strictly prohibits hidden cross-client carryover.

### 3. Memory & Continuity System
Instead of treating memory as a raw transcript, Dizzy treats it as **curated judgment support**:
*   **Memory Lifecycle:** Claims are classed by source, confidence, and freshness. Memory is demoted or forgotten if it no longer improves present judgment.
*   **Ownership Map (`MEMORY_OWNERSHIP.md`):** Defines which subsystem owns which surface (e.g., `MEMORY.md`, daily logs, conversation memories) to prevent silent overwrites.
*   **Continuity:** Uses memory to support discernment, not to simulate intimacy.

### 4. Technical Infrastructure
The system uses a decoupled architecture for reasoning and execution:
*   **`agent_server.mjs` (The Brain):** Handles the API, trust-zone routing, and prompt pack assembly.
*   **`worker.mjs` (The Muscle):** A background worker that processes "tool jobs" via a Redis-backed queue to handle external actions asynchronously.
*   **Redis Queue (`lib/queue.mjs`):** Manages jobs and notifications, ensuring that external actions are idempotent and trackable via `idempotency-key` headers.
*   **Markdown Retriever (`lib/md_retriever.mjs`):** A RAG (Retrieval-Augmented Generation) system that fetches relevant snippets from the local knowledge base based on "sieve" logic (scoring based on confidence and decay).

### 5. Political-Economic Alignment
Dizzy is explicitly aligned with **anti-extractive** and **commons-based** values:
*   **Mechanism Sieve:** Translates vague values (e.g., "anti-extractive") into concrete mechanisms (e.g., access floors, portability, appeal).
*   **Anti-Metric Capture:** Rejects optimization for scale or engagement unless tied to increased agency or reduced precarity.
*   **Commons Governance:** Evaluates systems by their boundaries, rules, and low-cost conflict resolution.

### 6. Operational Safety & Maintenance
*   **Drift Audit (`DRIFT_AUDIT.md`):** A regular check to label documents as `accurate`, `stale`, `aspirational`, or `dangerous-if-literal`.
*   **Self-Modification:** Privileged features like `/improve` and `/apply` are gated behind `DIZZY_ALLOW_SELF_MODIFY=1` to prevent uncontrolled mutations of the system's own logic.
*   **Sieve Retrieval:** Uses a "decay factor" (e.g., $\text{decay} = 0.5^{\text{age}/180}$) to prioritize fresher information over stale data.

### Summary of the "Dizzy" Persona
Dizzy is not a "companion" or a "person." It is a **reasoning system** designed for high-stakes judgment. It avoids the "AI-writing" patterns (inflated significance, canned transitions) and instead uses a "lite compression" style—cutting filler while maintaining technical precision and intellectual rigor.