# Low-Churn Repo Scan

Date: 2026-05-06

Purpose: review `teleclaw-agent`, `mythos-router`, and `u-Operating-System` against the current Dizzy upgrade path, while holding two constraints fixed:

- minimize churn
- do not turn judgment / practices into an over-structured subsystem

## Bottom line

The strongest next imports are not grand new layers.

They are small, targeted mechanics:

1. tighter tool selection
2. better drift detection
3. lighter session compaction
4. provenance-friendly memory indexing
5. optional adaptive routing telemetry

Anything beyond that starts to look like architecture cosplay.

## Repo verdicts

## 1. `thewaltero/mythos-router`

Overall fit: high

Why:

- local-first
- cares about drift
- distinguishes authoritative memory from derivative index
- has concrete verification and fallback logic
- useful without forcing a new worldview onto Dizzy

### Best ideas to borrow

#### A. Authority / derivative split for memory

Core idea:

- `MEMORY.md` is the authority
- SQLite/FTS index is disposable derivative infrastructure

Why this matters:

- it preserves inspectability
- it reduces fear around richer retrieval infrastructure
- it fits Dizzy's "written memory is real memory" doctrine

Low-churn application:

- keep Markdown memory authoritative
- allow a rebuildable local index for retrieval
- do not let the index become the source of truth

This is probably the cleanest conceptual upgrade from this repo.

#### B. Drift detection against remembered file state

Core idea:

- if memory says a file exists or was changed, verify whether reality still matches

Why this matters:

- it fights stale context
- it helps prevent false confidence from old memory artifacts

Low-churn application:

- add a light verification pass for memory references
- especially useful once durable memory starts storing more repo facts or file-derived claims

This is stronger than generic "memory review" because it is reality-checked.

#### C. Session resume and graceful save

Core idea:

- when budget or interruption happens, save usable state instead of just dying

Why this matters:

- reduces work loss
- reduces over-compression pressure
- fits long-running coding sessions

Low-churn application:

- a simpler version of "session persistence" could be useful even without copying the full CLI model

#### D. Adaptive provider routing telemetry

Core idea:

- route across providers using observed latency / success / cost

Why this matters:

- this overlaps directly with existing Dizzy routing interests

Low-churn application:

- do not copy the whole orchestration engine
- do log enough data to later make routing less impressionistic

This aligns with the earlier `modelab` and `context-kernel` notes.

### What not to import

#### Strict Write Discipline as a whole doctrine

Reason:

- parts are useful
- the full `[FILE_ACTION]` protocol is too invasive for current Dizzy needs

Import the verification instinct, not the whole ritual.

#### Commit-everything-to-`MEMORY.md` culture

Reason:

- helpful in a coding CLI
- too noisy for Dizzy's broader memory goals

Dizzy needs stronger curation than Mythos does.

## 2. `teleclawagent/teleclaw-agent`

Overall fit: medium to low

Why:

- technically competent
- but most of the repo is warped around Telegram, TON, wallets, OTC gating, and very large tool catalogs

That means a lot of its machinery solves its own problem, not Dizzy's.

### Best ideas to borrow

#### A. Tool RAG / semantic tool filtering

Core idea:

- do not send the full tool catalog every turn
- retrieve the most relevant tools per message

Why this matters:

- lower prompt load
- better tool selection
- lower confusion in tool-heavy environments

Low-churn application:

- this is relevant if Dizzy's capability surface keeps expanding
- especially useful for MCP-heavy futures

This is the best Teleclaw idea for Dizzy by a wide margin.

#### B. Utility model split

Core idea:

- use a cheaper model for summarization / compaction / utility work

Why this matters:

- reduces cost
- reduces waste on background cognition

Low-churn application:

- keep one "main reasoning" path
- add one cheap utility path for compaction, summarization, maybe indexing

#### C. Session reset policy

Core idea:

- sessions should not expand forever
- idle expiry and scheduled reset are acceptable

Why this matters:

- stale sessions create degraded context quality

Low-churn application:

- only partially useful
- Dizzy likely wants lighter expiry logic, not hard daily reset culture

### What not to import

#### Teleclaw's core ontology

Reason:

- Telegram bot
- TON agent
- token-gated tool economy
- wallet and OTC workflows

This is mostly irrelevant to Dizzy unless you want to move hard into crypto-agent infrastructure.

#### Its memory worldview wholesale

Reason:

- more operationally useful than philosophically coherent
- better as a bag of tricks than as a model

## 3. `u-Operating-System`

Overall fit: low

Important correction:

- as of 2026-05-06, this is a GitHub organization, not a single repo
- public repos are:
  - `basescan-mcp-server`
  - `universal-base-migration`
  - `lp-staking-dashboard`

Current relevance:

- mostly Base / DeFi / migration tooling
- little evidence yet of a mature "browser-based OS where humans and AI work as equal partners" codebase in public

Conclusion:

- interesting brand direction
- weak current signal for Dizzy improvement

Do not over-read it.

## Updated recommendations under low-churn constraint

### Keep the judgment / practices layer light

This part of your instinct is right.

A heavily structured `judgment.yaml` clone is probably the wrong move for Dizzy right now.

Better approach:

- keep practices human-readable
- keep them sparse
- write only repeat-use heuristics
- avoid turning them into bureaucratic metadata

Good forms:

- short curated notes in `memory/topics/`
- or very light tagged entries in a future wiki/practices namespace

Bad form:

- dozens of rigid fields pretending to formalize wisdom

### Highest-value low-churn additions

#### 1. Tool filtering before prompt assembly

Source:

- Teleclaw `tool_rag`

Why first:

- prompt pressure grows fast
- this can help without changing memory ontology

#### 2. Authority-first memory with disposable retrieval index

Source:

- Mythos Router

Why first:

- gives richer recall without sacrificing inspectability

#### 3. Lightweight drift check for memory-backed repo facts

Source:

- Mythos `verify`

Why first:

- stale memory is worse than missing memory

#### 4. Cheap utility path for compaction and summarization

Source:

- Teleclaw utility-model split
- Mythos dream / compression path

Why first:

- lowers cost
- avoids overusing main reasoning model on janitorial work

#### 5. Minimal routing telemetry

Source:

- Mythos orchestrator
- earlier `modelab` notes

Why first:

- provides evidence for later routing changes
- does not require full adaptive routing now

## What should still wait

### A formal judgment engine

Not needed yet.

The repo already has doctrine and governance documents.
Adding a rigid decision-rule layer too early would create clutter.

### A giant memory schema explosion

Not needed yet.

The gravity-well idea is good, but it should enter through a few fields and states, not through ontology maximalism.

### Big imported agent frameworks

Not needed.

Dizzy already has a coherent local architecture.
The problem is mostly interface tightening, not missing grand theory.

## Strongest practical sequence now

1. add a note or implementation plan for tool filtering
2. define authority-vs-derivative memory indexing for Dizzy
3. add a lightweight drift-check concept for memory-backed repo facts
4. add cheap utility-model pathways for compaction
5. keep practices sparse and prose-first

That sequence improves capability without turning the repo inside out.
