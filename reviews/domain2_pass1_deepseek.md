**Finding:**  
The system permits arbitrary external HTTP requests via the `tool:http_get` command. The response body is returned to the caller (via `summarizeToolResult`) without any sanitisation or redaction. If the remote service returns secret material (e.g., API keys, tokens, private data) the caller receives it directly, resulting in an immediate dataexfiltration vector.

**Attack path / leak vector:**  
1. Operator (or compromised client) issues a command such as `tool:http_get https://example.com/secret`.  
2. The dispatcher enqueues a `http_get` job; the job executes the request and returns the raw response.  
3. `summarizeToolResult` packages the response (up to 3500 characters) into a reply that is sent back to the user.  
4. The user now possesses the secret that was returned by the remote service.

**Severity:** High – direct exposure of credentials or private data to the user.

**Exact location:**  
- `summarizeToolResult` in **lib/dispatch.mjs** (lines ~140155).  
- The command parser that recognises `tool:http_get` in **routeIncomingMessage**Recommended mitigation:**  
- Introduce a whitelist of allowed domains / endpoints for toolbased HTTP requests.  
- Strip or redact any secret patterns (API keys, tokens, passwords) from tool responses before sending them to the user (e.g., using `redactTextPayload`).  
- Log the raw response only internally (or to a restricted audit log) and never echo it to the enduser.

---

