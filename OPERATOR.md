# OPERATOR.md
Operational Manual: Daily Protocols, Troubleshooting, and System Constraints.

---

## 1. Daily & Weekly Task Protocols

### Daily Protocols
1. **Health Check**
   - Query the local health endpoint to ensure authentication, safety configurations, and database connections are operational:
     ```bash
     curl http://127.0.0.1:3000/health
     ```

### Weekly Protocols
1. **State Synchronisation Audit**
   - Ensure the machine-readable state representation remains in lockstep with the design files:
     ```bash
     npm run check:state
     ```
   - If the check reports failures, regenerate `state.json` from `DESIGN.md`:
     ```bash
     node scripts/sync_state.mjs
     ```
2. **Prompt Drift Scanning**
   - Run the prompt drift check to assert prompt-pack behaviors and alignment:
     ```bash
     npm run check:prompt
     ```

---

## 2. Troubleshooting Model Drift & Anomalies

### Symptom: Model Hallucinates Private Knowledge on Public Interfaces
- **Cause**: The request zone is incorrectly parsed or database read-block middleware was bypassed.
- **Resolution**:
  1. Inspect the incoming request headers to ensure `x-dizzy-zone` is correctly resolved.
  2. Query `GET http://127.0.0.1:3000/state?zone=public` and verify no keys ending with `#private` or `#private_self` are visible.
  3. Re-run integration tests: `npm test`.

### Symptom: Stale State or Sync Disagreements
- **Cause**: Manual edits were made directly to `state.json` instead of updating the canonical `DESIGN.md` primary source.
- **Resolution**:
  1. Edit the `STATE_JSON` block in `DESIGN.md` to reflect the required schema updates.
  2. Run `node scripts/sync_state.mjs` to rebuild `state.json` and persist the canonical derived state.

---

## 3. Forbidden Operational Actions

> [!CAUTION]
> The following actions bypass core trust boundaries and are strictly prohibited:
>
> 1. **Unauthenticated Public Exposure**: Never expose endpoints beyond loopback (`127.0.0.1`) without configuring a strong `DIZZY_AUTH_TOKEN` in the environment.
> 2. **Monetization / Subscription Integrations**: Keep all monetization layers disabled or out of scope until on-chain portability standards (`PORTABILITY.md`) are verified.
