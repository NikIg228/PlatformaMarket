# Backend audit conclusion — 2026-11-04

Assigned source review complete: 613/613 API own text files plus six delegated root
handlers/configs; 57,849 lines. All recorded SHA256 values still match; range union
has no gaps. Evidence: `file-ledger.csv`, `coverage-verification.json`, batches001–062.
This is not release acceptance or a passing runtime/security certification.
Excluded artifacts retain explicit ledger rows; root owns master classification.

Declaration maps: `api-map.json`444 routes, `job-map.json`15 scheduled/worker
declarations, `module-map.json`44 modules, `role-process-map.json` access/process
summary. Counts include declared legacy and profile-dependent routes, not proof each
route is enabled in the observed server. No product files changed, DB writes,
provider requests, server starts/stops, commits or publication by this worker.

## Reproduced failures

Severity below is audit priority, conditional on stated deployment/data prerequisites.
No real customer data or external compromise was tested.

| ID | Priority | Trigger, effect and exact source | Evidence/limit |
|---|---|---|---|
| B-CAND043 | High | Public catalog compare or another buyer compares a product containing an audience-restricted offer. `apps/api/src/modules/search/search.controller.ts:75` supplies public buyer;`:85` public route calls service. `search.service.ts:367` maps all offers loaded at`:740`, with no allowedBuyerIds/city check. Discloses price, supplier SKU and warehouse quantity to excluded buyer. | `compare-audience-probe-1.json`: original service and price resolver, public expected0/actual1 FAIL, authorized expected1/actual1 PASS. Root HTTP/PG attempt2 now confirms excluded compare1/search0 and included1/1; exact publication restore and API stop PASS (`compare-audience-http-probe-2.json`). Fixture uses admitted supplier and public BUYER organization. Ordinary search has audience check`:829`; do not generalize to all catalog paths. |
| B-CAND026 | High | Missing every alternative credential still evaluates PASSED because any-of reason begins uppercase at `apps/api/src/modules/compliance/compliance-evaluator.ts:73`, while classification regex`:93` is lowercase. Publication/checkout call same evaluator via `compliance.service.ts:129`/`:185` and `commerce.service.ts:536`. | `compliance-anyof-probe-1.json`: missing alternatives FAIL, ordinary missing credential and present-alternative controls PASS. Root additionally tested3actual migration rules (3FAIL/6controlsPASS); deployed activation/classification unqueried. No statutory compliance claim. |
| B-CAND012 | Medium | Second expired bilateral agreement for same pair collides with unique terminal status: `apps/api/prisma/migrations/20260717200000_buyer_supplier_agreements/migration.sql:30`; `buyer-supplier-agreements.service.ts:84`, reached by currentGET`:33` and initiate`:40`. Blocks renewal/current retrieval. | Root reported isolated PostgreSQL probe second expiry P2002 and rollback cleanup; root retains authoritative dynamic evidence. Backend batch011/probe-plan describe fixture. |
| B-CAND001/002 | Medium | Concurrent cold serverless requests initialize twice; initialization failure returns200 for readiness. `api/index.js:18` and adjacent handler initialization; mirrored app/root TypeScript handler. | Root original-source VM probe2FAIL/1PASS. Group as one serverless lifecycle finding with two effects; no live Vercel test. |

| ID | Priority | Trigger and effect | Evidence/limit |
|---|---|---|---|
| B-CAND016 | High, provider enabled | Original authorized AI send stores REDACTED but original OpenAiResponsesService constructs provider payload with raw synthetic token assignment. | `ai-raw-prompt-probe-1.json`: failing marker, ordinary question PASS; fetch capturing stub, no network. |
| B-CAND017 | Medium | Two authorized send/confirm calls read same pending execution; original tool creates two support tickets. | `ai-concurrent-confirm-probe-1.json`: expected1 actual2, single confirmation PASS; in-memory DB/barrier, no PG claim. |
| B-CAND027 | Medium | Both document template selection paths choose active v1 over active v2 due descending query followed by Map overwrite. | `document-template-version-probe-1.json`: both multi-version scenarios FAIL; both singleton controls PASS. Exact AST query/selection statements; no renderer/DB. |
| B-CAND039 | Medium | Original correction approve/reject payloads yield no supplier notification in original projector. | `correction-notification-recipient-probe-1.json`: both original events expected1 actual0; both explicit-recipient controls PASS. Only synthetic in-memory events. |

