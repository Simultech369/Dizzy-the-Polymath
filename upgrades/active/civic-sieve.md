---
id: U-civic-sieve
status: active
tier: 1
owner_surface: future lib/durable_write_policy.mjs
last_reviewed: 2026-06-13
next_action: Implement one shared pre-write privacy and capture gate across durable memory writers, with focused tests.
---

# Civic Sieve

Status: Active implementation item. The mechanism remains narrower than the original civic framing.

## Purpose

Add lightweight checks before durable memory writes or public-facing outputs when civic doctrine, privacy, or trust-zone boundaries may be implicated.

## Checks

Before durable writes:

- obvious secrets or credentials
- private identifiers that should not persist
- trust-zone leakage
- doctrine claims that should remain provisional
- user-sensitive material that lacks future judgment value

The first implementation must enforce privacy, trust-zone eligibility, sensitivity, and durable-value checks. It must not classify political or civic disagreement as a doctrine violation.

Before public/paid output:

- private continuity leakage
- false institutional maturity
- hidden cross-client reuse
- overclaiming automation or governance
- doctrine used as branding instead of mechanism

## Non-Goals

- no heavy classifier stack
- no formal ideology checker
- no generic moralizing layer
- no rewrite of `LEGAL-GUARDRAILS.md`

## Candidate Insertion Points

- memory write paths in `lib/dispatch.mjs`
- `MARKETPLACE_PROTOCOL.md`
- future utility-model memory review
