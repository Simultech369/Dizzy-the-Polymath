# Qwen Active Policy Review  
**Report Location:** `reviews/qwen_active_policy_review.md`  
**Model / Lens:** Automated contract and performance review focused on **active-policy**, **route registry**, and **testharness** integrity.  

---  

## Provenance  

| Aspect | Detail |
|--------|--------|
| **Model / Lens** | Independent performance, concurrency, routecontract, and implementationsequencing reviewer. Produces **claims only** – no code changes. |
| **Files Reviewed** | • `lib/active_policy_engine.mjs` <br>• `lib/friction_anomaly_detector.mjs` <br>• `lib/friction_ledger.mjs` <br>• `lib/durable_write_policy.mjs` <br>• `scripts/test_active_integration.mjs` <br>• `scripts/safety_checks.mjs` <br>• `scripts/maintain.mjs` <br>• `scripts/check_active_policy_state.mjs` <br>• `scripts/connection_scan.mjs` |
| **Assumptions** | • All modules run in a single Node process unless the test suite explicitly creates separate `ActivePolicyEngine` instances. <br>• Filesystem paths are relative to `process.cwd()` (`runtime/…`). <br>• The repository follows the described “loopback logincookie” pattern for authenticated routes (implemented elsewhere, e.g. `agent_server.mjs`). <br>• The test harness (`safety_checks.mjs`) and integration suite are the primary validation surface. |
| **Context** | The repository builds a Dizzy continuity/judgment runtime that computes frictionbased containment, enforces durablewrite policy, and supports operator routes. The “activepolicy” contract governs containment activation, durablewrite suspension, and bridge veto. <br><br> Known **activepolicy bug**: friction is appended to the ledger **before** the `ActivePolicyEngine.evaluate` call, so the new entry is included in its own historical baseline falsenegative containment when the new entry should be the trigger. This is a verified defect that directly impacts the correctness of the dashboardmutation prerequisite. |

---  

## Contract Findings  

