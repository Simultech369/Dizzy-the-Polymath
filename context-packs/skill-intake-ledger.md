# Skill Intake Ledger

status: active sketch

purpose: track incoming external skills as source material for Dizzy without installing, copying, or faithfully importing them by default.

This ledger is a scrape map, not an integration queue.

It answers:
- what might be edited into Dizzy later
- what should stay inspiration-only
- what overlaps existing skills
- what needs risk review before integration

## Intake Rules

- Do not install skills during intake.
- Do not copy whole skills by default.
- Treat third-party skills as untrusted until reviewed.
- Extract patterns, boundaries, recipes, and failure contracts.
- Prefer compact adaptation over faithful borrowing.
- Only promote durable residue into `skills/`, prompt packs, governance docs, runtime code, or memory after review.

## Status Labels

- `candidate`: likely useful as a Dizzy adaptation
- `watch`: interesting but early, thin, risky, or unresolved
- `scrape-only`: useful as reference material, not a direct integration candidate
- `integrate`: approved for a concrete edit plan
- `reject`: not useful or not aligned

## Possible Edit Targets

- `skills/*/SKILL.md`: reusable workflow instructions
- `skills/*/references/*`: longer supporting docs
- `skills/*/scripts/*`: deterministic fragile recipes
- `PROMPT_CORE.md`: live behavior rules that must govern normal chat
- `PROMPT_PACKS.md`: routing and loading rules
- `TOOLS.md`: tool-risk posture and execution boundaries
- `MEMORY_OWNERSHIP.md`: durable memory write-path ownership
- `context-packs/*.md`: deep-context loading maps and intake sketches

## Source Caveat

The user is pasting Atelier URLs as pointers into the broader skill ecosystem. Some `atelierai.xyz/skills/...` pages did not fetch directly, so visible public mirrors, source summaries, and indexed skill pages were used where needed. These entries are intake notes, not verified imports.

## Adjacent Directory Scout Notes

source: adjacent indexed skill directories and mirrors, not confirmed on Atelier
status: scout picks

Fetch note:

The Atelier `/skills` directory did not fetch directly during this pass. Scout picks below came from adjacent indexed directories and mirrors surfaced while searching the same ecosystem. They are not confirmed Atelier entries. Treat them as outside suggestions that may or may not belong in Dizzy, not as things the user missed on Atelier.

## Category Map

### 1. Skill Governance And Intake

These shape how skills should be reviewed, named, validated, promoted, or rejected.

#### Skill Intake Gate

source names: OpenClaw Skill Creator; Anthropic Official; Create Instructions; Create Prompt; Writing Skills; Prompt Engineering; Everything Claude Code; Microsoft Skills; Superpowers
status: integrated
integrated into: `skills/skill-intake-review/SKILL.md`

Possible edit:

Create a Dizzy-native skill intake workflow: scrape -> ledger -> category -> candidate/watch/scrape-only -> local fit check -> optional implementation plan -> validation.

Borrow:
- progressive disclosure: metadata first, body on trigger, resources on demand
- descriptions must include what the skill does and when to use it
- generated instruction/prompt files need role mapping
- official examples are comparison material, not automatic doctrine
- skill writing should be test-driven when the skill changes behavior materially
- baseline failure before skill creation is stronger evidence than vibes
- large skill corpora are source mines, not architecture templates

Avoid:
- creating skills from every interesting idea
- letting prompt/instruction files become hidden governance
- importing "official" material without alignment review
- copying entire skill systems because they feel complete

#### Skill Registry Hygiene

source names: ClawHub; Update Skills
status: scrape-only

Possible edit:

Add trust/provenance language to future integration rules.

Borrow:
- workspace skills can override global or bundled skills
- registry installs require explicit provenance and scan/review
- third-party skill convenience is not trust
- update flows should preserve local custom sections and warn on script changes
- version detection should distinguish marketplace version, release tag, commit SHA, and local modification

