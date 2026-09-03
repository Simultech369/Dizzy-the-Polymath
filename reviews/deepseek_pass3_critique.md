# Codebase Review: Architecture, Concurrency, and Security Boundaries
**Author:** Strategist  
**Date:** July 16, 2026  
**Target Artifact:** `reviews/deepseek_pass3_critique.md`

This document provides a rigorous architectural critique of the recently refactored files in the Dizzy codebase, focusing on security boundary integrity, concurrency risks, cache efficiency, and critical execution bugs.

---

## 1. Executive Summary

While the codebase demonstrates clean separation of concerns and addresses specific performance criteria (such as event loop fluidity via async APIs and offline script availability), several severe vulnerabilities and bugs were uncovered:

1. **Authentication Bypass in Dashboard Guard (`lib/dashboard.mjs`):** The access guard does not verify the dashboard session cookie, rendering the login form entirely cosmetic. Any local process or browser tab can access private memory, prompt configs, and execution routes without authentication.
2. **Critical Syntax Error in Frontend (`dashboard/dashboard.js`):** An unmatched closing brace on the final line of the script causes a browser parsing error, rendering the entire dashboard interface dead on load.
3. **Concurrency Race Condition in Friction Ledger (`lib/friction_ledger.mjs`):** The `removeFrictionEntriesByKey` operations utilize a non-atomic read-modify-write pattern without locking. Concurrent writes or deletes will result in silent record deletion.
4. **Data Leakage in Simulation Sandbox (`lib/scenario_simulator.mjs`):** Isolated simulations write temporary checkpoints to the system-wide temp directory, exposing sensitive user metrics in multi-tenant environments. Furthermore, simulation execution is not process-isolated, presenting proto-pollution and DoS threats.
5. **Memory and DoS Vectors in Coordinate Cache (`lib/options_projection.mjs`):** Long string keys in `mdsCache` can balloon heap usage. The lack of input size bounds in multidimensional spring projection poses a major CPU blocking hazard (Algorithmic DoS).

---

## 2. Friction Ledger Analysis (`lib/friction_ledger.mjs`)
*Critique Target: Sync/async split interfaces, offline checks, and server fluidity.*

### Sync/Async Architecture
The separation of synchronous methods (e.g., `appendFrictionSync`) and asynchronous methods (e.g., `appendFriction`) is structured correctly. Offline maintenance tools (like git hooks or startup validation scripts) can run blocking operations safely without requiring a Node.js event loop framework, while hot server routes remain fluid by using non-blocking promise-based APIs.

### Major Concurrency & Race Conditions
The implementation of `removeFrictionEntriesByKey` (and its sync equivalent) contains a classic **read-modify-write race condition**:

