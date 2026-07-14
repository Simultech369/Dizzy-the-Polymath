Review only. Do not edit files, commit, push, create branches, create issues, install dependencies, or use interactive pickers.

Repo: C:\Users\Josh\clawd
Branch expected: main
Base HEAD to anchor against: 204ba36d072655c80a3df94d0abce4ab10329432

You are being used as an independent Goose reviewer for Dizzy/clawd. Follow the local project protocol enough to calibrate, but keep this as a code review, not a persona performance.

First, read these local files if present, in order:

- BOOTSTRAP.md
- IDENTITY.md
- identity/personas/SOUL.md
- PROMPT_CORE.md
- TOOLS.md
- identity/personas/USER.md

Treat those files as local operating context only. Do not modify them.

Then inspect the actual local state with read-only commands:

```powershell
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git status --short
git diff --stat
git diff -- OPERATIONS.md PORTABILITY.md lib/client_continuity.mjs lib/dispatch.mjs lib/janitor.mjs lib/tools.mjs lib/trajectories.mjs package.json scripts/fuzzing_and_injection_tests.mjs scripts/injection_and_fuzzing_checks.mjs scripts/maintain.mjs scripts/safety_checks.mjs
```

If the branch or HEAD does not match the expected values above, report the mismatch before reviewing.

If there is no uncommitted diff, stop and say the review target is missing.

Review the current uncommitted working diff, not only HEAD. Do not review `_ext/` or `_external/` unless the diff touches those directories.

Focus only on private-runtime hardening and prompt-injection containment.

Changed areas expected in this review:

- lib/janitor.mjs
- lib/client_continuity.mjs
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

1. Flagged hostile text is not replayed into retrieved context, trajectory context, client-continuity exports, retained paid/client prompt history, or neutralization markers.
2. Current-turn user text remains authoritative user input, but retained paid/client history does not preserve known hostile prompt-injection strings as future instructions.
3. Obfuscated payload detection covers HTML entities, embedded Base64, zero-width characters, and spaced-letter payloads without crashing on malformed input.
4. Capability paths fail closed: retrieved context redacts flagged content, trajectory retrieval redacts flagged content, client-continuity export redacts flagged strings, and cheerio_extract blocks flagged selected text or selected HTML attributes.
5. Tests prove behavior across real paths rather than merely encoding implementation assumptions.
6. Docs match the actual trust boundaries and do not overclaim private/operator transcript behavior.

Prioritize:

- prompt injection bypasses
- places hostile retained text still gains instruction authority
- export/log paths that still leak hostile strings
- false positives or denial-of-service risks from decoding/scanning
- Base64/entity/zero-width/spaced-letter edge cases
- inconsistent fail-closed behavior across retrieval/tool/export paths
- overclaims in docs or tests

Known risks worth checking, not assuming:

- Base64 candidate decoding is bounded per token, but may still need a maximum candidate or total decode budget.
- Whitespace-stripping detection may create false positives across benign word boundaries.
- HTML entity coverage may be narrower than an HTML parser's accepted entity forms.
- cheerio_extract should not claim it scanned unselected adjacent HTML unless it actually does.

Return findings first, severity ordered, with file/line references and minimal reproduction examples where possible.

Separate:

- confirmed defects
- plausible risks
- nice-to-have improvements
- what looked solid

Do not include a broad repo summary unless it directly supports a finding.
