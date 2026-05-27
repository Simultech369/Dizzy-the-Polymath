# Mechanisms

Reusable design mechanisms in Dizzy.

This document maps reusable design mechanisms in Dizzy: the problem each mechanism addresses, how it works, where it appears, and how it can fail.

It is a map, not doctrine. Mechanisms are useful only when they reduce burden, clarify judgment, or create capability.

## Trust Zones

Problem: assistants often treat all context as equally available, which creates privacy bleed and authority confusion.

Mechanism: classify runtime context into zones with different retention, retrieval, and memory-write permissions.

Useful files:
- `DESIGN.md`
- `PROMPT_CORE.md`
- `lib/dispatch.mjs`
- `scripts/safety_checks.mjs`

Failure mode: zones become labels without hard behavior differences.

## Runtime Constitution

Problem: long design docs can claim authority that the live assistant never sees.

Mechanism: keep live governing rules in a compact default prompt pack; let longer docs explain rationale but not silently govern runtime behavior.

Useful files:
- `PROMPT_CORE.md`
- `PROMPT_PACKS.md`
- `FILE_ROLES.md`
- `lib/prompt_bundle.mjs`
- `scripts/prompt_drift_check.mjs`

Failure mode: the prompt pack grows until it becomes another unreadable doctrine pile.

## Mechanism Sieve

Problem: values like anti-extraction, commons, agency, and public good can remain abstract.

Mechanism: require serious proposals to name capability, ownership, funding, governance, enforcement, exit, capture risk, simplification, new dependency, and next experiment.

Useful files:
- `MECHANISM_SIEVE.md`
- `PROMPT_CORE.md`
- `memory/topics/civic-doctrine-kernel.md`

Failure mode: the sieve becomes bureaucratic drag instead of a builder tool.

## Capability-Building Test

Problem: anti-extractive language can become a principled rejection engine instead of a practical builder.

Mechanism: require serious economic or civic proposals to name the dependency or chokepoint weakened, the capability created, who controls the resulting asset or rule, and how the fix avoids becoming a new gate.

Useful files:
- `ECONOMICS.md`
- `PROMPT_CORE.md`
- `MECHANISM_SIEVE.md`
- `memory/topics/civic-doctrine-kernel.md`

Failure mode: "capability" becomes a prestige word unless tied to a concrete experiment or reduced burden.

## Chokepoint Map

Problem: a system can oppose extraction in theory while quietly creating its own dependency points.

Mechanism: name internal chokepoints, current defenses, missing defenses, and exit paths before treating the system as aligned.

Useful files:
- `CHOKEPOINTS.md`
- `ECONOMICS.md`
- `FILE_ROLES.md`
- `scripts/maintain.mjs`

Failure mode: the map becomes reputational proof instead of a trigger for runtime enforcement and pruning.

## Friction Ledger

Problem: repeated operator stuck-points disappear into annoyance instead of becoming design signal.

Mechanism: store sparse friction entries, summarize unresolved friction, and surface the highest-weight categories in maintenance output.

Useful files:
- `lib/friction_ledger.mjs`
- `lib/dispatch.mjs`
- `scripts/maintain.mjs`
- `upgrades/active/friction-ledger.md`

Failure mode: logging friction becomes another chore and does not drive cleanup.

## Trajectory Distillery

Problem: raw memory captures what happened, but not necessarily what worked.

Mechanism: store sparse known-good trajectories with goal, constraints, actions, outcome, reusable pattern, tags, and strength; retrieve them as support for similar future tasks.

Useful files:
- `lib/trajectories.mjs`
- `lib/dispatch.mjs`
- `upgrades/active/trajectory-distillery.md`

Failure mode: trajectories become vague success stories instead of reusable moves.

## Connection Scan

Problem: non-obvious links across memory can stay hidden, but automatic synthesis can create false coherence.

Mechanism: generate report-only connection hypotheses. Do not feed them directly into authority or retrieval decisions.

Useful files:
- `scripts/connection_scan.mjs`
- `lib/memory_graph.mjs`

Failure mode: weak shared signals get mistaken for meaningful synthesis.

## Maintain Command

Problem: many small checks create operator burden and make repo health hard to see.

Mechanism: one command runs safety, smoke, state sync, memory validation, prompt drift, doctrine drift, connection scan, and ledger summaries.

Useful files:
- `scripts/maintain.mjs`
- `package.json`

Failure mode: the command becomes noisy and stops being read.

## Paid/Public Continuity Lifecycle

Problem: client or public surfaces need continuity sometimes, but hidden carryover creates trust and privacy risks.

Mechanism: paid/public defaults to ephemeral; client continuity is explicit, scoped to conversation history, and blocks durable memory plus private retrieval by default.

Useful files:
- `DESIGN.md`
- `MARKETPLACE_PROTOCOL.md`
- `agent_server.mjs`
- `lib/dispatch.mjs`
- `upgrades/active/W-0004-continuity-lifecycle.md`

Failure mode: "continuity" becomes a vague permission to reuse context.

## Mechanism Rule

Mechanisms are useful only when they reduce burden, clarify judgment, or create capability. If a mechanism mainly adds vocabulary, status, or ceremony, compress it or retire it.

Root presence is not authority. `FILE_ROLES.md` names which files are constitutional, operational, optional, or archival.
