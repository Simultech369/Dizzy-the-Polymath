# Retrieval Integrity Evaluation

This report-only lane translates the useful parts of CoreTex into Dizzy-native
retrieval checks. It does not import CoreTex code, its corpus, contracts,
coordinator, mining incentives, or hidden scoring infrastructure.

The evaluation checks:

- current evidence outranks stale evidence;
- memory explicitly marked `memory_status: revoked` is excluded (`revocation_path`
  alone describes the operator's deletion/revocation mechanism and does not
  mean the record is revoked);
- trust-zone-ineligible memory is excluded;
- operator-reviewed evidence outranks an otherwise identical assistant claim;
- missing evidence produces abstention;
- repeated retrieval produces identical ranked paths and source hashes.

Run without changing retrieval policy:

```powershell
npm.cmd run eval:retrieval-integrity
```

Use `--dry-run` to inspect the lane without creating fixtures or results. Use
`--require-pass` only when these behaviors have been deliberately promoted into
runtime policy and the evaluation becomes a gate.

Results are ignored under `evaluations/retrieval-integrity/results/`. A failing
report is expected during baseline capture and must not silently rewrite memory,
prompt authority, trust zones, or retrieval ranking.
