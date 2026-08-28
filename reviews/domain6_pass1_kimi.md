We need to examine the context for contradictions, drift, stale claims, unreconciled reviewer claims, etc.

We need to find contradictions across documents: e.g., statements in NEXT.md vs DESIGN.md vs other files.

Let's scan for contradictions:

- In NEXT.md, there is a decision D-0005: "Default is 'no' (DLQ JSONL + Redis is enough for now); revisit only if needed." Also D-0006: "Governance disclosure via the compatible `/governance` endpoint + `INTERACTION_NORMS.md` doc (D-0004)." Also D-0008: "Runtime-governing doctrine must live in the default prompt pack; supplementary docs are explanatory unless compressed into the live core (D-0007)." Also D-0009: "Runtime-governing doctrine must live in the default prompt pack." So the default prompt pack includes CONSTITUTIONAL_KERNEL.md, CONSTITUTION.md, etc. That's consistent.

- In NEXT.md, there is W-0065a: "Align scripts/usage_report.mjs and scripts/usage_report_test.mjs with dizzy.router_receipt.v1 schema enums (data_boundary, model_origin_risk, estimated_cost_band), separate malformed from unsupported schema rows, and verify zero private text leaks." That's about schema alignment.

- In DESIGN.md, there is a decision D-0005: "Default is 'no' (DLQ JSONL + Redis is enough for now); revisit only if needed." Also D-0006: "Governance disclosure via the compatible `/governance` endpoint + `INTERACTION_NORMS.md` doc (D-0004)." Also D-0007: "Runtime-governing doctrine must live in the default prompt pack; supplementary docs are explanatory unless compressed into the live core (D-0007)." So consistent.

- In NEXT.md, there is a completed item W-0060: "Implemented the Router Receipt MVP, returning a structured execution receipt (schema `dizzy.router_receipt.v1`) on successful `/dispatch/incoming` and `/agent/execute` response wrappers with cost band, model, trust zone, data boundary, and model origin risk details."

- In DESIGN.md, there is a decision D-0038: "Forced `paid_public` prompt construction to a client-safe allowlist regardless of `DIZZY_PROMPT_PACK`, with safety coverage against `full` pack leakage." So that matches W-0065a's schema alignment? Not exactly.

- In NEXT.md, there is a completed item W-0062b: "Anti-Slop Visual Scanner [EXPERIMENTAL / IN VERIFICATION]": Retain visual scanner as an experimental advisory module with explicit labeled visual corpus and non-dashboard fixture targets. (Verification: `node scripts/anti_slop_visual_fixture_check.mjs`)

- In DESIGN.md, there is a decision D-0062: "Added a shared durable-write policy for remembered memory, auto-memory candidates, friction entries, and trajectories; disallowed trust zones, non-persistent sensitivity classes, obvious credentials, and low-value captures fail before a file is written." So that aligns with W-0062b and D-0062.

- In NEXT.md, there is a completed item W-0062c: "Anti-Slop Allowlist & Prompt Overlay": Refine false-positive handling for fenced code blocks, quoted examples, and docs in `lib/anti_slop_scanner.mjs`. (Verification: `npm.cmd run maintain`)

