# Backend audit batch061

Six remaining trust files full-read; service95–158 reread after tool truncation.
B-CAND046 decideIncidentAppeal84 commits terminal appeal before incident+audit87-90;
failure leaves decided appeal with unresolved/blocked incident, retry84 fails status
CAS. Unlike rating appeal transaction289, incident decision is split. Rating appeal
recompute297 is also after terminal commit; failure leaves stale snapshot until manual
recompute, retry rejects. Fault injection needed for runtime confirmation.
B-CAND047 appealIncident74 sets UNDER_APPEAL while retaining HARD_BLOCK/actionType;
recommendations only query HARD_BLOCKED/SOFT_ACTION_ACTIVE61, thus open appeal can
remove effective critical-risk exclusion despite no operator decision. Need checkout
and other consumers trace to bound severity; this confirms recommendation path only.
Legacy updateIncident57 can resolve without pending-appeal check imposed newer operator
resolve102. Operator restored path and old generic PATCH coexist. Appeal creation
unconditionally updates incident status so concurrent restore may be overwritten.
Order comments named private actually shared both order participants by96; requires
business meaning check, no data-leak claim solely name. VerifiedReview supplier listing
returns full record to other buyers161 (reviewer IDs, order ID, idempotencyKey) unlike
public product projection165; data-minimization caution pending contract.
No tests executed.
