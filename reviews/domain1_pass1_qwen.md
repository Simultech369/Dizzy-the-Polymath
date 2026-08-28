## Findings

### 1. Prefix Hash Collision Risk - `computePromptPrefixHash` (lib/model_router.mjs:105-110)

**Location**: `lib/model_router.mjs:105-110`

**Severity**: Medium

**Issue**: The function truncates SHA-256 to 16 hex characters (64 bits). With the birthday bound, collisions become likely at ~2^32 inputs. While 64 bits is acceptable for cache keys, the function also truncates the input to 512 chars before hashing, meaning different prompts with identical first 512 chars produce identical hashes.

**Counter-example**:
```javascript
const promptA = "x".repeat(512) + "different suffix A";
const promptB = "x".repeat(512) + "different suffix B";
computePromptPrefixHash(promptA) === computePromptPrefixHash(promptB); // true - collision by design
```

**Suggested fix**: Either document this as a prefix hash (rename to `computePromptPrefixHash16`), or include full prompt in hash. If prefix-only is intentional for cache invalidation, add a length suffix: `hash + ":" + Math.min(prompt.length, 512)`.

---

### 2. FNV-1a Hash Overflow Handling - `hashString` (lib/dispatch.mjs:219-227)

**Location**: `lib/dispatch.mjs:219-227`

**Severity**: Low

**Issue**: The FNV-1a implementation uses `Math.imul` for 32-bit multiplication but JavaScript numbers are IEEE-754 doubles. The `>>> 0` coercion to uint32 is correct, but `Math.imul(h, 16777619)` can produce values up to ~2^59 before the final `>>> 0`, losing precision for strings > ~4M chars (beyond 53-bit mantissa).

**Counter-example**: A 10MB string will have different hash in JS vs true 32-bit FNV-1a due to double precision loss during accumulation.

**Suggested fix**: Apply `h >>>= 0` inside the loop after each `Math.imul` to maintain true 32-bit arithmetic:
```javascript
h ^= s.charCodeAt(i);
h = Math.imul(h, 16777619);
h >>>= 0; // enforce 32-bit wrap each iteration
```

---

### 3. Auto-Remember Score Saturation - `autoRememberSignalScore` (lib/dispatch.mjs:351-365)

**Location**: `lib/dispatch.mjs:351-365`

**Severity**: Low

**Issue**: The scoring function adds points for multiple regex matches but has no ceiling. A single message matching all patterns could score 8 (1+1+2+1+1+2+1), exceeding the default `DIZZY_AUTO_REMEMBER_MIN_SCORE=4`. This isn't a bug but creates a "always trigger" condition for matched content.

**Counter-example**: Message containing "decide constraint important remember next step plan changed shift should must policy rule why it matters trade-off cost value quality quantity leverage durable automatic we should i want i don't want prefer avoid default always never housing instability precarity rent debt burnout coercion injustice conditions structure systemic autonomy consent community mutual aid solidarity body heart spirit wisdom signal truth meaning responsibility human spirit freedom" scores 8, guaranteeing auto-remember.

**Suggested fix**: Cap score at `minScore + 2` or use `Math.min(score, maxScore)` where `maxScore` is configurable.

---

### 4. Fallback Rate Limit Window Off-by-One - `countRecentFallbackUses` (lib/dispatch.mjs:470-488)

**Location**: `lib/dispatch.mjs:470-488`

**Severity**: Medium

**Issue**: The window check `now - t <= windowMs` includes the boundary. If a fallback occurred exactly `windowMs` ago, it's counted. Combined with `used >= globalMaxPerHour`, this allows `limit+1` calls in a rolling hour if calls land on boundaries.

**Counter-example**: 
- `DIZZY_FALLBACK_MAX_CALLS_PER_HOUR=1`
- Call at T=0, call at T=3600000 (exactly 1 hour later)
- `now - t = 3600000 <= 3600000` both counted `used=2 >= 1` blocked incorrectly

**Suggested fix**: Use strict inequality: `now - t < windowMs`

---

### 5. Conversation Serialization Race - `runConversationSerialized` (lib/dispatch.mjs:658-670)

**Location**: `lib/dispatch.mjs:658-670`

**Severity**: High

**Issue**: The queue uses `previous.catch(() => {})` which swallows rejection of the *previous* task. If task N-1 rejects, task N runs immediately (correct), but the rejection is silently dropped. More critically, the `finally` cleanup checks `conversationWorkQueues.get(key) === tracked` - but if a new task is enqueued during the `finally` of the old task, the new task's `tracked` promise replaces the map entry, causing the old task's `finally` to delete the new task's queue entry.

