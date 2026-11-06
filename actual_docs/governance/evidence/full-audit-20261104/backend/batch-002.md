# Backend audit batch 002

12 more files,714 lines fully read (environment split1-220;221-439).
Cumulative23/613 own text files;1193/57784 lines. No tests run.

HealthController.ready returns503 with safe SERVICE_NOT_READY envelope when runtime
snapshot not_ready; spec asserts no dependency details. Confirms B-CAND-002 static
contradiction: serverless catch returns200 for /api/health/ready when init fails.
Runtime-readiness queries database, storage, queue sequentially; catches/logs errors,
requires DB/storage and queue if enabled. Timeout behavior delegated to unread adapters.
Serverless handler imports instrumentation outside try; config/import errors may escape
its fallback entirely. Deployment/runtime probes inspect module metadata and Swagger,
close context; they are probe sources, not evidence of executed behavior.

Roles: api HTTP/queue producer; worker schedules/consumer/producer; all both. Production
rejects all. Pilot omits Promotions/Billing/Ai/TrustCommerce/SmartRecommendations;
go_live composes them, without asserting provider capability is implemented.

Environment: cached Zod parse; empty strings become undefined. Production requires
explicit go_live, RBAC, JWT/MFA/issuer/audience, TLS DB/Redis, proxy, publicHTTPS CORS,
S3/encryption, external signing/payment, SMS/email, webhook/metrics secrets and telemetry.
Local auth helpers require loopback nonproduction; operator password requires JWT/MFA.
NCA identity file paths/hash optional (verify later capability guard). Two encryption
keys required but equality not checked: no confirmed exploit inferred.
Telemetry loads only configured SDKs synchronously before app; fs tracing disabled;
Sentry defaultPII false; shutdown on SIGTERM. Specs transpile sources with mocks and
assert load order/filter registration; no live exporter acceptance.

Next: platform security, HTTP, Prisma, jobs/outbox/storage; all domains and migrations
remain unread. B-CAND001/003 still pending corroboration. Root owns dynamic gates.