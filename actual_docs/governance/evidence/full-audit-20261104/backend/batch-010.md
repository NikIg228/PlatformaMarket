# Backend audit batch010

Remaining17SQL migrations+lock,653line legacy seed and93line OFL fully read.
All57SQL migrations now read with hashes and complete ranges. Conversations enforce
context/parties/sequence and scoped idempotency; read markers require nonnegative
but upper bound belongs service. Requisites/invoice reservations protect payload and
confirmation via UPDATE triggers. Resupply one source shipment/discrepancy/reserve,
quantity limits. Identity signing has composite command-to-session principal FK,
10minute lifecycle limit, atomic CMS metadata, active-user/fingerprint uniqueness.
Admission partial active-org/pending-member indexes and evidence constraints present.
PersonalCart no checkout/payment link; supplier calendar/SLA additive snapshots,
no retrospective fake response evidence; escalation support link is paired and unique.

B-CAND013 seed.ts578: updateMany where cityId alone replaces geo coords/status/evidence
for ALL warehouses in five cities, including unrelated real tenants. Guard111 only
NODE_ENV production with ALLOW_PRODUCTION_SEED override. Root tracing profiles/wrapper
reachability; seed not executed. Requires disposable fixture to demonstrate write set.
B-CAND014 seed.ts614-638: each run new PDF object with default creation timestamp,
writeFile unconditionally overwrites seeded signed document path; upsert update:{}
preserves prior checksum and signatures. Later run can make stored bytes mismatch
immutable checksum. Need original PDF-library timestamp behavior validation; root notified.
Seed also updates demo offers/publication/freshness/roles/trust/mock merchants explicitly;
its synthetic signed EDS evidence is test data, cannot certify live signing readiness.

OFL license retained alongside Noto font; no missing-local-license finding. No DB tests,
seed, migrations or new processes executed. Next all remaining domain sources/tests.
