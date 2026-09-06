# Dizzy Public-Safe Collaborator Review Packet

Status: `PUBLIC_SAFE` / `COLLABORATOR_SAFE`  
Audience: trusted technical reviewer or prospective collaborator  
Scope: repository-facing review only, with private/local evidence summarized rather than copied

## Current Sanitized Snapshot

- Branch inspected before this packet was created: `main`
- HEAD inspected before this packet was refreshed: `5fdfcdd7 feat(bridge): W-0117 integrate scanner CLI with council bridge rehearsal runner and portable quarantine resolution`
- Working tree inspected before this packet was refreshed: tracked clean; collaborator review packets remain untracked local artifacts
- Latest sanitized council result: `VERIFIED_PASSED`
- Latest sanitized council surface: 115 syntax targets, 57 execution suites, 2 governance checks (`2026-09-05T21:42:34.417Z`)

This packet does not claim hosted production readiness, public cross-runtime A2A interoperability, or that quarantined sidecar code is runtime authority.

## Excluded From Review Packet

Do not include or request these in the collaborator packet:

- `.env*`
- `state.json`
- `memory/`
- raw `reviews/` contents unless a file has been explicitly sanitized for publication
- `.codex/`
- `node_modules/`
- private handoffs or machine-local scratch paths

## Primary Review Goals

1. Confirm README, NEXT, and design docs make accurate public claims.
2. Confirm the dashboard is framed as local, opt-in, and non-production.
3. Confirm A2A ingress is described as a local signed boundary proof, not public interoperability.
4. Confirm `CognitiveMemoryEngine` and `MemoryWikiAdapter` remain separate in responsibility and storage authority.
5. Confirm focused test surfaces are discoverable, runnable, and mapped to the claims they support.

## Public-Safe Files To Review

Core public docs:

- `README.md`
- `QUICKSTART.md`
- `RUNBOOK.md`
- `NEXT.md`
- `DESIGN.md`
- `MEMORY_OWNERSHIP.md`
- `THREAT_MODEL_A2A.md`
- `docs/memory_wiki_examples.md`
- `docs/node_python_council_bridge_contract.md`
- `docs/sidecar_sandbox_and_egress_boundary.md`

Runtime and boundary surfaces:

- `agent_server.mjs`
- `dashboard/index.html`
- `dashboard/dashboard.js`
- `dashboard/dashboard-login.js`
- `lib/dashboard.mjs`
- `lib/a2a_boundary_guard.mjs`
- `lib/a2a_mailbox_bridge.mjs`
- `lib/cognitive_memory_engine.mjs`
- `lib/memory_wiki_adapter.mjs`
- `lib/node_python_council_bridge_contract.mjs`
- `scripts/job_board_scanner.mjs`
- `scripts/rehearsal_dizzy_to_council_bridge.mjs`

Focused deterministic tests:

- `scripts/public_view_readiness_test.mjs`
- `scripts/dashboard_public_surface_test.mjs`
- `scripts/dashboard_safety_harness_test.mjs`
- `scripts/a2a_boundary_test.mjs`
- `scripts/a2a_mailbox_bridge_test.mjs`
- `scripts/cognitive_memory_engine_test.mjs`
- `scripts/memory_wiki_adapter_test.mjs`
- `scripts/node_python_council_bridge_contract_test.mjs`
- `scripts/job_board_scanner_test.mjs`
- `scripts/job_board_scanner.mjs --bridge-rehearsal`
- `scripts/bounty_hunter_engine_test.mjs`
- `scripts/oss_council_audit.mjs`

## Claim Boundaries To Preserve

- Dizzy is a local-first control plane around model routing, tools, memory, receipts, dashboard surfaces, and verification.
- The dashboard is opt-in and local; it is not a hosted production console.
- `/api/a2a/incoming` is a single-runtime, shared-secret signed JSON ingress proof.
- The current A2A route does not prove public peer identity, signed response federation, distributed replay protection, or cross-runtime interoperability.
- The Python Council sidecar remains quarantined; sidecar proofs can guide design but do not become runtime authority without a Node council promotion receipt.
- Memory wiki examples are test-derived examples; they do not claim a live checked-in `memory/wiki/` corpus.
- Raw local receipts are summarized here; this packet intentionally avoids copying `reviews/` evidence wholesale.

## README / NEXT / Design Review Notes

Reviewer focus:

- Check that `README.md` opens with local-first, receipt-bound framing.
- Check that the "What Runs Today" table maps each claim to an implemented file or focused test.
- Check that "What This Is Not" still rules out a finished commercial product and hosted launch claims.
- Check that `NEXT.md` keeps open work separate from completed work.
- Check that W-0091 keeps the Python Council sidecar quarantined until promotion gates are independently satisfied.
- Check that W-0112 through W-0117 remain framed as bridge/sidecar hardening and rehearsal verification, not runtime promotion.
- Check `DESIGN.md` decisions D-0043 through D-0046 for receipt authority, digest-scope boundaries, sandbox/egress gates, and scanner bridge rehearsal pipeline.

Known review sensitivity:

- If wording says "ready for serious collaborator review," it should remain tied to local deterministic proof and should not drift into launch readiness.
- If wording mentions sidecar verification, it should name the authority level and preserve quarantine.

## Dashboard Readiness Review Notes

Reviewer focus:

- Confirm the dashboard is disabled unless `DIZZY_DASHBOARD_ENABLED=1` is set before start.
- Confirm dashboard routes are local/operator surfaces, not public hosted APIs.
- Confirm dashboard cookies are scoped to dashboard routes and do not authorize general runtime APIs.
- Confirm dashboard API responses use minimized projections and avoid exposing repository-local paths.
- Confirm neutral startup, auth/session behavior, route wiring, and public-surface copy are covered by focused tests.

Relevant focused gates:

```powershell
npm run test:dashboard-public-surface
npm run test:dashboard-safety
npm run test:public-view-readiness
```

Manual dashboard review should be treated as supplemental unless a screenshot or browser receipt is explicitly captured and sanitized.

## A2A Ingress Boundary Review Notes

Reviewer focus:

- Confirm the signed HTTP ingress route fails closed without a dedicated secret.
- Confirm exact raw JSON bytes are used for HMAC SHA-256 verification.
- Confirm timestamp freshness, nonce replay rejection, signature format, schema checks, and sender checks are deterministic.
- Confirm prompt-marker sanitization occurs only after signature verification.
- Confirm docs do not claim public A2A interoperability yet.

Relevant focused gate:

```powershell
npm run test:a2a-boundary
```

Related horizon doc:

- `THREAT_MODEL_A2A.md` distinguishes local signed ingress from future public/hosted A2A networking requirements.

## Cognitive Memory / Wiki Review Notes

Reviewer focus:

- Confirm `lib/cognitive_memory_engine.mjs` owns memory lifecycle policy, scoring, classification, retrieval, reconciliation, decay, and A2A memory envelopes.
- Confirm `lib/memory_wiki_adapter.mjs` owns path-confined Markdown/frontmatter I/O only.
- Confirm `MEMORY_OWNERSHIP.md` names the writer for each durable memory-like surface.
- Confirm `docs/memory_wiki_examples.md` uses proof-bound examples and avoids implying public publication of private memory.
- Confirm memory paths and live memory contents are not copied into public review artifacts.

Relevant focused gates:

```powershell
npm run test:cognitive-memory
npm run test:memory-wiki
npm run check:docs
```

## Focused Test Surface

Recommended reviewer command set from repo root:

```powershell
npm run check:docs
npm run check:next
npm run test:public-view-readiness
npm run test:dashboard-public-surface
npm run test:dashboard-safety
npm run test:a2a-boundary
npm run test:a2a-mailbox
npm run test:cognitive-memory
npm run test:memory-wiki
npm run test:node-python-bridge-contract
npm run test:job-board-scanner
node scripts/job_board_scanner.mjs --bridge-rehearsal
npm test
npm run check:council
```

Expected current aggregate when all registered council gates pass:

- `VERIFIED_PASSED`
- 115 syntax targets
- 57 execution suites
- 2 governance checks

## Reviewer Questions

- Are public claims tied to concrete files, tests, or sanitized receipt summaries?
- Does any wording imply hosted production readiness or public A2A interoperability?
- Are dashboard states sober, inspectable, and local/operator-scoped?
- Is the memory/wiki split obvious enough for future contributors to avoid merging policy logic with file I/O?
- Do tests cover the claim boundaries reviewers are being asked to trust?
- Is any sidecar or scratch evidence accidentally framed as runtime authority?

## Suggested Review Output Format

Use concise findings with severity and file references:

```text
[P1/P2/P3] Title
File: path/to/file
Issue: what is inaccurate, risky, or overclaimed
Why it matters: boundary or user-impact
Suggested fix: smallest safe wording/code/test change
```

No secrets, local private paths, memory contents, raw receipt dumps, or private handoff excerpts should be included in the review output.
