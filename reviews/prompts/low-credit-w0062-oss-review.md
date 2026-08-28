# Low-Credit W-0062 OSS Review Prompt

You are an independent OSS reviewer for the Dizzy/clawd repository.

Review only the supplied files. Do not assume access to the whole repo. Do not suggest edits outside the named W-0062 planning lane unless you identify a blocker that makes the lane unsafe.

## Current Goal

Help preserve momentum while paid model credits are scarce.

The next likely slice is W-0062: an Anti-Slop Overlay that may eventually provide advisory warnings for:

- sycophancy or fake affirmation filler;
- promotional or generic AI-writing tells;
- fake symmetry and over-rehearsed governance prose;
- unthemed decorative gradients or visual slop;
- hard-fail boundaries that must remain distinct from advisory yellow warnings.

## Hard Boundaries

- This is review/planning only.
- Do not propose commits, pushes, resets, cleaning, staging, broad reformatting, or public publication.
- Do not promote `reviews/prompts/realness-pass.md` into runtime policy.
- Do not wire W-0062 into `lib/anti_slop_scanner.mjs`, `scripts/maintain.mjs`, `scripts/safety_checks.mjs`, or dashboard files yet.
- Dashboard/runtime/prototype changes are out of scope.
- Model output is a claim source, not authority.

## Questions To Answer

1. What is the smallest useful W-0062 spec that can be reviewed before implementation?
2. Which proposed checks must be hard failures, and which must stay advisory yellow warnings?
3. What false positives would make this scanner annoying or theatrical?
4. What evidence should Antigravity produce before writing scanner code?
5. What is one under-asked assumption that could derail this slice?
6. What exact files should remain off-limits for the first candidate?

## Output Format

Write concise Markdown with these sections:

## Verdict

Say whether W-0062 should proceed as a spec slice, implementation slice, or stay parked.

## Accepted Criteria

List only criteria you would allow Antigravity to implement later.

## Rejected Or Deferred Ideas

Separate rejected ideas from deferred ideas.

## False-Positive Risks

Name the likely annoying or misleading scanner cases.

## Off-Limits Files

List exact files or directories that should not be edited in the first candidate.

## Under-Asked Assumption

Give one assumption and the smallest local check that could disprove it.

## Antigravity Hand-Off

Give the smallest next instruction for Antigravity. It must be review/spec-oriented unless the supplied packet explicitly authorizes implementation.
