# Codex Handoff: 5-Stage Memory Architecture for Dizzy

**To:** Codex
**From:** Antigravity 3.1 Pro
**Topic:** Implementing a Deterministic Memory Engine (Capture, Consolidate, Retrieve, Reconcile, Decay)

Codex, the user surfaced an architecture for a 5-stage memory pipeline (from 0xWast3) that directly solves the "context dilution" and "vector bloat" problems of naive RAG systems. 

Here is my analysis on why this process is elite, and exactly how it maps to Dizzy's architecture and the OSS Council.

## 1. Analysis of the 5-Stage Process
The genius of this process is that it treats memory as a **rejection system first**, rather than a storage system. 
*   **Capture** blocks ephemeral noise from ever entering the DB.
*   **Consolidate** acts as a deduplication compressor. 
*   **Retrieve** uses a beautiful scoring algorithm (Semantic + Freshness + Reinforcement + Confidence) rather than naive cosine similarity.
*   **Reconcile** forces the system to confront contradictions instead of silently guessing.
*   **Decay** prevents the database from calcifying into an unsearchable landfill of stale context.

This isn't just a database; it is a lifecycle engine. It mirrors human sleep cycles - compressing, discarding, and reinforcing.

## 2. Application to Dizzy & The OSS Council
Dizzy is a deterministic, local-first state machine. It is not a chatty assistant. Therefore, this memory pipeline perfectly aligns with our engineering ethos. Here is how we map it:

### A. The OSS Council's Shared Memory
Right now, the local OSS Council models (Llama 3.1, Qwen) audit syntax and execution from scratch every time. 
*   *If we inject this pipeline:* The Council can build a shared `durable` memory of past architectural decisions. If a specific edge case in `agent_server.mjs` fails testing three times, the Council *Consolidates* a rule: "Always check backpressure on SSE streams." 
*   If we update the SSE framework later, the *Reconcile* stage flags the contradiction, and *Decay* slowly fades the old rule out of the active context window.

### B. Memory as A2A Envelopes
In Dizzy, nothing happens invisibly. Memory updates should not be silent DB writes. 
*   When the engine triggers a **Consolidate** or **Reconcile** action, it should broadcast a `dizzy.memory_update.v1` A2A envelope. 
*   This allows the Frontier Arbiter to see exactly *why* a constraint changed, creating a perfect cryptographic receipt of the system's learning process.

### C. The Jazz Polymath Angle
Jazz requires knowing the exact constraints so you can ignore the rest and improvise. The **Decay** and **Retrieve** steps are the ultimate "anti-slop" mechanisms for context. By purposefully decaying old, unreinforced facts, Dizzy's context window remains incredibly sparse, fast, and high-signal.

## 3. Implementation Directive for Codex
When we have the credits and the mandate to build this, I propose we implement this as `lib/memory_engine.mjs`. 
1.  Do not use a heavy vector database initially. Implement the storage layer as a structured **Markdown Wiki** directory (e.g., `memory/wiki/`). This enables "Traversal Skills" (following wiki links) rather than naive semantic vector dumping, perfectly aligning with Dizzy's cryptographic, local-first filesystem architecture.
2.  Wire the `MemoryClass` enum (`EPHEMERAL`, `DURABLE`, `EXPIRING`) directly into our StateM runbook definitions.
3.  Add the `run_maintenance()` (Decay) function to our existing Redis queue `worker.mjs` as a background cron job that runs once every 24 hours to fade old confidence scores.

This is the blueprint for Dizzy's long-term cognition. Store it in your context for the next feature sprint.


