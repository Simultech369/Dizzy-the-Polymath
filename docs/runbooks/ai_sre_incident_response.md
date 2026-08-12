# AI SRE Incident Response Runbook

This runbook is local-first and evidence-only. Diagnostics classify failures and propose next actions; they do not authorize external execution, commits, pushes, or structural state changes.

## Operating Rules

1. Single Request Autopsy: explain one request from ingress to response, including where it was accepted, rejected, delayed, routed, degraded, or recorded.
2. Durable Write Roles: every durable write is operational state, evidence receipt, human-governed memory, fixture, or scratch.
3. Runtime Boundary Separation: separate identity, authorization, validation, execution, persistence, and evidence emission.
4. Failure Taxonomy: classify every failure as ingress, auth, validation, routing, provider, persistence, retrieval, review-loop, or operator-gate.
5. Distributed Discipline without Sprawl: prefer explicit local state, bounded retries, deterministic fixtures, and operator-visible failure classes.
6. Learning Loop: every incident ends with a no-op explained, fixture added, gate tightened, runbook updated, outcome memory recorded, or backlog item created.

## Ingress

Use this class for rate limits, token budget pressure, idempotency lease conflicts, replay protection, request queue pressure, and 408/409/429 responses.

First checks:
- Confirm the route, method, status code, and request id.
- Inspect ingress budget, replay lease, and idempotency state before retrying.
- Prefer a fixture when the same burst or duplicate-key behavior repeats.

## Auth

Use this class for 401/403 responses, missing operator token, expired dashboard session, invalid capability scope, or cloud execution attempted without permission.

First checks:
- Verify the caller scope without logging tokens or secrets.
- Confirm dashboard routes require a session and non-dashboard APIs require the correct bearer/capability token.
- Treat failed auth as a boundary success unless the route should have been reachable.

## Validation

Use this class for malformed JSON, missing required fields, invalid model ids, unsupported request shapes, and rejected prompt/output envelopes.

First checks:
- Capture the schema field that failed.
- Add a narrow fixture for the rejected shape.
- Keep private body text out of diagnostic receipts.

## Routing

Use this class for missing routes, model selector drift, route allowlist mismatch, fallback path mismatch, and unknown model choices.

First checks:
- Compare dashboard/client route usage against server allowlists.
- Confirm model overrides are server-authorized and fail closed.
- Check whether the router receipt explains the selected or blocked model.

## Provider

Use this class for local Ollama outages, provider HTTP errors, timeouts, 429s, bad model slugs, empty responses, and backend reachability failures.

First checks:
- Run `npm run review:diagnose-backend -- --no-probe --error "<redacted error>"` when a provider error is available.
- Verify exact provider, base URL host, model slug, trust zone, and cloud approval posture.
- Do not mark a provider lane review-usable until it is callable, JSON-valid, and quality-valid.

## Persistence

Use this class for receipt write failures, malformed JSONL rows, SQLite WAL lock starvation, interrupted writes, and snapshot checksum mismatch.

First checks:
- Identify the durable write role: operational state, evidence receipt, human-governed memory, fixture, or scratch.
- Check permissions, parent directory existence, atomic-write behavior, and malformed row counts.
- Keep generated receipts out of commit material unless a fixture explicitly requires them.

## Retrieval

Use this class for golden retrieval regressions, stale memory graph results, missing expected snippets, metadata filter drift, and context tree mismatch.

First checks:
- Run `npm run eval:retrieval-golden` or `npm run check:eval-gate`.
- Inspect misses and decide whether the fix is corpus, query, scoring, or threshold.
- Add deterministic retrieval fixtures before promoting a recall change.

## Review Loop

Use this class for review cycle deadlocks, missing partial receipts, malformed reviewer JSON, harness timeout, unavailable reviewer lanes, and disagreement loops without state transition.

First checks:
- Inspect latest review cycle state transition.
- Preserve partial receipts and classify unavailable model lanes separately from failed reviews.
- End with reject, quarantine, split, fixture-required, ready-for-review, or ready-for-push.

## Operator Gate

Use this class when automation has evidence but lacks authority: push approval, cloud execution approval, structural state changes, promotion gates, or hallucination-spike response.

First checks:
- Compare claims against receipts and eval output.
- Block promotion if evidence is stale, generated, missing, or contradicted.
- Ask Simul for explicit approval before external actions or push.
