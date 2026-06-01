# DESIGN.md
Primary: human-readable decisions + rationale.

This file is the canonical source of truth.

Derived artifacts:
- `state.json` (machine-readable; generated/hand-synced from this doc)
- `NEXT.md` (open decision queue; items move here -> resolved in this doc)

---

## 0) System Summary (1 paragraph)

Dizzy is a bounded continuity-and-judgment system: a local-first assistant that helps a human preserve orientation, apply judgment under uncertainty, and carry forward only the context that improves present agency. The product center is not companionship, not a generic chatbot, and not a marketplace persona; it is disciplined continuity across time, risk, and trust zones. Memory exists to support discernment rather than intimacy theater, public or paid work is a constrained projection of the same core rather than a separate self, and civic doctrine functions as political-economic direction, not a claim of conditions already achieved.

Dizzy preserves only context that helps a person or project act more freely, judge more clearly, and avoid domination by dependency, capture, or false coherence. That positive kernel should stay compact: if a distinction does not improve behavior, boundaries, or accountability, it belongs in a planning note rather than the live core.

---

## 0.1) Product Kernel

Dizzy's value is disciplined continuity of judgment: it helps the operator retain the context that improves agency, discard context that becomes sludge, and keep action aligned with explicit trust boundaries. This is an experimental system, so the kernel is not a promise of routine pass/fail success. It is an orientation test: live features should make judgment clearer, repeated friction lower, or boundaries more legible.

- Day 1: Dizzy should answer from the active trust zone, expose relevant boundaries when they matter, and avoid importing hidden continuity into fresh-context situations.
- Week 2: Dizzy should preserve durable decisions, constraints, and reusable patterns without turning raw conversation residue into doctrine.
- Month 3: Dizzy should reduce repeated operator context-switching by surfacing known-good patterns, stale-status warnings, and maintenance needs before they become mental drag.

Acceptance checks:
- A new maintainer can explain the system without relying on personality language or political doctrine.
- `private_self`, `trusted_collaborator`, `outside_contact`, and `paid_public` produce visibly different retention and retrieval behavior.
- Maintenance reports identify stale docs, drift risks, and memory/retrieval health without requiring a full repo reread.

Positive institutional primitives:
- Access floor: basic participation conditions cannot be hostage to chokepoints.
- Portability: exit must include the ability to carry useful history, artifacts, and identity-adjacent records when safe.
- Contestability: rules, refusals, and enforcement need reasons, appeal paths, and auditability.
- Anti-chokepoint ownership: shared dependencies need governance that prevents gatekeeping rents.
- Surplus circulation: value created by a shared system should not pool only at control points.
- Anti-metric capture: commercial or engagement metrics may inform operations but cannot redefine private continuity quality.
- Freedom from compulsory optimization: capability infrastructure should widen agency without forcing performance norms or managed subject formation.

---

## 1) Canonical State Contract

Canonical hierarchy:
1. `DESIGN.md` (primary)
2. `CONSTITUTION.md` (compact non-negotiables; conflict with `DESIGN.md` is a red maintenance item)
3. `state.json` (derived snapshot for agents/tools)
4. Logs/artifacts (event stream; debugging only)

Rules:
- Any behavioral change must be justified here.
- `state.json` must be regenerable from this file.
- If `state.json` and this doc disagree, this doc wins.

---

## 2) Decisions (Resolved)

### D-0001: Canonical docs + state triad

Decision:
- Use `DESIGN.md` as primary, `state.json` as derived, `NEXT.md` as open queue.

Rationale:
- Human clarity + machine determinism.

Consequences:
- Agents/tools read `state.json`; humans edit `DESIGN.md`; unresolved items live in `NEXT.md`.

---

### D-0002: Benkler anchor - Non-extractive, commons-friendly architecture (local-first by default)

Decision:
- Treat user artifacts as user-owned, local-first, and portable.
- Optimize for low-transaction-cost collaboration: modular docs, clear boundaries, and easy export when consented.

Rationale:
- Commons-based systems compound when contribution is cheap, legible, and non-extractive.
- Local-first defaults reduce coercive dependence and keep exit costs low.

Consequences:
- Default: no external publishing; explicit consent required to share.
- Docs are structured so parts can be safely shared (redaction-friendly sections, minimal coupling).

---

### D-0003: Waldron anchor - Rule-of-law legibility (reasons, consistency, and contestability)

Decision:
- Every refusal, constraint, and job failure must be legible: reason codes + concrete next steps.
- Enforcement should be consistent and reviewable: stable rules, written rationale, and a path to contest.

Rationale:
- People can only exercise agency when rules are public, stable, and explainable.
- "Because the model said so" is not an acceptable governance primitive.

Consequences:
- Notifications/errors include: what happened, why (reason code), what to do next.
- If derived state conflicts with `DESIGN.md`, `DESIGN.md` wins (explicitly documented).

---

