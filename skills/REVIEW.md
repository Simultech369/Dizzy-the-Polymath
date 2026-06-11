# Local Skill Review

Reviewed: 2026-06-11

Scope: the fifteen existing `skills/*/SKILL.md` files only. The external entries in `context-packs/skill-intake-ledger.md` remain uninstalled candidates.

Bug-bounty discovery is deliberately outside this registry. Its changing sources, claim state, and payment evidence belong in the discovery automation and local `bounty-board.md`, not in an always-reusable skill body.

## Decision

| Skill | Disposition | Reason |
| --- | --- | --- |
| `agent-relationships` | Active | Narrow coordination guidance; no side effects or dependencies |
| `autonomous-research` | Active | Source-validation workflow; execution still uses existing tools and permissions |
| `browser-automation` | Active | Deterministic browser guardrails; does not grant browser access itself |
| `culture-stewardship` | Active | Bounded tone and conduct guidance |
| `database-interface` | Active | Read-first database safety guidance; does not grant database credentials |
| `divergent-thinking` | Active | Bounded ideation and critic workflow |
| `filesystem-workplace` | Active | Non-destructive file-operation guidance; runtime permissions still control access |
| `git-skill` | Active | Scoped version-control hygiene; does not bypass operator approval |
| `memory-discipline` | Active | Reinforces existing memory lifecycle rules |
| `model-routing` | Active | Advisory routing criteria; does not change configured providers or credentials |
| `safety-permissions` | Active | Reinforces existing consent and irreversibility checks |
| `scheduler-skill` | Active | Scheduling guardrails; does not create jobs by itself |
| `shell-terminal` | Active | Command sequencing guidance; does not grant shell authority |
| `skill-intake-review` | Restricted | Load only for external-skill intake or explicit request |
| `web-request-skill` | Active | HTTP diagnostic guidance; existing network and secret boundaries remain authoritative |

## Shared Risk Decision

These files contain instruction text only: no scripts, assets, dependencies, credentials, or external-service configuration. Their main risk is prompt dilution or accidental authority inflation.

Controls:

- select at most three skills per request by default
- load only in `private_self` or `trusted_collaborator`
- explicit names override automatic matching but cannot bypass trust-zone rules
- treat skills as task workflow guidance below the constitutional prompt
- include loaded and rejected skill names in the capability receipt
- keep external intake-ledger entries unavailable until separately reviewed and promoted

## Acceptance Test

- all fifteen directories contain a valid `SKILL.md` whose frontmatter name matches the directory
- every discovered skill has a registry disposition
- relevant private requests select expected skills
- unrelated requests load no skills
- explicit valid selections load deterministically
- unknown explicit selections are reported, not silently loaded
- `outside_contact` and `paid_public` load no local skills
