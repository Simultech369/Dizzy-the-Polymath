# Dashboard Route and Mutation Matrix

Status: Codex planning artifact
Snapshot: `main` at `62acf21b5a0f5e4d811cc9cebb6536931457933b`, matching `origin/main`
Role boundary: Codex documents route contracts and acceptance criteria. Antigravity remains final implementer.

## Purpose

This matrix reconciles the dashboard UI, `lib/dashboard.mjs`, and `agent_server.mjs` route gate/fallback behavior. It is designed to prevent three failure classes before HUD promotion:

- displayed controls calling routes that are not authorized by the session gate,
- high-impact routes mutating state without preview, confirmation, or receipts,
- fallback route lists drifting from the real dashboard route registry.

External reviewer artifacts and UI symbolism cannot authorize mutation. Route authority must come from explicit server-side contracts, exact targets, same-origin or bearer authorization, and durable receipts where state can change.

## Route Gate Summary

Dashboard routes are guarded twice:

1. `agent_server.mjs` global auth middleware allows a dashboard session only when `isDashboardRoute(req.path)` returns true.
2. `lib/dashboard.mjs` `dashboardAccessGuard` then enforces local loopback, no forwarded headers, private trust zone, dashboard session or master bearer, and same-origin mutation for non-GET methods unless master bearer is used.

Current drift:

- `lib/dashboard.mjs` registers routes that are not listed in `agent_server.mjs` `isDashboardRoute`.
- `agent_server.mjs` fallback routes do not cover the newer bridge, friction, containment, scenario, prune, and receipt routes.
- A dashboard session may fail before `dashboardAccessGuard` for routes missing from `isDashboardRoute`, because global auth only exempts known dashboard paths.

## Route Registry Drift

| Route | Registered in `lib/dashboard.mjs` | Listed by `agent_server.mjs isDashboardRoute` | Fallback Registered | Disposition |
| --- | --- | --- | --- | --- |
| `GET /dashboard/login` | yes | yes | yes | aligned |
| `POST /dashboard/session` | yes | yes | yes | aligned |
| `POST /dashboard/logout` | yes | yes | yes | aligned |
| `GET /dashboard` | yes | yes | yes | aligned |
| `GET /assets/dashboard.js` | yes | yes | yes | aligned |
| `GET /assets/dashboard-login.js` | yes | yes | yes | aligned |
| `GET /api/dashboard-data` | yes | yes | yes | aligned |
| `GET /api/dashboard-query` | yes | yes | yes | aligned |
| `GET /api/operator-continuity` | yes | yes | yes | aligned |
| `GET /api/operator-continuity/export` | yes | yes | yes | aligned |
| `GET /api/operator-continuity/audit` | yes | yes | yes | aligned |
| `POST /api/operator-continuity/delete` | yes | yes | yes | aligned but high-impact |
| `GET /api/operator/hardware-status` | yes | yes | yes | aligned |
| `GET /api/operator/consensus-map` | yes | yes | yes | aligned |
| `GET /api/operator/sandbox-preflight` | yes | yes | yes | aligned |
| `POST /api/operator/signoff` | yes | yes | yes | aligned but auto-resolution coupling exists in UI |
| `POST /api/operator/veto` | yes | yes | yes | aligned |
| `POST /api/operator/run-simulation` | yes | yes | yes | aligned |
| `POST /api/operator-execute` | yes | yes | yes | aligned and high-impact |
| `GET /api/operator/quarantined-bridges` | yes | no | no | registry drift |
| `POST /api/operator/quarantined-bridges/accept` | yes | no | no | registry drift and high-impact |
| `POST /api/operator/quarantined-bridges/reject` | yes | no | no | registry drift and destructive |
| `GET /api/operator/friction-telemetry` | yes | no | no | registry drift |
| `POST /api/operator/resolve-containment` | yes | no | no | registry drift and high-impact |
| `POST /api/operator/run-scenario-simulation` | yes | no | no | registry drift and bounded-execution risk |
| `POST /api/operator/prune-continuity` | yes | no | no | registry drift and destructive |
| `GET /api/operator/prune-receipts` | yes | no | no | registry drift |

Acceptance criterion:

- Define one authoritative route registry used by `isDashboardRoute`, fallback registration, dashboard registration, and route tests.

## Dashboard UI Call Matrix

