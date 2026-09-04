# Quarantine Defect Receipt: Python Sidecar

**Target:** Python Council Sidecar
**Status:** QUARANTINED; PARTIALLY_REPAIRED_IN_SCRATCH
**Receipt Authority:** `advisory_receipt`
**Date:** 2026-09-04

## Files Reviewed
- `scratch/council_engine/bridge_rehearsal_runner.py`
- `scratch/council_engine/bounty_adversarial_assembly_line.py`

## Original Tamper Behavior Observed
- `bridge_rehearsal_runner.py` only checks that the `payload_sha256` key exists in the JSON payload, but does not actually hash the canonical payload bytes to verify it.
- A tampered payload (changed input title, untouched old hash) resulted in a `VERIFIED_DISPATCH` emission.
- `bounty_adversarial_assembly_line.py` uses a naive string-matching placeholder for clean-room provenance instead of cryptographic or robust heuristic verification.

## Follow-Up Sidecar Probe
- Follow-up inspection of the quarantined sidecar found a hash repair in `bridge_rehearsal_runner.py`: it now removes `bounty_task.payload_sha256`, canonicalizes the remaining payload with sorted keys and compact separators, recomputes SHA-256, and rejects mismatches.
- Probe result: a valid payload routed to `SECURITY_REVIEWER`; a tampered title with the old digest was rejected with no output receipt.
- Authority remains limited: this is sidecar repair evidence, not a Node runtime promotion or public interoperability claim.

## Expected Invariant
- Claimed payload hash MUST bind cryptographically to the canonical payload bytes.
- Full bridge payload integrity MUST live in the bridge contract integrity block, while `bounty_task.payload_sha256` remains the task-level digest.

## Current Failure / Promotion Blockers
- The repaired sidecar hash scope currently overloads `bounty_task.payload_sha256` as the full bridge payload digest, while the Node bounty payload already uses that field as task-level integrity.
- `bounty_adversarial_assembly_line.py` still uses a naive clean-room provenance placeholder.

## Promotion Impact
- Sidecar may propose, but CANNOT attest. The sidecar is blocked from promotion to the primary runtime until these remaining blockers are resolved.
- This receipt can support W-0112 scoping and sidecar repair work. It cannot support public capability claims or runtime promotion.

## Next Acceptable Proof
1. A Node-owned bridge contract fixture that separates bridge payload integrity from bounty-task integrity.
2. A failing regression fixture for payload tampering with reused hash.
3. A sidecar compatibility update that reads `integrity.payload_sha256` rather than overloading `bounty_task.payload_sha256`.
4. A rigorous clean-room provenance gate for bounty patch material.
5. A `promotion_receipt` from the Node council gate before any sidecar mechanism becomes primary runtime authority.

*This receipt turns the sidecar blocker from a chat artifact into reusable evidence, preventing relitigation of the boundary.*