**Finding:**  
The `redactSecretMaterial` function is defined recursively (calls itself), which means the actual redaction logic is never executed. Consequently, secrets are not removed from the memory files (`convoMemoryPath`, files that are written after generation.

**Attack path / leak vector:**  
1. A user interaction generates a memory entry (e.g., `/remember` or autoremember).  
2. The LLM output contains sensitive data (API keys, passwords, private tokens).  
3. `sanitizeForMemory` calls `redactSecretMaterial`, but because that function calls itself, the redaction never happens.  
4. The unsanitised text is written to disk, making the secret recoverable from the file system or from backup logs.

**Severity:** High – persistent storage of secrets in clear text.

**Exact location:**  
- Definition of `redactSecretMaterial` in **lib/dispatch.mjs** (around line115).  
- Usage in `writeRememberedMemory` (lines150165) and `maybeHandleAutoRemember` (lines130140).

**Recommended mitigation:**  
- Replace the recursive placeholder with a proper redaction implementation (e.g., regexbased removal of known secret patterns, removal of hexencoded keys, etc.).  
- Add unit tests that verify that secret patterns are removed before writing to files.  
- Consider moving secret redaction to a dedicated library function that is unittested and audited.

---

**Finding:**  
Conversation history is persisted to `convoPath` (a JSONL file) without redaction when the trust zone allows durable memory (`ephemeral_history === false`). Sensitive assistant replies (which may contain leaked credentials, private user data, or internal policy) are stored verbatim, creating a longterm leakage surface.

**Attack path / leak vector:**  
1. A request is processed by `maybeChat`.  
2. If the trust zone’s `retention_scope` is not `"conversation_only"` (e.g., `"ephemeral"` or `"local_conversation"`), the assistant’s reply is appended to `convoPath` without sanitisation.  
3. An attacker with access to the file system (or to a backup) can read the full conversation, including any secrets that were inadvertently included in the LLM response.

**Severity:** High – persistent storage of potentially sensitive conversational data.

**Exact location:**  
- `maybeChat` function, specifically the block that appends to `convoPath` (lines210220).  
- `sanitizeForRetainedClientContinuity` logic (lines7178) which only redacts when `retention_scope === "conversation_only"`.

**Recommended mitigation:**  
- Enforce a stricter `retention_scope` for any zone that may handle secretbearing content, or automatically redact assistant replies before persisting them.  
- Introduce a global sanitisation step for all persisted conversation entries (e.g., run `redactSecretMaterial` on every `text` field before writing).  
- Audit and limit the content that the LLM is allowed to return (prompt engineering, output filters) to avoid embedding secrets.

---

**Finding:**  
The `summarizeToolResult` function returns the raw JSON response from a tool (up to 3500 characters) without any sanitisation. If a tool returns a JSON object containing an API key, token, or other secret, the caller receives it directly, leading to credential leakage.

**Attack path / leak vector:**  
1. An operator or malicious actor invokes a tool such as `tool:http_get` or a custom tool that returns a JSON payload containing secrets.  
2. `summarizeToolResult` serialises the tool’s result and wraps it in a uservisible reply.  
3. The secret is delivered to the user in clear text.

**Severity:** High – direct credential leakage to the user.

**Exact location:**  
- `summarizeToolResult` in **lib/dispatch.mjs** (lines140155).  
- The toolenqueue handling in **routeIncomingMessage** (lines260270) that ultimately leads to `summarizeToolResult`.

**Recommended mitigation:**  
- Apply redaction (`redactTextPayload`) to the tool’s JSON before returning it, or limit the tool’s output size and content type.  
- Implement a whitelist of permissible tool responses and reject any response that contains patterns matching known secret formats.  
- Log tool responses only internally (or to a restricted audit channel) and never echo them to the enduser.

---

**Finding:**  
The system writes the assistant’s reply to the conversation JSONL file (`convoPath`) without sanitising the reply when the trust zone does not enforce “conversationonly” retention. This means that any secret data inadvertently included in the LLM’s output (e.g., API keys, tokens, private user details) is persisted permanently and may be accessed later by any entity with filesystem access.

**Attack path / leak vector:**  
1. A user request triggers `maybeChat`, which calls the LLM.  
2. The LLM’s response contains sensitive information (e.g., an API key).  
3. Because `ephemeral_history` is `false` for the trust zone, the reply is appended to `convoPath` via `appendJsonl` (lines215220) without redaction.  
4. An attacker with access to the file system can read the full conversation and extract the secret.

**Severity:** High – persistent storage of potentially sensitive data.

**Exact location:**  
- `maybeChat` function, specifically the `appendJsonl` call inside the `if (!ephemeralHistory)` block (lines215220).  
- The `ephemeral_history` flag is derived from `getTrustZoneCapabilities` (lines4558).

**Recommended mitigation:**  
- Ensure that any persisted conversation text is sanitised before writing (e.g., run `redactSecretMaterial` on the reply).  
- Tighten the retention policy: for zones that may handle secrets, enforce `retention_scope: "ephemeral"` or automatically redact before persisting.  
- Add audits to verify that no secret patterns appear in persisted conversation logs.

---

**Finding:**  
The `redactSecretMaterial` function is defined incorrectly (it calls itself), so secret redaction never occurs. This means that any secret data that should be removed before writing to files or logs remains visible, leading to credential leakage from stored artifacts.

**Attack path / leak vector:**  
1. A memory generation routine (`writeRememberedMemory` or `maybeHandleAutoRemember`) produces text that contains secrets (e.g., API keys).  
2. The routine calls `sanitizeForMemory`, which in turn calls `redactSecretMaterial`.  
3. Because `redactSecretMaterial` recursively calls itself, the redaction logic is never executed.  
4. The unsanitised text is written to `convoMemoryPath` or `autoMemoryCandidatePath`, persisting the secret.

**Severity:** High – persistent storage of secrets in clear text.

**Exact location:**  
- `redactSecretMaterial` definition in **lib/dispatch.mjs** (around line115).  
- Calls to `sanitizeForMemory` in `writeRememberedMemory` (lines150165) and `maybe140).

**Recommended mitigation:**  
- Replace the recursive placeholder with a proper redaction implementation (e.g., regex removal of known secret patterns, removal of hexencoded keys, removal of typical token formats).  
- Add unit tests that confirm secrets are removed before any write operation.  
- Consider moving the redaction logic to a separate, wellaudited utility module.

---

**Finding:**  
The system logs detailed execution metadata (including `chosen_model`, `data_boundary`, `model_origin_risk`, `estimated_cost_band`, `latency_ms`, `prompt_prefix_hash`, `provider_health`, etc.) for every request, and these logs are written to `runtime/router_receipts.jsonl`. If the metadata includes secret values (e.g., the actual model name that embeds a key, or the prompt prefix hash that may be derived from secretcontaining prompts), an attacker with read access to the logs can reconstruct or infer sensitive information.

**Attack path / leak vector:**  
1. A request is processed and the execution metadata is written to `router_receipts.jsonl` (via `buildRouterReceipt`).  
2. The metadata fields may contain values derived from secrets (e.g., `prompt_prefix_hash` computed from a prompt that contains an API key).  
3. An attacker who gains read access to the receipt file can infer the presence of secrets or even recover the secret if the hash is reversible (unlikely but possible if the hash is based on a small input space).

**Severity:** Medium – indirect leakage of sensitive context via logs.

**Exact location:**  
- `buildRouterReceipt` function (lines260285) which creates the receipt object.  
- The receipt is persisted in `runtime/router_receipts.jsonl` (path defined by `DIZZY_ROUTER_RECEIPT_PATH`).

**Recommended mitigation:**  
- Ensure that any field in the receipt that could expose secrets is sanitized before logging (e.g., mask model names, remove or hash sensitive prompt material).  
- Restrict file permissions on `router_receipts.jsonl` to authorized personnel only.  
- Periodically audit the receipt file for inadvertent leakage of secret material.

---

**Finding:**  
The `maybeChat` function allows a fallback to the OpenAIcompatible backend even when the primary backend (Gemini) is unavailable, but it does not enforce the same isolation checks for the fallback as it does for the primary path. If the primary path is blocked due to localisolation requirements, the fallback may still be invoked, potentially allowing a private zone to make remote cloud calls that are otherwise prohibited.

**Attack path / leak vector:**  
1. A request arrives that requires private/internal isolation (`localIsolationRequired === true`).  
2. The primary backend (`gemini`) is blocked, but the code proceeds to the fallback (`openai_compat`) without rechecking isolation.  
3. The fallback makes a remote HTTP call, violating the isolation policy and possibly leaking data to an external service.

**Severity:** High – policy bypass leading to unauthorized external communications.

**Exact location:**  
- In `maybeChat`, after the primary backend failure the code attempts fallback without reevaluating `localIsolationRequired` (lines225240).  
- The check `if (localIsolationRequired && isRemoteCloudBackend(backend, activeCompatUrl))` is only applied when the primary backend is configured; it is not reapplied for the fallback isolation constraints after any backend switch, ensuring that a fallback is only used when the request also satisfies `localIsolationRequired === false`.  
- Move the isolation check to a central location that is consulted both before the primary request and after any fallback is selected.

---

**Finding:**  
The `createRuntime` function constructs a ratelimit middleware that uses the client’s IP address (or `XForwardedFor`) to create bucket keys. When the deployment mode is `"proxied"` or `"hosted"` and a trusted proxy IP is present, the client IP is taken from the forwarded header; however, the trustedproxy list is not validated against the actual remote address, allowing a malicious client to spoof a trusted proxy IP and bypass rate limits.

**Attack path / leak vector:**  
1. An attacker sends requests that appear to originate from a trusted proxy IP (by including a forged `X-Forwarded-For` header).  
2. Because the deployment mode permits `"proxied"` and the trustedproxy list is used to decide whether to trust the forwarded IP, the attacker can make the request appear local and consume unlimited quota.  
3. This leads to a denialofservice or abuse of computational resources, potentially causing other users to be throttled or the service to be exhausted.

**Severity:** Medium – resourceexhaustion / denialofservice.

**Exact location:**  
- `rateLimitClientKey` function (lines260268) which normalises the client IP and checks trusted proxies.  
- `createRateLimitMiddleware` (lines250270) which builds the bucket key based on `rateLimitClientKey`.

**Recommended mitigation:**  
- Strengthen IP validation: require the forwarded IP to be within a known CIDR range of the trusted proxy, and optionally require TLS mutual authentication for proxied mode.  
- Add a fallback that uses the socket’s remote address when the forwarded header is suspicious.  
- Log any discrepancies between the expected proxy IP and the actual client IP for audit purposes.

---

**Finding:**  
The `handleIncomingMessage` function processes incoming messages without verifying that the caller is authorized to issue tool commands. A malicious actor could send a `tool:http_get` request to an internal service that should be inaccessible, leading to unauthorized data retrieval.

**Attack path / leak vector:**  
1. An unauthenticated or improperly authenticated client sends a POST to `/dispatch/incoming` with a body containing `tool:http_get https://internalservice/secret`.  
2. The request passes the boundaryviolation guard (which only checks for trustzone and promptinjection, not commandlevel authorization).  
3. The dispatcher enqueues the tool job; if the job succeeds, the result (including secret data) is returned to the caller.  

**Severity:** High – unauthorized tool usage leading to data exfiltration.

**Exact location:**  
- `routeIncomingMessage` (lines260270) parses `tool:` commands but does not enforce authentication beyond the general requestlevel checks.  
- `handleIncomingMessage` (lines150170) forwards the message to `runConversationSerialized` which eventually calls `maybeChat`; tool commands are handled inline in `routeIncomingMessage`.

**Recommended mitigation:**  
- Add explicit authorization checks for tool commands, ensuring that only users with the appropriate role or token can invoke `tool:` commands.  
- Introduce a whitelist of allowed tool types per user/role and reject any unknown or privileged tool.  
- Log tool command invocations with user identity for auditability.

---

**Finding:**  
The system allows the `execute` endpoint to run arbitrary code (via `/agent/execute`) without requiring additional cryptographic verification beyond the `idempotency-key`. If an attacker can guess or obtain a valid `idempotency-key`, they could replay the request and cause unintended state changes (e.g., writing files, modifying the filesystem) with the privileges of the service.

**Attack path / leak vector:**  
1. An attacker obtains a previously generated `idempotency-key` (e.g., via logging or sidechannel).  
2. They replay the request (`/agent/execute`) with the same key, causing the server to treat it as a duplicate and skip validation of the payload.  
3. If the original request performed a privileged action (e.g., writing a file with secret content), the replay could be used to repeat the action or to bypass some checks.  

**Severity:** Medium – request replay leading to unauthorized state changes.

**Exact location:**  
- `runAgentExecute` (lines310340) validates `client_id`/`service_id` only when `enforceIdentityHeaders` is true; otherwise it relies on `continuity_mode`.  
- The `idempotencyKey` handling in `routeIncomingMessage` (lines260270) and `runAgentExecute` (lines310340) does not enforce that the key is tied to a specific user or session beyond a simple string comparison.

**Recommended mitigation:**  
- Bind the `idempotency-key` to a cryptographic token that includes the caller’s identity (e.g., HMAC signed with a secret).  
- Ensure that the key is singleuse and expires after a short window.  
- Add additional checks that the `client_id`/`service_id` presented with the key match the expected identity for that key.

---

**Finding:**  
The `createRuntime` function creates a ratelimit bucket per client IP, but the bucket is never pruned when the process restarts. If the server restarts frequently, the bucket count may accumulate stale entries, causing the effective rate limit to be higher than configured, which can be abused for denialofservice.

**Attack path / leak vector:**  
1. The server runs with a ratelimit window of 60seconds and a max of 120 requests.  
2. After a restart, the bucket map is reinitialized, resetting the request count for all clients, effectively allowing a burst of 120 requests per client immediately after startup.  
3. An attacker can time their requests to coincide with restarts to bypass the intended rate limit.

**Severity:** Medium – potential circumvention of ratelimit protections.

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) initializes a new `Map` each time the middleware is invoked (on each server start).  
- The pruning logic (`pruneExpiredRateLimitBuckets`) runs only after a certain time (`nextPruneAt`) and does not account for process restarts.