## Strong source findings requiring focused confirmation

These are not additional executed failures. File/line references below are under
`apps/api/src/modules/` unless explicitly prefixed otherwise.

| ID | Priority | Role/input and consequence | Source/evidence | Safe next probe |
|---|---|---|---|---|
| B-CAND036 | High | Authorized manual inventory override racing checkout can overwrite newly committed reserved quantity, disconnecting aggregate stock from reservations. | `inventory/data-freshness.service.ts:57` reads before serializable transaction`:68`, writes stale reserved value`:90`/`:93`; batch031. | Stub barrier demonstrates stale write arguments; actual invariant requires approved disposable PG interleaving. Never working DB. |
| B-CAND040 +038 +022/031 | High for payment; separate domain impacts | Process death after PROCESSING claim or provider success can strand durable operations. Payment authorize/capture/cancel/payout reject repeat before recovery; inbox events lack lease, missing transaction webhook marked processed. Notifications/import/checkout analogous claims need global recovery reconciliation. | `payments/payment-settlement.service.ts:97,123,277,390`; provider result`:104,142,282,397`; `payment-webhooks.service.ts:58,69,72`; batches046–047. Notification`:353,371`; checkout`:487,752`; imports batch026. | Original service + synthetic persisted states and adapter stubs: inject local transaction failure after remote-success stub; retry same key; assert no new external call and recoverable durable state. Separate assertions per domain; do not count all as one proven runtime failure. |
| B-CAND032 | High, external connector conditional | Reservation command payload lacks idempotency identity; lost completion response can invoke same remote reservation again. | `integrations/integration-execution.service.ts:52`; `integration-jobs.service.ts:18`; batch028 and root external-agent trace. | Capturing fake adapter and completion failure, then retry. No actual ERP/network. Remote business-ID dedup may mitigate, must inspect selected integration contract. |
| B-CAND037 | Medium | Operator approve/reject race can reject request after applying product correction; two terminal events. | `moderation/product-corrections.service.ts:95,111,143,163`; batch034. | Barrier before both terminal writes, synthetic transaction stub; stronger evidence approved disposable PG. |
| B-CAND045 | Medium | Smart recommendations omit supplier commercial admission, price freshness and promotion moderation/revision/coupon/stock-limit gates, potentially recommending unorderable or unapproved discounted offer. | `trust-commerce/smart-recommendation.service.ts:27,31,59,88`; batch060. Distinct from audience: this service DOES check audience. | Original recommend with fixtures each violating one gate, fake DB/provider-free; check reachable UI and go_live profile. No real money assertion from approximate ranking alone. |
| B-CAND046/028 | High if signed/payment-linked document; otherwise Medium | Terminal decision saved before dependent effects, then replay refuses reconciliation: incident appeal and legacy document signature. | `trust-commerce/trust-commerce.service.ts:84,87`; `documents/documents.service.ts:852,854,868`; batches061/020. | Inject failure after terminal mutation, retry exact command. Trace signature callback repair before final claim. Rating recompute`:297` is separate postcommit stale projection risk. |
| B-CAND047 | Medium | Opening appeal sets UNDER_APPEAL while retaining hard-block action; recommendation query only selects HARD_BLOCKED/SOFT_ACTION_ACTIVE, so pending appeal removes that risk from ranking. | `trust-commerce/trust-commerce.service.ts:74`; `smart-recommendation.service.ts:61`; batch061. | Synthetic query-compatible fixture before/after appeal; no claim checkout hard block bypass until its own consumer traced. |
| B-CAND033/034/035 | Medium | Stable ERP price never renews freshness; continuation job visible before cursor; certain adapters round unsafe integer money through Number. | `integrations/integration-execution.service.ts:459,300`; custom/moy adapters batch028. | Pure stable-price argument capture; enqueue barrier; synthetic9007199254740993 adapter response. No network/ERP. Treat three distinct mechanisms, not three confirmed external incidents. |
| B-CAND044 | Medium, contract pending | accessToken and secrets inside innocuously named arrays bypass heuristic configuration protection and are persisted in plaintext/audit; supplier list returns configuration under organization.view. | `suppliers/suppliers.service.ts:8,16,33,97`; batch053. | Synthetic accessToken/clientSecret/apiKey and nested-array values; validate accepted configuration schema/caller before elevating confidentiality impact. |

