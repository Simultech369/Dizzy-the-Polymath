# Dependency/API Drift Gate Evidence

## Impact Classification

external_contract, runtime_dependency

## Affected Surface

- `DEPENDENCY_GOVERNANCE.md`
- `scripts/dependency_api_drift_check.mjs`
- `scripts/openrouter_review.py`
- `.github/workflows/checks.yml`
- `scripts/maintain.mjs`

## Verification

- `npm run check:dependencies`
- `python scripts/openrouter_review.py --help`
- `python scripts/openrouter_review.py --key test --list-files`
- `npm run maintain`

## Result

The dependency/API drift gate was wired into local maintenance and CI. `scripts/openrouter_review.py` no longer exposes `--key`; provider keys must come from `OPENROUTER_API_KEY` or `OPENAI_COMPAT_API_KEY`.

## Rollback Path

Revert the dependency/API drift gate commit and remove the CI matrix entry, `package.json` script, and governance references.

## Live-Check Gap

No live OpenRouter or OpenAI-compatible provider call was made. This evidence verifies local credential handling and gate wiring, not provider API compatibility.

