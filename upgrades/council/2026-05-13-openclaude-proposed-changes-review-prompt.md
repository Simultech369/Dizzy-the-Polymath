# OpenClaude Review Prompt: Proposed Dizzy Changes

Date: 2026-05-13

Purpose: ask OpenClaude to review the current proposed Dizzy upgrade packet before implementation.

## Review Target

Dizzy repo:

`C:\Users\Josh\clawd`

Review proposed changes, not just current runtime.

## First Read

First establish local state:

- run `git status --short`
- run `git log --oneline -5`
- run `git ls-files --others --exclude-standard upgrades`
- run `Get-ChildItem upgrades | Select-Object Name,Length,LastWriteTime`

Then read these current summary/front-door files:

- `upgrades/README.md`
- `upgrades/2026-05-13-desktop-notes-source-ingest.md`
- `upgrades/2026-05-13-dizzy-upgrade-priorities.md`
- `upgrades/W-0004-continuity-lifecycle.md`
- `upgrades/memory-metadata.md`
- `upgrades/per-zone-capability-lists.md`
- `upgrades/refinement-discipline.md`
- `upgrades/telos-substrate.md`
- `upgrades/civic-sieve.md`
- `upgrades/privilege-split.md`

Then read the prior local recommendation trail, because it contains the last-month context behind the current packet:

- `upgrades/2026-05-06-openclaude-front-door.md`
- `upgrades/2026-05-06-openclaude-review-brief.md`
- `upgrades/2026-05-06-dizzy-improvement-plan-and-openclaude-handoff.md`
- `upgrades/2026-05-06-low-churn-implementation-sequence.md`
- `upgrades/2026-05-06-low-churn-repo-scan.md`
- `upgrades/2026-05-06-idea-fit-additions.md`
- `upgrades/2026-05-06-goblins-for-openclaude-review.md`
- `upgrades/2026-05-06-jepa-second-opinion.md`
- `upgrades/2026-04-21-current-memory-audit.md`
- `upgrades/2026-04-21-current-memory-flow.md`
- `upgrades/2026-04-21-memory-openclaw-recalibration.md`
- `upgrades/2026-04-21-memory-upgrade-roadmap.md`
- `upgrades/2026-04-21-gravity-well-memory-schema.md`
- `upgrades/2026-04-21-repo-wide-fit-map.md`

If any additional untracked `upgrades/*.md` files exist beyond this list, read them too before producing a verdict.

Do not review only this prompt. The review target is the whole local upgrade trail plus the live repo.

Also note: `C:\Users\Josh\Desktop\notes.txt` and `C:\Users\Josh\Desktop\upgrades.txt` are source material behind the May 13 upgrade packet. If accessible, read them directly. If inaccessible, use `upgrades/2026-05-13-desktop-notes-source-ingest.md` as the distilled source record and explicitly state that limitation.

Then inspect current governing/runtime files:

- `README.md`
- `DESIGN.md`
- `PROMPT_CORE.md`
- `SOUL.md`
- `USER.md`
- `GOVERNANCE.md`
- `ECONOMICS.md`
- `MARKETPLACE_PROTOCOL.md`
- `MEMORY.md`
- `memory/topics/civic-doctrine-kernel.md`
- `agent_server.mjs`
- `lib/dispatch.mjs`
- `lib/md_retriever.mjs`
- `lib/memory_graph.mjs`
- `scripts/safety_checks.mjs`

## Task

Review the proposed Dizzy changes as a skeptical second reviewer.

Do not edit files.

Decide which proposals have enough council agreement to implement now, which need revision, and which should remain upgrade notes only.

## Evaluation Criteria

Use these constraints:

- continuity-and-judgment remains the product center
- minimize churn
- preserve the default prompt-pack constitutional structure
- keep practices sparse, prose-first, and curated
- prefer inspectable local-first memory over opaque canonical state
- preserve trust-zone discipline
- preserve model pluralism
- avoid marketplace maturity theater
- avoid turning doctrine into ideology performance
- avoid formal judgment bureaucracy

## Proposals To Review

### Accepted / likely implement now

1. `W-0004`: paid/client continuity lifecycle.
2. per-zone capability lists.
3. refinement discipline and success criteria.
4. retrieved snippet metadata, but only on pulled snippets.
5. memory metadata for `memory/topics/`, with hard protection for civic/doctrine files.
6. civic sieve before durable writes and risky public/paid outputs.

### Strong candidates, but dangerous if over-constitutionalized

7. Telos/Substrate.
8. Civic doctrine supremacy.
9. Anti-rationalization/dissent channel.
10. privilege split / quarantined janitor.

### Candidate / defer unless strongly justified

11. drift scan plus `last_check`.
12. epistemic humility layer.
13. lightweight history tracking.
14. self-learning memory.
15. `MANIFEST.md`.
16. derivative `constraints.yaml`.
17. Quarto hybrid rule.
18. media/indirect input rule.
19. plugin/capability security scan.

### Deferred / inspirational only

20. weighted priorities / judgment wallet.
21. proactive scanning.
22. full SPARC loop.
23. hybrid vector retrieval/RRF.
24. quotes file.
25. GOAP-style precondition tables.
26. decentralized storage ideas.
27. heavy prompt-engineering frameworks.

## Required Output

Produce:

1. Bottom-line verdict: implement now / revise first / defer, with confidence.
2. Which proposals have enough council agreement to implement now.
3. Which proposals are good but should remain upgrade notes.
4. Which proposals should be rejected or aggressively reduced.
5. The correct implementation order.
6. For each implement-now item:
   - exact target files
   - minimal code/doc changes
   - tests/checks required
   - main failure mode
7. For Telos/Substrate and Civic Doctrine Supremacy:
   - whether they should enter live doctrine now
   - if yes, where and in what compressed form
   - if no, what evidence would justify later adoption
8. Any contradiction with current Dizzy doctrine or runtime.
9. Final council list:
   - `IMPLEMENT`
   - `REVISE`
   - `DEFER`
   - `REJECT`

## Special Attention

The main risk is over-constitutionalization.

Do not approve proposals just because they sound coherent.

Ask whether each proposal:

- improves actual continuity and judgment
- reduces boundary risk
- improves future maintainability
- can be enforced or observed
- avoids increasing operator burden unnecessarily

## Rule

Do not recommend implementation unless the proposal is:

- low-churn
- clear enough to implement
- aligned with trust-zone discipline
- not already adequately covered by existing docs/code
