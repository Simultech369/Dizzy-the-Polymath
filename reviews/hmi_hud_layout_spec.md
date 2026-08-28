# HMI Unified 3-Pane HUD Layout Specification
**Author:** HMI HUD Designer  
**Status:** Canonical Design Spec  
**Target Viewport:** 1080p Display (1920x1080)  
**Layout Model:** Fixed Viewport (Viewport-Locked Sticky Layout)  

---

## 1. Design System & Layout Strategy

Under high-tension scenarios, an operator's cognitive capacity degrades due to stress-induced cognitive tunneling, loss of peripheral vision, and decision fatigue. The previous tab-isolated dashboard architecture required the operator to switch tabs to synthesize telemetry, view consensus coordinate maps, and execute overrides. This broken workflow led to severe situational awareness (SA) deficits and increased the risk of incorrect overrides.

To resolve these issues, the dashboard is consolidated into a **Unified 3-Pane HUD Layout**.

### 1.1 Column Allocation
- **Zone A: Telemetry & Systems (Left Pane):** Displays system metrics, active prompt packs, memory status, context compression ratio, friction status, and anomaly checks from the old tabs.
- **Zone B: Consensus & Decision Map (Center Pane):** Contains reported review labels, validator chain status, the Pluralistic Options Space Map, operator decision state, and signoff/veto controls.
- **Zone C: Command Console & Execution (Right Pane):** Hosts the Client/Service configuration, Brief inputs, execute trigger buttons, execution trace/receipt outputs, continuity records table, and inactivity pruning logs.

```
+--------------------------------------------------------------------------------------------------+
| [Logo] DIZZY CONTROL HUD  | ========= STRESS BAR [|||||||||......] Z: 2.10 ========= | ORB [NORMAL] |
+---------------------------+-----------------------------------+----------------------------------+
| ZONE A: TELEMETRY         | ZONE B: CONSENSUS MAP             | ZONE C: COMMAND CONSOLE          |
|                           |                                   |                                  |
| * System & Routing        | * Validator Chain SVG             | * Execution Console              |
| * Friction & Divergence   |   [CDX] -> [OCD] -> [AGV]         |   Client / Service / Brief       |
| * Simulator & Sparkline   | * Pluralistic Options Map         |   [Run] Action Trigger           |
| * Memory Sieve Search     | * Signoff / Veto Override         | * Trace & Receipt Outputs        |
|                           | * Quarantined Memory Bridges      | * Continuity Records Grid        |
|                           |                                   | * Inactivity Logs Terminal       |
+---------------------------+-----------------------------------+----------------------------------+
| Shortcut Hints: [Alt+R] Soft Reset  |  [Ctrl+Enter] Signoff  |  [Ctrl+Backspace] Veto Override   |
+--------------------------------------------------------------------------------------------------+
```

### 1.2 Viewport Containment Rules
1. **Viewport Lock:** The outer container wrapper has a fixed height of `1080px` (`height: 1080px; max-height: 1080px; overflow: hidden;`). No vertical scrollbars are allowed on the `body` or HUD root container.
2. **Pane Flex & Containment:** Each column zone has a fixed height (`height: 100%; overflow: hidden; display: flex; flex-direction: column;`).
3. **Internal Scrolling:** Cards containing lists, tables, or terminal output scroll internally (`overflow-y: auto;`). This keeps the header, footer, and essential controls visible at all times.
4. **Ergonomic Sizing:** Column widths are set via grid fractions (`grid-template-columns: 1.1fr 1.5fr 1.4fr;`) to give the interactive consensus map (Center) and console input/table data (Right) proper physical proportions.

---

## 2. HTML HUD Structure

This structure consolidates the components of the old tabs into a single semantic tree, utilizing ARIA roles and labels to ensure screen readers can navigate the layout logically.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dizzy - Unified HUD Control Station</title>
  <link rel="stylesheet" href="assets/hud-layout.css">