### D-0004: Legible governance (operational confidentiality + structural transparency)

Definitions:
- Operational confidentiality: keep the exact system instructions, internal heuristics, and abuse-prevention details private when disclosure would enable evasion, prompt injection, or degrade safety/robustness.
- Structural transparency: the user is explicitly informed that governance exists (system prompts / policies), what it is for in general terms, what interaction norms apply, and how to inspect the norms they are subject to.

Decision:
- Publish a plain-language governance summary (`GOVERNANCE.md`) that describes what rules exist, why they exist, and what the user can expect.
- Keep internal system text private where needed, but always expose: categories of rules, escalation/consent boundaries, logging/retention posture, and contestability path.

Rationale:
- Governance that is hidden or inscrutable is power without due process.
- A system can be operationally confidential and still structurally transparent.

Consequences:
- `GOVERNANCE.md` must be kept up to date whenever behavior changes.
- Derived artifacts (`state.json`, notifications) must carry reason codes and user-legible next steps.

---

### D-0005: Queue state machine is explicit and legible

Decision:
- Use a simple, auditable job lifecycle: `queued -> running -> succeeded | retry_scheduled | dead`.
- Preserve an event trail via DLQ JSONL + Redis fields; provide a per-channel notification on terminal failure.

Rationale:
- Reliability failures are governance failures if they are silent or ambiguous.
- A state machine that can't be explained can't be trusted.

Consequences:
- `attempts` counts total executions; `retry_count` counts scheduled retries.
- Default policy: `max_retries=3`, backoff `1s/4s/16s`.
- Only `effect=READ` jobs auto-retry; non-READ jobs dead-letter on failure (to minimize harm).

---

### D-0006: Runtime exposure defaults minimize harm

Decision:
- Bind the local runtime to loopback by default (`127.0.0.1`).
- Support optional bearer auth via `DIZZY_AUTH_TOKEN` for cases where the runtime is exposed beyond loopback.

Rationale:
- Avoid accidental LAN exposure and drive-by access.
- When exposure is intentional (Tailscale, remote dev), auth should exist without making local dev painful.

Consequences:
- Default configuration is safe with "no auth" because it is local-only.
- Setting `DIZZY_AUTH_TOKEN` enforces auth on endpoints. `/health` is unauthenticated only when bound to loopback.

---

### D-0007: Runtime-governing doctrine must live in the default prompt pack

Decision:
- Treat the default prompt pack as the live constitutional core for chat behavior.
- Any principle important enough to govern runtime behavior must exist in compact form in the default pack files:
  - `IDENTITY.md`
  - `CONSTITUTION.md`
  - `SOUL.md`
  - `HEARTBEAT.md`
  - `TOOLS.md`
  - `USER.md`
  - `PROMPT_CORE.md`
  - `PROMPT_MODES.md`
- Longer docs may elaborate, justify, or operationalize those principles, but should not pretend to be independently constitutional if the compact rule is absent from the default pack.

Rationale:
- Repo coherence requires the live agent and the written doctrine to share the same governing center.
- When important rules live only in supplementary docs, the repository becomes more coherent on paper than the runtime is in practice.
- Compression is a governance test: if a principle cannot fit into the live core, it is probably not ready to govern behavior.

Consequences:
- `DESIGN.md` remains the human canonical source of truth for decisions and rationale.
- The default prompt pack remains the live runtime constitution.
- `GOVERNANCE.md` and `PROMPT_PACKS.md` should describe this split plainly so the repo does not overclaim.
- Supplemental docs should be treated as explanatory annexes unless their governing content is compressed into the default pack.

---

### D-0010: Default chat style is lite, affect-attuned, and carrot-forward

Decision:
- Default delivery style should use lite compression, bounded affective attunement, and positive reinforcement.
- Runtime style modifiers are surfaced through env vars:
  - `DIZZY_BREVITY_MODE=normal|lite|full|ultra`
  - `DIZZY_AFFECT_MODE=off|attuned`
  - `DIZZY_REINFORCEMENT_MODE=neutral|gold_star`

Rationale:
- The repository benefits from lower token drag without adopting parody voice.
- Emotional cues can improve pacing and directiveness if treated as coordination data rather than pseudo-empathy.
- Positive reinforcement creates momentum with less coercive tone than punitive "whip" framing.

Consequences:
- The default pack must carry compact instructions for compression, affect, and reinforcement behavior.
- `/prompt` output and prompt headers expose these mode values for legibility.
- Stronger compression modes remain opt-in or situational, not the universal default.

---

### D-0011: Trust zones govern continuity, retrieval, and retention

Decision:
- Treat trust zones as runtime policy boundaries, not tone hints.
- `private_self` and `trusted_collaborator` may use selective durable continuity.
- `paid_public` defaults to ephemeral chat history and fresh-context reasoning unless continuity is explicitly enabled for that client/task.
- `outside_contact` defaults to minimal continuity and no durable memory writes.

