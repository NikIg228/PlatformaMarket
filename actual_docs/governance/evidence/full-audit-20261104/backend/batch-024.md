# Backend audit batch024

First28 identity sources fully read including auth service487lines, controller275,
mail delivery, current/personal sessions, invitations+redeem, MFA, OIDC, profile.
Personal bearer organization-free; workspace restoration rechecks live membership;
operator_password scope separated. Refresh CAS and replay revoke family; handoff
browser proof hash + one-use claim + origin/session locks. Email proof CAS guards
reset/verify; reset revokes active sessions transactionally. Verified signup claim
onboarding occurs after email consumption (recovery requires resume path, next batch).
Mail configuration prechecked; local private file mode restricted to loopback/nonprod;
provider 2s timeout redirect:error. Invitations lock org and user/advisory email,
revalidate roles/password hash/MFA; delivery compensates only matching token.
Profile optimistic version+audit, avatar linking compensation, email confirmation
requires active request session then revokes old sessions/proofs.

B-CAND029: AuthSessionsService.unlink478–484 counts external identities before the
transaction, then deletes only selected identity. Two concurrent provider deletes
can each see two, both succeed, leaving zero social methods for a passwordless user.
No same-user lock/Serializable/recheck. Existing social-unlink.spec remains next batch;
need root isolated controlled concurrent validation before confirmed finding.

MFA enrollment uses User lock and pending secret CAS; recovery-code CAS atomic.
Challenge TOTP lacks consumed time-step check, potential replay within validity;
existing parent MFA blocker unchanged, do not retry dynamic gate. OIDC Apple email
fallback accepts nonempty email even if explicit email_verified false; deployment
provider guarantee not examined, not asserted account compromise. OIDC JWT verify
checks issuer/audience/RS256 but no explicit exp-required; provider trust boundary.

Potential functional edge: profile email changes user's email but linked social
ExternalIdentity.email remains old; provider unchanged old email still matches
identity check, new address may not auto-link. Requires agreed product semantics.
No runtime tests or product edits in this batch.
