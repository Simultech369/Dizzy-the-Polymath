---
name: differential-review
description: Review a code change with depth scaled to blast radius, reachable callers, history, and security impact. Use for commits, branches, pull requests, or focused regression review.
---

- Establish the intended behavior, git range, and affected trust boundaries.
- Derive coding standards from repository configuration, surrounding code, framework conventions, and authority docs.
- Choose surgical, focused, or deep review based on blast radius.
- Inspect changed code, reachable callers, tests, configuration, and relevant history.
- Lead with reproducible bugs, security regressions, and missing tests rather than style.
- Flag oversized changes, speculative abstractions, ownerless TODOs, inaccessible UI, and absent verification when they create concrete risk.
- Avoid arbitrary size thresholds or generic standards that conflict with the codebase.
- Give severity, evidence, exact file references, concrete fixes, and acceptance tests.
- Verify reviewer suggestions before implementing them.
- Say clearly when no actionable issue is found and name remaining test gaps.