Rationale:
- Boundary integrity is part of the product, not an implementation detail.
- Ambient carryover across trust zones quietly recreates domination risks the repo is trying to resist.

Consequences:
- Paid/public continuity must be explicit, scoped, and client-specific rather than ambient.
- Retention policy should be disclosed plainly enough that an operator can explain what persists and why.
- Memory writes, retrieval, and history reuse should fail closed when the trust zone does not allow them.

---

### D-0012: Retrieval is scoped to trusted doctrine and memory surfaces by default

Decision:
- Automatic markdown retrieval is limited by default to trusted top-level doctrine docs plus `memory/`.
- Imported repositories, external vendor mirrors, and miscellaneous markdown do not enter the auto-retrieval path unless explicitly allowlisted.
- Retrieved markdown is supporting context, not authority; governance files and the active request still outrank it.

Rationale:
- Repo-wide retrieval creates prompt-injection and authority-confusion risk.
- The assistant should not treat every local markdown file as if it belongs to the continuity system.

Consequences:
- Retrieval defaults should prefer containment over maximum recall.
- Expansion of retrieval scope should be deliberate and reviewable.
- Formal doctrine about untrusted external content should map to actual retrieval boundaries.

---

### D-0013: Marketplace posture is operator-mediated, informal, and subordinate to the private core

Decision:
- Treat marketplace/public endpoints as informational, operator-mediated surfaces unless and until intake, isolation, pricing, QC, and delivery become reliable enough to form a real contract.
- Favor informal, bounded delivery over a prestige-coded storefront posture.
- Commercial operation may generate revenue, but it must not quietly rewrite retention, retrieval, or governance defaults.

Rationale:
- Overclaiming production readiness is a trust failure.
- Markets are useful but potentially dangerous; the right response is bounded participation with clear containment, not denial or cosplay.

Consequences:
- Marketplace docs and endpoints should describe current reality without implying full automation or institutional maturity.
- Client-safe operational reality means explicit continuity, scoped retention, and no hidden borrowing from private memory.
- Economic tracking can remain dormant until the system is actually being used that way.

---

### D-0014: Public writing, when used, should be evidentiary rather than identity-performative

Decision:
- Public writing is allowed, but it should be grounded in artifacts, decisions, observations, mechanisms, or concrete arguments rather than self-mythology.
- Public writing should not become a back door for leaking private continuity, operator calibration, or internal doctrine that belongs in the core.
- A lightweight operating surface is preferable to a grand public ontology.

Rationale:
- Public writing can clarify work, attract collaboration, and improve legibility.
- The same channel can also distort the system by rewarding persona inflation, metaphysical overclaim, or public theater.

Consequences:
- If Dizzy writes publicly, default to artifact-bearing writing over self-descriptive spectacle.
- Trust-zone boundaries still apply; public writing is a projection, not a constitutional center.
- A minimal operating-surface doc is appropriate; it should remain descriptive, current, and easy to prune.

---

### D-0015: Paid/client continuity is conversation-only unless a stronger lifecycle exists

Decision:
- `paid_public` remains ephemeral by default.
- `continuity_mode=client` means scoped conversation history only.
- Client continuity does not enable durable memory writes, repo/private retrieval, private memory access, or cross-client carryover.
- Client continuity requires both `client_id` and `service_id`; `/agent/execute` derives the continuity key from those fields and does not honor caller-provided conversation keys.
- The runtime should expose continuity status plainly enough that the operator can see what is retained and why.

Rationale:
- The runtime already supports `continuity_mode=client`; without lifecycle semantics, that switch can be misread as broader client memory.
- Paid/public continuity is useful only if it stays scoped, legible, and easy to revoke.
- Commercial surfaces must not import private-assistant continuity by implication.

Consequences:
- `/agent/execute` should report `continuity_mode`, `retention_scope`, `expiry_policy`, `repo_retrieval_allowed`, `durable_memory_allowed`, and a safe conversation reference when applicable.
- Default retention scope is `ephemeral`.
- Ephemeral paid/public requests should not create persistent execution-history entries.
- Client continuity retention scope is `conversation_only`.
- Default client continuity expiry policy is `7_days_inactivity_operator_deletable` until a stronger authenticated client lifecycle exists.
- Local operator deletion and inactivity expiry are implemented for scoped paid/client continuity history. This is not yet a full authenticated client account lifecycle.

---

### D-0016: Constitutional kernel is compact; overlays stay operational

Decision:
- Add `CONSTITUTION.md` as the compact non-negotiable kernel for ontology, consent, trust zones, memory rights, private/commercial separation, anti-domination, and promotion discipline.
- Keep style rules, provider quirks, image layout recipes, scheduler details, model routing, and delivery templates out of constitutional scope unless they express one of those boundaries.
- Treat conflict between `CONSTITUTION.md`, `DESIGN.md`, prompt packs, runtime receipts, or tests as a maintenance failure, not as an invitation to pick the convenient source.

