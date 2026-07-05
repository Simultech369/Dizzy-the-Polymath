# Review Handoff Protocol

This document defines the lightweight protocol for coordinating edits, reviews, and commits across multiple workspace agents (Antigravity, Codex, OpenClaude, and Zero).

## Core Principles

1. **One Active Editor**: Only one agent should execute code edits, run local maintenance checks, and stage changes at any given time to prevent directory conflicts.
2. **Reviewers are Claim Generators**: External or non-local models (e.g. OpenClaude) generate analysis claims and recommendations. They do not hold authorization to write files or commit changes directly.
3. **Adversarial Verification**: Always verify external reviewer claims against the live repository state before accepting them.
4. **Clean Preflight**: Prefer review-only audits and dry runs before introducing edits.
5. **Hygiene Enforcement**: Commit changes only after all local tests (`npm test`) and maintenance checks (`npm run maintain`) are verified green.
6. **Fluid Tooling**: Do not turn tool preferences or task assignments into rigid governance; adjust roles dynamically based on execution context.
