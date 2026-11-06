# Backend audit batch012

All14agreements files read. Supplier legal documents intentionally four empty DRAFT
versions; bundle unavailable and acceptance rejects, as owner requested. This is an
open go-live content dependency, not permission to invent legal text. New individual
marketplace agreement POST returns410; current legal path acceptance -> independent
operator approval. Terms store exact text/hash+org version+actor evidence, serializable
transaction audit/outbox, CAS review; prerequisites profile/reserve contacts/warehouse/
verified credentials. Latest acceptance supersedes legacy access, suspension blocks.

Legacy marketplace renewal catches up missed years and uses conditional update with
endsAt/status; document expiry+audit/outbox atomic. Not the bilateral agreement bug.
Non-renewal update/audit separate; termination tx update lacks CAS after read;
concurrent requestNonRenewal could overwrite TERMINATED to NON_RENEWING if it reads
ACTIVE first and updates last. Candidate B-CAND015, legacy path still exposed; needs
focused concurrency reproduction and confirm business severity before promotion.
Presentation reconciles before requireParty (tenant check after potential activation);
activation condition still both valid signatures/document signed, no forged signature
inference. Broader service read-before-auth pattern recorded, not proof of disclosure.

Callback verifies rawbody HMAC/time-window, session/checksum/BIN/cert validity and
verified gateway evidence, no browser claims trusted without server verification.
Callback idempotency tracks payload hash, retries received success return409/replay
security event; pending concurrent duplicate not claimed exclusively, relies on
DocumentsService.completeSignature idempotency/locking (next documents review).
Browser verifies same organization, exact actor binding delegated to document service.
No callback or security dynamic probe executed. All tests read, not freshly run.