Rationale:
- Distributed doctrine creates hidden authority and succession risk.
- A short kernel makes drift easier to detect without turning every operating habit into law.
- Constitutional prose should be enforceable or promotable, not merely evocative.

Consequences:
- `FILE_ROLES.md` must classify constitutional, operational, optional, and artifact files.
- Prompt-pack drift checks should verify that live behavior retains the compact kernel.
- Longer docs may elaborate but should not create new live obligations until promoted.

---

### D-0017: Memory has lifecycle metadata, not ambient authority

Decision:
- Durable memory claims should be classed by source, scope, confidence, freshness, sensitivity, and revocation path.
- Summaries and compressions are lossy claims; they must not smuggle untrusted instructions, stale assumptions, or raw emotional detail into canonical memory.
- Private reflection may distill reusable patterns, but raw emotional narrative should not be carried across unrelated contexts.

Rationale:
- Continuity is useful only when it improves present judgment.
- Stale or overconfident memory can become a sticky narrative that competes with reality.
- Consent and scope matter more as memory becomes more useful.

Consequences:
- Memory validation should evolve toward checking metadata presence and stale claims.
- Retrieval should expose confidence/freshness when available.
- Revocation, expiry, and revalidation should ship before richer self-learning or advanced distillation.

---

### D-0018: Doctrine-to-runtime promotion queue governs execution work

Decision:
- Classify doctrine-to-runtime work into three tiers:
  - Tier 1: core safety and continuity, including memory expiry, boundary crossing, receipts, revocation, and private/commercial separation.
  - Tier 2: operator value, including maintain loop quality, drift scans, history UX, and prompt/design sync.
  - Tier 3: intelligence edge, including connection detection, trajectory scoring, compression, and adaptive routing.
- Tier 1 work outranks Tier 3 novelty when both are unresolved.

Rationale:
- The repo is stronger doctrinally than operationally; promotion order prevents elegant concepts from outrunning enforcement.
- Advanced learning features are valuable only after boundary and memory discipline are reliable.

Consequences:
- `NEXT.md` should keep active queue items tied to these tiers.
- `scripts/maintain.mjs` should remain the single operator surface for surfacing promotion debt.
- New doctrine should either be promoted into prompt/code/tests/maintenance or remain explicitly non-governing.

---

### D-0019: External memory-system patterns are reference material, not authority

Decision:
- Use `BORROWED_PATTERNS.md` to track patterns from external repositories such as Memory OS, Project Samantha, and Icarus.
- Borrow mechanisms that strengthen Dizzy's existing kernel: memory metadata, provenance, capture eligibility, source-labeled retrieval, dedup/decay reporting, sidecar isolation, and graceful degradation.
- Reject or quarantine patterns that import companion ontology, attachment dynamics, mandatory recall rituals, autonomous emotional outreach, or heavy infrastructure without a proven local need.
- External repositories under `_external/` remain denied for automatic retrieval by default.

Rationale:
- External systems can contain strong implementation patterns while carrying incompatible assumptions.
- Dizzy needs memory metabolism and provenance more than it needs a new identity model or vector stack.
- Borrowing should reduce burden and boundary risk, not create another authority layer.

Consequences:
- `BORROWED_PATTERNS.md` is a mechanism map, not governance.
- Useful external patterns must be translated into Dizzy terms before becoming queue items.
- Runtime adoption still requires promotion through prompt packs, code, tests, or maintenance checks.

---

### D-0020: Capture eligibility gates durable memory and trajectory writes

Decision:
- Add a shared capture eligibility gate for memory-like writes.
- Skip durable capture when the latest user turn is a social closer, when the candidate is empty, or when the candidate is too low-substance to justify persistence.
- Apply the gate to automatic memory staging, trajectory distillation, and trajectory append.

Rationale:
- Durable continuity should preserve decisions, constraints, reusable patterns, and meaningful shifts, not routine acknowledgements.
- The safest next memory improvement is deciding what should not be stored.
- A shared gate prevents each capture surface from inventing its own noise threshold.

Consequences:
- `/trajectory add` rejects trivial payloads even when they satisfy the old structural schema.
- `/trajectory distill` can skip before spending model work on thin history.
- Auto-remember will not stage a memory candidate just because prior context was rich if the latest user turn is a social closer.

---

### D-0021: Captured memory-like records need provenance classes and source-labeled receipts

Decision:
- Add a first provenance layer for memory-like records.
- Use four durable memory classes as the target schema: `user_claim`, `assistant_observation`, `project_decision`, and `reusable_pattern`.
- Enforce `reusable_pattern` provenance on trajectory rows first, because trajectories are already operator-reviewed durable records.
- Add retrieval source labels and fallback-path metadata to capability receipts.

