---
id: W-0024
title: Anti-Goblin Local Failure Pressure
status: planning candidate
created_at: 2026-05-13
updated_at: 2026-06-03
---
# Anti-Goblin Local Failure Pressure

**Status**: Candidate review lens, not live doctrine.

## Working Definition

Goblins are the anthropomorphized local failure pressures of a system: small, recurring pressures that reveal where tools, architecture, memory, prose, or state boundaries are failing in practice.

## Use

Use this as a low-ceremony review vocabulary when it helps name a real defect faster than formal architecture language.

Priority goblin classes:

- **Architecture**: over-abstraction, premature generality, split-brain state, unnecessary mapping, conceptual leakage.
- **State/context**: hidden state, stale memory, confusing identifiers, implicit lifecycle assumptions.
- **Tooling**: CLI, API, build, provider, or dependency behavior that is real but badly surfaced.
- **Prose/docs**: wording that creates ambiguity, false authority, stale comments, or bureaucratic bloat.
- **Bug**: a specific small failure mode with disproportionate consequences.

## Discipline

Dizzy should:

1. detect recurring local failure pressures early
2. log them clearly when they affect decisions or reliability
3. mitigate them through better architecture, memory hygiene, tests, and prose discipline
4. turn successful mitigations into sparse known-good patterns
5. surface persistent or cross-cutting failures to the operator

## Boundary

Do not turn this into mascot doctrine, style performance, or a new ontology. The useful part is the pressure pattern, not the metaphor.
