# Repo Guide

A compact map for understanding Dizzy without reading every file first.

## The Shape

Dizzy is a local-first assistant runtime organized around one question:

> What context should carry forward, under which trust boundary, and why?

The repo has three working layers:

1. **Runtime**: code that receives messages, builds prompts, routes tools/models, and enforces boundaries.
2. **Governing core**: docs and prompt-pack files that define behavior, authority, memory, and trust zones.
3. **Workshop**: upgrade notes, review trails, and provenance that explain how the system is evolving.

## Progressive Disclosure Reading Path

Read according to your current depth of investigation:

### 1. New User (First-Run & Orientation)
1. [QUICKSTART.md](QUICKSTART.md) - 5-minute setup, `/health` + `/prompt` walk-through, trust-zone demo, visual accents.
2. [README.md](README.md) - high-level overview, runtime shape, and production checklist.

### 2. Intermediate (Operational Mechanics)
3. [REPO_GUIDE.md](REPO_GUIDE.md) - guided map for readers and maintainers.
4. [OPERATING_LOOP.md](OPERATING_LOOP.md) - day-to-day operator workflow (friction, trajectories, session close).
5. [FILE_ROLES.md](FILE_ROLES.md) - root-file authority and role map.

### 3. Advanced Architect (Doctrine & Governance)
6. [DESIGN.md](DESIGN.md) - canonical human source of truth and decision record.
7. [INTERACTION_NORMS.md](INTERACTION_NORMS.md) - plain-language interaction and governance summary.
8. [PROMPT_CORE.md](PROMPT_CORE.md) - compact live behavioral core.
9. [MECHANISM_SIEVE.md](MECHANISM_SIEVE.md) - converting anti-extractive values into mechanisms.
10. [MECHANISMS.md](MECHANISMS.md) - reusable design mechanisms.
11. [CHOKEPOINTS.md](CHOKEPOINTS.md) - self-inspection map for dependency, capture, and exit risks.
12. [RUNBOOK.md](RUNBOOK.md) - practical operational deployment.

That path is enough to understand the current system. The rest is detail.

## Runtime Map

- [agent_server.mjs](agent_server.mjs): HTTP server, health/prompt/governance endpoints, paid/public execute surface.
- [lib/dispatch.mjs](lib/dispatch.mjs): message handling, trust-zone capability checks, chat/model dispatch, memory commands.
- [lib/prompt_bundle.mjs](lib/prompt_bundle.mjs): prompt-pack source loading and prompt metadata.
- [lib/md_retriever.mjs](lib/md_retriever.mjs): scoped Markdown retrieval with snippet provenance.
- [lib/memory_graph.mjs](lib/memory_graph.mjs): local derived memory graph.
- [lib/model_router.mjs](lib/model_router.mjs): minimal chat/utility routing roles over existing backends.
- [lib/tools.mjs](lib/tools.mjs): explicit tool execution helpers.
- [lib/queue.mjs](lib/queue.mjs) and [worker.mjs](worker.mjs): optional Redis-backed tool-job queue.

## Governing Core

- [DESIGN.md](DESIGN.md): canonical human source of truth.
- [state.json](state.json): derived machine-readable snapshot of `DESIGN.md`.
- [FILE_ROLES.md](FILE_ROLES.md): classifies root files so proximity does not imply authority.
- [MECHANISMS.md](MECHANISMS.md): reusable mechanisms extracted from the system design.
- [OPERATING_LOOP.md](OPERATING_LOOP.md): practical loop for session start, work intake, friction capture, trajectory capture, and session close.
- [PROMPT_PACKS.md](PROMPT_PACKS.md): explains what files enter the live prompt.
- [PROMPT_CORE.md](PROMPT_CORE.md): compact runtime behavioral core.
- [MECHANISM_SIEVE.md](MECHANISM_SIEVE.md): operational worksheet for anti-extractive and commons-friendly proposals.
- [IDENTITY.md](IDENTITY.md), [SOUL.md](identity/personas/SOUL.md), [TOOLS.md](TOOLS.md), [USER.md](identity/personas/USER.md), [PROMPT_CORE.md](PROMPT_CORE.md), [PROMPT_MODES.md](PROMPT_MODES.md): default prompt-pack files.
- [MARKETPLACE_PROTOCOL.md](MARKETPLACE_PROTOCOL.md): paid/public trust-zone overlay.

## Memory And Retrieval

- [MEMORY.md](MEMORY.md): curated long-term memory index; non-governing.
- [memory/topics/](memory/topics/): durable topic notes.
- `runtime/conversations/`: local conversation history; ignored by Git.
- `runtime/auto_memory*`: local auto-memory staging; ignored by Git.
- Retrieved context is support, not authority. Trust zones decide whether retrieval is allowed.

## Workshop And Provenance

- [upgrades/active/](upgrades/active/): current candidates and accepted implementation notes.

Planning notes do not govern runtime behavior until they are deliberately moved into live docs, prompt-pack files, tests, or code.

## Trust Zones

- `private_self`: retained continuity and durable memory allowed.
- `trusted_collaborator`: selective continuity with narrower disclosure.
- `outside_contact`: fresh-context reasoning by default.
- `paid_public`: ephemeral by default; explicit client continuity is conversation-only and keyed by server-derived `client_id + service_id`.

## What To Verify

After changes, run:

```powershell
node .\scripts\safety_checks.mjs
node .\smoke_test.mjs
node .\scripts\sync_state.mjs --check
node .\scripts\memory_validate.mjs
node .\scripts\dependency_api_drift_check.mjs
```

If `DESIGN.md` changed, run:

```powershell
node .\scripts\sync_state.mjs
```

## What Not To Overread

- `upgrades/` is not doctrine.
- `memory/` is not doctrine.
- `runtime/` is local operational residue and is ignored by Git.
- Root presence is not authority; see [FILE_ROLES.md](FILE_ROLES.md).
- Metaphor is allowed, but metaphor is not authority.
- Marketplace/public surfaces are projections of the core, not the core itself.
