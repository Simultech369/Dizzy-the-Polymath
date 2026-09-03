## Pass 2 Review Summary

**Strongest aspects of Pass 1:** Claim 2 (simulated consensus) is well-supported by the HTML's explicit "Simulation only" warning and static PENDING nodes. Claim 4 correctly identifies that `scanProseSlopOverlay()` exists and scans for banned terms.

**Weakest aspects of Pass 1:** Several claims reference dashboard runtime behavior that depends on `/assets/dashboard.js` (not provided) or on file contents not in the context (e.g., `MEMORY_OWNERSHIP.md`, `AGENTS.md`). Claims 1, 3, 6, and 7 are either speculative or mislocated. The Pass 1 review also missed the most concrete theater issue: `maintain.mjs` exits with code 0 even when the overall status is "yellow," making yellow failures invisible to CI/CD.

---

### Item-by-Item Challenge

#### 1. Claim: Dashboard displays "production-ready" status for upgrades without sufficient evidence
- **Verdict: REJECTED**
- **Evidence:** The provided `dashboard/index.html` contains no "production-ready" badge or status for upgrades. The `upgradeStatus()` function in `scripts/maintain.mjs` returns only `"green"` or `"yellow"`. The `production_readiness_check.mjs` is referenced in `CHECKS` but its code is not provided, so we cannot confirm what it validates. The claim appears to be fabricated or inferred from a runtime state we cannot see.
- **Severity downgrade:** The underlying concern about `production_readiness_check.mjs` being a yellow-severity check with no visible criteria is valid, but the specific claim about the dashboard is unsupported.

#### 2. Claim: Pluralistic consensus simulates static coordination, not real-time votes
- **Verdict: CONFIRMED (strengthened)**
- **Evidence:** The dashboard HTML contains an explicit warning: `<strong>Simulation only:</strong> Not a cryptographically secure consensus mechanism.` The SVG nodes (`CDX`, `OCD`, `AGV`) all show static `PENDING` text with no dynamic update mechanism in the provided HTML. The `coordinate-map` and `operator-signoff`/`veto-override` buttons have no inline event handlers—their behavior depends entirely on the external `/assets/dashboard.js` which is not provided.
- **Severity:** High (confirmed). The governance section is entirely decorative without the missing JS.

#### 3. Claim: MEMORY_OWNERSHIP.md is missing critical files
- **Verdict: REJECTED (unverifiable)**
- **Evidence:** The `memoryOwnershipStatus()` function in `scripts/maintain.mjs` checks for specific surface strings within `MEMORY_OWNERSHIP.md`, but the actual content of that file is not provided in the context. The claim asserts a specific deficiency without evidence. The function itself is sound—it correctly returns `"yellow"` if any required surface is missing—but we cannot confirm whether the file actually has gaps.
- **Note:** The function's `required` list includes `memory/YYYY-MM-DD.md` which is a date-patterned file. If the actual `MEMORY_OWNERSHIP.md` doesn't contain this literal string (as opposed to a description of the pattern), the check would flag it as missing even if the pattern is conceptually covered. This is a subtle implementation concern but not a confirmed theater claim.

#### 4. Claim: Anti-slop prose scan shows no findings on dashboard but `scanProseSlopOverlay()` finds issues
- **Verdict: REFINED — mislocated**
- **Evidence:** The anti-slop prose scan findings are rendered in the `maintain.mjs` console output (lines with `[yellow] Anti-slop prose scan`), NOT in the dashboard HTML. The dashboard has no prose scan section at all. The claim conflates two different surfaces. Whether `scanProseSlopOverlay()` actually finds issues depends on the content of the scanned files (`AGENTS.md`, `DESIGN.md`, etc.), which are not provided.
- **Additional finding:** The `scanProseSlop` function uses `String.includes()` for `BANNED_AFFIRMATION_FILLER` phrases rather than word-boundary regex, which can produce false positives (e.g., "in conclusion" matching inside a word boundary context). This is a real code quality issue but separate from the theater claim.

#### 5. Claim: Prompt pack lacks tests for stability/drift detection
- **Verdict: REFINED — overstated**
- **Evidence:** `scripts/maintain.mjs` includes a `prompt_drift_check.mjs` check in the `CHECKS` array with yellow severity. The claim that `maintain.mjs` "lacks tests verifying prompt stability" is incorrect—there IS a drift check configured. Whether `prompt_drift_check.mjs` actually validates stability is unverifiable since its code is not provided.
- **Severity downgrade:** The concern about prompt drift detection is valid but the specific claim of absence is contradicted by the existing check configuration.

