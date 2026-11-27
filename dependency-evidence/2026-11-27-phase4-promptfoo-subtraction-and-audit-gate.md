# Phase 4 Capability Chokepoint Pass #1: Promptfoo Subtraction & Runtime Audit Gate

## Impact Classification

lockfile, runtime_dependency

## Affected Surface

- `package.json`
- `package-lock.json`
- `.github/workflows/ci.yml`

## Verification

- `npx -y npm@10.9.9 ci`
- `npm audit --omit=dev --audit-level=high`
- `npm audit`
- `npm run check:dependencies`
- `npm run maintain`
- `npm run check:eval-gate`
- `npm run check:council`

## Result

1. **Supply-Chain Subtraction (`promptfoo` removed from root `dependencies`)**:
   - Moved `"eval:context-assembler"` to pinned on-demand `npx --yes promptfoo@0.123.0 eval` and removed `promptfoo` from root `dependencies` (zero runtime modules import `promptfoo`; deterministic context-assembler behavior remains verified on every CI run by `scripts/unified_context_pipeline_test.mjs`).
   - Reduced `package-lock.json` from `1,004` to `106` packages (`-898` packages / `-89.4%` install surface), eliminating `34` non-runtime advisories and `6` blocked binary install scripts (`sharp`, `@playwright/browser-chromium`, `onnxruntime-node`, `@swc/core`, `esbuild`, `protobufjs`).
2. **Core Runtime Transitive Upgrades (`0` vulnerabilities)**:
   - `proxy-addr`: `2.0.7` -> `2.0.8` (resolved critical advisory)
   - `body-parser`: `2.2.2` -> `2.4.0` (resolved high advisory)
   - `undici`: `7.28.0` -> `7.30.2` (resolved high advisory)
   - `qs`: `6.15.2` -> `6.17.1` (resolved moderate advisory)
   - Both `npm audit --omit=dev --audit-level=high` and full `npm audit` now report `found 0 vulnerabilities`.
3. **CI Enforcement & Runner Modernization**:
   - Promoted `npm audit --omit=dev --audit-level=high` to a hard blocking CI step in `.github/workflows/ci.yml`.
   - Upgraded `actions/checkout`, `actions/setup-node`, and `actions/setup-python` to `@v6` to eliminate GitHub Actions Node 20 runner deprecation warnings.

## Rollback Path

Revert the commit updating `package.json`, `package-lock.json`, and `.github/workflows/ci.yml`, then run `npm ci`.

## Live-Check Gap

On-demand `npx --yes promptfoo@0.123.0 eval` requires registry network access when manually invoked; offline CI deterministic coverage of `lib/context_assembler.mjs` runs via `scripts/unified_context_pipeline_test.mjs` and `scripts/context_assembler_test.mjs`.