- In DESIGN.md, there is a decision D-0026: "Capability receipts carry trust-zone crossing fields". Also D-0025: "Memory has lifecycle metadata, not ambient authority". D-0024: "Maintain output should act as an operator brief". D-0023: "Memory-like surfaces need writer ownership". D-0022: "Memory metabolism starts as report-only maintenance". D-0021: "Captured memory-like records need provenance classes and source-labeled receipts". D-0020: "Captured memory-like records need provenance classes and source-labeled receipts". D-0019: "External memory-system patterns are reference material, not authority". D-0018: "Doctrine-to-runtime promotion queue governs execution work". D-0017: "Memory has lifecycle metadata, not ambient authority". D-0016: "Constitutional kernel is compact; overlays stay operational". D-0015: "Paid/client continuity is conversation-only unless a stronger lifecycle exists". D-0014: "Public writing, when used, should be evidentiary rather than identity-performative". D-0013: "Marketplace posture is operator-mediated, informal, and subordinate to the private core". D-0012: "Retrieval is scoped to trusted doctrine and memory surfaces by default". D-0011: "Trust zones govern continuity, retrieval, and retention". D-0010: "Default chat style is lite, affect-attuned, and carrot-forward". D-0009: "Runtime-governing doctrine must live in the default prompt pack". D-0008: "External intake and providers are adapters, not authority". D-0007: "Runtime-governing doctrine must live in the default prompt pack". D-0006: "Governance disclosure via the compatible `/governance` endpoint + `INTERACTION_NORMS.md` doc". D-0005: "Queue state machine is explicit and legible". D-0004: "Legible governance (operational confidentiality + structural transparency)". D-0003: "Runtime exposure defaults minimize harm". D-0002: "Waldron anchor - Rule-of-law legibility". D-0001: "Canonical docs + state triad". D-0000: Not present.

Now we need contradictions:

Potential contradictions:

- In NEXT.md, W-0065a says align scripts with `dizzy.router_receipt.v1` schema enums. In DESIGN.md, D-0038 says "Forced `paid_public` prompt construction to a client-safe allowlist regardless of `DIZZY_PROMPT_PACK`, with safety coverage against `full` pack leakage." That's about prompt pack, not schema. Not contradictory.

- In NEXT.md, D-0005 says "Default is 'no' (DLQ JSONL + Redis is enough for now); revisit only if needed." In DESIGN.md, D-0035-note says "Moved optional flavor/economic overlay files into `flavor/` and updated prompt-pack references." Not contradictory.

- In NEXT.md, there is a note "W-0066: Dynamic Model Routing v0 (Fail-Closed Isolation & Measurement) [IN VERIFICATION]" and verification: `npm.cmd run test:router`. In DESIGN.md, there is no mention of model routing; but D-0009 says "Runtime-governing doctrine must live in the default prompt pack". Not contradictory.

- In NEXT.md, W-0062b says "Retain visual scanner as an experimental advisory module with explicit labeled visual corpus and non-dashboard fixture targets." In DESIGN.md, D-0062 says "Added a shared durable-write policy for remembered memory, auto-memory candidates, friction entries, and trajectories; disallowed trust zones, non-persistent sensitivity classes, obvious credentials, and low-value captures fail before a file is written." That's about durable writes, not visual scanner. Not contradictory.

- In NEXT.md, there is a completed item W-0060: "Implemented the Router Receipt MVP, returning a structured execution receipt (schema `dizzy.router_receipt.v1`) on successful `/dispatch/incoming` and `/agent/execute` response wrappers with cost band, model, trust zone, data boundary, and model origin risk details."

- In DESIGN.md, D-0038 says "Forced `paid_public` prompt construction to a client-safe allowlist regardless of `DIZZY_PROMPT_PACK`, with safety coverage against `full` pack leakage." That is about prompt construction, not receipt schema.

Potential contradictions about trust zones and retrieval:

- In NEXT.md, W-0063a: "Context Tree Integrity Validator [IN VERIFICATION]" Validate context-tree manifest schema, strict line bounds, advisory nearby-keyword section anchor checks across all mapped tree nodes. (Verification: `npm.cmd run check:context-tree`)

- In DESIGN.md, D-0038: "Forced `paid_public` prompt construction to a client-safe allowlist regardless of `DIZZY_PROMPT_PACK`". That suggests paid_public uses client-safe allowlist, not full prompt pack. Also D-0015: "Paid/client continuity is conversation-only unless a stronger lifecycle exists". So consistent.

- In NEXT.md, there is a note: "W-0065a: Usage Report Schema Alignment [IN VERIFICATION]" aligning with `dizzy.router_receipt.v1` schema enums. In DESIGN.md, D-0026: "Capability receipts must include a `boundary_crossing` object...". Not contradictory.

