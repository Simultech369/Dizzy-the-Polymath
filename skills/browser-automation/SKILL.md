---
name: browser-automation
description: Automate browser tasks deterministically for testing, scraping, or workflow execution. Use when UI interaction is required and APIs are unavailable.
---

- Prefer API access before UI automation.
- Encode waits by state, not fixed sleep.
- Add retry rules for flaky selectors.
- Capture screenshots and key DOM evidence.
- Abort on unexpected navigation or auth challenge.