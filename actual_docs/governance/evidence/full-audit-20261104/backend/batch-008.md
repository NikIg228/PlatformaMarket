# Backend audit batch008

Nine complete migrations,2023lines. Delivery enforces amount/price-type/lead-time,
window and delivered-quantity bounds. Document trigger protects listed payload
fields only while OLD.immutableAt exists; archive/signing migrations must be read
before deciding whether direct reset or delete is reachable. Notification attempts
bounded; preference scope replaces nullable-user unique key. Its migration defaults
all existing scopeKey to organization without user-specific backfill, which can
collide for existing preferences: upgrade-path fixture must reflect actual supported
baseline; not yet raised as active defect for this initial rollout migration.

Search normalizes FTS using simple config/generated column+GIN; packaging checks
positive ratios/dimensions, net<=gross; override indexes permit one active target.
MFA factor one per user with encryptedSecret/recovery hashes; runtime replay checks
remain domain review. Marketplace agreement partial unique index covers only live
states, preserving arbitrary historical agreements (separate buyer/supplier candidate
still pending). Trust appeal tables have CAS version fields; atomicity is service work.

Commercial migration creates support/billing/AI/entitlement/upload/promotions rows
mostly without FK relations or DB amount checks; current schema consistent with this.
Do not infer reachable cross-tenant access from absent constraints alone. Actor and
entity referential checks must be traced in services. Financial/domain static SQL
review is not applied-migration or upgrade verification.

Cumulative95/613 API own text plus6external=101files,14649lines. Next registration
onboarding and remaining migrations, seed, license; then full domain sources/tests.