</head>
<body class="hud-body">

  <div class="hud-viewport" id="hud-root">
    
    <!-- HEADER: Pinned System Indicators & Stress Monitor -->
    <header class="hud-header" role="banner" aria-label="HUD Header">
      <div class="logo-container">
        <img src="/assets/dizzylogofull.png" alt="Dizzy Logo" class="logo-img">
        <div>
          <h1 class="hud-title">DIZZY HUD CONTROL</h1>
          <div class="title-sub">Consolidated Agency & Telemetry Panel</div>
        </div>
      </div>

      <!-- Centered Stress Bar with Standard Deviation Gridlines -->
      <div class="stress-bar-wrapper" aria-label="System Stress Monitor">
        <div class="stress-bar-labels">
          <span class="stress-label">Systemic Friction Index</span>
          <span class="stress-value" id="hdr-stress-val">Z-Score: 0.00</span>
        </div>
        <div class="stress-bar-container">
          <div class="stress-gridline mark-1sig" data-label="1σ"></div>
          <div class="stress-gridline mark-2sig" data-label="2σ"></div>
          <div class="stress-gridline mark-3sig" data-label="3σ"></div>
          <div class="stress-bar" id="hdr-stress-bar"></div>
        </div>
      </div>

      <!-- Right-Aligned Spectral Pulse Orb -->
      <div class="status-orb-container" aria-live="polite">
        <span class="status-text" id="hdr-status-text">SYSTEM STATE: NOMINAL</span>
        <div class="spectral-orb normal" id="hdr-spectral-orb" role="status" aria-label="System State Orb"></div>
      </div>
    </header>

    <!-- MAIN INTERACTIVE GRID: Consolidated 3-Pane Columns -->
    <main class="hud-main-grid" role="main" aria-label="Control Panels">
      
      <!-- ================= ZONE A: TELEMETRY & SYSTEM METRICS ================= -->
      <section class="hud-zone zone-a" id="zone-telemetry" aria-labelledby="heading-zone-a">
        <h2 class="sr-only" id="heading-zone-a">Zone A: Telemetry and System Metrics</h2>

        <!-- Card 1: System & Routing Metrics -->
        <div class="hud-card card-telemetry" id="card-system-routing">
          <div class="hud-card-header">
            <h3 class="hud-card-title">System &amp; Model Routing</h3>
            <span class="badge badge-primary" id="active-pack">Custom/Core</span>
          </div>
          <div class="hud-card-body scroll-y">
            <div class="prompt-sources-wrapper">
              <span class="metric-label">Active Prompt Sources:</span>
              <ul class="prompt-list" id="prompt-sources-list">
                <!-- Dynamically Rendered Prompt Sources -->
              </ul>
            </div>
            
            <div class="metric-block">
              <div class="metric-row">
                <span class="metric-label">System Memory:</span>
                <span class="metric-value" id="memory-val">Loading...</span>
              </div>
              <div class="progress-container">
                <div class="progress-bar" id="memory-bar-fill" style="width: 0%; background: var(--emerald);"></div>
              </div>
            </div>

            <div class="metric-block">
              <div class="metric-row">
                <span class="metric-label">Compression Ratio:</span>
                <span class="metric-value" id="compression-val">Loading...</span>
              </div>
              <div class="progress-container">
                <div class="progress-bar" id="compression-bar-fill" style="width: 0%; background: var(--primary);"></div>
              </div>
            </div>

            <div class="metric-row select-row">
              <span class="metric-label">Model Routing:</span>
              <span id="active-model-route" class="badge badge-amber">Loading...</span>
            </div>
            <div class="routing-basis" id="active-routing-basis">Loading Basis...</div>
          </div>
        </div>

        <!-- Card 2: Friction Telemetry & Divergence Simulation -->
        <div class="hud-card card-telemetry" id="card-friction-simulator">
          <div class="hud-card-header">
            <h3 class="hud-card-title">Friction &amp; Divergence Telemetry</h3>
            <span id="friction-anomaly-status" class="badge">Loading...</span>
          </div>
          <div class="hud-card-body scroll-y">
            <div class="metric-row">
              <span class="metric-label">Last Robust Z-Score:</span>
              <span id="friction-anomaly-z" class="metric-value font-mono">-</span>
            </div>

            <!-- Urgent Anomaly Warning Banner -->
            <div class="anomaly-warning-banner" id="friction-anomaly-notice-row" style="display: none;" role="alert">
              <span class="warning-icon">🚨</span>
              <span id="friction-anomaly-notice-text">ANOMALY DETECTED: Friction Z-Score crosses critical threshold</span>
            </div>

            <!-- Two-Treasury Fork Simulator Controls -->
            <div class="simulator-controls">
              <h4 class="sub-title">Two-Treasury Fork Simulator</h4>
              <div class="simulator-input-grid">
                <div class="input-wrap">
                  <label for="sim-decay-rate" class="input-label">Decay Rate</label>
                  <input type="number" id="sim-decay-rate" value="0.02" step="0.01" class="hud-input">
                </div>
                <div class="input-wrap">
                  <label for="sim-allocation" class="input-label">Allocation</label>
                  <input type="number" id="sim-allocation" value="4.5" step="0.5" class="hud-input">
                </div>
                <button class="btn btn-secondary btn-small" id="btn-run-fork-sim">Simulate</button>
              </div>
            </div>

            <!-- Grok Telemetry Summary Card (Now Consolidated) -->
            <div class="summary-card" id="sim-summary-card" style="display: none;">
              <div class="summary-header">
                <span class="summary-title">Sim Results</span>
                <span id="sim-status-badge" class="badge badge-emerald">NORMAL</span>
              </div>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">Avg Divergence</span>
                  <div class="summary-sparkline-row">
                    <div id="sim-divergence-sparkline" class="sparkline-canvas"></div>
                    <span id="sim-average-divergence" class="summary-value">-</span>
                  </div>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Peak Div</span>
                  <span id="sim-peak-divergence" class="summary-value">-</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Data Quality</span>
                  <span id="sim-quality-badge" class="badge badge-emerald">HIGH</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Critical Step</span>
                  <span id="sim-critical-step" class="summary-value">-</span>
                </div>
              </div>
            </div>

            <div class="log-accordion">
              <div class="accordion-trigger">
                <span>Detailed Trajectory Logs</span>
                <button class="btn btn-secondary btn-small" id="btn-toggle-sim-logs">Expand</button>
              </div>
              <pre id="fork-sim-terminal-log" class="terminal-box" style="display: none;" aria-live="polite"></pre>
            </div>
          </div>
        </div>

        <!-- Card 3: Memory Sieve Retrieval Tester -->
        <div class="hud-card card-telemetry" id="card-sieve-retrieval">
          <div class="hud-card-header">
            <h3 class="hud-card-title">Memory Sieve Retrieval</h3>
          </div>
          <div class="hud-card-body scroll-y">
            <div class="search-row">
              <label for="search-query" class="sr-only">Sieve Query</label>
              <input type="text" id="search-query" class="hud-input search-input" placeholder="Query (e.g. preventative economics)..." aria-label="Sieve query input">
              <button class="btn btn-primary" id="search-button">Query</button>
            </div>
            <div class="table-container">
              <table class="results-table" aria-label="Sieve Retrieval Results">
                <thead>
                  <tr>
                    <th scope="col">Path</th>
                    <th scope="col">Conf</th>
                    <th scope="col">Score</th>
                    <th scope="col">Reasons</th>
                  </tr>
                </thead>
                <tbody id="search-results-body">
                  <tr>
                    <td colspan="4" class="text-center text-muted">Awaiting query parameters...</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Mini Memory List -->
            <div class="memory-list-trigger">
              <span class="sub-title">Memory Database</span>
            </div>
            <div class="memory-docs-wrapper" id="memory-docs-list">
              <!-- Rendered Dynamically -->
            </div>
          </div>
        </div>
      </section>

      <!-- ================= ZONE B: CONSENSUS & DECISION MAP ================= -->
      <section class="hud-zone zone-b" id="zone-consensus" aria-labelledby="heading-zone-b">
        <h2 class="sr-only" id="heading-zone-b">Zone B: Consensus and Decision Map</h2>

        <!-- Card 1: Pluralistic Options Map & Validator Status -->
        <div class="hud-card card-consensus" id="card-consensus-map-viewer">
          <div class="hud-card-header">
            <h3 class="hud-card-title">Consensus Option Space Map</h3>
            <span id="consensus-status-badge" class="badge badge-amber">Awaiting Operator</span>
          </div>
          <div class="hud-card-body scroll-y">
            
            <!-- Validator Chain State SVG -->
            <div class="validator-chain-container">
              <span class="metric-label">Reported Review Labels:</span>
              <svg class="validator-chain-svg" viewBox="0 0 400 80" aria-label="Validator Verification Chain Graph">
                <defs>
                  <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <line x1="80" y1="40" x2="200" y2="40" stroke="#22304d" stroke-width="3" id="line-codex-openclaude" class="chain-connection-line" />
                <line x1="200" y1="40" x2="320" y2="40" stroke="#22304d" stroke-width="3" id="line-openclaude-antigravity" class="chain-connection-line" />
                <circle cx="80" cy="40" r="16" fill="#161e31" stroke="#f59e0b" stroke-width="3" id="node-circle-codex" class="chain-node-circle" />
                <text x="80" y="44" fill="#f3f4f6" font-size="9" text-anchor="middle" font-family="monospace">CDX</text>
                <text x="80" y="68" fill="#9ca3af" font-size="8" text-anchor="middle" id="node-text-codex">AWAITING</text>
                <circle cx="200" cy="40" r="16" fill="#161e31" stroke="#f59e0b" stroke-width="3" id="node-circle-openclaude" class="chain-node-circle" />
                <text x="200" y="44" fill="#f3f4f6" font-size="9" text-anchor="middle" font-family="monospace">OCD</text>
                <text x="200" y="68" fill="#9ca3af" font-size="8" text-anchor="middle" id="node-text-openclaude">AWAITING</text>
                <circle cx="320" cy="40" r="16" fill="#161e31" stroke="#f59e0b" stroke-width="3" id="node-circle-antigravity" class="chain-node-circle" />
                <text x="320" y="44" fill="#f3f4f6" font-size="9" text-anchor="middle" font-family="monospace">AGV</text>
                <text x="320" y="68" fill="#9ca3af" font-size="8" text-anchor="middle" id="node-text-antigravity">AWAITING</text>
              </svg>
            </div>

            <!-- Coordinate map interactive zone -->
            <div class="map-wrapper">
              <span class="metric-label">Proposal Friction Coordinates:</span>
              <div class="consensus-coordinate-container" id="coordinate-map" tabindex="0" role="application" aria-label="Consensus coordinates option space map scatterplot. Navigation via mouse clicks and keyboard arrows.">
                <div class="coordinate-grid-overlay"></div>
                <div class="map-loading" id="map-loading-overlay">
                  <div class="loading-spinner"></div>
                  <span class="loading-text">Recomputing projection...</span>
                </div>
                <div id="node-tooltip-element" class="node-tooltip">Hover over a proposal coordinate.</div>
              </div>
            </div>

            <div class="proof-row">
              <span class="metric-label">Proof Limit:</span>
              <span id="proof-limit" class="badge badge-secondary">Not Cryptographic</span>
            </div>

            <!-- Consensus Signoff Override Buttons -->
            <div class="operator-action-row">
              <button class="btn btn-success" id="btn-operator-signoff" aria-label="Sign off and accept reported review state">
                Accept Review State <span class="hotkey-tip">[Ctrl+↵]</span>
              </button>
              <button class="btn btn-danger" id="btn-veto-override" aria-label="Veto and reject reported review state">
                Veto / Reject State <span class="hotkey-tip">[Ctrl+⌫]</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Card 2: Quarantined Memory Bridges Queue -->
        <div class="hud-card card-consensus" id="card-quarantine-bridges">
          <div class="hud-card-header">
            <h3 class="hud-card-title">Quarantined Memory Bridges</h3>
          </div>
          <div class="hud-card-body scroll-y">
            <div class="alert-info" role="status">
              <strong>Approval required:</strong> Memory bridges must be manually cleared by the operator before graph integration.
            </div>
            <div class="quarantined-list-container" id="quarantined-bridges-list">
              <div class="text-center text-muted pad-1">Loading quarantined memory bridges...</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ================= ZONE C: COMMAND CONSOLE ================= -->
      <section class="hud-zone zone-c" id="zone-console" aria-labelledby="heading-zone-c">
        <h2 class="sr-only" id="heading-zone-c">Zone C: Operator Command Console</h2>

        <!-- Card 1: Execution Inputs (High Contrast Solid Panel) -->
        <div class="hud-card card-console console-panel-execute" id="card-console-execute">
          <div class="hud-card-header">
            <h3 class="hud-card-title">Execute command</h3>
          </div>
          <div class="hud-card-body">
            <div class="form-stack">
              <div class="form-row-2col">
                <div class="input-wrap">
                  <label for="console-client-id" class="input-label">Client ID</label>
                  <input type="text" id="console-client-id" class="hud-input font-mono" value="demo-client" autocomplete="off">
                </div>
                <div class="input-wrap">
                  <label for="console-service-id" class="input-label">Service ID</label>
                  <input type="text" id="console-service-id" class="hud-input font-mono" value="demo-service" autocomplete="off">
                </div>
              </div>

              <div class="input-wrap">
                <label for="console-continuity-mode" class="input-label">Continuity Mode</label>
                <select id="console-continuity-mode" class="hud-select">
                  <option value="ephemeral">Ephemeral (Context-Isolated Run)</option>
                  <option value="client">Client Continuity (Persistent Context Graph)</option>
                </select>
              </div>

              <div class="input-wrap">
                <label for="console-brief" class="input-label">Brief Command Input</label>
                <textarea id="console-brief" class="hud-textarea font-mono" rows="2" placeholder="Write command parameters here...">Summarize what continuity and revocation mean in this runtime.</textarea>
              </div>

              <button class="btn btn-primary" id="console-execute-button">
                Execute Routine <span class="hotkey-tip">[Alt+↵]</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Card 2: Logs, traces, & Receipts -->
        <div class="hud-card card-console" id="card-console-logs">
          <div class="hud-card-header">
            <h3 class="hud-card-title">Execution Logs</h3>
          </div>
          <div class="hud-card-body logs-flex">
            <!-- Left Sub-panel: Live Trace -->
            <div class="trace-sub-panel">
              <span class="sub-title">Execution Trace</span>
              <div id="console-trace" class="terminal-logs-stack" aria-live="polite">
                <div class="summary-card">
                  <div class="summary-title text-muted">Status: Idle</div>
                  <div class="summary-lines">Run a brief to output execution trace logs.</div>
                </div>
              </div>
            </div>
            
            <!-- Right Sub-panel: Receipt Verification -->
            <div class="trace-sub-panel border-left">
              <span class="sub-title">System Receipt</span>
              <div id="console-receipt" class="terminal-logs-stack" aria-live="polite">
                <div class="summary-card">
                  <div class="summary-title text-muted">No receipt yet</div>
                  <div class="summary-lines">Execution verification receipts will populate here.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 3: Continuity Records & Prune History -->
        <div class="hud-card card-console" id="card-console-records">
          <div class="hud-card-header">
            <h3 class="hud-card-title">Continuity Records</h3>
            <div class="header-button-group">
              <button class="btn btn-secondary btn-small" id="console-refresh-records">Refresh</button>
              <button class="btn btn-danger btn-small" id="console-prune-records">Prune Expired</button>
            </div>
          </div>
          <div class="hud-card-body scroll-y">
            <div class="table-container shrink">
              <table class="results-table compact" aria-label="Database Continuity Records">
                <thead>
                  <tr>
                    <th scope="col">Key</th>
                    <th scope="col">Client</th>
                    <th scope="col">Service</th>
                    <th scope="col">Expiry</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody id="console-records-body">
                  <tr>
                    <td colspan="5" class="text-center text-muted">Awaiting records load...</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Inactivity Pruning Logs terminal output -->
            <div class="inactivity-logs-section">
              <span class="sub-title">Pruning Logs &amp; Automation Receipts</span>
              <div id="prune-receipts-list" class="terminal-box small-term" aria-live="polite">
                <div class="text-center text-muted">Loading receipts...</div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>

    <!-- FOOTER: Hint Bar & Keyboard Navigation Shortcuts -->
    <footer class="hud-footer" role="contentinfo" aria-label="HUD Footer">
      <div class="hint-bar" role="status" aria-live="polite" tabindex="0" aria-label="Keyboard Shortcuts Panel">
        <span class="hint-item"><kbd class="kbd-key">Alt+R</kbd> Soft Reset HUD</span>
        <span class="hint-item"><kbd class="kbd-key">Alt+E</kbd> Run Execution Brief</span>
        <span class="hint-item"><kbd class="kbd-key">Ctrl+↵</kbd> Operator Signoff</span>
        <span class="hint-item"><kbd class="kbd-key">Ctrl+⌫</kbd> Operator Veto</span>
        <span class="hint-item"><kbd class="kbd-key">Tab</kbd> Focus cycle</span>
      </div>
      <div class="connection-status">
        <span class="connection-indicator connected"></span>
        <span class="connection-label">SECURE OPERATOR INTERFACE STATE</span>
      </div>
    </footer>

  </div>

