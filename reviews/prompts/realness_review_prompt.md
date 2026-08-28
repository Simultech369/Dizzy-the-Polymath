# Realness & Anti-Rehearsal Review Prompt

Use this prompt to run a "Realness Lens" pass across the Dizzy (clawd) repository using local OSS models (`qwen2.5-coder`, `deepseek-coder-v2`, `gemma3`, `llama3.1`).

---

## 🎯 Review Stance: Un-Rehearsed & Pattern-Breaking

Do NOT provide a polished, middle-management summary. Do NOT use fake 3x3 table symmetry, polite preamble filler ("Great repo!"), or canned wrap-ups.

Evaluate the repository as a real operator looking for **overbuilt theater vs. genuine local leverage**.

---

## 🔍 Required Review Questions

### 1. Where does the repo feel performative or overbuilt?
* Identify documentation or structural files that feel rehearsed, academic, or heavy on specialized jargon without adding runtime leverage.
* Call out places where 5 lines of code or prose were expanded into 50 lines of policy theater.

### 2. Where is the real working core?
* Strip away the workshop notes and review artifacts. What are the 3-4 files that actually matter to running a bounded, local-first assistant?

### 3. What design tensions are being avoided or papered over?
* Where is the codebase pretending to have solved a problem (e.g. storage backends, memory decay, context compression) that is actually still messy or unresolved?

### 4. Pattern-Breaker Diagnosis
* What is the single biggest "slop tell" in the current repository layout or documentation?

---

## 🚫 Hard Constraints
* **No Marketing Talk**: No words like "synergy", "robust ecosystem", "game-changing".
* **No Fake Lists**: If only 1 thing is broken, list 1 thing. Do not pad it to 3.
* **Direct Voice**: Write the way a developer talks when reviewing a pull request at 1 AM.
