# A0x Pattern Triage

Status date: 2026-06-16

Source:
- GitHub organization: `https://github.com/a0x-co`
- Public org description observed: AI x crypto powered agents, onchain AI agent platform, integrations such as Farcaster, X, XMTP, and Telegram.

This note translates relevant a0x patterns into Dizzy-local decisions. It is not an endorsement of copying a0x architecture or adding onchain execution.

## Borrow

### Explicit pivot and deprecation paths

Dizzy should keep Redis as the live queue authority and SQLite as a v0 smoke-test prototype until a formal pivot decision exists.

Borrowed rule:
- Every operational-store pivot must name the state authority, export path, rollback path, migration plan, crash-recovery proof, and deprecation path.

Local action:
- Added D-0037 to `DESIGN.md`.
- Added production-readiness gates for operational-store authority.

### Agent-native scoped capabilities

Useful pattern:
- time-bounded, parameter-bounded, revocable capabilities
- durable receipts for delegated action
- scoped execution rather than ambient authority

Local translation:
- Current `DIZZY_EXECUTE_TOKEN` and `DIZZY_NOTIFY_TOKEN` are coarse local/proxy scoped credentials.
- Future public/client capabilities should add expiry, revocation, parameter bounds, and audit receipts before being treated as hosted production features.

Do not import yet:
- EIP-712 signing
- wallet delegation
- onchain execution

Those become relevant only if Dizzy handles user funds, wallets, or signed actions.

### Regulatory and boundary awareness

Useful pattern:
- legal gates before user funds or regulated execution
- consent records
- kill switches

Local action:
- Expanded `LEGAL-GUARDRAILS.md`.
- Added production-readiness proof requirements for regulated actions and scoped signing.

## Do Not Borrow Yet

- trading-agent execution assumptions
- fee-share or token flywheel mechanics
- autonomous wallet signing
- public multi-tenant lifecycle without tenant isolation and legal review

## Open Future Work

- Design time-bounded scoped token semantics if Dizzy moves beyond local/proxy tokens.
- Add a revocation list and expiration checks only when there is a real exposed client surface.
- Write a kill-switch test before any regulated or funds-adjacent action exists.
