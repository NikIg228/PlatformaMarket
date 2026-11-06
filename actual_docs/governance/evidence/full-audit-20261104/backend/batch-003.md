# Backend audit batch 003

Read20 additional apps/api files plus6 root delegated serverless/config files.
Cumulative43/613 app text files and6 external files,2139 total lines read.
All complete ranges/hashes recorded. No execution; tests reviewed as source only.

Root api/index.ts matches app handler. Root api/index.js selected by vercel.api.json
also returns200 for /api/health/ready on initialization failure (line18). Both cache
resolved express function after awaits, not initialization promise. Catch-all files
re-export their adjacent handlers. Root vercel.json builds buyer-web only. Root is
checking catalog sync script invoked by apps/api/vercel.json (B-CAND003).

HTTP: unexpected errors get generic500 without details; explicit HttpException message,
code/error and additional payload fields retained except500 details. Thus per-service
HTTP exceptions still need inspection for leakage. Request URL including query appears
in envelope/log context; verify callers do not carry secrets in query. Throttler retry
headers normalized. Bigints serialize as exact decimal strings. Parser uses1MiB default,
scoped upload bounds from schemas, compressed-body parser limit, safe parse errors,
raw bytes only webhook routes. Source tests cover maximum uploads, chunking, malformed
JSON/compression, exact signed byte hashing, form limits and similar-route denial.
Prisma singleton connects/disconnects; tenant enforcement belongs to domain callers.

Identity middleware: clears untrusted user/org/session/amr headers outside explicit
nonproduction development mode. Metrics and exact connector routes delegate credentials
to their own controllers; personal-cart route switches to personal JWT context. JWT
algorithms restricted by configured key, issuer/audience checked, org allowlist enforced,
MFA bootstrap limited to identity/mfa route; signed operator-password single-tenant
sessions have explicit MFA exception. Every JWT request requires jti and active DB
session; revocation service checks active user, session owner/status/expiry, and current
operator membership for operator-password. Deny-only cache5s/10k prevents repeated
revoked reads without delaying revocation. Tests cover header/scheme/route boundaries,
revoked and expired sessions, mismatch, operator membership removal and invalidation.
Domain membership revocation and session issuance remain pending downstream review.

SecurityCrypto: randomized AES256GCM, purpose-separated HMAC; production key mandatory,
local deterministic fallback. No previous-key decryption path (rotation consequence to
assess against runbook/callers). TOTP primitives constant-time six digits±1window;
consumption/replay must be enforced by MFA service, not inferred from primitive.
Bounded base64 rejects oversized/malformed encoding before Buffer allocation; tests
spy to assert no allocation. Security module exports shared adapters globally.

No new confirmed defect in this batch. Next remaining platform file scanner/uploads,
zip, outbound, rate limits, storage, queues/outbox/observability; then schema/domain.