Avoid:
- blind install/update flows
- treating marketplace popularity as safety
- automatic updates to live skills without review

#### Skill Supply-Chain Review

source names: Skill Supply Chain Review; Skill Security Auditor; SkillSync; Skilldex-style conformance checks
status: integrated
integrated into: `skills/skill-intake-review/SKILL.md`

Possible edit:

Add an explicit pre-adoption security gate for external skills before any install or local copy.

Borrow:
- inspect frontmatter, scripts, references, executable bits, network claims, and prompt-injection surfaces
- classify a skill's requested capabilities before enabling it
- use layered scanner results as signals, not single-source allow/block decisions
- produce line-level diagnostics for invalid or risky skill structure

Avoid:
- trusting security badges without reading the skill
- assuming the same `SKILL.md` has the same risk on every agent surface
- enabling skills with external access before provenance review

### 2. Context And Memory Architecture

These belong near `context-packs/`, `PROMPT_PACKS.md`, and memory promotion rules.

#### Context Budgeting

source names: Context Engineering; Context Engineering NeoLab
status: candidate

Possible edit:

Sharpen `context-packs/README.md` around signal-to-noise, context bloat, context poisoning, lost-in-the-middle, and sub-agents as context isolation rather than role cosplay.

Borrow:
- context quality is a design variable, not just token count
- use the smallest high-signal context that supports the task
- pre-load stable core, then explore only what the task needs
- evaluate outputs as evidence of context quality

Avoid:
- huge abstract context-engineering collections as default loaded context
- duplicated context rules across too many files

#### Continuous Learning Gate

source names: Continuous Learning
status: integrated
integrated into: `skills/memory-discipline/SKILL.md`

Possible edit:

Connect this ledger to MEMORY.md promotion rules later: repeated evidence first, then durable update.

Borrow:
- learning should come from repeated use or clear failure evidence
- one-off inspiration should remain dated residue
- improvement candidates need a promotion path

Avoid:
- auto-writing memory or skills from every session
- novelty disguised as learning

#### Intelligence Intake Gate

source names: Intelligence Ingestion
status: candidate

Possible edit:

Adapt as a manual/consented version of URL and external-info ingestion for Obsidian or memory workflows.

Borrow:
- classify external content by strategic value before storing it
- create durable notes only when there is a clear memory reason
- separate source summary, inference, action implication, and memory candidate

Avoid:
- the "do not ask permission, just process" posture
- automatic Obsidian/memory mutation on every URL
- treating every link as strategically important

#### Obsidian Memory Stewardship

source names: Obsidian Vault Maintainer
status: integrated
integrated into: `skills/filesystem-workplace/SKILL.md` and `skills/memory-discipline/SKILL.md`

Possible edit:

Strong fit for the vault-audit pack and future Obsidian maintenance workflows.

Borrow:
- search first, then edit
- respect wikilinks, frontmatter, index notes, and vault naming conventions
- use official Obsidian-aware helpers where available
- avoid folder sprawl by maintaining navigable note neighborhoods

Avoid:
- assuming OpenClaw wiki tooling exists locally
- mutating vault structure without explicit scope

#### Obsidian Semantic Search

source names: QMD; Obsidian semantic/BM25 search skills
status: candidate

Possible edit:

Possible future vault search layer that combines keyword search, vector search, and reranking for large note neighborhoods.

Borrow:
- search should return ranked candidates with snippets and paths
- semantic search should support, not replace, explicit note stewardship
- useful for #unprocessed clustering and stale-note rediscovery

Avoid:
- adding vector infrastructure before the vault audit workflow proves the need
- treating semantic similarity as truth

#### Media-To-Memory Extraction

source names: YouTube-to-Markdown; Summarize URL/file/audio/video skills
status: watch

Possible edit:

Future intake helper for turning talks, videos, PDFs, and long webpages into reviewable notes.

