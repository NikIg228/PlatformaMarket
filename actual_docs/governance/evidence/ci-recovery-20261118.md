# CI recovery before mobile order scenarios — 2026-11-18

Owner scope: resolve CI failures and obtain passing checks, then execute the full
mobile order scenarios. No CDEK/provider calls or cloud deployment. Base c3ed0f18,
canonical main checkout; pre-existing product WIP remains excluded.

## Findings and minimal changes

1. Security dependencies failed on picomatch advisory GHSA-fc5q-39xc-vjpf.
   The [advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) was withdrawn
   on18November. Fresh audit:0high/0critical,2moderate; `npm audit --audit-level=high`
   exit0 with unchanged package/lock files. Rerun of Security44354075420 completed
   SUCCESS for dependencies and CodeQL. No audit suppression or forced downgrade.
2. PostgreSQL job timed out waiting for API readiness; its log hid the last HTTP
   or transport failure. Reproduced runner flaw: default4400+pid%1000 can select
   5060/5061; Node fetch rejects these ports even when a healthy server listens.
   Default now uses49152..59151 and rejects unsafe explicit overrides. Readiness
   failure retains endpoint and sanitized HTTP/transport reason. Original timeout
   cause cannot be proven from the old log; new CI is needed for confirmation.
3. Canonical browser job failed5 expectations left behind by the accepted session
   redirect/feedback change in46d65a7b. Tests now require the real login destination,
   signedOut marker and returnTo path for guests/revocation, or the current shared
   error heading for rejected handoffs. Existing401, absent session/cookie, valid
   browser exchange, one-use code and no organization-data request checks remain.
   No application authentication behavior or acceptance requirement was weakened.

## Local checks

- Node port/readiness regression suites:8PASS, including actual HTTP fetch for
  the PID suffix formerly mapped to5060.
- Full PostgreSQL gate entry point:PASS using approved disposable audit DB:
  `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs`.
  Existing API/schema builds reused: no API/schema/dependency inputs changed.
- Shared session-required/use-workspace-session tests:6PASS.
- Scoped ESLint for the three changed browser suites:PASS.
- Focused TypeScript config covering changed suites and imports:PASS.
  Whole E2E types encountered an unrelated existing dirty-schema mismatch in
  workspace-list-volume.spec.ts: agreedProposalSnapshot JsonValue null in cloned
  SupplierOrder. Clean published baseline CI typecheck passed. That unrelated
  unpublished product WIP was not included or rewritten to hide the mismatch.
- Browser execution on the clean published candidate is delegated to the existing
  CI job; local canonical3000/4012 are occupied by the owner's ongoing test stand.
  No developer process was stopped or reused against the audit DB.

Logs: ignored `.tmp/order-cycle-20261118/ci-fix-audit*.json/log`,
`ci-fix-postgres.log`, `ci-auth-contract.log`, `ci-focused-types.log`.
Final remote checks remain pending until the new candidate finishes. Mobile
scenarios remain NOT_RUN in this phase; preparation is not mobile acceptance.