```javascript
// Lines 205-219
const entries = await readFrictionEntries({ ...opts, maxRows: 1e6 });
const kept = [];
let removedCount = 0;

for (const entry of entries) {
  if (entry.task_context === conversationKey) {
    removedCount++;
  } else {
    kept.push(entry);
  }
}

if (removedCount > 0) {
  const body = kept.length ? `${kept.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  await fs.promises.writeFile(filePath, body, "utf8");
}
```

*   **Stomping Hazard:** If an incoming request invokes `appendFriction` concurrently after `readFrictionEntries` has executed but before `writeFile` completes, the newly appended record will be overwritten and permanently lost.
*   **Lack of Mutex/Locks:** There is no mechanism (such as an in-memory queue, file-level locking via `fs-ext`, or helper lockfiles) to coordinate writes between parallel asynchronous paths or across separate processes (such as a concurrent offline CLI run).

### Non-Atomic File Writes
If the process crashes or loses power during the execution of `fs.promises.writeFile` (line 219), the ledger file will be left partially written or truncated.
*   **Remediation:** Write the updated contents to a temporary file (e.g., `ledger.jsonl.tmp`) in the same directory, then rename it atomically to the target file using `fs.promises.rename`.

---

## 3. Isolated Scenario Simulator (`lib/scenario_simulator.mjs`)
*Critique Target: Security boundaries and path escapes in `runIsolatedSimulation`.*

### Temp Path Containment & Multi-Tenant Exposure
`runIsolatedSimulation` generates a temporary directory using `os.tmpdir()`:

```javascript
// Line 137
const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "dizzy-sim-"));
```

*   **Security Leak:** On shared hosting or multi-user Unix systems, `/tmp` is readable by other local processes. Writing the simulation checkpoint JSON containing system parameters and state vectors there violates the boundaries of the "Private Self" trust zone.
*   **Path Escape:** There are no raw parameters from input directly concatenated to paths, which mitigates simple path traversal. However, if `os.tmpdir()` resolves to an insecure parent path, symlink hijacking or race conditions during the final `rm` cleanup are theoretically possible.
*   **Remediation:** Contain temporary directories within a restricted folder in the workspace (e.g., `path.join(process.cwd(), "runtime/tmp")`) and restrict permissions to owner-only (`0700` on Unix).

### Input Validation & Prototype Pollution
*   **No Validation on State Objects:** While parameters are validated, the `initialState` object is destructured (`{ ...initialState }`) without structure checking. If a client transmits a crafted object containing prototype-polluting payloads (like `__proto__` overrides) or custom getters, it can induce system crashes or runtime side-effects.
*   **Bubble-up NaN Errors:** If `initialState` is missing expected keys (e.g., `reserves` or `participants`), the values will silently evaluate as `NaN` during arithmetic steps in `simulateStep` (lines 17–31). This corrupts the cosine similarity calculations, yielding `NaN` coordinate projections that propagate directly to the frontend.

### The Sandbox Illusion
The simulator is named `runIsolatedSimulation` and categorized under "isolated paths," but the execution occurs completely in-process within the main Node.js runtime thread. There is no CPU, memory, or context isolation for the mathematical steps. Calling it an "isolated simulation" is a misnomer; only the checkpoint file is isolated, not the code execution.

---

## 4. Multi-Entry Coordinate Cache (`lib/options_projection.mjs`)
*Critique Target: Cache architecture, memory leak vectors, and algorithmic complexity.*

### LRU Validation
The LRU cache architecture is functional. Deleting a key and setting it again moves it to the end of the Map's insertion order, and evicting using `mdsCache.keys().next().value` successfully removes the least recently used key.

### Memory Leak Vectors
1. **Shallow Copies of Cached Value Objects:**
   ```javascript
   // Lines 93-97
   return nodes.map(node => ({
     ...node.opt,
     left: `${Math.round(node.x * 100)}%`,
     top: `${Math.round(node.y * 100)}%`
   }));
   ```
   If option objects are shallow copied, nested properties or references to large parent objects/contexts are kept alive in memory. If the caller mutates the nested structures post-cache, they mutate the cache entry itself, contaminating subsequent lookups.
2. **Heap Bloat via Giant String Keys:**
   The cache key is constructed by joining all option data:
   ```javascript
   const optionHash = options
     .map(opt => `${opt.option_id}:${opt.description}:${opt.friction}`)
     .sort()
     .join("||");
   const key = `${iterations}||${optionHash}`;
   ```
   If the server projects 100 options with descriptions of 5KB each, a single cache key will be a string of over 500KB. Pinned across `MAX_CACHE_SIZE = 100`, this consumes significant memory. 
   *   **Remediation:** Hash the concatenated string to a fixed-size SHA-256 hex string (`64 characters`) to save space and speed up Map lookup matches.

### Algorithmic DoS (CPU Blocking)
In `projectCoordinatesRaw`, the precomputation of target distances has $O(n^2)$ complexity, and the spring optimization runs for $M$ iterations (default 100) doing pairwise updates:

```javascript
// Lines 55-82
for (let step = 0; step < iterations; step++) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) { ... }
  }
}
```

If $n = 2000$, the inner loop executes $100 \times 4,000,000 = 400,000,000$ times. Jaccard similarity is computed on initial pairs. Because Node.js is single-threaded, a request containing a large list of options will block the event loop for several seconds, rendering the server completely unresponsive.
*   **Remediation:** Validate that `options.length` does not exceed a safe threshold (e.g., 50) before initiating projection.

---

## 5. Critical Bugs & Security Vulnerabilities

### Critical Bug A: Front-end Syntax Error (`dashboard/dashboard.js`)
On line 1148, there is an unmatched closing brace:
```javascript
1145:     }
1146:   }
1147: });
1148: } // <-- Syntax Error: Unexpected token '}'
```
This syntax error causes the browser to reject `dashboard.js` upon load. None of the event listeners, charts, or tabs will register, rendering the playground entirely broken for operators.

### Critical Bug B: Total Authentication Bypass (`lib/dashboard.mjs`)
The `dashboardAccessGuard` checks loopback origin and mutation restrictions, but it **never reads or validates the session cookie** (`dizzy_dashboard_session`) for standard routes:

```javascript
// Lines 48-70: dashboardAccessGuard
function dashboardAccessGuard({ authToken, normalizeIp, isLoopbackHost }) {
  return function guard(req, res, next) {
    if (!authToken) {
      return res.status(503).json({ ok: false, error: "Dashboard requires DIZZY_AUTH_TOKEN" });
    }
    const remote = normalizeIp(req.socket?.remoteAddress || req.ip);
    ...
    if (!isLoopbackHost(remote) || forwarded) {
      return res.status(403).json({ ok: false, error: "Dashboard is restricted to local loopback connections only" });
    }
    ...
    if (!sameOriginMutation(req) && !hasMasterBearer(req, authToken)) {
      return res.status(403).json({ ok: false, error: "Dashboard mutation requires same-origin request or master bearer token" });
    }
    return next(); // <-- Session cookie never verified!
  };
}
```

*   **Security Failure:** The login form is a superficial wall. Any user or local script hitting `http://localhost:3000/dashboard` or calling `/api/dashboard-data` (GET) is immediately granted full access without entering the token or submitting a valid session cookie.

