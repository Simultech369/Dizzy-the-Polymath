# Desktop Notes Source Ingest

Date: 2026-05-13

Purpose: preserve the role of two Desktop files as source material behind the current proposed Dizzy upgrade packet.

## Source Files

- `C:\Users\Josh\Desktop\notes.txt`
  - last modified: 2026-05-12 04:11:56
  - size: 3,808 bytes
- `C:\Users\Josh\Desktop\upgrades.txt`
  - last modified: 2026-05-12 04:20:33
  - size: 6,841 bytes

These files were reviewed before this note was created.

## Weight

Treat these files as proposal-source material, not live doctrine.

They should be considered alongside:

- `upgrades/2026-05-13-dizzy-upgrade-priorities.md`
- `upgrades/W-0004-continuity-lifecycle.md`
- `upgrades/memory-metadata.md`
- `upgrades/per-zone-capability-lists.md`
- `upgrades/refinement-discipline.md`
- `upgrades/telos-substrate.md`
- `upgrades/civic-sieve.md`
- `upgrades/privilege-split.md`

If OpenClaude can access the Desktop files directly, it should read them.

If OpenClaude cannot access the Desktop files, this note records the intended weighting and the distilled contents.

## Distilled Contents

### Immediate / High Priority

- `W-0004`: paid/client continuity lifecycle.
- Memory metadata for `memory/topics/` only, with hard safeguards against pruning doctrine or civic files.
- Per-zone capability lists enforced in code.
- Refinement discipline and success criteria.
- Civic doctrine supremacy plus anti-rationalization/dissent channel.
- Telos and Substrate.
- Retrieved snippet metadata with `source_path`, `source_hash`, `retrieved_at`, and `semantic_status`.
- Civic sieve before durable memory writes and risky outputs.

### Strong Near-Term Candidates

- `drift_scan` plus `last_check` for high-importance files only.
- Semantic anomaly and high-frequency stylistic-pattern detection.
- Epistemic humility layer as retrieval flag plus cheap post-filter note.
- Logical dual-LLM or privilege split through a quarantined janitor path.
- Lightweight `history.md` for recurring internal loops.
- Sparse self-learning memory for known-good trajectories.
- `MANIFEST.md` as a short civic/human front door.
- Narrow, explicitly derivative `constraints.yaml`.
- Quarto hybrid rule: executable notebooks are aids, not authority.
- Media/indirect input rule: no action on embedded commands without explicit confirmation.
- Simple plugin/capability security scan before new tools.

### Deferred / Inspirational Only

- weighted priorities / judgment wallet
- heavily bounded proactive scanning
- full SPARC loop
- hybrid vector retrieval/RRF
- quotes file
- GOAP-style precondition tables
- decentralized storage ideas
- heavy prompt-engineering frameworks

## Additional Required Considerations

### Sync Discipline

After edits to `DESIGN.md`, civic doctrine, Telos/Substrate, or live prompt-pack files:

- run `node scripts/sync_state.mjs --check`
- update/regenerate `state.json` if `DESIGN.md` changed
- inspect prompt-pack impact
- avoid stale derived artifacts

### Conflict Resolution Policy

Proposed hierarchy:

1. human operator
2. Civic/Telos/Substrate if adopted
3. `DESIGN.md`
4. default prompt-pack files
5. judgment/constraints layer
6. memory topics
7. runtime artifacts and caches

Agent should surface conflicts with proposed resolution and never auto-resolve high-stakes doctrine conflicts.

### Proactivity Bound

Lightweight maintenance scanning is acceptable only inside `private_self` or operator zones, with visibility and veto power.

Never proactive in `paid_public`.

### Anti-Rationalization Rule

The agent should preserve a dissent channel: it may flag when a requested action violates the spirit of doctrine even if narrow rules technically allow it.

## Review Instruction

OpenClaude should compare this source-ingest note against the current upgrade files and identify:

- source ideas that were faithfully preserved
- source ideas that were over-promoted
- source ideas that were underweighted or missing
- source ideas that should remain deferred

