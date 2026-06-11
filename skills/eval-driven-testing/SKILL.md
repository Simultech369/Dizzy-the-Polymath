---
name: eval-driven-testing
description: Build inspectable evaluations for prompts, skills, agents, and model workflows. Use before behavior changes or when reliability must be measured across revisions.
---

- Define expected behavior and failure cases before implementation.
- Separate deterministic contract tests from model-judged quality evaluations.
- Keep single-turn, multi-turn, and tool-using scenarios distinct.
- Store fixtures, grader rules, metrics, outputs, and run metadata in inspectable artifacts.
- Include adversarial, boundary, stale-context, and no-op cases.
- Compare against a baseline and report regressions, not only aggregate scores.
- Use human or model rubrics only where deterministic checks cannot express the requirement.
