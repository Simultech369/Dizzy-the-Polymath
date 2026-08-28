# Third-Party Notices & Attribution Ledger

This document contains licensing acknowledgments and clean-room provenance declarations for external projects and reference patterns that materially informed Dizzy's architecture.

---

## 1. Clean-Room Mechanism Translations (Idea & Mechanism Level)

The following projects served as reference architectures and concept inputs. All code, state machines, runtime hooks, and test suites in this repository were synthesized from first principles with zero direct code copying:

### `ClaudioDrews/memory-os`
- **Borrowing Class:** `mechanism_translation`
- **Disposition:** `add_third_party_notice`
- **Notes:** MIT license verified. Mechanism translation only.
- **Provenance Gate:** Verified clean-room implementation.

### `ClaudioDrews/project-samantha`
- **Borrowing Class:** `mechanism_translation`
- **Disposition:** `add_third_party_notice`
- **Notes:** MIT license verified. Pattern-level use only, no identity borrowed.
- **Provenance Gate:** Verified clean-room implementation.

### `ClaudioDrews/icarus-plugin`
- **Borrowing Class:** `mechanism_translation`
- **Disposition:** `add_third_party_notice`
- **Notes:** MIT license verified. Pattern-level use only.
- **Provenance Gate:** Verified clean-room implementation.

### `quarqlabs/agent-oss`
- **Borrowing Class:** `mechanism_translation`
- **Disposition:** `add_third_party_notice`
- **Notes:** Apache-2.0 license verified. Used for memory/report-only pattern thinking.
- **Provenance Gate:** Verified clean-room implementation.

### `polyxmedia/mnemos`
- **Borrowing Class:** `mechanism_translation`
- **Disposition:** `add_third_party_notice`
- **Notes:** MIT license verified. Reference pattern intake.
- **Provenance Gate:** Verified clean-room implementation.

### `EurekaClaw/EurekaClaw`
- **Borrowing Class:** `mechanism_translation`
- **Disposition:** `add_third_party_notice`
- **Notes:** Apache-2.0 license verified. Reference pattern intake.
- **Provenance Gate:** Verified clean-room implementation.

### `cmxdev1/MNEMOS`
- **Borrowing Class:** `idea_only`
- **Disposition:** `ok_no_notice_needed`
- **Notes:** No license or repository found on GitHub. Idea-level reference only.
- **Provenance Gate:** Verified clean-room implementation.

### `Panniantong/Agent-Reach`
- **Borrowing Class:** `idea_only`
- **Disposition:** `ok_no_notice_needed`
- **Notes:** MIT license verified. Scrape-only reference.
- **Provenance Gate:** Verified clean-room implementation.

### `OpenPipe/ART`
- **Borrowing Class:** `idea_only`
- **Disposition:** `ok_no_notice_needed`
- **Notes:** Apache-2.0 license verified. Model-layer reference, not runtime dependency.
- **Provenance Gate:** Verified clean-room implementation.

### `henryqin1997/statem`
- **Borrowing Class:** `mechanism_translation`
- **Disposition:** `add_third_party_notice`
- **Notes:** Apache-2.0 license verified. StateM-style pattern used.
- **Provenance Gate:** Verified clean-room implementation.

### `aeonfun/aeon`
- **Borrowing Class:** `idea_only`
- **Disposition:** `ok_no_notice_needed`
- **Notes:** MIT license verified. Architecture-study only.
- **Provenance Gate:** Verified clean-room implementation.

### `MiroShark/MiroShark`
- **Borrowing Class:** `idea_only`
- **Disposition:** `ok_no_notice_needed`
- **Notes:** AGPL-3.0 license verified. Architecture-study only, strictly quarantined.
- **Provenance Gate:** Verified clean-room implementation.

---

## 2. Standard Upstream License Attributions

### Apache License 2.0 (Reference)
```text
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

### MIT License (Reference)
```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```
