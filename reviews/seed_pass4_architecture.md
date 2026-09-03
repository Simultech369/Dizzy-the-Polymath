# Pass 4 Semantic Core Audit & High-Performance Dashboard Rendering Report
**Author:** Systems Architect / High-Performance Rendering Engineer (Seed-2.1-Pro)  
**Date:** July 17, 2026  
**Target Architecture:** Dizzy Cognitive Engine (Pass 4 Framework)  

---

## 1. Executive Summary

This audit evaluates the semantic core and rendering subsystems of the Dizzy project, specifically auditing memory graphs (`lib/memory_graph.mjs`), bridging scans (`lib/bridging_scan.mjs`), and the calibration playground dashboard (`dashboard.js` & `index.html`). 

Our audit has revealed:
- **Five critical semantic indexing and trust-boundary defects** in `lib/memory_graph.mjs`, including a default-allow trust-zone leakage and stopword score inflation.
- **Three mathematical and state-handling flaws** in `lib/bridging_scan.mjs`, including asymmetric size Jaccard dilution and approval state clobbering.
- **Substantial rendering bottlenecks** in the dashboard, with concrete recommendations for WebGL/WebGPU offloading, CSS Houdini paint worklets, and smooth View Transitions.

All recommendations prioritize technologies ship-ready in **2026** with standard modern browser support.

---

## 2. Memory Graph Audit (`lib/memory_graph.mjs`)

### Defect 2.1: Stopword Leakage and Keyword Score Inflation (Semantic Defect)
* **Location:** `tokenize()` (L10-L15) and `topTokens()` (L87-L96)
* **Mechanics:** `tokenize` splits text and filters out tokens with length $< 3$ or $> 40$. However, it contains no stopword dictionary. High-frequency English words of length $\ge 3$ (e.g., `"the"`, `"and"`, `"what"`, `"for"`, `"but"`, `"not"`, `"you"`, `"has"`, `"can"`, `"our"`, `"how"`, `"why"`, `"get"`, `"any"`, `"all"`, `"out"`) are indexed as valid tokens.
* **Consequence:** 
  1. **Score Inflation:** When queries contain common words (e.g., *"What is the precarity of housing?"*), the query tokens include `"what"`, `"the"`, `"precarity"`, `"housing"`. In `scoreDoc()`, matches on `"the"` or `"what"` in titles get $+4$ points and in headings get $+3$ points, heavily inflating the score of irrelevant documents simply because they use common grammar.
  2. **Keyword Poisoning:** In `topTokens()`, terms are sorted purely by occurrence count. Without stopword filtering, the 12 keywords extracted to build `keywordSet` consist almost entirely of common stopwords (like `"the"`, `"and"`). This renders the keyword-matching logic in `scoreDoc` ($+2$ points) practically useless for semantic mapping.
* **Remedy:** Apply a standard English stopword list during tokenization or keyword extraction.

### Defect 2.2: Acronym Omission (Semantic Defect)
* **Location:** `extractEntities()` (L129-L146)
* **Mechanics:** The regular expression used to capture camelCase/capitalized entity names is `/\b([A-Z][a-z0-9]+(?: [A-Z][a-z0-9]+){0,3})\b/g`.
* **Consequence:** Capital letters followed by capitals (e.g., all-caps acronyms) are skipped. Standard high-priority technical entities such as **WebGPU**, **WebGL**, **HTML**, **CSS**, **SVG**, **CPU**, and **RAM** will fail to match the regex. Because these are omitted, the entity-relation mapping layer completely misses key conceptual linkages.
* **Remedy:** Modify the entity regular expression to support acronyms (e.g., allow uppercase sequences followed by lowercase transitions).

