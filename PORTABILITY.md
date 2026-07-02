# Portability

Purpose: define what Dizzy can export, what must stay bounded, and how exit claims map to current implementation.

Portability is an agency boundary, not a bulk data dump. Exports must help a client or operator leave with useful records without leaking private memory, credentials, third-party context, or another trust zone.

## Current Implemented Surface

Client continuity can be exported as JSON through:

```text
GET /agent/continuity/export?client_id=...&service_id=...
GET /agent/continuity/export?conversation_key=...
```

The route returns `dizzy.client_continuity.export.v1`.

The route relies on the same server boundary as other `/agent/*` routes: global bearer authentication when `DIZZY_AUTH_TOKEN` is configured, and loopback-only startup rules in unauthenticated `direct_local` mode. Do not expose continuity export over non-loopback, proxied, hosted, or client-facing surfaces without strong `DIZZY_AUTH_TOKEN` protection and an explicit scoped export design.

## Exported Data

The JSON export may include:

- `conversation_key`
- export timestamp
- schema version
- client-continuity execution history rows for that exact conversation key
- conversation JSONL rows for that exact conversation key
- counts for exported history and conversation rows

## Excluded Data

Exports must not include:

- `private_self` memory
- repository retrieval snippets
- credentials, tokens, cookies, or authorization headers
- dashboard session cookies
- unrelated client or service records
- deleted continuity records
- third-party private context outside the requested conversation

The JSON export returns the scoped conversation record as stored. Upstream capture rules, trust-zone gating, and deletion/pruning must prevent excluded data from entering that record; the export route is not a general-purpose redaction pass.

## Scope Rules

An export request must identify one continuity scope by either:

- `client_id` and `service_id`, or
- `conversation_key`

The server normalizes `client_id` and `service_id` into the same deterministic conversation key used by `/agent/execute`. Caller-supplied arbitrary conversation keys are normalized before file lookup.

The `conversation_key` form is an operator/admin recovery surface, not client self-service authorization. Client-visible export would need scoped client authentication or a non-guessable export capability before deterministic conversation keys could be safely exposed.

## Revocation And Deletion

Deletion remains separate from export:

```text
DELETE /agent/continuity
POST /agent/continuity/prune
```

After deletion or expiry pruning removes a continuity file and its history rows, the export route should return an empty export for that conversation key rather than resurrect deleted records.

Deletion events are logged through the client-continuity deletion log. That log is an operator audit surface, not part of the client continuity export.

## Formats

Implemented:

- JSON

Not implemented yet:

- CSV
- dashboard download controls
- signed export bundles
- export manifests with checksums

## Future CSV Schema Layout Map

CSV export is not implemented. If added later, it must use separate files to avoid flattening unlike records. The current database/export shapes suggest the following candidate column layouts; fields not present in stored rows must be omitted or emitted blank.

### 1. Execution History (`execution_history.csv`)

Tracks execution parameters. Nested structures (like the capability receipt) are flattened.

| CSV Header | Description | Data Type | Source Field / Receipt Mapping |
|---|---|---|---|
| `timestamp` | ISO 8601 creation timestamp | String | `t` |
| `route` | HTTP request path | String | `route` |
| `trust_zone` | Scoped trust zone for execution | String | `trust_zone` |
| `service_id` | Scoped service identifier | String | `service_id` |
| `client_id` | Scoped client identifier | String | `client_id` |
| `continuity_mode` | Continuity mode | String | `continuity_mode` |
| `retention_scope` | Scoped data retention policy | String | `retention_scope` |
| `repo_retrieval_allowed` | Whether repository retrieval was allowed | Boolean | `repo_retrieval_allowed` |
| `durable_memory_allowed` | Whether memory writing was allowed | Boolean | `durable_memory_allowed` |
| `result_kind` | Execution result category | String | `result_kind` |
| `receipt_format` | Format of capability receipt | String | `capability_receipt.format` |
| `receipt_zone` | Capability receipt trust zone | String | `capability_receipt.trust_zone` |
| `receipt_timestamp` | Timestamp on receipt | String | `capability_receipt.timestamp` |
| `conversation_key` | Normalized conversation identifier | String | `conversation_key` |

### 2. Conversation History (`conversation_history.csv`)

Tracks messages within a given conversation.

| CSV Header | Description | Data Type | Source Field |
|---|---|---|---|
| `timestamp` | ISO 8601 message timestamp | String | `t` |
| `role` | Message author role (`user` or `assistant`) | String | `role` |
| `text` | Raw message text | String | `text` |
| `backend` | API backend used, if present (assistant only) | Optional String | `backend` |
| `model_route` | Selected model route, if present (assistant only) | Optional String | `model_route` |

CSV exports must follow the same exclusions as JSON exports. They must not include private memory, repository retrieval snippets, credentials, cookies, authorization headers, deleted records, or unrelated client context.

## Review Rule

Any new export surface must answer:

- What exact records are included?
- Which trust zone owns those records?
- What is excluded by default?
- How are credentials and third-party data prevented from leaking?
- How does deletion affect future export?