| # | Classification | File / Function | Concrete Failure Scenario | Evidence Needed | Smallest Reversible Remediation | Confidence |
|---|----------------|----------------|---------------------------|-----------------|--------------------------------|-----------|
| **1** | **Verified defect** | `lib/friction_ledger.mjs` – `appendFrictionSync`, `appendFriction` <br> `lib/active_policy_engine.mjs` – `evaluate` / `readLedgerHistory` | Five normal friction entries (severity, “once”) baseline. A sixth entry (severity, “chronic”) should exceed the `z_score_threshold.0` and trigger containment. <br>Because the sixth entry is written to the ledger **before** `ActivePolicyEngine.evaluate` reads the file, the baseline incorporates the new weight robust_z.68 **no containment triggered**. | A unit test that: <br>1. Seeds five normal entries via `appendFrictionSync` (with a temporary ledger file). <br>2. Calls `appendFrictionSync` with the anomalous entry, mocks or isolates the `ActivePolicyEngine` instance used by the ledger. <br>3. Verifies that `state.containment_active === true` **and** that the `trigger_reason` mentions the robust_z. | Change the ledger append order in `appendFrictionSync`/`appendFriction`: <br>1. **Read current history** (`readFrictionEntriesSync`/`readFrictionEntries`). <br>2. **Invoke `policyEngine.evaluate(newEntry, history)`** using that history (which excludes the new entry). <br>3. **Append the new entry** to the file. <br>Optionally, a separate `historyOverride` can be passed to `evaluate` so the engine can base calculations solely on prior history. | **High** – defect reproduced in the live code. |
| **2** | **Plausible risk** | `lib/active_policy_engine.mjs` – `loadConfig`, `loadState`, `saveState`, `readLedgerHistory`, `vetoQuarantinedBridges` | All filesystem operations are synchronous (`fs.readFileSync`, `fs.writeFileSync`). In a highfrequency polling scenario (e.g., rapid friction appends, bridge scans, or continuous policy reevaluation), these calls can block the Node event loop, degrading responsiveness of concurrent routes. | A benchmark that shows >5 pause per policy evaluation when called from the event loop. | Replace each sync call with the async equivalents (`fs.promises.*`) and ensure the callers are `async`/`await` compatible, or spin off heavy I/O to a worker thread/Queue. | **Medium** – risk is architecturewide; impact depends on call volume. |
| **3** | **Policy disagreement** | `lib/dispatch.mjs` – `routeIncomingMessage` (implied) <br> `scripts/safety_checks.mjs` – `testCommandAvailabilityWithoutChatBackend`, `testFallbackIncludesCurrentUserTurn` | Test suites mock `fetch` directly, bypassing the **real loopback logincookie flow** that protects authenticated operator routes. This means the routecontract for session establishment, cookie validation, and CSRF protection are not exercised, potentially leaving authentication/authorization gaps. | An integration test that spawns the actual agent server and performs a login via the Loopback `/agent/session` endpoint before calling protected APIs (`/agent/execute`, `/admin/...`). The test currently uses a `Bearer` token from environment variables, not a session cookie. | Add a test fixture that: <br>1. Starts the server (or uses the existing test harness). <br>2. Performs a real `/agent/session POST` with the strong auth token. <br>3. Records the resulting cookie/session token. <br>4. Uses that session token for subsequent API calls. <br>Remove the direct `Bearer` token mocks for protected routes. | **Moderate** – risk is that authentication path is untested. |
| **4** | **Plausible risk** | `scripts/connection_scan.mjs` – `stageBridges` and `lib/bridging_scan.mjs` (implied) | Bridge staging writes JSON files directly into the `runtime/quarantine` directory using simple `fs.writeFileSync`. If multiple processes (e.g., a concurrent `maintain` script and a simulation) stage bridges simultaneously, file corruption or interleaving of writes can occur. | Run `npm run connection:scan` in two parallel processes (e.g., `&`) and observe malformed JSON in the quarantine folder. | Use atomic write: write to a temporary filename (`bridge_X.json.tmp`) then `fs.renameSync`. Add a readlock (`fs.promises.lockFile` on the target) for safe staging. | **Low** – still no evidence of concurrent writes in production. |
| **5** | **Future concern** | `scripts/maintain.mjs` – `memoryOwnershipStatus` & `rootFileRoleStatus` | The review checks rely on static `FILE_ROLES.md` and `MEMORY_OWNERSHIP.md` files. If these are missing or outofdate, the maintenance suite reports “yellow” but does not enforce consistency, leaving potential drift between documented ownership and actual code. | Missing or outdated `FILE_ROLES.md` leads to “unclassified” root files that are never reviewed. | Introduce a lint step that blocks if `FILE_ROLES.md`/`MEMORY_OWNERSHIP.md` are out of sync with the filesystem (e.g., `grep -q ^${file}`). | **Low** – a hygiene improvement, not a functional blocker. |
| **6** | **Plausible risk** | `lib/durable_write_policy.mjs` – `logAutomationReceipt` / `durableAppendJsonl` | `durableAppendJsonl` opens the target file with `fs.openSync`, writes synchronously (`fs.writeSync`), then calls `fs.fsyncSync`. In a highvolume system (e.g., many automation receipts per second) this will backpress the event loop. | Stresstest `logAutomationReceipt` with >1 calls per second and measure eventloop latency. | Switch to `fs.promises.appendFile` (or buffer writes and flush in a worker). Ensure redaction is done before write. | **Low** – receipts are moderatevolume in practice. |

*Only **Finding** is a **verified defect** that directly blocks dashboard mutation. Findings6 are **risks** that should be mitigated before a productiongrade HUD promotion. *  

---  

## Performance and Concurrency Risks  

