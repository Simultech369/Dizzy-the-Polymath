# Dependency Evidence

Purpose: store concise evidence packets for dependency, provider, API, runtime, and lockfile transitions.

Use one small Markdown file per promoted change that has a non-`none` `Dependency/API impact:` classification in `EXPERIMENT_RECONCILIATION.md`.

Required fields:

- Impact classification
- Affected surface
- Verification
- Result
- Rollback path
- Live-check gap, if any

Do not include API keys, bearer tokens, provider secrets, private prompts, raw customer data, or full external responses that contain sensitive content.