| UI Call Site | Method/Route | Auth and Origin Requirement | State Touched | Reversible | Receipt/Audit | Current Risk |
| --- | --- | --- | --- | --- | --- | --- |
| Initial load | `GET /api/dashboard-data` | dashboard session or master bearer, loopback, private zone | reads prompt sources, memory docs, friction ledger; runs isolated one-step simulation | yes | no receipt needed | read endpoint runs simulation and should not write checkpoints per poll |
| Search | `GET /api/dashboard-query?q=` | dashboard session or master bearer, loopback, private zone | reads markdown index | yes | no receipt needed | low |
| Continuity list | `GET /api/operator-continuity` | dashboard session or master bearer, loopback, private zone | reads execution/conversation/deletion logs | yes | no receipt needed | low |
| Continuity export | `GET /api/operator-continuity/export` | dashboard session or master bearer, loopback, private zone | reads retained continuity | yes | no receipt needed | ensure private export remains local-only |
| Continuity audit | `GET /api/operator-continuity/audit` | dashboard session or master bearer, loopback, private zone | reads local logs/receipts | yes | no receipt needed | proof language must remain best-effort |
| Continuity revoke | `POST /api/operator-continuity/delete` | same-origin dashboard session or master bearer | deletes conversation file, removes history rows, removes matching quarantine bridges, rewrites accepted bridges, removes friction rows, appends deletion log | partially irreversible | deletion row only when something removed | needs preview -> explicit confirmation -> detailed receipt |
| Operator execute | `POST /api/operator-execute` | same-origin dashboard session or master bearer plus request boundary guard | may enqueue/run agent action, may write execution history/conversation continuity/friction/receipts depending payload | depends on action | capability receipt required for durable writes/external actions | high-impact; requires preview, exact target inventory, confirmation, reversibility class, and durable outcome receipt for any payload capable of mutation |
| Hardware status | `GET /api/operator/hardware-status` | dashboard session or master bearer, loopback, private zone | reads hardware/model route/prompt source data | yes | no receipt needed | low |
| Consensus map | `GET /api/operator/consensus-map` | dashboard session or master bearer, loopback, private zone | reads and may normalize/write consensus state via `getConsensusState` | mostly reversible | no receipt | read route can write migration/default state |
| Sandbox preflight | `GET /api/operator/sandbox-preflight` | dashboard session or master bearer, loopback, private zone | runs bounded static sandbox smoke | yes if scratch cleanup works | structured report, not durable receipt | label as static harness only |
| Resolve containment button | `POST /api/operator/resolve-containment` | same-origin dashboard session or master bearer | clears active policy containment state | reversible only by re-triggering anomaly | must record exact non-empty reason in history or receipt | requires explicit reason and must not be called implicitly |
| Prune expired records | `POST /api/operator/prune-continuity` | same-origin dashboard session or master bearer | deletes expired continuity records, may delete conversation files/history/bridges/friction, writes automation receipt | destructive | automation receipt when deletions occur | needs preview -> explicit confirmation -> detailed receipt |
| Operator signoff | `POST /api/operator/signoff` | same-origin dashboard session or master bearer | writes `runtime/consensus_state.json` | reversible by veto/new proposal | state only | UI currently auto-calls containment resolution afterward |
| Operator veto | `POST /api/operator/veto` | same-origin dashboard session or master bearer | writes `runtime/consensus_state.json` | reversible by signoff/new proposal | state only | low, but terminology must avoid cryptographic veto claims |
| Quarantined bridge list | `GET /api/operator/quarantined-bridges` | intended dashboard session or master bearer, but route registry drift may block session | reads `runtime/quarantine/*.json` | yes | no receipt needed | registry drift |
| Accept bridge | `POST /api/operator/quarantined-bridges/accept` | intended same-origin dashboard session or master bearer, but route registry drift may block session | reads bridge JSON, appends/rewrites `runtime/accepted_bridges.json`, deletes bridge file | partially irreversible | message only | needs exact ID validation, path containment, receipt, cache invalidation |
| Reject bridge | `POST /api/operator/quarantined-bridges/reject` | intended same-origin dashboard session or master bearer, but route registry drift may block session | deletes bridge file with `force: true` | destructive | message only | missing target is treated as success; needs tombstone or receipt |
| Friction telemetry | `GET /api/operator/friction-telemetry` | intended dashboard session or master bearer, but route registry drift may block session | reads friction ledger, loads active-policy state | yes | no receipt needed | registry drift |
| Scenario simulation | `POST /api/operator/run-scenario-simulation` | intended same-origin dashboard session or master bearer, but route registry drift may block session | runs path-isolated simulation, temp checkpoint inside OS temp | yes if cleanup works | response only | bound inputs: steps, integers, option counts, CPU/cache |
| Static simulation | `POST /api/operator/run-simulation` | same-origin dashboard session or master bearer | runs bounded static sandbox escape harness | yes if scratch cleanup works | structured report, not durable receipt | label as static harness only |
| Prune receipts | `GET /api/operator/prune-receipts` | intended dashboard session or master bearer, but route registry drift may block session | reads `runtime/automation_receipts.jsonl` | yes | returns receipts | registry drift |
| Download audit report | client-only blob from `GET /api/dashboard-data` and `GET /api/operator/consensus-map` | browser session only | downloads local browser file | yes | generated JSON includes disclaimer | must not imply tamper-proof evidence |

