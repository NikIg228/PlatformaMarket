# Backend audit batch023

All nine identity-signing sources/tests fully read (675 lines). Identity binding is
JWT-only with User/session/org/membership row locks and live checks. Commands use
scoped idempotency, expected version, Serializable retries for P2034/P2002. AWAITING
challenge TTL is checked on submit; persisted receipt binds original/CMS hashes.
Worker uses SKIP LOCKED, 90s leases and two bounded verifier calls; temporary
failure stops automatic attempts at eight, remains UNKNOWN, permits manual retry.
Cancellation may retain late valid evidence but cannot bind identity. User and IIN
conflict checked inside Serializable binding transaction. Adapter pins policy hash,
uses shell:false, stdin secrets, 45s timeout and 44MB output bound; production rejects
TEST trust. Source tests cover authorization, replay, expiry and bounded adapter.

No new confirmed finding. Independent Java verifier is outside this API inventory;
parent must reconcile its review. Map generator only matches named @Controller,
so identity's empty @Controller() routes need explicit map reconciliation. Initial
listing accidentally included excluded generated paths and truncated; none counted.
Only subsequent bounded exact-source reads count toward ledger.
