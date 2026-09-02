# DACR Local Evaluation Evidence

- Impact classification: `external_contract`
- Affected surface: optional operator-run evaluation only
- Contract: local Ollama native `POST /api/chat`; loopback endpoints only
- Dependency change: none; the external DACR checkout owns its own tooling
- External checkout observed: `<operator-local-dacr-checkout>` at
  `d3814d3` (`make DACR runner portable for local Ollama`)
- Local vendor patch archived:
  `dependency-evidence/patches/dacr-bench-ollama-portability-d3814d3.patch`
- Patch base: upstream DACR commit `8a78b5e`
- Verification: dry-run plan inspection, missing-model preflight rejection, and
  bounded live smoke runs recorded in `evaluations/dacr/SMOKE_BASELINE_2026-06-21.md`
- Runtime authority: none; no prompt, memory, routing, queue, or state mutation
- Results: written only to ignored `evaluations/dacr/results/`
- Rollback: remove `scripts/dacr_bench_eval.mjs`, `evaluations/dacr/`, the
  package script, this evidence file, and the matching `.gitignore` entry
- Live result: Gemma completed the fixed slice; Qwen transport failed at both
  8K and 6K context while Ollama remained reachable
- Live-check gap: model quality is slice-specific; one smoke case is not enough
  for routing or runtime promotion
- Failure contract: missing Ollama models, transport failures, and response
  format failures exit nonzero; incorrect but executable answers remain valid
  evaluation evidence

To reconstruct the local DACR checkout without forking the upstream repository,
check out upstream `8a78b5e` and apply the archived patch with `git am`.
