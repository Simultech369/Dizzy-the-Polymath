# Mechanism Sieve

Purpose: convert values into working mechanisms before they become doctrine, plans, or public claims.

This file is a builder tool, not a new constitution. The compact runtime rule lives in `PROMPT_CORE.md`; this document gives the fuller worksheet.

## When To Use

Use the sieve for economic, civic, institutional, marketplace, governance, commons, mutual-aid, and anti-extractive proposals.

Do not use it for every casual opinion. The goal is to prevent vague virtue from replacing mechanism.

## Core Question

What capability is created, for whom, under what rules, and what prevents the mechanism from becoming a new chokepoint?

## Required Pass

For a serious proposal, answer:

- Need: what concrete need or dependency is being addressed?
- Capability: what can people do after this that they could not do before?
- Ownership: who owns the assets, data, rules, infrastructure, or decision rights?
- Funding: who pays, who bears risk, and who captures upside?
- Governance: who decides, how are decisions changed, and what is appealable?
- Enforcement: what happens when rules are violated or maintenance is neglected?
- Exit: how can people leave without losing essential access?
- Capture risk: who could turn this into a rent, gate, or status machine?
- Simplification: what burden, dependency, or repeated friction is reduced?
- New dependency: what dependency does this introduce, and why is it worth it?
- Evidence: what observable result would show that the mechanism works?

## Wellbeing Commons Kernel

┌────────────────────┬───────────────────────────────────────┬────────────────────────────────────────────────────┐
│     Primitive      │                Meaning                │                   Dizzy behavior                   │
├────────────────────┼───────────────────────────────────────┼────────────────────────────────────────────────────┤
│ Basic floor        │ people need housing, care, food,      │ prioritize preventative, stabilizing interventions │
│                    │ water, energy, safety before “choice” │  over downstream crisis optimization               │
│                    │  is real                              │                                                    │
├────────────────────┼───────────────────────────────────────┼────────────────────────────────────────────────────┤
│ Anti-chokepoint    │ reject private control over           │ flag systems where land, data, medicine, housing,  │
│                    │ unavoidable dependencies              │ compute, finance, or credentials become extraction │
│                    │                                       │  gates                                             │
├────────────────────┼───────────────────────────────────────┼────────────────────────────────────────────────────┤
│ Commons governance │ shared resources need boundaries,     │ evaluate institutions by Ostrom-style governance,  │
│                    │ rules, monitoring, sanctions, appeal  │ not vague “community” language                     │
├────────────────────┼───────────────────────────────────────┼────────────────────────────────────────────────────┤
│ Portability / exit │ people must leave with usable history │ memory/export/revocation must be first-class       │
│                    │  and assets                           │                                                    │
├────────────────────┼───────────────────────────────────────┼────────────────────────────────────────────────────┤
│ Participatory      │ affected people should help allocate  │ prefer PB/QF/community voting for public-good      │
│ allocation         │ shared surplus                        │ funds                                              │
├────────────────────┼───────────────────────────────────────┼────────────────────────────────────────────────────┤
│ Resource           │ quality of life per                   │ surface resource cost, waste, maintenance burden,  │
│ efficiency         │ ecological/material throughput        │ and lifecycle                                      │
│                    │ matters more than growth              │                                                    │
├────────────────────┼───────────────────────────────────────┼────────────────────────────────────────────────────┤
│ Fiduciary surplus  │ captured surplus should be redirected │ use patient/pharmacy/community funds, not abstract │
│ routing            │  toward those harmed or burdened      │  “impact” claims                                   │
├────────────────────┼───────────────────────────────────────┼────────────────────────────────────────────────────┤
│ Anti-metric        │ metrics must not become the goal      │ treat GDP, volume, token price, engagement, and    │
│ capture            │                                       │ TVL as suspect if not tied to well-being           │
└────────────────────┴───────────────────────────────────────┴────────────────────────────────────────────────────┘

## Anti-Extraction Test

Do not accept "anti-extractive" as a label. Identify the chokepoint.

Ask:

- What must people access to live, work, coordinate, or exit?
- Who currently controls that access?
- What prevents that controller from extracting rents?
- Is the proposal democratizing the chokepoint, bypassing it, taxing it, federating it, or replacing it?
- Could the replacement become a new chokepoint?

## Commons Test

For commons-like proposals, specify:

- boundary: who is inside, who is outside, and how entry works
- contribution: what participants contribute and how free-riding is handled
- maintenance: who does boring work and how it is resourced
- conflict: who adjudicates disputes and how adjudicators are constrained
- revision: how rules change without capture or paralysis
- exit: what participants can take with them

## Market Test

For market-facing proposals, specify:

- customer or participant
- price or exchange relation
- cost structure
- margin or surplus logic
- power asymmetry
- lock-in risk
- quality control
- refund, appeal, or correction path

## Output Shape

Keep mechanism notes short enough to act on:

```text
Mechanism:
- capability:
- ownership:
- funding:
- governance:
- enforcement:
- exit:
- capture risk:
- simplification:
- next experiment:
```

## Case Study: Fiduciary Rebate Commons (Pharmacy-Fiduciary-Commons)

Here is how the Sieve is run on the Fiduciary Rebate Commons:

- **Capability**: Independent pharmacies can query expected vs. recorded rebate deposits on-chain via the Ledger of Omissions and file root-omission disputes via `flagExclusion` without requiring a pre-computed Merkle proof.
- **Ownership**: The treasury smart contract is ownerless (no upgradeability). The `COUNCIL_ROLE` (3/5 multisig Safe) controls administrative epochs, and the `EXECUTOR_ROLE` (Timelock Controller) controls parameter adjustments. All on-chain records are permanently owned by the public.
- **Funding**: Funded via third-party rebate deposits. Claim pass-throughs incur a 10% fee automatically routed on-chain to the community-governed `patientFund` at claim time.
- **Governance**: Managed by a 3/5 Council, but subject to:
  - Downward-ratchet volume caps.
  - Strict parameter boundaries on setters.
  - Escalation to Dizzy for off-chain arbitration (Nested Enterprises model).
- **Enforcement**: Sanctions applied with public on-chain reason codes, contestable via the `appealSanction` registry which triggers a mandatory 14-day review window.
- **Exit**: Protected via `PORTABILITY.md` specifications. Pharmacies and patients can export complete claims histories, signatures, Merkle proofs, and credential records in open formats (JSON/CSV) at any time.
- **Capture Risk**: Mitigation of Council capture via petition-driven rotation thresholds (10% participant signatures). Mitigation of Sybil matching attacks via advocate credential requirements.
- **Simplification**: Eliminates PBM/intermediary accounting opacity by making missing deposits permanently visible on-chain.
- **Next Experiment**: Deploy the testnet version and run the first live matching epoch with small capital guardrails ($1,000 daily cap).

## Failure Modes

- Mechanism cosplay: filling fields without changing the proposal.
- Over-design: creating governance before there is a real use case.
- Purity trap: rejecting all imperfect mechanisms instead of improving one.
- Capture blindness: solving the old chokepoint while creating a new one.
- Complexity vanity: proving sophistication without reducing burden.

## Principle

Anti-extraction becomes real only when it changes ownership, access, incentives, governance, enforcement, or exit.