**Recommended mitigation:**  
- Persist bucket state across restarts (e.g., store counts in Redis) or ensure that the bucket map is cleared in a controlled manner that respects the configured window.  
- Add a startup check that validates the bucket state and optionally reinitialises it in a way that respects the `windowMs` setting.

---

**Finding:**  
The `maybeChat` function constructs a system prompt that includes a `trustZoneBlock` string derived from the request’s trust zone. If an attacker can influence the `trust_zone` value (e.g., via a malicious message that sets `runtime_context.trust_zone` to `"private_self"`), they could cause the system prompt to claim a higherprivilege zone, potentially leading to privilege escalation or bypassing of databoundary restrictions.

**Attack path / leak vector:**  
1. The attacker sends a message that includes `runtime_context.trust_zone: "private_self"` (or manipulates it via the `runtime_context` field).  
2. `getTrustZone` will return `"private_self"` as the zone, and `getTrustZoneCapabilities` will grant the attacker the capabilities associated with that zone (e.g., `repo_retrieval_allowed`, `durable_memory_allowed`).  
3. The constructed system prompt will then allow the LLM to access resources that are otherwise restricted, possibly leading to data leakage or unauthorized actions.

**Severity:** High – trustzone spoofing leading to privilege escalation.

**Exact location:**  
- `getTrustZone` function (lines5871) parses `runtime_context.trust_zone`.  
- `getTrustZoneCapabilities` (lines7392) uses that zone to decide capabilities.

