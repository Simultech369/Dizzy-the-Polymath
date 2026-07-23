# QUICKSTART.md - First Run & Orientation Guide

Welcome to **Dizzy** (clawd). This guide provides a 5-minute path to launch the local runtime, verify health, and navigate the repository structure.

---

## 1. What Clawd / Dizzy Is (in Plain English)

Dizzy is a **local-first continuity-and-judgment runtime** designed to preserve operator orientation, enforce explicit trust boundaries, and maintain accountable memory.

It ensures that an assistant carries forward only the context that improves present agency, preventing private state leakage while maintaining auditability under repeat operational use.

---

## 2. 5-Minute First-Run Path

### Step 1: Install Dependencies
Node.js 20.18.1+ is required. On Windows PowerShell, use `npm.cmd`:

```powershell
npm.cmd install
```

### Step 2: Launch the Local Runtime
Start the local agent server:

```powershell
node .\agent_server.mjs
```

The server listens on `http://127.0.0.1:3000` by default.

### Step 3: Verify Local Endpoint
In a separate terminal window, query the local `/health` and `/prompt` endpoints:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/prompt
```

---

## 3. How to Verify System Health

Run these three standard commands to verify repository state and execution integrity:

```powershell
# 1. Run quick smoke suite (health, prompt, memory, queue sanity checks)
npm.cmd run smoke

# 2. Run comprehensive unit and governance test suite
npm.cmd test

# 3. Run operator maintenance check (scans root file roles & active upgrade metadata)
npm.cmd run maintain
```

---

## 4. Clawd Navigator - Where to Look Next

To explore the codebase without reading every file first, follow this functional taxonomy map:

```text
+--------------------------------------------------------------------------+
|                            CLAWD NAVIGATOR                               |
+------------------+------------------+------------------+-----------------+
|  1. RUNTIME      |  2. DOCTRINE     |  3. REVIEWS      |  4. SURFACES    |
|  agent_server    |  CONSTITUTION    |  reviews/        |  dashboard/     |
|  worker.mjs      |  PROMPT_CORE     |  Review trails,  |  canvas/        |
|  lib/ modules    |  identity/       |  audits & notes  |  UI Interfaces  |
+------------------+------------------+------------------+-----------------+
                                   |
                                   v
         See full taxonomy in [REPO_GUIDE.md](REPO_GUIDE.md) & [FILE_ROLES.md](FILE_ROLES.md)
```

| Layer | Primary Files | Role & Authority |
| --- | --- | --- |
| **Runtime Core** | [`agent_server.mjs`](agent_server.mjs), [`lib/`](lib/) | Active HTTP execution, routing, prompt bundling, security headers |
| **Governance & Doctrine** | [`CONSTITUTION.md`](CONSTITUTION.md), [`PROMPT_CORE.md`](PROMPT_CORE.md) | High authority - defines prompt packs, memory rules, and trust zones |
| **System Mechanics** | [`DESIGN.md`](DESIGN.md), [`FILE_ROLES.md`](FILE_ROLES.md) | Canonical decision record & root-file authority map |
| **Review Artifacts** | [`reviews/`](reviews/) | Historical audit trails, model reviews, and exploratory proposals (non-runtime) |
| **User Interfaces** | [`dashboard/`](dashboard/), [`canvas/`](canvas/) | Operator telemetry HUD & static canvas surfaces |

---

## 5. Visual Identity v0 Strategy

Our interface identity adheres to three core design principles:

> **Operationally legible under repeat use.**
> **Calm at rest.**
> **Precise when live.**

### Tri-Layer Visual Architecture
- **Layer 1 (Warm Tactical Base)**: Deep charcoal-navy atmosphere (`#0B0F0C` / `#111613`) providing high contrast without eye strain.
- **Layer 2 (Jazz Cyan Live Signal)**: Luminous Jazz Cyan (`#00E5FF`) illuminates **strictly** during active execution, routing, receipt, or live status states. Zero decorative glow on idle elements.
- **Layer 3 (Industrial Monolith Restraint)**: Crisp 1px structural borders, monospace code typography (`JetBrains Mono`), and clear layout whitespace.
