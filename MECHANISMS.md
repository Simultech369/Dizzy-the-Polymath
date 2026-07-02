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
- `upgrades/provenance/friction-ledger.md`

Failure mode: logging friction becomes another chore and does not drive cleanup.

## Trajectory Distillery

Problem: raw memory captures what happened, but not necessarily what worked.

Mechanism: store sparse known-good trajectories with goal, constraints, actions, outcome, reusable pattern, tags, and strength; retrieve them as support for similar future tasks.

Useful files:
- `lib/trajectories.mjs`
- `lib/dispatch.mjs`
- `upgrades/provenance/trajectory-distillery.md`

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

## Capability Receipts

Problem: trust-zone doctrine is easy to claim and hard to verify from outside the code.

Mechanism: attach a machine-readable receipt to dispatch outputs and `/agent/execute` responses showing trust zone, continuity mode, retention scope, memory/repo permissions, retrieved files, retrieval audit details, and blocked context categories.

Useful files:
- `lib/dispatch.mjs`
- `agent_server.mjs`
- `scripts/safety_checks.mjs`
- `CHOKEPOINTS.md`

Failure mode: receipts become decorative unless tests prove forbidden context stays blocked.

## Client Continuity Expiry

Problem: paid/client continuity can become undeletable residue if expiry is only a policy label.

Mechanism: scoped client/service conversation keys can be deleted by the local operator, and expired client continuity entries are pruned before new `/agent/execute` work.

Useful files:
- `lib/client_continuity.mjs`
- `agent_server.mjs`
- `scripts/safety_checks.mjs`
- `MARKETPLACE_PROTOCOL.md`

Failure mode: local deletion is mistaken for a full authenticated client account lifecycle.

## Capture Eligibility Gate

Problem: durable memory and trajectory capture can turn routine chatter, emotional intensity, or low-substance turns into sticky authority.

Mechanism: before writing durable memory, trajectories, or session receipts, classify whether the material has enough substance, provenance, and reuse value. Social closers, routine acknowledgements, thin status messages, and ungrounded observations should skip durable capture.

Useful files:
- `REFERENCE_PATTERNS.md`
- `CONSTITUTION.md`
- `PROMPT_CORE.md`
- `lib/trajectories.mjs`
- future memory write paths

Failure mode: the gate becomes too strict and loses real decisions, or too loose and launders noise into continuity.

## Provenance-Required Memory

Problem: memory extraction can hallucinate user facts, over-trust assistant interpretations, or merge observation with evidence.

Mechanism: split durable memory candidates by class. User claims need evidence from the user's words. Assistant observations need grounding, confidence, and epistemic status. Project decisions need decision source and date. Reusable patterns need success criteria and outcome evidence.

Useful files:
- `REFERENCE_PATTERNS.md`
- `MEMORY.md`
- `scripts/memory_validate.mjs`
- `PROMPT_CORE.md`

Failure mode: provenance fields become decorative unless validation and retrieval expose them.

## Memory Metabolism

Problem: useful continuity decays at different rates, but flat memory makes old, uncertain, and low-value claims look equally alive.

Mechanism: memory-like records carry freshness, confidence, sensitivity, surfaced count, and revocation data. Maintenance can report stale or duplicate claims before any automatic mutation happens. Decay begins as a report, then becomes archival only after the operator trusts the signal.

Useful files:
- `CONSTITUTION.md`
- `REFERENCE_PATTERNS.md`
- `scripts/maintain.mjs`
- `scripts/memory_validate.mjs`

Failure mode: decay becomes a hidden deletion engine instead of a legible demotion and archival process.

## Source-Labeled Retrieval

Problem: retrieved context from memory, sessions, docs, facts, trajectories, and hypotheses can collapse into one undifferentiated authority blob.

Mechanism: every retrieval block and capability receipt should identify source type, trust zone, fallback path, confidence/freshness when available, and whether the item is authority, evidence, or hypothesis.

Useful files:
- `lib/dispatch.mjs`
- `lib/md_retriever.mjs`
- `lib/memory_graph.mjs`
- `lib/trajectories.mjs`
- `REFERENCE_PATTERNS.md`

Failure mode: labels are present but the assistant still treats all retrieved content as equally authoritative.

## Sidecar Boundary

Problem: richer memory services can become tightly coupled to the main runtime, increasing fragility and lock-in.

Mechanism: if Dizzy adopts a semantic memory service, keep it as an optional local sidecar with health checks, graceful degradation, explicit trust-zone permissions, and no required role in basic chat.

Useful files:
- `REFERENCE_PATTERNS.md`
- `RUNBOOK.md`
- `OPERATIONS.md`
- future sidecar docs

Failure mode: sidecar availability becomes a hidden requirement for ordinary work, or vector recall expands beyond consent boundaries.

## Mechanism Rule

Mechanisms are useful only when they reduce burden, clarify judgment, or create capability. If a mechanism mainly adds vocabulary, status, or ceremony, compress it or retire it.

Root presence is not authority. `FILE_ROLES.md` names which files are constitutional, operational, optional, or archival.
