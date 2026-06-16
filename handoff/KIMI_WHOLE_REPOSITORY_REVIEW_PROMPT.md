# Kimi Whole-Repository Review Prompt

You are conducting an independent whole-repository architecture, security, reliability, and maintainability review of Dizzy.

## Repository

- Local path: `C:\Users\Josh\clawd`
- Remote: `https://github.com/Simultech369/Dizzy-the-Polymath`
- Target branch: `experiments`
- Approved checkpoint: `13b5c4a315925426e548f486a6a6768897411264`

First run:

```powershell
git rev-parse HEAD
git status --short --branch
git log -12 --oneline --decorate
```

State the exact commit and worktree condition reviewed. If HEAD is later than the approved checkpoint, review the whole repository first, then separately review `13b5c4a..HEAD` as provisional work.

## Independence Requirement

Develop your own system model before reading conclusions in `handoff/WALKTHROUGH.md` or relying on commit messages. Those materials may be consulted later as claims to verify, not as ground truth.

Do not assume that documentation, passing tests, or a prior reviewer proves the implementation is correct. Conversely, do not manufacture findings where the existing design is sound.

## Initialization

Read and follow `AGENTS.md`. Follow `BOOTSTRAP.md` and its required reading order. Distinguish live runtime authority from supplementary documents using `FILE_ROLES.md`.

Do not modify, commit, push, invoke paid services, send external messages, or print secret values.

## Core Questions

Ask once near the beginning:

1. What information or production evidence is missing?
2. What failure, usage, or cost trends could emerge as the system grows?
3. What changed recently that creates new risk, complexity, or opportunity?

Then determine:

- What Dizzy actually is today, rather than what its documents aspire to be.
- Which runtime paths are live and which are prototypes.
- Which stores are authoritative for jobs, conversations, memory, governance, and receipts.
- Where trust zones begin and end.
- Where external effects occur and how partial completion is reconciled.
- What an operator must do after crashes, ambiguous effects, corruption, or credential compromise.
- Whether policy claims are technically enforced.
- Whether tests prove the intended invariant or only a happy path.

## Review Scope

Review the repository in its entirety, including:

- HTTP runtime and exposure modes
- authentication, scoped credentials, and administrative surfaces
- reverse-proxy topology and identity headers
- Telegram relay, binding, notification delivery, and remote mutations
- Redis jobs, atomic claims, leases, heartbeats, recovery, retries, DLQ, and notification acknowledgment
- external uploads, deliveries, order fulfillment, idempotency, and ambiguous replay
- provider routing, fallback budgets, fairness, quotas, and cost containment
- redaction of secrets, credentials, cookies, sessions, errors, results, logs, and backups
- SSRF, redirects, DNS/IP validation, localhost and private-network controls
- memory lifecycle, retrieval, trust zones, paid/public isolation, retention, deletion, and provenance
- prompt-pack authority and drift from `DESIGN.md`, tests, and runtime behavior
- filesystem writes, locks, JSONL crash consistency, backup, restore, and repair
- experimental SQLite boundaries, migration readiness, concurrency, and exportability
- dependency and supply-chain risks
- Windows-specific process and filesystem behavior
- observability, failure injection, operator diagnostics, and incident recovery
- duplicated logic, hidden coupling, dead code, and complexity that raises failure probability

## High-Risk Invariants To Challenge

Do not assume these are correct; verify them:

- Notification polling cannot silently lose messages under failed delivery or competing consumers.
- Queue recovery cannot steal or duplicate a live worker's claim.
- Non-READ external effects are not automatically replayed when completion is ambiguous.
- Proxy-supplied client identity cannot be spoofed by a direct caller.
- Scoped tokens cannot reach administrative or unrelated routes.
- Paid/public requests cannot retrieve or persist private context accidentally.
- Durable records do not contain obvious secrets after redaction.
- Backup and restore cannot destroy the current runtime when preparation or copying fails.
- JSONL repair does not guess through interior corruption.
- SQLite is not accidentally treated as authoritative or production-supported.
- Repository-derived dashboard values cannot execute HTML or script.

## Verification

Run where feasible:

```powershell
npm.cmd test
npm.cmd run maintain
git diff --check
```

Use focused, non-destructive experiments to test concrete hypotheses. Do not use real credentials or external services. Clearly separate executed evidence from static reasoning.

## Finding Standard

Only report findings that are actionable and repository-specific.

For every finding provide:

### [P0/P1/P2/P3] Short title
- Confidence: high, medium, or low
- Type: verified defect, likely defect, design contention, documentation drift, test gap, or future hardening
- Reachability: required configuration and attacker/operator position
- Evidence: exact files, symbols, and line numbers
- Current behavior
- Concrete failure sequence or reproduction
- Impact
- Recommended change
- Verification that would prove the fix
- Strongest contention against making the change

Severity:
- P0: immediate catastrophic compromise or unrecoverable loss
- P1: serious security or reliability failure under plausible conditions
- P2: meaningful defect, fragility, or enforceability gap
- P3: bounded hardening or maintainability concern

Do not call something P1 merely because it is theoretically possible. Account for loopback defaults, authentication, deployment mode, operator access, and whether the affected component is live or experimental.

## Required Output

# Independent Whole-Repository Review

## Review Metadata
- Repository
- Branch
- Commit
- Worktree state
- Date
- Commands and tests run
- Verification status: VERIFIED, PARTIAL, or STATIC ONLY

## Executive Assessment
Assess current maturity, strongest properties, and largest remaining risks.

## Independently Derived System Model
Describe live runtime paths, authoritative state, trust boundaries, external effects, recovery model, and experimental components.

## Findings
List findings in descending severity using the required finding format.

## Cross-Cutting Contentions
Present reasonable arguments on both sides of architecture or policy disputes. Do not collapse disagreement into a false consensus.

## Blind Spots And Missing Evidence
List production behavior, deployment topology, concurrency, real-service, or operator evidence you could not verify.

## Existing Design That Should Be Preserved
Name mechanisms that are sound and changes that would add complexity without demonstrated benefit.

## Baseline Versus Provisional Changes
If HEAD is later than `13b5c4a`, distinguish:
- defects already present at the approved checkpoint
- regressions or improvements introduced after it
- provisional commits that should be accepted, amended, split, or reverted

## Recommended Implementation Iterations
Propose the smallest useful sequence, not an arbitrary fixed count. For each iteration include:
- objective
- findings addressed
- likely files
- acceptance and failure-injection tests
- policy decision or contention
- clean stopping condition
- whether Antigravity may implement autonomously or Codex review is required before promotion

## Final Verification Checklist
Provide exact commands and manual deployment checks.

## Closing Judgment
End with:
- top three actions
- top three uncertainties
- recommended number of additional iterations
- whether the repository is already a defensible stopping point
- whether a specialist DeepSeek or Qwen pass is warranted, and the exact narrow scope

## Reviewer Discipline

- Prefer contradiction-seeking over agreement with previous reviewers.
- Trace cross-file behavior instead of summarizing files independently.
- Label inference as inference.
- Say plainly if no P0 or P1 findings exist.
- Say plainly when evidence supports the current design.
- Optimize for net beneficial changes, not finding count.