</body>
</html>
```

---

## 3. CSS Style Guide & Layout Rules

Save the following stylesheet to `assets/hud-layout.css` to activate the consolidated grid system, sticky viewports, color palettes, micro-animations, and focus styling.

```css
/* ---------- Design System Variables & Tokens ---------- */
:root {
  --ui-gap: 1rem;
  --ui-radius: 10px;
  --bg-color: #060913;
  --card-bg-translucent: rgba(11, 18, 33, 0.45);
  --card-bg-solid: #0d1222;
  --border-color: rgba(99, 102, 241, 0.16);
  --border-focus: #818cf8;
  
  --text-main: #f1f5f9;
  --text-muted: #8e9ebb;
  --text-heading: #ffffff;
  
  --primary: #818cf8;
  --primary-hover: #6366f1;
  --emerald: #34d399;
  --amber: #fbbf24;
  --rose: #fb7185;
  
  --glass-glow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --neon-warning-glow: 0 0 15px rgba(251, 113, 133, 0.25);
  --neon-emerald-glow: 0 0 15px rgba(52, 211, 153, 0.25);
}

/* ---------- Basic Reset & Viewport Constraints ---------- */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body.hud-body {
  background-color: var(--bg-color);
  color: var(--text-main);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  height: 1080px;
  max-height: 1080px;
  overflow: hidden;
  margin: 0;
  padding: 0;
  background-image: radial-gradient(circle at 5% 10%, rgba(99, 102, 241, 0.12) 0%, transparent 35%),
                    radial-gradient(circle at 95% 90%, rgba(52, 211, 153, 0.08) 0%, transparent 35%);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

/* ---------- Scrollbar Enhancements ---------- */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.35);
  box-shadow: 0 0 6px var(--primary);
}