### Defect 2.3: Trust-Zone Leakage / Permission Bypass (Security Bug)
* **Location:** `zoneAllows()` (L372-L376) and `buildGraph()` (L289)
* **Mechanics:**
  ```javascript
  function zoneAllows(zoneAllowed, trustZone) {
    if (!trustZone) return true;
    if (!zoneAllowed) return true; // <-- Leak occurs here
    return zoneAllowed.split(",").map((item) => item.trim()).filter(Boolean).includes(trustZone);
  }
  ```
  If a document does not specify a `zone_allowed` parameter in its frontmatter, `doc.zone_allowed` is set to `""`. When a query is run with a restricted trustZone (e.g., `trustZone = "public"`), the check `!zoneAllowed` matches `""` and returns `true`.
* **Consequence:** By default, files without explicit trust-zone headers are treated as **permissive for all trust zones**, including public and restricted zones. This violates the security posture of "Private self-retention" by default, risking private context leaks.
* **Remedy:** Default to a secure posture (e.g., if a document lacks `zone_allowed`, only allow it if `trustZone` is empty or matches a default private label).

### Defect 2.4: Diversification List Truncation (Mathematical Logic Defect)
* **Location:** `getRelevantMemoryGraphContext()` (L402-L412)
* **Mechanics:** To diversify results, documents are capped by kind using `kindCount >= Math.max(1, k - 1)`. If `selected.length` is incremented but remains less than `k` (due to skipping subsequent documents of duplicate kinds), the final array is returned as:
  ```javascript
  const finalDocs = selected.length ? selected : scored.slice(0, k);
  ```
* **Consequence:** Since `selected.length` is non-zero, it is used directly. If `k = 3` and the list only contains `conversation` documents, the diversification loop will cap the allowed conversation documents at 2, leaving `selected.length` at 2. Instead of filling the third slot with another high-scoring conversation doc, it returns only 2 documents. The system returns fewer than `k` documents despite having valid matches available.
* **Remedy:** If `selected.length < k`, fall back to appending skipped high-scoring documents until `k` is reached.

### Defect 2.5: Synchronous File I/O Blocking the Event Loop (Performance Hazard)
* **Location:** `buildGraph()` (L250-L292)
* **Mechanics:** Traversing directories and reading up to 500 files is executed synchronously using `fs.readdirSync` and `fs.readFileSync` on the main Node thread.
* **Consequence:** In an active server environment (`agent_server.mjs`), if multiple requests or heartbeats trigger graph rebuilding, the main event loop blocks completely. This results in latency spikes, HTTP timeouts, and degraded response times.
* **Remedy:** Utilize asynchronous file traversal (`fs.promises.readdir`, `fs.promises.readFile`) combined with `Promise.all` batches.

---

## 3. Bridging Scan Audit (`lib/bridging_scan.mjs`)

### Defect 3.1: Asymmetric Jaccard Similarity Dilution (Mathematical Defect)
* **Location:** `computeJaccardSimilarity()` (L29-L38) & `scanBridgingMemories()` (L63-L75)
* **Mechanics:** The Jaccard index $\frac{|A \cap B|}{|A \cup B|}$ is computed between the active session tokens and historical logs.
* **Consequence:** Jaccard similarity is highly sensitive to size disparities. If the active session is short (e.g., 15 tokens) and the historical memory file is long (e.g., 1000 tokens), the union size will be $\ge 1000$. Even if all 15 active session tokens match the file perfectly, the maximum similarity is capped at $\frac{15}{1000} = 0.015$. Because the default Jaccard threshold is $0.05$, **long memory files can never match short active sessions**, regardless of semantic similarity.
* **Remedy:** Replace raw Jaccard with the **Overlap Coefficient** (Szymkiewicz–Simpson):
  $$\text{Overlap}(A, B) = \frac{|A \cap B|}{\min(|A|, |B|)}$$
  Or use a weighted blend of Jaccard and containment metrics.