| Area | Specific Risk | Potential Impact | Mitigation Priority |
|------|---------------|------------------|--------------------|
| **ActivePolicy Engine I/O** | Synchronous `fs.readFileSync` / `fs.writeFileSync` in policy evaluation, config/state loading, and bridgeveto scans. | Eventloop stalls under load; possible UI jitter. | **Medium** – make async. |
| **Bridge Staging Atomicity** | Nonatomic writes to `runtime/quarantine`. | Data corruption when multiple processes stage simultaneously. | **Low** – add renameonclose. |
| **DurableWrite Receipt Logging** | Sync `fs.openSync`/`writeSync` for receipts. | Backpressure when many automation receipts are emitted. | **Low** – async write. |
| **Route Authentication Coverage** | Test harness bypasses cookiebased login flow. | Potential weakness in the Loopback authentication contract. | **Medium** – add realcookie test. |
| **State Containment Freshness** | Multiple engine instances share a single state file; concurrent writes (resolve containment + veto) could race. | Inconsistent `containment_active` flag across processes. | **Medium** – add file locking or atomic state updates. |

---  

## Acceptance Criteria for Antigravity  

1. **ActivePolicy Event Ordering Fixed**  
   - `appendFriction` / `appendFrictionSync` evaluates the new entry **without** including it in the historical baseline.  
   - Five normal entries + one anomalous entry correctly triggers containment (`state.containment_active === true`, nonnull `trigger_reason`).  

2. **State Freshness and Containment Persistence**  
   - Separate `ActivePolicyEngine` instances (with default paths) read identical `containment_active` and correctly execute `resolveContainment` (clears the flag).  
   - This must be proven by the existing `scripts/check_active_policy_state.mjs` test (no changes required).  

3. **Route Registry Alignment**  
   - A single sourceoftruth route registry is used for: <br>• Dashboard authorization (`/dashboard`). <br>• Fallback route registration (`/agent/execute`, `/agent/continuity/*`, etc.). <br>• All test harness imports. <br>   - Verify that removing the registry duplicates the earlier failures.  

4. **Test Harness Uses Real Loopback Login**  
   - **New integration test** that: <br> a. Starts the agent server (or uses the existing test harness). <br> b. Performs a **POST /agent/session** with the strong auth token (or cookie setter). <br> c. Captures the resulting cookie / session token. <br> d. Reissues subsequent protected requests (`/agent/execute`, `/admin/...`) using that session instead of raw Bearer tokens. <br>   - Existing mocks may be kept for unit testing but must **not** be the sole validation for the full contract.  

5. **Concurrency Safeguards**  
   - All file writes that modify shared state (`runtime/active_policy_state.json`, `runtime/quarantine/*.json`, `runtime/automation_receipts.jsonl`) must be atomic (write to temp + rename). <br>   - `ActivePolicyEngine.saveState` and `vetoQuarantinedBridges` should use `fs.promises.writeFile` (or atomic rename). <br>   - Provide a simple **filelock API** for crossprocess coordination on state files.  

6. **Response Headers & Security**  
   - Every protected API must return CSP (`default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`), `XFrameOptions: DENY`, `XContentTypeOptions: nosniff`. <br>   - The dashboard (`/dashboard`) must be restricted to the local loopback (`XForwardedFor` and host header validation).  

7. **Test Matrix Passes**  
   - **Safety Checks** – `scripts/safety_checks.mjs` must exit with status. <br>   - **Active Integration** – `scripts/test_active_integration.mjs` must exit with status. <br>   - **State Freshness** – `scripts/check_active_policy_state.mjs` must exit with status. <br>   - **New LoginFlow Test** – (added above) must exit with status. <br>   - **Maintain** – `scripts/maintain.mjs` must exit with status (no new failures introduced).  

8. **No New Hard Failures**  
   - After applying remediation to Finding, all previously failing checks must pass. <br>   - No new “red” severity failures appear in the `maintain` output.  

---  

## Minimal Test Matrix  

