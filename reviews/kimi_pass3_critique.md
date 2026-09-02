# Dizzy Operator HUD & Core Libraries: Audience Advocate Critique (Pass 3)

**Role**: Audience Advocate
**Target File**: `<local-clawd-checkout>\reviews\kimi_pass3_critique.md`
**Date**: July 16, 2026

---

## Executive Summary

An audit of the Dizzy Operator HUD (`dashboard/index.html`, `dashboard/dashboard.js`) and core system libraries (`lib/dashboard.mjs`, `lib/options_projection.mjs`, `lib/scenario_simulator.mjs`, `lib/friction_ledger.mjs`) reveals a high amount of cognitive friction, visual bugs, safety hazards in hotkey triggers, and architectural inefficiencies. 

While the interface is designed to simulate a high-tech "tactical terminal" with 3D parallax movements and flashing indicators, it suffers from several major design and implementation flaws:
1. **Critical Visual Bugs**: Key frame animations for status indicators are completely missing from CSS, leaving the Spectral Pulse static.
2. **Safety & Usability Risks**: Global single-character hotkeys without modifiers can trigger expensive or destructive backend executions, and critical shortcuts like `Tab` are advertised but not implemented.
3. **Performance Overhead & Disk Wear**: Every request to the main dashboard data endpoint triggers a fake "isolated" file system simulation that performs unnecessary disk writes and deletes.
4. **Calculational & Logic Failures**: The baseline simulation is invoked with empty objects, causing `NaN` propagation and rendering the default data calculations corrupt.
5. **Operator Blindspots**: Key system metrics (such as memory usage and compression ratios) are hidden behind a developer mode toggle by default, while the Sieve Retrieval Tester hides the actual snippet content behind opaque hashes, preventing validation.

This critique breaks down these friction points with specific code references and outlines a prioritized roadmap to reduce cognitive load and improve responsiveness.

---

## 1. Visual Presentation & Cognitive Load (Stress Bar, Spectral Pulse, Sparklines)

### A. Stress Bar (Header Tension Indicator)
* **Code Reference**: `dashboard/index.html` (Lines 887-903), `dashboard/dashboard.js` (Lines 1049-1065)
* **Friction Analysis**: 
  - **Diminished Visibility**: The `.stress-bar` has a height of only `2px` and is positioned at the absolute bottom of the header. During high-tension scenarios, an operator needs immediate, high-salience indicators. A 2px bar is easily missed.
  - **Constant Gradient Clutter**: The bar is rendered using a linear gradient spanning from emerald (green) to amber (yellow) to rose (red). Rather than representing a clear, unified level (e.g. green for low, red for high), the bar always displays all three colors. Only the midpoint colors shift. This color mixing makes it difficult to read at a glance.
  - **Hover Dependency**: The actual numeric Z-score is only available via the element's `title` attribute, forcing the operator to pause, aim, and hover to get the exact value.

### B. Spectral Pulse (Header Status Orb)
* **Code Reference**: `dashboard/index.html` (Lines 905-926), `dashboard/dashboard.js` (Lines 1067-1074)
* **Friction Analysis**:
  - **Missing Animation Bug**: The CSS classes `.spectral-orb.normal` and `.spectral-orb.anomaly` reference `pulse-slow` (3s) and `pulse-rapid` (0.6s) animations. However, **neither `@keyframes pulse-slow` nor `@keyframes pulse-rapid` are defined anywhere in the CSS stylesheet**. The orb remains static, defeating the "pulse" design.
  - **Visual Alarm Fatigue**: If the animations were defined, a `0.6s` rapid pulsing red light in the header under high-friction states is highly distracting and increases anxiety. The operator's peripheral vision is constantly assaulted by high-frequency flashing, which increases cognitive load when trying to troubleshoot.

### C. Simulation Divergence Sparkline
* **Code Reference**: `dashboard/dashboard.js` (Lines 924-927, 1027-1047)
* **Friction Analysis**:
  - **Context-Free Display**: The SVG sparkline renders a raw polyline indicating similarity history. However, it lacks axes, gridlines, minimum/maximum thresholds, or hover tooltips. The operator cannot determine the scale of divergence without cross-referencing the raw text logs below it.
  - **Clipping Vulnerability**: The final data point is marked by a green circle of radius `2.5` centered at `cx="${width}"` (120px). If the SVG style did not specify `overflow:visible`, the right half of the node would be cut off. Relying on overflow rendering outside of bounding boxes can cause layout shifts if the container padding is altered.

---

## 2. Map Loading & Staleness Transitions

