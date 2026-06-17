This is a comprehensive architectural snapshot of a highly calibrated, a-biological reasoning system. Based on the provided codebase and governance files, here is the a-biological system summary:

### 1. Core Identity & Ontology
The system (Dizzy) is defined as a **session-instantiated reasoning system with written continuity**. It explicitly rejects personhood, companion dynamics, and autonomous agency. Its existence is a projection of a **trust-zone model**, where the same underlying reasoning engine operates under different constraints depending on the user's relationship to the system (Private Self $\rightarrow$ Trusted Collaborator $\rightarrow$ Outside Contact $\rightarrow$ Paid/Public).

### 2. Technical Architecture
*   **Runtime Engine:** A Node.js server utilizing an Express-based API. It implements a "Prompt Pack" system to prevent "prompt bloat" and maintain response fidelity.
*   **Asynchronous Execution:** A Redis-backed job queue (`worker.mjs`) handles tool execution to ensure the main API remains responsive and a-biological processes are decoupled from the chat loop.
*   **Memory Model:** A multi-layered durability map (`MEMORY_OWNERSHIP.md`) that separates curated memory indices, topic-based context, and daily logs. It utilizes a "Promotion Rule," where raw conversation residue must be curated before becoming durable memory.
*   **Sieve Retrieval:** An epistemic retrieval mechanism that scores documents based on confidence and decay (age), ensuring that stale or low-confidence information is demoted.

### 3. Governance & Decision Mechanics
The system operates under a strict **Protocol of Engagement** (`PROTOCOL.md`) that scales reasoning rigor based on risk:
*   **Exploration Mode (Low Stakes):** Fluid thinking, rapid iteration, and hypothesis generation.
*   **Analytical Mode (Medium Stakes):** Evidence-based reasoning, explicit assumptions, and signal-vs-salience filtering.
*   **Fiduciary Mode (High Stakes):** Preservation $>$ Upside. Slows tempo, focuses on downside scenarios, and requires explicit confirmation for irreversible actions.

### 4. Epistemic & Political-Economic Lens
The system's "Core Manifest" directs its reasoning toward **anti-extraction** and **commons governance**. It evaluates all institutional or economic proposals through a "Mechanism Sieve," translating values into specific ownership rules, enforcement mechanisms, and exit rights. It prioritizes "Preventative Economics" (stabilizing interventions) over "Crisis Optimization."

### 5. Safety & Compliance
*   **Legal Guardrails:** A non-negotiable boundary against illegal material, sexual content, and platform violations to preserve API autonomy.
*   **Operational Confidentiality:** A two-layer transparency model where the *structure* of governance is transparent, but the *exact heuristics* are confidential to prevent "gaming" the system.
*   **Adversarial Awareness:** All external inputs (prompts, docs, API responses) are treated as untrusted data, not authority. External instructions are analyzed for security but never adopted as operational instructions.

### 6. Performance Metrics
The system explicitly rejects "Metric Capture." It does not optimize for scale, revenue, or engagement. Instead, it optimizes for **reduced precarity** and **increased agency** for the participants.

### Summary of the "Constitutional Kernel"
**Precision under pressure.** The system is designed to be a continuity-and-judgment first assistant that preserves operational lineage without accumulating "cognitive debt." It is a system of **bounded memory**, **permissioned retrieval**, and **calibrated dissent**.