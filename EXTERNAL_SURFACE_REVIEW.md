# External Surface Review

Purpose: review any public form, auth provider, edge provider, hosted database, or client-facing storage before it becomes part of Dizzy's outside surface.

Use this before adding or enabling a provider such as Cloudflare, Supabase, Firebase, Clerk, a form service, CRM, analytics tool, hosted database, or object store.

This is a gate template, not a launch approval by itself.

---

## 1. Surface

- **Surface name:**
- **Trigger:** (public URL / client account / submission form / hosted storage / proxy or tunnel / other)
- **Provider(s):**
- **Trust zone:** (private_self / trusted_collaborator / outside_contact / paid_public)
- **Launch mode:** (planning / local test / private beta / public)
- **Owner:**

## 2. Purpose And Non-Purpose

- **Purpose:** What user or operator need does this surface serve?
- **Non-purpose:** What should this surface not collect, decide, remember, or automate?
- **Success signal:** What proves this surface is useful enough to keep?
- **Removal signal:** What failure or drift means it should be disabled?

## 3. Data Collected

| Field | Required? | Sensitivity | Purpose | Stored where? | Retention |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

Rules:
- Collect the minimum viable fields.
- Do not collect identity data just because the provider makes it easy.
- Bot-trap or honeypot fields may be used only for abuse prevention; they must not imply user consent or intent.

## 4. Data Flow

Describe the full path:

```text
browser/client -> edge/proxy -> runtime/API -> database/storage/provider logs -> operator workflow
```

- **Public entry point:**
- **Server endpoint:**
- **Storage destination:**
- **Provider logs/analytics:**
- **Model or tool exposure:**
- **Human review point:**

## 5. Authority Boundaries

- **Provider role:** (edge/proxy / login/session / database / storage / form transport / analytics / other)
- **Provider is not authority for:** (private memory / Dizzy continuity / deletion semantics / identity mapping / client lifecycle / other)
- **Dizzy-owned rule still applies:**
- **Export path:**
- **Deletion/revocation path:**
- **Rollback/removal path:**

## 6. Secrets And Client Bundle Boundary

- **Server-only secrets:**
- **Browser-visible keys:**
- **Why each browser-visible key is safe to expose:**
- **Secret scan command/evidence:**
- **Source maps policy:**

Non-negotiable:
- `DIZZY_AUTH_TOKEN`, provider secret keys, service-role credentials, database URLs, API keys, bot tokens, and signing keys stay server-only.

## 7. Auth, Isolation, And Abuse Controls

- **Auth model:**
- **Tenant/user isolation proof:**
- **RLS/security rules/policy proof, if database-backed:**
- **CORS/CSRF posture:**
- **Rate limits:**
- **Request size limits:**
- **Spam/abuse handling:**
- **Error behavior:**

## 8. Retention And Notice

- **User-facing notice:** What does the user see before submitting or authenticating?
- **Retention duration:**
- **Deletion process:**
- **Export process:**
- **Provider log retention:**
- **Private-context exclusion:** What prevents private Dizzy memory from entering this surface?

## 9. Evidence Checklist

- [ ] Data-flow map completed
- [ ] Field minimization reviewed
- [ ] Provider role and authority boundary written
- [ ] Server-only secrets identified
- [ ] Browser bundle secret scan completed
- [ ] Route/auth inventory updated
- [ ] Tenant isolation or RLS/security-rule proof captured, if applicable
- [ ] Rate-limit proof captured for public routes
- [ ] Retention/delete/export path documented
- [ ] Rollback/removal path tested or rehearsed

## 10. Decision

- **Decision:** (approve / approve with limits / defer / reject)
- **Limits or expiration:**
- **Evidence location:**
- **Reviewer:**
- **Date:**
