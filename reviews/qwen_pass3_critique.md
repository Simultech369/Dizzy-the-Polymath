# Operator Performance & Concurrency Critique - Pass 3: Calibration Tuning

Looking at the workspace through the **Operator** perspective, this report audits execution efficiency, memory footprint constraints, event-loop blocking, and concurrency safety.

---

## 1. Governance Data Endpoint Parallelization (`dashboard/dashboard.js`, `lib/dashboard.mjs`)

In `dashboard/dashboard.js` (lines 552–653), the frontend updates UI metrics by querying three backend endpoints parallelized via `Promise.all`:
```javascript
const [hw, con, pre] = await Promise.all([
  fetchJson("/api/operator/hardware-status"),
  fetchJson("/api/operator/consensus-map"),
  fetchJson("/api/operator/sandbox-preflight")
]);
```

### Remaining Bottlenecks & Design Flaws

1. **Gating by the Slowest Request (Process Spawning Overhead)**:
   - While `Promise.all` executes the requests concurrently, the frontend render is fully gated by the slowest response.
   - The `/api/operator/sandbox-preflight` endpoint is exceptionally heavy. It calls `runInSandbox()` (`lib/sandbox_executor.mjs` line 38), which spawns an external Node.js child process (`spawn("node", ...)` line 68) to run a static test script, writes files to disk, and reads them back.
   - Spawning processes on Windows/Unix introduces significant latency (often 100–300ms).
   - In contrast, `/api/operator/hardware-status` and `/api/operator/consensus-map` only fetch in-memory variables and return immediately (usually <5ms).
   - **Operator Impact**: The user interface lags on tab switching and manual refresh because lightweight telemetry is blocked by an expensive process-spawning preflight check.

2. **Event-Loop Blocking via Synchronous File Operations**:
   - Inside `lib/sandbox_executor.mjs`, `runInSandbox` utilizes synchronous filesystem calls:
     - `fs.mkdirSync` (line 61)
     - `fs.writeFileSync` (line 65)
     - `fs.existsSync` (line 83)
     - `fs.readFileSync` (line 84)
   - Even though `spawn` executes asynchronously, these blocking I/O calls freeze Node's single-threaded event loop. If multiple clients refresh the dashboard, the event loop will experience brief CPU stalls.

3. **Resource Saturation / Process Flooding**:
   - The keyboard listener in `dashboard/dashboard.js` (line 1116) triggers a full reload of governance data whenever the `R` key is pressed.
   - Rapidly tapping `R` issues multiple concurrent requests to `/api/operator/sandbox-preflight`. Since there is no request throttling or process limiting, the server will spawn multiple concurrent Node processes, risking CPU and memory saturation.

4. **Useless CPU/Disk Overhead in `/api/dashboard-data`**:
   - In `lib/dashboard.mjs` (line 184), `/api/dashboard-data` invokes `runIsolatedSimulation({}, {}, {}, 1)` on every request.
   - Because parameter inputs are empty, this simulator evaluates math on `NaN` (reserves, participants, and allocations are undefined), returns invalid data, and writes/deletes dummy files on disk via `fs.promises.mkdtemp` and `fs.promises.writeFile`. This is redundant and slow.

### Recommendations
- **Decouple/Offload Preflight**: Remove `/api/operator/sandbox-preflight` from the main `Promise.all` block. Fetch it lazily or display the results asynchronously when they arrive.
- **Cache Preflight Results**: The preflight script content is entirely static. Execute it once during server startup and cache the output instead of executing a child process on every request.
- **Prune Useless Simulation Call**: Remove `runIsolatedSimulation` from the main `/api/dashboard-data` handler or pass default params to prevent `NaN` arithmetic and redundant disk operations.

---

## 2. Event Listener Allocations & Closure Memory Audit (`dashboard/dashboard.js`)

