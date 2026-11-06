# Backend audit batch016

21 commerce sources/tests fully read, including all1179lines CommerceService.
Order discrepancy service test truncated in first output; reread all78lines.
Cart CAS and serializable confirmation protect parent transitions; confirmation has
bounded3serialization/deadlock retries. Discrepancies lock order, scope both parties,
require versions and actor/payload-bound idempotency; draft evidence hidden from supplier.
Resupply consumes distinct additional physical stock with ordered balance locks,
FEFO lot guard, original paid reservation preserved. Incomplete documents explicit.
Manual return amounts exact cumulative rounding; returned goods receipt records facts,
not automatic stock availability. Cancellation restores unshipped local reservations.

B-CAND020: resolveCart390–405 returns any Error.message as normal validation message,
bypassing HTTP filter. Includes internal resolver/database errors; controlled stub
can prove reflection, real secret exposure not demonstrated. Also checkout727–740
persists raw reservation failureReason, getCheckout815 spreads it. Root informed.

B-CAND021: checkout reservation TTL30wallminutes706, supplier confirmation rejects
expired local reserve1058–1060 even before scheduler's45workingminute reminder;
response deadline60workingminutes, closed days extend further. Need inventory expiry/
renewal trace to prove user dead-end. No revival path in CommerceService confirmed.

B-CAND022: checkout durable orchestration gap candidate. Transaction creates checkout
and order then reservations outside transaction, final commit752–775. Crash or final
transaction failure leaves existing checkout; retries487–493 return it without resume.
No pre-reserve outbox/job here. Search remaining worker/inventory recovery before final.

PaymentReduction releases stock via guarded atomic decrement; no ordered inventory
lock helper here, caller order lock and serializable behavior pending. Reorder locks
organization but retires active cart without CAS; caller isolation determines concurrent
add protection (review next). Not yet findings. No worker runtime execution.
