---
name: api-contract-design
description: Design or review stable API contracts, validation, errors, health surfaces, and compatibility behavior. Use for HTTP endpoints, public schemas, client integrations, or versioning decisions.
---

- Define actors, trust zones, resources, operations, and compatibility expectations.
- Accept forgiving input only where normalization is unambiguous; keep output strict.
- Return machine-readable error codes with useful human messages.
- Report all independent validation errors when doing so is safe.
- Separate liveness, readiness, and metrics endpoints.
- Include realistic request, response, auth, failure, pagination, and idempotency examples.
- Test authorization boundaries and backwards compatibility, not only happy paths.
