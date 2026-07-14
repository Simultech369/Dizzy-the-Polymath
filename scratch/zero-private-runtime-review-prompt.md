Review only. Do not edit files, commit, push, create branches, create issues, or use interactive pickers.

Repo: C:\Users\Josh\clawd
Branch: main
Base HEAD to anchor against: 204ba36d072655c80a3df94d0abce4ab10329432

First, inspect the actual local state:

```powershell
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git status --short
git diff --stat
```

If there is no uncommitted diff, stop and say the review target is missing.

Review the current uncommitted working diff, not only HEAD. Do not review `_ext/` or `_external/` unless the diff touches those directories.

Focus only on private-runtime hardening and prompt-injection containment.

Changed areas expected in this review:

- lib/janitor.mjs
- lib/dispatch.mjs
- lib/tools.mjs
- lib/trajectories.mjs
- scripts/fuzzing_and_injection_tests.mjs
- scripts/injection_and_fuzzing_checks.mjs
- scripts/safety_checks.mjs
- scripts/maintain.mjs
- package.json
- OPERATIONS.md
- PORTABILITY.md

Try to falsify these claims:

1. Flagged hostile text is not replayed into prompts, exports, retrieved context, logs, or neutralization markers.
2. Obfuscated payload detection covers HTML entities, embedded Base64, zero-width characters, and spaced-letter payloads without crashing on malformed input.
3. Capability paths fail closed: retrieved context redacts flagged content, trajectory retrieval redacts flagged content, and cheerio_extract blocks flagged extracted HTML.
4. Tests prove behavior rather than merely encoding implementation assumptions.

Prioritize:

- prompt injection bypasses
- places hostile text still gains instruction authority
- false positives or denial-of-service risks from decoding/scanning
- Base64/entity/zero-width/spaced-letter edge cases
- inconsistent fail-closed behavior across retrieval/tool paths
- overclaims in docs or tests

Return findings first, severity ordered, with file/line references and minimal reproduction examples where possible.

Separate:

- confirmed defects
- plausible risks
- nice-to-have improvements

Do not include a broad repo summary unless it directly supports a finding.
