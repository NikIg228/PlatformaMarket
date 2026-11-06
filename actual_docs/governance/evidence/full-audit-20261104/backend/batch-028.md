# Backend audit batch028

Nine integration files fully read including execution1196/job181. Crypto AES256GCM
current+previouskey fallback. Agent price strings require safeInteger; decimal input
roundtrip checks; stock writes version-CAS with reserved/safety retained. Prices lock
SupplierOffer and re-read current price. Agent result completion gets unique lease,
but apply mutations and final complete not one transaction. Server/agent claims use
atomic SKIP LOCKED; stale10min claims reset FAILED/DEAD_LETTER.

B-CAND033 execution459–461 returns unchanged without renewing lastConfirmedAt or
freshnessExpiresAt; stable price eventually stale despite successful repeated sync.
New changed price fields473–474 renewed. Need freshness consumers for impact.
B-CAND034 enqueueContinuation300–313 creates PENDING job then writes cursor in separate
statement. Jobs.enqueue13–22 creates immediately available row (DB default). Concurrent
worker can claim old null cursor; continuation of page repeats first page. Need probe
with barrier between create and update, not speculative tool timing.
B-CAND035 custom adapter227/Moy267 converts money to Number without safe range;
execution456 String(item.valueMinor) then persistent price466. Decimal integer source
9007199254740993 becomes9007199254740992. Only ONE_C safeInteger203 fences this.

B-CAND032 confirmed code tracing: execution reads payload52 without injecting job
idempotencyKey; jobs.enqueue keeps key18 separate from payload19. Both direct and
server external operations omit header unless user payload already contains key.
External reservation auto enqueue does not. Agent claim also omits idempotencyKey49
from returned descriptor; connector job.id may serve as adapter's identity, root
owns external agent source and must reconcile. No runtime validation in this batch.

Job complete/fail read requireClaim then unconditional update by id96/141 and sets
connection ACTIVE/ERROR107/154. Need paused/revoked race analysis with next service.
Inventory available formula min(externalAvailable,stock-localReserved-safety) may
allow combined external+local commitments mismatch if external reserve independent;
domain sync semantics pending, no finding asserted.

Parent/frontend cross-reference: one-c-agent job.id used only complete/fail/return129–135; execute140 passes payload only, create/release148–149 lack idempotency key. Completion failure after external success triggers retryable fail and later repeated payload. External duplicate outcome still depends on adapter business-ID dedup; source review only, no runtime.
