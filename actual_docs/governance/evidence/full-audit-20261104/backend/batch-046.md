# Backend audit batch046

Six payment files fully read, including settlement464lines. Initial combined output truncated;
missing rules/helper/test and settlement1–348 explicitly reread in bounded ranges before ledger.
Merchant accounts organization/operator scoped; binding review reads PENDING outside transaction
and writes without CAS, similar concurrency pattern to product corrections (candidate only).
BigInt cumulative proportional refund preserves final fee remainder; tests cover rounding,
over-refunds, exclusive processing, supplier reconciliation redaction. Tests not executed.

B-CAND040: durable payment recovery incomplete. authorize97/capture123/cancel277 reject
PROCESSING before durable-success recovery; provider result persisted104/142/282 before
financial transaction. Crash/transaction failure after remote success strands intent, unlike
explicit refund recovery313–342. processPayout390 similarly rejects PROCESSING before stored
success recovery after provider397–398. applyProviderWebhook requires existing transaction197;
transaction absent after local commit failure cannot be repaired there. reconcile411 only
compares internal records, does not poll provider or repair state. Pending FAILED/CANCELLED
webhook203 returns before restoring intent/payout/refund status, leaving PROCESSING entities.
Need webhook matching full read next and root isolated proof before final severity.

B-CAND041: capture138/140 and cancel279/281 send parentExternalId as authorization.paymentTransactionId
(local UUID), whereas PaymentTransaction.externalTransactionId holds remote reference. Mock hides
this; external adapter contract forwards payload unchanged (batch045). Likely external integration
failure for providers requiring remote authorization ID; no real provider validation.

Other static limits: captureAllocation177 skips absent/inactive reservation yet marks order PAID174;
expired-reservation race requires lifecycle trace. Refund and payout concurrency use different claims;
payout394 only locks payout while refund budget locks intent344, possible stale payout amount despite
refund adjustment370. Not promoted without focused concurrency trace/probe. No runtime changes.