/* ---------- Grid Layout Engine ---------- */
.hud-viewport {
  display: flex;
  flex-direction: column;
  height: 1080px;
  max-height: 1080px;
  overflow: hidden;
  padding: 0.75rem 1rem;
}

/* Header Height: 64px */
.hud-header {
  height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

/* Footer Height: 30px */
.hud-footer {
  height: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border-color);
  padding-top: 0.35rem;
  margin-top: 0.5rem;
  flex-shrink: 0;
  font-size: 0.8rem;
}

/* Main Grid occupies the remaining height: 1080 - 64 - 30 - padding offsets */
.hud-main-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1.1fr 1.5fr 1.4fr;
  gap: 1rem;
  overflow: hidden; /* Important to lock outer scrolls */
}

/* Flex Column Zones */
.hud-zone {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  overflow: hidden;
}

/* Individual Cards */
.hud-card {
  background: var(--card-bg-translucent);
  border: 1px solid var(--border-color);
  border-radius: var(--ui-radius);
  box-shadow: var(--glass-glow);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.hud-card-header {
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.01);
  flex-shrink: 0;
}

.hud-card-title {
  font-size: 0.95rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-heading);
}

.hud-card-body {
  padding: 0.85rem;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hud-card-body.scroll-y {
  overflow-y: auto;
}

/* ---------- Zone-Specific Cards Sizing ---------- */

/* Zone A Cards Sizes */
#card-system-routing { flex: 1.1; }
#card-friction-simulator { flex: 1.5; }
#card-sieve-retrieval { flex: 1.4; }

/* Zone B Cards Sizes */
#card-consensus-map-viewer { flex: 2.3; }
#card-quarantine-bridges { flex: 1.7; }

/* Zone C Cards Sizes */
#card-console-execute { 
  flex: 1.3; 
  background: var(--card-bg-solid); /* Solid background for Semantic Layering */
  border: 2px solid rgba(129, 140, 248, 0.35);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.03);
}
#card-console-logs { flex: 1.3; }
#card-console-records { flex: 1.4; }

