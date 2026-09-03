### Reliability Audit: Offline and Degraded Operation Analysis

Based on the provided Dizzy repository context, here are concrete failure scenarios for each mandated probe area, with expected vs. actual behavior:

---

#### **1. Missing, Truncated, or Schema-Mismatched Receipt/Cache Files**

**Scenario: Truncated Markdown File in Memory Graph Build**  
- *Context*: During `buildGraph()` in `lib/memory_graph.mjs`, a user-edited `.md` file is truncated mid-frontmatter (e.g., `---` opening tag without closing `---`).  
- *Expected*: File should be skipped gracefully; graph build continues with valid files.  
- *Actual*: `parseFrontmatter(raw)` throws an uncaught exception (no try-catch around it in `buildGraph()`), crashing the entire graph build.  
  - *Evidence*:  
    ```javascript
    const { data: frontmatter, body } = parseFrontmatter(raw); // No error handling
    if (frontmatter && String(frontmatter.memory_status || "").trim().toLowerCase() === "revoked") {
      continue;
    }
    ```  
    If `parseFrontmatter` fails (e.g., invalid YAML), `frontmatter `String(frontmatter.memory_status)` throws `TypeError`.

**Scenario: Corrupted `accepted_bridges.json`**  
- *Context*: `runtime/accepted_bridges.json` contains invalid JSON (e.g., truncated mid-array).  
- *Expected*: Warning logged; bridges ignored; graph build continues.  
- *Actual*: Correctly handled—try-catch logs warning and skips bridges.  
  - *Evidence*:  
    ```javascript
    try {
      const accepted = JSON.parse(fs.readFileSync(acceptedBridgesPath, "utf8"));
      // ... process bridges
    } catch (e) {
      console.warn(`[memory_graph] failed to load accepted bridges: ${e.message}`);
    }
    ```

**Scenario: Missing Conversation File in Client Continuity Export**  
- *Context*: `exportClientContinuity()` called for a `conversation_key` where the `.jsonl` file was manually deleted.  
- *Expected*: Returns `conversation_rows: []` with `ok: true`.  
- *Actual*: Correctly returns empty array—`readConversationRows()` checks `fs.existsSync(convoPath)` and returns `[]` if missing.  
  - *Evidence*:  
    ```javascript
    function readConversationRows(conversationKey, conversationsDir = conversationDir()) {
      const convoPath = conversationPathForKey(conversationKey, conversationsDir);
      if (!convoPath || !fs.existsSync(convoPath)) return []; // Handles missing file
      return readJsonl(convoPath).filter((row) => !row.malformed);
    }
    ```

---

#### **2. Clock Skew and Expiry Edge Cases**

**Scenario: System Clock Set Backwards During Continuity Expiry Check**  
- *Context*: System clock rolled back 1 hour; `pruneExpiredClientContinuity()` evaluates expiration.  
- *Expected*: Records should expire based on *actual* time elapsed (ignoring clock skew).  
- *Actual*: Expiry miscalculated—records **not expired** when they should be.  
  - *Evidence*:  
    ```javascript
    // In pruneExpiredClientContinuity():
    if (nowMs - lastSeenMs > expiryMs) expired.push(conversationKey);
    ```  
    If `nowMs` is set backwards (e.g., `nowMs = actual_time - 3600000`), `nowMs - lastSeenMs` becomes artificially expiration check.

**Scenario: Clock Set Forwards Affecting Memory Graph Cache TTL**  
- *Context*: System clock jumped forward 24 hours; `getMemoryGraph()` checks cache validity.  
- *Expected*: Cache expired immediately; fresh graph built.  
- *Actual*: Cache **incorrectly considered valid**—stale data served.  
  - *Evidence*:  
    ```javascript
    // In getMemoryGraph():
    const ttlMs = Number.isFinite(rawTtlMs) && rawTtlMs >= 0 ? rawTtlMs : 10000;
    if (cached && now - cached.at < ttlMs) return cached.value;
    ```  
    If `now` is set forwards (e.g., `now = actual_time + 86400000`), `now - cached.at` becomes incorrectly deemed expired *too early*.  
    *(Note: Actual behavior depends on skew direction—backwards skew causes stale cache retention; forwards skew causes premature expiry.)*

**Scenario: Exactly at Expiry Boundary with Clock Skew**  
- *Context*: Record’s `last_seen_ms` = `nowMs - expiryMs - 1` (1ms expired); clock set backwards by 2ms.  
- *Expected*: Record expired (1ms past expiry).  
- *Actual*: Record **not expired**—skew makes `nowMs - lastSeenMs = expiryMs - 1msely valid.  
  - *Evidence*: Same expiry logic as above (`nowMs - lastSeenMs > expiryMs`).

