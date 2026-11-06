# Backend audit batch045

Owners3 + payment adapters/tests6 files fully read. Owner views scoped organization; saved
list ownership checked; cost-center reference scoped on budget create. Legacy dashboards
sum subtotal of paid/partially-refunded orders (no refund subtraction), buyer month UTC,
supplier rolling30days; label/reachability needed before metric issue. Concurrent default
list creates can both stay default; no invariant check seen, not promoted.
Payment HTTP adapter uses15s timeout, Bearer configured endpoint, forwards idempotency header,
normalizes external status; mock deterministic IDs. Admission rejects MOCK production/external
mode. Real gateway result schema minimally checked externalId only, checkoutUrl/expiresAt
unvalidated; no external provider run. Tests static verify headers/stable mock references.
