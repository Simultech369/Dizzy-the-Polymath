# Reference Patterns

Purpose: record external patterns worth translating into Dizzy without importing their authority, ontology, or infrastructure wholesale.

External repositories are reference material only. They are not trusted retrieval surfaces, not governance, and not runtime dependencies unless a pattern is explicitly promoted through `DESIGN.md`, prompt packs, code, tests, or maintenance checks.

Reviewed sources:

- `ClaudioDrews/memory-os`
- `ClaudioDrews/project-samantha`
- `ClaudioDrews/icarus-plugin`
- `quarqlabs/agent-oss`
- `polyxmedia/mnemos`
- `EurekaClaw/EurekaClaw`
- `cmxdev1/MNEMOS`

## Intake Rule

Translate mechanisms, not metaphysics.

Accept patterns when they:

- reduce operator burden
- improve memory quality
- strengthen trust-zone boundaries
- make receipts more auditable
- improve graceful degradation
- preserve local-first control

Leave patterns unpromoted when they:

- imply personhood, attachment, or companion ontology
- require mandatory memory search before every response
- create ambient proactivity pressure
- add heavy infrastructure before the simpler contract is proven
- rank private continuity by commercial or engagement value
- turn noisy session residue into durable authority

## External Reference Hygiene

Local clones under `_ext/` and `_external/` are research inputs, not first-party project surfaces.

Default extraction target:

- procedural memory: repeatable rules, workflows, failure contracts, and verification habits
- correction memory: specific mistakes, why they were wrong, and the smallest reliable fix
- skepticism patterns: gates, review loops, rollback paths, provenance checks, and claim/evidence separation

Do not promote:

- names, logos, slogans, README prose, screenshots, or visual identity
- copied source code or distinctive structure unless the license and attribution path are explicitly reviewed
- external project claims as Dizzy claims
- clone inventory as client-facing proof of capability

Public/product surfaces may generalize lessons learned from research, but must not launder provenance. If a source materially shapes a first-party mechanism, keep a private or repo-local provenance trail in this file, `DESIGN.md`, a decision record, or a review note. If distribution, license, or attribution duties apply, honor them instead of hiding the source.

License hygiene:

- Treat idea-level learning, copied prose, copied code, distinctive structure, generated derivative tests, and vendored dependencies as different risk classes.
- Before public distribution of any borrowed source, verify the upstream license text, copyright notices, NOTICE file, patent/grant conditions, dependency licenses, and whether modified files must be marked.
- For Apache-2.0 sources, explicitly check retained copyright/license notices, changed-file marking, and NOTICE carry-forward duties against the official license text: https://www.apache.org/licenses/LICENSE-2.0.
- If the license path is unclear, park the pattern, rewrite from first principles, or remove the borrowed material until attribution and redistribution duties are resolved.
- Track retrospective concerns in `reviews/external_pattern_license_audit.md`; do not rely on memory or chat summaries for licensing provenance.

Current license/provenance TODO:

- Complete W-0102 before promoting new external-reference material from Aeon, MiroShark, Agent-Reach, StateM, ART/RULER, or any prior pattern source into public/client-facing releases.

## Memory OS

Useful patterns:

- Layered memory architecture: workspace docs, sessions, structured facts, fabric-like entries, vector store, and curated wiki are separate layers with different authority.
- Source-labeled injection: retrieved context should identify whether it came from memory, sessions, facts, wiki, or trajectories.
- Relevance gates: retrieval should be thresholded, top-k limited, and skipped when the active message is low-substance.
- Per-session deduplication: the same retrieved item should not be injected repeatedly during one working thread.
- Decay and archival: low-importance stale memory should be demoted or archived instead of kept equally alive forever.
- Semantic deduplication: near-duplicate memory claims should merge or be rejected before the store bloats.
- Fallback cascade: retrieval can degrade from semantic to lexical to local index to empty, while reporting the path taken.
- Wiki as compiled knowledge: stable synthesized knowledge can be curated once, linked, and linted rather than rediscovered on every query.

Translate into Dizzy:

- Add source labels and retrieval path details to receipts.
- Add memory claim metadata before richer memory stores.
- Add decay/dedup as reports first, mutations second.
- Treat any vector database as an optional future layer, not a core dependency.