### A. Coordinate Map Error & Staleness Handling
* **Code Reference**: `dashboard/dashboard.js` (Lines 552-653)
* **Friction Analysis**:
  - **Stale State Exposure**: If the API call to `/api/operator/consensus-map` fails, the error is caught, and `setMapLoading(false)` is run in the `finally` block. However, the previous coordinate nodes are **not cleared or visually modified** (such as reducing opacity or changing color to gray). The operator continues to see a map of coordinates that reflects old, out-of-date data, without any indicator of failure.
  - **Metrics Desynchronization**: While the map displays a loading overlay, other metrics on the Governance tab (System Memory, Active Model Routing) do not indicate a loading state during data fetching. They remain static and then jump instantly when the promise resolves.

### B. 3D Parallax Map Tilt
* **Code Reference**: `dashboard/dashboard.js` (Lines 1101-1113)
* **Friction Analysis**:
  - **Target Acquisition Friction**: Moving the mouse over the `#coordinate-map` container triggers a 3D rotation (`rotateY` and `rotateX`) relative to the cursor position. While visually impressive, this means the elements on the map (nodes and tooltips) actively shift and rotate as the mouse approaches them. Under stress, attempting to hover over a tiny `14px` node that moves away from the cursor introduces physical friction and visual fatigue.

---

## 3. Keyboard Shortcuts & HUD Clutter

### A. High-Risk Single-Character Hotkeys
* **Code Reference**: `dashboard/dashboard.js` (Lines 1115-1146)
* **Friction Analysis**:
  - **Accidental Execution Hazard**: The keydown event listener listens globally for single-letter keystrokes ('r' for refresh, 'e' for execute, 'g' for tab switch). While it guards against inputs/textareas, if the operator clicks on the page background or a button, pressing 'e' will instantly trigger `document.getElementById('console-execute-button')?.click()`. This executes a model run without confirmation, causing unexpected token charges or database updates. Single-letter keys without modifier keys (e.g. `Ctrl` or `Alt`) violate safety standards.

### B. Misleading Shortcuts (Tab Key)
* **Code Reference**: `dashboard/index.html` (Line 1051), `dashboard/dashboard.js` (Lines 1115-1146)
* **Friction Analysis**:
  - **Unimplemented Shortcut**: The HUD hint bar displays `<kbd>Tab</kbd> Switch`. However, the JavaScript event listener **has no logic for the `Tab` key**. The key behaves as a standard browser focus switcher, moving the keyboard focus indicator to random elements on the page rather than switching tabs. This is confusing and breaks user expectations.

### C. Accessibility & Static Markup
* **Code Reference**: `dashboard/index.html` (Lines 946-967, 1046)
* **Friction Analysis**:
  - **Static ARIA Pollution**: The `.hint-bar` is decorated with `role="status"` and `aria-live="polite"`. These attributes are meant for dynamic content that updates in real-time. Since the hint bar is static markup, this generates unnecessary assistive technology noise.
  - **Broken Tab Index**: The `<kbd>` keys have `tabindex="0"`, allowing them to be focused via keyboard navigation. However, they lack any keypress or click event handlers. Focusable elements that cannot be activated create keyboard navigation dead-ends.

---

## 4. Architectural, Performance & Usability Deficits

### A. Continuous Wasteful Disk I/O
* **Code Reference**: `lib/dashboard.mjs` (Line 184), `lib/scenario_simulator.mjs` (Lines 136-159)
* **Friction Analysis**:
  - **Dashboard Poll Overhead**: Every time the dashboard retrieves data (via `/api/dashboard-data`), it awaits `runIsolatedSimulation({}, {}, {}, 1)`. Inside the simulation library:
    ```javascript
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "dizzy-sim-"));
    ...
    const checkpointFile = path.join(tempDir, "sim_checkpoint.json");
    await fs.promises.writeFile(checkpointFile, JSON.stringify(...), "utf8");
    ...
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    ```
    This function creates a new directory, writes a temporary JSON file to disk, and deletes the directory on **every single poll**. Under active dashboard monitoring, this creates constant, useless disk write/delete cycles, degrading disk lifespan and adding API latency for an in-memory math calculation.

### B. Baseline Simulation NaN Propagation
* **Code Reference**: `lib/dashboard.mjs` (Line 184), `lib/scenario_simulator.mjs` (Lines 13-35, 83-97)
* **Friction Analysis**:
  - **NaN Infection**: The call to `runIsolatedSimulation({}, {}, {}, 1)` passes empty objects `{}` for `initialState`, `baselineParams`, and `forkedParams`. Since `initialState.reserves` is undefined, `nextState.reserves * decay_rate` evaluates to `NaN`. This `NaN` value infects the entire state array.
  - **Corrupted Similarity Math**: In `cosineSimilarity`, both `valA` and `valB` fallback to `0` because `NaN` is falsy. The dot product and norms calculate to `0`, resulting in a return value of `0` similarity. The baseline simulation telemetry returned to the dashboard is mathematically corrupted and functionally dead.