Rationale:
- Memory class names prevent decisions, observations, user claims, and reusable tactics from collapsing into one authority type.
- Provenance should begin at the write boundary, before richer retrieval or decay logic exists.
- Receipts should explain not only what was retrieved, but which subsystem produced it and how retrieval would degrade.

Consequences:
- Trajectory rows now include `memory_class=reusable_pattern` and a `provenance` object.
- Invalid reusable-pattern provenance fails before a trajectory is written.
- Capability receipts include `retrieval_audit.sources` and `retrieval_audit.fallback_path`.
- Future memory classes can reuse `lib/provenance.mjs` instead of inventing their own schema.

---

### D-0022: Memory metabolism starts as report-only maintenance

Decision:
- Add a non-mutating memory metabolism report to `maintain`.
- Scan the trajectory ledger for malformed rows, invalid/missing provenance, duplicate reusable-pattern candidates, and high-strength/low-confidence contradictions.
- Do not archive, delete, merge, or rewrite durable records automatically.

Rationale:
- Decay and dedup are useful only after the signal is trusted.
- Report mode gives the operator visibility without creating a hidden deletion engine.
- Trajectories are the first safe surface because they are structured, local, and operator-reviewed.

Consequences:
- `scripts/maintain.mjs` now includes a Memory metabolism section.
- Findings turn maintenance yellow and point to review, not mutation.
- Future metabolism can expand to memory topics, daily logs, and conversation summaries after provenance coverage improves.

---

### D-0023: Memory-like surfaces need writer ownership

Decision:
- Add `MEMORY_OWNERSHIP.md` as the operational owner map for durable memory-like files and ledgers.
- Treat new durable memory writers as incomplete until their target surface is classified.
- Have `maintain` report whether the ownership map exists and includes the currently known durable surfaces.

Rationale:
- Memory corruption often comes from multiple writers treating the same file as theirs.
- Ownership is cheaper than recovery after silent overwrite or schema drift.
- A visible map keeps runtime ledgers, curated memory, proposal files, and daily logs from blending into one vague memory layer.

Consequences:
- `MEMORY_OWNERSHIP.md` is required for green maintenance.
- The current check validates coverage of known surfaces, not exhaustive path discovery.
- Future memory writers should update this map before writing durable state.

---

### D-0024: Maintain output should act as an operator brief

Decision:
- Extend `scripts/maintain.mjs` with a short operator brief: latest commit, open work count, Tier 1 count, next queue item, and visible promotion debt.
- Keep the detailed checks below the brief.
- Keep the brief local and diagnostic; it should not mutate state or invent work.

Rationale:
- Maintenance should reduce operator burden, not just run checks.
- A brief makes the next move visible without rereading `NEXT.md`, git history, and the ledgers.
- This is the low-friction version of the fabric-style brief pattern.

Consequences:
- `maintain` output starts with the status and operator brief.
- Memory metabolism findings can become visible promotion debt.
- Later brief fields can include recent work, stale upgrades, and top friction when those signals exist.

---

### D-0025: Optional overlays live outside the root

Decision:
- Move optional flavor and strategy overlay files out of the repo root.
- Use `flavor/` for voice, meme, and character surfaces.
- Use `overlays/` for optional strategy/economic orientation.
- Keep them available to optional prompt packs by updating prompt-pack paths.
- Keep `FILE_ROLES.md` as the explicit authority map for these non-governing surfaces.

Rationale:
- Root proximity was making optional voice and economic overlays look more authoritative than intended.
- Moving them resolves the aesthetic/doctrinal tension without deleting useful material.
- Optional prompt packs can still opt into the material deliberately.

Consequences:
- `flavor/PENGUIN.md`, `flavor/TROLL.md`, `flavor/COPPER-INU.md`, and `flavor/COSMIC-CORRESPONDENT.md` are optional flavor surfaces.
- `overlays/LEVERAGE.md` is an optional strategy overlay.
- Default prompt-pack behavior remains governed by the compact runtime constitution.
- References to these files must use the correct `flavor/` or `overlays/` namespace.

---

### D-0026: Upgrade notes require status metadata

Decision:
- Every `upgrades/active/*.md` note must declare frontmatter with `id`, `status`, `tier`, `owner_surface`, `last_reviewed`, and `next_action`.
- Allowed statuses are `active`, `integrated`, `parked`, and `archived`.
- `scripts/maintain.mjs` should summarize status counts and flag missing metadata, stale active reviews, invalid statuses, and non-actionable next actions.

Rationale:
- The upgrade lane was useful but beginning to blur shipped work, live candidates, and parked ideas.
- Status metadata makes planning fog visible without requiring a full reread.
- Keeping integrated notes in place as provenance is acceptable only when their live owner surface is named.

Consequences:
- `upgrades/README.md` acts as a status board, not just a directory map.
- Completed work can remain in `active/` temporarily when its status is `integrated` and the implementation owner is explicit.
- Future cleanup can move integrated or parked notes to archive folders without losing traceability.