/* ---------- Header Details & Stress Bar ---------- */
.logo-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.logo-img {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--primary);
}
.hud-title {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-heading);
}
.title-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Stress Bar Styling */
.stress-bar-wrapper {
  flex: 0 1 480px;
  margin: 0 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.stress-bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 500;
}
.stress-label { color: var(--text-muted); }
.stress-value { color: var(--amber); font-family: monospace; }

.stress-bar-container {
  position: relative;
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.stress-bar {
  height: 100%;
  width: 0%;
  background: var(--emerald);
  transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), background-color 0.3s ease;
  box-shadow: 0 0 6px currentColor;
}
/* Standard Deviation Ticks on Stress Bar */
.stress-gridline {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.15);
  z-index: 2;
}
.stress-gridline::after {
  content: attr(data-label);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.55rem;
  color: var(--text-muted);
}
.mark-1sig { left: 40%; }  /* 2.0 Z-score / 5.0 scale = 40% */
.mark-2sig { left: 60%; }  /* 3.0 Z-score / 5.0 scale = 60% */
.mark-3sig { left: 80%; background: rgba(251, 113, 133, 0.4); }  /* 4.0 Z-score / 5.0 scale = 80% */

/* Status Orb Container */
.status-orb-container {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.status-text {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-muted);
}
.spectral-orb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  transition: background-color 0.4s ease, box-shadow 0.4s ease;
  will-change: opacity, transform;
}
.spectral-orb.normal {
  background-color: var(--emerald);
  box-shadow: 0 0 10px var(--emerald);
  animation: pulse-slow 3s infinite ease-in-out;
}
.spectral-orb.anomaly {
  background-color: var(--rose);
  box-shadow: 0 0 15px var(--rose), var(--neon-warning-glow);
  animation: pulse-rapid 0.4s infinite alternate ease-in-out;
}