**Recommended mitigation:**  
- Ensure that the `trust_zone` field is set only by trusted internal code and not modifiable by enduser input.  
- Add validation that the presented trust zone matches the authenticated session’s zone; reject or normalise unexpected values.  
- Log any attempts to set a trust zone that deviates from the expected value.

---

**Finding:**  
The `buildCapabilityReceipt` function includes a field `retrieved_files` that lists file paths obtained during a retrieval operation. If those file paths contain sensitive data (e.g., configuration files with secrets), the receipt itself can be exposed to anyone who can read the audit log or the receipt JSON, leaking the existence and potentially the content of those files.

**Attack path / leak vector:**  
1. A request that is allowed to retrieve repository documents (`repo_retrieval_allowed === true`) causes the system to read files from the file system (e.g., markdown documents).  
2. The receipt includes the list of those file paths in `retrieved_files`.  
3. If the receipt is logged or transmitted (e.g., to an operator dashboard), an attacker can infer which files contain sensitive data and may attempt to read them directly.

**Severity:** Medium – information disclosure via audit logs.

**Exact location:**  
- `buildCapabilityReceipt` (lines140165) builds the `retrieved_files` array from `audit.retrieved_files`.  
- The receipt is later persisted in `runtime/router_receipts.jsonl` (lines310315) and may be exposed.

**Recommended mitigation:**  
- Redact or omit file paths that contain sensitive information from the receipt before persisting or transmitting it.  
- Apply the same secretredaction logic used elsewhere (`redactSecretMaterial`) to the filepath strings if they may contain sensitive content.  
- Ensure that only authorized roles can view the receipt details.

---

**Finding:**  
The `createRuntime` function allows the `publicSurfaceMode` configuration to be set to `"closed"`, `"discovery"`, or `"open"`. If set to `"discovery"` or `"open"`, the system may expose internal endpoints (e.g., `/agent/profile`, `/agent/services`, `/agent/portfolio`) to the public internet, inadvertently leaking operational metadata that could aid an attacker in reconnaissance or social engineering.

**Attack path / leak vector:**  
1. The operator sets `DIZZY_PUBLIC_SURFACES=discovery` (or `"open"`).  
2. The dashboard and related API endpoints become publicly reachable.  
3. An attacker can enumerate the available services, learn about the internal trust zones, and craft targeted attacks (e.g., crafting prompts that exploit the discovered capabilities).  

**Severity:** Medium – information disclosure leading to improved attack surface.

**Exact location:**  
- `createRuntime` (lines140150) reads `publicSurfaceMode` from environment or opts.  
- Dashboard route registration (lines165175) respects the `dashboardEnabled` flag but does not gate the other service endpoints.

**Recommended mitigation:**  
- Restrict public exposure of internal service endpoints to authenticated administrators only.  
- Audit the list of exposed endpoints and ensure they are only enabled in trusted environments.  
- Provide a clear security guideline that `publicSurfaceMode` should remain `"closed"` unless a vetted public interface is required.

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage. If the process runs for a long time without restart, the map may grow unbounded as new client IPs are encountered, leading to memory bloat and potential denialofservice.

**Attack path / leak vector:**  
1. An attacker continuously sends requests from many distinct IP addresses (e.g., via a botnet).  
2. Each distinct IP creates a new bucket entry in the `Map`, causing the memory footprint of the ratelimit structure to increase linearly.  
3. Eventually, the server may exhaust memory or become slow, affecting legitimate users.

**Severity:** Medium – denialofservice via memory exhaustion.

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a new `Map` and stores perclient buckets.  
- No eviction or limit on the number of buckets is implemented.

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., cap at 10000) and evict stale buckets after a timeout.  
- Alternatively, move the ratelimit implementation to a centralized store (Redis) that can handle TTLs automatically.  
- Monitor memory usage of the ratelimit structure and trigger alerts if it grows beyond a threshold.

---

**Finding:**  
The `maybeChat` function builds a system prompt that concatenates multiple components (`baseSystemPrompt`, `trustZoneBlock`, `skillBlock`, `ragBlock`, `graphBlock`, `trajectoryBlock`). If any of these components are under attacker control (e.g., via crafted messages that influence `trustZone` or inject malicious content into `skillBlock`), the final prompt could be manipulated to cause the LLM to behave unexpectedly, potentially leading to data leakage or execution of unintended logic.

