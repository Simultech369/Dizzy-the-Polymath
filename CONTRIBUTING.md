# Contributing to Dizzy

Welcome. Dizzy is a strictly-gated, deterministic, local-first state machine. We do not use standard unstructured LLM contribution flows. 

Before proposing a change, you must understand the rules of the OSS Model Council.

## The Core Rule: Proof Over Prose

Every single pull request or feature must be backed by a **cryptographic receipt** from the OSS Council.
We do not accept "It works on my machine" or "I ran the tests."
You must run the council audit and include the `oss_council_verdict_latest.json` in your PR packet.

If your code touches the prompt pack, the architecture, or the local execution boundaries, it *will* be subjected to the `Adversarial Red-Team` tests. If it fails, the PR will be closed.

## Where to Start

If you are new to the repository, look at the `NEXT.md` file for the **External Skill Intake Queue** or the **Hosted Production Horizon**. Good entry points include:
1. **Writing new deterministic tests:** Look in the `scripts/` directory. We always need more adversarial tests for edge cases.
2. **Integrating an MCP Server (Lane 1):** Check the intake queue in `NEXT.md` for tools like Playwright or GitHub MCP that we want to safely wrap in our governance layer.
3. **Documentation Clarifications:** Any PR that reduces cognitive load in the root directory without deleting rules is highly welcome.

## How to Develop

1. **Clone & Setup:**
   ```bash
   git clone https://github.com/Simultech369/Dizzy-the-Polymath.git
   npm install
   ```

2. **Run the Cockpit:**
   If you are testing UI/UX changes to the dashboard:
   ```bash
   DIZZY_DASHBOARD_ENABLED=1 DIZZY_ALLOW_UNAUTHENTICATED_LOCAL_CONTROL=1 npm start
   ```
   *Note: Never bypass auth for external exposure.*

3. **Verify Your Work (The Execution Gate):**
   Before submitting, you MUST run the full 3-layer council audit:
   ```bash
   npm run check:council
   ```
   This will output a `VERIFIED_PASSED` or `REJECTED` receipt in `reviews/oss_council_verdict_latest.json`.

## Scoped "Good First Issues"

If you want to contribute, here are safe entry points that do not require full architectural rewrites:

1. **Dashboard Visual Polish:** Stripping out CSS slop, gradients, or soft shadows to align with the "Air Traffic Control" anti-slop aesthetic.
2. **Memory Wiki Adapters:** Enhancing `lib/memory_wiki_adapter.mjs` to support new Markdown flavors or custom frontmatter schemas.
3. **Bounty Scanner Heuristics:** Adding new domain allowlists to `scripts/job_board_scanner.mjs` for specific freelance platforms.

## Architecture Reading Path

Do not guess how Dizzy works. Read the architecture in this order:
1. `README.md` (The Paranoia Engine concept)
2. `DESIGN.md` (The 4-Gate Pipeline and State Machine)
3. `UNIFIED_HANDOFF_PACKET.md` (The current verified state of the engine)
4. `MODEL_INVENTORY.md` (Trust zones and model assignments)

No ambient browser-cookie access. No unauthorized network egress. No undocumented prompt injection vectors. 

Welcome to the Machine Room.
