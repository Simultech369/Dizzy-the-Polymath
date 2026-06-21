---
status: sketch
purpose: Document the hybrid anarcho-socialist / degen-communist coordination design and its core tensions.
load:
  - DESIGN.md
  - CONSTITUTIONAL_KERNEL.md
  - memory/topics/civic-doctrine-kernel.md
exclude: []
watch:
  - Speculative floor volatility
  - Sybil protection vs. identity chokepoints
  - Exit liquidity drain (bank runs on the commons)
  - Upgradability keys and oracle capture
---

# Coordination Philosophy & Experimental Mechanisms

This document outlines the experimental framework for Dizzy's coordination design, combining Vitalik Buterin’s mechanism design, quadratic-like coordination, and decolonial/relational ethics with Playful speculative ("degen") experimentation.

---

## 1. The Four Core Tensions

1. **Speculation vs. Dependable Provisioning**
   Speculative token mechanics and "degen" yield generators can rapidly capitalize a project but are highly volatile. If a community's daily survival or baseline resource provisioning is pegged to speculative volume, the safety net is thinnest exactly when it is needed most.
2. **Plural Allocation vs. Collusion Control**
   Democratic and quadratic allocation protocols distribute common resources without state authority, but they are highly vulnerable to Sybil attacks (forging fake identities). Preventing these attacks usually requires identity validation (e.g., biometric proofs, government keys), which threatens to introduce centralized chokepoints.
3. **Exit vs. Collective Commitment**
   To remain non-coercive (anarchic), participants must have the right to leave bad arrangements. However, if leaving is frictionless and allows immediate withdrawal of a proportional share of common assets, the shared infrastructure is vulnerable to coordinated "bank runs," destabilizing the remaining commons.
4. **Automation vs. Hidden Governance (Code as Frozen Politics)**
   "Code is law" is a convenient fiction. Programmatic smart contracts do not eliminate politics; they relocate it into upgrade keys, multi-sig parameterization, oracle selection, identity definitions, and emergency controls.

---

## 2. Reconciled Mechanism Refinements

### A. The Two-Treasury Model
To resolve the tension of speculative volatility:
* **Floor Treasury**: Boring, highly diversified, reserve-backed, and countercyclical. It is optimized for capital preservation and funds only recurring essentials (infrastructure maintenance, basic needs).
* **Experimental Treasury**: Receives speculative transaction fees and volatile yield. It funds high-risk, experimental projects.
* *Surplus Circulation*: Speculative surpluses may capitalize the Floor Treasury's permanent endowment during boom periods, but the Floor's baseline payouts must never assume continuing speculative velocity.

### B. Plural Sybil Resistance
To avoid a single identity-verification chokepoint, combine multiple imperfect, heterogeneous signals:
* **Contribution History**: Time-stamped proof of productive work or resource contributions.
* **Community Attestations**: Peer-to-peer trust graphs and transitive reputation scores.
* **Funding Caps**: Limits on how much matching power any single identity can wield in quadratic allocations.
* **Randomized Audits**: Decentralized, time-weighted panel reviews for anomalous activity.
* **Privacy-Preserving Uniqueness Proofs**: Zero-knowledge proof systems that confirm distinctness without revealing identity.
* *Rule*: Every identity mechanism must expose its exclusion and gatekeeping risks to the operator.

### C. Layered Exit Rights
Exit rights must be structured to prevent bank runs on the commons while protecting individual freedom:
* **Data Portability**: Unconditional export of personal history, credentials, and interaction logs, while strictly protecting third-party privacy, shared secrets, and restricted records.
* **Software Forking**: The right to copy the codebase and run a parallel instance, subject to licensing constraints and explicitly excluding private data, credentials, and operational secrets.
* **Governance Resignation**: Immediate revocation of delegated authority and vote standing.
* **Uncommitted Capital Withdrawal**: The ability to withdraw personal capital that is not locked in active contracts.
* **Collectively Owned, Non-Withdrawable Infrastructure**: Shared physical/digital resources (like servers, land, or code repositories) belong permanently to the common pool and cannot be partitioned on exit.