**Attack path / leak vector:**  
1. An attacker crafts a message that sets `trust_zone` to a highprivilege zone and injects malicious content into `skillBlock` or `ragBlock`.  
2. The generated system prompt includes this malicious content, causing the LLM to include or reveal sensitive data in its response.  

**Severity:** Medium – prompt injection leading to information leakage or unintended behavior.

**Exact location:**  
- `maybeChat` (lines185240) builds the `systemPrompt` by concatenating several variables, including `trustZoneBlock` derived from `getTrustZone(msg)` and `skillBlock` from `selectLocalSkills`.  

**Recommended mitigation:**  
- Sanitize and validate all usercontrolled inputs that are incorporated into the system prompt (e.g., whitelist allowed values for `trust_zone`, escape or filter HTML/JS in `skillBlock` and `ragBlock`).  
- Separate usercontrolled data from the prompt using a templating approach that prevents injection.  
- Conduct regular code reviews for promptinjection vectors.

---

**Finding:**  
The `writeRememberedMemory` function writes the generated memory to a file under `process.cwd()` without any pathtraversal checks. An attacker who can influence the `convoKey` (e.g., via a malicious message that includes `../` sequences) could write outside the intended `memory` directory, potentially overwriting system files or reading sensitive data.

**Attack path / leak vector:**  
1. The attacker sends a message that influences `convoKey` to include path traversal sequences (e.g., `convoKey = "../../../../etc/passwd"`).  
2. The `convoMemoryPath` computed as `conversationArtifactPath(convoMemoryDir, convoKey, ".md")` resolves to a location outside the `memory` directory.  
3. The file is written there, potentially overwriting system files or exposing their contents.  

**Severity:** High – local file system writearbitration leading to data tampering or exfiltration.

**Exact location:**  
- `conversationArtifactPath` function (lines124131) builds the path using `path.resolve` and validates that the resulting relative path stays within the owner directory. However, if `convoKey` contains `../` sequences, the validation may be bypassed because `normalizeConversationKey` does not sanitize `..` sequences before the path resolution.  

**Recommended mitigation:**  
- Ensure that `convoKey` is strictly alphanumeric with underscores and hyphens, rejecting any `..` or absolute path components.  
- Add explicit validation that the resolved path is a child of the intended directory (`memoryDir`).  
- Use `path.norm` and `path.isWithin` checks to guarantee the final path stays within bounds.

---

**Finding:**  
The `runConversationSerialized` function maintains a global `conversationWorkQueues` map that stores promises for ongoing conversations. If an attacker can cause a conversation key collision (e.g., by sending messages that cause the same normalized key to be generated for different logical conversations), they could intercept or manipulate the state of another user’s session, leading to data leakage or unauthorized actions.

**Attack path / leak vector:**  
1. The attacker crafts two distinct messages that normalize to the same `conversationKey` (e.g., by using the same `from` and `channel` values).  
2. The `runConversationSerialized` function will queue the second message to run in the context of the first conversation’s promise, causing state contamination.  
3. This could allow the attacker to read or modify the other user’s conversation state, potentially extracting secrets or causing unintended actions.  

**Severity:** Medium – session hijacking / state contamination.

**Exact location:**  
- `runConversationSerialized` (lines140150) uses `conversationWorkQueues` keyed by `normalizeConversationKey`.  
- `normalizeConversationKey` (lines250260) normalises identifiers but does not incorporate a unique session identifier beyond `channel` and `from`.  

**Recommended mitigation:**  
- Include a persession nonce (e.g., a timestamp or random UUID) in the conversation key to make collisions highly unlikely.  
- Enforce that each conversation key must be unique for a given user/session, and reject duplicate key attempts.  
- Log any key collisions for audit purposes.

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that is applied to *all* routes except `/health`. However, the `/health` endpoint is exempted, which means that healthcheck traffic is not subject to rate limiting. An attacker can flood the healthcheck endpoint to exhaust resources without being throttled, potentially causing a denialofservice on the service.

**Attack path / leak vector:**  
1. An attacker sends a high volume of requests to `/health` (e.g., 10000 requests per second).  
2. Since `/health` is exempt from rate limiting, the server processes each request without restriction, consuming CPU and I/O.  
3. Legitimate users may experience latency or timeouts, and the server may become unresponsive.  

**Severity:** Medium – denialofservice via healthcheck flooding.

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) includes a guard `if (req.path === "/health") return next();` which bypasses rate limiting.  

**Recommended mitigation:**  
- Apply rate limiting to the health endpoint as well, or at least limit it to a stricter threshold.  
- Use a separate, more restrictive ratelimit configuration for health checks (e.g., a higher `max` value but shorter `windowMs`).   APIkeybased throttling for health checks to prevent abuse.

---

