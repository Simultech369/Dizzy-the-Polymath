# Repo Review Pack

status: sketch

purpose: review code and doctrine together when the question spans architecture, runtime behavior, and governance.

## Load

Repo shape:
- `README.md`
- `REPO_GUIDE.md`
- `FILE_ROLES.md`
- `DESIGN.md`
- `NEXT.md`

Runtime:
- `package.json`
- `agent_server.mjs`
- `worker.mjs`
- relevant `lib/*.mjs`
- relevant `scripts/*.mjs`
- tests or smoke checks for the touched surface

Governance:
- `PROTOCOL.md`
- `LEGAL-GUARDRAILS.md`
- `GOVERNANCE.md`
- `MEMORY_OWNERSHIP.md`
- `DRIFT_AUDIT.md`

Prompt behavior:
- `PROMPT_PACKS.md`
- `PROMPT_CORE.md`
- `PROMPT_MODES.md`
- core identity files only when behavior changes touch live assistant posture

## Exclude By Default

- optional persona material unless relevant to the behavior under review
- historical upgrade proposals unless they explain current implementation
- media assets unless rendering or marketplace behavior is under review

## Watch

- docs claiming behavior code does not enforce
- code paths that mutate memory or state without clear ownership
- public/client surfaces leaking private calibration
- runtime behavior drifting away from prompt-pack assumptions
- philosophical language without mechanism
- mechanism without failure-mode analysis

## Output Shape

Findings first.

For each issue:
- severity
- file and line when available
- concrete failure mode
- suggested fix

Then:
- open questions
- test gaps
- short change summary if edits were made

