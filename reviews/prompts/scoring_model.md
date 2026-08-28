# Cross-Model Output Weighting & Severity Scoring Model

## Weighting Factors

| Factor | Weight | Scoring Guidance |
|--------|--------|------------------|
| **Agreement across models** | 0.35 | Both models raise similar issue → high confidence |
| **Specificity of evidence** | 0.25 | Exact location + counter-example > vague concern |
| **Exploitability / impact** | 0.20 | Concrete attack path or data-loss scenario scores higher |
| **Model specialty match** | 0.10 | Domain-specialist model finding weighted higher |
| **Novelty (only one model)** | 0.10 | New finding from Pass 2 is kept but starts lower |

## Severity Mapping (After Weighting)

- **Critical**: Direct security/privacy break, data loss, or invariant violation with clear path
- **High**: Likely real issue, strong evidence, meaningful impact
- **Medium**: Plausible issue, partial evidence, or limited impact
- **Low**: Style, minor inconsistency, or low-probability edge case

## Disagreement Rule
If models conflict, prefer the finding that supplies a minimal reproducible case. Mark the other as REJECTED or DEFERRED with rationale.
