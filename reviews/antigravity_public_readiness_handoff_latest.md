# Dizzy: Public Readiness & UI Polish Handoff

**Context:** Dizzy is preparing for potential public attention and onboarding external collaborators. We need to shift from "engine building" to "curb appeal"—ensuring the READMEs and UI reflect the rigor of the underlying state machine.

## 1. README.md Overhaul
The main `README.md` needs to immediately hook engineers and collaborators.
**Tasks for Codex:**
*   **The Hook:** Update the intro to explicitly state the new positioning: *"Dizzy treats AI models like zero-trust microservices—sandboxed, deterministic, and required to prove their work through cryptographic receipts."*
*   **Architecture Diagram:** Add a Mermaid diagram illustrating the flow: `Bounty Ingress` -> `Local OSS Council (Llama/Qwen)` -> `StateM Runbook` -> `Frontier Arbiter`.
*   **Local-First Quickstart:** Add a clear "Getting Started" section showing how to boot the OSS Council using local models (e.g., pointing `openclaude` / `zero` to a local Ollama or LMStudio port) so collaborators can run it at zero cost.
*   **Trust & Provenance:** Prominently link `THIRD_PARTY_NOTICES.md` and `PRODUCTION_READINESS.md` to prove the clean-room, zero-dependency architecture.

## 2. Machine Room HUD (UI Elements)
The current `dashboard/index.html` is functional but needs to look like a professional "Cockpit" if we are showing it publicly.
**Tasks for Codex:**
*   **Aesthetic (Impeccable Anti-Slop):** Upgrade the styling to a strict, functional "Machine Room" aesthetic inspired by `pbakaus/impeccable`. Avoid all "AI slop" clichés: NO purple gradients, NO dark neon glows, and NO bouncy easings. Use brutalist, crisp contrasts, strict line heights, legible line lengths, and generous touch targets. Think utilitarian terminal meets highly refined dashboard.
    *   ⚠️ **UI Skill Conflict Warning for Codex:** If you (Codex) are running with the `nextlevelbuilder/ui-ux-pro-max-skill` enabled, you will experience a direct policy conflict. `ui-ux-pro-max-skill` frequently injects "modern SaaS" templates featuring heavy shadows, glows, and gradients. You **must** override these templates to comply with `impeccable`'s strict anti-slop rules. Strip the glows, flatten the shadows, and remove the gradients from any components before injecting them into `dashboard/index.html`.
*   **Three-Pane Layout:** Implement the specified Zone A/B/C layout:
    *   *Pane A (Left):* Ingress Queue & Live Telemetry (showing the Redis/Queue throughput).
    *   *Pane B (Center):* Council Tension Map (visualizing agreement/disagreement between local models).
    *   *Pane C (Right):* Execution Receipts & StateM runbook status.
*   **Mock Data Fallback:** Ensure the UI renders beautifully with the `artifacts/bounty_scan_results.json` mock data if a live local backend isn't attached during a demo.

## 3. Last-Minute Cleanup & Loose Threads
**Tasks for Codex:**
*   **D-0039 Resolution:** Formally remove D-0039 from the `NEXT.md` "Open Decisions" queue and document its closure, as the staging boundary is now fully defined.
*   **Secrets & Paths Check:** Do a final sweep of `scripts/job_board_scanner.mjs` and test fixtures to ensure no local hardcoded `C:/Users/Josh/...` paths or dummy tokens will break on a collaborator's Unix/Mac machine. Use `path.resolve()` and `process.cwd()` universally.
*   **Package.json:** Ensure the `npm run check:council` command is documented as the primary test command for any new contributor.
