# DACR Local Evaluation Evidence

- Impact classification: `external_contract`
- Affected surface: optional operator-run evaluation only
- Contract: local Ollama native `POST /api/chat`; loopback endpoints only
- Dependency change: none; the external DACR checkout owns its own tooling
- Verification: `npm.cmd run eval:dacr:smoke -- --dry-run` and bounded live
  smoke runs recorded in `evaluations/dacr/SMOKE_BASELINE_2026-06-21.md`
- Runtime authority: none; no prompt, memory, routing, queue, or state mutation
- Results: written only to ignored `evaluations/dacr/results/`
- Rollback: remove `scripts/dacr_bench_eval.mjs`, `evaluations/dacr/`, the
  package script, this evidence file, and the matching `.gitignore` entry
- Live result: Gemma completed the fixed slice; Qwen transport failed at both
  8K and 6K context while Ollama remained reachable
- Live-check gap: model quality is slice-specific; one smoke case is not enough
  for routing or runtime promotion