## Known requirements and unresolved hypotheses

- B-CAND042 actual payment allocation2% versus contractual10% is an already documented
  OPEN monetary-model integration gap, not a new owner question or permission to
  change a constant. `payments/payments.service.ts:56`; batch047 retains requirement
  reconciliation. Tax inclusion and final accounting procedure remain owner decisions.
- B-CAND021 reserve30 wall minutes versus response60 working minutes is a source
  mismatch; need renewal/expiry behavior and agreed reservation policy before final
  dead-end claim. No production data changed to exercise it.
- B-CAND003 build-time catalog mutation and013/014 legacy seed effects belong to root
  script/deployment grouping; avoid duplicate findings. Legacy seed is explicit
  `prisma:seed:legacy`, not current standard seed-profile path.
- B-CAND004/005 upload orphan/cleanup races;006 Redis connection status;007 S3 KMS
  omission;008 local fallback path;009 queue outage wait;010 lease timestamps;011
  OpenAPI input mode remain hypotheses or conditional source concerns in batches004–006.
  In particular008 needs attacker-controlled reachable key before vulnerability claim.
- B-CAND015 agreement lifecycle race;018 AI supplier permission mismatch;019 future
  entitlement;020 raw error reflection;023 reorder/add race;024 organizational cart
  active-status checks;025 payment-review poison;029 social unlink race;030 PDF page
  truncation remain separately documented in batches012–017,024–026. Do not report
  runtime impact or production exploit absent focused proof/contract applicability.
- Other unnumbered cautions remain batch notes, not counted as findings: future VAT
  price activation, nontransactional geo audit, private-comment naming, review field
  minimization and historical unsupported UI/API paths.

## Verification boundaries

Worker executed six explicitly authorized pure original-source diagnostics:
compliance-anyof, compare-audience, ai-raw-prompt, ai-concurrent-confirm,
document-template-version and correction-notification-recipient, all attempt1.
The latest four probes produced6 failing assertions and6 passing controls with no
harness error; `focused-probes-run-1.json` records exit classification. Failures
remain visible and unfixed. Exact source SHA/ranges and fixture assumptions are in
each report; template selection uses exact AST statements rather than full rendering.
Root owns HTTP/browser/DB/provider validation and overall audit gates. No runtime
suite was implicitly passed by reading its source. No active owned process remains.
Other proposed probes remain unexecuted.



## Additional recovery diagnostics — attempt 1

The three newly authorized memory-only probes supersede the unexecuted-probe
qualification for B-CAND036, B-CAND040 authorization, and B-CAND032 only. They do
not promote the other grouped payment/webhook/import concerns to runtime findings.
Original TypeScript classes were transpiled in memory, dependencies supplied as
synthetic DI fixtures. No DB, network, real provider, server, or product write.

- B-CAND036: original createOverride read reserved=2 before the synthetic
  transaction; an injected intervening reservation changed it to5. Original update
  wrote2, expected5 (FAIL). Without interleaving retained2 (PASS). Serializable
  option was supplied by original method, but this probe is not PostgreSQL SSI or
  oversell certification. Evidence: `inventory-stale-reserved-probe-1.json`.
