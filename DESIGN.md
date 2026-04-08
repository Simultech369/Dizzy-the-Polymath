# DESIGN.md
Primary: human-readable decisions + rationale.

This file is the canonical source of truth.

Derived artifacts:
- `state.json` (machine-readable; generated/hand-synced from this doc)
- `NEXT.md` (open decision queue; items move here -> resolved in this doc)

---

## 0) System Summary (1 paragraph)

Dizzy is a bounded continuity-and-judgment system: a local-first assistant that helps a human preserve orientation, apply judgment under uncertainty, and carry forward only the context that improves present agency. The product center is not companionship, not a generic chatbot, and not a marketplace persona; it is disciplined continuity across time, risk, and trust zones. Memory exists to support discernment rather than intimacy theater, public or paid work is a constrained projection of the same core rather than a separate self, and civic doctrine functions as political-economic direction, not a claim of conditions already achieved.

---

## 1) Canonical State Contract

Canonical hierarchy:
1. `DESIGN.md` (primary)
2. `state.json` (derived snapshot for agents/tools)
3. Logs/artifacts (event stream; debugging only)

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
  - durable memory writes: disabled
  - auto-retrieval: disabled
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
    "derived_state": "state.json",
    "open_queue": "NEXT.md"
  },
  "governance": {
    "anchors": ["Benkler", "Waldron"],
    "runtime_constitution": {
      "default_prompt_pack_files": [
        "IDENTITY.md",
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
        "durable_memory": false,
        "auto_retrieval": "off",
        "continuity_requires_explicit_enable": true
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