### C. Sieve Retrieval Tester Usability Gap
* **Code Reference**: `dashboard/index.html` (Lines 1095-1118), `dashboard/dashboard.js` (Lines 77-103), `lib/dashboard.mjs` (Lines 19-22, 210-230)
* **Friction Analysis**:
  - **Snippet Blindness**: The Sieve Retrieval Tester returns a list of matching documents. However, it only displays the hashed, obfuscated `doc-` path (e.g. `doc-a7b9c3f2d1e0`) and the final score. It **completely omits the actual text content of the retrieved snippet**. The operator cannot verify if the retrieval engine returned relevant text, rendering the entire tester tab useless for manual calibration.

### D. Dead Code and Visual Layout Debt
* **Code Reference**: `dashboard/index.html` (Lines 970-1008), `dashboard/dashboard.js` (Lines 610-642)
* **Friction Analysis**:
  - **Dead Styles**: The CSS stylesheet contains elaborate rules for `.capability-grid`, `.cap-icon`, `.cap-icon--allowed`, and `.cap-icon--blocked` (for rendering receipt summaries). However, these classes are never referenced or generated by the JavaScript rendering code, which instead uses a generic table.
  - **Missing CSS Variable Binding**: The CSS uses `var(--node-scale, 1)` and `var(--node-glow, 0)` for coordinate nodes, but the JS coordinates renderer never sets these properties on node creation.

### E. File Write Race Condition in Bridge Acceptance
* **Code Reference**: `lib/dashboard.mjs` (Lines 355-370)
* **Friction Analysis**:
  - **Lack of Lock / Mutex**: The `/api/operator/quarantined-bridges/accept` route reads, parses, appends, and writes to `runtime/accepted_bridges.json` using asynchronous fs calls:
    ```javascript
    const acceptedContent = await fs.promises.readFile(acceptedBridgesPath, "utf8");
    ...
    await fs.promises.writeFile(acceptedBridgesPath, JSON.stringify(accepted, null, 2), "utf8");
    ```
    If two bridge acceptances are processed in parallel, the second request will overwrite the first request's additions, leading to lost entries.

---

## 5. Recommendations & Action Items

To reduce operator cognitive load and stabilize the codebase, the following fixes are recommended:

### High Priority (Critical System Health & Usability)
1. **Fix single-letter hotkeys**: Modify the keydown event listener in `dashboard.js` to require a modifier key (such as `Ctrl` or `Alt`) before triggering the 'r' (Refresh) and 'e' (Execute) commands to prevent accidental runs.
2. **Remove disk-bound writes in simulator**: Refactor `runIsolatedSimulation` in `scenario_simulator.mjs` to bypass writing `sim_checkpoint.json` to disk. The file is never read by the caller and exists only to simulate a file operation.
3. **Fix NaN propagation**: Provide realistic default parameters to the baseline simulator in `lib/dashboard.mjs` (e.g. `initialState = { reserves: 1000, participants: 50, allocated_amount: 0, exited_count: 0 }`) instead of passing `{}`.
4. **Implement Stale Map Indicator**: In `dashboard.js` `loadGovernanceData()`, clear out the coordinates or add a CSS class `.stale` (reducing opacity to 40% and showing a red warning text) inside the `catch` block if the map fetch fails.

### Medium Priority (Visual Polish & Accessibility)
5. **Implement missing `@keyframes` animations**: Add `@keyframes pulse-slow` and `@keyframes pulse-rapid` to the CSS stylesheet in `index.html` to animate the status indicator. Slow down the rapid pulsing from `0.6s` to `1.5s` to reduce peripheral vision distraction.
6. **Reveal hidden metrics**: Remove the `dev-only` class from the System Memory and Context Compression Ratio elements so that the operator always has visual feedback on resource limitations.
7. **Render Sieve snippet text**: Update the Sieve Retrieval Tester table in `index.html` and `dashboard.js` to render the actual retrieved snippet text in a expandable accordion, allowing operators to verify search relevance.
8. **Fix the Tab shortcut hint**: Either implement tab switching logic via keyboard keydowns in `dashboard.js` or remove the misleading `Tab Switch` hint from the header.
9. **Eliminate 3D parallax drift**: Disable or reduce the scale of the `rotateY` and `rotateX` calculations on the `#coordinate-map` container during hover to keep nodes statically clickable and readable.
10. **Clean up dead CSS**: Remove unused `.capability-grid` and `.cap-icon` styles from `index.html`.
