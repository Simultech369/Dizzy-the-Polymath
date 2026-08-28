# Low-Credit Antigravity + OSS Orchestration Packet

Status: current control handoff
Date: 2026-07-25
Last refreshed: 2026-07-26 by Codex
Mode: low-credit momentum, docs/planning only until Simul selects an implementation slice

## Snapshot Gate

Current local snapshot verified by Codex during the 2026-07-26 refresh:

- Repository: `C:\Users\Josh\clawd`
- Branch: `main`
- HEAD: `aa12518e5125bcd22cd0d7d73200735511e2bea9`
- Local `origin/main` ref: `7bce8605b31328af065b5880adcf07e11d74c994`
- Local branch relation: `main...origin/main [ahead 2]`
- Staged changes: none
- Worktree: intentionally dirty/untracked review, runtime-candidate, W-0062, dashboard/prototype, and memory artifacts

The older `7bce8605b31328af065b5880adcf07e11d74c994` packet anchor is now stale as the local HEAD gate, though it remains the current local `origin/main` ref until the repo is fetched or pushed. Older Antigravity files that anchor to `62acf21b5a0f5e4d811cc9cebb6536931457933b` are historical and stale for execution. Do not use their hash gates as current truth unless they are explicitly regenerated.

Before Antigravity implements anything, rerun:

```powershell
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Stop if branch, HEAD, or dirty-tree scope differs from this refreshed packet and no fresh reconciliation has been written. If remote state matters, fetch or otherwise verify the remote before treating the local `origin/main` ref as current GitHub truth.

## Role Boundary

- Simul selects slices and authorizes push/publication.
- Antigravity may be the final implementer only after a selected slice is named.
- Codex remains planner, reviewer, packet maintainer, and reconciliation support unless Simul explicitly changes the role.
- Local OSS models generate claims only. Their outputs do not authorize edits, commits, push, publication, cleanup, or scope expansion.

## Current Operating Diagnosis

The project does not need another broad review. It needs a clean queue that converts model signal into one reversible next slice.

Useful current facts:

- `QUICKSTART.md`, `README.md`, `REPO_GUIDE.md`, and `FILE_ROLES.md` now make the repo easier to enter.
- `reviews/oss_model_synthesis_ledger.md` is the current decision artifact from the onboarding/model review slice.
- `NEXT.md` has one open item: `W-0062: Anti-Slop Overlay`.
- `npm.cmd run maintain` passed on 2026-07-26 and reported `open_work_items: 0`, `next_queue_item: none`, no visible promotion debt, and green upgrade status with five active-lane notes; treat that as maintenance-summary semantics, not proof that the visible W-0062 queue item is gone.
- `reviews/prompts/realness-pass.md` and `reviews/prompts/realness_review_prompt.md` are parked craft lenses, not runtime policy.
- Dashboard/runtime/prototype files are dirty and should stay parked unless a separate verification contract is selected.
- Local W-0062 OSS review outputs are weak claim sources: Qwen mostly duplicated existing boundaries but carried stale snapshot claims; Gemma returned only `Okay` and provides no usable review signal.

## Momentum Plan

### Phase 0 - Do Not Spend Credits

Use only local checks and local models:

1. Confirm snapshot gate.
2. Run local model reviews against the narrow W-0062 planning packet.
3. Convert overlapping model claims into acceptance criteria.
4. Hand Antigravity one selected slice.

Stop before implementation if the selected slice is still ambiguous.

### Phase 1 - W-0062 Spec Slice

First recommended slice:

Define W-0062 as an advisory anti-slop overlay before touching scanner code.

Allowed files for a first docs/spec candidate:

- `upgrades/active/anti-slop-overlay.md` or equivalent W-0062 spec note
- `NEXT.md` only if status wording needs a narrow update
- `reviews/oss_model_synthesis_ledger.md` only if the accepted criteria need to be recorded

Do not edit yet:

- `lib/anti_slop_scanner.mjs`
- `scripts/maintain.mjs`
- `scripts/safety_checks.mjs`
- `dashboard/*`
- `lib/client_continuity.mjs`
- `lib/consensus.mjs`
- `lib/memory_graph.mjs`
- prototype files

### Phase 2 - Tiny Implementation Only After Spec

Only after the spec has acceptance criteria, Antigravity may implement one of:

- advisory scanner detection for banned promotional words and fake symmetry;
- advisory scanner detection for unthemed decorative gradients;
- maintain-summary wiring that reports yellow warnings without failing the run.

Do not combine those into one commit unless the spec explicitly says they are inseparable.

## Local OSS Reviewer Bench

Use the models already available in local Ollama:

| Model | Use | Output bucket |
| --- | --- | --- |
| `qwen2.5-coder:7b` | scope containment and implementation minimality | acceptance criteria |
| `deepseek-coder-v2:16b` | scanner/runtime safety and hidden coupling | contradiction to reconcile |
| `gemma3:12b` | onboarding/operator clarity and false-positive readability | wording improvement |
| `llama3.1:latest` | repo organization and public OSS reader confusion | under-asked question |
| `llama-audit:latest` | proof-vs-theater and overclaim checks | contradiction to reconcile |

Optional heavier pass:

- `qwen3.6:27b-q4_K_M` only if the 7B/16B results disagree and local compute is acceptable.

## Local OSS Commands

These commands keep the packet explicit and avoid uploading private dirty backlog.

### Qwen Minimality Pass

```powershell
$files = @(
  "NEXT.md",
  "reviews/oss_model_synthesis_ledger.md",
  "reviews/prompts/realness-pass.md",
  "reviews/prompts/realness_review_prompt.md",
  "reviews/low_credit_antigravity_oss_orchestration.md",
  "reviews/prompts/low-credit-w0062-oss-review.md"
)

$context = foreach ($f in $files) {
  "### File: $f"
  "```"
  Get-Content -Raw -LiteralPath $f
  "```"
}

$prompt = Get-Content -Raw -LiteralPath "reviews/prompts/low-credit-w0062-oss-review.md"
($prompt + "`n`n" + ($context -join "`n")) |
  ollama run qwen2.5-coder:7b --hidethinking |
  Tee-Object -FilePath "reviews/oss_w0062_qwen_local_review.md"
```

### DeepSeek Coupling Pass

```powershell
$files = @(
  "NEXT.md",
  "reviews/oss_model_synthesis_ledger.md",
  "reviews/prompts/realness-pass.md",
  "reviews/prompts/realness_review_prompt.md",
  "reviews/low_credit_antigravity_oss_orchestration.md",
  "reviews/prompts/low-credit-w0062-oss-review.md"
)

$context = foreach ($f in $files) {
  "### File: $f"
  "```"
  Get-Content -Raw -LiteralPath $f
  "```"
}

$prompt = Get-Content -Raw -LiteralPath "reviews/prompts/low-credit-w0062-oss-review.md"
($prompt + "`n`n" + ($context -join "`n")) |
  ollama run deepseek-coder-v2:16b --hidethinking |
  Tee-Object -FilePath "reviews/oss_w0062_deepseek_local_review.md"
```

### Gemma Operator-Clarity Pass

```powershell
$files = @(
  "NEXT.md",
  "reviews/oss_model_synthesis_ledger.md",
  "reviews/prompts/realness-pass.md",
  "reviews/prompts/realness_review_prompt.md",
  "reviews/low_credit_antigravity_oss_orchestration.md",
  "reviews/prompts/low-credit-w0062-oss-review.md"
)

$context = foreach ($f in $files) {
  "### File: $f"
  "```"
  Get-Content -Raw -LiteralPath $f
  "```"
}

$prompt = Get-Content -Raw -LiteralPath "reviews/prompts/low-credit-w0062-oss-review.md"
($prompt + "`n`n" + ($context -join "`n")) |
  ollama run gemma3:12b --hidethinking |
  Tee-Object -FilePath "reviews/oss_w0062_gemma_local_review.md"
```

## Reconciliation Rule

After each local model output, classify every useful claim:

| Source | Claim | Bucket | Live evidence needed | Disposition | Antigravity action |
| --- | --- | --- | --- | --- | --- |
| qwen2.5-coder:7b |  | acceptance criterion / contradiction / under-asked question / wording improvement / duplicate signal / provider failure |  | accept / reject / defer | implement / keep parked / none |

Only accepted acceptance criteria move into the W-0062 spec. Everything else stays review residue.

### 2026-07-26 Local Claim Reconciliation

| Source | Claim | Bucket | Live evidence needed | Disposition | Antigravity action |
| --- | --- | --- | --- | --- | --- |
| `qwen2.5-coder:7b` | Current branch and HEAD match `7bce8605b31328af065b5880adcf07e11d74c994`. | contradiction | Fresh snapshot gate | reject as stale | none |
| `qwen2.5-coder:7b` | W-0062 should remain spec-only and avoid runtime/dashboard/prototype files. | duplicate signal | Active spec and dirty-tree review | accept as boundary confirmation | keep parked until Simul selects one slice |
| `qwen2.5-coder:7b` | Automate continuous monitoring, snapshot gates, and CI enforcement. | deferred idea | Current maintenance and CI scope | defer | none |
| `qwen2.5-coder:7b` | Local W-0062 claims had already been reconciled into the active spec. | overclaim | Active spec before this refresh | reject as false before this refresh | use this table as the replacement reconciliation |
| `gemma3:12b` | `Okay` | provider failure | Review artifact content | reject as no usable signal | none |

## Antigravity Kickoff Prompt

```text
Work in C:\Users\Josh\clawd.

Mode: final implementer only after snapshot verification. Do not stage, commit, push, reset, clean, stash, delete, move, rename, or broaden scope.

First read:
- reviews/low_credit_antigravity_oss_orchestration.md
- reviews/prompts/low-credit-w0062-oss-review.md
- NEXT.md
- reviews/oss_model_synthesis_ledger.md
- reviews/prompts/realness-pass.md
- reviews/prompts/realness_review_prompt.md

Verify:
- git branch --show-current
- git rev-parse HEAD
- git rev-parse origin/main
- git status --short

Expected:
- branch main
- HEAD `aa12518e5125bcd22cd0d7d73200735511e2bea9`
- local `origin/main` ref `7bce8605b31328af065b5880adcf07e11d74c994`, unless a fresh fetch or push updates it
- local branch may report `main...origin/main [ahead 2]`
- no staged changes
- intentionally dirty backlog

Task:
Use local OSS model outputs, if present, as claim sources only. Reconcile them into one W-0062 spec candidate. The first useful artifact is a narrow advisory-overlay spec, not scanner code.

Hard boundary:
Do not edit dashboard files, runtime library files, scanner code, maintain scripts, safety scripts, memory files, or prototypes unless Simul explicitly selects an implementation slice after the spec is reviewed.

Deliver:
1. Snapshot verification.
2. One proposed W-0062 spec shape.
3. Accepted/rejected/deferred local OSS claims.
4. Exact files you would edit if Simul approves implementation.
5. Stop before code changes unless Simul explicitly says to implement.
```

## Stop Rules

Stop when:

- the next move requires paid credits;
- the next model pass would be broader than the previous one;
- a model recommends touching dashboard/runtime code without a selected slice;
- a command would upload dirty-code or restricted material externally;
- an implementation path needs more than one commit candidate;
- the tree state differs from the snapshot gate.

The useful move is boring and sharp: one local-OSS claim set, one W-0062 advisory spec, one Antigravity implementation candidate only after Simul selects it.