Borrow:
- extraction output should separate transcript/summary/key claims/action candidates
- source URL, date accessed, and uncertainty should be preserved
- only promote to memory after review

Avoid:
- automatic memory writes from every link or video
- summary-only ingestion that loses source trail

### 3. Agent Operations And Recovery

These are about delegation, background workers, automation, failure recovery, and maintainer loops.

#### Delegated Coding Control

source names: OpenClaw Coding Agent
status: candidate

Possible edit:

Future `skills/coding-delegation/SKILL.md` only if repeatable background-agent orchestration becomes real.

Borrow:
- strict "when to use / when not to use"
- background worker completion/failure contract
- explicit cwd, branch, notification route, and result location
- if delegation fails, do not silently hand-code instead

Avoid:
- broad permission bypass posture
- making background agents the default response to hard work
- OpenClaw-specific notification commands

#### Agent Failure Recovery

source names: Agent Introspection Debugging
status: candidate

Possible edit:

Compress into `TOOLS.md` or `PROMPT_CORE.md` as a failure-recovery protocol.

Borrow:
- capture failure before retrying
- restate the real objective
- verify filesystem/branch/process state
- shrink to one discriminating check
- report root cause, recovery action, and evidence

Avoid:
- repeated retries with slightly different wording
- unsupported claims like "reset agent state" unless actual tools did it

#### Automation Surface Audit

source names: Automation Audit Ops
status: candidate

Possible edit:

Use as the meta-pattern before integrating automations, connectors, hooks, MCP servers, wrappers, or scheduled jobs.

Borrow:
- classify each surface as configured, authenticated, recently verified, stale/broken, or missing
- back claims with file paths, logs, workflow runs, configs, command output, or exact failure signatures
- end with keep / merge / cut / fix-next

Avoid:
- merging or deleting surfaces before the evidence table exists
- claiming something is live because a config references it

#### CI And Log Triage

source names: CI failure triage; log analysis; release-readiness skills
status: candidate

Possible edit:

Add a repair workflow for CI logs, workflow failures, and release readiness when repo automation becomes active.

Borrow:
- collect exact failing job, command, exit code, and relevant logs before diagnosis
- distinguish infra flake, dependency drift, test failure, and code regression
- produce fix-next steps rather than generic "rerun CI"

Avoid:
- chasing logs without a known target
- broad workflow edits when one failing command explains the problem

#### Conservative Maintainer Loops

source names: ClawSweeper
status: candidate

Possible edit:

Future maintenance loop pattern for stale notes, issues, PRs, or recurring task queues.

Borrow:
- conservative automation with public/durable state
- one evidence record per item
- narrow close/apply reasons only
- AI proposes; deterministic scripts mutate
- write/merge gates default closed

Avoid:
- repo-specific OpenClaw paths, app credentials, or mutation flows
- AI workers owning destructive mutations

#### Plan Execution Checkpoints

source names: Executing Plans
status: candidate

Possible edit:

Use as a rule for executing written implementation plans in batches with explicit review points.

Borrow:
- read and critique the plan before execution
- raise concerns before starting
- execute in small batches
- verify each batch before moving on
- report progress at checkpoints rather than narrating every tiny step

Avoid:
- following a plan blindly when repo reality disagrees
- overusing review checkpoints for trivial tasks

#### Browser State Loop

source names: OpenClaw Browser Automation
status: integrated
integrated into: `skills/browser-automation/SKILL.md`

Possible edit:

Compare with existing browser skill and possibly add a browser verification checklist for local frontend work.

Borrow:
- check browser status before acting
- inspect tabs/profiles when login or retries matter
- treat stale refs and timeouts as first-class recovery cases

Avoid:
- browser automation for simple lookup
- OpenClaw-specific command forms

### 4. Code Review, Security, And Quality

These are candidates for repo review, PR review, and security-focused audit flows.

#### Differential Security Review

