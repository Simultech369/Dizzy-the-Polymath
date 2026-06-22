# DACR Local-Model Evaluation

This is an operator-run, reversible evaluation lane for measuring document
reasoning, citation behavior, confidence calibration, and conflict handling.
It does not change Dizzy's prompts, memory, model routing, or runtime authority.

The benchmark checkout and corpus remain external. Set `DACR_BENCH_ROOT` when
the checkout is not at the default Windows path:

```powershell
$env:DACR_BENCH_ROOT = "C:\path\to\dacr-bench"
```

Inspect the exact local commands without contacting a model:

```powershell
npm.cmd run eval:dacr:smoke -- --dry-run
```

Run the bounded default smoke evaluation:

```powershell
npm.cmd run eval:dacr:smoke
```

The default uses `gemma3:4b`, Ollama's native local `/api/chat` route, an 8K
context, the shortest synthetic document under 1,800 words, one question, and
one challenge. Results are ignored under `evaluations/dacr/results/`.

Useful overrides include `--model`, `--split`, `--max-document-words`,
`--limit`, `--questions`, `--max-tokens`, `--context`, and `--timeout`.

Do not interpret a one-question smoke result as a model ranking. Promotion into
Dizzy's routing or prompt policy requires a broader, identical-slice comparison
with recorded latency, accuracy, calibration, and failure modes.

The first fixed-slice comparison is recorded in
`SMOKE_BASELINE_2026-06-21.md`.