**Counter-example**:
```javascript
// Task A starts, queue = Promise A
// Task B enqueued during A, queue = Promise B (chained off A.catch)
// A finishes, A.finally runs: queue.get(key) === tracked(A)? No, it's tracked(B). 
// A.finally does NOT delete. Correct.
// B finishes, B.finally runs: queue.get(key) === tracked(B)? Yes. Deletes. Correct.

// BUT: if A throws synchronously before returning its promise:
runConversationSerialized("k", () => { throw new Error("sync"); return Promise.resolve(); });
// A's `run` = Promise.reject().catch(() => {}).then(task) = Promise.resolve().then(task)
// The `previous` was Promise.resolve() (initial), so `run` = taskPromise
// `tracked` = taskPromise.finally(...)
// queue.set(key, tracked)
// If task throws sync, `run` rejects, `tracked` resolves (due to catch), finally runs
// If another task enqueues DURING the synchronous throw (same tick), it sees the new queue entry
```

**Suggested fix**: Use a proper mutex pattern with a dedicated queue array per conversation key, or use a `Mutex` class. At minimum, don't use `catch(() => {})` on the chain - let errors propagate and handle cleanup in a `try/finally` around the actual task execution.

---

### 6. IP Address Parsing Edge Cases - `isLoopbackHost` / `isPrivateLanHost` (lib/model_router.mjs:62-98)

**Location**: `lib/model_router.mjs:62-98`

**Severity**: Medium

**Issue**: 
1. `net.isIP("::ffff:127.0.0.1")` returns 6 (IPv6), but the IPv6 loopback check only matches `::1`. IPv4-mapped IPv6 loopback addresses are not recognized.
2. The IPv4 private range regex `/^172\.(1[6-9]|2[0-9]|3[0-1])\./` matches `172.16.0.0` through `172.31.255.255` correctly, but `169.254.0.0/16` (link-local) is included as "private LAN" which may be intentional but is worth noting.
3. IPv6 ULA (`fc00::/7`) regex `/^f[cd][0-9a-f]{2}:/i` matches `fc00:` through `fdff:` but also `fc00::/8` which is reserved (not assigned). RFC 4193 says `fd00::/8` is for ULA. The regex is permissive but not incorrect.
4. IPv6 link-local `fe80::/10` regex `/^fe[89ab][0-9a-f]:/i` matches `fe80:` through `febf:` correctly.

**Counter-example**: 
```javascript
isLoopbackHost("::ffff:127.0.0.1") // false (should be true for IPv4-mapped loopback)
isLoopbackHost("[::ffff:127.0.0.1]") // false
```

**Suggested fix**: In `isLoopbackHost`, after stripping brackets, check for IPv4-mapped IPv6:
```javascript
if (ipVer === 6) {
  if (h === "::1") return true;
  if (h.startsWith("::ffff:") && isLoopbackHost(h.slice(7))) return true; // IPv4-mapped
}
```

---

### 7. Truncation Boundary in `clampHistoryForFallback` (lib/dispatch.mjs:580-588)

**Location**: `lib/dispatch.mjs:580-588`

**Severity**: Low

**Issue**: `maxTurns * 2` with `maxTurns = 6` (default) gives 12 messages. The slice `history.slice(-maxTurns * 2)` takes the last 12 messages. But the fallback prompt also uses `truncateText(m.text, maxMsgChars)` where `maxMsgChars=1200`. If a single message is 1200 chars, 12 messages = 14,400 chars, which may exceed the fallback model's context window. No total budget enforcement.

**Counter-example**: 12 messages × 1200 chars = 14.4k chars sent to fallback model with default 500 max tokens output.

**Suggested fix**: Add a total character budget: `history.slice(-maxTurns * 2).reduce((sum, m) => sum + m.text.length, 0)` and trim oldest if over budget.

---

### 8. JSON Parse Silent Failure in Multiple Locations

**Location**: Multiple - `safeJsonParse` (lib/dispatch.mjs:490-496) used throughout

**Severity**: Medium

**Issue**: `safeJsonParse` returns `null` on failure. Callers like `/trajectory distill` (line 770) check `if (!json || typeof json !== "object")` but `json` could be `null`, `true`, `42`, `"string"`, `[]`. The check passes for arrays but the code expects an object with specific fields. This isn't a crash but produces confusing "non-JSON output" errors when valid JSON arrays are returned.

**Counter-example**: Model returns `["item1", "item2"]` (valid JSON array). `safeJsonParse` returns array. `typeof json === "object"` is true. Code proceeds but `json.skip` is undefined, `json.goal` undefined treated as malformed proposal.

**Suggested fix**: Validate expected structure explicitly:
```javascript
const isValidTrajectoryProposal = (j) => j && typeof j === "object" && !Array.isArray(j) && (j.skip || (j.goal && j.reusable_pattern));
```

---

### 9. Floating Point in `resolveCostBand` / `resolveModelOriginRisk` Heuristics

**Location**: `lib/dispatch.mjs:518-552`

**Severity**: Informational

