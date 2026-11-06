# Backend audit batch047

Final seven payments files full-read. Controller86–98 explicitly reread after outer output
truncation; full controller permissions/API schemas mapped. Ledger ownership intersects
requested filters and allocation metadata; tests cover supplier/buyer/operator boundaries.
Webhook HMAC binds timestamp/body and retries failed events10times, but PROCESSING claim58
has no lease/recovery in retryInbox50. Crash leaves event stuck; group with durable inbox risk.
Missing internal transaction webhook69 creates reconciliation record then marks event processed72;
no automatic linkage/replay after transaction later appears. Confirms B-CAND040 trace.
Invalid signed JSON parse97 yields empty object and accepted processed event; no money effect.

B-CAND042: payments.service56–58 uses calculateAllocation default200bps and immutable fee
snapshot rateBasisPoints200 (2%), while owner business contract base10% in task checkpoint.
This is actual payment allocation path, not just unused utility. Need root product requirement
reconciliation before severity; no provider activation asserted. createIntent serializable locks
orders and checks current version/payment/manual invoice; cancelled order anywhere blocks entire
checkout despite error saying confirmed or rejected. Order enum semantics need follow-up.

Quantity cross-check requested by frontend: commerce-rules60–67 uses (quantity-minimum)/increment;
personal-cart81 and resolve-cart-offer94–101 call it. min3step2 permits3,5 and rejects4.
Communicated to frontend; no runtime tests.

Requirements reconciliation from documentation reviewer: B-CAND042 is ALREADY DOCUMENTED OPEN
conflict of two monetary models, not new choice or safe constant change. Current functional map72
and432 sets10% received goods afterdiscount, no delivery/overpayment, forbids2%+10%; unifiedspec286,
344,558,1128AT20,1411T9 explicitly requires contractual fee/ledger/event/monthly/refund reconciliation,
not mechanical200→1000. Questions131 and03.11V14 preserve10%, tax inclusion pending. Group as known
production gap and avoid duplicate/new finding credit.
