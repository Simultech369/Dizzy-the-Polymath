# Dizzy Experiments Merge Checkpoint — 2026-06-23

## Snapshot

- Branch merged: `experiments`
- Main commit: `919a6f7` (`Clean dashboard source whitespace`)
- Remote status at merge verification: `main`, `origin/main`, `experiments`, and
  `origin/experiments` all pointed at `919a6f7`.
- Working tree at verification: clean.

## What landed

- Dashboard hardening:
  - route isolation in `lib/dashboard.mjs`
  - same-origin dashboard assets
  - tightened CSP
  - temporary loopback-only `HttpOnly; SameSite=Strict` dashboard session cookie
  - minimal dashboard metadata with opaque IDs
- Local evaluation work:
  - retrieval-integrity evaluation lane
  - DACR local smoke wrapper
  - fail-closed DACR transport/format failure contract
  - archived local DACR vendor patch without forking or pushing upstream
- Review and governance evidence:
  - archived independent review artifacts
  - coordination-philosophy and two-treasury experimental context packs
  - derived-state sync after design updates

## Validation

- Antigravity merge review reported no source, runtime, or documentation
  blockers.
- Local confirmation after merge:
  - `main` and `experiments` both resolved to `919a6f7`
  - `experiments` was an ancestor of `main`
  - working tree was clean
- `npm.cmd run maintain` passed after the final source-whitespace cleanup.

## Known idiosyncrasies

- Full `git diff --check main..experiments` was intentionally noisy before the
  merge because it scanned raw provenance artifacts:
  - archived review outputs under `reviews/`
  - archived DACR format patch under `dependency-evidence/patches/`
- Source-only hygiene was cleaned before merge. The provenance artifacts were
  not normalized because preserving raw review and patch evidence is more useful
  than beautifying those files.
- `<operator-local-dacr-checkout>` remains a clean local checkout with
  one unpublished portability commit, `d3814d3`. The reproducible copy of that
  work is archived in:
  `dependency-evidence/patches/dacr-bench-ollama-portability-d3814d3.patch`.

## Recommended next posture

- Do not run more live model or DACR evals unless there is a specific decision
  they would unblock.
- Treat `919a6f7` as the weekly stable checkpoint.
- If new work starts, branch from `main` and keep the next task bounded to one
  reviewable surface.
