# Backend audit batch007

Six complete migrations,1716lines. Supplier foundation enforces nullable saleUnit
identity with COALESCE unique index and one ACTIVE base price. Supplier controls
add one ACTIVE contract price and one unresolved recall per lot. Commerce has one
active cart per buyer, checkout/cart and supplier/checkout uniqueness, scoped
checkout/reservation idempotency, allocation amount balance checks and immutable
ledger trigger preventing UPDATE/DELETE. No schema-only nullable-offer uniqueness
finding remains. Migration checks do not substitute for tenant authorization.

Integration foundation uses connection-scoped job/webhook/reservation keys,
positive attempt/version constraints and exclusive global/warehouse/offer binding
indexes. Jobs carry locks and maxAttempts; correctness still depends on executor.
Payment domain has positive transactions/captures and authorization ceiling,
allocation refund ceiling and balanced refund decomposition. Financial facts use
RESTRICT relations, while subordinate ingest/config rows often cascade. No live
migration or upgrade test run here. No new confirmed defect from these SQL files.

Payment output60-107 explicitly recovered after tool result truncation; all472lines
read. Root requests reconciliation of historical trust appeal transaction candidate
in current domains (decideIncidentAppeal/decideRatingAppeal), not historical PASS.
Next migration20260717003000_delivery_fulfillment.
