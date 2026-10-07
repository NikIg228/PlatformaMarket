# Production authentication and rate-limit runbook

This runbook is the operational companion for B4.4. It describes the controls
that must be verified before a go-live deployment and the response steps for
authentication or abuse incidents. It does not replace the deployment release
contract or provider-specific incident procedures.

## Production invariants

- `NODE_ENV=production`, `DEPLOYMENT_PROFILE=go_live` and `AUTH_MODE=jwt` are
  mandatory. Development identity headers are never accepted in production.
- JWT validation requires the configured issuer, audience, signing key and an
  `AuthSession` that is active, unexpired and bound to the requested tenant.
- `JWT_REQUIRE_MFA=true` is mandatory for production. Operators and financial
  roles must complete TOTP MFA before receiving an elevated access token.
- Refresh tokens are stored only as hashes, rotated on use, and a replay of an
  old token revokes its token family. Refresh cookies are `HttpOnly`, `Secure`
  in production and protected by the double-submit CSRF cookie.
- Production rate limiting uses the shared Redis deployment. A process-local
  limiter is allowed only for development/test or a pilot process that is not
  horizontally scaled. If Redis is unavailable in production, requests fail
  closed with a controlled `503` rather than silently disabling the control.

## Rate-limit policy

The default window is 60 seconds. The global limits are currently:

| Dimension | Limit | Tracker |
| --- | ---: | --- |
| IP | 240 requests/window | trusted client IP |
| User | 480 requests/window | authenticated user, otherwise IP |
| Tenant | 1200 requests/window | active tenant, otherwise IP |

Sensitive route classes have stricter limits:

- authentication: 20/IP, 30/user, 60/tenant per minute;
- personal email change: 10/IP, 5/user, 30/tenant per minute;
- profile photo upload: 20/IP, 10/user, 60/tenant per minute;
- onboarding: 8/IP, 8/user, 8/tenant per minute for the protected mutations;
- integration and payment webhooks: 120/IP per minute.

Every limited response exposes the dimension-specific limit, remaining count
and reset time. A throttled response must also expose a generic `Retry-After`
header and the stable error code `RATE_LIMIT_EXCEEDED` in the normal API error
envelope. Clients must back off; they must not retry in a tight loop.

## Deployment checklist

### Personal profile contract (08.10.2026)

`GET/POST /auth/profile` reads/edits the authenticated session owner's name and
phone. The actor, session and active membership are rechecked in the service;
the request cannot select another user. Writes use `expectedVersion` and audit
in the same transaction. Existing users may have no phone until they fill it in;
an edited phone is required and cannot be saved empty.

`POST /auth/profile/email` requests verification at the new address through the
existing auth mail delivery. The old login remains unchanged until the one-use
`/auth/email/verify` proof is consumed. The requesting session must still be
active; a stale/used/expired proof or an occupied address is rejected. Confirming
the address atomically invalidates outstanding email proofs and existing sessions;
the normal verification flow establishes a new session with the new address.
Delivery failure invalidates the undelivered proof; it never changes the login.
`LOCAL_FILE` is local evidence only, not external delivery.

`POST /auth/profile/avatar` accepts PNG/JPEG up to 2 MiB through the existing
upload policy and scanner. `GET /auth/profile/avatar` returns the owner's clean
image as bounded base64 JSON; no public object URL is exposed. Both reads are
`no-store`. Failed linking releases the asset; replaced assets are reclaimed by
the existing unlinked-upload cleanup. The avatar route alone has the additional
JSON allowance for base64, without raising the ordinary request-body limit.

Apply migration `20261007190000_profile_contacts` before starting the new API:
it adds nullable `User.phone`/`avatarAssetId`, `profileVersion=1`, and
`OrganizationProfile.additionalContacts=[]`. Existing values are retained.
Organization writes keep primary contacts, permissions, version and idempotency;
omitted additional contacts from older clients preserve the stored list. The
maximum is ten contacts including the primary. Contact-only edits preserve
unchanged address verification. Working database migration requires separately
authorized environment scope; isolated migration evidence does not authorize it.

Focused proof: `npm run db:test -- exec -- node scripts/verify-profile-editing.mjs`
after schemas/API build and isolated migration deploy. It covers upgrade defaults,
authorization, concurrent version conflict, rollback and email/session transition.
`npm run db:test -- exec -- node scripts/verify-profile-http.mjs` additionally
exercises the actual JWT HTTP API, forged-header denial, file rejection/clean
avatar download, local-mail proof consumption and session revocation. It uses a
loopback scanner simulator and private synthetic mail, not a live provider.

### Release environment

1. Provision Redis with TLS and monitor memory, evictions, connection errors and
   command latency. Use a dedicated namespace for rate-limit keys.
2. Set `REDIS_URL`, `TRUST_PROXY=true`, explicit HTTPS `CORS_ORIGINS`, JWT
   issuer/audience and `JWT_REQUIRE_MFA=true` through the secret manager.
3. Run `npm run build`, `npm run verify:production-config` and
   `npm run verify:rate-limit-auth` before the immutable release is promoted.
4. Start API and worker separately. Confirm `/api/health/ready`, Redis
   readiness, request IDs, rate-limit headers and the production error envelope.
5. Verify social/email login, MFA enrollment/challenge, refresh rotation,
   logout/revocation and an operator session before opening traffic.
6. Confirm that two API instances share the same rate-limit state. A request
   burst sent alternately to both instances must still receive `429` once the
   shared limit is exceeded.

## Incident procedures

### Suspected credential or refresh-token compromise

1. Preserve the request ID, actor, tenant, timestamp and security-event record.
2. Revoke the affected session or all sessions for the user; if the token
   family is suspected, revoke the complete family.
3. Rotate the signing/provider secret through the secret manager. Keep the old
   verification key only for the documented overlap window, then remove it.
4. Require MFA re-enrollment when the factor or recovery codes may be exposed.
5. Review `SecurityEvent`, `AuditLog`, login, refresh-replay and rate-limit
   metrics before restoring normal access.

### Rate-limit abuse or false positives

1. Identify the affected dimension and route class from the rate-limit headers,
   request IDs and metrics; do not disable the global guard as a first action.
2. Block or challenge the abusive source at the trusted edge when possible.
3. Adjust a versioned limit through configuration only after recording the
   incident, expected traffic and rollback value. Never raise limits by editing
   code during an incident.
4. If Redis is unhealthy, keep the fail-closed behavior, restore Redis or route
   traffic to a healthy deployment, then replay the smoke checks.

## Rotation and rollback

- Secret changes are staged, deployed to one instance, verified, and then
  rolled out. Keep a previous key only for the documented compatibility window.
- Application rollback uses the previous immutable image; it does not roll back
  database migrations. Re-run auth, MFA, Redis and rate-limit smoke checks after
  rollback.
- Never print JWT keys, refresh tokens, CSRF tokens, MFA secrets or provider
  credentials in logs, CI output or incident tickets.

## Evidence commands

```powershell
npm run verify:rate-limit-auth
npm run verify:security
npm run verify:production-config
npm run verify:runtime-split
npm run verify:postgres
```

`verify:rate-limit-auth` proves the bounded production configuration, shared
Redis requirement, stable error contract and Redis storage fallback/fail-closed
behavior. Live Redis failover and two-instance behavior remain deployment-level
evidence and must be recorded during the go-live rehearsal.
