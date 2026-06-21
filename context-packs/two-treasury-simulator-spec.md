---
status: sketch
purpose: Define the technical specifications and parameters for the two-treasury stress simulator.
load:
  - context-packs/coordination-philosophy.md
exclude: []
watch:
  - Speculative asset correlation to demand shocks
  - Stable-asset haircut probability modeling
  - Oracle error impact thresholds
---

# Two-Treasury Stress Simulator Specification (v0)

## Learning Question
Under what transfer and reserve policies can the Floor Treasury fund essential obligations through a prolonged, correlated collapse in speculative revenue—without receiving a bailout from the Experimental Treasury’s principal or cutting core services?

---

## 1. Model Normalization
To prevent false precision and maintain epistemic humility:
* **Base Unit**: $1.0\text{ unit} = \text{one normal month of essential obligations}$.
* **Time Horizon**: 120 months.
* **Trial Density**: 10,000 runs, seeded deterministically.

---

## 2. Core Parameter Grid

### A. Floor Treasury Parameters
* **Initial Reserve Coverage**: 6, 12, 18, 24, and 36 months (in base units).
* **Liquid Asset Percentage**: Ratio of reserves held in immediately liquid assets versus locked/yield assets.
* **Expected Real Return**: Real annualized return on Floor assets (net of inflation).
* **Return Volatility**: Annualized volatility of Floor assets.
* **Liquidity Haircut**: Percentage loss incurred on Floor assets if liquidated during a crisis.
* **Obligation Growth**: 0%, 5%, 10%, and 20% annually.
* **Demand Shocks**: $+25\%$, $+50\%$, or $+100\%$ essential obligations lasting for 6 to 24 months.
* **Spend Policy Thresholds**:
  * *Reserve Warning*: Below 18 months of coverage.
  * *Discretionary Freeze*: Below 12 months of coverage.
  * *Emergency Review*: Below 9 months of coverage.
  * *Critical Alert*: Below 6 months of coverage.
  * *Recovery Hysteresis*: Duration (in months) reserves must remain above a threshold before discretionary spending resumes.

### B. Experimental Treasury Parameters
* **speculative Revenue Stream**: Realized transaction fees and protocol revenue modeled independently of token price.
  * *Transaction Volume*: Base velocity.
  * *Protocol Fee Rate*: Fee margin.
  * *Realized Yield*: Real yield on active speculative deployments.
* **speculative Volatility Grid**:
  * *Annualized Volatility*: 40%, 80%, 120%, and 180%.
  * *Crash Magnitude*: $-50\%$, $-80\%$, and $-95\%$.
  * *Revenue Collapse*: $-30\%$, $-70\%$, and $-95\%$.
  * *Recovery Duration*: 6, 18, 36, or 60 months.
* **Operational Risks**:
  * *Exploit-Loss Probability*: Likelihood of sudden asset loss (exploit/hack).
  * *Exploit-Loss Severity*: 25%, 50%, or 100% of Experimental assets.
  * *Liquidity Lock Duration*: Lockup period for yield deployments.
  * *Stable-Asset Haircut*: Loss rate on supposed "safe-haven" assets.

### C. Transfer-Policy Parameters
We compare three distinct models under transfer rates of 0%, 25%, 50%, and 75%:
1. **Single-Treasury Baseline**: Speculative revenue and floor liabilities share one unified account.
2. **Fixed Transfer Policy**: A fixed percentage of realized experimental net surplus is pushed to the Floor Treasury.
3. **Reserve-Target Transfer Policy**: Transfers occur only when the Experimental Treasury retains its required runway and the Floor Treasury is below its target reserve ceiling.

---

## 3. Initial Stress Scenarios

* **Boring Stagnation**: Weak experimental revenue, low investment returns, persistent inflation.
* **Boom then Bust**: Rapid speculative growth followed by an 80% to 95% asset crash.
* **Long Crypto Winter**: Speculative revenue remains 70% to 95% below baseline for 36 to 60 months.
* **Correlated Crisis (Decisive Scenario)**: Speculative revenue collapses while essential obligations simultaneously rise by 50% to 100%.
* **Liquidity Freeze**: Assets retain nominal value but cannot be liquidated for 6 to 18 months.
* **Protocol Exploit**: Sudden loss of 25%, 50%, or 100% of Experimental Treasury assets.
* **Stable-Asset Failure**: A severe haircut applies to the supposed "safe" stable-asset portion of the Floor's reserves.
* **Governance Delay**: Emergency overrides or allocations are delayed by 1, 3, or 6 months.
* **Oracle/Accounting Error**: Transfers are calculated based on overstated realized surplus (delayed correction).
* **Fee Shutdown**: Structural, regulatory, or technical changes permanently reduce speculative revenue to zero.

---

## 4. Evaluation Metrics

* **Floor Insolvency Rate**: Probability of missing essential obligations ($< 0.0$ balance).
* **Minimum Runway**: Lowest reserve coverage level reached during a trial.
* **Threshold Violations**: Number of months spent below the Warning, Review, and Emergency thresholds.
* **Exhaustion Time**: Time elapsed until reserves are fully depleted.
* **Worst-Case Shortfall**: The average shortfall of the worst 5% of trials (Tail Risk / CVaR).
* **Speculative Dependency**: Correlation between floor spending and same-period speculative income.
* **Experimental Insolvency Rate**: Frequency of Experimental Treasury defaults.
* **Intervention Count**: Number of emergency governance actions required.
* **Project Deferral Rate**: Percentage of discretionary projects delayed or cancelled.
* **False-Boom Transfers**: Value transferred to the Floor during transient bubbles that subsequently popped.
* **Solvency Recovery Time**: Months required for reserves to return to target levels post-crisis.
* **Relative Solvency Lift**: Performance comparison against the Single-Treasury Baseline.

---

## 5. Engineering Invariants

The simulator implementation must enforce and assert the following invariants:
1. **Conservation of Funds**: Total system capital at $T$ must equal initial capital plus returns/revenue minus obligations and losses. No leakages.
2. **Deterministic Replays**: Running the simulator with the same seed must yield identical results across all metrics.
3. **No Negative Balances**: Individual accounts cannot drop below $0.0$. Attempting an obligation payment beyond reserves triggers a default event.
4. **No Hidden Bailouts**: The Floor Treasury cannot transfer capital back to the Experimental Treasury, and the Experimental Treasury principal cannot be used to cover Floor obligations except under explicit, audited emergency overrides.
5. **Realized vs. Unrealized Split**: Only realized yield and surplus can be allocated or transferred; unrealized token price appreciation must remain in a non-transferable valuation register.
6. **Scenario Input Consistency**: The exact same sequence of stochastic variables (returns, shocks) must apply across all tested policy options to ensure fair comparison.
