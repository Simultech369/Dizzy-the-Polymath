**File:** `reviews/gemma_radiating_critique.md`  

```markdown
# Project Dizzy – Pass2 (Radiating Outward) Critique  
**Lens:** SKEPTIC – Defensive Engineering & Safety Audit  
**Focus:** Vulnerabilities, divisionbyzero risks, performance traps, and weak logical assumptions in `lib/friction_anomaly_detector.mjs` and `lib/scenario_simulator.mjs`.

---

## 1. Friction Anomaly Detector (`lib/friction_anomaly_detector.mjs`)

### 1.1. Median Absolute Deviation (MAD) Math  
| Issue | Evidence / Reasoning | Potential Impact |
|------|----------------------|------------------|
| **Empty / insufficient history** | Early exit is guarded for `history.length < 5`. If a consumer supplies *exactly* 5 entries, the code proceeds. The calculation of `scale` (used as denominator for the robust Zscore) can become **zero** when **more than 50%** of the history values are identical, because `mad` 0 and `stdDev` also evaluates to 0. The fallback sets `scale = stdDev || 0.1`, which **prevents divisionbyzero**, but the fallback is only triggered on *strict* `scale === 0`. A **tiny nonzero** `scale` (e.g., `1e15`) will still cause an enormous `robustZ` and an unfiltered anomaly flag. | Possible falsepositive anomaly alerts; downstream logic may react to an inflated Zscore without proper sanity checks. |
| **Nonnumeric weight values** | `getEntryWeight(entry)` multiplies `entry.severity` by a multiplier. If `severity` is not a finite number (e.g., `NaN`, `Infinity`, or a string), the resulting `weight` becomes `NaN`. This propagates through `weights` array, `median`, `mad`, and finally `scale`. The robust Zscore becomes `NaN / scale` `NaN`. The comparison `robustZ >= 3` evaluates to `false`, but *all numeric outputs* (`robust_z`, `median`, `mad`, etc.) are forced to strings via `toFixed`, yielding `"NaN"` in the report. | Silent propagation of `NaN` values can corrupt downstream analytics or UI displays; operators may misinterpret `"NaN"` as a legitimate anomaly score. |
| **Division by a nearzero `scale`** | The fallback logic only activates when `scale === 0`. When `scale` is *very small* (e.g., `1e12`) the division yields a huge `robustZ`. No upper bound or clipping is applied. | Extreme Zscores can trigger unnecessary alarms, potentially locking an operator out of the UI or causing resourceintensive retry loops. |
| **Hardcoded “minimum 5 entries” assumption** | The detector requires at least 5 historic entries to compute a statistical baseline. In environments where friction logs are sparse (e.g., early rollout), the system *silently* disables anomaly detection and returns `median: 0, mad: 0, robust_z: 0`. This may give a false sense of safety. | Operators might rely on a false baseline; the system should surface a warning when insufficient data exists rather than just returning zeros. |

### 1.2. Defensive Recommendations  
1. **Explicit scale sanitisation** – After computing `scale`, enforce a **minimum epsilon** (e.g., `Number.EPSILON`) before division:  
   ```js
   const safeScale = Math.max(scale, Number.EPSILON);
   const robustZ = (newWeight - median) / safeScale;
   ```  
2. **Input sanitisation** – Validate that `entry.severity` is a finite number; reject or coerce nonnumeric values early.  
3. **Robust Zscore clipping** – Cap the magnitude of `robustZ` (e.g., `Math.min(Math.max(robustZ, -10), 10)`) to avoid absurd values that could overflow downstream logic.  
4. **Clear dataquality flag** – When `history.length < MIN_REQUIRED`, return a dedicated flag (`data_insufficient: true`) instead of silently setting all numeric fields to `0`.  
5. **Unittest edgecases** – Include tests for: < 3 entries, all identical entries, `mad` = 0 with nonzero `stdDev`, and nonnumeric severity.

---

## 2. Scenario Simulator (`lib/scenario_simulator.mjs`)

### 2.1. PathTraversal & FileSystem Safety in `runIsolatedSimulation`

| Issue | Evidence / Reasoning | Potential Impact |
|------|----------------------|------------------|
| **Nondeterministic cleanup on write failure** | `fs.writeFileSync(checkpointFile, ...)` is executed **without** a `try/catch`. If the write fails (e.g., due to insufficient permissions, disk quota exhaustion, or a concurrent filehandle conflict), an exception is thrown **before** the `finally` block runs. Although the `finally` clause still attempts to delete `tempDir`, the exception propagates outward, potentially leaving the caller with an unhandled error and a **temporary directory that was never successfully written**. | Leak of temporary filesystem artifacts and possible denialofservice if the caller cannot recover from the thrown error. |
| **`fs.rmSync` swallow errors** | Cleanup is wrapped in a `try { … } catch { /* ignore */ }`. Silently ignoring errors can mask **permissiondenied** or **fileinuse** situations, leaving orphaned temporary directories on the host. | Accumulation of stale temp dirs may exhaust disk space over longrunning services. |
| **Potential race condition on tempdir name** | `fs.mkdtempSync` creates a directory with a random suffix, which is **secure** against prediction attacks, but the function is **synchronous** and blocks the event loop while generating the name. In a highconcurrency scenario (e.g., many simulation workers launched simultaneously), this can become a **bottleneck**. | Minor performance impact; may cause request queuing under heavy load. |
| **Missing validation of `initialState` shape** | The function assumes `initialState` contains the keys `reserves`, `participants`, `allocated_amount`, and `exited_count` (used later in `simulateStep`). If an attacker or misconfigures the UI to pass a malformed state (e.g., missing `reserves`), `simulateStep` will coerce `undefined` into arithmetic operations, yielding `NaN` values. These propagate through `runSimulation` `calculateDivergence` the checkpoint JSON. | Downstream consumers that parse the checkpoint may encounter `NaN` fields, breaking parsing logic or causing UI crashes. |

### 2.2. Parameter Validation Weaknesses  

| Issue | Evidence / Reasoning | Potential Impact |
|------|----------------------|------------------|
| **Incomplete state validation** | `validateParams` checks that supplied `params` is an object and validates the *parameter* fields (`decay_rate`, `basic_needs_allocation`, …). It **does not** verify that `initialState` contains the required numeric properties. Consequently, `simulateStep` may receive an `undefined` or nonnumeric value for `state.reserves`, leading to arithmetic on `NaN`. | Unexpected `NaN` propagation; may cause infinite loops or excessive memory usage if the simulation never terminates due to invalid termination conditions. |
| **Loose bounds on `basic_needs_allocation`** | Upper bound is `1000`. An attacker could supply a massive allocation (e.g., `5000`) if they bypass serverside validation and send it directly to the simulation engine (e.g., via an exposed API). The decay algorithm then subtracts `totalAllocation` from `reserves`, potentially driving `reserves` far negative, causing `Math.max(0, ...)` to clamp to `0` and then later compute `exitFraction` based on a *negative* reserve value (division by `exitThreshold` remains safe, but the logic may produce absurd exit counts). | Resource exhaustion: massive allocation can deplete `reserves` instantly, leading to a cascade of participant exits that could starve the simulation of participants, effectively halting progress and causing the event loop to stay busy processing large arrays. |
| **`steps` bound is checked only for range `[1,1000]`** | The validator throws a `RangeError` for values outside this range. However, the bound is **hardcoded**; a malicious client could craft a request with `steps = 1000` *and* extreme parameters that cause each iteration to perform heavy CPU work (e.g., `decay_rate = 1` leading to exponential decay calculations). While still linear, the *amplification factor* could make a single simulation run consume significant CPU, potentially leading to **CPUbound denialofservice** if many such requests are concurrently scheduled. | Potential for requesttimeouts or node eventloop backlog under attack. |
| **Missing guard against `Infinity`/`-Infinity`** | The validator permits `Infinity` for numeric fields? It only checks `isNaN(decay_rate)`. `Infinity` is not `NaN`, so it passes the `isNaN` test and then passes the `< 0 || > 1` range test (which also treats `Infinity` as not `< 1`, causing a `RangeError`). Actually the range test `decay_rate < 0 || decay_rate > 1` will catch `Infinity` because `Infinity > 1` is true throws. Same for other numeric parameters. However, **`Number.MAX_VALUE`** passes the range checks but can cause overflow in multiplication (`decayAmount = nextState.reserves * (parameters.decay_rate ?? 0.02)`). If `decay_rate` is close to `1` and `reserves` is huge, `decayAmount` may become `Infinity`, causing `nextState.reserves` to become `-Infinity`, which later `Math.max(0, -Infinity)` `0`. This path is safe but produces *unexpected* large `decayAmount` values that could trigger very large `exits` calculations (especially when multiplied by `participants`). | Largescale simulations may generate astronomically large intermediate numbers, leading to overflow, loss of precision, or extremely high `exits` counts that could cause integer underflow/overflow in downstream arithmetic (e.g., `participants - exits`). |

### 2.3. Performance & EventLoop Concerns  

| Issue | Evidence / Reasoning | Potential Impact |
|------|----------------------|------------------|
| **Synchronous filesystem operations** | `fs.mkdtempSync`, `fs.writeFileSync`, `fs.rmSync` are all **blocking**. In a server handling many concurrent simulation runs, the event loop can be stalled while the OS creates and deletes temporary directories. | Under load (e.g., burst of UI simulation requests), latency spikes may occur, degrading responsiveness of the UI or other API endpoints. |
| **Large history arrays in `runSimulation`** | Although not constrained beyond `steps 1000`, each iteration copies the whole `state` object (`{ ...state }`) and pushes a clone onto `history`. With `steps = 1000`, the resulting `history` array holds 1001 objects, each containing four numeric fields. This is modest, but if callers abuse the API (e.g., `steps = 1000` **and** feed massive initial states), memory consumption could increase linearly. | Memory pressure may lead to GC pauses, especially in a containerised deployment with limited RAM. |
| **Potential infinite loop via `while` or recursion** | No explicit loops beyond the `for` in `runSimulation`. However, if a caller supplies a **negative** `steps` value that bypasses the range check (e.g., due to a bug where `steps` is parsed as a string), the loop could become infinite. The validator currently checks `typeof steps !== "number" || isNaN(steps) || steps < 1 || steps > 1000`. A negative number fails `steps < 1`, causing a `RangeError`. Still, an attacker could tamper with the validator (e.g., disable it) and feed a negative value, leading to an infinite loop in the `for` (the condition `t <= steps` will never become false). | Eventloop hang, potential denialofservice. |

---

## 3. Summary of Critical Deficiencies

| Area | Core Finding |
|------|--------------|
| **MAD Telemetry** | No robust guard against nearzero `scale`; possible `NaN` propagation; insufficient handling of insufficient or homogeneous historical data. |
| **Simulator Isolation** | Synchronous FS calls can block the event loop; cleanup silently ignores errors; lack of strict `initialState` validation can introduce `NaN` into checkpoint output; unbounded parameter ranges may cause CPUintensive simulations. |
| **Parameter Validation** | Range checks reject obvious outofbounds values but allow extreme but stillvalid numbers that can cause overflow or extreme exitrate calculations; missing checks for `Infinity`/`-Infinity` edge cases. |
| **Error Handling** | `writeFileSync` may throw before cleanup; cleanup swallows errors; exceptions can escape the function without proper logging. |

---

## 4. Recommended Defensive Engineering Changes

1. **Sanitise and Bound All External Inputs**  
   - Validate `initialState` shape and numeric ranges (e.g., `reserves > 0`).  
   - Reject `Infinity` and `NaN` explicitly (`Number.isFinite`).  

2. **Safe Numerical Computations**  
   - Clamp `scale` to a minimum epsilon before division.  
   - Clip `robustZ` to a sensible range (`[-10, 10]`).  
   - Force all numeric fields to be finite before serialising checkpoint JSON (`Number.isFinite`).  

3. **Graceful Degradation & Clear Signals**  
   - When historical data is insufficient, return a structured flag (`data_insufficient: true`).  
   - Emit explicit warnings for `mad === 0` or `scale` extremely small.  

4. **Robust FileSystem Handling**  
   - Wrap `fs.writeFileSync` in `try/catch`; on failure, log the error and **still** attempt cleanup in `finally`.  
   - Use `fs.promises.rm` with `{ recursive: true, force: true }` for asyncfriendly cleanup.  
   - Consider using `fs.mkdtemp` (async) or a nonblocking tempdir library if high concurrency is expected.  

5. **EventLoop Friendly Design**  
   - Offload heavy simulations to a worker thread or an external worker process to avoid blocking the main event loop.  
   - Impose a **hard CPUtime limit** per simulation (e.g., `process.hrtime.bigint()` check) and abort with a clear error if exceeded.  

6. **Comprehensive Test Matrix**  
   - Include unit tests for edgecases: 3 entries, all identical entries, `mad` = 0, `scale` 0, nonnumeric severity, `steps = 1000` with extreme decay rates, and I/O failures.  
   - Run propertybased testing (e.g., with `fast-check`) to fuzz parameter ranges and verify no crashes or infinite loops.  

---

### Closing Note  
The current implementation provides a functional baseline but **lacks hardened defensive checks** that are essential for a productiongrade riskaware environment. By tightening input validation, sanitising numeric edgecases, and ensuring robust cleanup of temporary resources, the system will reduce the attack surface, avoid hidden runtime failures, and maintain predictable performance under load.  

*Prepared by Gemma – SKEPTIC Defensive Engineering Audits*  

--- 

*End of critique.*