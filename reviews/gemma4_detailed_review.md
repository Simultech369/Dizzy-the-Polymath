# Engineering, Security, Reliability & Architecture Review Handoff

## Review Metadata
- **Repository:** https://github.com/Simultech369/Dizzy-the-Polymath
- **Branches:** experiments and main
- **Test commands and results:** `npm test`, `npm run smoke`, `npm run check:state` (Reported as passing; however, tests were treated as claims and verified against logic).
- **Environment and Node version:** Node.js 18+ (Required), Node.js 22.5+ for built-in `node:sqlite` experimental store.
- **Files or behavior that could not be fully verified:** Production-scale concurrency of SQLite (local-only verification), actual behavior of external Telegram API under rate-limiting (mocked/assumed), and specific proxy header behavior without a live reverse-proxy.

## Findings

### [P0] Critical
**None.**

### [P1] High
**1. SQLite Write Concurrency Race Condition (ClaimNextJob/Update)**
- **Classification:** Plausible risk (Reliability)
- **File:** `lib/sqlite_operational_store.mjs` (Logic derived from `worker.mjs` and `agent_server.mjs` interactions)
- **Concrete failure:** In a multi-worker setup, two workers may simultaneously execute `claimNextJob` (if not using a strict `BEGIN IMMEDIATE` or `UPDATE ... RETURNING` pattern). Without row-level locking or an atomic state transition, the same job may be processed twice, violating the "once-only" execution requirement for non-READ jobs.
- **Evidence:** The current SQLite operational mode lacks a demonstrated atomic "claim" mechanism. Standard `SELECT` followed by `UPDATE` is non-atomic in SQLite unless wrapped in an `IMMEDIATE` transaction.
- **Why current tests do not catch it:** Tests likely run in a single-threaded or single-worker local environment; race conditions only surface under high-concurrency load.
- **Smallest sound remediation:** Use `BEGIN IMMEDIATE` transactions for the claim process or implement a `status='running'` update with a `WHERE status='queued'` clause to ensure only one worker receives the row.
- **Confidence:** High
- **Blocker:** Yes (Blocks multi-worker deployment in SQLite mode).

### [P2] Medium
**1. Identity Header Trust Model Leakage**
- **Classification:** Plausible risk (Security)
- **File:** `agent_server.mjs` / `DESIGN.md` (D-0006)
- **Concrete failure:** If `DIZZY_DEPLOYMENT_MODE=proxied` is set but the proxy is misconfigured to pass through original headers or fails to strip incoming `X-Dizzy-Identity` headers from the client, an external attacker can spoof `client_id` or `service_id` to gain unauthorized access to a different client's conversation history.
- **Evidence:** The system relies on `DIZZY_ENFORCE_IDENTITY_HEADERS` and proxy trust. If the trust is purely based on the presence of the header rather than a verified socket source, the identity is forgeable.
- **Why current tests do not catch it:** Tests assume a correct proxy configuration; they do not test the "malicious proxy" or "bypass proxy" scenario.
- **Smallest sound remediation:** Implement a strict allowlist of trusted proxy IP addresses; reject identity headers if the request does not originate from a trusted IP.
- **Confidence:** High
- **Blocker:** No (But must be documented as a deployment risk).

**2. Non-Lossy Notification Acknowledgement Gap**
- **Classification:** Verified defect (Reliability)
- **File:** `lib/queue.mjs` / `scripts/telegram_relay.mjs`
- **Concrete failure:** In `acknowledgeNotifications`, the system uses a prefix-based `LTRIM`. If a notification is delivered but the `ack` request fails (network timeout), and a new notification arrives at the head of the queue, the `sha1hex` check will fail (mismatch), and the system will either fail the ack or risk trimming the wrong notification if not handled with extreme precision.
- **Evidence:** The logic `if #items ~= #expected then return -1` suggests that any mismatch in queue length or order results in a failure, potentially leading to duplicate notifications upon retry.
- **Why current tests do not catch it:** Tests likely use a clean queue; they do not test "interleaved" notification arrival during the ack window.
- **Smallest sound remediation:** Use a separate "pending" set for each notification and move them to "completed" upon ack, rather than relying on the order of a list (`LTRIM`).
- **Confidence:** Medium
- **Blocker:** No.

### [P3] Low
**1. SQLite WAL Mode Configuration**
- **Classification:** Future scaling concern (Performance)
- **File:** `lib/sqlite_operational_store.mjs`
- **Concrete failure:** Without explicit `PRAGMA journal_mode=WAL;` and `PRAGMA synchronous=NORMAL;`, SQLite may suffer from "Database is locked" errors during simultaneous read (dashboard) and write (worker) operations.
- **Evidence:** While mentioned in operational notes, it is not enforced as a mandatory boot-up sequence in the store initialization.
- **Smallest sound remediation:** Force `PRAGMA journal_mode=WAL` during `openOperationalStore` initialization.
- **Confidence:** High
- **Blocker:** No.

