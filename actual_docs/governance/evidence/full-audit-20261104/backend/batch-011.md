# Backend audit batch011

Complete access-control12files and buyer-supplier-agreements4files (1148lines).
RBAC uses active user/org/membership and tenant-owned roles, denies assigning perms
actor lacks. FULL_ACCESS explicit mode still requires active membership/capabilities
and freezes role mutations; not treated as vulnerability absent deployment misuse.
Role mutations serialize on organization row, recheck authority, audit+outbox in tx;
blocking/revocation removes active auth sessions and pending invitations. Last manager
checks mostly present. removeRole count250 lacks active-user predicate used in
requireRemainingManager278; need reachable blocked-user manager before finding.
Tests cover role/permission/capability boundaries but no role-management dedicated
spec here; root suite may cover its DB concurrency. Guard identity headers rely on
previously-reviewed trusted global authentication rewrite; not raw header trust claim.

B-CAND012 concrete: agreement.processRenewals84 transitions due NON_RENEWING/manual
ACTIVE to EXPIRED. Unconditional parties,status unique means second EXPIRED history
fails P2002. GET current33 and initiate40 call it, so both fail until resolved.
Existing29line spec only effective-date/current-party filter, no repeated lifecycle.
No live SQL reproduction yet. Document generation before agreement transaction is
archived only on P2002; other failures can leave generated document without agreement.
Reconcile80 and renewal84 use read-then-unconditional update; concurrent renewal can
increment renewalCount twice, same resulting dates. requestNonRenewal82 no audit/CAS,
though authority controller and party checks exist. Not all independent candidates
promoted without scenario severity/context. Expired auth signing available only
AWAITING_SIGNATURE. Framework supplier/buyer must both EDS-sign and doc SIGNED.

Legacy seed candidates are conditional explicit prisma:seed:legacy invocation.
Root confirmed standard root db:seed routes new reference/operator seed-profile;
no claim standard seed executes legacy code. Cumulative155API+6root=161files17992lines.
