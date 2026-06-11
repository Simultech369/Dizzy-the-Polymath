---
name: ci-log-triage
description: Diagnose CI, workflow, build, test, and release-readiness failures from exact logs and commands. Use when a job fails or automation reports an unclear regression.
---

- Capture the failing job, step, command, exit code, and smallest relevant log window.
- Reproduce locally when practical before editing workflow configuration.
- Classify the failure as infrastructure, dependency drift, configuration, test failure, or code regression.
- Trace the first causal error rather than the final cascade.
- Prefer the narrowest code or configuration fix supported by evidence.
- Record whether rerun success would prove the diagnosis or merely hide a flake.
- Return the fix, verification command, and residual release risk.
