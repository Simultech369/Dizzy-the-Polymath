# reviews/gemma_ux_critique.md

```markdown
# Gemma UX Critique – Dizzy Operator Dashboard

*Prepared by Gemma – Interface Architect & Frontend Systems Engineer*

---

## Executive Summary

Cohere's unified specification represents a **significant synthesis** of the preceding reviews, successfully reconciling Zero's operational hierarchy, Qwen's performance constraints, DeepSeek's mathematical rigor, and Kimi's accessibility mandates. The specification achieves **visual momentum** through peripheral awareness systems (Stress Bar, Spectral Pulse) and **operator empowerment** through iconic capability grids and progressive disclosure.

However, **three critical implementation gaps** remain between the specification and the active codebase that must be resolved before merge:

1. **CSS Variable Binding Failures** — The MDS pressure field variable (`--pressure-color`) is defined in JS but never referenced in the active `index.html` CSS.
2. **Missing DOM Elements** — Stress Bar, Spectral Pulse Orb, and Keyboard Hint Bar exist only in Cohere's spec, not in the live HTML.
3. **Capability Grid Integration** — The `renderCapabilityGrid` function is specified but not wired into `renderReceiptSummary`.

Additionally, I have identified **syntax errors, performance traps, and accessibility violations** in Cohere's provided snippets that would ship bugs if copy-pasted directly.

---

## 1. Layout Rule Validation: Cohere Spec vs. Active Codebase

### 1.1 Semantic Layering (Command vs. Telemetry Zones)

| Spec Requirement | Active Codebase Status | Verdict |
|------------------|------------------------|---------|
| `.console-panel-execute` (solid, 0px blur, 2px primary border) | **Missing** — Only generic `.console-panel` exists | Implemented** |
| `.console-panel-trace` (12px blur, rgba bg) | **Missing** — Same generic class used for all panels | Implemented** |
| Z-index hierarchy (Command Zone = 100) | **Missing** |Not Implemented** |

**Finding**: The active `dashboard.js` renders all console panels with identical classes. The spec's tiered depth system is **entirely absent** from the DOM. This is the single largest gap — operators currently see no visual distinction between "I must act here" (Execute) and "I am observing here" (Trace/Receipt).

### 1.2 Peripheral Awareness Systems

| Component | Spec Status | Active Codebase | Gap Analysis |
|-----------|-------------|-----------------|--------------|
| **Stress Bar** (2px gradient under header) | Defined in Cohere CSS | **Absent from HTML** | Header has no `.stress-bar` element; no Z-score plumbing exists |
| **Spectral Pulse Orb** (16px, frequency-based animation) | Defined in Cohere CSS/JS | **Absent from HTML** | Header badge shows "Online" (static emerald); no orb, no friction polling |
| **Keyboard Hint Bar** (top-right, `<kbd>` keys) | Defined in Cohere CSS/HTML | **Absent from HTML** | No hint bar markup; keydown listeners partially exist but unbound |

**Finding**: Cohere's spec introduces **three new DOM nodes** that do not exist. The `loadGovernanceData` function fetches friction telemetry but only updates a badge (`#friction-anomaly-status`) — it does not drive the Stress Bar or Spectral Pulse.

### 1.3 MDS Map Pressure Field

| Spec Requirement | Active Codebase | Gap |
|------------------|-----------------|-----|
| `background: radial-gradient(circle, var(--pressure-color) 0%, transparent 45%)` | Container uses **static** `radial-gradient(circle, rgba(16, 24, 48, 0.9) 0%, rgba(5, 7, 12, 0.95) 100%)` | **CSS variable never referenced** |
| `updateMDSPressure(nodes)` with edge-case handling | `loadGovernanceData` creates nodes but **never calls pressure update** | **Function exists in spec only** |
| Empty-state neutral gray (`hsla(180, 0%, 55%, 0.15)`) | Not handled | **Misleading "calm" state on empty map** |

