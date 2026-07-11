# Production Readiness

Purpose: make hosted/client-facing requirements concrete before any public surface is treated as production.

This file is an operational gate, not a claim that every production capability already exists. Each area below names the current project surface, the production requirement, and the proof that should exist before launch.

## Readiness Status

| Area | Current project surface | Production requirement | Proof before launch |
| --- | --- | --- | --- |
| Minified front end | No dedicated front end exists yet; current public surface is the README plus local HTTP endpoints | Any future UI must ship a production build with minified assets, no public secrets, and no public source maps unless intentionally gated | Build artifact review, source-map setting, browser bundle secret scan |
| Database | No user database exists yet; Redis is used for queue/runtime infrastructure, and memory is local-file based | If a user/tenant database is added, RLS or equivalent row/tenant isolation must be enabled on authenticated reads and writes | Migration/policy reference, auth-scoped read/write test, service-role key kept server-only |
| Operational store authority | Redis is the live queue authority; SQLite is an experimental v0 smoke-test sidecar | Before any store pivot, one authority per state class is named and the old path has an export, rollback, migration, and deprecation plan | `DESIGN.md` decision, migration rehearsal, rollback rehearsal, dual-write failure test or explicit no-dual-write rule |
| Version control | Git repo with local maintenance discipline | Main branch protection, reviewed commits for deploys, tagged releases, no committed secrets, and a rollback point | Protected-branch settings, release tag, secret scan, deploy commit hash |
| APIs | Express runtime with `/health`, `/prompt`, `/governance`, opt-in `/memory/graph`, auth support, redacted boundary receipts, and safety checks | Auth, input validation, explicit public/private route boundaries, CORS policy, request size limits, and structured errors | Smoke test, route inventory, auth test, CORS config, API error sample |
| Hosting and deployment | Local-first runtime, loopback default, optional bearer auth for non-loopback exposure | HTTPS, least-privilege env vars, health checks, separate dev/staging/prod config, and rollback path | Deployment runbook, `/health` from deployed target, env inventory, rollback command |
| External intake and providers | Current public endpoints are informational; no third-party auth, database, form, or edge provider is authoritative yet | Public intake, auth, storage, or edge providers must be scoped adapters with documented purpose, collected fields, destination, retention, deletion/export path, logging posture, and secret boundary | Provider data-flow map, intake schema, retention/delete/export note, browser bundle secret scan, auth/routing test |
| Scoped capabilities | Master, execute, and notify tokens exist for local/proxy operation | Public or multi-tenant capability grants are time-bounded, parameter-bounded, revocable, and auditable | Token scope tests, expiry/revocation test, request receipt, client lifecycle doc |
| Rate limiting | Built-in Express rate limiting is available through `DIZZY_RATE_LIMIT_ENABLED`, `DIZZY_RATE_LIMIT_WINDOW_MS`, and `DIZZY_RATE_LIMIT_MAX`; `/health` is exempt | Public, auth, and expensive routes must have per-IP or per-user limits before public exposure | Rate-limit config, test request burst, `429` behavior sample |
| Caching | Internal markdown, memory graph, and prompt bundle caches exist | Static assets cache safely; sensitive/user-specific responses are not publicly cached; invalidation rules are explicit | Cache headers, TTL notes, sensitive route no-cache test |
| Scaling | Queue/Redis architecture exists for tool jobs and worker flows | Resource assumptions, queue/backpressure behavior, horizontal-scaling constraints, and outage behavior are documented | Capacity note, worker count assumptions, Redis/database/provider outage test |
| Dependency and external API drift | Runtime packages, Redis-compatible servers, SQLite sidecar behavior, Telegram, Gemini, and OpenAI-compatible providers are tracked in `DEPENDENCY_GOVERNANCE.md` | Package, lockfile, runtime, provider, and API-contract changes are classified before promotion | `npm run check:dependencies`, lockfile diff summary, provider fixture or redacted dry run, rollback path |
| Regulated actions / funds | No user-fund custody or autonomous financial execution is implemented | Legal review, explicit user consent, kill switch, and bounded signing authority are required before user funds, wallets, or regulated actions | Counsel signoff or risk memo, consent record, kill-switch test, scoped-signing spec if applicable |
| Error tracking | Local structured errors and logs exist, but no external tracker is configured | Server/client errors are captured with environment, release, and request context while secrets/private content are scrubbed | Test event in tracker, scrubber rules, release tag attached |
| Accessibility / ADA | No dedicated public UI exists yet | Public UI targets WCAG 2.2 AA; legal/procurement-sensitive surfaces verify at least WCAG 2.1 AA | Automated accessibility scan, manual keyboard pass, screen-reader spot check |

## Project Integration

- `README.md` presents the public summary and launch-proof list.
- `RUNBOOK.md` remains the operational setup surface.
- `OPERATIONS.md` governs runtime operation and trust-zone handling.
- `EXTERNAL_SURFACE_REVIEW.md` is the reusable gate template for public forms, auth providers, edge providers, hosted databases, and client-facing storage.
- `scripts/production_readiness_check.mjs` verifies that this gate remains wired into the repo.
- `DEPENDENCY_GOVERNANCE.md` defines the dependency/API drift matrix and credential handling rule.
- `npm run check:production` runs the production-readiness wiring check.
- `npm run check:dependencies` runs the dependency/API drift gate.
- `npm run maintain` includes the production-readiness check with the rest of the maintenance pass.

## Launch Proof Packet

Before any hosted/client-facing release, collect:

- Production build screenshot or GIF
- Deployed `/health` response
- Passing release-commit checks
- Route/auth inventory
- Rate-limit proof on one public route
- Cache-header proof for static and sensitive routes
- Error-tracking test event
- External intake/provider data-flow map, if any form, auth provider, edge provider, hosted database, or client-facing storage is added
- Database RLS or tenant-isolation proof, if a database exists
- Accessibility scan plus manual keyboard/screen-reader notes
- Deployment rollback path

## Non-Negotiables

- Do not expose non-loopback runtime routes without auth.
- Do not ship browser bundles that contain private env vars or service-role credentials.
- Do not create public lead, intake, or support forms until purpose, fields, destination, retention, deletion/export, anti-tracking posture, and abuse controls are documented.
- Do not let Cloudflare, Supabase, Firebase, Clerk, form vendors, or any equivalent provider become authority for private memory, client continuity, or identity beyond an explicit adapter scope.
- Do not pass provider API keys as command-line arguments; use environment variables or an approved local secret manager.
- Do not claim ADA compliance from automation alone; combine automated scans with manual keyboard and assistive-tech checks.
- Do not treat Redis or local memory files as a substitute for database RLS if user accounts or tenants are added.
- Do not promote SQLite, or deprecate Redis, without an explicit authority and rollback plan.
- Do not handle user funds, wallets, or regulated execution without legal review, explicit consent, and a tested kill switch.
- Do not add onchain signing or delegated action flows unless capabilities are time-bounded, parameter-bounded, revocable, and auditable.
- Do not overclaim production maturity; missing proof means the item remains `operator overlay` or `planning candidate`.