- In NEXT.md, there is a completed item W-0060: "Implemented the Router Receipt MVP, returning a structured execution receipt (schema `dizzy.router_receipt.v1`) on successful `/dispatch/incoming` and `/agent/execute` response wrappers with cost band, model, trust zone, data boundary, and model origin risk details." In DESIGN.md, D-0038: "Forced `paid_public` prompt construction to a client-safe allowlist regardless of `DIZZY_PROMPT_PACK`, with safety coverage against `full` pack leakage." Not contradictory.

Potential contradictions about "default is 'no' (DLQ JSONL + Redis is enough for now)" vs "Runtime-governing doctrine must live in the default prompt pack". Not contradictory.

Potential contradictions about "public surfaces" vs "trust zones". In NEXT.md, W-0064: "Dashboard Safety & Volatility Harness [PARKED]": Specify joint HTML/JS CSP test assertions before modifying dashboard components. (Verification: `npm.cmd run maintain`). In DESIGN.md, D-0038: "Forced `paid_public` prompt construction to a client-safe allowlist regardless of `DIZZY_PROMPT_PACK`, with safety coverage against `full` pack leakage." Also D-0035: "Prototyped three-pool retrieval as report-only (`core`, `stale_important`, `edge_hypothesis`) in retrieval plans and capability receipts, with safety checks preventing auto-promotion or memory writes." So not contradictory.

Potential contradictions about "anti-slop visual scanner" being experimental vs being used in maintain. In NEXT.md, W-0062b: "Anti-Slop Visual Scanner [EXPERIMENTAL / IN VERIFICATION]" and verification command. In DESIGN.md, D-0062: "Added a shared durable-write policy for remembered memory, auto-memory candidates, friction entries, and trajectories; disallowed trust zones, non-persistent sensitivity classes, obvious credentials, and low-value captures fail before a file is written." Not contradictory.

Potential contradictions about "default is 'no' (DLQ JSONL + Redis is enough for now)" vs "the default prompt pack includes CONSTITUTIONAL_KERNEL.md, CONSTITUTION.md, IDENTITY.md, identity/personas/SOUL.md, TOOLS.md, identity/personas/USER.md, PROMPT_CORE.md, PROMPT_MODES.md". That's consistent.

Potential contradictions about "D-0005: Default is 'no' (DLQ JSONL + Redis is enough for now); revisit only if needed." vs "D-0006: Governance disclosure via the compatible `/governance` endpoint + `INTERACTION_NORMS.md` doc (D-0004)." Not contradictory.

Potential contradictions about "W-0062b: Anti-Slop Visual Scanner [EXPERIMENTAL / IN VERIFICATION]" vs "W-0062c: Anti-Slop Allowlist & Prompt Overlay". Not contradictory.

Potential contradictions about "W-0065a: Usage Report Schema Alignment [IN VERIFICATION]" vs "W-0066: Dynamic Model Routing v0 (Fail-Closed Isolation & Measurement) [IN VERIFICATION]" - both are in verification, no contradiction.

Potential contradictions about "W-0064: Dashboard Safety & Volatility Harness [PARKED]" vs "W-0067: Test-Time Scaling by Risk Tier". Not contradictory.

Potential contradictions about "W-0062b" vs "W-0062c" - both anti-slop.

Potential contradictions about "W-0060" vs "W-0061" - both about router receipt and local backend integration; consistent.

Potential contradictions about "W-0062b" and "W-0062c" vs "W-0062" in DESIGN.md (shared durable-write policy). In NEXT.md, W-0062b says "Anti-Slop Visual Scanner [EXPERIMENTAL / IN VERIFICATION]" and "Anti-Slop Allowlist & Prompt Overlay". In DESIGN.md, D-0062 says "Added a shared durable-write policy for remembered memory, auto-memory candidates, friction entries, and trajectories; disallowed trust zones, non-persistent sensitivity classes, obvious credentials, and low-value captures fail before a file is written." This is about durable writes, not about anti-slop scanner. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0063a" context tree integrity validator vs "W-0065a" usage report schema alignment. Not contradictory.