---

#### **3. Concurrent Write / Partial Flush Scenarios**

**Scenario: Concurrent Appends to Same Conversation File**  
- *Context*: Two `agent/execute` requests for same `conversation_key` race to append to `runtime/conversations/<key>.jsonl`.  
- *Expected*: Lock serializes writes; no data corruption.  
- *Actual*: **Lock file left behind on crash** causes permanent write denial until timeout.  
  - *Evidence*:  
    ```javascript
    // In createLock():
    const lockPath = `${filePath}.lock`;
    const end = Date.now() + timeout;
    return new Promise((resolve, reject) => {
      function tryLock() {
        fs.open(lockPath, "wx", (err, fd) => { // Fails if lock exists
          if (!err) { ... resolve(true); ... }
          if (Date.now() < end) { setTimeout(tryLock, 50); }
          else { reject(new Error(`Could not acquire lock...`)); }
        });
      }
      tryLock();
    });
    ```  
    If Process A crashes *after* acquiring lock but *before* releasing it, lock file remains. Process B waits 5s (default timeout) then fails with `Could not acquire lock`.

**Scenario: Partial Flush During Atomic Write**  
- *Context*: `writeJsonl()` crashes mid-write to `.tmp` file (e.g., OOM killer during `fs.writeFileSync`).  
- *Expected*: Original file intact; `.tmp` cleaned up on retry.  
- *Actual*: **Orphaned `.tmp` file**; next write overwrites it (safe), but wasted disk space.  
  - *Evidence*:  
    ```javascript
    // In writeJsonl():
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, body, "utf8"); // Crash here leaves tmpPath
    try {
      fs.renameSync(tmpPath, filePath); // If crash here, tmpPath remains
    } catch (err) {
      if (err.code === "EPERM" || ...) {
        fs.copyFileSync(tmpPath, filePath); // Uses orphaned tmp
        try { fs.unlinkSync(tmpPath); } catch {}
      } else { throw err; }
    }
    ```  
    Crash during initial orphaned `.tmp`; retry uses it via copy fallback (no data loss, but tmp accumulates).

---

#### **4. Recovery After Process Crash Mid-Write**

**Scenario: Crash During Conversation File Append**  
- *Context*: `appendJsonl()` crashes after writing partial JSON line (e.g., `{"t":"2024-` incomplete).  
- *Expected*: On restart, `readJsonl()` skips malformed line; valid data intact.  
- *Actual*: Correctly handled—malformed line ignored.  
  - *Evidence*:  
    ```javascript
    // In readJsonl():
    .map((line) => {
      try { return JSON.parse(line); }
      catch { return { malformed: true, raw: line }; } // Malformed lines filtered later
    })
    ```  
    Later checks (e.g., `!row.malformed`) exclude incomplete lines.

**Scenario: Crash After Deleting Conversation File But Before Deletion Log**  
- *Context*: `deleteClientContinuity()` removes `conversationPath` but crashes before appending to `deletionLogPath`.  
- *Expected*: Deletion logged; state consistent.  
- *Actual*: **File deleted but no log entry**—appears as "orphaned" in `buildContinuityReport()`.  
  - *Evidence*:  
    ```javascript
    // In deleteClientContinuity():
    if (hadConversationFile) fs.rmSync(convoPath, { force: true }); // File deleted
    const removedHistoryRows = removeClientContinuityRows(...);
    const row = { ... }; // Deletion log entry
    if (deleted || ...) await appendJsonl(deletionPath, row); // Crash log missing
    ```  
    Post-recovery: `listClientConversationFiles()` shows file missing, but `buildContinuityReport()` has no `deletion_rows` for keyownership_source: "unresolved"`.

**Scenario: Crash Mid-Durability Write in Agent Server**  
- *Context*: `durableAppendJsonl()` (used in `runAgentExecute()`) crashes after writing user message but before assistant message to conversation file.  
- *Expected*: On retry, transcript completed with both messages.  
- *Actual*: **User message duplicated**; assistant message missing for original request.  
  - *Evidence*:  
    ```javascript
    // In persistMissingExecuteTranscript():
    const rowsWritten = countJsonlRows(conversationPath) - beforeRows;
    if (rowsWritten <= 0) { /* write user message */ }
    if (rowsWritten < 2) { /* write assistant message */ }
    ```  
    - Crash after user message: File has 1 line (user msg).  
    - On retry: `beforeRows = 1`, `rowsWritten = 1` (new user msgips user msg write (not `<=0`), but `rowsWritten=1 < 2 msg.  
    - Result: `[original user, retry user, assistant]` user msg; original request lacks assistant.