**Issue**: These are string-matching heuristics, not numerical computations. No floating-point issues. However, the `resolveCostBand` regex `/\b\d+b\b/` matches "7b" in "model-7b" but also "123b" in "abc123bdef" (word boundary on `b` matches transition from digit to non-digit). This is a regex precision issue, not FP.

**Counter-example**: Model "my-7b-model" matches `\b\d+b\b` "low" cost band. Model "model123b" matches "low". Model "123b" matches "low".

**Suggested fix**: Use `/\b\d+b\b/` is actually correct for word boundaries. But consider `/\b\d+[bm]\b/i` to catch "7B" and "7b". Current regex misses uppercase.

---

### 10. Auto-Remember State Machine - Duplicate Signature Race (lib/dispatch.mjs:390-430)

**Location**: `lib/dispatch.mjs:390-430`

**Severity**: Medium

**Issue**: The `shouldAutoRemember` function reads state and candidate files, then returns an action. But between reading and writing, another process could modify the files. The `runConversationSerialized` serializes per-conversation, but auto-remember can also be triggered from different entry points (e.g., manual `/remember` also calls `writeRememberedMemory` which writes to the same conversation memory file).

**Counter-example**: Two concurrent `/remember` calls for same convoKey. Both read state, both see no candidate, both stage candidates. Last write wins.

**Suggested fix**: Use file-based locking (e.g., `fs.openSync(path, 'wx')` for exclusive create) or move auto-remember state into the conversation JSONL with atomic appends.

---

### 11. `normalizeConversationKey` Empty String Handling (lib/dispatch.mjs:672-680)

**Location**: `lib/dispatch.mjs:672-680`

**Severity**: Low

**Issue**: `normalizeIdentifier` returns `fallback` if normalized string is empty. But `normalizeConversationKey` calls it with `fallback="conversation_unknown"`. If `value` is `"---"` or `"@@@"`, it normalizes to `""` returns `"conversation_unknown"`. This is correct behavior but worth noting that distinct inputs `"---"` and `"@@@"` collide to same key.

**Counter-example**: 
```javascript
normalizeConversationKey("---") === normalizeConversationKey("@@@") // true
```

**Suggested fix**: If collision matters, include a hash suffix: `normalized || hashString(value).slice(0,8)`.

---

### 12. `buildCapabilityReceipt` - `retrievalAudit.rag.filtered` Assumption (lib/dispatch.mjs:270-285)

**Location**: `lib/dispatch.mjs:270-285`

**Severity**: Medium

**Issue**: The code assumes `retrievalAudit.rag?.filtered` is an array with `.map()`. But `getRelevantMarkdownSnippets` (imported from `md_retriever.mjs`) is not shown in context. If it returns an object without `filtered` or with `filtered: null`, the optional chaining `retrievalAudit.rag?.filtered` returns `undefined`, and `undefined.map` throws TypeError.

**Counter-example**: `retrievalAudit = { rag: { count: 5, files: [...] } }` (no `filtered` property). Code crashes at `retrievalAudit.rag?.filtered.map(...)`.

**Suggested fix**: Default to empty array: `(retrievalAudit.rag?.filtered || []).map(...)`

---

### 13. Redirect Loop Detection - `openaiCompatGenerateText` (lib/openai_compat_client.mjs:45-70)

**Location**: `lib/openai_compat_client.mjs:45-70`

**Severity**: Medium

**Issue**: The redirect loop allows `maxRedirects = 3` (4 total requests). But the `currentUrl` is updated before checking `redirectCount <= maxRedirects`. On the 4th redirect (redirectCount=3), it continues, increments to 4, loops again, then throws "Too many HTTP redirects" at redirectCount=4. This allows 4 redirects (5 requests) not 3.

**Counter-example**: 
- Request 1 302 Request 2 (redirectCount=1)
- Request 2 302 Request 3 (redirectCount=2)
- Request 3 302 Request 4 (redirectCount=3)
- Request 4 302 Request 5 (redirectCount=4) loop continues
- Request 5 302 redirectCount=5 throws

Actually 5 requests (4 redirects). The condition `redirectCount <= maxRedirects` with `maxRedirects=3` allows redirectCount 0,1,2,3 (4 redirects).

**Suggested fix**: Change to `redirectCount < maxRedirects` or increment before check.

---

### 14. `enforceOptionalityQuestion` - Double Question Mark (lib/dispatch.mjs:570-578)

**Location**: `lib/dispatch.mjs:570-578`

**Severity**: Low

**Issue**: If `text` already ends with `?` and `DIZZY_ENFORCE_OPTIONALITY_QUESTION=1`, it appends `\n\nWhat options do you want to explore next?` creating two questions. Not a correctness issue but UX noise.

**Counter-example**: Input: `"Ready?"` with env=1 Output: `"Ready?\n\nWhat options do you want to explore next?"`

**Suggested fix**: Check `endsWithQuestion(text)` before appending.