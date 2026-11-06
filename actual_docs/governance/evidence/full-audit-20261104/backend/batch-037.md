# Backend audit batch037

All three onboarding files fully read. Intent returns bearer token, stores SHA, scoped by
email/bin/capability on replay; pending replay rotates token without status CAS (race may
invalidate concurrent flow, not yet classified). Claim binds verified email and token, claims
PENDING atomically and creates organization/membership/system owner role/acceptance/billing/
audit/outbox in transaction. Development completion is controller-gated nonproduction+loopback,
but service upserts user verification before claim validity checks; dev-only side effect.

B-CAND018 role follow-up: ownerPermissions SUPPLIER45–96 includes order.confirm but NOT
order.create, BUYER does include order.create21. If supplier order list remains order.create
(as recorded batch013), self-registered supplier_owner under ROLE_BASED cannot list orders.
Need compare current role seed/identity onboarding path and controller exact route before final.
Legacy onboarding progress502 returns platformOfferAccepted:true without acceptance lookup;
READY only counts any verified credential/source/offer, no publication/agreement. UI usage
needed before misleading readiness claim. No tests or working DB changes.
