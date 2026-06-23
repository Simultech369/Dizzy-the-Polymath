# DACR Local Smoke Baseline — 2026-06-21

Status: evaluation evidence only. This does not promote a model, prompt, or
routing policy into Dizzy's runtime.

## Fixed Slice

- Dataset: `dacr_bench_v1.1_mini.json`
- Split: synthetic
- Challenge: `dacr-bench-00106`
- Category: `conditional_filtered`
- Hop depth: 2
- Scope: shortest document under 1,800 words, one challenge, one question
- Question: "Among studies traced with U-13C6-glucose, which had the highest
  TCA cycle flux?"
- Gold answer: `Phago kinesis`
- Local endpoint: Ollama native `POST /api/chat`

## Results

| Model | Context | Outcome | Confidence | Latency | Interpretation |
| --- | ---: | --- | ---: | ---: | --- |
| `gemma3:4b` | 8192 | Wrong: `Neuro graft` | 0.95 | 302.8 s | Completed reliably, but confidently selected the wrong metric/study |
| `qwen2.5-coder:7b` | 8192 | Transport failure: `fetch failed` | n/a | 306.8 s | Ollama remained reachable; no model answer returned |
| `qwen2.5-coder:7b` | 6144 | Transport failure: `fetch failed` | n/a | 331.9 s | Lower context did not recover this long-document workload |

## Decision

- Keep `gemma3:4b` as the current executable DACR baseline, not as a quality
  winner. Its first result is evidence of overconfidence and conditional-filter
  failure.
- Do not spend more CPU time retrying `qwen2.5-coder:7b` on this lane without a
  runtime or hardware change.
- A future comparison should use an identical slice and report transport
  failures separately from incorrect answers.
- No routing or prompt-policy promotion is justified by this smoke sample.

## Harness Finding

The upstream evaluator previously treated runner failures without an explicit
`parseFormat` as JSON and reported a 0% format-failure rate. The local DACR
adapter now records `parseFormat: "failed"`, a failure reason, and a correct
100% format-failure rate for transport failures.

## Harness Revalidation — 2026-06-22

- An initial Gemma retry hit `fetch failed` after 308.1 seconds. The wrapper
  exposed a defect by returning success despite a 100% format-failure report.
- The wrapper now preflights Ollama/model availability and exits nonzero for
  runner transport or format failures. A missing-model probe confirmed the
  fail-closed path before inference.
- A warm identical-slice rerun with a 128-token completion cap completed in
  24.3 seconds without a format failure. It again answered `Neuro graft` at
  0.95 confidence, preserving the original conclusion: executable baseline,
  poor conditional-filter accuracy, no routing promotion.
- Final reconciliation against external `dacr-bench` commit `d3814d3` observed
  another `fetch failed` runner failure; the wrapper correctly exited nonzero
  after the evaluator reported a 100% format-failure rate.
