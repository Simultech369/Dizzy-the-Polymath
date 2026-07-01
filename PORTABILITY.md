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

The route is protected by the same server authentication boundary as other `/agent/*` routes when `DIZZY_AUTH_TOKEN` is configured. In `direct_local` mode without authentication, it remains loopback-local with the rest of the local-first runtime.

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

## Scope Rules

An export request must identify one continuity scope by either:

- `client_id` and `service_id`, or
- `conversation_key`

The server normalizes `client_id` and `service_id` into the same deterministic conversation key used by `/agent/execute`. Caller-supplied arbitrary conversation keys are normalized before file lookup.

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

## Review Rule

Any new export surface must answer:

- What exact records are included?
- Which trust zone owns those records?
- What is excluded by default?
- How are credentials and third-party data prevented from leaking?
- How does deletion affect future export?
