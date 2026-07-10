# Review Handoff Protocol

This document defines the lightweight protocol for coordinating edits, reviews, and commits across multiple workspace agents (Antigravity, Codex, OpenClaude, and Zero).

## Core Principles

1. **One Active Editor**: Only one agent should execute code edits, run local maintenance checks, and stage changes at any given time to prevent directory conflicts.
2. **Reviewers are Claim Generators**: External or non-local models (e.g. OpenClaude) generate analysis claims and recommendations. They do not hold authorization to write files or commit changes directly.
3. **Adversarial Verification**: Always verify external reviewer claims against the live repository state before accepting them.
4. **Clean Preflight**: Prefer review-only audits and dry runs before introducing edits.
5. **Hygiene Enforcement**: Commit changes only after all local tests (`npm test`) and maintenance checks (`npm run maintain`) are verified green.
6. **Fluid Tooling**: Do not turn tool preferences or task assignments into rigid governance; adjust roles dynamically based on execution context.

## Pattern Intake

External repositories, reviewer outputs, and model critiques are useful inputs,
not authority. Keep provenance internally traceable, but promote only translated
mechanisms that fit Dizzy's local-first runtime, trust zones, receipts,
revocation paths, and operator-control model.

Do:

- Extract mechanisms, failure modes, and verification habits.
- Record source influence in an internal handoff, review note, decision record,
  or reference file when the influence materially shapes a first-party
  mechanism.
- Verify the live repository before treating any outside claim as current.
- Prefer small reversible promotions through tests, receipts, CLI commands, or
  concise docs.
- Keep public/client-facing language focused on Dizzy's implemented behavior,
  not on clone inventories or borrowed legitimacy.

Do not:

- Copy names, UI identity, slogans, README prose, distinctive structure, or
  source code without an explicit license and attribution review.
- Treat a reviewer, template, benchmark, or external project as higher
  authority than runtime code, tests, prompt packs, and local operator intent.
- Convert every attractive idea into doctrine. Ideas can stay in the idea bank
  until repeated use or a concrete failure proves they are worth promoting.

## Review Lenses

Use these lenses when reviewing continuity, retrieval, audit, UI, or delegated
agent work.

### Operation Trace

For each workflow, reconstruct:

`input -> preflight -> runtime decision -> receipt/log -> audit/export/delete`

At each step, distinguish:

- Runtime-enforced facts.
- Persisted receipt claims.
- Derived CLI or dashboard summaries.
- Documentation claims.
- External/provider dependencies.
- Missing, malformed, partial, stale, or contradictory evidence.

### Long-Memory Integrity

For every retained, retrieved, exported, or audited claim, classify:

- Evidence type: semantic fact, episodic event, procedural rule, structured
  artifact, receipt, deletion log, or derived audit summary.
- Storage time vs. event time vs. current runtime time.
- Entity binding: which person, client, task, file, record, or conversation key
  the claim is attached to.
- Numeric binding: owner, property, unit, exactness, and scope.
- Provenance and proof limit: runtime fact, persisted receipt claim,
  filesystem-derived state, docs claim, or best-effort reconstruction.

Check four core failure modes:

1. The wrong memory was retrieved.
2. The right memory was attached to the wrong entity.
3. Storage time was confused with event time.
4. Nearby numbers were used outside their proper scope.

### Proof Limits

Audit surfaces should not hide uncertainty behind green checks. Prefer explicit
states on the appropriate lifecycle, retrieval, or proof field, such as:

- `ok`
- `skipped_precondition`
- `review_anomalies`
- `needs_operator`
- `failed`

Human summaries may lead the view, but raw JSON, provenance, and proof-limit
labels must remain available. Summaries do not outrank receipts, logs, tests,
or runtime facts.

### Targeted Second Pass

If first-pass retrieval or audit evidence is insufficient, prefer a targeted
second retrieval/audit pass. If the exact target remains missing, the correct
answer is an explicit insufficiency statement rather than a guessed one.
