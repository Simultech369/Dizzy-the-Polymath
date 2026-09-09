# Cognitive Memory Engine and Memory Wiki Lifecycle

Purpose: document the current, test-backed memory lifecycle and its Markdown wiki projection without turning design intent, temporary fixtures, or mutable pages into stronger claims than the repository proves.

The examples below are bound to `lib/cognitive_memory_engine.mjs`, `lib/memory_wiki_adapter.mjs`, `scripts/cognitive_memory_engine_test.mjs`, and `scripts/memory_wiki_adapter_test.mjs`. The tests use temporary directories. This repository does not claim that a live `memory/wiki/` tree is checked in, that every memory update becomes a Git commit, or that mutable wiki state is a Council promotion receipt.

## Ownership Boundary

| Layer | Owns | Writes | Does not own |
| --- | --- | --- | --- |
| `lib/cognitive_memory_engine.mjs` | Capture classification, same-partition consolidation, trust-zone retrieval, conflict detection, confidence decay, wiki compilation, and A2A memory-update envelopes | `memory/wiki/index.md`, trust/sensitivity-partitioned `memory/wiki/entries/*.md`, `memory/wiki/SCHEMA.md`, and `memory/wiki/log.md` when configured with a wiki root | Category-note frontmatter I/O, Git commits, Council promotion, or runtime authorization to write memory |
| `lib/memory_wiki_adapter.mjs` | Path-confined Markdown file I/O, category routing, title slugging, and frontmatter value safety | Human-curated pages under `memory/wiki/{preferences,projects,models,archive}/` | Capture policy, retrieval scoring, trust-zone filtering, reconciliation, decay, or A2A export |

The engine owns semantic memory policy and scoring. The adapter remains a separate filesystem helper. Adapter pages are not automatically ingested by the engine, which reloads compiled records only from `entries/*.md`.

The wiki is a transparent, diffable state surface. Git history exists only when an operator deliberately commits a change. Receipt authority remains separate from the files being described.

## Five Lifecycle Stages

Partitioning is an invariant applied during capture, consolidation, retrieval, and export. It is not a sixth lifecycle stage.

| Stage | Current behavior | Wiki effect | Operation receipt |
| --- | --- | --- | --- |
| Capture | Classifies only `durable` or `expiring` content. Short/no-signal content is dropped; invalid capture trust zones are rejected. Defaults are `private_self` and sensitivity `normal`. | A successful new capture compiles the entry page and refreshes `index.md` and `SCHEMA.md`; `log.md` receives the receipt hash. An expiring capture defaults to a 14-day expiry when none is supplied. | `action: "capture"`; status is `captured`, `drop`, or `reject`; successful details include memory ID, class, canonical key, wiki page, and content hash. |
| Consolidate | A compatible capture with the same `canonical_key + trust_zone + sensitivity_tier` reinforces the existing record. Explicit `consolidate()` also requires that partition and applies the configured Jaccard duplicate threshold. | The keeper page gains a `Consolidated note (...)`, reinforcement/confidence increase, and explicit consolidation archives merged candidates. Cross-partition records are never merged. | Automatic consolidation uses status `consolidated` and names the target/page; explicit consolidation reports the merge count and source-to-target IDs. |
| Retrieve | Searches active records after trust-zone filtering. The current score is semantic 45%, freshness 20%, reinforcement 20%, and confidence 15%; results below `0.12` are omitted. | A successful non-empty retrieval updates `last_accessed_at`, recompiles wiki state, and appends a log row. Retrieval starts from `index.md` and returns only selected page references rather than dumping the whole wiki. | Details include query hash, requested trust zone, `traversal_index: "index.md"`, returned page paths, and memory IDs. An empty query returns an `empty_query` receipt without a wiki/log write. |
| Reconcile | A contradictory non-zero polarity capture is flagged only against active records in the same canonical/trust/sensitivity partition. It is a capture-time conflict path, not a separate public method. | The existing page is not overwritten and the incoming statement is not stored; `log.md` records `reconcile | flag_conflict`. There is no automatic winner, deletion, or cross-partition reconciliation. | `action: "reconcile"`, status `flag_conflict`, incoming content hash, conflict count, and conflicting memory IDs; returned conflict rows include wiki-page references. |
| Decay | Applies confidence half-life from last access (60 days by default), archives expired records, and archives records below the confidence threshold (`0.15` by default). | Pages remain reviewable but change to `Status: archived`; `index.md` moves them under `## Archived Memories`. Archive is not deletion or revocation. | Reports `decayed_count` and `archived_count` with `action: "decay"`. |

## Construction-Time Partition Rule

The storage/consolidation key is:

```text
canonical_key + trust_zone + sensitivity_tier
```

A same-key `paid_public/public_safe` record and `private_self/do_not_export` record must remain separate active memories. The first partition may retain the short page name, while later collisions receive a partition-qualified path such as:

```text
entries/zone-boundary-fixture.md
entries/zone-boundary-fixture--private-self--do-not-export.md
```

Page names are collision-management aids, not authorization. Consumers must use embedded metadata and the retrieval/export checks. Legacy in-memory page-path collisions are reassigned before save so one disclosure partition does not overwrite another.

## Retrieval Trust-Zone Matrix

This table describes `CognitiveMemoryEngine.retrieve()` as implemented. Broader runtime policy is stricter: `DESIGN.md` disables durable writes and automatic retrieval for `outside_contact` and `paid_public` by default, so callers must enforce admission before invoking this lower-level engine.