### 1. Parallax Tilt Mouse Move Listener
```javascript
mdsContainer.addEventListener('mousemove', (e) => {
  const rect = mdsContainer.getBoundingClientRect();
  const x = e.clientX - rect.left - (rect.width / 2);
  const y = e.clientY - rect.top - (rect.height / 2);
  mdsContainer.style.transform = `rotateY(${x * 0.03}deg) rotateX(${-y * 0.03}deg)`;
});
```
- **Performance Leak (Layout Thrashing)**: Calling `getBoundingClientRect()` inside a `mousemove` handler triggers synchronous layout recalculation/reflow on every frame. Because there is no throttling (using `requestAnimationFrame` or a debounce timer), this causes CPU spikes and visual stutter (jank) during interaction, especially in a 3D perspective viewport.
- **Lifecycle Leak**: The event listener is attached once to the persistent `#coordinate-map` element. While the handler is never removed, its lifecycle is bound to the element itself, which is not destroyed. It does not leak closures across refreshes.

### 2. Keyboard Event Listener
- Attached once to `document` at script startup. It captures no temporary state or closures. It is clean and poses no memory leakage risks.

### 3. Consensus Nodes Allocation & GC Pressure
In `loadGovernanceData()`, when consensus options change:
```javascript
const oldNodes = coordMap.querySelectorAll(".consensus-node");
oldNodes.forEach(node => node.remove());

// ... loop options ...
const dot = document.createElement("div");
dot.addEventListener("mouseenter", () => { ... });
dot.addEventListener("mouseleave", () => { ... });
coordMap.appendChild(dot);
```
- **GC Churn / Memory Fragmentation**: On every data refresh, all existing `.consensus-node` elements are removed, and new nodes are created. Each new node attaches two closure listeners (`mouseenter` and `mouseleave`).
- While modern browser engines garbage-collect removed elements, creating and deleting dozens of closures on every refresh increases garbage collection pressure and can lead to memory fragmentation during long sessions.
- If any external reference to a `dot` element remains in a callback or global scope, the node, its event listeners, and the captured `opt` object (with description strings) will be permanently leaked.

### Recommendations
- **Event Delegation**: Attach a single `mouseover` and `mouseout` event handler to the parent `#coordinate-map` container. Read data attributes from the target node:
  ```javascript
  // Set data attributes on creation:
  dot.dataset.id = opt.option_id;
  dot.dataset.friction = opt.friction;
  dot.dataset.description = opt.description;
  dot.dataset.color = color;
  ```
  This eliminates the need to attach/detach event listeners or allocate closures on every refresh.
- **Throttle Parallax**: Wrap the transform updates in `requestAnimationFrame` to decouple math and layout checks from the raw mouse movement rate.

---

## 3. Concurrency Safety of Friction Ledger (`lib/friction_ledger.mjs`)

The codebase exposes split synchronous (`appendFrictionSync`, `removeFrictionEntriesByKeySync`) and asynchronous (`appendFriction`, `removeFrictionEntriesByKey`) APIs operating on the same underlying `.jsonl` database file.

### Critical Concurrency Vulnerabilities

1. **Risk of Write Interleaving & Corruption**:
   - There is no file-locking mechanism (such as `flock` or lockfile markers) utilized.
   - If an async write (`fs.promises.appendFile` via the hot server path) runs concurrently with a sync write (`fs.appendFileSync` via offline CLI maintenance tools), the writes are not serialized.
   - Because standard file writes are not atomic at the operating system level, concurrent writes can interleave lines or partially overwrite blocks. This breaks the JSONL format, resulting in parsing failures on subsequent reads.

2. **Read-Modify-Write Race Condition (State Loss)**:
   - Both `removeFrictionEntriesByKey` and its sync counterpart implement a read-modify-write pattern:
     ```javascript
     const entries = await readFrictionEntries({ ...opts, maxRows: 1e6 });
     // ... filter in memory ...
     await fs.promises.writeFile(filePath, body, "utf8");
     ```
   - If a client triggers a deletion (async) while an offline tool is concurrently appending a friction entry (sync):
     1. Async path reads the file.
     2. Sync path appends a new entry to the file.
     3. Async path writes the filtered list back, truncating the file and overwriting the append.
     **Result**: The newly appended friction entry is silently lost.
   - The same issue occurs if two async deletion operations occur in close proximity.

