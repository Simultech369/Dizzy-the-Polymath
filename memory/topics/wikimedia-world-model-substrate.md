# Wikimedia World Model Substrate

## Summary

Two linked shares pointed in different directions:

- an X post around the fast-moving open agent / clone / workflow discourse
- the Wikimedia `mediawiki_content_current` dump index, which is hard infrastructure rather than narrative context

The more durable takeaway is the second one.

## What was verified

- `https://dumps.wikimedia.org/other/mediawiki_content_current/` is a live index of current-content MediaWiki dumps across many Wikimedia projects.
- The index includes project-specific directories such as `enwiki/`, `commonswiki/`, `dewiki/`, and many others.
- For `enwiki`, current dated snapshots exist under paths like:
  - `enwiki/2026-04-01/xml/bzip2/`
- The English Wikipedia snapshot is sharded into many large `xml.bz2` files and includes integrity metadata such as `SHA256SUMS` and `_SUCCESS`.

## Interpretation

This is not "AGI in a folder."

It is:

- a refreshable, broad-coverage textual world-model substrate
- useful for retrieval, ontology extraction, summarization, grounding, and periodic knowledge refresh
- more relevant to breadth of representation than to embodiment or causal agency

## AGI framing

Useful distinction:

- **memorized physics** = learned descriptive regularities from corpus-scale data
- **intuitive physics** = the ability to predict consequences in novel situations, especially under intervention and counterfactual change

Wikimedia-style dumps help more with the first than the second.

They strengthen:

- semantic breadth
- entity/relation coverage
- historical and institutional context
- world-model recall and retrieval

They do not by themselves solve:

- active experimentation
- embodiment
- sensorimotor grounding
- causal intervention
- persistent agency over time

## Practical implication for Dizzy

If Dizzy grows a stronger memory / retrieval / ontology layer, Wikimedia current-content dumps could be useful as:

1. periodic ingest source
2. local-first knowledge base input
3. entity and relation extraction substrate
4. benchmark corpus for "what does Dizzy know vs infer vs hallucinate"

Best use is probably not naive full ingestion, but selective pipelines:

- subset by project/domain
- normalize and chunk
- build typed retrieval
- separate factual retrieval from interpretive reasoning

## Constraint

Do not confuse:

- larger textual substrate

with:

- operational intelligence in the world

Corpus scale improves representational coverage. It does not automatically produce causal competence.

## Open direction

Promising future question:

How should a local-first agent combine:

- broad text substrate (Wikimedia)
- compact curated memory
- tool-mediated verification
- active experimentation

without collapsing into either static encyclopedia mode or unconstrained agent theater?