### Defect 3.2: Quarantine State-Clobbering (Race & Persistence Bug)
* **Location:** `stageBridges()` (L96-L112)
* **Mechanics:** The staging ID is computed strictly via the path hash of the source file and `"active_session"`. It does not factor in existing quarantine approvals.
* **Consequence:** If the operator had reviewed a bridge in a prior session and marked it `approved_by_operator = true`, re-running the bridging scan in the next session will write the JSON file to `targetPath` unconditionally. This clobbers the approved state, resetting `approved_by_operator` back to `false` and moving it back to `quarantined`.
* **Remedy:** Check if the bridge file already exists in `quarantineDir`. If it does, load it and preserve the `approved_by_operator` and `status` values, or avoid overwriting approved records.

### Defect 3.3: Missing Target File Context in Staged Payload
* **Location:** `scanBridgingMemories()` (L67-L74)
* **Mechanics:** The bridges array does not define the `target_file` path parameter (it is computed as `"active_session"` inside `getBridgeId` but not written to the returned payload).
* **Consequence:** The generated bridge JSON on disk is missing the target destination path. When the operator runs a merge engine, there is no metadata indicating where the bridge is supposed to connect, rendering the automation pipeline broken.
* **Remedy:** Populate `target_file` explicitly in `scanBridgingMemories` (e.g., setting it to the path of the active session document being evaluated).

---

## 4. Dashboard Visualization Audit (`dashboard.js` & `index.html`)

### 4.1. Rendering Optimization: WebGL/WebGPU Offloading
* **Current State:** The 2D Options Coordinates Map (`#coordinate-map`) renders coordinates by clearing the container and instantiating individual `div` elements for each node.
* **Issues:** DOM thrashing, reflow costs, and CPU paint overhead. For a dense multi-agent options space, this limits scalability and halts frame rates.
* **WebGPU/WebGL Paradigm (2026 Support):** 
  - Offload the entire coordinate space projection to a `<canvas>` context utilizing WebGL or WebGPU.
  - Custom vertex shaders can handle coordinate mapping, while fragment shaders can render high-performance glowing, pulsing, and link paths.
  - WebGPU is fully supported in Chromium 113+ and Safari 18+ (mainline by 2026), providing low-overhead drawing calls and GPU-side compute capabilities for real-time MDS layout optimization.

### 4.2. Paint Worklets: CSS Houdini Integration
* **Current State:** The coordinate grid backgrounds, radial glow pressures, and terminal scanline effects are rendered via CSS gradients, box-shadows, and DOM overlays.
* **Houdini Paradigm (2026 Support):**
  - **Paint API:** Register a custom CSS Paint Worklet to draw the coordinate grid overlay and spectral pressure gradients directly to a Canvas-backed CSS image. This prevents style recalcs and rasterization on the main thread.
  - **Registered Custom Properties:** Enable GPU-accelerated transition animations on CSS variables (e.g., `--node-scale`, `--node-glow`, `--pressure-color`) by registering them in JavaScript:
    ```javascript
    CSS.registerProperty({
      name: '--node-scale',
      syntax: '<number>',
      inherits: false,
      initialValue: '1'
    });
    ```
    This allows the browser to interpolate custom variables smoothly via standard CSS transitions (`transition: --node-scale 0.3s ease`).

### 4.3. Layout Transition Polish: View Transitions API
* **Current State:** Tab switches are instantaneous class toggles (`.classList.toggle("active")`), causing layout shifts.
* **View Transitions Paradigm (2026 Support):**
  - Wrap the DOM updates in `document.startViewTransition()`. The browser automatically captures snapshots of the old and new layouts, cross-fades them, and animates transition positions.
  - Add `view-transition-name` to key components (e.g., the coordinate map container) so they transition seamlessly across tabs or size shifts.

---

## 5. Implementation Code Diffs (Actionable Fixes)

