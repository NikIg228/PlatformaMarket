# Backend audit batch 001

Base af7149699aac16c0127df6852b231fb66f00b08b; fresh full reading, no historical PASS reused.
Inventory: 613 own text files, 57,784 text lines; 1 binary third-party font excluded.
1982 .tmp build/mail, .turbo and local-storage runtime artifacts explicitly listed as excluded.
node_modules/dist/.cache omitted as dependency/build trees. No nested AGENTS found.
Read 11 files, 479 lines (exact ranges/hashes in file-ledger.csv). No runtime checks.
Applied fully read Backend Architect and Code Reviewer practices: interfaces, invariants,
retry/idempotency, tenant boundary, migration compatibility and concrete evidence.

Architecture: Nest modular monolith. HTTP main rejects worker role; worker entry sets
role before dynamic import and validates queue/schedules/noHTTP capabilities. Worker
closes context on failed readiness. Serverless invokes same HTTP bootstrap, caches only
resolved express handler. Root composes core modules plus deployment-profile modules,
schedules conditionally; global rate limiter uses IP/user/organization buckets.
HTTP disables Nest body parser, enables rawBody, injects identity before logs/metrics,
sets JSON bigint replacement, helmet/CORS, global api prefix/filter and custom body parser.
Trust-proxy is one hop when enabled; actual identity sanitizer still unread.

Candidates requiring corroboration, not confirmed defects:
- B-CAND-001 api/index.ts:10-14: concurrent first requests can both create/init Nest,
  because cache stores the result only after awaits. Check serverless concurrency and
  duplicate resources/background ownership. Expected one initialization promise.
- B-CAND-002 api/index.ts:20-24: failed initialization returns200 for all paths beginning
  /api/health or /health, including readiness. Compare health contracts before assigning
  severity; expected readiness failure must not advertise ready.
- B-CAND-003 vercel.json:4 builds run catalog:sync-production:apply. Inspect script guards
  and provider deployment path; build must not unexpectedly mutate working production data.

Next: platform/runtime, environment and health/instrumentation; then security composition,
Prisma/schema/migrations and all domain files. No finding waived by old scan.