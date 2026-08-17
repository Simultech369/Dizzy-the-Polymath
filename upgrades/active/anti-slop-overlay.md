---
id: W-0062
status: completed
tier: 2
owner_surface: governance
last_reviewed: 2026-08-17
next_action: Integrated in lib/anti_slop_scanner.mjs and verified by scripts/anti_slop_prose_fixture_check.mjs.
owner: dizzy
---

# W-0062 & W-0063 Advisory Spec: Anti-Slop Overlay & Tree-Bounded Context Retrieval

Mode: Low-Credit Momentum & Pattern Intake (No Runtime Code Changes)


## 1. Overview & Operational Contract

This document defines the specification for **W-0062 (Anti-Slop Overlay)** and **W-0063 (Tree-Bounded Context Retrieval & Orchestration Rules)**. 

In accordance with the **Control Envelope / Pause Protocol**, this spec defines advisory governance, rules, and formats **without modifying runtime code, scanner scripts, or dashboard interfaces**.

### Core Operational Principles (Pattern Intake):
1. **Zero External Dependency Addition**: Intake patterns, not dependencies. No vector databases, no heavy frameworks, no external service locks.
2. **Detection-Only Default**: All scanner and review passes operate in detection-only mode by default (analogous to VVAH `--stop-after s9`). Implementation fixes remain a separate, explicitly authorized phase.
3. **Traceable Local Authority**: Memory, context, and governance are 100% file-backed (`.md` / `.json`). No opaque embedding vectors or chunk-vibe retrieval.

---

## 2. W-0063: Tree-Bounded Context Retrieval (PageIndex Translation)

### A. Context Manifest (`context-tree.json`)
Rather than loading entire review ledgers or relying on chunked vector search, the workspace maintains a lightweight, human-readable structural tree index.

```json
{
  "version": "1.0.0",
  "root": "C:\\Users\\Josh\\clawd",
  "nodes": [
    {
      "id": "governance.prompt_core",
      "path": "PROMPT_CORE.md",
      "authority": "constitutional",
      "freshness": "2026-07-25",
      "summary": "Core live prompt pack rules, drift audit parameters, and behavioral constraints.",
      "sections": [
        {"title": "Role & Boundaries", "lines": "L1-L45"},
        {"title": "Drift Rules", "lines": "L46-L110"}
      ]
    },
    {
      "id": "reviews.synthesis_ledger",
      "path": "reviews/oss_model_synthesis_ledger.md",
      "authority": "decision_artifact",
      "freshness": "2026-07-23",
      "summary": "Multi-model OSS review synthesis, accepted test assertions, and onboarding gates.",
      "sections": [
        {"title": "Consensus Findings", "lines": "L45-L70"},
        {"title": "Candidate Assertions", "lines": "L71-L90"}
      ]
    },
    {
      "id": "planning.orchestration",
      "path": "reviews/low_credit_antigravity_oss_orchestration.md",
      "authority": "control_handoff",
      "freshness": "2026-07-25",
      "summary": "Low-credit momentum plan, Ollama local model bench execution script, and Antigravity kickoff boundaries.",
      "sections": [
        {"title": "Snapshot Gate", "lines": "L7-L30"},
        {"title": "Local Commands", "lines": "L113-L190"}
      ]
    }
  ]
}
```

### B. Reasoned Context Selection Rule
Before initiating any review or synthesis pass:
1. Perform a **node selection pass** against `context-tree.json`: *"Which exact node IDs and line ranges govern this slice?"*
2. Load **only** the selected node sections into context.
3. **Benefit**: Eliminates context sludge, prevents hallucinated cross-file drift, and minimizes token burn.

---

## 3. W-0062: Anti-Slop Advisory Rules

W-0062 establishes an advisory overlay to detect visual, text, and governance slop.

### A. Categorized Detection Rules

| Category | Warning Trigger | Classification | Recommended Action |
| :--- | :--- | :--- | :--- |
| **Sycophancy & Filler** | Generic praise ("Great question!", "Certainly!", "I would be happy to...") | Advisory (Yellow Warning) | Strip filler; start response directly with technical facts. |
| **Promotional AI Tells** | Over-used promotional jargon ("game-changer", "seamless integration", "cutting-edge") | Advisory (Yellow Warning) | Rephrase into concrete capability statements. |
| **Fake Symmetry & Structural Slop** | Over-rehearsed, artificial balanced prose without distinct empirical evidence | Advisory (Yellow Warning) | Highlight asymmetric risks and empirical trade-offs. |
| **Visual / Style Slop** | Inline un-themed CSS gradients (`style="background: linear-gradient(...)"`) in UI components | Advisory (Yellow Warning) | Move to tokens in `dashboard/index.css` or design system. |
| **Contract / Safety Violation** | Modifying off-limits files (`lib/*`, `dashboard/*`) without explicit slice selection | **Hard Failure (Red)** | Halt execution; revert file mutation. |

---

## 4. Pipeline Discipline & Claim Reconciliation (VVAH Translation)

### A. Mean Time to Ground (MTTG) Metric
To measure orchestration efficiency, track **MTTG**:
$$\text{MTTG} = t_{\text{grounded}} - t_{\text{claim\_emitted}}$$
- **Goal**: Minimize elapsed time between a model proposing a claim $\rightarrow$ inspecting live repo evidence $\rightarrow$ recording an Accepted/Rejected/Deferred disposition.

### B. The Dropped-Claims Appendix Rule
Every model review synthesis document MUST include a **Dropped & Deferred Claims Appendix**.
- **Accepted Claims**: Promoted to spec acceptance criteria.
- **Rejected Claims**: Recorded with explicit counter-evidence (prevents ghost authority).
- **Deferred Ideas**: Kept in backlog without clogging active work.

---

## 5. Off-Limits & Scope Boundaries

During the initial spec review and any future initial candidate slice, the following paths remain **STRICTLY OFF-LIMITS** to edits:

- `lib/anti_slop_scanner.mjs`
- `scripts/maintain.mjs`
- `scripts/safety_checks.mjs`
- `dashboard/index.html`
- `dashboard/dashboard.js`
- `lib/client_continuity.mjs`
- `lib/consensus.mjs`
- `lib/memory_graph.mjs`

---

## 6. Antigravity Hand-Off & Next Verification Step

Antigravity operates in **Spec-Only Mode** until Simul explicitly authorizes implementation.

**Next Verification**:
1. Rerun git snapshot gate: `git status --short`.
2. Inspect output from local Ollama review passes (`oss_w0062_qwen_local_review.md`).
3. Reconcile local model claims into the Dropped-Claims Appendix format.
4. Wait for explicit Simul approval before modifying any code files.
