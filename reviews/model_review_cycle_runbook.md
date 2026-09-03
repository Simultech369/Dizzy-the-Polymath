# Model Review Cycle Runbook

Status: draft for Codex-led review cycles
Role boundary: external models produce review claims; Codex reconciles claims; Antigravity remains final implementer.

## Purpose

Use this runbook to run capability-specific reviewer passes without converting Codex into the final implementer. Each pass should create a review artifact, record provenance, and feed a claim ledger. The cycle may iterate autonomously across prompts, retries, and reconciliation, but it must stop before code implementation, destructive cleanup, external publication, or push.

## Non-Negotiable Guardrails

- No reset, clean, stash, delete, rename, VM deletion, state pruning, credential rewriting, or broad formatting.
- Do not override `HOME`, `USERPROFILE`, provider paths, repo roots, credential locations, or durable environment variables to force a pass.
- External model output is not evidence. It is a claim set requiring live repo reconciliation.
- A named target that is missing means `target not found`; do not operate on similar, fallback, inferred, or nearby targets.
- Reviewer prompts must ask for smallest reversible remediation and explicit uncertainty labels.
- Reviewer prompts must ask for one under-asked assumption, the smallest local check that could disprove it, and whether that assumption blocks the current slice or is deferred.
- Any test recommendation that writes state must identify the exact writable root, cleanup target, and side effects.
- Stop before sending anything public, making commits, pushing, or modifying implementation code unless Simul explicitly changes the role boundary.

## External Review Packet Discipline

Before any external-model review, Codex classifies the exact packet as one of:

- `committed-shareable`: committed repo material intended to be shareable for review.
- `local-planning`: local review docs, handoffs, prompts, or claim ledgers that may be shared only when the file list is explicit and the review goal needs them.
- `dirty-code`: uncommitted implementation or test changes that may be shared only when Simul approves the exact file list.
- `restricted`: credentials, provider configuration, unredacted user or continuity material, private operator notes, sensitive runtime data, or anything whose disclosure has not been explicitly approved.

Restricted material is never supplied to a reviewer. If classification is uncertain, classify upward and stop for Simul's approval. Dirty code may be shared only when Simul approves the exact file list.

Every reviewer pass records the snapshot, packet class, exact files, model/provider surface, prompt, output location, provider failures, and reconciliation result. External output remains a claim source only: Codex verifies it against the live repo; Antigravity chooses and implements accepted mechanisms; Simul alone authorizes push, publication, or external action.

For consequential accepted claims, record whether the claim describes current behavior, historical evidence, or future intent, and whether it is runtime-enforced, script-enforced, dashboard-supported, docs-only, or not implemented.

## Reviewer-Cycle Disposition Rule

Before running any model review, name its intended output bucket:

- acceptance criterion;
- contradiction to reconcile;
- under-asked question;
- duplicate signal;
- wording improvement;
- provider failure.

A reviewer result may be preserved only inside its named bucket. It does not become policy acceptance, implementation authority, publication authority, or backlog scope by default.

If the result does not fit one of those buckets, do not promote it into the handoff packet. Summarize it as exploratory only or discard it.

Duplicate signal is still useful: it can increase confidence that a concern is real, but it does not create a new task unless it adds evidence, sharper wording, or a better local verification question.

When a prompt, provider route, command, or check fails in a way that should change future behavior, record a compact correction:

| Field | Meaning |
| --- | --- |
| Tried | The command, prompt, claim, or assumption |
| Disproved by | The live repo evidence, command output, or threat model that disproved it |
| Corrected rule | The smallest reusable rule for future work |
| Future check | The command, fixture, file reference, or acceptance gate that should catch it next time |

This is a review-packet guardrail, not implementation authority, a release gate, or a new product backlog.

## Cycle Shape

1. Snapshot gate:
   - `git branch --show-current`
   - `git rev-parse HEAD`
   - `git rev-parse origin/main`
   - `git status --short`
2. Select one narrow question:
   - active-policy correctness,
   - inert verification harness,
   - route/mutation boundary,
   - bridge lifecycle,
   - continuity deletion,
   - simulation labeling/bounds,
   - HUD accessibility/truth-language.
3. Select model/lens by capability.
4. Classify the packet and run with the minimum required files.
5. Save output under `reviews/`.
6. Record provenance:
   - model or lens,
   - exact slug if known,
   - run surface,
   - packet class,
   - prompt file,
   - files supplied,
   - output file,
   - provider errors or retries.
7. Reconcile:
   - claim,
   - live evidence,
   - time scope,
   - enforcement level,
   - disposition,
   - acceptance criterion,
   - whether Antigravity should implement it.
8. Iterate only if the next question is narrower than the last one.

## Reviewer Bench

