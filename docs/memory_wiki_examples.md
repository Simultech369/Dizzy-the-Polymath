# Memory Wiki Examples

Purpose: show how the current memory wiki lifecycle becomes readable Markdown state without turning examples into live memory claims.

These examples are proof-bound to `scripts/cognitive_memory_engine_test.mjs` and `scripts/memory_wiki_adapter_test.mjs`. The tests use temporary directories, so this document does not claim that a live `memory/wiki/` tree is checked into the repository.

## Boundary

| Layer | Owns | Writes |
| --- | --- | --- |
| `lib/cognitive_memory_engine.mjs` | Capture classification, duplicate consolidation, trust-zone retrieval, conflict reconciliation, confidence decay, and A2A memory update envelopes | Compiled traversal wiki pages under `memory/wiki/index.md`, `memory/wiki/entries/*.md`, `memory/wiki/SCHEMA.md`, and `memory/wiki/log.md` when configured with a wiki root |
| `lib/memory_wiki_adapter.mjs` | Path-confined Markdown file I/O for category-partitioned notes and frontmatter safety | Human-curated adapter pages under `memory/wiki/{preferences,projects,models,archive}/` |

The engine owns memory policy and scoring. The adapter owns filesystem safety for Markdown note I/O. Keeping them separate prevents a frontmatter or path-handling change from silently becoming memory-policy authority.

## Lifecycle Flow

The focused engine test creates a temporary wiki root and runs the five lifecycle stages against sample operator-memory content.

| Stage | Example input | Markdown evidence | Receipt evidence |
| --- | --- | --- | --- |
| Capture | `engine.capture({ content: "Always use absolute paths in handoff artifacts for Josh.", canonicalKey: "handoff-path-style" })` | Writes `index.md`, `SCHEMA.md`, `log.md`, and `entries/handoff-path-style.md` | Capture receipt uses `dizzy.cognitive_memory_receipt.v1` and `storage: "markdown_wiki"` |
| Consolidate | A second capture with the same canonical key and compatible polarity | Updates `entries/handoff-path-style.md` with a `Consolidated note (...)` block and increments reinforcement | Consolidate receipt names the target memory and wiki page |
| Retrieve | `engine.retrieve("handoff absolute paths testing public collaborator", { trustZone: "private_self" })` | Returns `wiki_page: "entries/handoff-path-style.md"` and updates access metadata through a save | Retrieve receipt records query hash, `traversal_index: "index.md"`, returned page paths, and memory IDs |
| Reconcile | A contradictory capture with the same canonical key, such as "Do not use absolute paths in handoff artifacts." | Does not overwrite the active page; appends `reconcile | flag_conflict` to `log.md` | Reconcile receipt returns `flag_conflict`, conflict count, conflicting memory IDs, and wiki page references |
| Decay | `engine.decay({ now: futureDate })` after an expiring memory passes its expiry window | Marks expired pages as `Status: archived` and lists them under `## Archived Memories` in `index.md` | Decay receipt records decayed and archived counts |

## Example Page Shape

After capture, the engine compiles a transparent page shape like this:

```markdown
<!-- dizzy-memory-metadata
{
  "schema_version": "dizzy.cognitive_memory.v1",
  "memory_id": "mem_...",
  "memory_class": "durable",
  "canonical_key": "handoff-path-style",
  "trust_zone": "private_self",
  "sensitivity_tier": "normal",
  "status": "active",
  "normalized_content_sha256": "..."
}
-->

# handoff-path-style

Status: active
Class: durable
Trust zone: private_self
Confidence: 0.820000

## Content

Always use absolute paths in handoff artifacts for Josh.

## Traversal Links

- [Wiki Index](../index.md)
- [Wiki Log](../log.md)
```

The Markdown page is readable state. The receipt is the audit record. The page can be reviewed in a normal diff, while the receipt lets the council verify what operation produced or touched it.

## Adapter Example

The adapter test covers a separate path: direct category note I/O with frontmatter injection safety.

```js
const adapter = new MemoryWikiAdapter(tempDir);
const writtenPath = adapter.writeMemory({
  memory_id: "mem_handoff_rules",
  category: "preference",
  title: "handoffs",
  memory_class: "durable",
  confidence: 0.95,
  content: "Always use absolute paths when passing file targets to Codex or Antigravity.",
});
const hydratedMemory = adapter.readMemory(writtenPath);
```

That path proves directory initialization, safe title slugging, frontmatter value escaping, roundtrip reads, and rejection of reads outside the configured wiki root. It does not perform capture classification, retrieval scoring, trust-zone filtering, reconciliation, decay, or A2A export.

## Verification

Run these from the repository root:

```powershell
npm run test:cognitive-memory
npm run test:memory-wiki
npm run check:docs
npm run test:public-view-readiness
```
