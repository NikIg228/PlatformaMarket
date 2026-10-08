# Production deployment and rollback

Owner decision08.10.2026: target hosting is **Yandex.Cloud Kazakhstan**.
This records the owner's selection, not verified service availability or a deployed
environment. The owner is responsible for the cloud account, monthly budget,
hosting/domain/database setup and recovery arrangements. The domain will be supplied
later; resource sizing and numeric budget/outage/data-loss targets are not specified.
No cloud purchase or deployment is executed or authorized by this documentation task.

Target launch date: **by 30 October 2026**, with required external integrations.
Owner acceptance sequence: review locally implemented functionality → connect
required external services and deploy to live hosting/domain/database → pass the
applicable checks → accept production readiness. Existing isolated/local checks
still precede publication/deployment as required; the sequence does not postpone
them or waive release guards. A date, local PASS or mock integration is not live PASS.
Choose and verify backup/restore and outage/data-loss targets before acceptance.

Status01.10.2026: configuration now targets api + one apps/web image. Caddy
serves WEB_DOMAIN with same-origin /api; operator login is /admin/login.
This is a deferred production procedure, not a deployment authorization or
live acceptance. The actual domain/operator-origin decision, provider callbacks,
and live rollout remain open. See deployment-profiles.md and the delivery task.


Authentication and abuse-control checks are defined in
[`production-auth-runbook.md`](production-auth-runbook.md). Complete that
runbook together with this release procedure; a successful image build alone
does not prove production auth or shared rate limiting.

## Release contract

Production uses an immutable image tag built by `.github/workflows/release.yml` from a `v*` tag or an explicitly authorized manual release. Configure GitHub repository variables `DEPLOYMENT_PROFILE`, `PUBLIC_WEB_URL`, `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`, and `APPLE_REDIRECT_URI`. The web origin must be HTTPS; Apple return must use that origin. Browser API calls use `/api`; Docker's fixed upstream is `http://api:4000/api`. Set `DEPLOYMENT_PROFILE=go_live` for the approved production contour; API and web must use the same profile (see [deployment profiles](deployment-profiles.md)). Copy `.env.production.example` to `.env.production` on the host and replace every placeholder through the secret manager. Set WEB_DOMAIN to the approved host. These instructions do not authorize that deployment.

CI builds both `api` and `web` Docker targets without publishing images and validates production Compose/Caddy with example configuration. Release publishes those two images; worker uses the API image. Docker build context excludes `.env*`, local storage, temporary evidence and session files. No production secrets belong in build arguments.

The API refuses to start when production would use development auth, localhost CORS, mock payments, local object storage, optional antivirus, unencrypted storage, missing EDS/payment/email/SMS endpoints, missing signed PSP webhooks, missing MFA, PostgreSQL/Redis without required TLS, missing observability exporters, or cleartext HTTP for a secret-bearing provider endpoint. Development and test environments may continue to use explicit localhost HTTP endpoints.

Production also rejects `pilot` or an omitted deployment profile. Runtime Swagger
UI/JSON/YAML routes are not registered in production; inspect the generated
contract in an isolated development/test environment. Ordinary JSON requests are
limited to 1 MiB. Document/credential upload POST routes allow a 10,000,000-byte
file encoded as base64 plus 128 KiB of JSON metadata; supplier import POST routes
allow 20,000,000 file bytes plus the same metadata allowance. Signed webhook and
URL-encoded bodies retain a 1 MiB limit. Oversized HTTP bodies return the standard
413 error envelope; decoded upload bounds remain independently enforced.
The Next.js rewrite buffer is bounded by the maximum import JSON size plus 1 MiB
of stream-chunk headroom, so a legitimate base64 file is not truncated and oversized chunked payloads
can reach the API's 413 boundary. Route-specific lower limits remain in the API.

`compose.production.yaml` starts two processes from the same API image: `PROCESS_ROLE=api` serves HTTP and produces queue jobs without cron/consumers; `PROCESS_ROLE=worker` runs cron and BullMQ consumers without an HTTP listener. `PROCESS_ROLE=all` is rejected in production. The worker performs role-aware dependency readiness before announcing startup and exits when its required database, storage, or queue dependency is unavailable.

## First deployment

1. Create managed PostgreSQL with PITR, managed Redis with TLS, an encrypted S3-compatible private bucket, DNS records, EDS gateway credentials, PSP credentials, transactional email credentials, Sentry and OTLP projects.
2. Pre-provision at least two corporate operator users as active members of the `MARKETPLACE_OPERATOR` organization. Their Google/Apple verified emails must match the users. Both must enroll TOTP at `/admin/login`.
3. Validate configuration with `npm run build && npm run verify:production-config && npm run verify:production-readiness-contract && npm run verify:production-connectors && npm run verify:rate-limit-auth` and `docker compose --env-file .env.production -f compose.production.yaml config --quiet`.
4. Take a backup, set `REGISTRY` and immutable `APP_RELEASE`, then run `docker compose --env-file .env.production -f compose.production.yaml pull` and `docker compose --env-file .env.production -f compose.production.yaml up -d`.
5. Check `/api/health`, `/api/health/ready`, social login + MFA, supplier common-terms acceptance and separate operator admission (ADR013), selected legacy/external EDS callback where applicable, search, checkout against PSP sandbox, document download, notification delivery and operator queues.

## Backup and restore drill

Run `DATABASE_URL=... S3_BUCKET=... scripts/backup-production.sh`. A backup is
valid only when `SHA256SUMS` verifies. Quarterly, follow
[`backup-restore-runbook.md`](backup-restore-runbook.md): restore the artifact
into a separately provisioned empty `dentmarket_restore_drill_*` database and
versioned isolated bucket, reconcile migrations/data/objects, start the API and
record timings. `npm run verify:backup-restore` is the repeatable local/CI contract;
managed PITR and a real production snapshot still require provider-level
evidence. Never run a rehearsal restore against the live database or bucket.

## Rollback

Application rollback changes `APP_RELEASE` to the previous immutable tag and runs `compose pull/up` again. Database migrations must be backward-compatible expand/contract changes; application rollback does not reverse migrations. If a destructive data incident occurred, close traffic, preserve the affected database, restore the last verified backup into a new database, run smoke verification, then switch `DATABASE_URL` and reopen traffic.

For a previously released multi-app version, use `compose.production.legacy.yaml` and `infra/Caddyfile.legacy` with its matching immutable legacy images and domains. The new release matrix does not publish those old targets. This separate configuration preserves the rollback recipe; a real rollback drill and origin/cookie migration still require deployment acceptance.

## External go-live blockers

The repository cannot manufacture third-party acceptance. Production remains blocked until evidence exists for the explicitly selected external providers and legal flow, DNS/TLS, managed PostgreSQL/Redis/S3, monitoring alerts and a timed restore drill. MySklad and 1C are separate optional supplier channels; both are not universally required for the internal/manual core. Active production configuration guards remain binding until an approved contract change. Connector status stays `CONNECTOR_NEEDED` or `PILOT` until evidence is attached; it must never be marked `LIVE_VERIFIED` from mocks.

Follow [`live-provider-readiness.md`](live-provider-readiness.md). After
injecting production environment variables and explicit provider healthcheck
URLs, set `NODE_ENV=production`, `CHECK_EXTERNAL_CONNECTORS=1` and run
`npm run verify:production-connectors`. The command never prints secret values,
does not guess `/health` paths and exits non-zero when the production contract or
reachability check fails. Then run `npm run verify:live-evidence` against an
external evidence manifest; reachability alone never becomes `LIVE_VERIFIED`.