| Reviewer | Best Use | Default Surface | Provenance Caveat |
| --- | --- | --- | --- |
| Cohere | code-review synthesis, terminal-agent practicality, small reversible mechanisms | OpenRouter `cohere/north-mini-code:free` when available | route works, but very small `max_tokens` can return reasoning-only chunks with null content; use enough output budget or `reasoning.exclude=true` |
| Zero | proof-vs-theater, hidden assumptions, operator boundary checks | `zero.cmd` or OpenRouter/lens prompt | local Zero provider currently points at OpenRouter `qwen/qwen3-32b` unless changed |
| Kimi | diagnostic usability, narrative clarity, operator comprehension | OpenRouter pinned slug if available, otherwise lens prompt | free Kimi routes returned 404 on 2026-07-19; do not treat a blocked run as a review |
| Qwen | architecture coherence, performance, concurrency, route contracts | Zero OpenRouter profile or OpenRouter pinned slug | local Zero OpenRouter provider reports `qwen/qwen3-32b` |
| DeepSeek | safety/risk reasoning, edge cases, invariant pressure | OpenRouter pinned slug if available | confirm exact available slug before running |
| DSV4 Flash | fast handoff-misread checks, assumption disruption, public-overclaim sparks | OpenRouter `deepseek/deepseek-v4-flash` when credits are available | treat as a lightweight claim source; a paid-route 402 creates no review findings |
| Gemma | defensive checklists, NaN/division-by-zero, accessibility details | OpenRouter/free or local Ollama without tools | previous specific free Gemma slugs failed |
| Hy3 | long-context reconciliation, active-policy semantics, route/mutation matrix | OpenRouter `tencent/hy3:free` while available; paid `tencent/hy3` requires credits | free route ping succeeded on 2026-07-20; paid route returned 402 with current OpenRouter account |
| Muse Spark | visual/aesthetic/product-surface critique | Antigravity model/lens prompt, or OpenRouter `meta/muse-spark-1.1` if credits exist | OpenRouter catalog lists Muse Spark 1.1, but ping returned 402 with current OpenRouter account |
| Seed-2.1-Pro | systems architecture, memory/indexing, backend coherence | Antigravity model/lens prompt | exact OpenRouter slug `bytedance-seed/seed-2.1-pro` returned invalid-model 400 on 2026-07-20; catalog lists Seed 2.0/1.6 variants only, and Seed 2.0 pings require credits |

## Debug Rules

- HTTP 404 model unavailable:
  - keep the failed artifact/log,
  - mark slug unavailable,
  - retry with either paid canonical slug or `openrouter/free` only if the provenance notes the change.
- HTTP 402 insufficient credits:
  - keep the prompt and exact file list,
  - record that no model review was obtained,
  - do not substitute another model under the same reviewer label.
- Reasoning-only or null-content response:
  - preserve the response metadata,
  - retry once with a larger `max_tokens` budget and, where supported, `reasoning.exclude=true`,
  - do not treat a successful HTTP response with null content as a usable review artifact.
- HTTP 502 or streamed provider error:
  - preserve partial output only as partial,
  - rerun once with the same prompt and a narrower file set,
  - if it fails twice, stop and mark provider unstable.
- Empty or generic review:
  - rerun with stricter output schema and fewer files,
  - ask for `no material issue found` by inspected area,
  - require file/function references.
- Model tries to implement:
  - discard implementation instructions unless they can be rewritten as acceptance criteria,
  - do not copy patches into the repo.
- Conflicting model claims:
  - convert disagreement into a live verification question,
  - prefer evidence over model rank or confidence.

## Current First Cycle

Question:

Does the active-policy correction sequence have the right acceptance criteria before Antigravity resumes implementation?

Minimum context:

- `lib/active_policy_engine.mjs`
- `lib/friction_anomaly_detector.mjs`
- `lib/friction_ledger.mjs`
- `lib/durable_write_policy.mjs`
- `scripts/check_active_policy_state.mjs`
- `scripts/test_active_integration.mjs`
- `scripts/safety_checks.mjs`
- `scripts/maintain.mjs`
- `scripts/connection_scan.mjs`
- `package.json`
- `reviews/codex_antigravity_handoff_addendum.md`

Expected outputs:

- `reviews/cohere_active_policy_review.md`
- `reviews/qwen_active_policy_review.md`
- `reviews/deepseek_active_policy_review.md`
- `reviews/hy3_active_policy_review.md`
- `reviews/model_claim_ledger_active_policy.md`

## OpenRouter Command Template

Use `--no-default-files` and explicit `--add-file` entries so the review does not accidentally upload unrelated backlog.

```powershell
python scripts/openrouter_review.py `
  --model "cohere/north-mini-code:free" `
  --prompt-file "reviews/prompts/cohere-active-policy-review.md" `
  --output "reviews/cohere_active_policy_review.md" `
  --no-default-files `
  --add-file "lib/active_policy_engine.mjs" `
  --add-file "lib/friction_anomaly_detector.mjs" `
  --add-file "lib/friction_ledger.mjs" `
  --add-file "lib/durable_write_policy.mjs" `
  --add-file "scripts/check_active_policy_state.mjs" `
  --add-file "scripts/test_active_integration.mjs" `
  --add-file "scripts/safety_checks.mjs" `
  --add-file "scripts/maintain.mjs" `
  --add-file "scripts/connection_scan.mjs" `
  --add-file "package.json" `
  --add-file "reviews/codex_antigravity_handoff_addendum.md"
