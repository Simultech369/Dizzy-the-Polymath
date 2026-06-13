# Operating Loop

Purpose: make Dizzy useful in ordinary work without turning it into an ambient assistant.

This is a repeatable operator loop. It is not a new constitution. The loop exists to convert work into better orientation, fewer repeated stalls, and reusable judgment.

## Start Of Session

Run:

```powershell
node .\scripts\maintain.mjs
```

Read only the status lines and actionable next steps.

If maintenance is green, start work.
If maintenance is yellow, decide whether the warning affects today's task.
If maintenance is red, fix the red item before trusting continuity.

## Work Intake

Before asking Dizzy to work, classify the task:

- `private_self`: private strategy, architecture, personal memory, system design
- `trusted_collaborator`: shared work where selective context is useful
- `outside_contact`: fresh-context interaction
- `paid_public`: client/public work; ephemeral unless scoped continuity is explicit

Then state:

- goal
- constraints
- success criteria
- allowed context
- what should not carry forward

Example:

```text
private_self. Goal: decide next repo integration. Constraints: keep changes small, no new dependencies. Success: one pushed commit or a clear no-build decision. Use repo docs and memory. Do not drift into marketplace planning.
```

## During Work

Use a compact preflight only when the task is non-trivial:

- `skip`: the request is simple and clear
- `proceed`: silently hold one completion signal, one to three acceptance checks, and any hard constraint or abort condition
- `clarify`: ask one targeted question only when the missing fact would materially change the approach, risk, or irreversible outcome

Do not display a success-criteria block by default. If refinement takes more than about a minute, fall back to goal, hard constraints, and one completion signal.

Use receipts as evidence, not decoration.

For runtime/client surfaces, inspect:

- `trust_zone`
- `retention_scope`
- `durable_memory_allowed`
- `repo_retrieval_allowed`
- `private_memory_access`
- `retrieval_audit`
- `blocked_context`

If a receipt contradicts the intended trust zone, stop and fix the boundary before continuing.

## Friction Capture

When the same stall repeats, log it instead of carrying it mentally:

```text
/friction add {"friction_type":"stale_docs","description":"NEXT and runtime status disagreed","task_context":"repo integration","severity":6,"frequency":"repeated","suggested_fix":"status frontmatter for upgrades"}
```

Use friction for repeated stalls, not every annoyance.

## Trajectory Capture

When a task succeeds in a reusable way, capture only the pattern:

```text
/trajectory add {"goal":"...","success_criteria":"...","actions_taken":["..."],"outcome":"success","reusable_pattern":"...","reuse_tags":["maintenance"],"strength":7}
```

Do not store raw conversation as a trajectory. Store the move that worked.

## Session Close

Ask three questions:

1. What changed?
2. What should carry forward?
3. What should be deleted, ignored, or demoted?

Then choose one close action:

- no memory: nothing durable happened
- `/friction add`: repeated operator burden appeared
- `/trajectory add`: a reusable move worked
- `/remember`: durable context changed
- docs/code update: runtime or governance changed

Run:

```powershell
node .\scripts\maintain.mjs
```

Stop when the next action is clear. Do not manufacture productivity.

## Weekly Review

Run:

```powershell
node .\scripts\maintain.mjs
```

Then review:

- top unresolved friction
- useful trajectories
- stale `upgrades/active/` notes
- whether receipts and boundaries matched actual work

Pick one integration. Prefer the smallest change that reduces repeated burden or increases capability.

## Rule

Dizzy compounds value when it turns work into clearer boundaries, fewer repeated stalls, and reusable patterns. If the loop adds ceremony without reducing future burden, compress it.