- B-CAND040: original authorize stored fake provider SUCCEEDED, then injected local
  transaction failure left intent PROCESSING with0transactions. Same-key retry
  rejected as not ready, intent remained PROCESSING (FAIL), without duplicating
  provider call (PASS). Normal authorization+replay AUTHORIZED/one provider call
  (2PASS). This confirms blocked same-command recovery, not absence of every manual
  reconciliation or webhook path. Evidence: `payment-processing-retry-probe-1.json`.
- B-CAND032: original execute/createReservation followed by original complete/fail,
  with injected local completion failure, called fake adapter twice after synthetic
  reclaim (FAIL) and never forwarded job idempotencyKey (FAIL). Normal command
  called once and completed (2PASS). Existing inventoryReservationId and
  externalReservationRecordId ARE forwarded and may permit external business-ID
  deduplication; two adapter calls do not prove two real ERP reservations. Source
  external-reservations.service.ts:41-43 confirms internal job identity is separate
  from payload; custom-api.adapter.ts:77-93 reads idempotency key only from body.
  Evidence: `integration-reservation-retry-probe-1.json`.

New batch total4FAIL/6PASS, no harness errors, exit1 deliberately retained.
`recovery-probes-run-1.json` records classification; each report records source
SHA256 and limitations. Harness: `.tmp/full-audit-20261104/backend/recovery-probes.cjs`.
Nine pure diagnostics total; previous six were not rerun. No active owned process.

## PostgreSQL confirmation and social-unlink diagnostic

B-CAND036 now has root-executed PostgreSQL confirmation, superseding the earlier
memory-only qualification for lost aggregate reserved updates. Evidence:
`inventory-stale-reserved-postgres-2.json` (source SHA256
`013860c42da3e736e2f317182cd50f31637d27e219aa4e1d7571ae2f2d5a6c3b`).
Original createOverride, real Prisma and Serializable transaction: initial read2;
second connection committed reserved5 before original transaction; original wrote2
(expected5 FAIL). No-interleave control retained2 PASS. Target identity was
127.0.0.1:5432/dentmarket_audit_20260914/public; cleanup all nine fixture tables zero
PASS. Attempt1 stopped before fixture writes because host text included /32; root
changed identity expression to host(inet_server_addr()), then ran attempt2. This
worker prepared the harness; root executed it. No real InventoryReservation or
checkout rows were created: this proves a lost aggregate update, not full-checkout
oversell, stock-money end-to-end behavior, or production impact. No rerun here.

B-CAND029, Medium: original AuthSessionsService.unlink:478-485 snapshots identity
count outside its transaction. Two authenticated same-owner GOOGLE/APPLE unlink
calls both snapshot2, both return success, leave0 linked identities and revoke both
matching synthetic social sessions. `social-unlink-concurrency-probe-1.json`:
last-linked-method invariant FAIL; sequential second unlink409/one identity left,
other user's identity/session unchanged, and anonymous request401 before data read
all PASS (5controls). One bounded memory-only barrier probe, no harness errors,
exit1 retained; `social-unlink-run-1.json`. Original service transpiled unchanged;
lazy fixture operations execute in each synthetic transaction. No HTTP/real DB,
real token/provider or network validation. Controller:273-274 validates provider;
identity middleware strips untrusted actor headers and supplies authenticated actor.
Their sources are inspected/hashed, not dynamically exercised by this probe.

Do NOT describe029 as irreversible lockout: original exchange:301-316 can relink a
verified provider to an existing account by matching email. The confirmed issue is
concurrent bypass of the last-linked-method invariant plus session revocation;
recovery depends on provider/email and was not exercised. Passwordless creation is
possible because exchange creates User without passwordHash; unlink itself never
reads password. Earlier B-CAND029 source-only listing is superseded to this extent.
Ten pure diagnostics total. No new product changes or active worker processes.

## Latest confirmation: public compare, seeded compliance rules, and pure integrations