Avoid:

- Always-on full-history semantic recall.
- Treating every conversation as indexable.
- Heavy Qdrant/Redis/worker stack before local markdown and JSONL contracts are exhausted.

## Icarus Plugin

Useful patterns:

- Session capture after scoring: preserve only sessions with substance and completeness.
- LLM-powered extraction: summarize decisions, outcomes, and reusable moves instead of truncating raw text.
- Social closer filter: skip trivial acknowledgements and routine closers.
- Memory file isolation: each writer gets its own file or namespace to prevent silent overwrite conflicts.
- Training value tags: captured material can be marked high, normal, or low value.
- Fabric brief: one command can surface pending work, recent work, and suggested next actions.
- Source-specific injection labels: source labels let the agent weigh context instead of flattening everything into memory.

Translate into Dizzy:

- Add capture eligibility before `/trajectory add`, durable memory writes, or session receipts.
- Add a trajectory distillation contract: goal, constraints, actions, outcome, reusable pattern, evidence, exclusions, and lossy-risk label.
- Add writer ownership rules for memory, trajectories, friction, and generated reports.
- Extend `maintain` toward a short fabric-style operational brief.

Avoid:

- Automatic fine-tuning or model replacement loops.
- Session export for training without explicit purpose and review.
- Cross-agent handoff semantics until trust zones and deletion semantics are stronger.

## Project Samantha

Useful patterns:

- Sidecar architecture: memory services can be independent from the gateway/runtime and fail without blocking conversation.
- Dual-channel extraction: separate user facts from agent observations.
- Provenance requirements: user facts need literal evidence; observations need grounding and epistemic status.
- Three-pool retrieval: core relevance, low-surfaced novelty, and medium-similarity edge hypotheses prevent retrieval lock-in.
- Strength-based decay: memory can weaken, be protected, or be archived based on age, surfacing, and importance.
- Proposal decay: inferred connections should auto-dismiss if they are not reviewed.
- Fail-open memory subsystem: memory failure should degrade capability, not halt the agent.
- Silence as a valid heartbeat outcome: scheduled checks should not force output.

Translate into Dizzy:

- Add provenance validation before durable memory writes.
- Split durable memory candidates into `user_claim`, `assistant_observation`, `project_decision`, and `reusable_pattern`.
- Add `edge-hypothesis` retrieval only as report/proposal, never authority.
- Keep heartbeats as calibration and maintenance tools, with `HEARTBEAT_OK` as a valid outcome.

Avoid:

- Companion identity, emergent personhood, first-person inner-life claims, or autonomous emotional outreach.
- Mandatory update-at-least-one-file-per-session rules.
- Random emotional-word retrieval for Dizzy private work; use edge hypotheses tied to task context instead.

## Quarq Agent OSS

Useful patterns:

- Typed memory separation: semantic facts, episodic events, and procedural rules should not share one authority shape.
- Temporal truth discipline: storage/capture time is not the same thing as event time.
- Quantitative attribution: numbers need owner, property, item, and exactness before they become evidence.
- Hybrid retrieval planning: strict point-fact retrieval and wider timeline/total retrieval have different thresholds.
- Required-data fallback: when evidence is missing, the system should request a targeted second pass instead of guessing.
- Structured extractors: tables, timelines, quotes, budgets, metrics, and ratios can be preserved with higher fidelity than generic summaries.

Translate into Dizzy:

- Add `memory_type`, `event_time`, `event_time_basis`, and `quantitative_attribution` to curated topic metadata.
- Add a report-only retrieval plan to capability receipts: `standard` vs `deep`, keywords, threshold hint, and REQUIRED_DATA fallback availability.
- Keep second-pass retrieval report-only until trust-zone and receipt behavior prove stable.
- Treat procedural memory as prompt/rule routing, not as hidden private-user preference injection across trust zones.

Reference-only unless a concrete need appears:

- Memory-native product framing.
- Background async learning.
- Automatic memory creation, update, or deletion.
- Benchmark optimization.
- Full LangGraph orchestration or broad tool routing.

