# External Gateway Posture

Dizzy is not trying to win by being the broadest generic LLM gateway. Generic routers, provider proxies, and model fan-out services are useful infrastructure, but they sit below Dizzy's control-plane boundary.

The operating rule is capability-first:

- Prompt-facing and UI-facing surfaces describe capability, not aspirational model slugs.
- Execution-facing code resolves the best policy-permitted route available on the current surface.
- Receipts record the requested route, selected route, applied effort, downgrade reason, fail-closed reason, and whether a provider was actually invoked.

## Adapter Boundary

External gateway projects and provider routers may become adapters only after they pass the same local admission rules as any other route:

- fresh surface-bound route evidence
- explicit trust-zone and sensitivity boundary
- no cross-zone or cross-client cache reuse
- bounded attempts, cancellation, and usage accounting
- structured error states instead of silent fallback
- receipt projection that distinguishes planned, attempted, selected, and provider-reported routes

An external gateway can provide reach. It does not provide authority. A gateway result remains untrusted provider output until it is checked by Dizzy's local policy layer and, where promotion is requested, by the offline Council verification layer.

## Pattern Intake

External routing projects are pattern sources only until license, provenance, and clean-room boundaries are reviewed. Do not copy implementation details, command vocabulary, dashboards, prompt text, or distinctive UX flows into this repo without a documented provenance review.

Useful ideas to compare:

- route capability catalogs
- fallback and health-check semantics
- cost and latency telemetry
- provider adapter contracts
- operator-facing routing status

Avoid importing:

- model labels as product promises
- hidden provider retries that bypass local budgets
- global semantic caches without trust-zone and sensitivity bindings
- public claims that a route is live, verified, or production-ready without a current receipt

## Public Language

The public framing should stay narrow and honest:

> Dizzy is a local-first control plane for memory, trust zones, receipts, and capability-first routing. It can integrate model gateways as provider surfaces, but it does not treat provider reach as verification authority.

This prevents generic gateway projects from turning Dizzy into a race for provider coverage. The distinctive work here is the boundary around routing: memory, policy, evidence, and receipts decide what a route is allowed to mean.