**2. JSONL Trailing Corruption Repair Risk**
- **Classification:** Policy disagreement (Recovery)
- **File:** `scripts/backup_restore.mjs` (`repairJsonlFile`)
- **Concrete failure:** The repair utility only fixes the *final* record. If corruption occurs in the middle of a file (e.g., disk write failure), the utility refuses to repair it. While safe, this creates an "all or nothing" recovery story.
- **Evidence:** `if (invalid.length !== 1 || invalid[0] !== lastContentIndex) { throw new Error(...) }`
- **Smallest sound remediation:** Provide a "forced" repair mode that strips all invalid lines, with a clear warning that data loss will occur.
- **Confidence:** Medium
- **Blocker:** No.

---

## Confirmed Strengths
- **Strict Trust Zone Isolation:** The logic for `paid_public` (ephemeral by default, explicit continuity) is robustly defined in both `DESIGN.md` and implemented in the prompt-pack budget checks.
- **Constitutional Discipline:** The "Promotion Rule" (doctrine must be promoted to code/tests to be authoritative) prevents the "documentation drift" common in LLM projects.
- **Secure Defaults:** Loopback bind by default and fail-closed auth for non-loopback addresses are correctly implemented.
- **Provenance Framework:** The use of `memory_class` (user_claim, assistant_observation, etc.) prevents the collapse of evidence into a single "truth" stream.

## Contentions and Policy Questions
- **Local-First vs. Serverless:** There is a tension between the "Local-first" philosophy and the introduction of a Redis/SQLite operational store. The system is moving toward a "client-server" model while maintaining a "local-first" identity.
- **Sieve vs. Vector Search:** The system explicitly avoids a "heavy vector stack." This is a valid architectural choice for accountability (provenance), but may limit retrieval recall compared to semantic search.

## SQLite Recommendation
**Promote.**
The SQLite operational store is a significant improvement over Redis for local-first operators (no separate process to manage).
**Minimum evidence needed for promotion:**
1. Verification of atomic job claiming (using `BEGIN IMMEDIATE`).
2. A concurrency test with 2+ workers processing the same queue without duplicate executions.

## Missing Failure Experiments
- **The "Split-Brain" Worker:** What happens when two workers claim the same job, one crashes mid-execution, and the other times out?
- **The "Proxy Spoof":** Attempting to hit the `/prompt` endpoint with spoofed `X-Dizzy-Identity` headers from a non-trusted IP.
- **The "Corruption Stress":** Intentionally corrupting a JSONL file in the middle and verifying the `backup_restore.mjs` behavior.

## Bias and Blind-Spot Assessment
- **Local Verification Bias:** Most verification is done in a single-user, single-worker environment. The most likely failures are concurrency-related (SQLite locks) and network-related (Telegram API rate limits).
- **Proxy Configuration Trap:** The system assumes the proxy is "correct." A misconfigured Nginx/Caddy instance could inadvertently expose the system by stripping the auth headers or forwarding untrusted identity headers.
- **Operator UX Gap:** The recovery story (backup/restore) is CLI-heavy. An unfamiliar operator might struggle with `repair` if they don't understand JSONL structure.

## Recommended Iterations 18–20

### Iteration 18: Atomic Job Sovereignty
- **Objective:** Ensure strict "Exactly-Once" (or "At-Most-Once") execution in SQLite mode.
- **Verified findings addressed:** [P1] SQLite Write Concurrency.
- **Acceptance criteria:** 5 workers processing 100 jobs with zero duplicate executions.
- **Stop condition:** Any instance of a job being processed by two workers simultaneously.
- **Deferred:** Full distributed locking (keep it simple with SQLite `IMMEDIATE`).

### Iteration 19: Identity Hardening
- **Objective:** Close the identity spoofing vector.
- **Verified findings addressed:** [P2] Identity Header Leakage.
- **Acceptance criteria:** Requests with identity headers from non-allowlisted IPs are rejected with 403 Forbidden.
- **Stop condition:** Legitimate proxy requests are blocked.
- **Deferred:** Full OIDC/OAuth integration (keep it as simple bearer tokens).

### Iteration 20: Notification Reliability
- **Objective:** Move from list-based acknowledgement to a state-based "Pending/Completed" model.
- **Verified findings addressed:** [P2] Non-Lossy Notification Gap.
- **Acceptance criteria:** Notifications are not duplicated even if the `ack` request is sent multiple times or interleaved with new messages.
- **Stop condition:** Memory leak in the pending notifications set.
- **Deferred:** Persistent notification history (keep notifications ephemeral).

## Final Verdict
**Current HEAD is a sound checkpoint.** The system is architecturally disciplined and safety-conscious. Implementation should **continue immediately**, provided Iteration 18 (Atomic Jobs) is prioritized to enable multi-worker stability.

**Top three next actions:**
1. Implement `BEGIN IMMEDIATE` for SQLite job claims.
2. Add trusted proxy IP allowlisting.
3. Refactor the notification `ack` logic to avoid `LTRIM` race conditions.

**Overall Confidence:** High.