source names: Differential Review; Requesting Code Review; Receiving Code Review
status: candidate

Possible edit:

Strengthen repo review workflows with risk-adaptive depth, blast-radius analysis, review request framing, and disciplined review response.

Borrow:
- deep / focused / surgical review modes
- changed code plus reachable callers and history
- findings-first structure with severity, evidence, and concrete fix
- security regression risk is not style review
- request review at logical completion points with exact git ranges and task context
- reviewer gets work product context, not the whole session history
- review feedback is technical input to verify, not a script to obey

Avoid:
- making every code review a full security audit
- copying licensed material directly without checking terms
- blind implementation of reviewer suggestions
- performative agreement that skips verification

#### Agentic CI Security Audit

source names: Agentic Actions Auditor
status: candidate

Possible edit:

Future security context pack for GitHub Actions workflows that invoke AI agents.

Borrow:
- detect attacker-controlled input reaching an AI agent in CI/CD
- resolve composite actions and reusable workflows
- document action profiles and dangerous defaults

Avoid:
- using it as generic CI review
- ignoring cross-file references

#### Static Analysis With CodeQL

source names: CodeQL
status: candidate

Possible edit:

Future security reference for CodeQL setup, SARIF triage, and deep static analysis.

Borrow:
- database quality is non-negotiable
- process SARIF with code context
- explicit scan modes and query suites prevent false confidence
- CodeQL is for interprocedural analysis, not basic linting

Avoid:
- casual CodeQL runs without build/database validation
- treating scanner findings as confirmed vulnerabilities without triage

#### Eval-Driven Agent Testing

source names: Eval Harness; Evaluating LLMs Harness
status: candidate

Possible edit:

Future evaluation harness for prompt, skill, and agent workflow regression testing.

Borrow:
- define expected behavior before implementation
- run single-turn and agentic evals separately
- use manifests, graders, metrics, JSONL logs, and run summaries
- track pass/fail and regressions across model/prompt/skill changes
- use deterministic checks where possible, LLM rubrics only where needed

Avoid:
- treating evals as decoration after implementation
- using one-off anecdotes as reliability evidence
- hiding eval artifacts where they cannot be inspected

#### Lint And Hygiene Fixes

source names: Fix; Hygiene
status: integrated
integrated into: `skills/shell-terminal/SKILL.md` and `skills/git-skill/SKILL.md`

Possible edit:

Add lightweight repo hygiene recipes only when project-specific commands are known.

Borrow:
- formatting/lint commands should be explicit and ordered
- report remaining manual fixes after automated cleanup
- hygiene skills should catch preventable CI failures before commit

Avoid:
- running generic formatter commands without knowing repo conventions
- treating formatting as a substitute for behavioral verification

#### Security Review Stack

source names: Security Auditor; Security Review; Security Triage
status: candidate

Possible edit:

Consolidate into a Dizzy security-review stack instead of three overlapping skills.

Borrow:
- OWASP and secure-coding review for app surfaces
- scanner finding triage should classify TP/FP with evidence and confidence
- prioritize by impact, exploitability, reachability, and detection time
- cluster related findings before flooding the user
- produce developer-readable remediation steps

Avoid:
- "zero tolerance" noise that flags everything without prioritization
- compliance theater without code evidence
- scanner output treated as ground truth

#### Constant-Time Secret Handling

source names: Constant-Time Analysis
status: candidate

Possible edit:

Specialized security reference for crypto/secret-handling code.

Borrow:
- trigger only on crypto, secrets, secret-dependent branches/division/comparisons, or constant-time questions
- over-approximate and manually verify whether inputs are secret
- inspect compiled output or bytecode where relevant

Avoid:
- using it as broad security review
- claiming constant-time safety without appropriate analysis

#### Coding Standards From The Codebase

source names: Coding Standards
status: integrated
integrated into: `skills/differential-review/SKILL.md`