```

## Zero Command Template

Use Zero only as a no-edit reviewer. Keep tools out of the prompt unless there is a reviewed sandbox plan.

```powershell
@'
You are Zero, acting only as an independent reviewer.
Work in <local-clawd-checkout>.
Do not edit files. Do not run destructive commands. Do not commit or push.

Review the active-policy handoff and live files for proof-vs-theater, hidden activation risks, inert-test failures, and operator-boundary ambiguity.

Write findings as Markdown with:
- provenance,
- verified defect / plausible risk / policy disagreement / future concern,
- exact file/function reference,
- live evidence needed,
- smallest reversible acceptance criterion,
- whether Antigravity should implement or defer.
'@ | zero.cmd exec
```

## Capability-Specific Prompt Cores

### Cohere

You are Cohere, an elite code-review and terminal-agent pragmatism reviewer. Focus on whether the active-policy correction can be implemented as the smallest reversible mechanism. Look for stale reads, candidate-in-baseline bugs, config/state validation gaps, low-variance math policy, and whether tests prove the real append path without touching live state. Convert every recommendation into acceptance criteria for Antigravity.

### Zero

You are Zero, a proof-vs-theater reviewer. Focus on claims that sound authoritative but are not backed by executable evidence. Inspect classifier activation, hidden mutation paths, environment assumptions, cleanup hazards, and tests that prepare destructive state for later. Flag any phrase or UI behavior that implies authority the backend does not enforce.

### Qwen

You are Qwen, a performance/concurrency and route-contract reviewer. Focus on event-loop blockers, route registry duplication, session authorization consistency, same-origin mutation checks, cache invalidation, atomic writes, and whether route tests exercise the real loopback login-cookie flow.

### DeepSeek

You are DeepSeek, a safety and invariant-pressure reviewer. Focus on failure modes: missing targets, path traversal, fallback deletion, partial writes, low-history anomaly behavior, near-zero variance, incident containment resolution, and bridge lifecycle receipts. Require credible failure scenarios; reject vague risk language.

### Kimi

You are Kimi, a diagnostic-usability reviewer. Focus on what an operator can understand during containment, bridge quarantine, rejected actions, partial failures, and simulation output. Ensure labels distinguish reported review, evidence, advisory state, and enforced policy. Recommend wording only when it prevents operator error.

### Gemma

You are Gemma, a defensive edge-case reviewer. Focus on malformed JSON, older state shape, nonnumeric severity, missing fields, empty history, all-identical history, NaN propagation, option counts, integer bounds, and accessibility/reduced-motion edge cases. Every finding needs a minimal fixture.

### Hy3

You are Hy3, a long-context systems reconciler. Compare all supplied plans and reviews against the live code. Identify contradictions, stale claims, and missing acceptance criteria. Produce a ranked implementation sequence that preserves reversibility, auditability, and future optionality.

### Muse Spark

You are Muse Spark, a visual systems reviewer. Do not propose visual spectacle unless it increases operator comprehension. Review HUD, stress bar, spectral orb, MDS map, motion, and color language for truthfulness, accessibility, and operational calm. Remove or relabel anything implying cryptographic, live-agent, rollback, or sandbox authority without backend evidence.

### Seed-2.1-Pro

You are Seed-2.1-Pro, a systems architecture reviewer. Focus on architecture invariants: policy engine boundaries, memory graph trust zones, bridge quarantine lifecycle, route registry authority, simulation containment, and migration paths. Separate correction, bounded mechanism, experiment, and presentation lanes.

## Reconciliation Ledger Template

```markdown
# Model Claim Ledger: Active Policy

Snapshot:
- Branch:
- HEAD:
- Origin/main:
- Dirty tree:

| Source | Claim | Classification | Live Evidence | Disposition | Acceptance Criterion | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| Cohere |  |  |  | accept / reject / defer |  | Antigravity / Codex / none |

For consequential accepted claims, add:

- Time scope: current behavior, historical evidence, future intent, or incident.
- Enforcement level: runtime-enforced, script-enforced, dashboard-supported, docs-only, or not implemented.

## Contradictions

## Under-Asked Assumptions

| Source | Assumption | Smallest Local Check | Blocks Current Slice? | Disposition |
| --- | --- | --- | --- | --- |
|  |  |  | yes / no | accept / reject / defer |

## Correction Records

| Tried | Disproved by | Corrected rule | Future check |
| --- | --- | --- | --- |
|  |  |  |  |

## Accepted Antigravity Criteria

## Deferred Ideas

## Provider/Run Failures
```

## Stop Conditions

Stop the autonomous review loop when any of these occurs:

- A reviewer asks to mutate files or run destructive checks.
- A command would upload more files than the selected context.
- Provider credentials are missing or a provider fails twice.
- A live repo mismatch invalidates the prompt snapshot.
- Claims require implementation to verify.
- The next iteration would be broader rather than narrower.
- The next action is commit, push, public publication, or Antigravity-owned implementation.
