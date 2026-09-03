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
