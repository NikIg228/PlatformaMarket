# Backend audit batch048

All five pricing files read. SupplierAccess checked before offer access; contract buyer must
have BUYER capability. Deterministic resolver contract priority then highest threshold then ID;
tier highest threshold; base last. Tests cover precedence and inclusive ranges.
Tier overlap check27–28 ignores validity dates and rejects future nonoverlapping date replacement
for same quantities; no delete/update route here. Concurrency check outside transaction may allow
overlap (unless DB constraint); potential functional limitation, not yet promoted.
Contract replacement inactivates previous all currencies50; new future validFrom may leave current
contract gap. No accepted scheduling requirement asserted. Resolve lacks requested currency
parameter, while checkout path separately filters currency; not conflated with checkout bug.