## Direct Agent Continuity Routes

These are outside the dashboard UI but affect the same mutation boundary.

| Route | Method | Auth | State Touched | Reversible | Receipt/Audit | Current Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/agent/execute` | POST | master token or scoped execute token; request boundary audit guard | execution history, conversation continuity, queues/receipts depending mode | depends | capability receipt and boundary audit | high-impact but existing route boundary is separate from dashboard |
| `/agent/continuity` | DELETE | master token unless no auth configured | deletes continuity via `deleteClientContinuity` | partially irreversible | deletion log if something removed | same preview/confirmation/receipt gap |
| `/agent/continuity/export` | GET | master token unless no auth configured | reads continuity | yes | response only | low |
| `/agent/continuity/prune` | POST | master token unless no auth configured | deletes expired continuity and writes automation receipt | destructive | automation receipt | same preview/confirmation/receipt gap |

## Accepted Fix Order

1. Add one authoritative dashboard route registry.
2. Use the registry for:
   - `agent_server.mjs` `isDashboardRoute`,
   - dashboard fallback registration,
   - `lib/dashboard.mjs` route registration,
   - route regression tests.
3. Split dashboard routes into read-only, bounded execution, and destructive mutation classes.
4. Make read-only dashboard routes reachable through the real loopback login-cookie flow.
5. Add preview/confirmation/receipt semantics before promoting destructive routes.
6. Apply the same mutation contract to generic operator execution whenever a payload can perform durable write, deletion, queueing, service start, or external action.
7. Only after this, promote HUD controls and hotkeys.

## Generic Execution Boundary

Any execution request capable of durable write, deletion, queueing, service start, or external action requires:

- server-computed preview before execution,
- explicit confirmation bound to that preview,
- exact target validation,
- reversibility classification,
- durable receipt including partial failures,
- no authorization inherited from symbolic state, signoff, containment state, or UI visibility alone.

No executable payload is enabled unless the server can state exactly what it will touch before confirmation and return the result after execution.

## Read-Route Rule

A route labeled read-only must not create directories, write defaults, normalize state, stage bridges, persist simulation checkpoints, or prime a later mutation. If migration is necessary, expose it as an explicit mutation route with preview, confirmation, and receipt.

## Minimum Route Tests

Use a real loopback server and dashboard login cookie, not only direct function calls.

| Test | Requirement |
| --- | --- |
| Route registry completeness | Every registered dashboard route appears in `isDashboardRoute` and fallback registration. |
| Dashboard session GETs | Login cookie can reach every read-only route. |
| Read-route zero writes | Every route labeled read-only has a pre/post runtime inventory proving it creates no defaults, reports, checkpoints, quarantine files, or migrations. |
| Dashboard session POSTs | Same-origin login-cookie POST can reach allowed mutation routes. |
| Cross-origin POSTs | Non-same-origin POST without master bearer is rejected. |
| Master bearer override | Master bearer can call routes without dashboard cookie. |
| Generic execution preview | Mutating operator-execute payloads return exact targets and reversibility before execution. |
| Missing bridge target | Accept/reject for a missing bridge returns `target not found`, not success. |
| Bridge ID format | Bridge IDs must match exact expected hash format before path construction. |
| Resolve containment | Missing/empty reason is rejected; valid reason is persisted exactly in a durable history/receipt entry. |
| Signoff isolation | Operator signoff does not call containment resolution. |
| Prune/delete preview | Destructive continuity routes support preview before execution. |

## Open Questions for Antigravity

- Should `GET /api/operator/consensus-map` be allowed to normalize/write missing consensus state, or should read routes be purely read-only?
- Should bridge acceptance move accepted bridge data or copy it with a tombstone left behind?
- Should rejected bridge files be deleted, tombstoned, or moved into a rejection ledger?
- Should dashboard destructive routes require typed confirmation, per-action confirmation, or a session-level elevated mode?
- Should scenario simulation accept arbitrary step counts, or cap and validate all numeric inputs at the route boundary?

## Stop Conditions

Stop implementation and report if:

- a route appears in UI but not in the authoritative registry,
- a destructive route lacks preview, confirmation, and receipt,
- a generic execution route can mutate state without preview, exact target validation, confirmation, reversibility classification, and durable receipt,
- a missing target is silently treated as success,
- a route builds paths from unvalidated IDs,
- a GET route writes durable state without an explicit migration label,
- a high-impact hotkey invokes mutation without confirmation.
