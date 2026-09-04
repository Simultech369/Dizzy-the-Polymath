# External Pattern License Audit

Status: open retrospective audit
Date opened: 2026-08-24
Scope: external repositories and projects that materially influenced Dizzy docs, mechanisms, tests, prompts, or runtime code.

This is a provenance and license hygiene surface. It is not legal advice, not a claim that infringement occurred, and not proof that attribution is complete.

## Why This Exists

Dizzy has intentionally learned from external projects as reference material. That is acceptable only when the boundary stays clear:

- ideas and mechanisms may be translated,
- copied code/prose/structure requires license review,
- public/client-facing surfaces must not launder provenance,
- external clone inventory is not proof of first-party capability,
- attribution, NOTICE, modification marking, or removal must happen before distribution if required.

Apache-2.0 is permissive but not attribution-free. For Apache-2.0 sources, audit against the official license text, including retained notices, changed-file marking, and NOTICE carry-forward duties:

https://www.apache.org/licenses/LICENSE-2.0

## Audit Method

For each source:

1. Identify source repository/project and exact revision if available.
2. Record upstream license and whether a NOTICE file exists.
3. Classify what crossed over:
   - `idea_only`
   - `mechanism_translation`
   - `distinctive_structure`
   - `prose`
   - `tests_or_fixtures`
   - `code`
   - `dependency_or_vendor`
4. Record local files potentially influenced.
5. Decide disposition:
   - `ok_no_notice_needed`
   - `add_attribution`
   - `add_third_party_notice`
   - `mark_modified_files`
   - `rewrite_from_first_principles`
   - `remove`
   - `needs_legal_review`
6. Capture evidence: license path, diff/source comparison notes, and verification commands.

## Known/Carried Sources To Review

| Source | Status | Borrowing class | Disposition | Current notes | Required next action |
| --- | --- | --- | --- | --- | --- |
| `ClaudioDrews/memory-os` | audited | `mechanism_translation` | `add_third_party_notice` | MIT license verified. Mechanism translation only. | None |
| `ClaudioDrews/project-samantha` | audited | `mechanism_translation` | `add_third_party_notice` | MIT license verified. Pattern-level use only, no identity borrowed. | None |
| `ClaudioDrews/icarus-plugin` | audited | `mechanism_translation` | `add_third_party_notice` | MIT license verified. Pattern-level use only. | None |
| `quarqlabs/agent-oss` | audited | `mechanism_translation` | `add_third_party_notice` | Apache-2.0 license verified. Used for memory/report-only pattern thinking. | None |
| `polyxmedia/mnemos` | audited | `mechanism_translation` | `add_third_party_notice` | MIT license verified. Reference pattern intake. | None |
| `EurekaClaw/EurekaClaw` | audited | `mechanism_translation` | `add_third_party_notice` | Apache-2.0 license verified. Reference pattern intake. | None |
| `cmxdev1/MNEMOS` | audited | `idea_only` | `ok_no_notice_needed` | No license or repository found on GitHub. Idea-level reference only. | None |
| `Panniantong/Agent-Reach` | web license observed; not locally cloned | `idea_only` | `ok_no_notice_needed` | MIT license verified. Scrape-only reference. Must avoid cookie/session/egress risk | Verify license |
| `OpenPipe/ART` | web license observed; not locally cloned | `idea_only` | `ok_no_notice_needed` | Apache-2.0 license verified. RULER/GRPO model-layer reference, not runtime dependency. | Verify license |
| `henryqin1997/statem` | web license observed; not locally cloned | `mechanism_translation` | `add_third_party_notice` | Apache-2.0 license verified. runbook/FSM/StateM-style pattern used. | Verify license |
| `aeonfun/aeon` | web license observed; not locally cloned | `idea_only` | `ok_no_notice_needed` | MIT license verified. Quarantine clone path: `_external/aeonfun-aeon`. | audit exact license file |
| `MiroShark/MiroShark` | web license observed; not locally cloned | `idea_only` | `ok_no_notice_needed` | AGPL-3.0 license verified. Quarantine clone path: `_external/miroshark-miroshark`. architecture-study only | None |

## Release Gate

Before public/client-facing distribution or a broad W-0068 staging claim:

- Complete this audit for sources that materially shaped the candidate diff.
- If copied code/prose/structure is found, either add the required attribution/notice path or rewrite/remove it.
- If attribution is required across multiple sources, create `THIRD_PARTY_NOTICES.md` or a narrower source-level notice file and link it from the relevant docs.
- Do not use external-source names in public capability language unless attribution is intentional and reviewed.

## Python Council Sidecar Provenance & Promotion Checklist

Status: quarantined offline research sidecar (`scratch/council_engine/`)
Audited date: 2026-09-04
Scope: `bridge_rehearsal_runner.py`, `task_delegation_router.py`, `bounty_adversarial_assembly_line.py`, `opportunity_a2a_workflow_engine.py`
Defect receipt: `reviews/quarantine_defect_receipt_python_sidecar.md` (`advisory_receipt`)
Bridge contract: `docs/node_python_council_bridge_contract.md`

### Provenance & Licensing Status
- **Origin**: Internal scratch engineering prototype developed in Antigravity session scratch space (`council_engine/`).
- **External Code Borrowing**: None. Synthesized from first principles with zero direct code or distinctive structure copied from external repos. No unmanaged external dependencies or LLM model-call APIs imported.
- **Authority / Runtime Boundary**: Quarantined offline. Does not run in production path or govern live Node runtime. It is treated as offline research evidence and evaluation fixture material.

### Promotion Blockers
Before any component of the Python Council sidecar can be promoted into the live repo tree or test suite, the following technical gates must be cleared:

1. **Bridge Payload Integrity & Hash Scope**:
   - Original finding: `bridge_rehearsal_runner.py` accepted a tampered title with a reused hash because it only checked for `payload_sha256` presence.
   - Follow-up sidecar probe: the quarantined runner now recomputes a compact sorted-key SHA-256 and rejects a tampered title with the old digest. This is sidecar repair evidence only.
   - Remaining contract blocker: the repaired sidecar currently overloads `bounty_task.payload_sha256` as the full bridge payload digest. W-0112 reserves `integrity.payload_sha256` for the full bridge payload digest and preserves `payload.bounty_task.payload_sha256` as the task-level digest.
   - *Requirement*: Satisfy the Node-owned W-0112 contract fixture before emitting dispatch receipts that count beyond rehearsal evidence.

2. **Rigorous Clean-Room Provenance Verification**:
   - `bounty_adversarial_assembly_line.py` (line 83) currently uses a naive placeholder heuristic (checking `len > 0` and absence of `"Borrowed without attribution"` marker) to declare clean-room provenance verified.
   - *Requirement*: Replace naive string check with deterministic AST-level license/provenance scanning, exact token matching, or hash-bound clean-room proof oracles.

3. **Narrow Mechanism Promotion Only**:
   - Do not promote the entire Python sidecar monolith into the runtime.
   - Promote only narrow, well-bounded mechanisms: specifically tests, fixtures, or a document-backed bridge specification first.
   - A repaired sidecar can provide `rehearsal_receipt` evidence; runtime authority still requires a `promotion_receipt` from the Node council gate.
