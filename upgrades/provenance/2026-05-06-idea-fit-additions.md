# Idea Fit Additions

Date: 2026-05-06

Purpose: place the next wave of improvement ideas into Dizzy's actual architecture, using `_external/claudia` and Rae Johnson's embodied activism work as additional reference points.

## Verified anchors

### Rae Johnson

Relevant work:

- *Embodied Activism: Engaging the Body to Cultivate Liberation, Justice, and Authentic Connection: A Practical Guide for Transformative Social Change* (North Atlantic Books, 2023)
- *Embodied Social Justice* (Routledge, 2nd ed. 2022)

Why this matters here:

- this is not random slogan material
- it is a coherent body of work around embodiment, social justice, anti-oppressive practice, and how lived bodily experience shapes perception, burnout, relation, and action

### `kbanc85/claudia`

What it adds:

- relationship-aware memory
- commitment tracking
- session reflection extraction
- judgment rule persistence
- provenance-aware local memory
- morning brief / risk surfacing patterns

Constraint:

- source-available, noncommercial licensing
- useful as design inspiration, not a default code import target

## Main take

The new ideas do not all belong in "memory."

They split across at least four different layers:

1. memory epistemics
2. interaction and pacing
3. world-model / structural analysis
4. operational surfacing

That matters because if everything gets forced into the memory layer, the design will become muddy.

## 1. Retrieval priors and the real-world gravity well

This remains a real risk.

Models differ in what they assume first.

One plausible failure mode is:

- unusual real-world material gets treated as meme, hoax, noise, or salience trap
- retrieval then suppresses it before reasoning even starts

This should be treated as an epistemic routing problem, not just a storage problem.

### Best fit in Dizzy

Primary fit:

- memory candidate generation
- retrieval ranking
- provenance display
- contradiction handling

Current insertion points:

- `lib/dispatch.mjs`
- `lib/md_retriever.mjs`
- `lib/memory_graph.mjs`
- future QMD / `memory-wiki` layer from OpenClaw

### Upgrade shape

Add metadata such as:

- `epistemic_class`
- `gravity_weight`
- `evidence_anchor`
- `source_mode`
- `freshness_horizon`
- `contradiction_state`
- `prior_mismatch_risk`

`prior_mismatch_risk` means:

- "a default model prior is unusually likely to dismiss this too early"

That is a cleaner statement than trying to make every model "believe weird things."

The goal is not credulity.
The goal is to stop premature flattening.

## 2. Rae Johnson / embodied activism

This does not fit best as "fact memory."

It fits better as a design influence on how Dizzy handles pacing, burnout, lived experience, and how action quality degrades when bodies are overloaded or dysregulated.

### Best fit in Dizzy

#### A. Heartbeat and interaction pacing

Potential fit:

- `HEARTBEAT.md`
- `skills/memory-discipline/SKILL.md`
- future reflective review skills

Use:

- detect overload, narrowing, urgency inflation, and dissociation from lived constraints
- remind the system that a user can be structurally right but physiologically overloaded

This is not sentimentality.
It is operational realism.

#### B. Memory reflection layer

Potential fit:

- a future `practices` memory category
- future `memory-wiki` namespace for practices / regulation / recovery heuristics

Use:

- preserve what helps Simul stay coherent under load
- track not just beliefs and plans, but successful regulation patterns

Examples:

- what types of pacing reduce over-acceleration
- what kinds of work sequencing reduce cognitive fragmentation
- which interaction styles help restore agency instead of producing collapse framing

#### C. Public / operating surface tone

Potential fit:

- `OPERATING_SURFACE.md`
- marketplace or public-facing explanatory material

Use:

- frame Dizzy as a system that respects embodied limits, not just task throughput
- differentiate from sterile "optimize the human" assistant rhetoric

## 3. Imperialism + domestic class and power relations

This is not primarily a memory mechanic.

It is a structural analysis lens.

The key idea:

- external pressure matters
- domestic class and power relations determine how that pressure lands, mutates, or gets weaponized

This belongs in Dizzy's world-model and political-economy reasoning, not merely in a note pile.

### Best fit in Dizzy

Primary fit:

- `PROMPT_CORE.md`
- `PROMPT_PACKS.md`
- `DESIGN.md`
- durable memory topics

Suggested durable forms:

- `memory/topics/political-economy-lenses.md`
- or a future `memory-wiki` page on structural analysis lenses

### Why this matters operationally

This lens can improve:

- geopolitical interpretation
- labor / capital analysis
- anti-extraction reasoning
- detection of bad causal shortcuts

Example failure mode it helps prevent:

- treating domestic outcomes as entirely imposed from outside
- or treating imperial pressure as irrelevant because local elites also benefit

The stronger frame keeps both alive at once.

## 4. What Claudia contributes

`claudia` is probably most useful as an operating-pattern repo, not as a direct identity model.

Its strongest transferable ideas are not "be like Claudia."
They are small architecture moves.

### Highest-fit imports

#### A. Commitment memory as a first-class type

Very good fit.

Dizzy already thinks in terms of decisions and follow-through, but commitments are not yet a first-class durable memory object in the same way they are in Claudia.

Best fit:

- `lib/dispatch.mjs`
- memory promotion / review flow
- future morning-brief style views

#### B. Judgment extraction from reflection

Very good fit.

Claudia's `judgment.yaml` idea maps well onto Dizzy's repo because this workspace already has explicit governance and operating doctrine.

Best fit:

- future structured companion to `MEMORY.md`
- possibly `state.json`
- possibly `memory/topics/practices-*.md`

Use:

- persist repeat decision rules
- make routing and prioritization less ad hoc over time

#### C. Session briefing injection

Very good fit.

Claudia's startup briefing pattern is a clean way to surface:

- stale commitments
- degraded memory health
- important unresolved items
- system drift

Best fit:

- session bootstrap
- heartbeat summaries
- operator-facing dashboard notes

#### D. Background verification

High value.

Claudia's verification cascade is directly relevant to the gravity-well problem because it separates:

- pending
- verified
- flagged
- contradiction states

Best fit:

- future memory candidate review
- future async memory hygiene job

This is especially useful if Dizzy keeps ingesting raw observations that should not all be treated equally.

#### E. Compound context tools

Very good fit.

Claudia's `memory_deep_context` pattern is a strong reminder that multiple serial recall calls should often be compiled into one deliberate retrieval bundle.

Best fit:

- `lib/dispatch.mjs`
- future QMD / graph / wiki compound retrieval

#### F. Workspace provenance without hard isolation

Very good fit.

Claudia's `workspace_id` choice is elegant:

- provenance is preserved
- recall stays global

That fits Dizzy well because this repo wants continuity without flattening context.

### Medium-fit imports

#### Relationship health / dormant relationship logic

Useful only if Dizzy becomes more people-network aware.

Good for:

- collaborations
- introductions
- operator memory around neglected human threads

Not first priority unless the repo becomes more CRM-like.

#### Passive tool capture

Interesting, but should be adopted carefully.

It can create excellent ambient memory signals.
It can also create too much exhaust.

If used at all, it should be:

- local only
- filtered hard
- tied to explicit relevance classes

### Low-fit or caution areas

#### Executive-assistant worldview

This does not map cleanly.

Dizzy is not fundamentally an executive productivity wrapper.
It is a bounded sovereign collaborator with a thicker constitutional and political-economic layer.

Borrow the machinery, not the persona.

#### Relationship-first ontology

Useful in places, but too narrow as the master organizing principle.

Dizzy also needs:

- doctrine
- structural lenses
- practices
- governance memory
- model-routing knowledge

not only people and commitments.

## Suggested next experiments

### 1. Add a first-class commitment memory class

This is probably the highest leverage import from Claudia that does not require worldview drift.

### 2. Add a compact startup briefing

Show:

- stale commitments
- memory health
- unresolved review items
- drift flags

### 3. Add a structured judgment / practices layer

Not just facts.
Not just topics.

A layer for:

- decision rules
- pacing rules
- anti-drift heuristics
- agency-preserving habits

### 4. Add async verification states to promoted memories

Even before a full wiki layer, memories can move through:

- `pending`
- `verified`
- `flagged`
- `contradicted`

### 5. Keep embodied-activism influence in the regulation layer

Do not force it into "belief graph" semantics.

Use it to improve:

- pacing
- burnout resistance
- reflective quality
- agency under load

## Best synthesis so far

If the current stack keeps evolving, the strongest composite path looks like:

- OpenClaw-native memory recalibration for retrieval and provenance
- Claudia-style commitment and judgment surfacing
- gravity-well epistemic metadata for anomaly-resistant recall
- embodied-activism influence on pacing and reflective practices
- structural political-economy lenses stored as durable world-model memory

That is more coherent than treating all of this as one giant "memory upgrade."