| Test Suite | Command (as run by `npm run <name>`) | Pass Condition |
|------------|---------------------------------------|----------------|
| **Safety Checks** | `node scripts/safety_checks.mjs` | Exit status `0`. |
| **Fuzzing & Injection** | `node scripts/fuzzing_and_injection_tests.mjs` | Exit status `0`. |
| **Active Integration** | `node scripts/test_active_integration.mjs` | Exit status `0`. |
| **State Freshness** | `node scripts/check_active_policy_state.mjs` | Exit status `0`. |
| **New LoginFlow** | *Custom integration test* (see Acceptance) | Exit status `0`. |
| **Maintain** | `node scripts/maintain.mjs` | Exit status `0` (yellow warnings allowed; red failures not). |
| **Memory Validation** | `node scripts/memory_validate.mjs` | Exit status `0` (any failures are yellow). |
| **Drift Scan** | `node scripts/drift_scan.mjs` | Exit status `0`. |
| **Connection Scan** | `node scripts/connection_scan.mjs` | Exit status `0`. |

*Only **Safety Checks**, **Active Integration**, and **State Freshness** are mandatory for dashboard mutation. The other suites must not regress into red failures.*  

---  

## Deferred Work  

| Item | Description | Rationale / Impact |
|------|-------------|--------------------|
| **Async I/O Refactoring** | Replace all `fs.readFileSync`/`fs.writeFileSync` in `active_policy_engine`, `durable_write_policy`, and bridge staging with promises. | Reduces eventloop blocking; noncritical for MVP. |
| **FileLock Coordination** | Introduce a lightweight lock for shared state files (`active_policy_state.json`, quarantine, receipts). | Prevents race conditions if multiple processes simultaneously resolve containment. |
| **Centralized Route Registry** | Extract route definitions to a single `routes.yaml`/`routes.json` that both the Express server and the test harness import. | Prevents drift; safe to add after current functional contracts are verified. |
| **Cache Invalidation for Memory Graph** | Add an explicit invalidation mechanism (`invalidateGraphCache`) when source markdown changes. | Improves freshness; not required for dashboard mutation. |
| **MachineReadable Ownership Audits** | Turn `FILE_ROLES.md` and `MEMORY_OWNERSHIP.md` into parseable JSON that `maintain` validates with hard errors. | Improves hygiene; can be added postpromotion. |
| **Dashboard Accessibility Hardening** | Full WCAG 2.1 AA audit, reducedmotion media queries, improved focus ordering. | Must be completed before public HUD rollout but is orthogonal to contract correctness. |

---  

## Final Verdict  

- **Current State:** The repository contains at least one **verified defect** (activepolicy event ordering) that prevents correct containment detection. Several **plausible risks** exist around synchronous I/O, authentication testing coverage, and atomic writes. <br><br>- **Immediate Action Required:** Fix the event ordering bug in `lib/friction_ledger.mjs` and `lib/active_policy_engine.mjs` to evaluate the new friction entry against prior history only. <br><br>- **Additional Mitigations (High Priority):** <br>1. Make critical filesystem operations async (policy engine, receipt logging). <br>2. Ensure bridge staging is atomic. <br>3. Add a realcookie integration test for the loopback login flow. <br>4. Introduce a simple filelock or renameonclose pattern for state files. <br><br>- **Readiness for Dashboard Mutation / HUD Promotion:** Once the ordering bug is corrected and the above mitigations are applied, the **Safety Checks**, **Active Integration**, and **State Freshness** suites should pass. The new loginflow integration test must be added and pass. If those conditions are met, the remaining **yellow** warnings (documentation drift, cache hygiene) do **not** block a safe dashboard promotion. **Aggressive** improvements (async I/O, file locking) can be deferred to a postpromotion maintenance sprint.  

---  

**Next Steps for Antigravity:** <br>  

1. Implement remediation of Finding (append order). <br>2. Apply the concurrency safeguards listed under Acceptance (atomic writes, async I/O). <br>3. Add the new integration test for loopback logincookie authentication and include it in the test matrix. <br>4. Run `npm run maintain` and ensure **no red failures**. <br>5. Once all red checks pass, proceed with any desired **deferred work** in a followup sprint.  

---  

*Prepared by: Qwen – Independent Reviewer*  
*Generated: 20250704*