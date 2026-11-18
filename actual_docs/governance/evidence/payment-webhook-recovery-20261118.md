# Payment webhook recovery — 2026-11-18

Scope: owner requested correction of stranded PROCESSING notifications, repeat
verification and out-of-order handling. No CDEK/provider calls, money transfers,
cloud deployment, new payment policy, schema change or UI change. Internal recovery
uses the existing webhook endpoint and scheduler; no new user action is needed.

Candidate: main, base 46d65a7b, canonical PlatformaMarket checkout. Pre-existing
39 tracked dirty files preserved. Only two payment services, a regression suite,
this evidence and the payment technical reference belong to the implementation.
The shared session checkpoint retains the broader unfinished order-cycle work.

## Change and invariants

- Previously PROCESSING was excluded from retries. Claims older than 5 minutes
  are now eligible; attempt number is a monotonic ownership fence. Active claims
  are untouched. Stale attempt 10 becomes DEAD_LETTER, with no further effects.
- An inbox row lock covers settlement and acknowledgement in one transaction.
  Failure before acknowledgement rolls back the payment, ledger, order and outbox
  changes. A previous owner cannot overwrite a replacement's result or failure.
- PaymentIntent row locking serializes different callbacks for the same payment.
  Successful transactions are not applied again; stale non-success callbacks
  cannot undo success. FAILED/CANCELLED do not regress to PROCESSING.
- Authorization arriving after capture/refund/cancellation cannot lower the intent
  state. Refund before capture remains retryable. Void after capture, or capture
  after cancellation, raises a conflict for reconciliation instead of overwriting
  the confirmed state. The existing ability to accept confirmed success following
  an earlier failed transaction is retained.
- A callback before its internal transaction remains FAILED/retryable, with one
  MISSING_INTERNAL reconciliation entry per event; the entry resolves on success.
  Receive returns the persisted processing status rather than unconditional success.
- HMAC verification, provider binding and payload identity guards are preserved.

## Verification

| Check | Result |
| --- | --- |
| `payment-webhook-recovery.postgres.spec.ts` against local disposable PG on 5434 | 12 PASS |
| Payment suites plus payment-captured outbox and integration webhook suites | 49 PASS; PG suite skipped in this isolated run, executed separately above |
| Original stranded event plus a fresh interruption immediately after claim, compiled services | PASS: both PROCESSED, attempt 2 |
| API typecheck and scoped ESLint | PASS |
| API Nest build with existing equivalent generated Prisma client | PASS |
| Full PostgreSQL verification entry point from `verify:postgres` | PASS on disposable dentmarket_audit_20260914 |

The 12 PG cases cover stale/fresh claims, cron dead-letter limit, two reclaimers,
stale owner fencing, signature/payload/provider isolation, atomic money rollback,
callback before transaction, late authorization and stale statuses, concurrent
success event IDs, early refund then one refund, conflicting void, failure then
pending then confirmed success. Capture produces two ledger entries (900 net/100
fee); full refund produces two reversals, with refunded amount exactly 1000.
These synthetic ledger fixtures test the existing implementation, not approval of
a banking split model. No bank adapter is invoked. Fixtures are retained locally.

The original failure event d910f223-d68c-465f-981f-5ef1288aab6b is now PROCESSED
at attempt 2. Fresh regression recreates the after-claim exception, ages only the
fixture timestamp by 301 seconds, and recovers with a new service instance.
No claim that a new real process kill or a five-minute wall-clock wait was used.
Earlier order-operation SIGKILL evidence remains separate.

Logs under ignored `.tmp/order-cycle-20261118/`: webhook-recovery-pg-final2.log,
webhook-payment-suites.log, webhook-fixed-replay.json, webhook-types-final2.log,
webhook-lint.log, webhook-build.log, webhook-postgres-gate-3.log.

Attempt history: initial test syntax typo, active-cart fixture uniqueness and
lowercase synthetic provider code were corrected; final PG run passes. The standard
`npm run verify:postgres` stopped at Prisma DLL rename EPERM because a running
process holds the Windows engine. Generated schema was compared with source:
identical ignoring whitespace and blank lines. No schema or dependency change was
needed. Schemas build passed; `npm --ignore-scripts run build --workspace=@marketplace/api`
completed using that client. First direct PG entry-point attempt preceded build
completion and found no module; after build exit 0, the same entry point completed
fully, including migrations, test seed, upgrade checks and cleanup. No guard or
assertion was disabled. The supported equivalent invocation is
`npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` after build.

## Limits

Five-minute lease and ten-attempt budget are bounded internal recovery, not an
external provider SLA. Permanent contradictory confirmations still require
reconciliation; this change does not decide which provider fact is authoritative.
No live bank certification, full production order acceptance or cloud deployment
is claimed. UI, runtime composition and public schema are unchanged, so no browser,
runtime-split or contract-generation gate was added for this internal fix.