---

## 3) Interfaces

### 3.1 Messaging / Surfaces

- Channels supported:
  - Telegram (primary): `scripts/telegram_relay.mjs` for inbound + replies; `scripts/telegram_notify_drain.mjs` for `/notify/:channel` delivery.
- Notification behavior:
  - Terminal failures: queue emits `kind=job_dead` -> `/notify/:channel` -> Telegram notify drain.
  - Tool results: optional polling via `TELEGRAM_POLL_JOB_RESULTS=1` in the relay.

### 3.2 Queue / Jobs

- Job states:
  - `queued -> running -> succeeded | retry_scheduled | dead`
- Retry policy:
  - only `effect=READ` jobs auto-retry
  - default retry/backoff is `1s / 4s / 16s`
  - retry behavior must remain legible in job records and notifications
- Dead-letter policy:
  - terminal failures are recorded in `runtime/dlq/*.jsonl`
  - notifications are per-channel and informational, not silent

### 3.3 Trust-Zone Runtime Matrix

- `private_self`
  - chat history: retained
  - durable memory writes: allowed
  - auto-retrieval: trusted doctrine + memory surfaces
  - disclosure posture: fullest continuity, strongest anti-dependency guardrails
- `trusted_collaborator`
  - chat history: retained when explicitly part of the collaboration surface
  - durable memory writes: allowed, but sensitive carryover should be explicit
  - auto-retrieval: trusted doctrine + memory surfaces
  - disclosure posture: narrower than private self
- `outside_contact`
  - chat history: minimal/local operational residue only
  - durable memory writes: disabled by default
  - auto-retrieval: disabled by default
  - disclosure posture: fresh-context reasoning first
- `paid_public`
  - chat history: ephemeral by default; continuity only when explicitly enabled per client/task
  - client continuity: scoped conversation history only, keyed by server-derived `client_id` + `service_id`
  - durable memory writes: disabled
  - auto-retrieval: disabled
  - expiry policy: `7_days_inactivity_operator_deletable` until stronger lifecycle exists
  - disclosure posture: no hidden private carryover, no cross-client residue

### 3.4 Retrieval Surfaces

- Trusted by default for automatic markdown retrieval:
  - core doctrine and governance docs in the repo root
  - `MEMORY.md`
  - `memory/`
- Not trusted by default for automatic retrieval:
  - `_external/`
  - `_ext/`
  - imported/reference repositories
  - arbitrary markdown outside the allowlist
- Expansion path:
  - explicit allowlisting via runtime config, followed by review if the new scope affects judgment or safety

---

## 4) Failure Modes & Safety

- Network / external actions:
  - default to loopback bind; non-loopback requires auth
  - external HTTP tools remain explicit and constrained
  - retrieved external content is treated as data, not authority
- Irreversible actions:
  - remote mutations and self-modification are privileged local operator features, disabled by default
  - confirmation requirements should attach to the destructive edge, not to routine stylistic output
- Data retention:
  - retention is intentional, local-first, and trust-zone dependent rather than ambient
  - private/self and some trusted collaboration surfaces may retain chat history and memory because continuity is part of the product
  - paid/public mode defaults to ephemeral chat unless continuity is explicitly enabled for that client/task
  - durable memory is curated; conversation residue should not silently become constitutional truth
- Known fragility to watch:
  - doctrine can outrun enforcement if new docs or surfaces are added faster than runtime boundaries
  - retrieval scope can quietly widen if convenience is allowed to trump trust-zone containment
  - commercial surfaces can distort the core if pricing, service menus, or delivery language outrun actual operational reality

---

## 5) Machine-Readable Snapshot (source for `state.json`)

Edit this block when you want to change what agents read.