/* Animations */
@keyframes pulse-slow {
  0%, 100% { opacity: 0.7; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1.05); }
}
@keyframes pulse-rapid {
  0% { transform: scale(0.9); opacity: 0.8; }
  100% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 20px var(--rose); }
}

/* ---------- Typography & Badges ---------- */
.badge {
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid transparent;
}
.badge-primary { background: rgba(129, 140, 248, 0.2); color: var(--primary); border-color: rgba(129, 140, 248, 0.3); }
.badge-emerald { background: rgba(52, 211, 244, 0.15); color: var(--emerald); border-color: rgba(52, 211, 153, 0.2); }
.badge-amber { background: rgba(251, 191, 36, 0.15); color: var(--amber); border-color: rgba(251, 191, 36, 0.25); }
.badge-rose { background: rgba(251, 113, 133, 0.18); color: var(--rose); border-color: rgba(251, 113, 133, 0.3); }
.badge-secondary { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border-color: rgba(255, 255, 255, 0.1); }

/* ---------- Forms & Inputs ---------- */
.hud-input, .hud-select, .hud-textarea {
  background: rgba(11, 16, 29, 0.6);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-main);
  padding: 0.45rem 0.65rem;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
}
.hud-textarea {
  resize: none;
}
.hud-input:focus, .hud-select:focus, .hud-textarea:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 5px rgba(129, 140, 248, 0.35);
}

.input-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.input-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}
.form-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.form-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

/* Buttons */
.btn {
  background: var(--primary);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  transition: background-color 0.2s, border-color 0.2s;
}
.btn:hover { background-color: var(--primary-hover); }
.btn-secondary { background: rgba(255, 255, 255, 0.05); color: var(--text-main); border-color: rgba(255, 255, 255, 0.08); }
.btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
.btn-danger { background: rgba(251, 113, 133, 0.18); border-color: rgba(251, 113, 133, 0.35); color: #fecdd3; }
.btn-danger:hover { background: rgba(251, 113, 133, 0.28); }
.btn-success { background: rgba(52, 211, 153, 0.18); border-color: rgba(52, 211, 153, 0.35); color: #d1fae5; }
.btn-success:hover { background: rgba(52, 211, 153, 0.28); }
.btn-small { padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 4px; }
.hotkey-tip { font-size: 0.65rem; opacity: 0.75; font-family: monospace; }

/* ---------- Interactive Elements & Tables ---------- */
.results-table {
  width: 100%;
  border-collapse: collapse;
}
.results-table th, .results-table td {
  text-align: left;
  padding: 0.45rem 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.8rem;
}
.results-table th {
  color: var(--text-muted);
  font-weight: 500;
}
.results-table td {
  color: var(--text-main);
  line-height: 1.4;
}
.results-table.compact th, .results-table.compact td {
  padding: 0.3rem 0.5rem;
}
.table-container {
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0,0,0,0.2);
  border-radius: 6px;
  overflow-y: auto;
  flex: 1;
}
.table-container.shrink {
  flex: 0 0 160px;
  max-height: 160px;
}
.text-center { text-align: center !important; }
.text-muted { color: var(--text-muted) !important; }
.font-mono { font-family: 'Fira Code', monospace, monospace; }

/* ---------- Zone A Layout Internals ---------- */
.metric-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.65rem;
}
.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
}
.metric-label {
  color: var(--text-muted);
  font-weight: 500;
}
.metric-value {
  color: var(--text-main);
  font-weight: 600;
}
.progress-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  transition: width 0.3s ease;
}
.routing-basis {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: rgba(0,0,0,0.15);
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  margin-top: 0.35rem;
  font-family: monospace;
}
.select-row {
  margin-top: 0.5rem;
}

/* Anomaly Warning Notice */
.anomaly-warning-banner {
  background: rgba(251, 113, 133, 0.15);
  border: 1px solid rgba(251, 113, 133, 0.3);
  border-radius: 6px;
  color: #ffe4e6;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.45rem 0.65rem;
  margin: 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  animation: border-flash 1s infinite alternate;
}
@keyframes border-flash {
  0% { border-color: rgba(251, 113, 133, 0.3); box-shadow: none; }
  100% { border-color: var(--rose); box-shadow: var(--neon-warning-glow); }
}

.simulator-controls {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.03);
  padding: 0.55rem;
  border-radius: 6px;
  margin-top: 0.5rem;
}
.simulator-input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.4rem;
  align-items: flex-end;
  margin-top: 0.35rem;
}
.terminal-box {
  background: #020409;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  color: var(--primary);
  font-family: 'Fira Code', monospace, monospace;
  font-size: 0.75rem;
  padding: 0.65rem;
  white-space: pre-wrap;
  overflow-y: auto;
  max-height: 120px;
}
.terminal-box.small-term {
  max-height: 100px;
}
.log-accordion {
  margin-top: 0.5rem;
}
.accordion-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.sub-title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
  display: inline-block;
}

