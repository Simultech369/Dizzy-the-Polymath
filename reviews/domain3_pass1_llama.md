**Claim:** The dashboard displays a "production-ready" status for upgrades without sufficient evidence in the provided code.  
**Evidence Status:** Missing  
**Location:** Dashboard HTML or maintenance checks (e.g., `upgradeStatus()` in `scripts/maintain.mjs`).  
**Severity:** Medium  
**What would constitute real proof:** A `production_readiness_check.mjs` or similar code with logic to validate readiness against real-world criteria (e.g., successful deployment, endpoint tests, or integration benchmarks), not just status flags.  

---

**Claim:** The "pluralistic consensus" in the governance grid claims to track real-time operator votes, but the code only simulates static coordination.  
**Evidence Status:** Contradicted  
**Location:** Dashboard governance grid (e.g., `coordinate-map` or `operator-signoff` buttons).  
**Severity:** High  
**What would constitute real proof:** Code that logs actual operator inputs, validates votes cryptographically, or updates consensus state persistently.  

---

**Claim:** The "memory ownership" section asserts comprehensive coverage of durable surfaces, but `MEMORY_OWNERSHIP.md` is missing critical files (e.g., `memory/YYYY-MM-DD.md`).  
**Evidence Status:** Contradicted  
**Location:** `memoryOwnershipStatus()` in `scripts/maintain.mjs` and `MEMORY_OWNERSHIP.md`.  
**Severity:** Medium  
**What would constitute real proof:** A `MEMORY_OWNERSHIP.md` that explicitly claims ownership of all listed surfaces, with audit trails or code enforcing this.  

---

**Claim:** The "anti-slop prose scan" in the dashboard shows no findings, but `scanProseSlopOverlay()` in `scripts/maintain.mjs` identifies prohibited terms in `AGENTS.md`/`DESIGN.md`.  
**Evidence Status:** Contradicted  
**Location:** `scanProseSlopOverlay()` and `AGENTS.md`/`DESIGN.md`.  
**Severity:** High  
**What would constitute real proof:** The dashboard should display findings from `scanProseSlopOverlay()`, or the prose should be revised to align with banned terms.  

---

**Claim:** The "prompt pack" section claims active integration of sources, but `script/maintain.mjs` lacks tests verifying prompt stability or drift detection.  
**Evidence Status:** Missing  
**Location:** Dashboard prompt list (`prompt-sources-list`).  
**Severity:** Medium  
**What would constitute real proof:** Tests in `prompt_drift_check.mjs` or code that monitors prompt versions against a stable baseline.  

---

**Claim:** The "safety checks" banner in the dashboard claims "all red-severity checks passed," but `scripts/maintain.mjs` may return red-status findings.  
**Evidence Status:** Partial/Missing (depends on runtime `runCheck()` output)  
**Location:** Dashboard safety metrics.  
**Severity:** High  
**What would constitute real proof:** Code that only displays "green" for safety if `runCheck().ok === true` for all red-severity checks.  

---

**Claim:** The "automation consent" metric shows "green" status, but `automationConsentStatus()` in `scripts/maintain.mjs` has malformed entries.  
**Evidence Status:** Contradicted  
**Location:** `automationConsentStatus()` and dashboard receipt panel.  
**Severity:** Medium  
**What would constitute real proof:** Dashboard status reflecting malformed entries or code sanitizing receipts before display.  

---

**Conclusion:** Multiple discrepancies exist between dashboard claims and backend code logic (e.g., simulated consensus, unverified upgrades). The dashboard requires stricter alignment with executable evidence to avoid theater.