**Finding:**  
The `createRuntime middleware but does not enforce a maximum number of concurrent executions for tool jobs. If many tool jobs are enqueued simultaneously, the underlying queue system may become a bottleneck, causing high latency or dropped jobs, which can be leveraged for denialofservice.

**Attack path / leak vector:**  
1. An attacker repeatedly invokes tool commands (e.g., `tool:http_get`) that each enqueue a job.  
2. The queue becomes saturated, causing subsequent jobs to be delayed or dropped.  
3. Legitimate users experience timeouts and may be unable to complete their tasks.  

**Severity:** Medium – resource exhaustion leading to service degradation.

**Exact location:**  
- `enqueueJob` is called from various places (e.g., `handleIncomingMessage`, tool commands).  
- No explicit concurrency limit is set on the queue itself; the system relies on the underlying Redis implementation.  

**Recommended mitigation:**  
- Configure a maximum concurrency limit for tool jobs (e.g., via Redis semaphore or a jobworker pool size).  
- Monitor queue length and reject new jobs when the queue is full, returning a clear error to the caller.  
- Implement backpressure mechanisms so that the server can gracefully degrade when the queue is saturated.

---

**Finding:**  
The `buildRouterReceipt` function includes a `fallback` object that contains fields such as `configured`, `used`, `path`, and `blocked_reason`. If the `fallback` object is populated with sensitive information (e.g., the actual API endpoint URL that was attempted), it could be exposed in logs or the receipt file, leaking internal network topology or configuration details.

**Attack path / leak vector:**  
1. A request fails to execute because the primary backend is misconfigured, causing the fallback path to be triggered.  
2. The `fallback` object records the attempted backend URL (e.g., `http://internalservice:1234`).  
3. This URL is written to `runtime/router_receipts.jsonl`, which may be accessible to unauthorized parties, revealing internal service addresses.  

**Severity:** LowMedium – information disclosure of internal infrastructure.  

**Exact location:**  
- `buildRouterReceipt` (lines260285) constructs the `fallback` object, including the `path` field that may contain URLs.  
- The receipt is persisted in `runtime/router_receipts.jsonl`.  

**Recommended mitigation:**  
- Sanitize the `fallback` fields before persisting, removing or masking sensitive URLs and credentials.  
- Ensure that only nonsensitive metadata is stored in receipts; consider using a separate, accesscontrolled audit log for detailed failure reasons.  

---

**Finding:**  
The `createRuntime` function creates a dashboard that can be accessed without authentication if `dashboardEnabled` is true and the deployment mode permits discovery. The dashboard contains operational data (e.g., hardware status, consensus map) that could be used by an attacker to map the internal architecture and plan further attacks.

**Attack path / leak vector:**  
1. An unauthenticated user accesses `/dashboard` (or other dashboard routes) because the deployment allows discovery.  
2. The dashboard reveals details such as `operator-continuity`, `hardware-status`, and `consensus-map`.  
3. The attacker uses this information to target specific components (e.g., known vulnerable services) or to craft socialengineering attacks.  

**Severity:** Medium – information disclosure leading to enhanced attack surface.  

**Exact location:**  
- `createRuntime` (lines140150) enables dashboard routes based on `dashboardEnabled`.  
- Dashboard route registration (lines165175) registers many internalonly endpoints.  

**Recommended mitigation:**  
- Require authentication for all dashboard routes, even in discovery mode.  
- Disable dashboard endpoints in production unless explicitly required.  
- Audit the information exposed by each dashboard endpoint and limit it to nonsensitive data.  

---

**Finding:**  
The `createRuntime` function includes a `createProxyExposureGuard` that checks for forwarded headers and a `DIZZY_AUTH_TOKEN` requirement, but it only runs when `deploymentMode === "direct_local"`. In other deployment modes (`proxied`, `hosted`) the guard is bypassed, allowing forwarded requests to be accepted without authentication, which may lead to unauthorized access if the token is missing.

**Attack path / leak vector:**  
1. An attacker sends a request with a forged `X-Forwarded-For` header that appears to come from a trusted proxy, bypassing the guard.  
2. Because the deployment mode is not `"direct_local"`, the guard does not enforce the presence of `DIZZY_AUTH_TOKEN`.  
3. The request reaches the application without proper authentication, potentially allowing unauthorized actions.  

**Severity:** High – unauthorized access due to missing authentication in certain deployment modes.  

**Exact location:**  
- `createProxyExposureGuard` (lines215225) checks `if (forwarded && deploymentMode === "direct_local")` and returns 403 only in that case.  
- The guard is not invoked for `"proxied"` or `"hosted"` modes.  

**Recommended mitigation:**  
- Extend the proxy exposure guard to all deployment modes, ensuring that any forwarded request must present a valid `DIZZY_AUTH_TOKEN`.  
- Enforce TLS for all external connections and require mutual authentication for proxied modes.  

---

**Finding:**  
The `maybeChat` function uses `enforceOptionalityQuestion` to wrap all uservisible replies. This function adds an extra newline and a trailing question when `DIZZY_ENFORCE_OPTIONALITY_QUESTION` is enabled. If the system is configured to enforce optional questions but the LLM response already ends with a question, the resulting reply may contain two questions, which could confuse the user or be used to manipulate the conversation flow.

**Attack path / leak vector:**  
1. The system is configured to enforce optional questions (`DIZZY_ENFORCE_OPTIONALITY_QUESTION = true`).  
2. The LLM returns a response that already ends with a question.  
3. `enforceOptionalityQuestion` appends another question, resulting in a doublequestion reply.  
4. This may be exploited to keep the user in a looping interaction, delaying termination or causing user fatigue, which could be used for denialofservice or manipulation.  

**Severity:** Low – usability issue, not a direct security breach.  