/* Grok Summary Card */
.summary-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 6px;
  padding: 0.55rem;
  margin-top: 0.5rem;
}
.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 0.25rem;
  margin-bottom: 0.4rem;
}
.summary-title { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.summary-item { display: flex; flex-direction: column; }
.summary-label { font-size: 0.65rem; color: var(--text-muted); }
.summary-value { font-size: 0.8rem; font-weight: 700; color: var(--text-main); font-family: monospace; }
.summary-sparkline-row { display: flex; align-items: center; gap: 0.35rem; }
.sparkline-canvas { width: 50px; height: 14px; background: rgba(255,255,255,0.03); border-radius: 2px; }

/* Sieve Retrieval Details */
.search-row {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.55rem;
}
.search-input {
  flex: 1;
}
.memory-docs-wrapper {
  max-height: 125px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  background: rgba(0,0,0,0.15);
  margin-top: 0.35rem;
}
.doc-item {
  padding: 0.45rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}
.doc-path { font-family: monospace; font-size: 0.75rem; color: var(--primary); }
.doc-metrics { display: flex; flex-direction: column; gap: 0.15rem; }
.doc-metric { display: flex; align-items: center; font-size: 0.7rem; }
.doc-metric .bar-container { width: 50px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin: 0 0.35rem; }
.doc-metric .bar-fill { height: 100%; border-radius: 2px; }

/* ---------- Zone B Layout Internals ---------- */
.validator-chain-container {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255,255,255,0.02);
  border-radius: var(--ui-radius);
  padding: 0.45rem 0.65rem;
  margin-bottom: 0.65rem;
}
.validator-chain-svg {
  width: 100%;
  height: 60px;
  display: block;
}
.chain-node-circle {
  transition: stroke 0.4s ease, fill 0.4s ease;
}
.chain-connection-line {
  transition: stroke 0.4s ease;
}

/* Pluralistic coordinates map wrapper */
.map-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-bottom: 0.55rem;
}
.consensus-coordinate-container {
  background: #020409;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  position: relative;
  flex: 1;
  overflow: hidden;
  outline: none;
  cursor: crosshair;
}
.consensus-coordinate-container:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 8px rgba(129, 140, 248, 0.4);
}
.coordinate-grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}
.map-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(6, 9, 19, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  z-index: 10;
}
.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(129, 140, 248, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s infinite linear;
}
@keyframes spin { 100% { transform: rotate(360deg); } }
.loading-text { font-size: 0.75rem; color: var(--text-muted); }
.node-tooltip {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  background: rgba(11, 16, 29, 0.85);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.35rem 0.5rem;
  font-size: 0.7rem;
  color: var(--text-muted);
  pointer-events: none;
  backdrop-filter: blur(4px);
}
.proof-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  margin-bottom: 0.65rem;
}
.operator-action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

/* Quarantined Bridges List */
.alert-info {
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 6px;
  font-size: 0.75rem;
  padding: 0.45rem 0.65rem;
  color: #e0e7ff;
  margin-bottom: 0.55rem;
}
.quarantined-list-container {
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  background: rgba(0,0,0,0.15);
  flex: 1;
  overflow-y: auto;
}
.bridge-item {
  padding: 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}
