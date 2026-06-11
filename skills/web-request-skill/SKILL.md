---
name: web-request-skill
description: Perform HTTP requests and API diagnostics with safe authentication handling. Use when testing endpoints, validating payloads, checking auth failures, or scripting API workflows.
---

- Verify method, URL, headers, and body before sending.
- Confirm the provider, API version, project language, and official SDK or HTTP contract before implementing an integration.
- Prefer idiomatic examples for the detected language over translated snippets from another SDK.
- Redact secrets from logs and outputs.
- Distinguish transport, auth, and application errors.
- Validate request and response schemas against current provider documentation when behavior is version-sensitive.
- Retry only on transient failures.
- Record request-response traces for debugging.
