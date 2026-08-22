---
id: U-frontier-simulation-and-friction
status: integrated
tier: 2
owner_surface: DESIGN.md
last_reviewed: 2026-08-17
next_action: Integrated in lib/scenario_simulator.mjs, lib/friction_anomaly_detector.mjs, lib/bridging_memory_scanner.mjs and verified by scripts/frontier_simulation_test.mjs.
---

# Frontier Simulation & Friction

This specification drafts two concrete, high-leverage local capability experiments to advance Dizzy's simulation, diagnostic, and RAG capability edges, while maintaining strict operator consent and data sovereignty.

## 1. Bounded Scenario Forking & Time-Travel Replay

### Context
Dizzy's coordination philosophy and stress simulators (e.g., the two-treasury model) require empirical validation. Relying purely on speculative static code analysis or live production runs creates unacceptable operational risk.

### Design
- **Sandbox Forking**: Allow the operator to trigger a local "scenario fork" of the active state inside the sandbox execution engine.
- **Historical Replay**: Replay historical session logs and telemetry through the new parameter sets (e.g., higher reserve decay rate, stricter client continuity expiration).
- **Divergence Visualizer**: Compute the divergence between the baseline run and the forked simulation, projecting it onto the dashboard Options Map as a heat map of friction coordinates.

### Safety Invariant
Scenario forks must remain strictly local and ephemeral to the sandbox session. They must not write to the active `runtime/` or `memory/` directories.

---

## 2. Friction Telemetry & Self-Reporting Loop

### Context
Friction metrics on options space proposals are currently statically coded or manual. Operators need a clean, automated way to monitor systemic friction across sessions.

### Design
- **Friction Cluster Analysis**: Aggregate and redact friction metrics from recent session logs to identify patterns (e.g., clusters indicating high friction around specific capability classes).
- **Local Anomaly Detection**: Implement a lightweight local statistical monitor (e.g., checking for a 3-sigma deviation from baseline friction trends).
- **Review Triggers**: If a session crosses the anomaly threshold, prompt the operator: *"This session shows a 3σ deviation on friction signal X — review trajectory?"*

### Safety Invariant
No telemetry data is transmitted externally. The anomaly detector runs completely client-side in the local Node.js environment.

---

## 3. Opt-In Quarantine-First Bridging Memories

### Context
Scanning for conceptual overlaps across sessions increases usefulness but risks boundary leakage, accidental promotion, and revocation complexity.

### Design
- **Local Text Indexes**: Run a background Jaccard or BM25 semantic similarity scan across historical daily logs on session close.
- **Opt-In Requirement**: The cross-session scan is strictly opt-in, disabled by default.
- **Quarantine Staging**: Identified concept bridges are not automatically written to the memory graph. They are placed in a quarantined state under a staging directory (e.g., `runtime/quarantine/`).
- **Operator Review**: Quarantined memory suggestions are rendered in the dashboard as draft cards, requiring explicit operator sign-off to merge.

---

## Parked Options (Future Consideration)
The following designs are noted as potential future capabilities but are currently parked to manage complexity:
- **Operator Intention Capture**: Storing structured "intentions" alongside tool execution receipts to document the "why" of governance.
- **Constitutional Drift Panel**: A dashboard panel computing local diffs between prompt configurations and `CONSTITUTION.md` to flag drift.
- **Provable Memory Provenance Chains**: Hash-linked verification chains for memory graph nodes to allow structured challenge/re-evaluation.