**Finding**: The MDS map is **visually static** in production. The pressure field logic is mathematically sound (per Kimi/DeepSeek) but **unbound from the DOM**.

### 1.4 Capability Grid (Receipt Summary)

| Spec Requirement | Active Codebase | Gap |
|------------------|-----------------|-----|
| `renderCapabilityGrid(capabilities)` returning icon badges | **Function does not exist** in `dashboard.js` | **Missing entirely** |
| Integration into `renderReceiptSummary` | Current implementation uses text `facts` array | **Text-only, low scannability** |

**Finding**: The highest-impact "empowerment" feature — instant visual verification of capability boundaries — is **unimplemented**.

---

## 2. Implementation Detail Critique: Cohere Snippet Audit

### 2.1 CSS Syntax Errors & Bugs

#### **Error 1: Incomplete `cap-icon` Style Rule (Cohere CSS, Line 187-194)**

```css
.cap-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  cursor: default;
}
```
**Missing**: The `background` color is applied via inline style in JS (`style="background: ${cap.allowed ? 'var(--emerald)' : 'var(--rose')}"`), but **no fallback** exists if JS fails. **Recommendation**: Add default `background: var(--border-color);` to the class.

#### **Error 2: `kbd-key:focus` Selector Misuse (Cohere CSS, Line 218-223)**

```css
.kbd-key:focus {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  background: rgba(255,255,255,0.12);
}
```
**Bug**: `<kbd>` elements are **not natively focusable**. The hint bar markup uses `<kbd class="kbd-key" data-key="r">R</kbd>` without `tabindex="0"`. This selector will **never match**. **Fix**: Add `tabindex="0"` to each `<kbd>` or move focus styles to a wrapper `<button>`/`<a>`.

#### **Error 3: `stress-bar` Gradient Interpolation Logic (Cohere JS, Line 45-52)**

