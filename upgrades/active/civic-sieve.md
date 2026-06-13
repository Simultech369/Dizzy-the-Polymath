---
id: U-civic-sieve
status: integrated
tier: 1
owner_surface: lib/durable_write_policy.mjs
last_reviewed: 2026-06-13
next_action: Keep the shared gate narrow; expand PII detection or output checks only with concrete failure evidence and focused tests.
---

# Civic Sieve

Status: Integrated for durable writes. The mechanism remains narrower than the original civic framing.

## Purpose

Add lightweight checks before durable memory writes or public-facing outputs when civic doctrine, privacy, or trust-zone boundaries may be implicated.

## Checks

Before durable writes, the integrated gate checks:

- obvious secrets or credentials
- trust-zone leakage
- explicit non-persistent sensitivity classes
- material that lacks future judgment value

The implementation does not attempt broad PII classification. Callers must label sensitive material that patterns cannot safely identify. It does not classify political or civic disagreement as a doctrine violation.

Before public/paid output:

- private continuity leakage
- false institutional maturity
- hidden cross-client reuse
- overclaiming automation or governance
- doctrine used as branding instead of mechanism

These output checks remain candidate concerns, not part of W-0042 or a claim of runtime enforcement.

## Non-Goals

- no heavy classifier stack
- no formal ideology checker
- no generic moralizing layer
- no rewrite of `LEGAL-GUARDRAILS.md`

## Integrated Surfaces

- remembered-memory writes and auto-memory candidate staging in `lib/dispatch.mjs`
- friction entries in `lib/friction_ledger.mjs`
- trajectory entries in `lib/trajectories.mjs`

## Acceptance Evidence

- blocked trust zones fail before writes
- `do_not_persist`, `ephemeral`, and `transient` sensitivity classes fail before writes
- obvious API credentials fail before writes
- valid private project decisions remain writable
- writer-boundary tests confirm blocked friction and trajectory files are not created
- `npm run check:safety` and `npm run maintain` pass
