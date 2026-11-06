# Backend audit batch005

22 files/1329lines. Cumulative75/613 app text files+6external,4843 total lines.
Full ranges/hashes in ledger; runtime not executed here.

Background queue: global name marketplace-background; APIs produce only; workers consume
with configured concurrency. Job handlers unique names, default5 attempts exponential2s,
completed500/failed2000 retention. Startup failure closes connections and throws in prod,
otherwise inline cron fallback. enabled only set during init; health pings producer and
counts jobs but consumer flag records creation rather than current worker readiness.
Producer uses maxRetriesPerRequest:null without commandTimeout; outage boundedness remains
B-CAND009, requires isolated Redis fault simulation authorized/coordinated by root.

Storage: local exclusive creation, S3 and Supabase adapters. S3 health HeadBucket;
local mkdir/access; Supabase fetch has no explicit abort timeout. Downloads read entire
object, rely on ingress bounds/caller keys. Media tickets expire300s, bind mediaId/HMAC,
constant-time compare. Production environment mandates signing secret separately.
B-CAND007: env accepts aws:kms but PutObject forwards AES256 only, omits KMS. Static
configuration mismatch; bucket policy/default could compensate but app intent not preserved.
B-CAND008: local get catches safePath rejection and retries unbounded public-folder resolve;
need prove caller-controllable stored key before classing reachable file disclosure.

Outbox: PENDING/FAILED available rows or stale PROCESSING; claim CAS(status/attempts/
lock timestamp), per-process worker id; all matching handlers must finish before PUBLISHED.
Retry5s exponential cap1h or DEAD_LETTER on permanent/maxattempt. Handler effects need
idempotency because partial handler success repeats on retry; no per-handler checkpoint.
Worker cron2s queues slot-id job, inline fallback if disabled, process overlap flag.
B-CAND010: batch-level now reused as lockedAt for every sequential event; after earlier
handlers consume>60s, later freshly claimed event gets already stale lease. No heartbeat.
Check handlers/idempotency and real duration before assigning business impact.
Tests prove mocked CAS miss, stale reclaim, backoff, permanent/exhausted failure, all
handlers success; no real concurrent handler interleaving coverage in this source suite.

Observability: HTTP histogram labels use templates (no entityID cardinality); metrics
scrape uses dedicated bearer and global DB aggregates, no per-tenant secrets. DB-down
scrape throws and therefore loses process metrics too; operational tradeoff noted.
Structured logs redact authorization/cookie/CSRF/set-cookie plus root secret fields;
unit tests use real Pino serialization/cookies. Nest logger stringifies object payload
into message so nested field redaction depends on caller; request URL retains query.
Need inspect media ticket consumption before asserting token exposure. OTLP supports
base or explicit /v1/traces. No general logging secrecy PASS inferred.

Next OpenAPI shared metadata then complete Prisma schema/migrations and domain modules.
