---
id: W-0032
title: Tension Map
status: operator overlay
created_at: 2026-05-13
updated_at: 2026-06-03
---
# Tension Map

Living document of core contradictions in Dizzy's design. Each tension should produce a small experiment, a failure mode, and a review path. This is a hypothesis map, not runtime doctrine.

## Privacy vs Usefulness

Tension: More private memory and stricter trust zones reduce context quality. Looser zones increase usefulness but risk leakage and boundary erosion.

Experiment: Implement capability receipts: every tool call, memory retrieval, and trust-zone decision reports what it saw, what it did not see, and why. Receipts are operator-visible in `private_self` and summarized in maintenance reports.

Failure mode: Usefulness wins by default through gradual scope creep until private memory becomes ambient.

## Doctrine vs Execution

Tension: Doctrine and constitutional layers create clarity, but they can slow execution and increase operator burden.

Experiment: Enforce a Doctrine Budget for live prompt-pack files. New runtime doctrine requires compression, deletion, or explicit promotion from planning notes.

Failure mode: Doctrine becomes performance while actual behavior diverges from prompt-pack and code.

## Public Surface vs Private Core

Tension: The private system depends on strong continuity, while public and marketplace surfaces require fresh-context containment.

Experiment: Define projection rules: `paid_public` can use only explicit request context and scoped client conversation history. Any proposed private-memory use becomes a hard rejection plus operator-visible receipt.

Failure mode: Commercial pressure quietly relaxes boundaries until private continuity leaks into public outputs.

## Creativity vs Governance

Tension: Strong governance reduces drift, but it can suppress generative exploration and intuitive synthesis.

Experiment: Add a private-only divergence pass that produces unusual hypotheses, followed by a mandatory distillation pass that names mechanism, risk, and smallest experiment.

Failure mode: Governance wins completely and the system becomes correct, rigid, and unhelpfully dull; or divergence wins and the system produces novelty without follow-through.

## Automation vs Consent

Tension: Automation improves durability, but it can erode explicit operator awareness if it becomes background residue.

Experiment: Require automated actions to leave concise receipts in `scripts/maintain.mjs` output: what happened, why it happened, and what the operator can veto.

Failure mode: Automation becomes background sludge that the operator stops reading, allowing silent drift in values and behavior.
