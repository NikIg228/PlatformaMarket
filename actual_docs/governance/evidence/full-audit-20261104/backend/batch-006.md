# Backend audit batch006

Full OpenAPI3files/572lines plus complete schema4784lines read. Cumulative79/613 app
text files+6external,10199lines. Schema exact12 ranges and SHA recorded; no schema/runtime
validation run and no previous migration PASS imported.

Schema maps identity/session/MFA, organizations/membership/RBAC/requisites, catalog,
external source/import/mapping, supplier offers/prices/stock/lots/reservations, carts,
checkout/supplier orders/workflows/discrepancies/resupply, payment merchant/attempt/
allocation/transactions/ledger/refund, shipment/steps, document versions/signatures,
compliance/notifications, ERP agents/jobs/webhooks/reconciliation, promotions, saved lists,
budgets/support/billing/AI, agreements/trust/geo/recommendations, audit/outbox/idempotency,
conversations and signing identity/admission. These entities are not proof of reachable UI.

Money uses scale0 Decimal minor amounts; fractional quantities6decimal. Snapshot/version
fields present for order prices/inventory, requisites, admissions and signatures.
Idempotency tenant/aggregate-scoped for checkout/reservations/order commands; some global
keys (notification/ledger/promotions) require caller namespacing review. IntegrationAgent
is software connector, no referral attribution/payout models found in complete schema.
PersonalCart owns user uniquely, no personal checkout/order relation; B2C gap remains
implementation question. Generic FinancialLedger exists; does not prove new commission
statement/credit/cash/debt requirements. Pending owner decisions remain pending.

Relations generally Restrict commerce/legal facts; catalog/source entities use Cascade
or SetNull. Several support/billing/AI/trust models use scalar references without Prisma
relations; inspect migration constraints and service authorization before asserting breach.
Nullable unique keys need PG-aware handling (Role global organizationId null, offer
saleUnit null). No unconditional duplication finding from schema alone.
B-CAND012: BuyerSupplierAgreement @@unique(supplier,buyer,status) applies even expired/
terminated, potentially prevents repeated historical lifecycle. Read service+migration.
Identity-signing composite session/user/org/authSession FK and partial active uniqueness
are intentionally migration-managed; review SQL before acceptance.

OpenAPI registry imports executable schemas; decorators document but don't authorize.
Public search strips buyer organization; runtime docs disabled in production with test.
B-CAND011: conversion uses io=input only name suffix Request/Query; many actual body
names omit suffix. Need concrete default/coercion mismatch; root contract reviewer informed.

Next: all57 SQL migrations plus lockfile and seed, then all476 domain source/test files.
