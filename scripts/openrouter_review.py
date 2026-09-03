#!/usr/bin/env python3
"""
openrouter_review.py
--------------------
Gathers code and documentation context files from the Dizzy repository
and streams an independent review from a free OpenRouter model.

Usage:
  python scripts/openrouter_review.py --output reviews/review_v1.md

Authentication:
  Set OPENROUTER_API_KEY or OPENAI_COMPAT_API_KEY in the environment.
  Do not pass API keys as command-line arguments; shell and process history can retain them.
"""

import os
import sys
import json
import urllib.request
import urllib.error
import argparse
from urllib.parse import urlparse

# Default files to read based on context-packs/repo-review.md
DEFAULT_FILES = [
    "README.md",
    "REPO_GUIDE.md",
    "FILE_ROLES.md",
    "DESIGN.md",
    "NEXT.md",
    "package.json",
    "agent_server.mjs",
    "worker.mjs",
    "PROTOCOL.md",
    "LEGAL-GUARDRAILS.md",
    "INTERACTION_NORMS.md",
    "MEMORY_OWNERSHIP.md",
    "DRIFT_AUDIT.md",
    "PROMPT_PACKS.md",
    "PROMPT_CORE.md",
    "PROMPT_MODES.md",
    "CONSTITUTION.md",
    "lib/queue.mjs",
    "lib/sqlite_operational_store.mjs",
    "scripts/telegram_notify_drain.mjs",
    "scripts/telegram_relay.mjs",
    "scripts/backup_restore.mjs"
]

