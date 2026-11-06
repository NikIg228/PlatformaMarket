# Backend audit batch009

Next24migrations fully read. BuyerSupplierAgreement candidate B-CAND012 confirmed
as database design: parties+status unconditional unique applies to terminal history,
unlike MarketplaceAgreement partial live-only index. Need lifecycle service trigger
before declaring user-visible failure. Registration stores consent/token hash,
platform acceptance one per organization and intent; later supplier terms acceptance
adds org/bundle/version evidence and admission review. No migration invented existing
profile completion or acceptance. ConnectorReadiness is registry data, not live proof.

Archive backfills document categories/dates and parties from actual orders/agreements;
new financial links use SET NULL and participants FK organization RESTRICT. Does not
replace immutable-payload trigger. Import rollback/outbox retry fields are additive;
PROCESSING outbox recovered to FAILED on migration. Encrypted integration config
columns added without rewriting plaintext here; runtime migration/cleanup pending.

Manual money: positive claims, review-state checks, one pending reduction with strictly
smaller positive amount, one open return per order and unique refund document. Returns
kind/state restricted; transaction/stock/refund consistency remains service review.
Promotion approved-price trigger locks SupplierOffer before checking applicable active
or paused approved promotion; protects base amount/currency at DB boundary. Gift order
item checks require zero money and no cartItem; nullable cartItem for gifts intentional.

No migrations executed. Product-content confidence and history rows rely partly on
application validation; absent FK/check alone not reported as reachability defect.
Next20261002120000_internal_conversations and all remaining migrations.
