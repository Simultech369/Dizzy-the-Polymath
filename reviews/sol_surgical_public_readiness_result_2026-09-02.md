## Final verdict: BLOCKED — keep PR #1 draft

The branch itself is clean and synced at `7e967373623b547e25292870c878c9960418c77f`, 0 behind/38 ahead of `origin/main`. The receipt hash and `113/56/2` counts match. However, the current tests do not cover several publication-blocking trust and credibility defects.

### Blockers

1. **A2A callers can escalate into `private_self`.**

   [agent_server.mjs:491](/C:/Users/Josh/clawd/agent_server.mjs:491) lets request JSON override the default `a2a` channel and `from`; the route passes that body at [agent_server.mjs:1223](/C:/Users/Josh/clawd/agent_server.mjs:1223). On loopback, `channel: "local"` becomes `private_self`, enabling repository retrieval and durable memory at [lib/dispatch.mjs:148](/C:/Users/Josh/clawd/lib/dispatch.mjs:148) and [lib/dispatch.mjs:172](/C:/Users/Josh/clawd/lib/dispatch.mjs:172).

   Force `channel: "a2a"`, derive `from` from the validated sender field, and explicitly assign `outside_contact`. Do not permit body overrides. Currently `senderId` is only checked for presence and is not bound to `from`.

2. **Replay/raw-body/sanitization guarantees are incomplete.**

   - [a2a_boundary_guard.mjs:65](/C:/Users/Josh/clawd/lib/a2a_boundary_guard.mjs:65) evicts unexpired nonces when full. A targeted review PoC showed an evicted nonce replay being accepted.
   - [a2a_boundary_guard.mjs:113](/C:/Users/Josh/clawd/lib/a2a_boundary_guard.mjs:113) falls back to `JSON.stringify(req.body)` when raw bytes are unavailable. Because only `express.json` captures raw bytes at [agent_server.mjs:591](/C:/Users/Josh/clawd/agent_server.mjs:591), form-encoded requests can avoid the claimed exact-raw-body property.
   - [a2a_boundary_guard.mjs:23](/C:/Users/Josh/clawd/lib/a2a_boundary_guard.mjs:23) silently leaves markers below depth 16 unsanitized.
   - Reconstructing objects into `{}` at [a2a_boundary_guard.mjs:35](/C:/Users/Josh/clawd/lib/a2a_boundary_guard.mjs:35) allows a `__proto__` property to populate inherited `schema` and `senderId` fields.

   Fail closed when the nonce cache contains only unexpired entries, require JSON plus captured raw bytes, reject excessive nesting/dangerous keys, and require own schema properties. Extend [a2a_boundary_test.mjs](/C:/Users/Josh/clawd/scripts/a2a_boundary_test.mjs:105) for all four cases.

3. **Dashboard “live” telemetry contains hardcoded operational data.**

   [agent_server.mjs:1080](/C:/Users/Josh/clawd/agent_server.mjs:1080) returns hardcoded Pareto accuracy, cost, and latency values. [agent_server.mjs:1089](/C:/Users/Josh/clawd/agent_server.mjs:1089) hardcodes three routes as `CLOSED` and defaults the fourth to `CLOSED`.

   The UI presents these as “Live Route Circuit Breakers” and deterministic health at [dashboard/index.html:1127](/C:/Users/Josh/clawd/dashboard/index.html:1127), and as “empirical verification accuracy” at [dashboard/index.html:1184](/C:/Users/Josh/clawd/dashboard/index.html:1184). The header also hardcodes `W-0066 ISOLATED` at [dashboard/index.html:829](/C:/Users/Josh/clawd/dashboard/index.html:829).

   Remove the fixtures from operational responses, hide them when no evidence exists, or label them unmistakably as static demonstration data. The current dashboard test only confirms route availability and neutral initial HTML; it does not validate telemetry provenance.

4. **The public diff includes an internal, stale handoff packet.**

   `UNIFIED_HANDOFF_PACKET.md` is newly added relative to main and contains 266 absolute `C:\Users\Josh` paths, including 124 `.gemini` paths and three Antigravity brain UUID paths, for example [UNIFIED_HANDOFF_PACKET.md:54](/C:/Users/Josh/clawd/UNIFIED_HANDOFF_PACKET.md:54) and [UNIFIED_HANDOFF_PACKET.md:258](/C:/Users/Josh/clawd/UNIFIED_HANDOFF_PACKET.md:258).

   It also claims the hardening is uncommitted, HEAD is `0238a739`, and the branch is 37 commits ahead at [UNIFIED_HANDOFF_PACKET.md:12](/C:/Users/Josh/clawd/UNIFIED_HANDOFF_PACKET.md:12) and [UNIFIED_HANDOFF_PACKET.md:193](/C:/Users/Josh/clawd/UNIFIED_HANDOFF_PACKET.md:193). Remove this internal packet from the public PR or replace it with a sanitized, repo-relative summary.

   The same pushed-state drift appears in [antigravity_to_codex_handoff_latest.md:5](/C:/Users/Josh/clawd/reviews/antigravity_to_codex_handoff_latest.md:5), [antigravity_to_codex_handoff_latest.md:47](/C:/Users/Josh/clawd/reviews/antigravity_to_codex_handoff_latest.md:47), and [w0068_staging_triage.md:11](/C:/Users/Josh/clawd/reviews/w0068_staging_triage.md:11).

### W-0106 wording

I am not reopening W-0106: treat the Operator’s offline capture as resolved. The documentation must nevertheless distinguish that from repository-verifiable visual evidence.

Currently README, Quickstart, PR text, and `NEXT.md` say proof is pending, while the Antigravity handoff says “PR visual proof is secured” without a path:

- [README.md:36](/C:/Users/Josh/clawd/README.md:36)
- [QUICKSTART.md:112](/C:/Users/Josh/clawd/QUICKSTART.md:112)
- [PR_W0068_DESCRIPTION.md:97](/C:/Users/Josh/clawd/PR_W0068_DESCRIPTION.md:97)
- [NEXT.md:30](/C:/Users/Josh/clawd/NEXT.md:30)
- [antigravity_to_codex_handoff_latest.md:20](/C:/Users/Josh/clawd/reviews/antigravity_to_codex_handoff_latest.md:20)

Use:

> Operator captured the W-0106 walkthrough screenshots offline. No repository path or PR attachment is recorded in this checkout, so this is operator-observed evidence rather than a repository-verifiable launch artifact. W-0106 is operationally resolved.

The readiness test currently mandates the stale “not captured/pending” wording at [public_view_readiness_test.mjs:65](/C:/Users/Josh/clawd/scripts/public_view_readiness_test.mjs:65), so update that test too.

### A2A public wording

Existing README/Quickstart wording correctly rejects public interoperability claims. Strengthen it to:

> `/api/a2a/incoming` is a single-runtime, shared-secret signed JSON ingress proof. It does not prove external peer identity, signed responses, distributed replay protection, or cross-runtime interoperability.

### Verification boundary

`test:public-view-readiness` and `test:dashboard-safety` passed. The server-backed dashboard rerun could not complete in this read-only sandbox because lifecycle middleware attempted to open `runtime/lifecycle_hooks.jsonl`; that was an environment-induced `EPERM`, not counted as a product failure. The worktree remained clean.

Another Antigravity pass is needed, but only a narrow reconciliation pass after the code fixes: update HEAD/push state, unify W-0106 wording, and remove or sanitize internal handoff material. No broad architectural pass is warranted.

