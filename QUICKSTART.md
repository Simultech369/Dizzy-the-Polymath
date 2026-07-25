# QUICKSTART.md - First Run & Orientation Guide

Welcome to **Dizzy** (clawd). This guide provides a 5-minute path to launch the local runtime, verify health, understand trust boundaries, and navigate the repository structure.

---

## 1. What Clawd / Dizzy Is (in Plain English)

Dizzy is a **local-first continuity-and-judgment runtime** designed to preserve operator orientation, enforce explicit trust boundaries, and maintain accountable memory.

It ensures that an assistant carries forward only the context that improves present agency, preventing private state leakage while maintaining auditability under repeat operational use.

---

## 2. ⚡ "Try Dizzy in 5 Minutes" Guided Walk-Through

### Step 1: Install Dependencies
Node.js 20.18.1+ is required. On Windows PowerShell, install local dependencies:

```powershell
npm.cmd install
```

### Step 2: Launch the Local Runtime
Start the local agent server:

```powershell
node .\agent_server.mjs
```

The server listens locally at `http://127.0.0.1:3000`.

### Step 3: Walkthrough Local Endpoints (`/health` & `/prompt`)
In a separate terminal window, test the local endpoints:

```powershell
# 1. Query health status
Invoke-RestMethod http://127.0.0.1:3000/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-07-25T14:30:00.000Z"
}
```

```powershell
# 2. Inspect active live prompt-pack bundle metadata
Invoke-RestMethod http://127.0.0.1:3000/prompt
```

**Expected Response**:
```json
{
  "status": "ok",
  "pack": "default",
  "budget_bytes": 60000,
  "sources": ["CONSTITUTIONAL_KERNEL.md", "IDENTITY.md", "SOUL.md", "TOOLS.md", "USER.md", "PROMPT_CORE.md"]
}
```

---

## 3. Trust-Zone Demo (Plain English)

Dizzy enforces 4 strict **Trust Zones** to control memory retention and context leakage:

| Trust Zone | Plain English Meaning | Default Retention Posture |
| :--- | :--- | :--- |
| **`private_self`** | Private strategy, architecture, personal memory, system design | Retained continuity & durable memory allowed |
| **`trusted_collaborator`** | Shared team work where selective context is useful | Selective continuity, narrower disclosure |
| **`outside_contact`** | Fresh-context interactions with external tools/users | Ephemeral, fresh-context reasoning by default |
| **`paid_public`** | Client / public work (marketplaces, API endpoints) | Ephemeral by default; scoped to `client_id + service_id` |

*Demo Rule*: A request tagged `paid_public` cannot read private repo memory or write to `private_self` memory.

---

## 4. How to Verify System Health

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

## 5. 🧭 Progressive Disclosure Reading Path

Navigate the repository according to your current depth of investigation:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     PROGRESSIVE DISCLOSURE PATH                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ 1. NEW USER           │ │ 2. INTERMEDIATE       │ │ 3. ADVANCED ARCHITECT │
│ First-Run & Overview  │ │ Operational Mechanics │ │ Doctrine & Governance │
│ ───────────────       │ │ ───────────────       │ │ ───────────────       │
│ • QUICKSTART.md       │ │ • REPO_GUIDE.md       │ │ • CONSTITUTION.md     │
│ • README.md           │ │ • OPERATING_LOOP.md   │ │ • MECHANISMS.md       │
│                       │ │ • FILE_ROLES.md       │ │ • CHOKEPOINTS.md      │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

---

## 6. Clawd Navigator Taxonomy Map

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

## 7. 🎨 Visual Identity & Color Semantics

Our interface visual system relies on three semantic color accents:

> **Operationally legible under repeat use. Calm at rest. Precise when live.**

### Tri-Accent Visual System
- ⬛ **Obsidian Base (`#0B0F0C` / `#111613`)**: Control, focus, atmosphere, and baseline state.
- ⚡ **Jazz Cyan Signal (`#00E5FF`)**: Luminous live execution, HTTP routing, active model dispatch, and capability receipt states.
- 🔶 **Warm Amber Accent (`#FFB300`)**: Operator judgment, continuity alerts, human intervention prompts, and attention gates.