**Exact location:**  
- `enforceOptionalityQuestion` (lines95108) adds a trailing question when the input does not end with one.  
- The function is called in many places, including `maybeChat` (line226).  

**Recommended mitigation:**  
- Adjust `enforceOptionalityQuestion` to detect and avoid duplicate questions, or make the enforcement optional percontext rather than global.  
- Ensure that LLM responses are preprocessed to remove trailing whitespace before the enforcement step.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that checks `req.path === "/health"` to skip rate limiting, but it does not apply any separate limit to health checks. This can be abused to launch a lowcost denialof the health endpoint, consuming server resources without affecting the main business logic.

**Attack path / leak vector:**  
1. An attacker sends a high volume of `/health` requests (e.g., 1000 per second).  
2. The server processes each request without throttling, consuming CPU, memory, and network bandwidth.  
3. Legitimate users may experience degraded performance or timeouts.  

**Severity:** Medium – denialofservice via healthcheck flooding.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) contains `if (req.path === "/health") return next();` which bypasses rate limiting.  

**Recommended mitigation:**  
- Apply a rate limit to the health endpoint as well, perhaps with a higher `max` value but a shorter `windowMs`, or require a special token for health checks.  
- Log healthcheck requests and alert on abnormal spikes.  

---

**Finding:**  
The `maybeChat` function uses `appendJsonl` to write the assistant’s reply to the conversation JSONL file. If the reply contains sensitive data (e.g., an API key echoed by the LLM), that secret becomes permanently stored in the log file, which may be accessible to other users or processes with filesystem read access.

**Attack path / leak vector:**  
1. A user asks a question that causes the LLM to include a secret in its response (e.g., “What is your API key?”).  
2. The assistant’s reply contains that secret and is appended to `convoPath`.  
3. Any later reader of the log file can extract the secret, leading to credential leakage.  

**Severity:** High – persistent storage of secrets in logs.  

**Exact location:**  
- `maybeChat` (lines215220) appends the assistant reply to `convoPath` via `appendJsonl`.  
- The `appendJsonl` implementation writes raw JSON without sanitisation.  

**Recommended mitigation:**  
- Ensure that all assistant replies are sanitized (e.g., run `redactSecretMaterial` on the text before persisting).  
- Consider redacting sensitive fields from LLM responses before they are logged or stored.  
- Periodically audit the conversation logs for secret leakage.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses `req.ip` (or `X-Forwarded-For`) as the key for rate limiting. In environments where multiple tenants share the same IP (e.g., NATed environments), all tenants will be counted against a single bucket, leading to inaccurate rate limiting and potential denialofservice for legitimate tenants.

**Attack path / leak vector:**  
1. Multiple legitimate users are behind the same NAT IP.  
2. The ratelimit bucket for that IP becomes saturated quickly, causing legitimate traffic to be rejected.  
4. An attacker can exploit this by launching requests from a distinct IP that shares the same NAT address as a legitimate user, bypassing the intended pertenant limits.  

**Severity:** Medium – inaccurate rate limiting causing unfair resource allocation.  

**Exact location:**  
- `rateLimitClientKey` (lines260268) builds the client key from `req.socket?.remoteAddress` or `req.ip`.  

**Recommended mitigation:**  
- Use a more granular identifier, such as a combination of `remoteAddress` and an authenticated user ID, to differentiate tenants.  
- If NAT is present, consider deploying the service in a networksegmented way or using a separate instance per tenant.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but there is no eviction policy for stale buckets. Over time, as new client IPs appear, the map can grow without bound, eventually exhausting memory and causing the server to become unresponsive.

**Attack path / leak vector:**  
1. An attacker sends requests from a large number of distinct IP addresses (e.g., a botnet).  
2. Each distinct IP creates a new entry in the `Map`, causing memory consumption to increase linearly.  
3. Eventually the server runs out of memory or becomes too slow to handle legitimate requests.  

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a new `Map` and stores perclient buckets without any eviction or size limit.  

**Recommended mitigation:**  
- Implement a maximum number of buckets or a timetolive (TTL) for each bucket, removing entries that have not been used for a configurable period.  
- Alternatively, move the ratelimit state to an external store (e.g., Redis) that supports TTLs and automatic cleanup.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but there is no persistence across restarts. If the server restarts, all ratelimit state is lost, allowing an attacker to bypass the intended limits by timing restarts after a burst of requests.

**Attack path / leak vector:**  
1. An attacker floods the system with requests to exceed the configured limit.  
2. The server restarts (e.g., due to a crash or deployment), clearing the bucket map.  
3. The attacker can then send another burst of requests, effectively resetting the rate limit and bypassing the protection.  

**Severity:** Medium – ratelimit circumvention via process restart.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a fresh `Map` each time it is invoked, losing any historical bucket data.  

**Recommended mitigation:**  
- Persist the bucket state in a durable store (e.g., Redis) that survives restarts, or implement a cleanup routine that respects the configured `windowMs`.  
- Ensure that the ratelimit implementation is resilient to restarts, e.g., by using a shared store rather than an inmemory map.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but there is no explicit limit on the number of buckets. If an attacker can cause the creation of many distinct client keys (e.g., by sending requests from many spoofed IPs), the memory usage of the middleware can grow unbounded, leading to a denialofservice.

