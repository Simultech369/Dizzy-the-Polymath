# Dependency And External API Governance

Purpose: keep dependency drift and external API transitions visible before they can change runtime guarantees.

This file is an operational gate. It does not freeze dependencies; it defines what evidence is required when a dependency, provider contract, or external API surface changes.

## Dependency Authority Matrix

| Surface | Current contract | Runtime role | Drift risk | Upgrade or transition evidence |
| --- | --- | --- | --- | --- |
| Node.js / GitHub Actions | CI uses Node 20; README states Node 18+ for the main runtime and Node 22.5+ for optional `node:sqlite` acceptance checks | Runtime and verification environment | CI/runtime mismatch, optional SQLite checks skipped or misread | CI node-version review, local `node --version`, `npm ci`, `npm run maintain` |
| `redis` npm package | `package.json` version range plus `package-lock.json` | Live queue authority and notification queues | Queue semantics, Lua support, notification ack behavior, connection errors | Lockfile diff summary, queue safety tests, Redis-compatible smoke or documented no-live-Redis result |
| `express` npm package | `package.json` version range plus `package-lock.json` | HTTP API, auth, dashboard, route boundaries | Middleware behavior, request parsing, route matching, security defaults | Lockfile diff summary, smoke test, auth/route safety checks |
| `ethers` npm package | `package.json` version range plus `package-lock.json` | Optional EVM read-contract tooling | ABI/provider behavior changes, BigInt serialization drift | Focused read-contract fixture or documented no-call change |
| `cheerio` npm package | `package.json` version range plus `package-lock.json` | HTML extraction helper | Parsing behavior drift, extraction mismatch | Extraction fixture or documented no-runtime-path change |
| Redis-compatible server | Redis/Memurai/WSL/Docker endpoint via `REDIS_URL` | Live tool-job queue and notification transport | Server command support, Lua behavior, persistence/backpressure differences | Provider/version note, queue enqueue/claim/ack evidence, rollback path |
| SQLite operational sidecar | Optional `node:sqlite` prototype, non-authoritative | Experimental local operational store | Accidental authority promotion, multi-worker contention, migration ambiguity | `DESIGN.md` decision before promotion, migration/rollback rehearsal, concurrency test |
| Telegram Bot API | `scripts/telegram_relay.mjs` and `scripts/telegram_notify_drain.mjs` | Optional operator interface and notifications | Payload shape changes, delivery/ack mismatch, token handling | Recorded fixture or live dry run with redacted output, notify ack test |
| Gemini API | `GEMINI_API_KEY`, `GEMINI_MODEL`, optional utility model envs | Optional chat backend | Model ID deprecation, error shape drift, fallback trigger mismatch | Model-list or dry-run evidence, fallback/error fixture, no secret disclosure |
| OpenAI-compatible / OpenRouter API | `OPENAI_COMPAT_*` / `OPENROUTER_API_KEY` environment variables | Optional fallback/review provider | API shape drift, model alias changes, credential leakage | Env-only credential use, fixture or redacted dry run, provider model note |

## Required Evidence

Any dependency or external API change must classify its impact:

- `none`: no package, lockfile, provider, or API contract changed.
- `lockfile`: dependency graph changed without intended runtime behavior change.
- `runtime_dependency`: a local package or runtime version affects behavior.
- `external_contract`: a provider payload, route, model, API, or server command contract changed.
- `provider_migration`: traffic shifts from one provider/backend/version to another.

For `lockfile`, `runtime_dependency`, `external_contract`, or `provider_migration`, collect:

- `npm ci`
- `npm run maintain`
- lockfile or version diff summary
- affected runtime surface
- rollback path
- focused fixture, smoke test, or documented reason a live check was not run

## Evidence Fixtures

Evidence for non-`none` impact classifications lives under `dependency-evidence/`.

Each evidence file should include:

- impact classification
- affected surface
- verification commands or fixture path
- result
- rollback path
- live-check gap, if a real provider/server/API was not contacted

`scripts/dependency_api_drift_check.mjs` verifies that every non-`none` `Dependency/API impact:` entry in `EXPERIMENT_RECONCILIATION.md` includes an `Evidence: \`dependency-evidence/...\`` pointer and that the referenced file exists.

## Credential Handling

Provider keys must come from environment variables or an approved local secret manager. Do not pass API keys as command-line arguments to review or provider scripts, because shell history, process lists, terminal capture, and logs can retain them.

`scripts/openrouter_review.py` intentionally reads `OPENROUTER_API_KEY` or `OPENAI_COMPAT_API_KEY` from the environment and does not accept a `--key` argument.

## Promotion Rule

Every future promotion entry in `EXPERIMENT_RECONCILIATION.md` should include:

`Dependency/API impact: none | lockfile | runtime_dependency | external_contract | provider_migration`

If the impact is not `none`, the promotion entry should point to the evidence used to verify the transition.