| Requested zone | Records eligible for retrieval |
| --- | --- |
| `private_self` | All active engine records, including all origin zones and sensitivity tiers. This is the maximal local view. |
| `trusted_collaborator` | Active records except sensitivity `do_not_export`; origin trust zone is not required to match. |
| `outside_contact` | Only `public_safe` records whose stored origin is not `private_self`. |
| `paid_public` | Same engine filter as `outside_contact`: only `public_safe` records whose stored origin is not `private_self`. |

Capture validates the four trust-zone names. Sensitivity is currently free-form: only `do_not_export` and `public_safe` have special disclosure behavior, while the default `normal` is not public-exportable. An unknown retrieval zone fails closed by returning no eligible records, but it is not currently surfaced as an explicit validation error.

Construction-time separation closes the same-key merge leak; retrieval filtering remains a second guard. Neither replaces the runtime-level rule that paid/public and outside-contact durable memory is disabled unless an explicit, scoped policy authorizes it.

## A2A Memory Update Boundary

`createA2AMemoryUpdateEnvelope()` accepts the five lifecycle update types and emits `dizzy.memory_update.v1` inside the normal A2A message shape. The payload carries the operation receipt schema/hash, export count, `memory/wiki/index.md`, selected memory IDs/page references/content hashes, and its own deterministic `payload_sha256`.

Export rules are deliberately narrower than local retrieval:

- `do_not_export` records are excluded from `trusted_collaborator`, `outside_contact`, and `paid_public` envelopes.
- `outside_contact` and `paid_public` envelopes reject `includeContent: true` even for `public_safe` records; they may carry metadata references only.
- A `private_self` envelope may reference all records, but still omits raw content from any `do_not_export` record.
- An A2A memory-update envelope describes a bounded transfer. It does not make the receiving agent's wiki authoritative and does not promote mutable wiki state into a Council receipt.

## Example Compiled Page

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

The page is readable state. It can be reviewed in an ordinary diff. It is not immutable, self-signing, or proof that a runtime promotion occurred.

## Adapter Example

```js
const adapter = new MemoryWikiAdapter(tempDir);
const writtenPath = adapter.writeMemory({
  memory_id: "mem_handoff_rules",
  category: "preference",
  title: "handoffs",
  memory_class: "durable",
  confidence: 0.95,
  trust_zone: "private_self",
  sensitivity_tier: "normal",
  source_receipt_sha256: "...",
  content: "Always use absolute paths when passing file targets to Codex or Antigravity.",
});
const hydratedMemory = adapter.readMemory(writtenPath);
```

The adapter test proves directory initialization, safe title slugging, frontmatter injection neutralization, roundtrip reads, and rejection of lexical path traversal outside the configured wiki root. It does not prove symlink/junction confinement, collision-free writes between titles that sanitize to the same slug, semantic lifecycle policy, or retrieval/export enforcement.

## Receipt Layers and Proof Boundary

| Evidence | Location or schema | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Wiki page/index | `memory/wiki/*.md` | Human-readable current state and traversal links at the time written | Immutability, automatic Git commit, source authenticity, or promotion authority |
| Wiki operation log | `memory/wiki/log.md` | Chronology of operation/action/status/count and the associated operation-receipt hash | The complete receipt payload; the log persists the hash, not the full returned receipt |
| Operation receipt | `dizzy.cognitive_memory_receipt.v1` returned by the engine | Action status and hashed operation details for capture/consolidate/retrieve/reconcile/decay | A durable receipt file, Council approval, or public-claim authority unless another layer stores and promotes it |
| A2A update payload | `dizzy.memory_update.v1` | Bounded exported metadata, wiki references, source receipt hash, and deterministic payload hash | Authorization to ingest, cross-runtime interoperability, or promotion |
| Aggregate Council receipt | `reviews/oss_council_verdict_latest.json` generated by `npm run check:council` | That the listed syntax, execution, and governance checks passed in that specific run | That a live wiki exists, that generated receipts are tracked, or that future/unlisted behavior is verified |

The focused cognitive-memory suite currently proves nine cases: capture filtering; Markdown compilation; reload; contradiction flagging; trust-scoped retrieval; same-key partition isolation; legacy path-collision separation; decay/archive; and A2A export boundaries. The adapter suite proves four filesystem/frontmatter cases. Counts and hashes from the aggregate Council receipt are per-run evidence and must be read from disk after the run rather than copied forward as timeless facts.

## Known Limits From This Review

- The wiki compiler is local synchronous filesystem code; it does not automatically commit, sign, replicate, schedule decay, or perform background maintenance.
- Engine operation receipts are returned to the caller. Only their hashes are appended to `log.md`; the engine does not maintain a full immutable receipt store.
- Reconciliation flags conflicts but does not resolve them. Decay archives but does not delete or implement the broader revocation lifecycle.
- The lower-level engine accepts capture into any valid trust-zone label; runtime admission must enforce the stricter no-durable-write defaults for outside/paid contexts.
- Sensitivity tiers are not yet an enumerated schema, and unknown retrieval zones are not explicitly rejected.
- The adapter is lexically path-confined but does not resolve real paths to prove symlink/junction confinement; sanitized title collisions can overwrite an existing page.
- Test-generated wiki trees are temporary fixtures. Public documentation should not imply a checked-in live memory corpus or public cross-runtime memory synchronization.

## Verification

Run from the repository root:

```powershell
npm run test:cognitive-memory
npm run test:memory-wiki
npm run check:docs
npm run test:public-view-readiness
npm run check:council
```

`UNIFIED_HANDOFF_PACKET.md` is an internal, local handoff artifact. When that file is present at the repository root, `test:public-view-readiness` and therefore the aggregate Council run are expected to fail the public-branch absence rule. Generate/verify the public receipt before creating the packet, keep the packet untracked, and record that ordering in the handoff.
