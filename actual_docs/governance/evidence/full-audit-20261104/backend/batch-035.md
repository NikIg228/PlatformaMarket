# Backend audit batch035

All ten notification files read fully. Inbox filters allowed business events before paging,
scopes actor/organization and order target enrichment, bulk-read bounded by snapshot. Preference
selection gives event-specific override priority; notification create hashes input under scoped
idempotency key. Delivery conditionally claims attempt, external failures backoff then DEAD;
operator-only global process. Tests static only including disposable PostgreSQL guarded suite.

B-CAND038: processPending353 selects only PENDING/FAILED; claim371 writes PROCESSING but no
lease/timestamp recovery exists within module. Process death after claim or DB failure in
failure-record transaction leaves notification permanently excluded; retry202 allows only
FAILED/DEAD. Global recovery trace still needed before promotion.
B-CAND039: ProductCorrectionApproved/Rejected events have no *OrganizationId in payload
(product-corrections.service155/165); projection295–305 derives all recipients solely from
those keys, so returns0 and marks outbox handler successful. Inbox explicitly advertises both
events48/49 but supplier receives neither on approval/rejection. Source-confirmed missing
recipient contract, no runtime test.
quietHours persisted but never used in projection/send; source-level unimplemented setting,
check reachable preference UI before claim. No active processes or runtime changes.