### D. Bounded Power Decay
Power decay is a vital tool to prevent the accumulation of permanent rent-seeking claims, but it must be strictly bounded:
* **Decay of Delegated Power**: Expiring delegations, rotating office terms, and mandatory reauthorizations of active authority scores.
* **Standing and Rights Preservation**: Fundamental standing and appeal rights remain permanent—this does not imply permanent voting eligibility, automatic office, or custodial/rent-producing claims. Power decay applies to delegated authority and rotating offices, while fundamental standing is a permanent property of the sovereign participant.
* **Conditional Ownership Decay**: Ownership claims should not categorically "never decay"; abandoned, time-limited, custodial, and rent-producing claims need separate, explicit treatment.

---

## 3. The Promotion Ladder

A mechanism sketch must pass through the following gates before exercising active authority:

1. **Sketch → Mechanism Proposal**
   * *Trigger*: A concrete coordination failure has occurred or is credibly imminent; real participants, assets, and affected rights can be named; existing simpler mechanisms are inadequate.
   * *Requirement*: A completed mechanism-sieve proposal covering ownership, funding, governance, enforcement, exit, capture, dependencies, and the smallest experiment.
2. **Proposal → Offline Model**
   * *Requirement*: Explicit baseline and counterfactual; adversary model; measurable success and failure thresholds; synthetic data only (no wallets, identity collection, external services, or real allocation authority); complete deletion and rollback path.
3. **Model → Report-Only Shadow Experiment**
   * *Requirement*: The offline model beats the baseline across ordinary and adversarial scenarios; failure modes are visible rather than silently corrected; independent review challenges the assumptions; the system produces recommendations but cannot enact them.
4. **Shadow Experiment → Bounded Pilot**
   * *Requirement*: Named participants knowingly consent; data collection is minimal and revocable; appeals and manual override exist; a fixed time, participant, loss, and transaction ceiling is declared; the mechanism can be stopped without trapping data, capital, or governance rights.
5. **Pilot → Operational Authority**
   * *Requirement*: Repeated evidence across more than one context; documented false-positive, exclusion, capture, and administrative-burden rates; named upgrade, emergency, oracle, and dispute authorities; migration and sunset plans; independent security and governance review. For funds or regulated activity, explicit operator approval plus the separate legal/risk gate required by [LEGAL-GUARDRAILS.md](../LEGAL-GUARDRAILS.md).

---

## 4. Mechanism-Specific Triggers

| Mechanism | Begin coding only when... | First safe experiment |
|---|---|---|
| **Two-Treasury** | A real recurring floor obligation and a distinguishable volatile surplus stream exist | Offline stress simulator measuring reserve coverage, drawdown, transfer rules, and recession survival |
| **Plural Sybil Resistance** | A real allocation process is being materially distorted by duplicate identities or collusion | Synthetic attack tournament comparing signals, false exclusions, collusion gains, and chokepoint concentration |
| **Layered Exit** | Multiple people have shared data, capital, or infrastructure with ambiguous withdrawal rights | State-machine model classifying personal, committed, shared, portable, and non-withdrawable assets |
| **Bounded Power Decay** | A specific delegation can persist beyond consent, usefulness, or accountability | Expiring delegation objects with renewal, emergency continuity, appeal, and audit tests |
| **Hidden-Governance Control** | Any mechanism begins controlling access, allocation, rights, or funds | Parameter and authority registry identifying upgrade keys, oracle sources, emergency powers, appeals, and sunset conditions |

---

## 5. Stop Conditions

Immediately halt promotion if:
* The experiment requires imaginary users or assets to justify itself.
* Identity infrastructure becomes more powerful than the allocation problem warrants.
* The social floor depends on speculative performance.
* Participants cannot exit without surrendering unrelated rights or data.
* An automated decision has no accountable interpreter or appeal.
* Complexity grows faster than demonstrated coordination value.
