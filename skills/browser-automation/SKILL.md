---
name: browser-automation
description: Automate browser tasks deterministically for testing, scraping, or workflow execution. Use when UI interaction is required and APIs are unavailable.
---

- Prefer API access before UI automation.
- Check browser availability, current tabs, active profile, and authentication state before acting.
- Encode waits by state, not fixed sleep.
- Add retry rules for flaky selectors.
- Treat stale element references, detached frames, navigation changes, and timeouts as distinct recovery cases.
- Capture screenshots and key DOM evidence.
- Abort on unexpected navigation or auth challenge.
- After significant UI changes, verify intended state at relevant desktop and mobile viewports.
