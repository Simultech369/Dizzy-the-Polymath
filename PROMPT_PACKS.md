# Prompt Packs

You *can* shove every `.md` into the model, but it usually makes outputs worse:
- more generic
- less responsive
- more brittle

So we use **prompt packs**: curated subsets of files that act as the runtime constitution for chat.

The important repo rule:
- the **default pack** is the live runtime constitution
- if a principle is important enough to govern behavior, it should exist in compact form in the default pack
- longer docs can elaborate, but they should not pretend to be independently constitutional if the compact rule is absent from the default pack

Current center of gravity:
- Dizzy is **continuity-and-judgment first**
- memory supports continuity, but memory alone is not the product core
- public / client-facing behavior is a trust-zone projection of the same underlying assistant, not a separate self
- civic doctrine is political-economic direction, not a claim of conditions already achieved

## Choose a Pack

Set one env var on the **server** process:

- `DIZZY_PROMPT_PACK=core` (default behavior)
- `DIZZY_PROMPT_PACK=creative`
- `DIZZY_PROMPT_PACK=ops`
- `DIZZY_PROMPT_PACK=full`
- Optional runtime style knobs:
- `DIZZY_BREVITY_MODE=normal|lite|full|ultra`
- `DIZZY_AFFECT_MODE=off|attuned`
- `DIZZY_REINFORCEMENT_MODE=neutral|gold_star`

Restart the server after changing env vars.

## Default Pack Files

`core` loads:

- `IDENTITY.md`
- `SOUL.md`
- `HEARTBEAT.md`
- `TOOLS.md`
- `USER.md`
- `PROMPT_CORE.md`
- `PROMPT_MODES.md`

This is the live constitutional center for normal chat behavior.

Why this pack exists:
- it is the smallest set that defines identity, calibration, user alignment, and live response behavior
- key protocol rules should be compressed into this pack rather than delegated to longer secondary docs
- docs outside this pack may refine or explain behavior, but they should not silently govern it

## Protocol Placement

`PROTOCOL.md` remains an important supporting document.

Default rule:
- if a protocol rule is important enough to change live behavior in most conversations, compress it into `PROMPT_CORE.md`
- keep `PROTOCOL.md` for fuller mechanics, examples, and escalation rationale

This keeps the core pack small without losing the deeper logic.

## Trust-Zone Implication

Prompt packs should not create separate selves.

They may change:
- density
- emphasis
- supporting context
- operational posture

They should not change:
- ontology
- core judgment standards
- anti-attachment boundaries
- private/public trust-zone separation

## Pack Intent

### `core`

Best for:
- normal private-assistant use
- reflective discussion
- planning and judgment
- continuity-aware conversation

### `creative`

Best for:
- image ideation
- mascot work
- narrative and style exploration

Add when needed:
- `PROTOCOL.md`
- `LEVERAGE.md`
- `PENGUIN.md`
- `COPPER-INU.md`

### `ops`

Best for:
- runtime operation
- memory maintenance
- governance and safety review
- communication and delivery review

Add when needed:
- `OPERATIONS.md`
- `COMMUNICATION.md`
- `MARKETPLACE_PROTOCOL.md`
- `LEGAL-GUARDRAILS.md`
- `CLIENTS.md`
- `CLIENT_TEMPLATE.md`
- `MEMORY.md`

### `full`

Best for:
- repo review
- structural audits
- deep-context sessions where prompt bloat is an accepted trade-off

Adds a broader but still bounded set of support docs.

## Inspect What's Loaded

- `GET /prompt`
- In Telegram: `/prompt`

## Override Precisely (Advanced)

You can bypass packs and specify an exact comma-separated list:

- `DIZZY_PROMPT_FILES=IDENTITY.md,SOUL.md,HEARTBEAT.md,TOOLS.md,USER.md,PROMPT_CORE.md,PROTOCOL.md`

`DIZZY_PROMPT_PACK` wins if both are set. Unset it to use `DIZZY_PROMPT_FILES`.

## Guidance

- If a principle from a secondary doc keeps mattering, compress it into `PROMPT_CORE.md` or another file already in the default pack.
- Do not solve ambiguity by loading everything.
- Bigger packs are not "more true"; they are just more context-heavy.
- If a doc describes a revenue surface, aesthetic mode, or historical idea, do not let it quietly outrank the continuity-and-judgment core.