### Diff 5.1: `lib/memory_graph.mjs` Stopwords, Acronyms, and Trust-Zone Fix
```diff
--- <local-clawd-checkout>\lib\memory_graph.mjs
+++ <local-clawd-checkout>\lib\memory_graph.mjs
@@ -7,9 +7,29 @@
   return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
 }
 
+const GENERAL_STOPWORDS = new Set([
+  "the", "and", "but", "for", "not", "new", "get", "has", "can", "out", 
+  "how", "why", "our", "you", "are", "they", "will", "this", "that", 
+  "with", "from", "who", "any", "all", "one", "two", "use", "was", "its"
+]);
+
 function tokenize(text) {
   return String(text || "")
     .toLowerCase()
     .split(/[^a-z0-9_]+/g)
-    .filter((t) => t.length >= 3 && t.length <= 40);
+    .filter((t) => t.length >= 3 && t.length <= 40 && !GENERAL_STOPWORDS.has(t));
 }
 
@@ -127,11 +147,11 @@
 function extractEntities(text) {
   const counts = new Map();
-  const re = /\b([A-Z][a-z0-9]+(?: [A-Z][a-z0-9]+){0,3})\b/g;
+  const re = /\b([A-Z]{2,6}|[A-Z][a-z0-9]+(?: [A-Z][a-z0-9]+|[A-Z]{2,6}){0,3})\b/g;
   for (const line of String(text || "").split(/\r?\n/)) {
     let m;
     while ((m = re.exec(line))) {
       const entity = String(m[1] || "").trim();
       if (!entity || ENTITY_STOPWORDS.has(entity)) continue;
       if (entity.length < 3 || entity.length > 60) continue;
       counts.set(entity, (counts.get(entity) || 0) + 1);
@@ -370,5 +390,5 @@
 function zoneAllows(zoneAllowed, trustZone) {
   if (!trustZone) return true;
-  if (!zoneAllowed) return true;
+  if (!zoneAllowed) return (trustZone === "" || trustZone === "private"); // Fail-safe: empty zoneAllowed defaults to private
   return zoneAllowed.split(",").map((item) => item.trim()).filter(Boolean).includes(trustZone);
 }
```

### Diff 5.2: `lib/memory_graph.mjs` Diversification Fix
```diff
--- <local-clawd-checkout>\lib\memory_graph.mjs
+++ <local-clawd-checkout>\lib\memory_graph.mjs
@@ -400,3 +400,10 @@
   
-  const finalDocs = selected.length ? selected : scored.slice(0, k);
+  let finalDocs = selected;
+  if (selected.length < k && scored.length > selected.length) {
+    const selectedPaths = new Set(selected.map((x) => x.doc.path));
+    for (const item of scored) {
+      if (!selectedPaths.has(item.doc.path)) {
+        finalDocs.push(item);
+        if (finalDocs.length >= k) break;
+      }
+    }
+  }
+  if (!finalDocs.length) finalDocs = scored.slice(0, k);
```

### Diff 5.3: `lib/bridging_scan.mjs` Asymmetry Jaccard & Staging Overwrite Fix
```diff
--- <local-clawd-checkout>\lib\bridging_scan.mjs
+++ <local-clawd-checkout>\lib\bridging_scan.mjs
@@ -28,10 +28,11 @@
-export function computeJaccardSimilarity(setA, setB) {
-  const union = new Set([...setA, ...setB]);
-  if (union.size === 0) return 0;
-  
+export function computeOverlapSimilarity(setA, setB) {
+  const minSize = Math.min(setA.size, setB.size);
+  if (minSize === 0) return 0;
+
   let intersection = 0;
   for (const word of setA) {
     if (setB.has(word)) intersection++;
   }
-  return intersection / union.size;
+  // Overlap Coefficient (Szymkiewicz-Simpson)
+  return intersection / minSize;
 }
@@ -62,3 +63,3 @@
-    const score = computeJaccardSimilarity(currentTokens, fileTokens);
-    if (score >= threshold) {
+    const score = computeOverlapSimilarity(currentTokens, fileTokens);
+    if (score >= threshold) {
       const overlaps = [...currentTokens].filter(w => fileTokens.has(w));
       bridges.push({
         source_file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
+        target_file: "memory/active_session.md", // Populated context
         score: Number(score.toFixed(3)),
         bridge_concepts: overlaps.slice(0, 10),
@@ -99,10 +101,15 @@
   for (const bridge of bridges) {
-    const bridgeId = getBridgeId(bridge.source_file, "active_session");
+    const bridgeId = getBridgeId(bridge.source_file, bridge.target_file || "active_session");
     const filename = `bridge_${bridgeId}.json`;
     const targetPath = path.join(quarantineDir, filename);
 
-    // Enforce Risk B validation: default approval must always be false
-    bridge.approved_by_operator = false;
-    bridge.status = "quarantined";
+    // Prevent clobbering approved state
+    if (fs.existsSync(targetPath)) {
+      try {
+        const existing = JSON.parse(fs.readFileSync(targetPath, "utf8"));
+        if (existing.approved_by_operator) {
+          continue; // Skip overwriting if already operator-approved
+        }
+      } catch {}
+    }
 
+    bridge.approved_by_operator = false;
+    bridge.status = "quarantined";
     fs.writeFileSync(targetPath, JSON.stringify({ id: bridgeId, ...bridge }, null, 2), "utf8");
   }
```