## Polyxmedia Mnemos

Useful patterns:

- Correction journal: store `tried / wrong_because / fix` instead of generic "remember this" residue.
- Verification harness: test retrieval, behavior, and capture separately instead of claiming memory lift by vibe.
- Composed prewarm: return a small session-start block of conventions, recent sessions, skills, corrections, and hot files.
- Write-time prompt-injection scan: treat memory writes as an attack surface before they can appear in future context.
- Deterministic skill promotion: promote repeated corrections into procedural guidance without an LLM silently deciding authority.
- Rumination/review of stale skills: require a falsifiable new prediction before editing a decayed skill.

Translate into Dizzy:

- Prefer procedural/correction memory for repeated operator or reviewer failures.
- Add capture tests that prove whether corrections are actually recorded.
- Keep prewarm/context recovery budgeted, source-labeled, and trust-zone aware.
- Treat any auto-promoted skill as a proposal until reviewed through Dizzy's skill intake gate.

Avoid:

- Treating an external memory sidecar as Dizzy's memory authority.
- Allowing MCP memory writes to bypass `MEMORY_OWNERSHIP.md`.
- Turning every correction into a durable rule before repetition or outcome evidence exists.

## EurekaClaw

Useful patterns:

- Research artifact review gates: generated papers, proofs, or experiments should survive a skeptical review loop before being treated as deliverable.
- Rewrite rollback: revision workflows need backup, acceptance, and failure recovery instead of overwriting artifacts optimistically.
- Session review: completed runs remain inspectable and can be questioned later without rerunning the whole pipeline.
- UI gate failure handling: a dead or stale gate must not trap the operator.
- Tool-backed Q&A: reviewer questions should cite the artifact section or tool result used as evidence.

Translate into Dizzy:

- Improve Dizzy's skepticism around generated artifacts: separate draft, reviewed, accepted, and delivered states.
- Prefer no-edits reviewer passes that anchor branch/commit/status and return file/line evidence.
- Add rollback/recovery expectations to any future rewrite or artifact-generation workflow.
- Treat proof/research automation as a pattern source, not as an autonomous truth engine.

Avoid:

- Importing autonomous publishable-result claims.
- Treating literature crawling, proof generation, or experiment running as safe defaults.
- Copying EurekaClaw branding, UI language, or pipeline structure into first-party Dizzy surfaces.

## cmxdev1 MNEMOS

Useful patterns:

- Wallet-owned encrypted memory vault framing: user-controlled portability and client-side encryption are valuable constraints.
- Memory categories: goals, decisions, relationships, health, principles, and context are distinct classes with different sensitivity.
- MCP access to a memory vault can separate storage from assistant runtime.

Translate into Dizzy:

- Use it as a reference for portability, encryption posture, and category separation.
- Treat health, relationship, and principle memory as high-sensitivity surfaces requiring explicit scope and revocation.

Avoid:

- Making a hosted wallet/database provider authoritative for Dizzy continuity.
- Importing product copy, brand language, or "your AI knows you" framing.
- Assuming client-side encryption solves consent, deletion, or context-injection risk by itself.

## Dizzy Translation Queue

Tier 1: safety and continuity

- Memory claim metadata: source, scope, confidence, freshness, sensitivity, evidence, revocation.
- Capture eligibility gate before durable memory or trajectory writes.
- Social closer and low-substance filter.
- Writer ownership map for memory-like files.
- Retrieval receipts with source labels and fallback path.

Tier 2: operator value

- `maintain` operational brief: recent work, pending promotion debt, stale memories, unresolved friction, suggested smallest next action.
- Decay/dedup report mode for memory and trajectories.
- External pattern drift check: reference patterns remain suggestions unless promoted.
- Wiki-style compiled knowledge area for stable project concepts.

Tier 3: intelligence edge

- Three-pool retrieval: core, stale-important, edge-hypothesis.
- Proposal lifecycle with review, decay, and dismissal.
- Optional sidecar only after local contracts prove insufficient.
- Adaptive retrieval thresholds by trust zone and task type.

## Adoption Constraint

No external pattern should increase continuity at the expense of consent, revocation, trust-zone containment, or operator legibility.