def load_env(repo_root):
    env_path = os.path.join(repo_root, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    # Set env var if not already set by system environment
                    if key not in os.environ:
                        os.environ[key] = value

class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Fail closed so credentials and repository context never cross origins implicitly."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def build_chat_completions_url(parsed_url):
    if parsed_url.query or parsed_url.fragment:
        raise ValueError("base URL must not include a query string or fragment")
    path = (parsed_url.path or "").rstrip("/") + "/chat/completions"
    return parsed_url._replace(path=path, query="", fragment="").geturl()

def main():
    parser = argparse.ArgumentParser(description="Run an independent code/doctrine review of the Dizzy repository using OpenRouter.")
    parser.add_argument("--model", type=str, help="OpenRouter model to use (default: openrouter/free or environment value)")
    parser.add_argument("--url", type=str, default="https://openrouter.ai/api/v1", help="API Base URL (default: https://openrouter.ai/api/v1)")
    parser.add_argument("--output", type=str, help="Path to save the review output markdown file")
    parser.add_argument("--prompt-file", type=str, help="Replace the built-in review instructions with a UTF-8 prompt file")
    parser.add_argument("--add-file", action="append", default=[], help="Add specific files to the review context")
    parser.add_argument("--exclude-file", action="append", default=[], help="Exclude files from the default list")
    parser.add_argument("--no-default-files", action="store_true", help="Include only files supplied with --add-file")
    parser.add_argument("--list-files", action="store_true", help="List files that will be included in the context and exit")
    parser.add_argument("--force", action="store_true", help="Force upload to non-OpenRouter URLs without prompting")
    parser.add_argument("--load-env", action="store_true", help="Explicitly load credentials from the repository .env file")

    args = parser.parse_args()

    # Find repository root directory
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if args.load_env:
        load_env(repo_root)

    # Assemble and validate file list
    files_to_read = []
    if not args.no_default_files:
        for f in DEFAULT_FILES:
            if f not in args.exclude_file:
                files_to_read.append(f)
    for f in args.add_file:
        if f not in files_to_read:
            files_to_read.append(f)

    valid_files = []
    for f in files_to_read:
        abs_path = os.path.join(repo_root, f)
        if os.path.exists(abs_path):
            valid_files.append(f)
        else:
            print(f"Warning: File '{f}' not found, skipping.", file=sys.stderr)

    if args.list_files:
        print("Files to be included in the review context:")
        for f in valid_files:
            print(f"  - {f}")
        sys.exit(0)

    # Destination URL security check
    try:
        parsed_url = urlparse(args.url)
        scheme = (parsed_url.scheme or "").lower()
        hostname = parsed_url.hostname or ""
        username = parsed_url.username
        password = parsed_url.password
    except Exception as e:
        print(f"Error: Malformed destination URL '{args.url}': {e}", file=sys.stderr)
        sys.exit(1)

    # 1. Unconditional Rejections (non-HTTPS, user-info, malformed/empty host)
    if not hostname:
        print(f"Error: Invalid or missing host in destination URL '{args.url}'", file=sys.stderr)
        sys.exit(1)

    if scheme != "https":
        print(f"Error: Transport security violation. Destination URL must use HTTPS: '{args.url}'", file=sys.stderr)
        sys.exit(1)

    if username is not None or password is not None:
        print(f"Error: User-info credentials detected in destination URL. This is blocked for security.", file=sys.stderr)
        sys.exit(1)

    is_openrouter = hostname == "openrouter.ai"

    try:
        request_url = build_chat_completions_url(parsed_url)
    except ValueError as e:
        print(f"Error: Invalid destination base URL '{args.url}': {e}", file=sys.stderr)
        sys.exit(1)

    # 2. Key Resolution and Allowlisting
    if is_openrouter:
        api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_COMPAT_API_KEY")
    else:
        # Non-OpenRouter host: restrict to OPENAI_COMPAT_API_KEY only!
        api_key = os.environ.get("OPENAI_COMPAT_API_KEY")
        if not api_key:
            if os.environ.get("OPENROUTER_API_KEY"):
                print("Error: For non-OpenRouter destinations, only OPENAI_COMPAT_API_KEY is allowed.", file=sys.stderr)
                print("OPENROUTER_API_KEY cannot be sent to a custom endpoint.", file=sys.stderr)
                sys.exit(1)

        print(f"\n[SECURITY WARNING] Destination URL host '{hostname}' is not an openrouter.ai host.", file=sys.stderr)
        print("This will upload the repository context and send your OPENAI_COMPAT_API_KEY to this custom endpoint.", file=sys.stderr)
        print("\n::warning::Files to be uploaded:", file=sys.stderr)
        for f in valid_files:
            print(f"  - {f}", file=sys.stderr)
        print(f"\nTarget URL: {args.url}\n", file=sys.stderr)

        if not args.force:
            if sys.stdin and sys.stdin.isatty():
                try:
                    choice = input("Are you sure you want to proceed? (y/N): ").strip().lower()
                    if choice != 'y':
                        print("Execution aborted by operator.", file=sys.stderr)
                        sys.exit(1)
                except (KeyboardInterrupt, EOFError):
                    print("Error: Non-interactive execution blocked for non-OpenRouter destination URL.", file=sys.stderr)
                    print("Use the --force option to bypass this check.", file=sys.stderr)
                    sys.exit(1)
            else:
                print("Error: Non-interactive execution blocked for non-OpenRouter destination URL.", file=sys.stderr)
                print("Use the --force option to bypass this check.", file=sys.stderr)
                sys.exit(1)

    if not api_key:
        print("Error: No API key found.", file=sys.stderr)
        if is_openrouter:
            print("Please set OPENROUTER_API_KEY or OPENAI_COMPAT_API_KEY in the environment.", file=sys.stderr)
        else:
            print("Please set OPENAI_COMPAT_API_KEY in the environment.", file=sys.stderr)
        print("Do not pass API keys as command-line arguments; they can linger in shell/process history.", file=sys.stderr)
        sys.exit(1)

    # Resolve model
    model = args.model or os.environ.get("OPENAI_COMPAT_MODEL") or "openrouter/free"

    # Assemble system prompt
    system_prompt = """You are an independent senior software engineering, security, reliability, privacy, and architecture reviewer.
Perform a strict, comprehensive review of the Dizzy repository.

Repository: https://github.com/Simultech369/Dizzy-the-Polymath
Branches: experiments and main
Treat tests as claims requiring verification. Do not assume recommendations are correct merely because the test suite passes.
Do NOT attempt to modify the repository.

IMPORTANT REVIEW METHOD:
1. Inspect the complete repository files provided.
2. Read relevant code, not only immediate lines.
3. Treat tests as claims requiring verification.
4. Distinguish: Verified defect, Plausible risk, Policy disagreement, Future scaling concern, Intentional and adequately documented tradeoff.
5. Look for problems outside the diff that become relevant because of proposed changes.
6. Do not let specific focus areas prevent you from finding unrelated material defects.

PRIMARY AREAS TO INSPECT:
A. Non-Lossy Notifications & Queue Durability (lib/queue.mjs, agent_server.mjs, scripts/telegram_notify_drain.mjs):
   - Examine rPush vs lPush behavior, peek/ack endpoints, race conditions on batch trims, notification loss under failure, and Telegram drain safety.
B. Dashboard Security (agent_server.mjs):
   - Examine XSS escaping coverage, client-side vs server-side protection, and rendering of dynamic repository/metadata content.
C. Identity & Authentication Hardening (agent_server.mjs, RUNBOOK.md):
   - Examine DIZZY_ENFORCE_IDENTITY_HEADERS, scoped tokens (DIZZY_EXECUTE_TOKEN, DIZZY_NOTIFY_TOKEN, DIZZY_AUTH_TOKEN), proxy header trust model, and routing isolation.
D. Telegram Relay Security (scripts/telegram_relay.mjs):
   - Examine AUTO_BIND_NONCE generation and binding logic.
E. SQLite Serverless Operational Mode (lib/sqlite_operational_store.mjs, agent_server.mjs, worker.mjs):
   - Examine full job schema, transaction safety, claimNextJob, appendConversationEvent, recovery of stale jobs, concurrency behavior, WAL configuration, and migration story from Redis.
F. Backup, Restore & Repair (scripts/backup_restore.mjs, JSONL handling paths):
   - Examine backup (WAL flush), restore safety, repair of trailing corruption, and overall recovery story.
G. Continued Core Areas (Reconciliation, Provider Fallback, Public/Private Policy, Secret Handling, Memory Graph):
   - Re-validate invariants from prior reviews now that SQLite is optionally live and new auth surfaces exist.
H. Documentation and Architecture Direction (DESIGN.md, RUNBOOK.md, NEXT.md, README.md, MEMORY_OWNERSHIP.md, state.json).

BIAS AND BLIND-SPOT ANALYSIS:
Explicitly evaluate these possible biases:
- Repository consistency mistaken for reliability.
- Local verification vs production concurrency (especially SQLite).
- Proxy configuration traps.
- Serverless enthusiasm vs multi-worker realities.
- Backup/repair operator UX.
- Complexity growth from dual backends.
Ask yourself:
- What important failure would these authors be least likely to test?
- What happens with two workers in SQLite mode under crashes?
- What happens on proxy misconfiguration with identity headers?
- Where do multiple authorities still exist?
- What would surprise an unfamiliar operator during recovery?

Ensure your output matches the requested Markdown Handoff format exactly."""

    if args.prompt_file:
        prompt_path = os.path.abspath(args.prompt_file)
        try:
            if os.path.getsize(prompt_path) > 256 * 1024:
                print("Error: Prompt file exceeds the 256 KiB safety limit.", file=sys.stderr)
                sys.exit(1)
            with open(prompt_path, "r", encoding="utf-8") as fh:
                system_prompt = fh.read().strip()
        except (OSError, UnicodeError) as e:
            print(f"Error: Unable to read prompt file '{args.prompt_file}': {e}", file=sys.stderr)
            sys.exit(1)
        if not system_prompt:
            print("Error: Prompt file is empty.", file=sys.stderr)
            sys.exit(1)

    # Read file content and assemble user message
    user_content_parts = ["Below is the context of the Dizzy repository files under review:\n\n"]
    total_chars = 0
    for f in valid_files:
        abs_path = os.path.join(repo_root, f)
        try:
            with open(abs_path, "r", encoding="utf-8") as fh:
                content = fh.read()
                user_content_parts.append(f"### File: {f}\n```\n{content}\n```\n\n")
                total_chars += len(content)
        except Exception as e:
            print(f"Error reading file '{f}': {e}", file=sys.stderr)

    user_content = "".join(user_content_parts)
    
    # Append instructions at the end to prevent prompt dilution in long context.
    user_content += "\n\n=== END OF FILE CONTEXT ===\n\n"
    if args.prompt_file:
        user_content += "Follow the supplied system instructions using only evidence available in the provided repository context.\n"
    else:
        user_content += "Based on the repository files provided above, perform the strict, critical audit now.\n"
        user_content += "OUTPUT FORMAT:\n"
        user_content += "Create a complete Markdown handoff suitable for giving directly to Codex.\n"
    legacy_output_start = len(user_content)
    user_content += "Title: # Engineering, Security, Reliability & Architecture Review Handoff\n\n"
    user_content += "Include the following sections:\n"
    user_content += "## Review Metadata\n"
    user_content += "- Repository: https://github.com/Simultech369/Dizzy-the-Polymath\n"
    user_content += "- Branches: experiments and main\n"
    user_content += "- Test commands and results: (npm test and npm run maintain, which are passing)\n"
    user_content += "- Environment and Node version\n"
    user_content += "- Files or behavior that could not be fully verified\n\n"
    user_content += "## Findings\n"
    user_content += "Order findings by severity:\n"
    user_content += "### [P0] Critical\n"
    user_content += "### [P1] High\n"
    user_content += "### [P2] Medium\n"
    user_content += "### [P3] Low\n\n"
    user_content += "For every finding provide:\n"
    user_content += "- Short title\n"
    user_content += "- Classification: verified defect, plausible risk, policy disagreement, or future concern\n"
    user_content += "- File and line reference\n"
    user_content += "- Concrete failure or attack scenario\n"
    user_content += "- Evidence or reproduction steps\n"
    user_content += "- Why current tests do not catch it\n"
    user_content += "- Smallest sound remediation\n"
    user_content += "- Confidence: high, medium, or low\n"
    user_content += "- Whether it should block further implementation\n\n"
    user_content += "If no findings exist at a severity, explicitly say 'None.'\n\n"
    user_content += "## Confirmed Strengths\n\n"
    user_content += "## Contentions and Policy Questions\n\n"
    user_content += "## SQLite Recommendation\n"
    user_content += "(Choose one: Promote / Revise and retest / Keep experimental / Delete. Explain and specify minimum evidence needed.)\n\n"
    user_content += "## Missing Failure Experiments\n\n"
    user_content += "## Bias and Blind-Spot Assessment\n\n"
    user_content += "## Recommended Iterations 18–20\n"
    user_content += "For each iteration include:\n"
    user_content += "- Objective\n"
    user_content += "- Verified findings addressed\n"
    user_content += "- Acceptance criteria\n"
    user_content += "- Stop or rollback condition\n"
    user_content += "- What should remain explicitly deferred\n\n"
    user_content += "## Final Verdict\n"
    user_content += "- Whether current HEAD is a sound checkpoint\n"
    user_content += "- Whether implementation should continue immediately or pause for correction\n"
    user_content += "- Top three next actions\n"
    user_content += "- Overall confidence\n\n"
    user_content += "REVIEW DISCIPLINE:\n"
    user_content += "- Do not report style preferences as defects.\n"
    user_content += "- Do not claim exploitation without a credible path.\n"
    user_content += "- Do not assume tests prove their own adequacy.\n"
    user_content += "- Clearly label inferences.\n"
    user_content += "- Prefer minimal, reversible remediation.\n"
    user_content += "- Recommend deletion when complexity does not earn its cost.\n"
    user_content += "- Include 'no material issue found' for areas you examined successfully.\n"
    if args.prompt_file:
        user_content = user_content[:legacy_output_start]

    print(f"Loaded {len(valid_files)} files.")
    print(f"Total character count: {total_chars} (~{total_chars // 4} tokens).")
    print(f"Targeting model: {model}")
    print(f"Using endpoint: {args.url}")
    print("Initiating independent review via OpenRouter...")
    print("-" * 80)

    # Make OpenRouter Request
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "stream": True
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://github.com/Simultech369/Dizzy-the-Polymath",
        "X-Title": "Dizzy Repository Independent Reviewer",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }

    req = urllib.request.Request(
        request_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    output_buffer = []

    try:
        opener = urllib.request.build_opener(NoRedirectHandler())
        with opener.open(req) as response:
            for line_bytes in response:
                line = line_bytes.decode("utf-8").strip()
                if not line:
                    continue
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data_json = json.loads(data_str)
                        if "error" in data_json:
                            print(f"\nAPI Error: {data_json['error']}", file=sys.stderr)
                            break
                        choices = data_json.get("choices", [])
                        if choices:
                            choice = choices[0]
                            delta = choice.get("delta", {})
                            content_part = delta.get("content", "")
                            if content_part:
                                print(content_part, end="", flush=True)
                                output_buffer.append(content_part)
                    except Exception:
                        pass
            print() # Ending newline
    except urllib.error.HTTPError as e:
        if 300 <= e.code < 400:
            print(f"\nRedirect blocked (HTTP {e.code}). Re-authorize the final provider URL explicitly.", file=sys.stderr)
            sys.exit(1)
        print(f"\nHTTP Error {e.code}: {e.reason}", file=sys.stderr)
        try:
            error_body = e.read().decode("utf-8")
            print(f"Response body: {error_body}", file=sys.stderr)
        except Exception:
            pass
        sys.exit(1)
    except Exception as e:
        print(f"\nError contacting API: {e}", file=sys.stderr)
        sys.exit(1)

    # Save to file if output option is set
    if args.output and output_buffer:
        try:
            out_path = os.path.abspath(args.output)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as out_file:
                out_file.write("".join(output_buffer))
            print(f"\n[Success] Review successfully saved to: {args.output}")
        except Exception as e:
            print(f"\nError saving output to '{args.output}': {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
