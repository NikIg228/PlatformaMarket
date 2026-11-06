# Backend audit batch043

Eight organization files fully read. Official contacts whitelisted publicly, reserve contacts
only after order access. Profile service active membership+capability+permission, serializable
expected org version and idempotency, validates city/ownership and invalidates geo only on
changed address. Shared legacy addresses split safely; suppliers require2 reserve contacts.
Requisites controller parses trusted own-org body, typed save/confirm/history; readiness
checks profile, legal form, bank account and effective current-date tax period, source snapshot.
Profile save returns current view after receipt rather than immutable response (documented
replay semantics not changed); actor not bound in organization-profile key but only authorized
same-org writers can replay. No new confirmed issue, no tests executed.
