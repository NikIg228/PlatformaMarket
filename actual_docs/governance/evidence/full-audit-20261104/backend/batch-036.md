# Backend audit batch036

All six offers files fully read. Adoption shared catalog lock protects archive rollback.
Commercial price/stock writes lock offer, enforce mode permissions/source restrictions,
expected offer+balance versions, hash scoped idempotency receipt, and transactional price+
stock save. setPrice legacy operation uses offer lock and exact amount; promotion base-price
protection active. Publication checks agreement/supplier/master/package/price/stock/compliance,
then offer version CAS and synchronous search rebuild after commit.

Cross FE activateOffer hardcodedVAT12: legacy setPrice99 resolves current VAT;101 rejects
changed implicit VAT only when previousPrice.taxSnapshot exists. Need vat-rules to classify
new/legacy price handling. Independent price/inventory/publication calls indeed lack shared
transaction, while commercial endpoint exists but no publish wrapper. Partial failure is
possible and reported as FE flow issue; do not invent rollback requirement.
setPrice111 temporarily sets search min=max latest changed offer rather than aggregate;
trace OfferPriceChanged projection handler before final issue. setPublication177 postcommit
rebuild failure returns error despite committed publication; sameState148 retry skips rebuild
(but outbox may repair). Not yet classified. No runtime tests.
