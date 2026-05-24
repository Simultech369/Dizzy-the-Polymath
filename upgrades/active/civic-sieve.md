# Civic Sieve

Status: Accepted as a minimal guard concept; implementation should stay narrow.

## Purpose

Add lightweight checks before durable memory writes or public-facing outputs when civic doctrine, privacy, or trust-zone boundaries may be implicated.

## Checks

Before durable writes:

- obvious secrets or credentials
- private identifiers that should not persist
- trust-zone leakage
- doctrine claims that should remain provisional
- user-sensitive material that lacks future judgment value

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