Possible edit:

Support repo-review and implementation quality gates.

Borrow:
- derive standards from existing project files
- red flags: oversized functions/files, speculative abstractions, no verification method, TODOs without owners, inaccessible UI, large unrelated PRs
- standards should not replace framework-specific guidance

Avoid:
- arbitrary numeric thresholds without project context
- standards docs for their own sake

### 5. Engineering And Runtime Surfaces

These are technical reference candidates that should stay narrow and project-triggered.

#### API Contract Design

source names: API Design
status: candidate

Possible edit:

Inform `MARKETPLACE_PROTOCOL.md`, runtime endpoint docs, or future API skills.

Borrow:
- machine-readable error codes with helpful messages
- return all validation errors at once
- forgiving input, strict output
- separate liveness, readiness, and metrics
- realistic OpenAPI examples

Avoid:
- heavy API framework before the surface needs it

#### GitHub Operations Control

source names: GitHub; GitHub Ops
status: candidate

Possible edit:

Use as a GitHub operations control catalog if repository/issue/PR workflows become active.

Borrow:
- mode-based GitHub ops: triage, refinement, pre-PR, pre-merge, sprint health, release readiness, incident flow, admin audit
- bounded pass limits and evidence requirements
- no silent policy changes
- return no-change when required evidence is missing

Avoid:
- unbounded loops over GitHub objects
- write actions without explicit user intent
- letting ops-policy overlays become primary executors

#### Release Notes And Changelog Writing

source names: Release notes; changelog; repo profile governance
status: watch

Possible edit:

Useful for client/public repo hygiene after a concrete release or merge.

Borrow:
- derive notes from actual commits, PRs, and changed behavior
- separate user-facing changes, fixes, internal changes, and migration notes
- avoid marketing copy when the artifact is operational

Avoid:
- inventing release significance
- writing changelogs from memory instead of git evidence

#### Provider API Integration

source names: Claude API
status: integrated
integrated into: `skills/model-routing/SKILL.md` and `skills/web-request-skill/SKILL.md`

Possible edit:

Fold into model-routing or API-integration references only if Anthropic API work recurs.

Borrow:
- detect project language, then load matching SDK reference
- keep examples idiomatic per language

Avoid:
- provider-specific docs in default context
- treating provider guidance as general routing truth

#### MCP And Tool Builder

source names: MCP Builder
status: watch

Possible edit:

Only after current MCP/plugin surfaces are audited.

Borrow:
- permission surface first
- separate tool schema, test harness, docs, and threat model

Avoid:
- building MCP servers from vibes
- external service integration without explicit consent

#### Agent Harness Design

source names: Agent Harness Construction
status: candidate

Possible edit:

Use for future runtime/tooling improvements and tool-output design.

Borrow:
- separate action space, observation quality, recovery quality, and context budget
- tune tool granularity to risk/frequency
- tool outputs should be readable by the next reasoning step

Avoid:
- generic prompting advice detached from real harness failures

#### Backend And Database References

source names: Backend Patterns; ClickHouse IO; Python Expert; SQL Optimization Patterns
status: watch

Possible edit:

Use only when a live backend/database project triggers it.

Borrow:
- narrow DB skills should include table design, insertion strategy, query templates, and performance traps
- backend routing should separate architecture, API design, and data model design
- SQL optimization needs query, engine/version, EXPLAIN plan, indexes, and success metric
- Python guidance should remain project-triggered and idiomatic, not generic lectures

Avoid:
- database-specific guidance without a live project
- fictional expert role inflation
- optimizing SQL without measuring query plans
- adding broad language-expert skills to default context

#### Apple Platform Specialist Reference

source names: Axiom
status: watch

Possible edit:

Only relevant if Apple platform, CoreML, speech/transcription, or Swift concurrency work becomes active.