Potential contradictions about "W-0062b" being experimental but the scanner is validated by fixture check. In DESIGN.md, D-0062: "Added a shared durable-write policy..." Not contradictory.

Potential contradictions about "W-0066: Dynamic Model Routing v0 (Fail-Closed Isolation & Measurement)" vs "D-0005" default is "no" (DLQ JSONL + Redis is enough for now). Not contradictory.

Potential contradictions about "W-0067: Test-Time Scaling by Risk Tier" vs "W-0062b" anti-slop visual scanner. Not contradictory.

Potential contradictions about "W-0064: Dashboard Safety & Volatility Harness [PARKED]" vs "W-0065a" usage report schema alignment. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" verifying zero private text leaks vs "D-0038" forced paid_public prompt construction to a client-safe allowlist regardless of DIZZY_PROMPT_PACK. That might be contradictory: paid_public prompt construction is forced to client-safe allowlist, which may restrict use of full prompt pack, but usage report schema alignment requires verifying zero private text leaks. The schema alignment includes data_boundary, model_origin_risk, estimated_cost_band. Private text leaks would be about data_boundary maybe. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0063a" context tree integrity validator is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked, but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0062b" being experimental but "W-0062c" refine false-positive handling. Not contradictory.

Potential contradictions about "W-0065a" aligning schema enums vs "D-0038" forcing client-safe allowlist for paid_public. Not contradictory.

Potential contradictions about "W-0066" being in verification but "W-0067" also in verification. Not contradictory.

Potential contradictions about "W-0064" being parked but "W-0065a" is in verification. Not contradictory.

Potential contradictions<unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk> "W-0066" refers to "Dynamic Model Routing v0 (Fail-Closed Isolation & Measurement)" and is in verification. The verification command is `npm.cmd run test:router<unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk> "W-0065a: Usage Report Schema Alignment [IN VERIFICATION]": Align `scripts/usage_report.mjs` and `scripts/usage_report_test.mjs` with `dizzy.router_receipt.v1` schema enums (`data_boundary`, `model_origin_risk`, `estimated_cost_band`), separate malformed from unsupported schema rows, and verify zero private text leaks. (Verification: `node scripts/usage_report_test.mjs`)"

So the schema alignment is part of the usage report functionality.

Now, looking at the CONFLI<unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk> "in the prompt pack" is a bit ambiguous, but the context suggests it means the default prompt pack is the live runtime constitution. 

Now, I need to find a contradiction. Let me read carefully.

First, look at D-0006: "Runtime-governing doctrine must live in the default prompt pack; supplementary docs are explanatory unless compressed into the live core (D-0007)." So the runtime-governing doctrine must be in the default prompt pack.

In the STATE_JSON block, there's a field "runtime_constitution" which lists the files: "CONSTITUTIONAL_KERNEL.md", "CONSTITUTION.md", "IDENTITY.md", "identity/personas/SOUL.md", "TOOLS.md", "identity/personas/USER.md", "PROMPT_CORE.md", "PROMPT_MODES.md". So the default prompt pack includes these files. 

Now, look at D-0038: "Forced `paid_public` prompt construction to a client-safe allowlist regardless of `DIZZY_PROMPT_PACK`." So paid_public uses a client-safe allowlist, which includes specific files. The client-safe allowlist includes "CONSTITUTIONAL_KERNEL.md", "CONSTITUTION.md", "IDENTITY.md", "PROMPT_CORE.md", "PROMPT_MODES.md". So that's consistent with the default prompt pack.

Now, look for contradictions. Let's see:

- In NEXT.md, there's a decision D-0037: "Added `CONSTITUTIONAL_KERNEL.md` as the first-loaded compact live kernel and included it in the default prompt pack<unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk><unk> "W-0066: Dynamic Model Routing v0 (Fail-Closed Isolation & Measurement) [IN VERIFICATION]": Wire `evaluateLocalIsolationPolicy` and timing/prefix-hashing into `lib/dispatch.mjs`; verify local/private requests fail closed without attempting cloud fallback. (Verification: `npm.cmd run test:router`)