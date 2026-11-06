# Backend audit batch029

Eleven next integrations sources fully read: reconciliation/tax/VAT specs and tax
helper, webhook constants/controller/service/spec, worker/controller/module.
Tax binding supplier-only+profile version+timestamp CAS, atomic audit/replay in caller
transaction (caller next batch). Webhook HMAC binds timestamp/rawbody,1MB bound,
unique eventID and rejects changed payload. Retry repairs enqueue-after-inbox-save
through idempotent job enqueue; DEAD_LETTER replay remains same job per enqueue behavior.
Worker gets five jobs each tick, stale claim recovery, respects Permanent vs Retryable
error type; other exceptions retried. Worker ID server:pid may collide across hosts,
lease completion's unconditional update is noted in prior batch.
Controller scopes supplier connection through service; arbitrary enqueue payload
requires integration.manage and execution does reservation/order scope checks. Readiness
global authority concern needs role catalog/source service next. No dynamic executions.