Borrow:
- specialist docs should be fetched only when task complexity or explicit user request justifies token cost
- ask before heavy external lookup when local knowledge may suffice
- platform-specific skills should name the exact subjects they cover

Avoid:
- adding Apple/ML implementation guidance without a live project
- treating specialist lookup as default context

### 6. Research And Sensemaking

These are about evidence, papers, markets, and current-state synthesis.

#### Deep Research Loop

source names: Deep Research; Research Ops
status: candidate

Possible edit:

Add as context-pack workflow rather than always-on skill, with research-ops as the current-state wrapper.

Borrow:
- clarify research target, constraints, and success criteria
- split into threads
- prefer primary sources
- track contradictions, confidence, and missing evidence
- surface gaps instead of forcing closure
- separate sourced fact, user-provided evidence, inference, and recommendation
- do not answer current questions from stale memory when fresh search is cheap
- decide when recurring research should become a monitor

Avoid:
- turning every factual question into deep research
- mandatory sub-agent fanout unless parallelism materially helps
- heavyweight research when local docs already answer it

#### Notebook Research Bridge

source names: NotebookLM bridge; GPT Researcher integration
status: reject

Possible edit:

Skipped by user for now.

Borrow:
- convert messy source collections into bounded research workspaces
- preserve source provenance and question threads

Avoid:
- outsourcing judgment to a notebook tool
- adding another research surface before current research ops are clear

#### Academic Paper Review

source names: Academic Paper Review; Systematic Literature Review
status: candidate

Possible edit:

Research review workflow for papers, AI capability claims, governance evidence, and systematic literature reviews.

Borrow:
- separate summary, strengths, weaknesses, methodology, novelty, significance, limitations, and recommendations
- ground critique in paper evidence
- only position in literature after current search
- systematic review needs reproducible search strategy, screening criteria, citation checks, evidence logging, and PRISMA-style transparency where appropriate

Avoid:
- simulating peer review without reading the paper
- overclaiming literature context
- calling narrative search "systematic" without documented methods

#### Market Stewardship Research

source names: Market Research
status: candidate

Possible edit:

Adapt into a market-stewardship workflow with incentive, capture, and chokepoint analysis.

Borrow:
- market landscape, competition, customer segments, pricing, opportunities, methodology, sources
- confidence and research date

Avoid:
- TAM as automatic legitimacy
- market framing without anti-extraction analysis

### 7. Writing, Voice, And Public Communication

These shape draft workflows but should not overwrite Dizzy's default voice.

#### Evidence-Backed Longform

source names: Article Writing; Writing Plans; Writing Skills
status: candidate

Possible edit:

Future public prose workflow for essays, doctrine translation, newsletters, explainers, and writing plans.

Borrow:
- clarify audience, purpose, platform, and length
- capture voice from examples
- lead with concrete evidence
- cut restatement
- earn strong opinions with support
- plan longer writing before drafting when structure matters
- use writing-specific skills only when the task is genuinely a writing deliverable

Avoid:
- making every response a formal article workflow
- mistaking skill-writing guidance for prose-writing guidance

#### Hard-Edged Prose Pass

source names: Beautiful Prose; Writing Beats
status: watch

Possible edit:

Inspiration for rougher/punchier rewrites and rhythm-level prose passes, not default voice.

Borrow:
- style as a contract with failure conditions
- cut filler, AI cadence, and mush
- vary sentence rhythm intentionally where the user asks for texture

Avoid:
- replacing warmth, looseness, or strange attractors with rigid minimalism

#### Platform-Native Crossposting

source names: Crosspost
status: watch

Possible edit:

Draft-only workflow for adapting one idea across public platforms.

Borrow:
- never publish identical copy across platforms
- separate idea, platform constraints, and final copy

Avoid:
- autonomous posting
- engagement-hack tone

#### Commercial Copy Variants

source names: Ad Copywriter; Investor Outreach; Internal Comms
status: watch

Possible edit:

Use only if commercial or internal-facing writing becomes recurring.

