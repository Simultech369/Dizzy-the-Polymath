#!/usr/bin/env python3
"""
openrouter_review.py
--------------------
Gathers code and documentation context files from the Dizzy repository
and streams an independent review from a free OpenRouter model.

Usage:
  python scripts/openrouter_review.py --output reviews/review_v1.md
"""

import os
import sys
import json
import urllib.request
import urllib.error
import argparse

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
    "CONSTITUTION.md"
]

def main():
    parser = argparse.ArgumentParser(description="Run an independent code/doctrine review of the Dizzy repository using OpenRouter.")
    parser.add_argument("--model", type=str, help="OpenRouter model to use (default: openrouter/free or environment value)")
    parser.add_argument("--key", type=str, help="OpenRouter API Key (default: OPENROUTER_API_KEY or OPENAI_COMPAT_API_KEY)")
    parser.add_argument("--url", type=str, default="https://openrouter.ai/api/v1", help="API Base URL (default: https://openrouter.ai/api/v1)")
    parser.add_argument("--output", type=str, help="Path to save the review output markdown file")
    parser.add_argument("--add-file", action="append", default=[], help="Add specific files to the review context")
    parser.add_argument("--exclude-file", action="append", default=[], help="Exclude files from the default list")
    parser.add_argument("--list-files", action="store_true", help="List files that will be included in the context and exit")

    args = parser.parse_args()

    # Find repository root directory
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Assemble and validate file list
    files_to_read = []
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

    # Get API key
    api_key = args.key or os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_COMPAT_API_KEY")
    if not api_key:
        print("Error: No API key found.", file=sys.stderr)
        print("Please set the OPENROUTER_API_KEY or OPENAI_COMPAT_API_KEY environment variable,", file=sys.stderr)
        print("or pass your key via the --key parameter.", file=sys.stderr)
        sys.exit(1)

    # Resolve model
    model = args.model or os.environ.get("OPENAI_COMPAT_MODEL") or "openrouter/free"

    # Assemble system prompt
    system_prompt = """You are an independent, highly critical senior software architect and governance auditor.
Your task is to review the codebase and documentation of the 'Dizzy' repository and perform a thorough doctrine-and-code compliance review.

Dizzy is a session-instantiated reasoning system with written continuity. It has a strict Constitutional Kernel, defined file roles, and specific rules about how experimental features are promoted, how memory is metabolized, and how trust zones are maintained.

Review the provided repository contents and identify issues across:
1. **Scope Separation / Scoped Enqueueing**:
   - Ensure same key + different client/service does not deduplicate (scoped separation).
   - Ensure experimental work is promoted only as small, reviewed, independently tested mechanisms.
2. **Clean Naming & Labeling**:
   - Verify that all traces of 'a0x' language have been removed.
   - Verify that 'W-0044' and 'W-0045' numbering prefixes have been scrubbed from code comments, documentation, and references in favor of clear descriptive names.
   - Check for other annoying hardcoded prefixes, tracking IDs, or planning theater.
3. **Public vs. Private Isolation**:
   - Ensure local-only directories (like `handoff/`) are gitignored and not committed.
   - Ensure public/client-facing surfaces do not leak private memory, operator calibration, or sensitive context.
4. **Code vs. Doctrine Drift**:
   - Verify if the runtime code enforces what the documents claim.
   - Are there docs claiming behavior that the runtime code does not enforce?
5. **Memory Ownership & Mutation Safety**:
   - Verify that memory-like durable surfaces have declared owners.
   - Look for code paths mutating memory or state without clear ownership.
6. **Invariants and Queue/Runtime safety**:
   - Check the dispatching and worker layers for Redis Lua errors, duplicate ready entries, or missing job mappings.
   - Ensure robustness of job/idempotency mapping TTLs and schema validations.
7. **External Project References**:
   - Ensure external project patterns or references (e.g. Memory OS, Samantha, Icarus, Agent OSS) are consolidated only within `REFERENCE_PATTERNS.md` or design pointers in `DESIGN.md`.

Output Shape:
- Start directly with 'Findings:' (findings first).
- For each issue:
  * severity: (Critical / Warning / Info)
  * file and line: (when available)
  * concrete failure mode: (detailed explanation of the bug or policy violation)
  * suggested fix: (concrete code/doc change)
- Then provide:
  * open questions
  * test gaps
  * short summary of recommendations

Be extremely direct, concise, and focused on technical/doctrinal accuracy. Do not use generic filler language or conversational preambles."""

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
        args.url + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    output_buffer = []

    try:
        with urllib.request.urlopen(req) as response:
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
                        choice = data_json.get("choices", [{}])[0]
                        delta = choice.get("delta", {})
                        content_part = delta.get("content", "")
                        if content_part:
                            print(content_part, end="", flush=True)
                            output_buffer.append(content_part)
                    except json.JSONDecodeError:
                        pass
            print() # Ending newline
    except urllib.error.HTTPError as e:
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
