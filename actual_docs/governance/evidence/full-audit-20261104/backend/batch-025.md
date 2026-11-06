# Backend audit batch025

Remaining eight identity sources/tests fully read; identity36/36 complete.
Registration resume validates hashed proof bound to registrationId/email/BIN/capability,
one-use proof row is locked before registration claim, correct existing password does
not replace credentials and ACTIVE MFA accounts denied. Failed password counters
commit, then Unauthorized thrown outside transaction. Onboarding claim participates in
same transaction. Consumed proof returns stable non-secret receipt. Tests cover error
branches but mocks do not establish real rollback/concurrency guarantees.
Logout validates signed subject/jti/issuer/audience/iat/exp; expired proof only terminal
receipt; locks target+persisted origin in id order and verifies authentication class.
Does not revoke unrelated login. Existing social-unlink tests cover actor ownership
and last-method refusal sequentially, not concurrent two-provider removal. B-CAND029
remains viable candidate. No dynamic runs.