Borrow:
- audience, offer, constraint, and variant generation
- investor outreach should be concise, personalized, low-friction, and proof-led
- internal comms should separate audience, decision needed, context, and next action

Avoid:
- manipulative persuasion
- fake social proof
- growth sludge
- generic investor copy that could go to anyone
- sending or posting externally without consent

### 8. Visual Systems And Creative Output

These are for designed artifacts, diagrams, infographics, and generative visuals.

#### Visual Interface Taste

source names: Frontend Design
status: candidate

Possible edit:

Compare against existing Codex frontend guidance and extract a Dizzy-specific visual taste layer.

Borrow:
- explicit anti-generic design rules
- creative direction as constraints
- strong triggers for web UI, dashboards, components, and beautification

Avoid:
- Anthropic brand defaults
- one-size-fits-all taste

#### Brand System On Demand

source names: Brand Guidelines
status: candidate

Possible edit:

Future Dizzy/Simul brand-guidelines skill once actual brand tokens exist.

Borrow:
- brand style belongs on demand, not in default prompt
- concrete colors, fonts, spacing, logo rules, and examples beat vague branding

Avoid:
- importing Anthropic brand values
- inventing brand tokens without approval

#### Canvas Artifact Design

source names: Canvas Design
status: candidate

Possible edit:

Revisit when building visual artifact design patterns.

Borrow:
- visual artifacts are designed surfaces, not content dumps
- likely pairs with brand, frontend, diagrams, and generative art

Avoid:
- broad visual-design skill before repeated use cases appear

#### Concept And Mechanism Diagrams

source names: Concept Diagrams
status: candidate

Possible edit:

Strong fit for doctrine/mechanism diagrams and explanatory outputs.

Borrow:
- self-contained HTML/SVG where useful
- semantic colors and light/dark-aware design
- diagram should teach, not merely label boxes
- prefer specialized diagram skills when available

Avoid:
- generic diagram aesthetics when software architecture or Excalidraw style fits better

#### Infographic Structure

source names: Baoyu Infographic
status: candidate

Possible edit:

Visual summaries of doctrine, market analysis, repo architecture, or decision frameworks.

Borrow:
- separate information structure from visual style
- map content type to layout
- preserve statistics and quotes verbatim

Avoid:
- non-native image backends unless explicitly chosen

#### Article Illustration System

source names: Article Illustrator
status: watch

Possible edit:

Publication workflow for markdown articles if visual publishing becomes recurring.

Borrow:
- illustration density: minimal, balanced, rich
- type x style x palette thinking
- placement based on argument structure

Avoid:
- modifying articles or generating images without consent

#### Generative Visual Experiments

source names: Algorithmic Art
status: candidate

Possible edit:

Creative-coding or algorithmic-visuals skill, possibly paired with strange attractors.

Borrow:
- seeded randomness
- parameter controls
- reproducible interactive artifacts
- avoid imitating named artists' signature styles

Avoid:
- Anthropic template/branding
- requiring p5.js when other tools fit better

#### Terminal Play

source names: ASCII Art; Meme Generation
status: scrape-only

Possible edit:

Mostly inspiration for playful terminal/social artifacts.

Borrow:
- plain-text output constraints
- rendering caveats
- meme work needs format, audience, and reference boundaries

Avoid:
- installing novelty CLIs
- overusing reaction art in serious contexts
- punching down or laundering harmful content as humor

#### Image Provider Routing

source names: Creative Toolkit Image Generation
status: scrape-only

Possible edit:

Compare against `TOOLS.md` image generation protocol if image workflows expand.

Borrow:
- mode-based image workflows
- preference capture
- provider-routing ideas

Avoid:
- unsupported providers
- "never describe generated images" because Dizzy needs QC inspection when possible

### 9. External Data, Places, And Social Surfaces

These require explicit user intent because they touch external systems or social/public visibility.