---

## 6. Dashboard High-Performance Implementation Guide

### 6.1. WebGL/WebGPU Canvas Shader Setup (MDS Rendering)
To transition the options map coordinate space to GPU rendering, instantiate a high-performance rendering pipeline inside `dashboard.js`:

```javascript
// WebGL Canvas MDS Point Renderer
class CoordinateRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl');
    this.points = [];
    this.initShaders();
  }

  initShaders() {
    const vs = `
      attribute vec2 a_position;
      attribute vec3 a_color;
      varying vec3 v_color;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        gl_PointSize = 12.0;
        v_color = a_color;
      }
    `;
    const fs = `
      precision mediump float;
      varying vec3 v_color;
      void main() {
        // Render points as circles
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.4, dist);
        gl_FragColor = vec4(v_color, alpha);
      }
    `;
    // Standard shader setup code...
  }

  updateData(nodes) {
    // Map normalized MDS coordinates [-1.0, 1.0] and bind buffer arrays
  }

  draw() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.POINTS, 0, this.points.length);
  }
}
```

### 6.2. Modern CSS Houdini Paint Worklet Setup
Create and register a Houdini Paint Worklet (`paint-worklet.js`) to render the coordinate background grid efficiently:

```javascript
// paint-worklet.js
registerPaint('coordinate-grid', class {
  static get inputProperties() { return ['--pressure-color']; }
  paint(ctx, geom, properties) {
    const color = properties.get('--pressure-color').toString();
    const size = 20;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    
    // Draw grid
    for (let x = 0; x < geom.width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, geom.height);
      ctx.stroke();
    }
    for (let y = 0; y < geom.height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(geom.width, y);
      ctx.stroke();
    }
  }
});
```

Load this worklet in `dashboard.js`:
```javascript
if ('paintWorklet' in CSS) {
  CSS.paintWorklet.addModule('/assets/paint-worklet.js');
}
```

Then, set the background styling in `index.html`:
```css
.coordinate-grid-overlay {
  background-image: paint(coordinate-grid);
}
```

### 6.3. Tab Navigation Transition Integration
Modify `switchTab` inside `dashboard.js` to utilize the View Transitions API:

```javascript
function switchTab(tabId) {
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");

  if (!document.startViewTransition) {
    // Fallback for older browsers
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tabTarget === tabId));
    contents.forEach((content) => content.classList.toggle("active", content.id === tabId));
    return;
  }

  document.startViewTransition(() => {
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tabTarget === tabId));
    contents.forEach((content) => content.classList.toggle("active", content.id === tabId));
  });
}
```
This enables hardware-accelerated cross-fades during dashboard navigation, boosting visual responsiveness.

---
*Report concluded.*