3. **Non-Atomic File Rewrites (Truncation Danger)**:
   - `writeFile` / `writeFileSync` truncates the target file before writing new data. If the Node.js process crashes, receives a kill signal, or suffers power failure mid-write, the database will be left truncated or empty, causing irreversible loss of all historic ledger entries.

### Recommendations
- **Atomic Renames**: Rewrite data to a temporary file (e.g., `ledger.jsonl.tmp`) and rename it to the target file. Node renames are mapped to OS-level atomic renames, preventing file truncation upon crash.
- **Implement File Locking**: Acquire an exclusive advisory lock on the ledger file before reading during any delete/modify cycle, and release the lock only after the atomic rename is complete.

---

## 4. Additional Architectural Observations

### MDS Projector Cache Key and Loop Efficiency (`lib/options_projection.mjs`)

1. **Jaccard Distance Tokenization Churn**:
   In `projectCoordinatesRaw()`, pairwise Jaccard distance is computed:
   ```javascript
   for (let i = 0; i < n; i++) {
     for (let j = i + 1; j < n; j++) {
       const textDist = computeDistance(nodes[i].opt.description, nodes[j].opt.description);
       // ...
   ```
   `computeDistance` calls `tokenize()` on descriptions repeatedly inside the nested loop. This means the description of each option is tokenized $n - 1$ times.
   - **Operator Impact**: For $n$ options, it performs $O(n^2)$ tokenization steps. Pre-tokenizing descriptions once before starting the pairwise distance calculations reduces this to $O(n)$, drastically cutting CPU overhead.

2. **Large Cache Keys in LRU**:
   The cache key is built by joining stringified descriptions:
   ```javascript
   const optionHash = options
     .map(opt => `${opt.option_id}:${opt.description}:${opt.friction}`)
     .sort()
     .join("||");
   ```
   If option descriptions are verbose, the key strings can grow to tens of kilobytes. Storing these large strings in the `Map` increases heap memory consumption.
   - **Operator Recommendation**: Generate a SHA-256 hash of the sorted option string. This ensures a fixed 64-character key size:
     ```javascript
     const hash = crypto.createHash("sha256").update(optionHash).digest("hex");
     const key = `${iterations}||${hash}`;
     ```

3. **TOCTOU in Bridge Acceptance**:
   In `lib/dashboard.mjs` (lines 336–339), `fs.promises.stat` is used to check file existence before reading it. This introduces a Time-Of-Check to Time-Of-Use race condition. It is safer to read the file directly and handle any missing file errors within the `try/catch` block.

---

## 5. Summary of Key Recommendations

| Component | Risk / Bottleneck | Severity | Action |
|---|---|---|---|
| `/api/operator/sandbox-preflight` | Process spawn overhead and blocking sync FS calls on main thread | **High** | Cache preflight outputs; load asynchronous to other telemetry. |
| `/api/dashboard-data` | Redundant isolated simulation run with NaN calculations | **Medium** | Remove baseline simulation run from page load path. |
| `#coordinate-map` | Layout reflow (`getBoundingClientRect`) on every mouse movement | **Medium** | Throttle parallax handler via `requestAnimationFrame`. |
| Consensus Nodes | GC churn and closure allocation pressure on DOM recreation | **Low/Medium** | Implement event delegation on `#coordinate-map`. |
| `lib/friction_ledger.mjs` | Write interleaving and lost updates via unsynchronized sync/async calls | **High** | Introduce advisory file locking and write-then-rename updates. |
| `lib/options_projection.mjs` | Redundant $O(n^2)$ tokenization loops | **Medium** | Pre-tokenize option descriptions prior to pairwise calculation. |
