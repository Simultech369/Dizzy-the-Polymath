# reviews/kimi_radiating_critique.md
## RadiatingOutward Usability Critique – Dizzy Backend Telemetry & Status APIs  

**Audience** – Operators on the controlroom console, incident responders, and support engineers who must diagnose divergences, validate inputs, and monitor system health under time pressure.  

---

### 1. Telemetry Log Diagnostics (`run-scenario-simulation` `/api/dashboard-data`)

| Observation | Current Output | Usability Gap | Recommended Improvement |
|-------------|----------------|----------------|--------------------------|
| **Baseline / Fork histories** | `scenario_simulation_baseline` and `scenario_simulation_fork` each return **full state histories** (arrays of objects with `reserves`, `participants`, `allocated_amount`, `exited_count` for every step). | • Operators receive raw, potentially thousandselement arrays. <br>• No visual cue which step first shows divergence. <br>• Hard to spot “when did the fork diverge?” without manual diff. | • Return **summary deltas** – e.g. `first_divergence_step`, `cumulative_divergence`, and a **compact delta array** (`step`, `reserves_delta`, `participants_delta`, `similarity`). <br>• Optionally include a **topN most divergent steps** payload. |
| **Cosinederived divergence object** | `calculateDivergence` produces `cumulative_divergence`, `average_divergence`, and a detailed `history` array. | • The `history` array is exposed wholesale in telemetry, which can be overwhelming. <br>• Operators cannot quickly assess “highlevel health” – they must scroll through many steps. | • Surface only **aggregated metrics** in the toplevel telemetry payload (e.g. `total_steps`, `cumulative_divergence`, `average_divergence`, `max_step_divergence`). <br>• Keep the full `history` available under a separate endpoint (`/api/dashboard-divergence-detail`) for deep forensic review. |
| **Missing contextual markers** | No indication of *parameter changes* that produced the fork. | • Operators cannot correlate a divergence spike with a specific input change (e.g. altered `decay_rate`). | • Include a `parameter_diff` object that lists the two parameter sets sidebyside, highlighting changed fields and their values. |

**Bottomline** – The current telemetry payload is **datarich but not scanfriendly**. Operators need a concise, decisionoriented snapshot (e.g. “Divergence first appears at step12, cumulative0.34, driven by reserves drop of 150”). Exposing the full history should be an optin, not the default.

---

### 2. Error Feedback from Validation (`scenario_simulator.validateParams`)

| Situation | Current Response | Clarity / Actionability | Suggested Action |
|-----------|------------------|--------------------------|-------------------|
| **Invalid `decay_rate`** (e.g. `-0.1` or `1.5`) | Caught as `RangeError`; returned as `{ ok: false, error: "<message>" }`. | • Message describes the numeric constraint but **does not indicate which field** or **why the value is invalid**. <br>• No guidance on acceptable range beyond “must be a number between 0 and 1”. | • Return a structured error object, e.g. `{ ok: false, field: "decay_rate", reason: "must be in [0,1]", value: <provided>, suggestion: "adjust to a value between 0 and 1" }`. |
| **Missing required parameters** (`basic_needs_allocation`, `steps`, etc.) | Same generic error string. | • Operators cannot quickly map the error to the missing input key. | • Include `missing_fields: ["steps"]` in the response. |
| **Parameter type errors** (e.g. passing a string for `steps`) | Generic `RangeError` about “steps must be an integer”. | • No indication that the *type* mismatch is the root cause; could be confused with a valuerange problem. | • Add `detail: "steps must be a positive integer (got string)"`. |
| **Unhandled validation errors in `/api/operator/run-scenario-simulation`** | The endpoint catches any exception and returns `{ ok: false, error: e.message }`. | • Stack traces are never sent to the client, which is good for security, but the **plain error string** may be cryptic for nontechnical operators. | • Map known validation errors to **humanreadable messages** with actionable advice (e.g., “`decay_rate` must be between 0 and 1 – you supplied 2.3”). Keep fallback to generic message only for unexpected errors. |

**Bottomline** – Error payloads should be **fieldspecific, machineparseable, and include remediation guidance**. This reduces the “guessthecause” loop for operators.

---

### 3. Status Transparency – Formatting of Runtime Signals (`/api/dashboard-data`, `/api/operator/*`)

#### 3.1 System Memory Warning Banner (implicit in `/api/operator/hardware-status`)

*Current Payload* (excerpt):

