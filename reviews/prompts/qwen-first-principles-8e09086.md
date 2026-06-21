You are performing an independent, read-only review of the Dizzy repository at commit 8e0908664089e91e8c7de881d48da1ac99f121ed on branch experiments. The comparison baseline is main at 39a89b7.

Start from first principles. Do not assume that architectural claims in the documentation are true.

Reconstruct:

1. What Dizzy is intended to be.
2. What actually executes at runtime.
3. Which files have behavioral authority and which are descriptive or aspirational.
4. How requests, prompts, tools, memory, persistence, queues, workers, and operator-facing surfaces connect.
5. Which safety and durability guarantees are enforced in code, and which exist only in documentation or tests.

Produce only:

A. A concise first-principles description of the real system.
B. A runtime and authority map of principal components and trust boundaries.
C. Important disagreements between documentation, tests, and implementation.
D. Up to five high-confidence risks or architectural weaknesses.
E. Areas requiring deeper review next.

Support every material claim with exact file paths and symbols or line numbers. Separate verified facts from inference. Do not report generic possibilities without a plausible path in this repository. Say when evidence is insufficient. Do not propose large redesigns. Keep the response under approximately 1,500 words.

Do not modify the repository. Your purpose is to establish an accurate shared model of Dizzy before a deeper review.