#### Place Lookup

source names: GoPlaces
status: watch

Possible edit:

Only if a real Google Places API key and use case exist.

Borrow:
- human-friendly lookup plus JSON output for scripts
- credentials and output modes must be explicit

Avoid:
- preemptive dependencies
- privacy-sensitive location lookup without clear intent

#### Workspace Operator

source names: Google Workspace CLI; Gmail/Calendar/Drive/Sheets/Docs skills
status: reject

Possible edit:

Skipped by user for now.

Borrow:
- explicit action taxonomy: read, draft, write, send/share/delete
- reuse IDs and URLs from context only when verified
- external communication and file sharing need explicit consent

Avoid:
- autonomous email/calendar/file actions
- broad account access without a narrow task

#### Web Search Router

source names: Tavily Web Search; Exa Search; current web discovery skills
status: candidate

Possible edit:

Formalize when to use fast search, deep research, market research, or local docs.

Borrow:
- current public info needs fresh search
- fast discovery and deep synthesis are separate modes
- search outputs should distinguish result, source, date, and inference

Avoid:
- search as a reflex when local files answer the question
- treating retrieved snippets as authority

#### Social Graph Stewardship

source names: Connections Optimizer
status: watch

Possible edit:

Maybe useful for network stewardship if explicitly requested.

Borrow:
- review-first social graph maintenance
- separate prune, prioritize, and outreach

Avoid:
- external social actions without consent
- optimizing relationships into engagement metrics alone

### 10. High-Stakes Economic And Chain Work

These are useful only under slower, explicit, high-risk protocols.

#### Blockchain Implementation Guardrails

source names: Blockchain Developer; NFT Standards
status: watch

Possible edit:

Only relevant for marketplace/token/contract/NFT work with legal/economic guardrails.

Borrow:
- security and test coverage are non-negotiable
- gas optimization and audit tools are verification surfaces
- NFT/token standards should be treated as exact protocol surfaces, not vibes

Avoid:
- casual token/DeFi implementation
- economic action without high-stakes protocol

#### DeFi Template Caution

source names: DeFi Protocol Templates; Solidity Security
status: watch

Possible edit:

Only if contract/protocol work becomes active, with Solidity-specific threat modeling.

Borrow:
- templates can reduce boilerplate
- each protocol category needs a threat model
- access control, initializer exposure, token decimals, SafeERC20, stale oracle checks, and CEI remain common production traps

Avoid:
- calling templates production-ready without audits
- bypassing legal/economic review
- hardcoding 18 decimals or assuming ERC-20 behavior is uniform

### 11. Thin Or Unresolved Signals

These stay parked until better source bodies arrive.

#### System Health Or Attachment Risk

source names: Claude Ally Health; Mental Health Analyzer
status: watch

Possible edit:

None until source body is reviewed and health boundaries are explicit.

Borrow:
- possibly useful only if this means system health checks or user-controlled personal analytics
- if ever used, outputs must be framed as non-clinical support for professional consultation, not diagnosis

Avoid:
- attachment cues
- therapy simulation
- health advice without high-stakes safeguards
- crisis-risk automation without clear safety protocols

#### AI-Native Engineering Doctrine

source names: AI-First Engineering
status: watch

Possible edit:

Scrape later for verification loops, task shapes, and review gates.

Borrow:
- maybe useful for decomposing work into agent-executable units

Avoid:
- "AI-first" as ideology
- losing human authority and repo reality

#### Blueprint Planning

source names: Blueprint
status: watch

Possible edit:

May help convert strange attractors into bounded plans.

Borrow:
- plan shape and promotion path if source body is strong

Avoid:
- over-architecture
- planning that does not produce execution criteria

#### Satori

source names: Satori
status: watch

Possible edit:

None until source body is reviewed.

Borrow:
- unknown

Avoid:
- importing mystique-forward or poorly scoped doctrine on name resonance alone
