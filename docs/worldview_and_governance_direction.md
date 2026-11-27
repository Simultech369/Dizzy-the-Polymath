# Worldview and Governance Direction

Status: Constitutional Background Note

## Orientation

Dizzy is built around anti-extraction, local operator agency, bounded memory retention, and legible governance. Those principles guide engineering choices (loopback-first binding, explicit trust zones, expiring memory, human approval on high-stakes actions, and tamper-evident receipts) rather than serving as a claim that political-economic conditions outside the software have already changed.

## Practical Design Translation

- **Anti-extraction -> Trust zones & expiring memory**: `paid_public` and `outside_contact` default to ephemeral or fresh-context handling; private records (`private_self`) are never silently merged into outward-facing surfaces.
- **Accountability over infinite autonomy -> Explicit state machines & HITL**: Multi-step workflows pause at `waiting_for_approval` rather than acting irreversibly in the background.
- **Legible claims -> Public Truth Language**: Documentation and UI surfaces distinguish receipt-verified local facts, rehearsals, samples, and unverified routes (see [Public Truth Language](public_truth_language.md) and [Positioning and Doctrine](positioning_and_doctrine.md)).