---

#### **5. Trust-Zone Leakage During Offline Mode**

**Scenario: Loopback Access to Memory Graph Without Auth in Offline Mode**  
- *Context*: Server running offline (`DIZZY_BIND_HOST=127.0.0.1`), no `DIZZY_AUTH_TOKEN`, user accesses `/memory/graph?q=test`.  
- *Expected*: Access denied if not loopback/auth; but **loopback should allow only non-sensitive data** (per trust-zone policy).  
- *Actual*: **All trust-zone data leaked**—bypasses zone restrictions.  
  - *Evidence*:  
    ```javascript
    // In memoryGraphAccessGuard (agent_server.mjs):
    if (!isLoopbackRemoteAddress(req.socket?.remoteAddress) && !authToken) {
      return res.status(403).json({ ok: false, error: "Memory graph requires local access or authentication" });
    }
    ```  
    Loopback bypasses auth check.  
    ```javascript
    // In getRelevantMemoryGraphContext():
    const trustZone = String(opts.trustZone || "").trim(); // opts.trustZone undefined string
    const allowedDocs = graph.docs.filter((doc) => zoneAllows(doc.zone_allowed, trustZone));
    ```  
    ```javascript
    // In zoneAllows():
    if (!trustZone) return true; // Empty trust true
    ``` `zoneAllows` returns `true` for **any** `doc.zone_ docs included.

**Scenario: Offline Client Continuity Report Ignores Trust Zone**  
- *Context*: `buildContinuityReport()` called with empty `opts.trustZone` (offline, no zone specified).  
- *Expected*: Default to restrictive zone (e.g., `private_self`).  
- *Actual*: **All zones included**—no filtering.  
  - *Evidence*:  
    ```javascript
    // In buildContinuityReport():
    const trustZone = String(opts.trustZone || "").trim();
    const allowedDocs = graph.docs.filter((doc) => zoneAllows(doc.zone_allowed, trustZone));
    ```  
    Same `zoneAllows` logic `return true` filtering.

**Scenario: Trust-Zone Header Ignored in Offline Execution**  
- *Context*: Offline request to `/agent/execute` with `X-Dizzy-Zone: private`.  
- *Expected*: Execution restricted to `private` zone capabilities.  
- *Actual*: **Trust zone forced to `paid_public`**—ignores header, risks over-privileged execution.  
  - *Evidence*:  
    ```javascript
    // In runAgentExecute():
    const runtimeContext = {
      trust_zone: "paid_public", // Hardcoded!
      continuity_mode: continuityAllowed ? "client" : "ephemeral",
      conversation_key: conversationKey,
    };
    ```  
    Overrides any zone from request headers uses `paid_public`.

---

### Key Reliability Gaps Identified
1. **Memory graph build lacks resilience** to malformed frontmatter (uncaught exception).  
2. **Lock starvation possible** after crashes (no lock file cleanup on timeout expiry).  
3. **Trust-zone bypass** in offline loopback access due to empty-string trust zone defaulting to "allow all".  
4. **Expiry logic vulnerable to clock skew** (uses `Date.now()` without monotonic time or NTP sync).  
5. **Atomic write recovery gaps** (e.g., missing deletion log after file removal).  

These issues could lead to data leakage, denial of service, or inconsistent state in degraded/offline scenarios—particularly critical for a system handling sensitive operator continuity data. Mitigations would include:  
- Adding try-catch around `parseFrontmatter()`  
- Using lock file TTL with stale-lock detection (e.g., check mtime)  
- Defaulting trust zone to most restrictive value (e.g., `private_self`) when empty  
- Using `process.hrtime.bigint()` for expiry checks  
- Validating deletion log append success before considering operation complete.