```json
{
  "ok": true,
  "free_memory_gb": 3.2,
  "total_memory_gb": 16,
  "active_model_route": "chat",
  "active_routing_basis": "System RAM telemetry: 3 GB free / 16 GB total; route_reason=...; VRAM is not measured by this endpoint."
}
```

*Usability Issues*  

1. **Long, semistructured string** (`active_routing_basis`) mixes multiple facts in a freeform sentence, making it hard to scan quickly.  
2. **Mixed units** (GB) are fine, but the **semantic intent** (“VRAM is not measured”) is buried in the middle of the sentence.  
3. No explicit **severity indicator** (e.g., `warning: true`) for operators to trigger UI banners automatically.

*Recommendation*  

```json
{
  "ok": true,
  "memory": {
    "free_gb": 3.2,
    "total_gb": 16,
    "usage_percent": 80
  },
  "active_model_route": "chat",
  "routing_basis": {
    "reason": "System RAM telemetry",
    "free_gb": 3.2,
    "total_gb": 16,
    "percent": 80
  },
  "vram_not_measured": true,
  "memory_warning": false   // set true when free_gb < threshold
}
```

*Benefits* – Operators can programmatically decide to show a red banner when `memory_warning` is true, and UI designers can layout fields in a predictable grid.

#### 3.2 Consensus State (`/api/operator/consensus-map`)

*Current Output* – Direct call to `getConsensusState()` which returns an opaque object whose shape is **undocumented**.  

*Usability Gap* – Operators cannot anticipate which keys will appear (e.g., `majority`, `minority`, `confidence_level`). When the object expands, the console view becomes unstructured.

*Recommendation* – Export a **stable, documented schema** (e.g., `{ version: "v1", active_proposals: [...], overrides: [...]}`) and version the endpoint (`/api/operator/consensus/v1`). Include a short `summary` field that surfaces the most relevant metric (e.g., `agreement_ratio`) for quick scan.

#### 3.3 QuarantineBridge Status (`/api/operator/quarantined-bridges` / acceptance)

*Current Response* – Returns raw JSON arrays of bridge objects; acceptance endpoint returns only `{ ok: true, message: "Bridge merged to memory graph successfully." }`.  

*Usability Gap* – No **status flag** indicating whether the bridge is *pending*, *approved*, or *rejected*. Operators must inspect the file system or additional calls to infer state.

*Recommendation* – Add a `status` field (`"pending" | "approved" | "rejected"`), a `last_updated` timestamp, and optionally a `risk_level` enum to help operators quickly assess the current state of the quarantine queue.

---

### 4. Overall Diagnostic Workflow Considerations

| Area | Current State | Suggested Consolidation |
|------|---------------|--------------------------|
| **Telemetry payload** | Large, unsummarized arrays/strings. | Provide **highlevel health flags** (`divergence_detected: true/false`, `severity: "low"|"medium"|"high"`), plus optional detailed payload via a dedicated endpoint. |
| **Error handling** | Generic `error: "<msg>"` messages. | Adopt **structured error objects** with `field`, `reason`, `value`, and `suggestion`. |
| **Status banners** | Inline strings, no versioning. | Return **typed, versioned JSON** with explicit fields for UI consumption (e.g., `warning: true`, `banner_message: "Low memory – consider scaling"`) |
| **Consistency** | Mixed naming (`ok`, `ok: true`, sometimes `status`), varied response shapes. | Enforce a **canonical response envelope**: `{ ok: boolean, detail?: string, data?: any, error?: {code, message, field?} }` across all endpoints. |

---

## Recommendations Summary (RadiatingOutward)

1. **Condense telemetry** – expose only aggregated divergence metrics; keep full histories behind a secondary, optin endpoint.  
2. **Enrich error responses** – include field name, invalid value, and remediation hint; map known validation errors to humanreadable messages.  
3. **Standardize status payloads** – use consistent, typed JSON structures with explicit flags (`warning`, `status`, `severity`) to enable rapid visual scanning.  
4. **Version & document APIs** – especially those returning opaque objects (`consensus-map`, `operator-continuity`), to avoid breaking changes and to give operators predictable navigation.  
5. **Add UIfriendly flags** – e.g., `memory_warning`, `divergence_detected`, `bridge_status` to let the frontend render banners or alerts without additional clientside parsing.  

Implementing these changes will dramatically improve **scan speed**, **diagnostic confidence**, and **operator confidence** when investigating anomalies in the Dizzy simulation platform.  

---  

*Prepared by Kimi, Usability & DeveloperExperience Auditor*  
*Date: 20251103*