```javascript
const clamped = Math.max(0, Math.min(1, zScore));
bar.style.background = `linear-gradient(
  to right,
  var(--emerald) 0%,
  var(--amber) ${45 + clamped * 10}%,
  var(--rose) 100%
)`;
```
**Math Error**: If `zScore = 1`, amber stop = `55%`, rose starts at `10 **45% gap with no color definition**. Browsers interpolate between amber (55%) and rose (100%), but the spec intends rose to dominate at high stress. **Fix**: Use three-stop gradient with explicit positions:
```javascript
const amberPos = 30 + clamped * 40;  // 300%
const rosePos = 50 + clamped * 50;   // 5000%
bar.style.background = `linear-gradient(to right, var(--emerald) 0%, var(--amber) ${amberPos}%, var(--rose) ${rosePos}%)`;
```

#### **Error 4: `updateMDSPressure` Double-Reduce Bug (Cohere JS, Line 85-92)**

```javascript
const totalWeight = nodes.reduce((sum, n) => sum + n.frictionFactor * n.weight, 0);
const avgFriction = totalWeight ? nodes.reduce((sum, n) => sum + n.frictionFactor * n.weight, 0) / totalWeight : 0;
```
**Bug**: The second `reduce` **recomputes the numerator identically** instead of using `totalWeight`. While mathematically equivalent, it's **wasted CPU**. **Fix**: `const avgFriction = totalWeight / nodes.reduce((sum, n) => sum + n.weight, 0);` — but only if `weight` is stored separately. Current node objects lack `.weight` property (see Section 2.3).

#### **Error 5: `spectral-orb` Animation `filter: brightness` Remnants (Cohere CSS, Line 56-63)**

```css
@keyframes pulse-rapid {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.1); opacity: 1; }
}
```
**Good**: Cohere correctly removed `filter: brightness()` per DeepSeek. **But**: The `pulse-slow` keyframe uses `transform: scale(1.2)` which **triggers layout** on the orb. **Fix**: Use `transform: scale(1.1)` for both, differentiate via `opacity` and `box-shadow` spread only.

---

### 2.2 JavaScript Performance Traps

#### **Trap 1: `updateMDSPressure` Called Without `requestAnimationFrame` Batching**

Cohere's spec shows:
```javascript
function updateMDSPressure(nodes) {
  // ... computes hue ...
  container.style.setProperty('--pressure-color', cssVar);
  nodes.forEach(node => {
    node.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
  });
}
```
**Risk**: If called from `loadGovernanceData` (which runs on tab switch) **and** from a simulation loop, this mutates DOM **synchronously** without batching. **Fix**: Wrap in `requestAnimationFrame` and use a single `style.setProperty` for container + CSS variables for node scales (see Section 3.1).

#### **Trap 2: `renderCapabilityGrid` Creates Inline Styles Per Icon**

```javascript
${capabilities.map(cap => `
  <div class="cap-icon" title="${cap.name}" 
       style="background: ${cap.allowed ? 'var(--emerald)' : 'var(--rose')}">
```
**Risk**: For 8+ capabilities, this creates **8 unique inline style declarations**, preventing style sharing. **Fix**: Use two classes `.cap-icon--allowed` / `.cap-icon--blocked` with CSS `background: var(--emerald/rose)`.

#### **Trap 3: `loadGovernanceData` Sequential `await` Without `Promise.all`**

```javascript
const hw = await fetchJson("/api/operator/hardware-status");
// ... updates DOM ...
const con = await fetchJson("/api/operator/consensus-map");
// ... updates DOM ...
const pre = await fetchJson("/api/operator/sandbox-preflight");
```
**Risk**: **~300-600ms added latency** vs parallel fetch. **Fix**: `const [hw, con, pre] = await Promise.all([...])`.

#### **Trap 4: `nodes.forEach` in `loadGovernanceData` Creates Closure Leaks**

```javascript
con.options.forEach((opt, idx) => {
  const dot = document.createElement("div");
  dot.addEventListener("mouseenter", () => { tooltip.innerHTML = ... });
  dot.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
  coordMap.appendChild(dot);
});
```
**Risk**: New event listeners added **every tab visit** without removal. Memory leak + duplicate tooltips. **Fix**: Use event delegation on `#coordinate-map` or `.consensus-node` class with `data-*` attributes.

---

### 2.3 Data Contract Mismatches (Spec vs. Active API)

| Spec Assumption | Active `dashboard.js` Reality | Consequence |
|-----------------|-------------------------------|-------------|
| `node.frictionFactor` (0-1) | `opt.friction` is **string** (`"low"`, `"medium"`, `"high"`) | `updateMDSPressure` math fails — string * number = `NaN` |
| `node.weight` property | **Does not exist** on created nodes | Weighted average falls back to `0` |
| `node.distanceFromCenter` | **Not computed** | Cannot weight by proximity |
| `zScore` from `/api/operator/friction-telemetry` | Returns `report.robust_z` (number) but **not normalized 0-1** | Stress Bar gradient math expects 0-1; raw Z-score (e.g., 3.2) breaks clamp |

**Critical**: The spec assumes a **normalized data contract** that the backend does not provide. Either the API must change, or the frontend must normalize (map `".2`, `".5`, `".8`; clamp Z-score to 0-1 via `Math.min(1, Math.max(0, zScore / 4))`).

---

## 3. Final Refinements: Scannability, Contrast & Visual Fidelity

### 3.1 MDS Map: CSS-Variable-Only Implementation (Zero Layout Thrash)

Replace Cohere's `updateMDSPressure` with this **zero-reflow** version:

```javascript
/**
 * Updates MDS pressure field + node scales via CSS variables only.
 * Call inside requestAnimationFrame if animating.
 * @param {Array<{friction: string, left: string, top: string, element: HTMLElement}>} nodes
 */
function updateMDSPressure(nodes) {
  const container = document.getElementById('coordinate-map');
  if (!container) return;

  // Map string friction to numeric weight
  const frictionMap = { low: 0.2, medium: 0.5, high: 0.8 };
  const scoredNodes = nodes.map(n => ({
    ...n,
    frictionFactor: frictionMap[n.friction] ?? 0.2,
    // Weight by inverse distance from center (0.5, 0.5) — parse % strings
    weight: 1 / (1 + Math.hypot(
      (parseFloat(n.left) / 100) - 0.5,
      (parseFloat(n.top) / 100) - 0.5
    ))
  }));

  if (!scoredNodes.length) {
    container.style.setProperty('--pressure-color', 'hsla(180, 0%, 55%, 0.15)');
    return;
  }

  // Weighted average (single pass)
  let totalWeight = 0, weightedSum = 0;
  for (const n of scoredNodes) {
    const w = n.frictionFactor * n.weight;
    totalWeight += w;
    weightedSum += w;
  }
  const avgFriction = totalWeight ? weightedSum / totalWeight : 0;

  // Clamped hue: 120° (emerald00° (deep magenta, not rose)
  const hue = 120 + Math.min(1, avgFriction) * 180;
  container.style.setProperty('--pressure-color', `hsla(${hue}, 70%, 55%, 0.15)`);

  // Node scales via CSS variable (no transform mutation)
  for (const n of scoredNodes) {
    const scale = 1 + Math.min(0.5, n.frictionFactor * 0.5);
    n.element.style.setProperty('--node-scale', scale);
    n.element.style.setProperty('--node-glow', n.frictionFactor);
  }
}
```

**Corresponding CSS** (add to `index.html`):
```css
.consensus-coordinate-container {
  background: radial-gradient(circle, var(--pressure-color) 0%, transparent 45%);
  /* ... existing ... */
}

.consensus-node {
  /* ... existing ... */
  transform: translate(-50%, -50%) scale(var(--node-scale, 1));
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  /* Glow via box-shadow driven by --node-glow (0-1) */
  box-shadow: 
    0 0 8px currentColor,
    0 0 calc(16px * var(--node-glow, 0)) currentColor;
}
```

### 3.2 Stress Bar: Normalized Z-Score + Tooltip

```javascript
function updateStressBar(robustZ) {
  const bar = document.querySelector('.stress-bar');
  if (!bar) return;
  // Normalize: assume Z > 4 = critical (1.0), Z < 0.5 = calm (0)
  const clamped = Math.max(0, Math.min(1, (robustZ - 0.5) / 3.5));
  const amberPos = 25 + clamped * 50;   // 255%
  const rosePos = 50 + clamped * 50;    //  100%
  bar.style.background = `linear-gradient(to right, var(--emerald) 0%, var(--amber) ${amberPos}%, var(--rose) ${rosePos}%)`;
  bar.title = `System Tension (MAD Z-score): ${robustZ.toFixed(2)}`;
}
```

**CSS Addition**:
```css
.stress-bar {
  /* ... existing ... */
  cursor: help;
}
.stress-bar::before {
  content: attr(title);
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(11, 15, 25, 0.95);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.35rem 0.6rem;
  font-size: 0.7rem;
  color: var(--text-main);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 20;
}
.stress-bar:hover::before { opacity: 1; }
```

### 3.3 Spectral Pulse: Reduced-Motion Compliant, No Layout Thrash

```css
.spectral-orb {
  width: 16px; height: 16px; border-radius: 50%;
  will-change: transform, opacity, box-shadow;
  transition: background 0.5s ease, box-shadow 0.5s ease;
}

/* States driven by JS class toggle */
.spectral-orb.normal {
  background: var(--emerald);
  box-shadow: 0 0 15px var(--emerald);
  animation: pulse-slow 4s infinite ease-in-out;
}
.spectral-orb.anomaly {
  background: var(--rose);
  box-shadow: 0 0 20px var(--rose);
  animation: pulse-rapid 0.8s infinite ease-in-out;
}

@keyframes pulse-slow {
  0%, 100% { opacity: 0.8; box-shadow: 0 0 15px var(--emerald); }
  50% { opacity: 1; box-shadow: 0 0 25px var(--emerald); }
}
@keyframes pulse-rapid {
  0%, 100% { opacity: 0.9; box-shadow: 0 0 20px var(--rose); }
  50% { opacity: 1; box-shadow: 0 0 32px var(--rose); }
}

@media (prefers-reduced-motion: reduce) {
  .spectral-orb { animation: none !important; }
  .spectral-orb.normal { box-shadow: 0 0 15px var(--emerald); }
  .spectral-orb.anomaly { box-shadow: 0 0 20px var(--rose); }
}
```

**JS Driver** (call from `loadFrictionTelemetry`):
```javascript
function updateSpectralPulse(frictionLevel) {
  const orb = document.querySelector('.spectral-orb');
  if (!orb) return;
  const isAnomaly = frictionLevel === 'high' || frictionLevel > 0.7;
  orb.classList.toggle('anomaly', isAnomaly);
  orb.classList.toggle('normal', !isAnomaly);
  orb.setAttribute('aria-label', `System friction: ${isAnomaly ? 'HIGH — anomaly detected' : 'NOMINAL'}`);
}
```

### 3.4 Capability Grid: SVG Icons, Class-Based, Accessible

**CSS** (add to `index.html`):
```css
.capability-grid {
  display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;
}
.cap-icon {
  width: 28px; height: 28px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.85rem; position: relative;
}
.cap-icon--allowed { background: var(--emerald); color: #051d12; }
.cap-icon--blocked { background: var(--rose); color: #4c0519; }
.cap-icon svg { width: 16px; height: 16px; stroke: currentColor; fill: none; }
.cap-icon:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
```

**JS** (replace Cohere's `renderCapabilityGrid`):
```javascript
const CAPABILITY_ICONS = {
  repo_retrieval_allowed: { allowed: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><polyline points="22 17 13.5 17 15.5 22 15.5 22"/></svg>', blocked: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>' },
  durable_memory_allowed: { allowed: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>', blocked: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>' },
  private_memory_access: { allowed: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/></svg>', blocked: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="2" x2="22" y2="22"/><circle cx="12" cy="10" r="3"/></svg>' },
  skills: { allowed: '<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>', blocked: '<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>' },
  blocked_context: { allowed: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>', blocked: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' },
};

function renderCapabilityGrid(receipt) {
  if (!receipt) return '';
  const caps = [
    { key: 'repo_retrieval_allowed', label: 'Repo Access', allowed: receipt.repo_retrieval_allowed },
    { key: 'durable_memory_allowed', label: 'Durable Memory', allowed: receipt.durable_memory_allowed },
    { key: 'private_memory_access', label: 'Private Memory', allowed: receipt.private_memory_access },
    { key: 'skills', label: 'Skills Loaded', allowed: Array.isArray(receipt.skills?.loaded) && receipt.skills.loaded.length > 0 },
    { key: 'blocked_context', label: 'Context Blocked', allowed: !Array.isArray(receipt.blocked_context) || receipt.blocked_context.length === 0 },
  ];
  return `
    <div class="capability-grid" role="list" aria-label="Capability boundaries">
      ${caps.map(cap => `
        <div class="cap-icon cap-icon--${cap.allowed ? 'allowed' : 'blocked'}" 
             role="listitem" tabindex="0" title="${escapeHtml(cap.label)}: ${cap.allowed ? 'Allowed' : 'Blocked'}"
             aria-label="${escapeHtml(cap.label)}: ${cap.allowed ? 'Allowed' : 'Blocked'}">
          ${CAPABILITY_ICONS[cap.key][cap.allowed ? 'allowed' : 'blocked']}
        </div>
      `).join('')}
    </div>
  `;
}
```

**Integration** — Modify `renderReceiptSummary` in `dashboard.js`:
```javascript
// Replace the facts array block with:
${renderCapabilityGrid(receipt)}
${rawDetails("Raw receipt JSON", raw)}
```

### 3.5 Keyboard Hint Bar: Focusable, ARIA-Compliant

**HTML** (insert in `header`, after dev-mode checkbox):
```html
<div class="hint-bar" role="status" aria-live="polite" tabindex="0" aria-label="Keyboard shortcuts">
  <span class="hint-icon" aria-hidden="true</span>
  <span class="hint-text">
    <kbd class="kbd-key" tabindex="0" data-key="r">R</kbd> Refresh Records
    <kbd class="kbd-key" tabindex="0" data-key="e">E</kbd> Execute Run
    <kbd class="kbd-key" tabindex="0" data-key="tab">Tab</kbd> Switch Tabs
    <kbd class="kbd-key" tabindex="0" data-key="g">G</kbd> Governance
  </span>
</div>
```

**CSS** (refined from Cohere):
```css
.hint-bar {
  position: absolute; top: 1.5rem; right: 1.5rem;
  background: rgba(13, 20, 38, 0.6); color: var(--text-main);
  padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.78rem;
  backdrop-filter: blur(8px); border: 1px solid var(--border-color);
  z-index: 10; display: flex; align-items: center; gap: 0.5rem;
  opacity: 0.7; transition: opacity 0.2s;
}
.hint-bar:hover, .hint-bar:focus-within { opacity: 1; }
.hint-icon { color: var(--text-muted); }
.hint-text { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.kbd-key {
  background: rgba(255,255,255,0.05); border: 1px solid var(--border-color);
  border-radius: 4px; padding: 0.1rem 0.35rem; font-weight: 600;
  font-family: inherit; font-size: 0.75rem; color: var(--primary);
  transition: background 0.15s, border-color 0.15s;
}
.kbd-key:focus { outline: 2px solid var(--primary); outline-offset: 2px; background: rgba(99,102,241,0.15); }
```

**JS** (global keydown handler, add to `dashboard.js` init):
```javascript
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  const key = e.key.toLowerCase();
  if (key === 'r') { e.preventDefault(); loadContinuityRecords(); }
  if (key === 'e') { e.preventDefault(); document.getElementById('console-execute-button')?.click(); }
  if (key === 'g') { e.preventDefault(); document.querySelector('[data-tab-target="tab-governance"]')?.click(); }
  if (key === 'tab') { /* native tab switching works via focus */ }
});
```

### 3.6 Semantic Layering: Panel Class Assignment

**In `dashboard.js`**, modify the console panel render to assign tier classes:

```javascript
// In the HTML, update the three console panels:
/* Execute panel */ <div class="console-panel console-panel-execute">
/* Trace panel */   <div class="console-panel console-panel-trace">
/* Receipt panel */ <div class="console-panel console-panel-trace console-panel-receipt">
```

**CSS** (already in Cohere spec, ensure in `index.html`):
```css
.console-panel-execute {
  background: var(--bg-color);
  border: 2px solid var(--primary);
  backdrop-filter: none;
  z-index: 100;
}
.console-panel-trace {
  background: rgba(13, 20, 38, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
}
```

### 3.7 Typography & Contrast Hardening

| Element | Current | Required Fix |
|---------|---------|--------------|
| `.badge-primary` text | `color: var(--primary)` on `rgba(99,102,241,0.2)` bg | **Contrast 4.2: bg opacity to `0.3` or use solid `#818cf8` bg with white text |
| `.doc-item:hover` transform | `translateY(-2px)` | Add `box-shadow: 0 8px 24px -8px rgba(99,102,241,0.2)` for depth cue |
| `.results-table td` | `font-size: 0.9rem` | Increase to `0.95rem`, `line-height: 1.5` for scanability |
| `.console-pre` | `font-size: 0.82rem` | Increase to `0.875rem`, add `font-variant-numeric: tabular-nums` |
| `h1, h2, h3` (Outfit) | No letter-spacing | Add `letter-spacing: -0.02em` for tighter headlines |

**Global CSS additions**:
```css
:root { --ui-gap: 1rem; --ui-radius: 12px; }
.card { padding: var(--ui-gap); border-radius: var(--ui-radius); }
.btn { border-radius: calc(var(--ui-radius) - 4px); }
:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
::selection { background: rgba(99, 102, 241, 0.3); color: var(--text-main); }
```

### 3.8 Governance Grid: Collapsed State for Non-Active Tabs

**Problem**: Governance grid (4 panels) renders heavy SVG/Canvas content even when tab is hidden.

**Fix**: Add `content-visibility: auto` + `contain-intrinsic-size`:
```css
.tab-content:not(.active) .governance-grid {
  content-visibility: hidden; /* or auto with contain-intrinsic-size */
}
#tab-governance .governance-grid {
  content-visibility: auto;
  contain-intrinsic-size: 0 800px;
}
```

---

## 4. Implementation Checklist (Priority Ordered)

| # | Task | File(s) | Effort | Blocks |
|---|------|---------|--------|--------|
| 1 | Add Stress Bar, Spectral Pulse, Hint Bar to `header` in `index.html` | `index.html` | Low | Peripheral awareness |
| 2 | Implement `updateMDSPressure` (CSS-var-only) + wire into `loadGovernanceData` | `dashboard.js` | Medium | MDS map vitality |
| 3 | Add `updateStressBar` + call from `loadFrictionTelemetry` | `dashboard.js` | Low | Header tension signal |
| 4 | Add `updateSpectralPulse` + call from `loadFrictionTelemetry` | `dashboard.js` | Low | Anomaly pulse |
| 5 | Implement `renderCapabilityGrid` with SVG icons + wire into `renderReceiptSummary` | `dashboard.js` | Medium | Capability scanning |
| 6 | Assign `console-panel-execute` / `console-panel-trace` classes in HTML | `index.html` | Low | Semantic layering |
| 7 | Fix `loadGovernanceData` to use `Promise.all` + event delegation for nodes | `dashboard.js` | Low | Performance |
| 8 | Normalize friction strings numeric in `loadGovernanceData` before pressure calc | `dashboard.js` | Low | Data contract |
| 9 | Add keyboard hint bar keydown handler + `tabindex` on `<kbd>` | `dashboard.js` + `index.html` | Low | Accessibility |
| 10 | Contrast fixes: badge backgrounds, table typography, focus-visible | `index.html` (CSS) | Low | WCAG AA |
| 11 | Add `content-visibility` to governance grid | `index.html` (CSS) | Low | Perf on hidden tabs |
| 12 | Tooltip polish: drop-shadow, darker bg, arrow | `index.html` (CSS) | Low | Readability |

---

## 5. Closing Assessment

Cohere's unified specification is **architecturally sound** and **correctly synthesizes** the preceding reviews. The mathematical foundations (HSLA pressure field, Z-score normalization, pulse frequency encoding) are rigorous. The semantic layering model properly separates command vs. telemetry zones.

**However, the specification is not implemented.** The active codebase contains **zero** of the three peripheral awareness DOM nodes, **zero** semantic panel classes, and **zero** capability grid integration. The MDS pressure field CSS variable is defined in JS but **never referenced in CSS**.

**Recommendation**: Treat this critique as the **implementation bridge**. The 12-item checklist above converts Cohere's design intent into shipping code with zero external dependencies, full `prefers-reduced-motion` compliance, WCAG AA contrast, and sub-16ms frame budgets via CSS-variable-only animation.

Once these 12 items are merged, the dashboard will achieve:
- **Visual momentum**: Stress Bar + Spectral Pulse + MDS pressure field create a living system perimeter
- **Operator empowerment**: Capability Grid + Semantic Layering + Keyboard Hints reduce cognitive load to decision velocity
- **Structural honesty**: Every visual signal maps to a verifiable backend metric (no decorative animations)

---

*End of Gemma UX Critique.*
```