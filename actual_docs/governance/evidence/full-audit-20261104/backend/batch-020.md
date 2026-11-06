# Backend audit batch020

DocumentsService1014lines and268line spec fully read. Upload hash-bound replay and
reference graph preflight occur before quarantine. Regeneration owner-only; preview
and invoice paths protected. Agreement signatures require distinct actual parties+EDS.
Archive/current/list include reference validators and individual version permissions.

B-CAND027: prepareOrderDocuments512–514 and generateOrderDocumentPack607–609 sort
active templates descending then construct Map by code; last/lowest active version
wins. createTemplate278–287 does not retire previous active version, schema allows
(code,version). Two valid active versions select old terms. No dynamic probe yet.

B-CAND028: completeSignature854–861 commits terminal signature; document refresh868
and event/audit869–872 occur later. A subsequent failure leaves incomplete effect;
retry rejects already-final at852 before reconciliation. Existing test253–266 asserts
ordinary replay rejected, but does not cover partial failure. Callback integration
must be traced to see whether it repairs. Also stale additional session creation806/
838 and rejection868 can regress document SIGNED to AWAITING_SIGNATURE/REJECTED;
refresh888 protects only its own update. Concurrency not dynamically proven here.

Generation recovery candidate: renderAndFinalize752 returns transaction Promise
without await inside try; transaction rejection bypasses catch768, leaving original
GENERATING row and stored bytes. Even caught render errors setFAILED but existing
number uniqueness blocks same-number generate retry; callers catchP2002 and return
existing FAILED row. No documented retry UI checked yet. Accounting update254 then
audit259 not transactional; archive896 then audit897 same limitation.

Legacy order prep allows PARTIALLY_CONFIRMED499 and reuses old invoice/spec after
order amount changes538. Specialized invoice path next may supersede exposure but
old endpoint remains in controller; reconcile before final report. No runtime tests.