---

## 6. Suggested Remediation Plan

### 1. Fix Syntax Error in `dashboard.js`
Remove the trailing closing brace on the final line of `dashboard/dashboard.js`.

### 2. Implement Session Verification in `dashboardAccessGuard`
Update `lib/dashboard.mjs` to retrieve and validate the cookie session. 
```javascript
// Add cookie checking to the guard:
const cookies = req.headers.cookie?.split(";").reduce((acc, c) => {
  const [k, v] = c.trim().split("=");
  acc[k] = v;
  return acc;
}, {}) || {};

const sessionToken = cookies[DASHBOARD_SESSION_COOKIE];
// Validate sessionToken against the session store...
```

### 3. Hash Cache Keys & Deep Copy Option Objects
Update `lib/options_projection.mjs` to keep cache footprint low and protect cache immutability:
```javascript
// SHA-256 key hashing
import crypto from "crypto";

const rawKey = `${iterations}||${optionHash}`;
const key = crypto.createHash("sha256").update(rawKey).digest("hex");

// Deep copy opt items in projectCoordinatesRaw
return nodes.map(node => ({
  ...JSON.parse(JSON.stringify(node.opt)),
  left: `${Math.round(node.x * 100)}%`,
  top: `${Math.round(node.y * 100)}%`
}));
```

### 4. Contain Temp Directories
Modify `lib/scenario_simulator.mjs` to write temp files inside the project directory:
```javascript
const workspaceTempRoot = path.join(process.cwd(), "runtime", "tmp");
await fs.promises.mkdir(workspaceTempRoot, { recursive: true });
const tempDir = await fs.promises.mkdtemp(path.join(workspaceTempRoot, "dizzy-sim-"));
```