<!-- STATE_JSON:BEGIN -->
```json
{
  "schema_version": 1,
  "updated_at": "",
  "canonical_source": "DESIGN.md",
  "docs": {
    "primary": "DESIGN.md",
    "constitutional_kernel": "CONSTITUTION.md",
    "derived_state": "state.json",
    "open_queue": "NEXT.md"
  },
  "governance": {
    "anchors": ["Benkler", "Waldron"],
    "runtime_constitution": {
      "default_prompt_pack_files": [
        "IDENTITY.md",
        "CONSTITUTION.md",
        "SOUL.md",
        "HEARTBEAT.md",
        "TOOLS.md",
        "USER.md",
        "PROMPT_CORE.md",
        "PROMPT_MODES.md"
      ],
      "rule": "Principles that govern live runtime behavior must exist in compact form in the default prompt pack. Longer docs may elaborate but should not claim independent constitutional force if absent from the default pack."
    },
    "transparency": {
      "structural_transparency": true,
      "operational_confidentiality": true,
      "public_docs": ["GOVERNANCE.md"],
      "internal_docs": ["SOUL.md", "PROTOCOL.md", "HEARTBEAT.md", "TOOLS.md"]
    },
    "principles": {
      "benkler": ["local_first", "portability", "non_extractive_defaults", "modular_artifacts"],
      "waldron": ["reason_codes", "stable_rules", "contestability", "legible_enforcement"]
    }
  },
  "product_kernel": {
    "value": "Disciplined continuity of judgment: preserve context that improves agency, discard context that becomes sludge, and keep action aligned with explicit trust boundaries.",
    "positive_primitives": [
      "access_floor",
      "portability",
      "contestability",
      "anti_chokepoint_ownership",
      "surplus_circulation",
      "anti_metric_capture",
      "freedom_from_compulsory_optimization"
    ],
    "day_1": "Answer from the active trust zone, expose relevant boundaries when they matter, and avoid importing hidden continuity into fresh-context situations.",
    "week_2": "Preserve durable decisions, constraints, and reusable patterns without turning raw conversation residue into doctrine.",
    "month_3": "Reduce repeated operator context-switching by surfacing known-good patterns, stale-status warnings, and maintenance needs before they become mental drag.",
    "acceptance_checks": [
      "A new maintainer can explain the system without relying on personality language or political doctrine.",
      "Trust zones produce visibly different retention and retrieval behavior.",
      "Maintenance reports identify stale docs, drift risks, and memory/retrieval health without requiring a full repo reread."
    ]
  },
  "constitutional_kernel": {
    "file": "CONSTITUTION.md",
    "non_negotiables": [
      "bounded_ontology",
      "operator_execution_authority",
      "trust_zones_fail_closed",
      "private_continuity_non_commercial",
      "no_commercial_override",
      "curated_revocable_memory",
      "lossy_compression_warning",
      "approval_for_boundary_actions",
      "anti_extraction_as_mechanisms",
      "freedom_from_compulsory_optimization",
      "redacted_public_projection",
      "drift_mismatch_surfaces_as_maintenance"
    ],
    "authority_note": "If CONSTITUTION.md and DESIGN.md conflict, treat the conflict as a red maintenance item and resolve it explicitly."
  },
  "trust_zone_crossing": {
    "requires": [
      "explicit_purpose",
      "allowed_source_context",
      "redaction_duty",
      "retention_scope",
      "revocation_or_deletion_path",
      "visible_receipt_when_available"
    ],
    "zone_a_private": "non_export_default",
    "zone_b_transform": "exportable_with_explicit_intent_and_redaction",
    "zone_c_commercial": "minimal_scoped_no_sensitive_private_carryover"
  },
  "memory_lifecycle": {
    "claim_metadata": [
      "source",
      "scope",
      "confidence",
      "freshness",
      "sensitivity",
      "revocation_path"
    ],
    "revalidate_or_demote_when": [
      "source_context_changes",
      "trust_zone_boundary_changes",
      "confidence_drops",
      "user_revokes",
      "no_longer_improves_present_judgment"
    ]
  },
  "promotion_queue": {
    "tier_1_core_safety_continuity": [
      "memory_expiry",
      "boundary_crossing",
      "capability_receipts",
      "revocation",
      "private_commercial_separation"
    ],
    "tier_2_operator_value": [
      "maintain_loop_quality",
      "drift_scans",
      "history_ux",
      "prompt_design_sync"
    ],
    "tier_3_intelligence_edge": [
      "connection_detection",
      "trajectory_scoring",
      "compression",
      "adaptive_routing"
    ],
    "rule": "Tier 1 unresolved work outranks Tier 3 novelty."
  },
  "borrowed_patterns": {
    "file": "BORROWED_PATTERNS.md",
    "status": "reference_material_not_authority",
    "sources": [
      "ClaudioDrews/memory-os",
      "ClaudioDrews/project-samantha",
      "ClaudioDrews/icarus-plugin"
    ],
    "take": [
      "capture_eligibility",
      "provenance_required_memory",
      "source_labeled_retrieval",
      "memory_decay_and_dedup_reports",
      "sidecar_isolation",
      "graceful_degradation",
      "silent_heartbeat_ok"
    ],
    "avoid": [
      "companion_ontology",
      "attachment_dynamics",
      "mandatory_recall_before_every_response",
      "autonomous_emotional_outreach",
      "heavy_vector_stack_without_need",
      "automatic_training_or_model_replacement"
    ]
  },
  "capture_eligibility": {
    "module": "lib/capture_eligibility.mjs",
    "applies_to": [
      "auto_memory_staging",
      "trajectory_distillation",
      "trajectory_append"
    ],
    "skip_reasons": [
      "empty_capture",
      "latest_user_social_closer",
      "social_closer",
      "low_substance"
    ],
    "rule": "Durable capture requires substance beyond routine acknowledgement or schema satisfaction."
  },
  "memory_provenance": {
    "module": "lib/provenance.mjs",
    "classes": [
      "user_claim",
      "assistant_observation",
      "project_decision",
      "reusable_pattern"
    ],
    "first_enforced_surface": "trajectory_ledger",
    "trajectory_memory_class": "reusable_pattern"
  },
  "retrieval_receipts": {
    "source_labels": [
      "trusted_markdown",
      "memory_graph",
      "trajectory_ledger"
    ],
    "fallback_path": "trusted_markdown -> memory_graph -> trajectory_ledger",
    "blocked_fallback_path": "blocked_by_trust_zone"
  },
  "memory_metabolism": {
    "module": "lib/memory_metabolism.mjs",
    "mode": "report_only",
    "first_surface": "trajectory_ledger",
    "findings": [
      "malformed_trajectory",
      "legacy_missing_provenance",
      "missing_memory_class",
      "invalid_provenance",
      "duplicate_pattern_candidate",
      "high_strength_low_confidence"
    ],
    "mutation_allowed": false
  },
  "memory_ownership": {
    "file": "MEMORY_OWNERSHIP.md",
    "maintain_check": true,
    "known_surfaces": [
      "MEMORY.md",
      "memory/topics/*.md",
      "memory/YYYY-MM-DD.md",
      "memory/conversations/*.md",
      "runtime/trajectories/known_good.jsonl",
      "runtime/friction/ledger.jsonl",
      "runtime/auto_memory_candidates/*.json",
      "runtime/auto_memory/*.json"
    ]
  },
  "maintain_brief": {
    "fields": [
      "latest_commit",
      "open_work_items",
      "tier_1_count",
      "next_queue_item",
      "promotion_debt"
    ],
    "mutation_allowed": false
  },
  "upgrade_status": {
    "directory": "upgrades/active",
    "required_frontmatter": [
      "id",
      "status",
      "tier",
      "owner_surface",
      "last_reviewed",
      "next_action"
    ],
    "allowed_statuses": [
      "active",
      "integrated",
      "parked",
      "archived"
    ],
    "maintain_check": true,
    "stale_active_review_days": 45
  },
  "retrieval_prompt_blocks": {
    "source_labels_match_receipts": true,
    "labels": [
      "trusted_markdown",
      "memory_graph",
      "trajectory_ledger"
    ]
  },
  "optional_overlays": {
    "directory": "flavor/",
    "strategy_directory": "overlays/",
    "root_files_allowed": false,
    "flavor_files": [
      "flavor/PENGUIN.md",
      "flavor/TROLL.md",
      "flavor/COPPER-INU.md",
      "flavor/COSMIC-CORRESPONDENT.md"
    ],
    "strategy_files": [
      "overlays/LEVERAGE.md"
    ],
    "governing_by_default": false
  },
  "queue": {
    "max_retries": 3,
    "backoff_seconds": [1, 4, 16],
    "retry_policy": {
      "only_effects": ["READ"],
      "attempts_field": "attempts",
      "retries_field": "retry_count"
    },
    "dead_letter": {
      "dir": "runtime/dlq",
      "format": "jsonl"
    }
  },
  "runtime": {
    "bind_host_default": "127.0.0.1",
    "auth": {
      "optional": true,
      "env": "DIZZY_AUTH_TOKEN",
      "scheme": "bearer",
      "health_public_on_loopback": true
    },
    "trust_zones": {
      "private_self": {
        "chat_history": "retained",
        "durable_memory": true,
        "auto_retrieval": "trusted_only"
      },
      "trusted_collaborator": {
        "chat_history": "retained",
        "durable_memory": true,
        "auto_retrieval": "trusted_only"
      },
      "outside_contact": {
        "chat_history": "minimal",
        "durable_memory": false,
        "auto_retrieval": "off"
      },
      "paid_public": {
        "chat_history": "ephemeral_default",
        "client_continuity": "conversation_only",
        "durable_memory": false,
        "auto_retrieval": "off",
        "continuity_requires_explicit_enable": true,
        "expiry_policy": "7_days_inactivity_operator_deletable"
      }
    },
    "retrieval": {
      "markdown_scope_default": ["trusted_root_docs", "MEMORY.md", "memory/"],
      "markdown_scope_denied_default": ["_ext/", "_external/"],
      "untrusted_docs_auto_injection": false
    },
    "prompt_modes": {
      "brevity_env": "DIZZY_BREVITY_MODE",
      "affect_env": "DIZZY_AFFECT_MODE",
      "reinforcement_env": "DIZZY_REINFORCEMENT_MODE",
      "defaults": {
        "brevity": "lite",
        "affect": "attuned",
        "reinforcement": "gold_star"
      }
    },
    "transparency": {
      "governance_endpoint": "/governance"
    }
  },
  "interfaces": {
    "telegram": {
      "primary": true,
      "relay_script": "scripts/telegram_relay.mjs",
      "notify_drain_script": "scripts/telegram_notify_drain.mjs"
    }
  }
}
```
<!-- STATE_JSON:END -->