.bridge-details {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.bridge-title { font-family: monospace; font-size: 0.75rem; font-weight: 600; color: var(--primary); }
.bridge-desc { font-size: 0.7rem; color: var(--text-muted); }
.bridge-actions { display: flex; gap: 0.25rem; }

/* ---------- Zone C Layout Internals ---------- */
.logs-flex {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.trace-sub-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.border-left {
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  padding-left: 0.75rem;
}
.terminal-logs-stack {
  flex: 1;
  background: #020409;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 0.55rem;
  overflow-y: auto;
  font-family: 'Fira Code', monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  color: #818cf8;
}
.summary-card {
  padding: 0.25rem 0;
}
.summary-title {
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.summary-lines {
  font-size: 0.7rem;
  color: var(--text-muted);
}
.header-button-group {
  display: flex;
  gap: 0.35rem;
}
.inactivity-logs-section {
  margin-top: 0.65rem;
  display: flex;
  flex-direction: column;
}

/* ---------- Hint Bar Footer ---------- */
.hint-bar {
  display: flex;
  gap: 1.5rem;
  outline: none;
}
.hint-bar:focus {
  outline: 1px solid rgba(129, 140, 248, 0.4);
}
.hint-item {
  color: var(--text-muted);
  font-size: 0.75rem;
}
.kbd-key {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: var(--text-main);
  padding: 0.05rem 0.3rem;
  font-family: monospace;
  font-size: 0.7rem;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
  margin-right: 0.25rem;
}
.connection-status {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.connection-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.connection-indicator.connected {
  background: var(--emerald);
  box-shadow: 0 0 6px var(--emerald);
}
.connection-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(52, 211, 153, 0.65);
  letter-spacing: 0.05em;
  font-family: monospace;
}

/* ---------- Custom Focus Ring Styles (WAI-ARIA compliance) ---------- */
.btn:focus, .hud-input:focus, .hud-select:focus, .hud-textarea:focus, .kbd-key:focus {
  outline: 2px solid var(--border-focus) !important;
  outline-offset: 1px;
}
.chain-node-circle:hover {
  stroke-width: 4px !important;
  filter: url(#neon-glow);
}
```

---

## 4. Accessibility Mapping

To guarantee WCAG 2.1 AA accessibility standards in high-tension telemetry environments, the following rules are built into the HTML/CSS structure and must be preserved during DOM bindings:

1. **HTML Landmark Architecture:**
   - `<header role="banner">` - Identifies the top brand panel, stress bar, and orb status.
   - `<main role="main">` - Outlines the main interactive viewport grid.
   - `<section aria-labelledby="...">` - Marks each column pane as an explicit semantic landmark (Zone A: Telemetry, Zone B: Consensus, Zone C: Console).
   - `<footer role="contentinfo">` - Holds keyboard shortcut hints and status.

2. **Screen Reader Notification (Live Regions):**
   - `.status-orb-container [aria-live="polite"]` - Announces changes in the system state (e.g. switching from NOMINAL to ANOMALY) without interrupting focus.
   - `#console-trace [aria-live="polite"]` and `#console-receipt [aria-live="polite"]` - Announces execution completions, traces, and boundary checks.
   - `#prune-receipts-list [aria-live="polite"]` - Announces automated pruning logs in the background.
   - `#friction-anomaly-notice-row [role="alert"]` - Triggers immediate audio announcements for critical Z-Score crossings.

3. **Form Association & Control Focus:**
   - Every text input, select, and textarea has a explicitly linked `<label>` wrapper or `id` matching the `for` attribute.
   - All interactive components (buttons, input fields, select elements, textareas) use custom focus styles (`outline: 2px solid var(--border-focus);`) to provide high-visibility visual rings.

4. **Option Space Map Navigation:**
   - The Option Space Map (`#coordinate-map`) has `tabindex="0"` and `role="application"`. When focused, arrow keys allow navigating proposals (Z-score coordinates), and `Enter`/`Space` selects a coordinate.
   - Visual tooltip coordinates are mapped directly to corresponding text nodes for reading order transparency.

---

## 5. JavaScript Integration Specification

The transitioning of the DOM bindings in `dashboard.js` from the old tab-isolated model to the Unified 3-Pane HUD layout requires the following updates:

### 5.1 Tab Switching Removal
Remove the old `switchTab` and `cycleTabs` handlers, as all panels are now visible simultaneously. Ensure that references in the main loops updating elements (e.g., refreshing memory, routing basis, and simulators) run continuously rather than only on tab focus.

### 5.2 Global Keyboard Event Interceptor
Add a keyboard listener to handle critical decisional controls without mouse pointer interactions. Restoring default `Tab` key behavior is mandatory.

```javascript
// Add to the initialization section of dashboard.js
document.addEventListener('keydown', (e) => {
  // If the user is currently typing in an input/textarea, do not capture single-key shortcuts.
  // Exception: Let Ctrl+Enter bypass focus to trigger execution.
  if (e.target.matches('input, textarea, select')) {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('console-execute-button')?.click();
    }
    return;
  }

  const key = e.key.toLowerCase();

  // Alt+R -> Soft Reset/Reload HUD Telemetry Data
  if (e.altKey && key === 'r') {
    e.preventDefault();
    console.log("HUD Soft Reset: Reloading telemetry feeds...");
    if (typeof loadData === 'function') loadData();
    if (typeof loadGovernanceData === 'function') loadGovernanceData();
    if (typeof loadFrictionTelemetry === 'function') loadFrictionTelemetry();
    if (typeof loadPruneReceipts === 'function') loadPruneReceipts();
  }

  // Alt+E -> Focus/Trigger Execution Input Stack
  if (e.altKey && key === 'e') {
    e.preventDefault();
    const briefInput = document.getElementById('console-brief');
    if (briefInput) {
      briefInput.focus();
      briefInput.select();
    }
  }

  // Ctrl+Enter -> Operator Decision Signoff (Accept Review State)
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    const btnSignoff = document.getElementById('btn-operator-signoff');
    if (btnSignoff) {
      btnSignoff.click();
    }
  }

  // Ctrl+Backspace -> Operator Veto/Reject State
  if (e.ctrlKey && e.key === 'Backspace') {
    e.preventDefault();
    const btnVeto = document.getElementById('btn-veto-override');
    if (btnVeto) {
      btnVeto.click();
    }
  }
});
```

### 5.3 Stress Bar & Orb Telemetry Bindings
Coordinate Z-score variables in `dashboard.js` with the Header Stress Bar:
- Let $Z_{max} = 5.0$ map to $100\%$ width.
- Dynamic color thresholds:
  - $Z < 2.0$: Nominal green (`var(--emerald)`).
  - $2.0 \le Z < 3.0$: Warning amber (`var(--amber)`).
  - $Z \ge 3.0$: Critical rose (`var(--rose)`).
- Update the class of `#hdr-spectral-orb` to `normal` or `anomaly` alongside the changes.

```javascript
function updateHeaderStressTelemetry(zScore) {
  const bar = document.getElementById('hdr-stress-bar');
  const val = document.getElementById('hdr-stress-val');
  const orb = document.getElementById('hdr-spectral-orb');
  const statusTxt = document.getElementById('hdr-status-text');

  if (!bar || !val || !orb) return;

  const score = Math.max(0, Math.min(5.0, Number(zScore)));
  const percentage = (score / 5.0) * 100;
  
  bar.style.width = `${percentage}%`;
  val.innerText = `Z-Score: ${score.toFixed(2)}`;

  if (score < 2.0) {
    bar.style.backgroundColor = 'var(--emerald)';
    bar.style.color = 'var(--emerald)'; // For box-shadow currentColor
    orb.className = 'spectral-orb normal';
    statusTxt.innerText = 'SYSTEM STATE: NOMINAL';
  } else if (score < 3.0) {
    bar.style.backgroundColor = 'var(--amber)';
    bar.style.color = 'var(--amber)';
    orb.className = 'spectral-orb normal'; // keep pulse, or make orange warning
    statusTxt.innerText = 'SYSTEM STATE: WARNING';
  } else {
    bar.style.backgroundColor = 'var(--rose)';
    bar.style.color = 'var(--rose)';
    orb.className = 'spectral-orb anomaly';
    statusTxt.innerText = 'SYSTEM STATE: ANOMALY DETECTED';
  }
}
```
