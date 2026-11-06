# Backend audit batch031

Seven inventory sources fully read. Truncated test middle explicitly reread complete
(data-override-permissions and initial-offer-inventory). Permission tests cover PRICE
requiring inventory.adjust plus pricing.manage, operator context and inactive membership.
Exact price minor string preserved through Prisma.Decimal. Freshness transitions CAS
version/source/lastSuccessfulSyncAt/expiresAt and avoid pausing if another fresh balance.

B-CAND036: manual inventory override reads balance outside transaction at data-freshness
57, validates against that snapshot64–66, then writes snapshot quantityReserved90/93
unconditionally. A checkout reserve committed after57 before transaction68 is overwritten
by93; Serializable inside callback does not cover the earlier read. Explicit supplied
quantityReserved also can disconnect aggregate from live reservation rows; schema scope
needs confirmation. Existing override permission tests only mock writes, no race coverage.
Potential secondary: current override read60 outside transaction allows multiple ACTIVE
overrides when two initial creates see none; price row lock72 occurs after override create.
No test runs or runtime modification.
