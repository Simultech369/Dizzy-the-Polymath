# Evidence-Grounded Divergent Synthesis Evaluation

This is an operator-run, reversible evaluation. It does not call a model, upload repository context, write memory, or select a strategy autonomously.

1. Create at least 20 tasks with source packets and hidden answer-quality criteria.
2. Randomize whether the operator sees the ordinary single-pass answer or the three-hypothesis answer first.
3. For the divergent condition, require three hypotheses, source references, selection criteria, and rejected alternatives.
4. Verify every material source claim, then record `provenance_correct` and `provenance_total`.
5. Have the operator rate insight from 1–5 without seeing the condition label.
6. Copy `cases.template.json` to the ignored `results.json`, fill it, and run `npm run eval:divergence`.

Success requires at least 20 cases, 20% mean insight improvement, three substantively distinct hypotheses in 80% of cases, 95% provenance quality, and complete selection/rejection records. Latency and token cost should be recorded beside the report before any runtime promotion.