B-CAND043 now has root-executed unauthenticated HTTP/PostgreSQL confirmation in
`compare-audience-http-probe-2.json`: excluded public buyer compare expected0,
actual1 FAIL; ordinary search0 PASS; included buyer compare1/search1 PASS. Both
response contracts parsed by root. One existing synthetic pilot publication was
changed; full snapshot restored exactly, including SQL NULL vs JSON null; owned
API stopped. Target was127.0.0.1:5432/dentmarket_audit_20260914/public;545source and
545artifact hashes matched root equivalence proof. Attempt1 used offerId instead
of search result id in harness baseline and stopped BEFORE publication mutation;
root fixed selector and ran attempt2. This worker prepared the harness, root ran
it. Real public path confirmed for this audience fixture; not an all-catalog or
production exposure certification. No new probe executed for043 here.

B-CAND026 is also supported by root `../root/compliance-seeded-rules-2.json` using
THREE actual migration-defined rules, exact conditions/disclosures and otherwise
valid lot: KZ.MEDICAL_DEVICE.LOW_RISK, KZ.MEDICAL_DEVICE.IMPLANTABLE,
KZ.MEDICAL_EQUIPMENT. Missing any-of credential produced PASSED rather than
REVIEW_REQUIRED for all3 FAIL; present-alternative and missing-registration
controls6PASS. Attempt1 harness redeclared exports (SyntaxError); attempt2 fixed
fixture. This is the same026 finding, not a new ID. Actual deployed rule activation
and current product classification have not been queried; no statutory/legal
compliance conclusion follows from this code diagnostic.

Three additional authorized pure original-source diagnostics ran once, exit1,
no harness errors: `integration-config-probes-run-1.json`, total8FAIL/10PASS.

- B-CAND033 (Medium): original execute/pullPrices plus original import/VAT helpers
  accept a successful unchanged API price but write neither lastConfirmedAt nor
  freshnessExpiresAt (2FAIL); changed-price fixture renews both and stores101minor
  exactly (3PASS). Old unchanged price remains expired at2020-01-01. Real policy
  behavior selected through DI15minute rule, legacy taxSnapshot=null admitted by
  original helper. `stable-price-freshness-probe-1.json`; original branch459-462.
  No DB/ERP or actual expiry incident tested.
- B-CAND035 (Medium, adapter enabled and extreme value conditional): original
  registry selects CUSTOM_API/MOYSKLAD adapters. Original response parsing accepts
  synthetic9007199254740993 as9007199254740992 rather than reject/preserve; both
  string and numeric JSON forms FAIL for both adapters (4FAIL). Ordinary123456
  stays exact and negative value rejected for both (4PASS). Stub outbound gateway
  supplies response text; no HTTP/provider. Numeric JSON loses precision in
  original JSON.parse, strings during Number coercion. Amount is unusually large;
  no real provider bounds or financial loss demonstrated. Agent result safeInteger
  path is separate and not implicated by these adapter probes.
  `adapter-unsafe-money-probe-1.json`; custom:232, moy:268.
- B-CAND044 (Medium, accepted API configuration input conditional): original shared
  createSupplierDataSourceSchema accepts accessToken and accounts:[{token:...}].
  Original createDataSource stores/returns/audits synthetic markers in plaintext;
  original list exposes configuration to same-organization caller (2FAIL). Existing
  regex DOES protect apiKey, clientSecret, access_token and nested object token;
  encryption invoked and ordinary baseUrl preserved (3PASS). No blanket camelCase
  claim. POST requires import.manage and supplier scope; GET /suppliers requires
  organization.view. Guards traced statically, not bypassed. Inspected current UI
  does not establish real secret entry; API accepts these shapes. No cross-tenant,
  production-secret or cryptography-break claim. `datasource-secret-shapes-probe-1.json`.

Each report records original source SHA/ranges, synthetic fixtures and limitations.
No network, DB, servers or product changes by this worker during these three probes.
Thirteen pure diagnostic groups executed by worker total; root dynamic evidence is
attributed separately. No active owned process.
