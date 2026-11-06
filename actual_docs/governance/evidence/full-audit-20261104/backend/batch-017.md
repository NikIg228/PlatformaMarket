# Backend audit batch017

Remaining26commerce files fully read. Entire commerce directory61files reviewed.
Manual order workflow checks roles before effects, locks order, binds replay to actor+
payload+tenant, checks order version and transactionally writes event/audit/outbox.
PaymentReduction inventory concern cleared: caller locks balances before function.
Payment policy checks primary/backup permission; recurring review falls back to org
if recipient revoked. Calendar snapshot validates persisted values and keeps existing
order deadline immutable. Personal cart deliberately has no checkout, guards verified
user/session, bounded500lines, CAS, exact quantity repricing and safe errors.
Workspace pages tenant-scoped in SQL and bound cursors; no cursor authority injection.

B-CAND023 reorder race: order-reorder9 reads empty active cart then13 unconditionally
abandons it. Caller order-workflow.service61–94 default READ COMMITTED transaction
locks SupplierOrder and reorder locks Organization, but CommerceService.addItem only
locks Cart CAS. Concurrent add after empty read can commit items before reorder's
unconditional update, then populated cart is abandoned. Compare recovery41 CAS guard.
Controlled interleaving realPG recommended; no dynamic proof yet.

B-CAND024 organizational offer status: resolve-cart-offer18–21 enforces active product,
variant and supplier organization ONLY personal buyer=null branch. Organization cart
can resolve inactive product from known offer ID; calendar checks SupplierProfile
ACTIVE but not Organization/Product. Warehouse/freshness predicates72–74 similarly
personal-only, though inventory reserve may recheck. Trace compliance/inventory
before final impact. No claim of successful prohibited checkout yet.

B-CAND025 payment review poison candidate: payment-review.service72–95 awaits each
claim transaction without per-claim catch; afterId advances only on success. One
persistent claim failure stops this tick and all following claims on each tick. New
response scheduler35–38 correctly rotates despite failure. Requires reproducible
valid persisted failure, so do not overstate current production starvation.

CommerceService.addItem upsert replaces accepted price/snapshot for existing offer,
unlike PersonalCartService.add89–96 preserves it. UI add behavior may supply current
price as implicit acceptance; needs explicit snapshot consent contract reconciliation.
Potential issue only, not counted independently yet.

No tests executed by worker. Runtime proof remains root responsibility.
