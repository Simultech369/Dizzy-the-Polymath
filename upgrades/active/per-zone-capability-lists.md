# Per-Zone Capability Lists

Status: Accepted - implement soon.

## Goal

Make trust zones enforceable as capability surfaces, not merely prompt instructions.

## Capability Surface

### `private_self`

- Full trusted retrieval: `memory/`, doctrine, topic notes
- Local tools
- Continuity allowed
- Durable memory allowed
- Self-modification disabled by default

### `paid_public` default

- Scoped conversation history only
- No repo/private retrieval
- No durable memory writes
- Ephemeral unless `continuity_mode=client` is explicitly enabled
- Tools limited to safe read/respond behavior
- No hidden borrowing from private context

### `operator`

- Private and paid/public controls
- Manual overrides
- `state.json` sync
- upgrade application
- trust-zone configuration
- privileged local maintenance

## Principle

Even if the model is compromised, actions should remain bounded by code and explicit capability lists, not prompt compliance alone.

## Candidate Insertion Points

- `DESIGN.md` trust-zone section
- `lib/dispatch.mjs`
- `scripts/safety_checks.mjs`
- future capability selector if the tool surface expands

