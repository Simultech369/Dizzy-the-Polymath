# Dizzy Upgrade Priorities

Date: 2026-05-13

Purpose: consolidate the latest OpenClaude review, Grok note, and operator additions into a prioritized upgrade list without prematurely merging everything into core doctrine.

## Baseline From OpenClaude Review

OpenClaude agreed that the repo is already a real continuity-and-judgment system, not a vibe document.

The main correction was sequencing:

1. paid/client continuity lifecycle
2. memory authority and freshness
3. utility-model janitorial paths
4. humble marketplace status fields
5. civic doctrine elaboration without removing live prompt rules
6. capability filtering later

## Immediate / High Priority

### 1. W-0004: Paid/Client Continuity Lifecycle

Accepted. Implement next.

Core requirement: define retention, defaults, expiry, deletion, status reporting, and response surface fields for `paid_public` with `continuity_mode=client`.

### 2. Memory Metadata

Accepted, but only for `memory/topics/`.

Keep safeguards hard:

- doctrine and civic files are protected
- `stability: 10` requires explicit operator action
- pruning is logged and operator-visible

### 3. Per-Zone Capability Lists

Accepted.

Trust zones should map to code-enforced capability surfaces.

### 4. Refinement Discipline

Accepted.

Use compact success criteria, one targeted question maximum, and the one-minute fallback rule.

### 5. Civic Doctrine Supremacy And Anti-Rationalization

Strong candidate for constitutional adoption after review.

Do not let queryable judgment rules or local task success rationalize away civic doctrine.

### 6. Telos And Substrate

Strong candidate.

Needs compression and OpenClaude review before entering the live constitutional layer.

### 7. Retrieved Snippet Metadata

Accepted in narrow form.

Attach metadata only to snippets pulled into context:

- `source_path`
- `source_hash`
- `retrieved_at`
- `semantic_status`

Do not pollute every memory file.

### 8. Civic Sieve

Accepted in minimal form.

Use before durable writes and risky public/paid outputs.

## Strong Near-Term Candidates

- `drift_scan` plus `last_check` for high-importance files only
- semantic anomaly and high-frequency stylistic-pattern detection
- epistemic humility layer as retrieval flag plus cheap post-filter note
- logical privilege split with quarantined janitor path
- lightweight `history.md` for recurring internal loops
- self-learning memory for sparse known-good trajectories
- `MANIFEST.md` as short root civic/human front door
- narrow, explicitly derivative `constraints.yaml`
- Quarto hybrid rule for docs or published material, with plain Markdown as authority
- media/indirect input rule
- plugin/capability security scan before new tools

## Deferred / Inspirational Only

- weighted priorities or judgment wallet
- proactive scanning beyond tightly bounded private/operator zones
- full SPARC loop
- hybrid vector retrieval/RRF
- quotes file for civic reinforcement
- formal GOAP-style precondition tables
- decentralized storage ideas
- heavy prompt-engineering frameworks

## Sync Discipline

Critical missing rule:

After any edit to `DESIGN.md`, civic doctrine, Telos/Substrate, or live prompt-pack files:

1. run `node scripts/sync_state.mjs --check`
2. if `DESIGN.md` changed, update/regenerate `state.json`
3. inspect prompt-pack impact through `/prompt` or `getPromptSources`
4. avoid stale derived artifacts

## Conflict Resolution Policy

Proposed hierarchy:

1. human operator
2. Civic/Telos/Substrate, if adopted
3. `DESIGN.md`
4. default prompt-pack files
5. derivative judgment/constraints files
6. memory topics
7. runtime artifacts and caches

Agent behavior:

- surface conflicts
- propose a resolution
- never auto-resolve high-stakes doctrine conflicts

## Proactivity Bound

Lightweight maintenance scanning is acceptable only inside `private_self` or operator zones, with visibility and veto power.

Never proactive in `paid_public`.

## OpenClaude Follow-Up

OpenClaude should review which of these should become:

- live constitutional doctrine
- `DESIGN.md` decisions
- implementation work items
- upgrade notes only
- deferred/inspirational material

