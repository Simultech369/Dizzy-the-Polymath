
Looking at the provided files through an operational lens focusing on runtime performance, caching efficiency, and concurrency, I'll identify the critical issues:

## reviews/qwen_radiating_critique.md

# Operator Performance & Concurrency Critique - Pass 2: Radiating Outward

## 1. PROJECTION CACHING ANALYSIS (`lib/options_projection.mjs`)

### Critical Cache Design Flaws

**Single Entry Cache Bottleneck:**
The current caching implementation has a severe architectural limitation:

```javascript
let mdsCache = {
  key: "",
  value: null
};
```

This single-entry cache can only retain one projection result, causing cache thrashing when multiple distinct option sets are projected. During high-frequency dashboard updates, each unique set evicts the previous, offering minimal performance gain while consuming memory.

**Key Collision Vulnerability:**
The cache key generation is susceptible to collisions:

```javascript
const key = options.map(opt => `${opt.option_id}:${opt.description}:${opt.friction}`).join("||");
```

Fields containing `||` delimiter or differing iteration counts will incorrectly match cached results. The absence of iteration count in the key means a request with `iterations=50` could hit cached results from a previous `iterations=100` call.

**No Cache Eviction Strategy:**
Missing cache invalidation creates potential memory leaks. Large option arrays could accumulate without bounds.

### Suggested Improvements

Replace the single-entry cache with an LRU implementation supporting multiple entries:

```javascript
import { LRUMap } from 'lru_map'; // Or implement simple LRU

const MAX_CACHE_SIZE = 100;
const mdsCache = new LRUMap(MAX_CACHE_SIZE);

export function projectCoordinates(options, iterations = 100) {
  if (!options || options.length === 0) return [];
  
  // Include iterations in key to prevent incorrect hits
  const key = `${iterations}||${options.map(opt => 
    `${opt.option_id}:${opt.description}:${opt.friction}`
  ).join("||")}`;
  
  const cached = mdsCache.get(key);
  if (cached) return cached;
  
  const projected = projectCoordinatesRaw(options, iterations);
  mdsCache.set(key, projected);
  return projected;
}
```

## 2. EVENT-LOOP BLOCKERS (`lib/dashboard.mjs`)

### Synchronous File Operations Blocking Event Loop

Multiple endpoints perform blocking I/O operations that freeze request processing:

**`/assets/dashboard.js` and `/assets/dashboard-login.js`:**
```javascript
const script = fs.readFileSync(scriptAssetPath, "utf8");
```
During high-speed query streams, these sync reads stall all concurrent requests.

**`/api/operator/quarantined-bridges`:**
```javascript
const files = fs.readdirSync(QUARANTINE_DIR);
// ...
const content = fs.readFileSync(path.join(QUARANTINE_DIR, file), "utf8");
```
Directory scanning and multiple file reads create cumulative delays.

**`/api/operator/quarantined-bridges/accept`:**
```javascript
fs.writeFileSync(acceptedBridgesPath, JSON.stringify(accepted, null, 2), "utf8");
```
Synchronous writes block until disk I/O completes, affecting throughput.

### CPU-Bound Operations Without Offloading

The consensus map endpoint runs heavy computation synchronously:

```javascript
app.get("/api/operator/consensus-map", guard, (req, res) => {
  return res.json(getConsensusState()); // Potentially CPU-intensive
});
```

If `getConsensusState()` performs significant calculations, it blocks the event loop.

### Recommended Async Optimizations

Convert blocking operations to non-blocking equivalents:

```javascript
app.get("/assets/dashboard.js", guard, async (req, res) => {
  try {
    const script = await fs.promises.readFile(scriptAssetPath, "utf8");
    res.setHeader("Cache-Control", "no-store");
    res.type("text/javascript").send(script);
  } catch {
    res.status(503).json({ ok: false, error: "Dashboard script unavailable" });
  }
});
```

For quarantine operations:

```javascript
app.get("/api/operator/quarantined-bridges", guard, async (req, res) => {
  if (!fs.existsSync(QUARANTINE_DIR)) return res.json([]);
  
  try {
    const files = await fs.promises.readdir(QUARANTINE_DIR);
    const jsonFiles = files.filter(f => f.endsWith(".json"));
    
    const list = await Promise.all(
      jsonFiles.map(async file => {
        try {
          const content = await fs.promises.readFile(
            path.join(QUARANTINE_DIR, file), 
            "utf8"
          );
          return JSON.parse(content);
        } catch {
          return null;
        }
      })
    );
    
    return res.json(list.filter(Boolean));
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});
```

## 3. CONCURRENCY SAFETY ISSUES

### Race Condition in Bridge Acceptance

The `/api/operator/quarantined-bridges/accept` endpoint exhibits classic TOCTOU (Time Of Check To Time Of Use) vulnerability:

```javascript
// Time of check
if (!fs.existsSync(bridgePath)) { ... }

// Time of use (potentially hours later)
const bridge = JSON.parse(fs.readFileSync(bridgePath, "utf8"));
```

Concurrent requests could both pass the existence check before either processes the file, leading to:
- Duplicate processing
- File-not-found errors on second request
- Data inconsistency in accepted_bridges.json

### Unsafe Read-Modify-Write Pattern

```javascript
let accepted = [...]; // Read current list
// ... potentially long computation/validation
accepted.push(bridge); // Modify
fs.writeFileSync(acceptedBridgesPath, ...); // Write
```

This pattern isn't atomic. Concurrent accepts could overwrite each other's changes.

### Recommended Concurrency Patterns

Implement file-level locking or use atomic file operations:

```javascript
const { lock } = await import('./file_locker.mjs'); // Custom implementation needed

app.post("/api/operator/quarantined-bridges/accept", guard, async (req, res) => {
  const { bridgeId } = req.body || {};
  // ... validation ...

  try {
    await lock(acceptedBridgesPath, async () => {
      const bridge = JSON.parse(
        await fs.promises.readFile(bridgePath, "utf8")
      );
      
      // Validate and process
      validateBridgePayload(bridge);
      bridge.approved_by_operator = true;
      
      // Atomic update with file locking
      let accepted = [];
      try {
        const data = await fs.promises.readFile(acceptedBridgesPath, "utf8");
        accepted = JSON.parse(data);
      } catch {}
      
      if (!accepted.some(b => b.id === bridge.id)) {
        accepted.push(bridge);
        await fs.promises.writeFile(
          acceptedBridgesPath, 
          JSON.stringify(accepted, null, 2), 
          "utf8"
        );
      }
      
      await fs.promises.rm(bridgePath, { force: true });
    });
    
    return res.json({ ok: true, message: "..." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});
```

### Parallel Processing for Independent Computations

Endpoints making independent calls should run them in parallel:

```javascript
// Before: Sequential
const hw = getHardwareState();
const { compression_ratio } = getPromptSources();

// After: Parallel if APIs support promises
const [hw, promptSources] = await Promise.all([
  getHardwareState(),
  getPromptSources()
]);
```

## SUMMARY OF CRITICAL OPERATIONAL RISKS

| Issue | Severity | Impact |
|-------|----------|--------|
| Single-entry MDS cache | High | Memory waste, cache thrashing under load |
| Sync file I/O in hot paths | Critical | Event loop blocking, reduced concurrent throughput |
| TOCTOU in bridge acceptance | High | Data corruption, race conditions |
| Non-atomic file updates | Medium | Lost updates during concurrent modifications |
| Missing iteration in cache key | Medium | Incorrect cache hits causing stale projections |

These issues compound during operator dashboard stress, where rapid successive queries for consensus maps, hardware status, and quarantine operations could severely degrade system responsiveness. Implementing the suggested async patterns and proper concurrency controls would significantly improve operational stability.