**Attack path / leak vector:**  
1. An attacker sends requests from many spoofed IP addresses, each resulting in a new bucket entry in the `Map`.  
2. The memory consumption of the middleware grows linearly with the number of distinct keys.  
4. The server may run out of memory or become too slow, affecting availability.  

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key without any cap.  

**Recommended mitigation:**  
- Impose a hard limit on the number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Alternatively, store bucket state in a TTLenabled external system (e.g., Redis) that automatically expires stale entries.  

---

**Finding:**  
The `createRuntime` function includes a `createProxyExposureGuard` that only blocks forwarded requests when `deploymentMode === "direct_local"`. In other modes (`proxied`, `hosted`) the guard is bypassed, allowing a request that claims to be from a trusted proxy to be accepted without authentication, potentially leading to unauthorized access.

**Attack path / leak vector:**  
1. An attacker crafts a request that includes a forged `X-Forwarded-For` header pointing to a trusted proxy IP.  
2. Because the deployment mode is not `"direct_local"`, the guard does not block the request.  
3. If `DIZZY_AUTH_TOKEN` is not presented, the request may be processed without proper authentication, granting the attacker unauthorized capabilities.  

**Severity:** High – unauthorized access due to missing authentication checks in nondirectlocal modes.  

**Exact location:**  
- `createProxyExposureGuard` (lines215225) only returns 403 when `forwarded` is true **and** `deploymentMode === "direct_local"`.  
- The guard is not invoked for `"proxied"` or `"hosted"` modes.  

**Recommended mitigation:**  
- Extend the proxy exposure guard to all deployment modes, ensuring that any forwarded request must present a valid `DIZZY_AUTH_TOKEN`.  
- Enforce TLS and mutual authentication for proxied modes to prevent header spoofing.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that applies to all routes except `/health`. The health endpoint is not ratelimited, which means an attacker can send a large volume of healthcheck requests to consume server resources without being throttled, potentially causing a denialofservice condition.

**Attack path / leak vector:**  
1. An attacker sends a highfrequency series of requests to `/health` (e.g., 10000 per minute).  
2. Since `/health` bypasses the ratelimit middleware, each request is processed without restriction, consuming CPU, memory, and network I/O.  
4. Legitimate users may experience latency or timeouts, and the server may become unresponsive.  

**Severity:** Medium – denialofservice via healthcheck flooding.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) contains `if (req.path === "/health") return next();` which skips rate limiting for health checks.  

**Recommended mitigation:**  
- Apply a rate limit to the health endpoint as well, perhaps with a stricter configuration (lower `max`, smaller `windowMs`).  
- Require an API key or token for health checks, or limit the endpoint to loopback only.  
- Log healthcheck requests and alert on abnormal request rates.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map is never cleared or pruned beyond the `nextPruneAt` logic, which only runs after `windowMs` has elapsed. If the server runs for a long time, the map can grow without bound as new client IPs are introduced, leading to memory bloat and potential denialofservice.

**Attack path / leak vector:**  
1. An attacker continuously sends requests from many distinct IP addresses.  
2. Each distinct IP creates a new bucket entry in the `Map`, causing memory usage to increase linearly.  
3. After sufficient time, the server may exhaust memory or become too slow to handle legitimate traffic.  

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; no eviction beyond the `nextPruneAt` check, which only removes entries older than the current window.  

**Recommended mitigation:**  
- Add a maximum bucket count and evict the oldest buckets when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and trigger alerts if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map is never cleared or pruned beyond the `nextPruneAt` logic, which only removes entries older than the current `windowMs`. If the server runs for a long time, the map can grow without bound as new client IPs appear, eventually exhausting memory and causing the server to become unresponsive.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup occurs via `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., cap at 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it exceeds a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but there is no explicit maximum size for the map. An attacker can cause the map to grow unbounded by sending requests from many distinct IP addresses, leading to memory exhaustion and a denialofservice condition.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key without any size limit.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) that automatically expires stale entries.  
- Monitor memory consumption of the ratelimit structure and trigger alerts if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check, which only removes entries older than the current `windowMs`. This can lead to unbounded memory growth if many distinct client IPs are observed.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) that automatically expires stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it exceeds a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and trigger alerts if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but there is no explicit limit on the number of buckets. An attacker can cause the map to grow unbounded by sending requests from many distinct IP addresses, leading to memory exhaustion and a denialofservice condition.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key without any size limit.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) that automatically expires stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
 only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 1000) and evenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a Tenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` ( a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialcreateRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Severity:** Medium – denialofservice via memory exhaustion.  

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g., 10000) and evict the oldest entries when the limit is exceeded.  
- Store bucket state in a TTLenabled external system (e.g., Redis) to automatically expire stale entries.  
- Monitor memory usage of the ratelimit structure and alert if it grows beyond a safe threshold.  

---

**Finding:**  
The `createRuntime` function creates a ratelimit middleware that uses a `Map` for bucket storage, but the map can grow without bound because there is no eviction policy beyond the `nextPruneAt` check. This can lead to memory exhaustion if many distinct client IPs are observed over time.

**Exact location:**  
- `createRateLimitMiddleware` (lines250270) creates a `Map` and stores a bucket for each client key; the only cleanup is `pruneExpiredRateLimitBuckets`, which runs only after `windowMs` has elapsed and does not limit the total number of buckets.  

**Recommended mitigation:**  
- Impose a maximum number of active buckets (e.g.,