#### 6. Claim: Safety checks banner claims "all red-severity checks passed"
- **Verdict: REJECTED**
- **Evidence:** The provided `dashboard/index.html` contains no "safety checks banner" whatsoever. There is no element that displays red/green check results for safety. The claim appears to reference runtime JavaScript behavior from `/assets/dashboard.js` which is not provided. This is a fabrication within the Pass 1 review.

#### 7. Claim: Automation consent shows green despite malformed entries
- **Verdict: REJECTED (unverifiable)**
- **Evidence:** `automationConsentStatus()` correctly returns `"yellow"` when malformed entries exist and `"green"` when there are none or no receipts at all. The dashboard receipt panel renders dynamically from API responses we cannot see. Without the actual `runtime/automation_receipts.jsonl` content, this claim cannot be verified.

---

### New Findings (Missed by Pass 1)

#### NEW-1: Exit code ignores yellow status
- **Claim:** `maintain.mjs` sets `overall = "yellow"` for soft failures but exits with code 0 (`process.exit(hardFailures.length ? 1 : 0)`), meaning yellow-severity issues are silently swallowed by CI/CD.
- **Evidence:** Line `process.exit(hardFailures.length ? 1 : 0)` only exits non-zero for red failures. Yellow findings (soft failures, stale signals, prose slop, etc.) produce a `"yellow"` overall status but exit code 0.
- **Severity:** High — this is a real theater issue where the dashboard/maintenance output signals problems but the process exit code tells CI/CD everything is fine.
- **Location:** `scripts/maintain.mjs`, `main()` function exit logic.

#### NEW-2: `dev-only` CSS class hides governance disclaimers from non-developers
- **Claim:** The governance and sandbox panels are marked `dev-only` and hidden when `body.dev-mode-off` is set. The default body class is not `dev-mode-off`, but the CSS rule `body.dev-mode-off .dev-only { display: none !important; }` means these panels (with the simulation-only warnings) are hidden by default unless dev mode is toggled on.
- **Evidence:** The sandbox panel has class `console-panel-receipt dev-only`. The governance panels have `dev-only` class on several metric rows. The warning banners inside these panels say "Simulation only" — but regular users won't see these warnings.
- **Severity:** Medium — the disclaimers about simulation/non-cryptographic status are hidden from the default view.
- **Location:** `dashboard/index.html`, CSS and HTML class structure.

#### NEW-3: `BANNED_AFFIRMATION_FILLER` uses substring matching instead of word boundaries
- **Claim:** The `scanProseSlop` function matches `BANNED_AFFIRMATION_FILLER` phrases using `String.includes()` rather than word-boundary regex, unlike the `BANNED_PROSE_TELLS` which use `\b` regex boundaries.
- **Evidence:** In `anti_slop_scanner.mjs`, the prose tells loop uses `new RegExp(`\\b${escapeRegExp(term)}\\b`, "i")` while the affirmation filler loop uses `lowerLine.includes(phrase)`. This means "in conclusion" could match inside a larger word or phrase context where it's not actually a filler phrase.
- **Severity:** Medium — potential for false positives in the scanner.
- **Location:** `lib/anti_slop_scanner.mjs`, `scanProseSlop()` function, second for-loop.

#### NEW-4: `scanProseSlop` default `maxAllowed` is 0, making `passed` false for any finding
- **Claim:** The `scanProseSlop` function defaults `maxAllowed` to 0 (`options.maxAllowed ?? 0`), so any single finding causes `passed` to be `false`. The `maintain.mjs` calls `scanProseSlop()` without passing `maxAllowed`, meaning the overlay scan always treats any finding as a failure.
- **Evidence:** In `anti_slop_scanner.mjs`: `const maxAllowedFindings = options.maxAllowed ?? 0;` and `const passed = findings.length <= maxAllowedFindings;`. In `maintain.mjs`: `scanProseSlop(fs.readFileSync(abs, "utf8"))` — no options passed.
- **Severity:** Low-Medium — this is a design choice (zero-tolerance for prose slop in scanned docs) but could be unintentional if the caller expected a more lenient default.
- **Location:** `lib/anti_slop_scanner.mjs` line with `options.maxAllowed ?? 0`; `scripts/maintain.mjs` `scanProseSlopOverlay()` call.