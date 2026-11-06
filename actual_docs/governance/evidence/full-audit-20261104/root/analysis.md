# Root reading analysis

## Batch001 — package/build/compose/context

Full nontruncated read: package.json, Dockerfile, compose.yaml,
compose.production.yaml, .gitignore, .dockerignore. Hash/ranges in review-ledger.

- package.json: workspace source graph apps/*+packages/*; main build intentionally
  excludes legacy entrypoint builds; source imports remain reachable. Runtime tests
  have mixed safety wrappers: aliases without db:test must be invoked through audited
  disposable DB orchestration. verify:seed-profiles writes seed profiles; not a safe
  blanket audit command. Existing dependency overrides retained. npm packageManager
 11.16 differs observed npm12; record actual toolchain in tests, not silent equivalence.
- Dockerfile: full workspace copied after npm ci; redis compiler postinstall disabled
  deliberately, Prisma/sharp scripts retained. Unified/legacy/API stages distinct.
  Images include dev/build toolchain; no USER directive/non-root stage. Root execution
  is a hardening candidate, impact depends on effective runtime and write mounts.
- compose.yaml: local dev credentials/auth mode, local port bindings and services;
  never use as production target. API migrates before start, workers wait API health.
  Default legacy frontends; unified comes from production topology. Persistent DB,
  redis,minio,clamav volumes must not be altered by audit.
- production compose: read_only,cap_drop/no-new-privileges, tmpfs, health/ready and
  grace period configured. API migrations at each instance startup; worker no explicit
  API/migration depends_on (race candidate; inspect boot guards before finding).
  No resources inferred for Yandex; existing cpu/memory declarations not acceptance.
- Docker context excludes env, .tmp, .codex, deps/build outputs, actual_docs and
  outputs, but does not explicitly exclude output/ or root test-results/. Review
  actual potentially included payloads with redaction before reporting exposure.
- .gitignore is not audit exclusion: .tmp can contain own diagnostic scripts and
  local runtime artifacts; classified independently in manifest.

No product change or dynamic acceptance in this batch. Candidate claims require
caller/guard inspection and evidence; none is yet confirmed exploit.

## Batches002–006 and root diagnostics

- Legacy production compose parallels unified guards but routes four old apps;
  explicit rollback file exists. Stand overlay publishes only Caddy and persists
  throttling state; verify-compose uses temporary empty-env overlay, never real env.
- Turbo models imported feature files in unified build/typecheck inputs. Main test
  task transit dependencies and schema build recognized. pnpm config remains with
  different overrides; npm chosen. No evidence pnpm is active; discrepancy is legacy
  housekeeping, not installed-tree vulnerability by itself.
- CI selects pilot then go_live rebuild; PostgreSQL disposable service identity
  proven before legacy seed. Container job builds api/web without push. Production
  database workflow defaults catalog sync=true and release publishes images, neither
  run by audit. Release job independent of CI gating; deployment controls need review.
- DAST guard validates HTTPS/nonliteral loopback only and prints safeTarget=true.
  Workflow directly interpolates target_url into shell. Caller is workflow_dispatch
  operator; no untrusted PR path established, so do not call it privilege escalation.
- Caddy headers and API body cap25MB defined. OTEL config debug-only trace exporter;
  no durable tracing backend asserted. Alert rules synthetic thresholds not live alert
  routing evidence. Stand Caddy verified separately when actual binary available.
- Stand gate has MACed cookies, origin/double-submit CSRF, bounded body/password,
  trusted-edge IP cap/global cap and persistent throttle; logout clears cookie only,
  no central session revocation (shared access-layer contract, application auth distinct).
  Source-tested11 scenarios PASS. Test cannot prove entire reverse proxy boundary.
- Catalog sync --apply writes directly with Prisma, no encompassing transaction,
  no business auth/audit-outbox path, sets existing status/source/search fields.
  It is an operator script: administrative access assumed. Calling it automatically
  from legacy API build can mutate selected database; actual deployment reachability
  pending. Dry run no writes; only DATABASE_URL/industry prerequisites.
- DB wrappers enforce local dev/test distinction and hosted-CI special target, but
  test command use still requires exact physical test DB identity. run-canonical-browser
  rejects occupied3000/4012 instead of attaching dev, verifies synthetic buyer.
- Independent serverless original-source VM diagnostic: readiness200 on init failure,
  concurrent creation2; ordinary unavailable503 controlPASS. Backend worker found same
  source behavior independently. Live Vercel effects are not tested.

Practice applied: Agency testing-reality-checker read fully; evidence-vs-claim and
spec/implementation cross-check used. Its unrelated Laravel commands, aesthetic
ratings and blanket screenshot criteria are not project requirements (AGENTS§10).

## Batches007–009 — local runtime, seed profiles, verification harnesses

Fully read the local launcher/gateway/preparation, profile/auth/data helpers,
runtime/profile/config tests, unified asset generator, seed-profile and production
verification scripts; exact paths and hashes in ledger.

- Standard dev checks ports before spawning API/web, refuses automatic migrations
  or reseed, uses readiness and selected catalog. It generates a local JWT key if
  absent. Windows child cleanup targets its spawned PIDs. Gateway checks Host and
  Origin, preserves Origin to API, and reports 503 if any composed surface absent.
  Local FULL_ACCESS is explicit developer policy; production rejection tested in
  localDevelopmentProfile, not evidence of deployed production authorization.
- Root `db:prepare-pilot` still invokes scripts/prepare-local-pilot.ps1, which
  hardcodes marketplace database, migrates/seeds/catalog-syncs without the backup
  and identity checks of the newer db:prepare:dev path. This command was NOT run.
  Audit candidate ROOT-OPS-001: hazardous legacy operator entrypoint; no remote
  attacker path claimed. Standard dev itself does not invoke it.
- Root db:seed uses reference/operator profiles, NOT apps/api/prisma/seed.ts.
  Legacy seed remains explicitly reachable via API prisma:seed:legacy script.
  Backend legacy warehouse/document candidates therefore have conditional scope.
- Reference profile updates six existing feature flags to enabled:false and
  replaces v1 operational document-template content/status. Operator profile
  reactivates organization/membership and replaces role permission associations.
  These are real repeated-seed effects; execution/production incident unproven.
  Guard is NODE_ENV + ALLOW_PRODUCTION_SEED, not physical database classification.
- Unified asset generator copies legacy publics and scopes CSS with Next PostCSS;
  duplicate unequal source assets fail. It does not remove destination orphans.
  Generated auth.css must be matched to this generator/source, not assumed editable
  source or excluded merely due its directory name.
- Production config/auth/runtime scripts inspect built dist, not directly TS.
  Their PASS would require matching build inputs. File-existence checks alone are
  not operational backup/provider acceptance. No production script executed here.
- Focused local runtime/config tests: 15 PASS (46.66s), ephemeral mock HTTP ports,
  no DB/build or running-dev mutations. See tests.md and retained log.

## Batches010–014 — catalog/import/fixture tools

- Historical PDF migration helper executes split SQL statements and then manually
  inserts Prisma migration receipt; no surrounding transaction. A mid-script error
  can leave partially applied schema without receipt. No invocation executed here.
- Canonical importers upsert existing cards to DRAFT and overwrite metadata; this
  is operator tooling, not HTTP authorization. Source scrape failure handling may
  silently drop rows; site crawlers generally lack timeout except shared KZ crawler.
  Sitemap-provided URLs are not origin-pinned, so upstream-controlled destinations
  can be fetched by the operator tool. No current app SSRF claim follows from this.
- Historical fallback generator interprets `нет в наличии`/`unavailable` as available
  and accepts fallback `price` directly as minor units. Runtime trace by frontend:
  archive has no direct application consumers; selected pilot generation replaces
  commercial offers with explicitly synthetic demo offers. `/catalog-fallback`
  still serves bundled data, but no live UI caller found. Impact limited to tooling/
  standalone legacy endpoint until a concrete downstream path is proved.
- Media manifest and REST production importer retrieve service-role credentials
  via Supabase CLI for a hardcoded project. No calls made by audit. REST importer
  has no dry-run/physical target guard; batches not transactional; unpaginated reads
  of existing variants/categories may be truncated by server page size. It includes
  newly generated primary IDs in merge-on-slug/name requests: rerun can attempt PK
  change rather than preserving existing references. Verify with stub transport or
  disposable SQL before confirming effect; no production execution authorized.
- Workbook/PDF builders label sample records; Medstom workbook uses mere presence
  of lifecycle-report JSON to print PASSED without validating its results or input
  hashes. These are historical artifacts, not current audit acceptance evidence.
  Sample import workbook formats rows using full existing-count even in SAMPLE_ONLY
  mode; counts/formatting can extend far beyond the selected sample.
- local-auth fixture verifies physical disposable DB before writes, uses synthetic
  mail/users and own processes. It retains fixture records and revokes synthetic
  sessions; cleanup is not full DB rollback. Follow-up scripts must not infer an
  empty fixture database from stop(). Environment sanitization is delegated to
  registration-resume-fixture, read next. Authority harness uses allowlisted env.

Inventory refinement: five extensionless configuration files classified explicitly;
185 Playwright YAML snapshots classified as generated test artifacts, with provenance
inspection still pending. No files silently omitted. Own full-read target now4526,
root1241; frontend/backend/docs assignment unchanged. Unknown format count0 is NOT
review completion. Change receipt classification-known-formats.json.

## Batches025–030 — verification boundaries and NCA/tooling

- Supplier calendar/storefront/VAT probes cover HTTP validation, permission denial,
  optimistic conflicts, replay, transactional audit failure and immutable snapshots.
  Reading tests is not a test PASS. Their cleanup deletes broad fixture-organization
  scopes and restores assumed publication/active defaults: disposable fixtures are
  mandatory; these helpers must never be aimed at working supplier data.
- VAT flow asserts exact discounted tax rounding, equal-gross tax consent, immutable
  order replay and stale import rollback. Wave1 uses persisted synthetic EDS rows;
  it explicitly does not establish cryptographic/provider acceptance. Its immutable
  ledger fixture requires a separately owned cluster and leaves ledger until disposal.
- Search/handoff load tools count non-2xx and report latency; no latency threshold,
  body semantic checks, request timeout or finite positive load parameter validation.
  A zero/NaN request count can produce a successful empty run. This limits benchmark
  evidence; no load was launched. Handoff uses legacy identity headers: verify current
  route authentication before interpreting results.
- NCALayer browser prototype pins loopback Host/Origin and token for receipts; bounded
  receipt size, no private-key reads. Signing/cancellation requires manual user action.
  SDK prototype test trust and expired/revoked fixtures are not production acceptance.
- NCA identity Java verifier checks policy hash, pinned CA cert hashes, single detached
  CMS signer, current signer validity, EKU/key usage, timestamp imprint/time window,
  TSA chain, and four signed/current CRLs with no redirects. Deployment policy owns
  CRL URLs; it does not fetch certificate-controlled AIA. Missing/invalid revocation
  fails closed. Need trace Node wrapper output-size/concurrency/timeouts: up to four
  8MB CRLs are base64 encoded in result, potentially exceeding subprocess buffers.
  This is a candidate boundary mismatch, not yet a finding.
- normalize-catalog-images obtains service-role access to a hardcoded Supabase
  project, fetches metadata-supplied pages and image URLs with redirect follow and
  no timeout/maximum download size, writes local assets then remote READY metadata.
  The first suitable image is marked exactProductPhoto without semantic identity
  validation. This operator script has no dry-run/target confirmation; not executed.
- normalize-catalog-import overwrites caller CSVs and deduplicates by source|externalId;
  missing identifiers collapse rows. Explicit operator use only, no runtime claim.

NCA boundary follow-up: current Node wrapper permits44MB stdout,45s and2 concurrent
children; schema permits four CRLs of10666668base64 chars plus6certificates100KB.
This accommodates Java4x8MB CRLs. Candidate output-buffer mismatch DISMISSED by
actual caller inspection. Both API source files read fully; backend worker owns ledger.

## Batch031 — explicit operator tools

- prepare-local-operator requires --apply, canonical local DB profile and an existing
  operator organization/role; it will not overwrite differing existing credentials.
  It writes plaintext generated credentials to ignored local receipts with mode0600
  (Windows ACL needs separate inspection, mode alone is not proof of ACL restriction).
  No invocation made. Preview tool defaults read-only and backs up before apply.
- Manufacturer media publisher requires macOS sips, writes output assets before the
  final manifest, and reconstructs the manifest without preserving catalogMode.
  A subsequent prune-pilot-media refuses missing PILOT marker. Historical operator
  tooling portability/metadata concerns, not a live catalog regression without caller.
- Category qualification and batch structure repair use DB transactions but no own
  dry-run/physical-disposable guard; verifiedPostgresOptions supplies transport safety,
  not permission to mutate. No DB commands executed in this audit.

## Batch032 — repair and catalog reports
Both imported-catalog repair variants mutate configured DB; not executed. PG repair uses per-product transaction and existence recheck; Prisma variant selects absence outside transaction then creates unconditionally, so concurrent invocations can create duplicate variants unless constrained. Category upsert sits outside Prisma transaction. Operational candidate only; verify schema/callers before severity. Reports are read-only. report-catalog-expansion hostname suffix validation accepts e.g. notplanmeca.com; provenance validation weakness in local data tooling, not an authorization boundary. report-search-quality prints normalized queries: consider report data sensitivity, no credentials exposed/read here. Quality reports summarize demo artifact and do not prove live availability; core04 explicitly labels limitations.

## Batch033 — pilot seed / admin budget
seed-pilot-demo-market explicitly DEMO organizations and nonlegallybinding agreements but only DATABASE_URL presence guard. Re-run inventory update sets quantityAvailable=quantityOnHand seed constant without updating reserved quantity; may violate reservation invariant on already-used demo stock. Each write independent; partial failures leave prior published offers/compliance. Requires isolated validation and caller/profile classification before severity; never executed on working DB. Search document is overwritten to demo supplier IDs/prices for canonical products, potentially losing real offer aggregation until reindex; compare mode filtering. verify-admin-bundle checks legacy admin .next root route only, not unified web admin routes; budget PASS must not certify unified page performance.

## Batch034 — audit-boundaries harness
Explicit DB URL equality plus localhost/exact database guard and live identity query; synthetic TEST fixtures, owned API port4591. Tests owner/foreign/revoked sessions and agent token separation with HTTP+DB assertions. NODE_ENV=test, MFAfalse: cannot prove production MFA. Inherits provider/integration environment except limited overrides; only auth/agent endpoints exercised. Cleanup sequential and can abort on first FK error; cleanup evidence required when running. Existing dist used, so current source/build provenance must be checked before reusing PASS. Not executed in this batch.

## Batch035 — auth browser / buyer bundle
Auth browser covers incompatible roles, logout failures/lost response/retry, sibling tabs, exact admin logout, cross-identity refresh, multi-org selection, expiry, membership revoke. Synthetic DB fixture and masked inputs, no HAR/trace; runtime uses pilot while underlying fixture profile must be traced. Requires external .tmp next-adapter and built artifacts provenance; source alone not executable proof. Pending logout gate has no own finally release if assertion fails, browser close expected cleanup. Buyer budget same limitation as admin: standalone legacy root page, not unified route measurement. No tests run in this batch.

## Batch036 — buyer context/reviews acceptance
Harness builds isolated dist via Next adapter but temporarily rewrites shared next-env and restores original bytes: unsafe alongside another writer/build, coordinate source checks before running. Fixture is go_live/test synthetic DB. Tests real review RBAC/tenant/invalid IDs, partial receipt eligibility, concurrent replay, injected transactional audit rollback. Browser tests cart organizational confirmation/personal mode, lost review responses and sizes. Older personal-mode copy assumption may no longer match P01, inspect current source before gate. Fixtures intentionally retained (offers archived/hidden in finally); not full DB cleanup. No run performed.

## Batch037 — cart/catalog harnesses
IPC fixture helpers retain isolated synthetic rows; credentials handed to parent IPC only. cart-correction references existing active supplier in disposable DB; stock/price edits restricted owned offers. catalog-polish moves synthetic role/membership into existing supplier and reindexes owned products; cleanup retires offers but leaves membership/role (fixture.stop semantics need accounting). Never run without checked fixture DB. verify-catalog-search report can verified=false yet exits0; counts/publicHTTP200 do not assert desired search visibility/results, and DB/API identity pairing unverified. Candidate false-green gate if caller relies on exit status; trace package/runbook before final severity.

## Batch038 — identity and CSV cycle
core05 identity harness covers invitations/resends/concurrent acceptance, member disable/role changes revocation, password/email/recovery races; uses isolated fixture and own local mail. Do not invoke as alternate path for currently rejected MFA dynamic probe; prior blocked scope preserved. CSV cycle is legacy unguarded API mutation default4012, trusts development headers and complete-development, uses example.kz email (not .invalid), writes compliance and publications and only hides offer on happy path. Declares isolated production path without DB identity/isolation enforcement. Publication-without-agreement expectation200 contradicts current mandatory contract; likely stale gate, confirm callers. Unused callback secret/function do not prove live signing. No execution.

## Batch039 — document diagnostics
verify-document-compliance mutates seeded org/orders and creates active compliance rules, explicitly MOCK signatures; no standalone identity guard, callers must isolate it. Etag equality does not hash downloaded PDF body. Notification gate accepts any relevant SENT entries rather than proving each aggregate delivery; checkStatus remains pre-review value in report. Isolated relations/reference harnesses prove no-write rejection and participant graph; absolute external evidence directory reduces portability, validates no overwrite. Synthetic empty orders explicitly excluded from checkout acceptance. Relations-web/upload are IPC setup/readback, not browser tests by themselves. No executions in this batch.

## Batch040 — identity signing HTTP
Checked test URL plus actualDB identity and no unrelated pending verifier jobs. Builds public SDK fixtures, ephemeral Nest port, synthetic JWT; calls actual Java processor. No live provider calls requested. PASS labels include encryption and10-minute challenge without direct assertions in this script (requires lower-level suites); actual assertions cover checksum, COMMITTED, masked view, replay, cancel conflict, accepted evidence policy hash. Relies on inherited encryption config and compiled dist, SDK fixture local inputs. Cleanup sequential can skip disconnect on intermediate failure. Not run.

Caller followup: package.json exposes verify:supplier-cycle:csv directly with no isolation wrapper. verify-catalog-search no callers found in active package/.github/scripts/docs search excluding archive; false-exit issue classified standalone diagnostic, not current required CI gate. Pilot seed is called by seed-profile.mjs613; guards in that wrapper must be assessed.

## Batch041 — signing UI and worker
UI gate intercepts all API and NCALayer websocket, explicit controlled boundary; tests retained CMS/key replay, uncertain-response recovery, expired/cancelled/rejected/conflict, keyboard geometry at1440/390. Not native/client crypto evidence. Appearance-only path skips unexpected-request assertion; fresh auth endpoints may silently503 fixture. Worker gate uses actual isolated PostgreSQL, synthetic verifier receipts clearly labelled, checks encrypted evidence, cancellation/revocation, same-IIN race, audit rollback, stale lease, retry/crash exhaustion. Exact DB identity and no pending others before processing. Pure source fullread; no execution.

## Batch042 — commands/freshness/multi-instance
Signing commands test real DB tenant/user/session scope, strict base64, replay/conflict, cancel/expiry, encryption and audit rollback; no CMS identity claim. Freshness race gate interposes second DB write after snapshot, asserts fresh publication/version retained, then true expiry plus idempotent event. Multi-instance gate defaults working marketplace DB if no env, only localhost guard, pilot development auth; ephemeral Redis flushall is owned instance only. Runtime test measures12 alternating requests+429, not endurance/failover. Cleanup reports child.killed as stopped (kill sent is not exit proof); record exit checks separately if invoked. No runtime execution here.

## Batch043 — load harness
Full read verify-load-profile.mjs. Generated random dentmarket_b46 DB, same-host admin guard and scoped cleanup protect working DB; existing CREATEDB blocker remains, no execution. Requires existing API dist without source-freshness assertion. Fixtures run only operator/catalog/pilot seeds and use marketplace operator for all requests, so measured authorization is not clinic-role production coverage. Scarce checkout skips validate/reprice unlike main flow; confirm current checkout acceptance before interpreting failures. Same buyer repeated every10 flows with active cart reuse may interact with high configured concurrency. p95 and error-rate checks explicit; expected409 treated successful request and asserted one winner. EXPLAIN block totals sum inclusive parent+child counters and can overcount reads. Cleanup failure sets exit1 but report.status may remain passed; consumers must use exit/cleanup too. No performance PASS inferred.

## Batch044 — local auth and old supplier cycle
verify-local-auth uses owned fixture, email-bound IPC readback, MFA and password reset/replay/expiry revocation checks; pure source review only, earlier policy denial prohibits rerunning dynamic MFA through this path. Synthetic DB records deliberately retained. verify-medstom-supplier-cycle defaults live4012 with no isolated target preflight, synthetic organization creation and callback signing, no finally cleanup (only final offer hiding on happy path), legacy marketplace-agreement creation expects201 although current route410. Candidate unsafe legacy diagnostic entrypoint, not an auth bypass: dev identity and callback secret still depend on server configuration. Reachability through package/runbooks needs reconciliation with previous lifecycle script candidate.

## Batch045 — verifier/observability/onboarding harnesses
NCA public SDK fixture harness bounded children60s/48MB, local CRL fault HTTP, explicit production test-trust denial and policy hash checks; no application/DB. Alert validator checks textual metric inclusion, anchors and scalar synthetic thresholds, not PromQL parsing or actual alert firing. Observability integration has DATABASE_URL→working marketplace fallback and creates rows before isolated-target guard (none); cleanup scoped IDs but no transaction and application spawned on same DB may process jobs. Request fetch no timeout can exceed readiness deadline. Onboarding agreement verification current410/common terms with draft fail-closed and role denials, but default4012 unguarded writes and no cleanup. Group diagnostic isolation risk; inspect package callers before final severity. No commands executed.

## Batch046 — order fixture and outbound gate
Order decision fixture relies on isolated local-auth fixture but selects any ACTIVE legacy marketplace agreement and rebinds owned membership/role into its supplier. Writes synthetic offers and deactivates on disconnect; retained products/lots/orders require explicit synthetic accounting. Not run. Outbound security gate is source-string inventory (including environment key presence), not semantic HTTPS enforcement or SSRF test. Central gateway references/allowlist useful regression markers; success alone cannot prove all outbound destinations safe. Dynamic MFA rejection still applies to fixture-based auth flow, no alternate run attempted.

## Batch047 — PDF supplier cycle
PDF cycle shares unsafe default4012/no target proof/no finally cleanup with medstom lifecycle. Has request30s timeout, text41row/no invented currency and image-review assertions, dedup check, compliance credential/lot control, but obsolete marketplace agreement201 stops before current compliance assertions. Output claims ISOLATED_PRODUCTION_PATH_TEST although isolation is externally assumed, not verified. No execution and no PDF rendering performed; this is JavaScript source audit. Group with existing diagnostic isolation/obsolete contract finding, not separate count per duplicate.

## Batch048 — personal cart browser
Go-live web isolated Next adapter+temporary tsconfig, restores tracked next-env after build (concurrent writer risk), ports preflight and guarded auth fixture. Exercises membership-free login, separate personal/org carts, quantity persistence, price explicit acceptance, aborted PATCH recovery, KK390 geometry and account switch. Lost-response-after-commit is NOT covered by route.abort-before-handler scenario. Uses direct fixture active legacy agreement, not full legal onboarding. Requests readiness fetch unbounded; computed font recorded but not asserted. Synthetic data retained with publication hidden. No browser/build executed during source audit.

## Batch049 — pilot backend
Current pilot harness full-read incl known prior synthetic buyer fix. Host-only local guard allows default working marketplace; selected seeded offer original price/available quantity mutated then blindly restored, and completed checkout/reservations persist. Safe ONLY through isolated db:test wrapper; direct reachable command needs caller trace. contract-only still boots API on chosen DB and reads fixture catalog, no direct fixture writes in branch. Extensive explicit OpenAPI refs + response schemas, error400, reprice409, checkout replay/confirm. Operator identity throughout cannot prove clinic/supplier role permissions. Number conversions limited fixture sort/accepted quantities, not monetary production calculation. No fresh run; prior authorized PASS inputs to reconcile separately.

Caller reconciliation after049: package54–56 directly invoke medstom/pdf/csv lifecycle scripts,69 directly onboarding;80 verify:observability directly invokes integration after build/unit/alerts, without db:test wrapper. CI88 invokes observability in configured CI environment (inspect full CI already ledger). Pilot/core-contract package59/67 DO use with-test-database; thus default-workingDB weakness for pilot is standalone/manual invocation, not normal package path. Observability and supplier lifecycle are stronger active package safety gaps.

## Batch050 — composition gate
Offline deployment-profile probe uses unreachable DB port1, asserts defaultpilot, absence of five optional modules/routes in pilot and presence go_live plus checkout/search/geography. No timeout on child; source/build freshness external. Does not establish optional integration credentials/production readiness, only composition. No new execution.

## Batch051 — platform authority
Broad runtime authority checks legacy global roles/invitations, supplier canonical writes denied without audit/outbox effects, pilot excludesAI and go_live capability-boundAI. Environment helper isolates external providers; source read earlier. Harness itself localhost guard only, runs migrate deploy then db:seed:test; safety depends wrapper and seedguard. FixtureIDs appended only after all organization/user/role/membership/feature creates, so partial failure leaks earlier records. Global role code PID may collide stale run. Cleanup after stopAPI throw can be skipped; storage rm generated run path. No run, no new security proof; earlier dynamicMFA rejection remains.

## Batch052 — PostgreSQL gate
Full dispatcher read; output middle truncated,461–700 reread before ledger. Own complete commercial fixture transaction and synthetic buyers, current public catalog ID, focusedflags plus upgrade paths. Tests tenant denial, rollback trigger scoped buyer, checkout concurrent replay/scarce stock, quantity preserveprice/no silent clamp, staleCAS/explicitaccept/recovery and edit-checkout race; domain helpers previously read. All branches run verifyNineSecurity first, migrations+testseed before target-fixture writes. Standalone localhost guard only; normal package wrapper needs inclusion in final isolation distinction. Trigger cleanup occurs after several earlier cleanup SQLs so one such failure can leave trigger; per-trigger buyer condition prevents unrelated buyer blocks. read-only audit, no current suite PASS.

## Batch053 — scoped profile and resume fixtures
Product preview uses testDatabaseUrl and serializable rollback, fixed IDs preflight, repeat/sentinel/reservation/identity checks then zero fixtures. Profile editing/HTTP require exact audit DBURL + actual current_database; migration temporarytables, CAS winner, audit rollback, tenant/role denial, email revoke. HTTP token is synthetic locally signed with own secret and session, not genuine login; antivirus protocol stub exercises integration paths not ClamAV engine. Serverless bootstrap plus loopback scanner scoped/temp storage, no execute. Resume fixture obtains proof only deliveredmail, mismatch/expired/concurrent claim/rollback retry and existing password checks; scoped trigger but no HTTP timeout and cleanup trigger throw can skip fixture.stop. These source tests do not supply current runtime evidence.

## Batch054 — security/search/session diagnostics
verify-search-commerce unguarded4012 fixed seeded identities: global search rebuild, persistent supplier freshness policy and inventory override (cancellation happypath only), checkout four supplierorders without cleanup. verify-security similarly operates seeded operator MFA enroll/verify/recovery/disable on default4012, no fixture or finally; do not execute (prior policy block persists). Security-storage read-only query fetches complete configuration values into memory but report says valuesRead:false; likely intended notPrinted, literal false inaccurate. Regex misses camelCase accessToken/clientSecret keys (compare crypto actual classifier before security inference). No decrypt/ciphertext integrity check; encrypted column existence/key-format inventory only. Session logout/refresh harness proves source intent exact origin, newer account/session preserved, concurrent audit once and rollback, deterministic refresh/revoke orders, explicit sibling destination survival. Actual tests NOT_RUN current audit.

## Batch055 — signing admission HTTP
Exact approvedDB URL+current_database, local JWT/session/storage and synthetic identity binding evidence (not cryptographic end-to-end NCA). Checks header spoof denied, schema forbidden field/query parsing, no-store, applicant cannot operatorqueue, operator approval/replay/current read. Cleanup scoped relation IDs and owned permissions, storage/checks retained explicit artifact. Timestamp BIN/IIN fixture sequential timing potentially collision only test issue. No current execution; docs should distinguish seeded identity proof from actual signer verification.

## Batch056 — signing admission browser
Fully intercepted /api requests + synthetic sessionStorage, localhost UI base. Covers clinic/supplier1440/390, shared44/radius8/focusoutline, loading/empty/denied/no-upload, identity prerequisite, rejection/resubmit fresh key, abort before/aftercommit and same-key upload/submission retry, operator lostresponse recovery. Explicitly mocked backend: provides UI evidence only. It prevents unhandled API network via503 but static page/SSR origin ownership not preflighted. RU only; no KK acceptance here. No run.

## Batch057 — admission, contacts, bundle
Admission service fixture exact testDB/liveDBassert, mocked storage/verified identity receipts disclosed. Comprehensive submit/review replay and conflict, sameorg peer privacy, role denial, future evidence rejection, identity/membership/requisites/bytes/document-version revalidation, IP fingerprint alignment, competing authority approval and rollback. No external NCA proof. Supplier contact service fixture requires2reserves and verifies public select excludes them, orderprojection includes, CAS/replay/role/tenant/rollback; isolated DB guard. Bundle budget reads legacy supplier-web root client manifest only,20files/1.25MB/380KBgzip, cannot certify unified web supplier route; VM local builtmanifest untimed. No execution.

## Batch058 — supplier product checks
Read filters/paging foreign cursor/reservation/warehouse and promotionphase cases inside rollback with testDatabaseUrl. Product workflows same isolation, savepoint emulation for nested rowtransactions, mocked blob/AV boundary, preview cleans rejected upload, exact money >2^53 and decimal quantities, invalid negative rollback, unchanged reservation/safety invariants and repeat no-op. Separate real secondconnection increments reservation after stale read, asserts CAS rejects and price rollback. No explicit current_database check beyond helper here; service tests substitute accesscontext rather than HTTP role gate. No execution.

## Batch059 — terms fixture and trust/geo
Terms exactauditDB+schema preflight and three freeports, realJWT synthetic terms injected instance-only (not product flag), draft/hash/duplicate/immutable download/foreign denial/operator admission&suspension. Cleanup revokes sessions, retains synthetic records. Child stop only3s then no force/exit assert; startup before try can leak DB/app. Trust-geo unguarded4012 + independent Prisma DATABASE_URL can target DIFFERENT DB from API; fixed legacy IDs, edits buyeraddress, incident/appeals, checkout and direct PAID/shipment transition then buyer receipt. No data cleanup, no servertargetcheck. Strong diagnostic safety issue if direct package/runbook reachable; currently not run. Tests receipt eligibility and no autonomousAI commands but cannot certify real payment/shipping.

## Batch060 — UI/bundle/context/XLSX
UI verifier parses CSS/TSX excluding tests/generated, namedDm imports and CSSmodule property accesses, literals only; token definition discovered anywhere then nonshareddefinitions separately denied. Dynamic spreads/computed CSS classes and TS-only styles outside scanner are not semantic guarantees. Canonical web budget covers home/catalog only with1sVM/pathguard, not all cabinets. WorkspaceContext real fixture checks memberships/org/user live status, hostileheaders, role-specific HttpOnlyrefresh/CSRF, one-usehandoff and session independence, schemas/OpenAPI. XLSX script unguarded4012 writes registration/import, compares matching to manifest, no cleanup; isolation label externally assumed. No execution.

## Batch061 — local tooling
Four .codex files full-read: compatibility hook inert{} and no input inspection/sideeffects, hooks empty, registry canonicalroot/checkpoint metadata only; tests verify no stale ownership keys and malformedstdin ignored. Matches owner14Oct policy, not new task instructions. No execution needed.

## Batch062 — env templates
Development template legacy split ports and publicdemo IDs, authdevelopment, external telemetry/minio assumptions; canonical dev loader previously read may override. Production template JWT/MFA/S3AES256/AVrequired/externalpayment/providerhealth and encryptedkey rotation placeholders; not actualsecret scan or deployment verification. Missing processrole supplied compose; placeholders require guard validation. No real environment values inspected here, no network/providercall. Compare current opsdocs for obsolete legacy/dev defaults rather than treating templates as runtime config.

## Batch063 — performance fixtures
marketplace-smoke measures onlyhealth, not commerce. session-handoff reuses one HANDOFF_CODE across all iterations, omits mandatory browserproofcookie, accepts200/401 in check though current success201. k6 http_req_failed default treats401 failure and threshold<1% conflicts intended repeated denial; missingcode makes every iteration no-op. Not usable success-session throughput or single-use proof (all401 also checktrue). No loadrun due prior environment blocker; source confirmed harness incompatibility, not application regression. Trace runbook/CI callers before severity.

## Batch064 — retained admin-query harnesses
Seven .tmp diagnostic sources fullread, historical R7.7.1.3. Isolated Next adapter/ports and route manifest preflight, real fixture login safe return and logout DBreadback, targeted mocked-navigation suite. flow-b3 explicitly checks exact auditDB URL/currentdatabase and seededidentities. Build restores next-env, concurrentwriter concern if reused blindly; no execution. Hardcoded checkout in result is historical provenance, cannot support currentcommit PASS. Config imports maintained e2e base; reusing evidence requires base+source+build hashes.

## Batch065 — retained admin rebuild checks
Five historical sources: conversation full buyer/supplier/operator attachment+download/privatecache, abort-before-send retry, escalation/resolution/reopen/support closing, private rationale hidden, keyboardfocus/390layout. Routes forwarded fixed4412 and Prisma relies imported config/helper guard; no newrun. Own attachments safe-pathcleanup; syntheticoperator sessionrevoked but records retained. local-preview reads owner credentialfile and signs into3000 (workingstand), NOT an authorized currentaudit test; never executed/read actualcredential. Historical labels do not make fixtures synthetic. Consumersconfigs import current bases; sourcehash reconciliation needed for oldPASS reuse.

Cross-module B-CAND032: frontend worker fullyread one-c-agent confirms job type11–20 lacks idempotencyKey, execute140 onlypayload, create/release148–149 nojobID. job.id onlycomplete/fail129–135; lostcomplete afterexternalcommit sendsretryablefail then repeats action without genericdedupkey. Business IDs may permit adapter-specific dedup; no external runtime duplication asserted. Backend informed.

## Batch066 — retained admin shell
Nine sources fullread. JWTfixture exactDB/currentdatabase/ports and bakedrewrite guards; shell captures six viewport sizes/breakpoints plus real logout revokedDBsession. Separate Vite real sharedAppShell render explicitly not app/API acceptance. Historical result commits hardcoded, targetedtests import current bases so no reuse without hashes. playwright retain-on-failure may include synthetic auth context; artifact protection applicable. No runtime or credentialread.

## Batch067 — retained migration/evidence tools
Thirteen own historical scripts fullyread. apply-approved-profile-migration explicitly targets WORKINGmarketplace, exactpendingmigration+pg_dump/list+beforeafterdigest; pastfilename approval not currentauthorization, NOT executed. Assignment staging prep verifiesHEAD/emptystage and generates threewaymerge previews (not applies). Earlier auditdocs/hash scripts refer external desktop evidence path (must include external-source discovery if available), link validators simplistic duplicateheading/nonhttp schemes. Fetchfont immutableGitHubrevision+blobSHA/size/TTF/license/glyph checks, outputwx and existingdirguard; historical productmutation, not run. verify-built-pdf checks exactcopiedfonts/textbounds/multilingual/largeamount but marksvisualReviewPENDING correctly. No artifactvisualacceptance inferred from source.

### Batch068 — historical logout/resume diagnostics
Seven retained scripts fully read. Explicit audit DB selection, read-only identity checks in logout preparation/readback; historical runtime uses external snapshot and legacy entry points, not current canonical deployment proof. No scripts executed. verify-checkpoint writes ACCEPTED_SCOPED before evaluating integrity conditions, so JSON status alone can misrepresent failing exit; historical evidence weakness, no product impact established. External audit tree dependency retained for inventory reconciliation. Password fixture is synthetic audit-only; no production credentials read.


### Batch069 — historical auth/context evidence
Eight files fully read, not executed. Snapshot-based launchers are historical and conflict with current canonical-folder execution if reused; no current caller established. Integrity03.3 excludes branch/whitespace from PASS predicate although captures whitespace, while03.4 includes these checks and resume verifies gate exit codes plus source/artifact equality. Hardcoded runtimeGates descriptions alone are not executable proof. Startup diagnostic patches Module._load only for timing and observes own API readiness, but entrypoint hash alone does not prove all compiled inputs. Retain historical scoped results only with full applicable input reconciliation.


### Batch070 — historical cart correction
Eleven scripts fully read, not executed. Initial AUD-FIX04 integrity computes lock/head equality but omits them from status predicate; resume-finalize adds those and branch plus all artifact hashes/gate exits. portal-readback verifies synthetic audit accounts, revoked sessions and carts/history but zero orgs could vacuously pass cases; historical coverage limitation, not current app finding. Remaining pipeline intentionally throws before any action. Startup60s observation preserves withinOriginalDeadline separately, cannot turn20s FAIL into PASS. All external runtime/snapshot references remain pending inventory reconciliation.


### Batch071 — catalog polish evidence
Ten scripts fully read, not executed. Finalizer checks gate exits/build hashes/branch/lock while historical reuse of five cases relies on literal log substring5 passed, insufficient alone to bind cases to current fixture inputs. Snapshot update scripts deliberately permit exact fixture/test changes and hold builds fixed; this is historical test-only reuse with explicit bounds. Bundle diagnosis executes generated webpack registrations in VM (first manifest no timeout), not untrusted-input safe execution; local diagnostic only. No new product defect from these files.


### Batch072 — cleanup/startup observations
Eight files fully read without execution. Catalog cleanup readback permits empty run set, so PASS proves no selected active data rather than executed functional coverage. API-only uses allowlisted audit DB and synthetic run, timing instrumentation wraps module/Nest/Prisma functions but does not skip guards. Checkpoint explicitly preserves browser failures and labels readiness diagnostic only; hardcoded numeric history must be checked against result inputs if reused. No new active product defect inferred.


### Batch073 — historical order decisions
Nine files fully read, no execution. Explicit BLOCKED initial checkpoint keeps all3 failed browser result codes; later acceptance references separate authorized diagnostic/fix and two focused tests plus3 reused cases. Scope/status wording kept distinct from production acceptance. Hash checks distinguish original compiled metadata drift from unchanged executed backend artifacts. Frozen allowed-file lists can miss newly added inputs until final Git reconciliation; final checkpoint does union comparison. No new current product finding.


### Batch074 — document relation verification
Ten scripts full-read, not run. Historical07.2 checkpoint correctly demands failing tenant probe and leaves all implementation gates NOT_RUN; acceptance requires later security24cases/browser cleanup/artifact hashes. Unit coverage parsed from aggregate passed counts cannot alone prove named business scenarios. backend-check operates external snapshot, unsuitable for current canonical execution. Order-decision readback same empty-run caveat as earlier, later finalizer adds exact5runs. No new product defect.


### Batch075 — upload/relations
Ten historical scripts fully read, not run. Upload cleanup verifies one run, session/mail retirement and file digests; relations cleanup restricts1–2runs, checks stored bytes. Neither requires nonzero documents/users; functional coverage must come from browser/API tests. Type scripts use passWithNoTests and printed reused gates, so aggregate PASS cannot establish absent suites. Candidate sync copies all changed apps/packages/scripts without explicit allowlist before subsequent acceptance; historical tooling risk only, no current invocation. Source/runtime hash and failed-gate history preservation otherwise explicit.


### Batch076 — current-era remediation diagnostics
Eighteen files fully read, no executions. Dependency smoke covers glob legacy/modern Unicode paths, bounded minimatch expansion, abort no further reads and XLSX roundtrip; useful limited regression evidence, not complete dependency audit. Recent UI fixtures assert disposable DB identity before writes and remove fixture user/roles on dispose. UI server owns canonical3000/4012 and requires free ports, test/pilot JWT/mock local storage; inherits process.env so not a complete external-side-effect quarantine (mail/CRM settings need separate preflight). Contrast test measures input/textarea rest/hover/focus, only desktop+390, no disabled/error/KK coverage. Old upload finalizer adds exactly2documents, resolving preceding cleanup vacuity for that gate. No rerun because inputs not established.


### Batch077 — theme/auth/tooling
Nine files full-read, no execution. Theme mutator performs broad lexical CSS replacements and appends overrides, non-idempotent; no authorization to reuse. Auth navigation uses canonical code plus isolated distDir, disposable DB assertions and explicit ports; source evidence manifest hashes only diff/new selected sources and few compiled entrypoints, insufficient for complete current-build reuse alone. Shell baseline grants all permissions only synthetic operator fixture and explicitly labels no acceptance. Product-description generator creates research Markdown, distinguishes family vs exact REF, never writes DB; nomenclature concerns require source/domain verification, not inferred new bugs.


### Batch078 — supplier UX report generator
Entire38KB generator read, not executed. Seven supplier-page expert observations are pinned05Oct head, RU1440/390, demo data, navigation only; report explicitly excludes clinic visual proof, populated support, write/recovery/full accessibility/production. Proposed UI changes are not new audit scope or current acceptance. Generated HTML escapes data strings, trusted fixed image paths; report title/findings consistent with evidence caveats. Claims like35PNG are fixed metadata, actual evidence.files computed; must reconcile actual artifacts before reuse. No current bug asserted solely from historical text.


### Batch079 — registration/signers narrative
Full Python DOCX generator read. Output is external desktop document dated21Oct/5c152d6, scope includes historic current-vs-target employee signing and admission. Explicitly separates organization owner technical role from legal signing authority, invitations from mandates, operator admission from supplier contract, pilot evidence from production. Target sequencing and old incomplete employee UI must be reconciled with current sources, not treated as new backlog/current defect. Script writes only DOCX output, no API/DB calls; no execution. External generated DOCX is an actual source artifact to account for if present.


### Batch080 — business-rules synthesis generator
All480lines read in1–120/121–240/241–340/341–480 after initial output truncation. Script embeds02Nov c812cba historic statuses then reads CURRENT orders/spec and writes canonical BUSINESS_RULES_AND_IMPLEMENTATION. Rerunning now would combine stale personal-cart/calendar/SLA/delivery pending labels with newer decisions; not safe maintenance automation. Current03Nov fixed two-amount/no postpayment surcharge decision overrides old SHIP15 packing repricing language. Generated coverage is thematic section mapping of150Q+20T+10P plus exact68BQ and25decision count, not executable implementation proof. No rerun/no docs mutation.


### Batch081 — stale maintenance scripts
Fourteen scripts fully read, not run. business-rules finalize restores five canonical docs from cached navigation-before then edits, so rerun can overwrite subsequent changes; explicit historical-only tooling. validate checks baseline/IDs/links/checkboxes, not semantic truth. Receipt-fragment creates synthetic TEST order/receipt/review against isolated fixture, checks409/replay/duplicate but directly seeds order rather than checkout/payment. Build branch restores next-env in finally, potential concurrent overwrite if reused without coordination. Cabinet browser reads local dev-account file and uses credentials in CLI arguments; do not execute/read credentialfile in this audit. Catalog code mutators use unchecked string indices/replacements and append docs; unsafe to replay on later code. Existing implemented outcomes reviewed by assigned frontend worker.


### Batch082 — staging and category tabs
Thirteen scripts fully read, not executed. Historical staging constructs partial blobs to preserve foreign hunks, but cached baseline/index and stale publication strings make replay unsafe; catalog stage checks only local origin ref (no fetch) and current overlap, category stage writes100644 blobs for all manifest entries including deleted markers (would fail missing output). These are dormant one-off scripts not current Git actions. Mock visual tests verify equal cards, tab underline/selection/keyboard and overflow; no backend/auth proof, admin wildcard returns200 for unknown endpoints and weakens drift detection unlike strict product/docs fixtures. CI config inherits current base, historical artifact cannot certify unchanged configuration automatically.


### Batch083 — prior CI/audit methods
Sixteen files fully read, not run. Focus diagnostic deliberately intercepts requestAnimationFrame callbacks to demonstrate race; controlled experimental observation, not unmodified-runtime certification. CI final receipt correctly distinguishes113browserPASS from later full-access authFAIL. Prior docs inventory marks history INVENTORY_LINKS_ONLY and samples headings/excerpts; cannot satisfy current exhaustive fullread brief. Archive mutator pins4543fd22 and preserves original/body/stub hashes with relative-link rewriting; current audit only verifies historical outputs, no archive work authorized. Build wrappers restore next-env and use isolateddist, potential concurrent writes require coordination before any rerun.


### Batch084 — prior comprehensive audit
Nine files fullread, not executed. Freshness race uses real twoDBconnections but Proxy barrier and mocked supplier permission: valid isolated service interleaving, not HTTP/auth proof. Hardcoded4543fd22 report revision is not verified in harness; current revalidation needs actual source/build hashes. HTTP candidates separate anonymous session mutation and agent bearer-case tests with synthetic tenants, token outputs excluded; raw error logs may include runtime metadata. Read-load measures429 responses together with200 latencies and dev-auth pilot/test profile; package-evidence explicitly refuses capacityPASS/restore/native/live/security. No currentPASS reused. Docs manifest relocation checker differs from archive writer in fencedcode/query handling; actual manifests need exactcompare, not assume generic validator correct.


### Batch085 — prior UI and CORE helpers
Ten scripts fully read, not run. Prior UI audit mixes real fixture auth/API with intentional503 interception and CSSzoom2 (not native browserzoom), preserves RU/KK navigation/dirty input checks. ERP support-request observation is not self-service ERP acceptance. Dev migration helpers require explicit owner flag, exactmarketplace identity and exactpending list; counts alone do not prove row preservation, current task grants no migration. CORE03 cleanup pins synthetic UUIDs and ownership names but does many deletes nontransactionally and lacks finally disconnect; would partially clean on failure. CORE02 orphan cleanup uses timestamp+absentorg rather than runmarker; don't reuse. All dormant historical tooling, no new runtime claim.


### Batch086 — CORE cleanup/locks
Three files fullread, not run. Promotion cleanup transaction restricted synthetic names/email and checks no commerce/docs, but all matching runs rather than one owned run; historical authorization cannot be carried forward. Dev-preflight read-only queries exactpending migration and orderitem null counts. Advisory diagnostic intentionally compares queryRaw voiddecode failure with executeRaw success, only isolated DB; not concurrency/order-lifecycle acceptance.


### Batch087 — historical core06 schema
Full4322-line schema snapshot read in ranges. Historical agreement unique-by-status, optional domain relation IDs and integration retry models retained for comparison only; current implementation reviewed by backend worker. No schema execution or active-runtime finding inferred from this snapshot.

### Batch088 — archived diagnostics
Date probe uses connection default and SET LOCAL UTC inside transaction; demo cleanup pinned actor/date and asserts unused business entities but explicitly deletes in working database, so not executed. Fixed localhost demo smoke relies on historical identity headers, not current go_live proof. Profile/save-toast and shipment-baseline diagnostics mock backend; may demonstrate only frontend fixture behavior. Historical screenshot generation and local schema scripts not rerun.

### Batch089 — schema-copy equivalence
Historical discrepancy schema adds requisites revisions, invoice preparation uniqueness, tax snapshots, business conversations/reads, assignments and session-origin links. All changed hunks read; exact unchanged line ranges map to fully read core06 snapshot via schema-equivalence-089.json. Recorded distinct coverage depth, not a second literal full read. Historical constraints are not evidence of current runtime behavior.

### Batch090 — discrepancy local tooling
Build wrapper restores next-env but builds canonical app using pilot adapter, so not suitable alongside active dev without coordination. client-wire/cleanup-fix overwrite original files via brittle text replacement and are historical only; not run. Require hook redirects dist by hardcoded substring length. client folder stubs show generated Prisma marker; remaining generated client requires explicit reclassification, not application full-read.

### Batch091 — generated client schema snapshot
Compared complete schema to batch089; content equivalence checks preserve quoted strings and normalize only external whitespace. All changed hunks read: generator client output and discrepancy/event entities with order/org idempotency and per-discrepancy version uniqueness. Historical, not current service proof. Initial verbose diff truncated, replaced by complete whitespace-filtered diff plus machine-checked equivalence. Generated client23 files20.19MB explicitly classified with SHA evidence in root/classification-exclusions.json; master manifest reconciliation still pending.

### Batch092 — discrepancy patch/evidence writers
Historical docs/evidence/finish scripts embed fixed PASS statements; they are not test results and must not be rerun. Hygiene script recalculates validated-input hash after SQL whitespace edit without runtime; acceptable only if semantic equivalence independently demonstrated, not generic freshness. Migration helper writes current HEAD snapshot and target migration path unconditionally; may overwrite old migration if reused. Frontend focus/version patches and PG cleanup changes show historical defects/recovery intent, current implementations audited separately. Staging review checks exact filenames and relative links but not semantic isolation.

### Batch093 — local schema source
Discrepancy local source and generated-client schema differ only in external whitespace/blank lines. Complete diff read, token equivalence machinechecked with strings preserved; no semantic delta.

### Batch094 — historical task tooling
Staging script checks empty index/HEAD/foreign hashes and merges task delta, but validated-inputs records working copies rather than staged blobs; cannot independently certify reconstructed staged contents. Scope-specific historical script, not active publication. Visual mocks retain fixtures and screenshots only. Unit patch traces packaging UOM change. Archive verifier checks normalized content/rebased links, pinned hashes and command aliases, but historical CORE unchecked assumptions are obsolete; do not execute as current acceptance.

### Batch095 — docs archive maintenance
Archive script validates baseline SHA/dirty sources/target containment, rebases Markdown links and preserves fragment wrappers; navigation sourced from baseline commit. Verification compares hashes and link-stripped prose, but link destination validity alone does not establish original target equivalence; mapping must be reviewed. Historical commit-docs uses alternate index and restores per-path entries after commit with preservation checks. No execution; no publication authorized. WIP classifications hardcoded for October6, not current task ownership.

### Batch096 — historical publication and rate diagnostics
Publication scripts preserve foreign delta via isolated index, strict branch/base checks and exact added/removed line comparison; fixed historical doc rows and receipts make them nonreusable without revalidation. Historical access diagnostic captures only context status/request/rate headers. Prior auth429 diagnosis and later promotion fixture failure are distinctly recorded; hardcoded finalize scripts do not prove current CI. No historical scripts executed.

### Batch097 — archived rate/theme/import probes
Rate tests inspect finite boundary and separate login bucket, dispose fixtures; results not rerun/current. Governance-policy script hardcodes now-replaced permissions/full-E2E and protected hashes, no authority today. Theme migration imports external proposed-tokens JSON in Codex visualization path; add external source to inventory. Import-selector launcher positively checks auditDB name then derives public org, but broader inherited config needs current scope before reuse; historical flow overrides development auth. No execution.

### Batch098 — templates/invoice setup
Import example explicitly fictitious, major-unit price and stock-before-reservations instructions; XLSX namespace normalization rewrites archive entries without extraction. Historical cleanup verifies audit DB and exact run ID/org name, though user IDs only manifest-bound and idempotency scope contains matching broad; no execution. Build/alias scripts mirror already reviewed discrepancy counterparts. Another generated Prisma client tree identified; classify with source/hash evidence separately.

### Batch099 — invoice client schema
Invoice generated schema is complete token-equivalent to089 with local generator output and blank lines only; diff read and ranges checked. Three more Prisma generated trees positively identified by package metadata and entrypoint markers;69additionalgenerated files explicitly excluded with hashes. Total92 root exclusions, mastermanifest reconciliation pending.

### Batch100 — invoice acceptance writers
Fixed receipts distinguish initial retries/owner resumed plan and scoped acceptance; no runtime reproduced by these writers. Original generate helper initially points outDir to canonical API dist, later build-setup overrides isolation, so do not run blindly. prepare-stage constructs task-specific merged proposals with missing-index-marker risk if reused; no current staging. PDF contact sheets show10 page slots (5x2), insufficient alone for >10page inspection. No current invoice defect inferred from historical scripts.

### Batch101 — invoice schema generator
Historical insertion script appends export/models and modifies Document relation by exact replacement, lacks idempotency or migration guards; no active invocation established. Not executed.

### Batch102 — invoice local schema
Complete quote-preserving token-equivalent historical schema to099, blank lines only removed. Diff read and range equivalence asserted; no new runtime contracts.

### Batch103 — historical runtime/migration tooling
Invoice patch/staging scripts require historical sources and are not executed. JanaPost extractor references actual external Desktop/JanaPost API PDF/DOCX; inventory pending. session-upgrade clones workingDB into temp restore target; session-apply rehearses DDL on workingDB in rollback then deploys after backup-readable check despite restoreBLOCKED. Explicit current audit prohibits both; this retained script is not permission. Snapshot omits originLoginSessionId to permit additive-null column, row hashes/counts not full restore proof. Current load/restore blocker remains; no retry or DB actions.

### Batch104 — historical messages audit
RealAPI harness pins auditDB/loopback and routes browser API to isolated4412, keeps auth server checks. Creates persistent operator/org/order records; close revokes sessions/disposes seeded contexts but does not delete audit actors/order/conversation, so cannot claim full fixture cleanup from this source. Backend probe mutates exact prior synthetic ticket and restores RESOLVED only on success, no transactional-finally cleanup. Mock operator tests capture polling absence and recovery overwrite; inspect current UI before carrying findings forward. No historical test run.

### Batch105 — historical migration/UI diagnostics
Messages mock tests exercise selected-chat URL, unread/draft and keyboard; current operator-login test contacts live client-options only as written, not run. Signing migration script validates two exact pending migrations/workingDB and compares existing rows, but pg_restore --list proves archive catalog readability only, not restored data recovery. Current task no workingDB writes. Feedback conversion replaces focus refs and role alerts across shared consumers by textual patches; current accessibility requires actual component review, no assumption from historical conversion. NCA inspector validates CMS/chain/timestamp on supplied files, logs certificate usage/anchor match; no secret keys or identities displayed by audit.

### Batch106 — profile baseline
Historical headless profile screenshot uses synthetic session and all API interception, unknown request503. Useful only UI fixture snapshot; no signing or identity trust proof. Not executed.

### Batch107 — preidentity schema
Complete equivalent-range review against091 plus read changes: resupply unique shipment/discrepancy/source/reservation relations and quantities, local generator output removed. Historical previous schema only; no identity logic or current resupply invariants proven.

### Batch108 — NCA history/tools
Identity SQL shows command composite actor/org/auth-session FK and evidence uniqueness; binding active uniqueness not in this snapshot, current migration/runtime audited elsewhere. Cached CRL indices list expiry/download URLs; not current cryptographic evidence. OCSP Java performs actual external request if executed; linux runner reads SDK test-key password and invokes signing diagnostics. Not executed and no credential file read. External SDK source under Downloads/SDK/SDK/SDK/SDK/SDK2.0 needs safe inventory metadata. WSL installer changes host environment; prohibited without separate scope, historical existence no authorization. Initial combined read truncated, full11files reread before ledger.

### Batch109 — questionnaire generator
Full460line generator reviewed. It separates technical/external prerequisites from owner decisions, retains accepted10%/90days/mobile, maps51questions and37decision rows, checks set equality. Writes questionnaire/registry from before snapshot and marks all choices unselected, so rerun would overwrite later answers; historical tool only. Generated recommendations are not accepted policy, dates matter. Duplicate labels/ID references in text need current docs reconciliation handled by docs worker; no product mandate inferred.

### Batch110 — questionnaire/operator historical tools
Questionnaire validation checks51IDs/options/anchors, exact historical suffix and unchanged checkboxes; protects historical contents for original task only. Operator visual probes use mocked API and synthetic sessions; technical replay screenshot opens dialog without submitting writes. Most build wrappers compare next-env ignoring generated route imports before restoration; older dashboard blindly restores, so preserve current concurrency boundary. Unknown mocked endpoints often return emptyarrays: screenshot success insufficient route/API completeness. No execution.
`n### Batch111`nRead16 historical operator import/order/organization/queue/trust diagnostics. Reconciliation test explicitly guards disposable URL, checks five concurrent replays/single audit and injected rollback; no current execution. Visuals stub API/session, prove only rendering under synthetic fixtures. Staging scripts pinned historical HEAD and mutate index, never executed. Operator-organizations build restores next-env unconditionally whereas queue/orders detect normalized drift; historical tooling concurrency limitation, no current product finding. No new runtime evidence.
Batch112: five historical files fully read. Trust migrate-dev explicitly targets working marketplace, backs up and checks migration uniqueness but is outside current no-working-data scope; not executed. Trust build isolated output with normalized next-env guard. Staging mutates index and selects roadmap hunk, not executed. Order decision script documents accepted Oct31 clocks and remaining DG03/06/07 technical gaps, not proof of implementation. No new candidate.
Batch113: complete order-decisions-docs.py read in two ranges. Seven-file documentation generator checks clean paths, snapshots originals and inserts 25 owner rules/T01-T17 explicitly DESIGN_PREPARED/NOT_RUN. It preserves external payment/legal gates and differentiates versioned proposal deadlines from first-response clocks. No implementation proof; archived tool not run. Mutation lacks atomic multi-file rollback but no current caller established; not promoted to product finding.
Batch114: seven files full read. Decision validator checks all25 rows/17 planned transitions/links/unchanged checkbox counts, explicitly docs-only NOT_RUN. Requisites staging reconstructs partial blobs from baseline and working source, must not rerun against current HEAD; no execution. P02 supplier calendar baseline uses isolated fixture+ports and cleanup, but screenshot/current label only, no calendar behavior proof. Build adapters isolated outputs.
Batch115: six P02 calendar files full read. Browser exercises real API draft validation, CAS and idempotency retry, permissions, RU/KK and keyboard. Order browser directly inserts calendar snapshots, so only snapshot rendering/immutability proven there, not checkout construction. Migration script working DB only with --apply, not authorized now. Volume-null probe disposable identity and transaction rollback, no current execution. Stage helper selects first checkpoint hunk by line range, obsolete scoped tooling only.
Batch116: four P03 files full read. Browser invokes OrderResponseService directly at controlled45/60/120 timestamps and seeds orders, with actual UI polling503/recovery/inbox and RU/KK. This does not prove scheduler cadence or real external delivery. Fixture stop/restart followed by operator view relies on retention of support ticket dependencies; require actual fresh run before reusing evidence. Working DB migration and staging not executed.
Batch117: eight files full read. Payment protection generator clearly leaves compensation policy GAP02.1 unapproved, separates chosen representative process from guarantee; validator shallow but correct docs purpose. Promotion receipt generator hardcodes prior CI acceptance and mutates docs/index on pinned HEAD; never current evidence. Profile-nav synthetic visuals only. No new product findings.
Batch118: nine historical scripts/configs full read. Hardcoded PASS doc/staging tools not executed or accepted as current proof. publish-wip-check flags secret patterns without values but reads all untracked content and only narrow token families; not full security scanner. Quantity clamp staging visibly replaced dynamic min/step hint with fixed1–100 copy; historical origin potentially relevant to confirmed FE quantity issue, not additional issue. Login probe aborts every nonGET and prints body keys only, no auth success proof.
Batch119: catalog regression and local server fully read. Seven scoped scenarios include palette/keyboard, authenticated returnTo, mocked cart409/503 retry, URL/filter restoration and stale-response cancellation. Quantity fixture min2step2 cannot expose min-offset mismatch reproduced by current probe. Prisma password update requires isolated wrapper; server uses canonical source/alternate dist. No run or current PASS.
Batch120: archived profile test full read1–end in two ranges, differs from current test SHA. Broad synthetic draft/conflict/session/contact/address/toast/mobile checks. Historical supplier-source tests expect support request as ERP connection; explicitly obsolete against current self-service requirement, cannot certify current flow. No new code issue inferred from archive.
Batch121: two files full read. Archived unified tests exercise real body limits/upload/cookie refresh and scoped auth with synthetic accounts plus theme mocks; no current runtime acceptance. refine-more generator rewrites inventory and shared search consumers by string/regex; historical unused generator, current implementation owned by frontend review. No product modifications or script execution.
Batch122: four historical generators/build helpers read. refine-pages/tests apply shared search and inventory simplification using regex, rewrite corresponding assertions; no current acceptance inferred. remove-refresh build restores next-env unconditionally, same historical concurrent-write limitation already grouped. cart-fix adjusts mock endpoint and copy/page title. None run.
Batch123: eight remove-refresh files full read. Extracted synthetic cart/document fixtures include API state/error controls; cart test verifies conflict draft persistence and delete focus only. Historical AST/regex editors delete fixed-index refresh controls and update status/copy; depend on saved offsets/baseline and not safe generic maintenance commands. No current execution/defect assumed from edit intent.
Batch124: sixteen historical scripts/configs fully read. Fingerprints bind former inputs but receipts static/hardcoded and several source outputs included foreign WIP, so scoped published vs local evidence explicitly separate. AST import cleanup counts identifier text not symbol references, obsolete editor only. prepare-index uses threeway merge to isolate ownchanges with explicit conflicts; no current index operation. Retained failures3attempts recorded historically, not a newcurrent gate count unless identical input. No execution.
Batch125: twelve historical recovery/staging/test editors full read. Multiple old refresh assertions replaced by reload/focus/filter changes; historical coverage no longer same trigger, do not equate to old freshness test automatically. Current tests audited independently. Conflict resolver preserves foreign rewrite in live-metrics and selects scoped own hunks; no git actions run. Existing riskgroup historical tooling only.
Batch126: five files full read. Eight visual cases synthetic controls only. Resupply cleanup explicitly targets fixed disposable run plus order IDs and derives cleanup function from current script, not general safe cleanup; no invocation. Module hooks redirect old build/client for isolated historical verification; provenance needed before any reuse. Build restores next-env without drift guard as grouped.
Batch127: full historical resupply client schema accounted via token-equivalence preserving quoted strings to reviewed invoice schema102, and all changed hunks read. Adds discrepancy revision/event CAS+idempotency unique keys, resupply shipment/source uniqueness, item reservation link. Not literal full reread; special ledger depth. No claim current runtime.
Batch128: four resupply adapters/harness/preview files full read. prepare redirects generated Prisma and API build to audit output while source stays canonical. run-pg uses db:test wrapper and --resupply-only, fonts copy; NODE_OPTIONS paths need quoting with spaces if moved. PDF previews rely on built modules/fixtures, not legal or current source evidence. No execution.
Batch129: resupply source schema equivalent to127 except eight blank lines; full content accounted by quoted-string preserving equivalence, zero new semantic lines. Special depth retained.
Batch130: four staging/browser/API configs fully read. Staging checks index but whole files could include unrelated changes; historical artifacts never invoked. Resupply browser isolated port3103/production pilot output +mock flow suite, API config overrides built entrypoint/client hook. Current verification must bind generatedsource and environment, not reuse byfilename.
Batch131: eight roadmap harness/config/doc scripts full read. Combined real API/UI config uses isolated clients and generated builds; docs updater asserts prior scopedPASS without checkinglogs, not reused currentproof. Trace resources22 files reclassified test_artifact after exact SHA1 content-address and SHA256 baseline validation; individual provenance/limits in exclusions. They are generated responses, not own source, no fullread claim.
Batch132: full roadmap-cycles generator read. It prepends historical P01-P40 package map without current-state guard and saves before snapshot; rerun duplicates/stales accepted decisions. No execution. Package grouping explicitly separates external inputs, runtime/UI acceptance and publication; not itself implementation or current authorization.
Batch133: full contract validator read. Protects 180 Q/T/P rows and R statuses against historical89a8df9, validates changed links and Desktop prepared-or-original hashes. Explicit Desktop unified technical spec is external source for inventory; validator not executed, historical successful report cannot establish current contract completeness.
Batch134: complete historical roadmap/domain sync generator read in1-160/161-340/341-end. Preserves dated foundations beneath new requirements, separates design/open external inputs from implementation. Exact-text replacements fail fast in memory, but final multi-file writes lack atomic rollback; historical tool not executed. Current accepted policy requires present docs, not these older embedded strings. No new product finding.
Batch135: full historical entrypoint/domain/amendment generator read. Embeds historical CI IDs and explicitly says docs-only does not certify dirty tree/newscope. Writes sequentially, inserts duplicated historical sections on rerun; not current maintenance or acceptance tool. No execution. Existing domain discrepancy candidates remain assigned documentation review.
Batch136: seven files fully read. Unified-spec extraction retains180rows and later accepted choices, writes source-derived Market contract; does not itself verify runtime. Rules-gap validation checks foreign hashes, row/checklist preservation and explicit anchors; source agreement clarified unchanged-order consent. Three build adapters isolate output. No execution or new acceptance.
Batch137: six full files. Settings DB preflight checks exact disposable local database identity and required fixtures read-only. Settings/sidebar/signing baselines intercept APIs with synthetic sessions, mostly enforce unknown503; screenshots/computed styles cannot prove authentication/admission/EDS behavior. No execution/currentPASS.
Batch138: historical admission DDL and regression config full read. Snapshot provides per-admission review/authority and actor/scope/key command uniqueness, but no composite principal/organization equality constraints here; current service guards audited separately. No migration execution and snapshot not current schema certification.
Batch139: historical preadmission schema accounted via string-preserving equivalence107 plus all98addedlines read. Adds identity signing session/command/evidence/binding with composite command FK, leases and partial-active uniqueness documented as migration-owned. Special equivalence depth, not literal reread/current crypto evidence.
Batch140: eleven files fully read. Historical stage-product-refinement selects all changed apps/packages/scripts and stagecontacts most dirty paths, so printed owned label is not proof of scope; no invocation. Storefront migration explicitly working marketplace backup+deploy, not authorized now; expected list checks inclusion after deploy, does not constrain additional pending migrations. Current caller not established, grouped as historical tooling risk. Bundle analysis only existing generated artifact, capture screenshots not functional flow proof.
Batch141: thirteen historical storefront/staging files fully read. Concurrent-save helper performs authenticated write from saved fixture; no execution. Browser snippets cover scope/focus/language/conflict cancellation but have no current receipts. Reference evidence updater embeds PASS strings, not independent verification. Stage helpers preserve selected index deltas but depend on old exact text and expectedHEAD; no staging authorized or performed. No new product finding.
Batch142: nine files fully read. Historical CSS normalization quantizes styles and strips local focus declarations through selector heuristics, not a current design acceptance tool. Control centralization cannot establish semantic adapter mapping from strings alone; current source separately reviewed. Support/theme browser scripts synthetic/diagnostic, not executed. Build wrapper restores next-env regardless concurrent edits, existing historical limitation. Profile fixture records unexpected503 and uses synthetic sessions; no real authorization proof. No product changes.
Batch143: fifteen files fully read. Old guidance test assumes support-request ERP dialog, not current self-service acceptance. VAT mock tests assert disabled save and requisites link only; no fiscal/accounting verification. Access regex updater and product layout replacement are historical exact-source mutators without current use. Orphan cleanup tests matching environment URLs, not disposable identity independently; execution prohibited here. Client hooks isolated generated client. No new runtime proof.
Batch144: historical VAT generated-client schema accounted via quote-preserving equivalence to139 plus all diff hunks read after bounded-output reread. Seven target lines added (output path and blanks); older snapshot omits later discrepancy/invoice/identity entities. Special equivalence depth, not literal full reread or current-schema acceptance.
Batch145: five files fully read. VAT generator isolates Prisma output but compiled API outDir is shared apps/api/dist, so historic build wrapper not inherently isolated from running dev. Own-files diff classification cannot identify another writer appearing after baseline. Index preparation uses threeway conflict report; no execution. Extractor requires old anchors and writes module then caller sequentially. No new active-caller finding.

## Batches146–147
146 VAT source schema is token-equivalent to144 with only six blank-line deletions; hashes/ranges retained, special equivalence depth.147 full-read14 historical VAT/waybill scripts/config. VAT activation explicitly targets local dev DB and deploys migration; no current execution authorized. Stage-reviewed protects HEAD/staged set but can write Git objects/index; historical only. Waybill build uses isolated dist but prepare-unified-web and next-env writes still touch canonical tree, unsuitable for concurrent uncoordinated execution. Generated contract/doc writers encode historical preview-only semantics, not current acceptance evidence. No new runtime defect established by these archived tools.

## Batch148
Seven historical waybill scripts full-read. Receipt writer hardcodes historical PASS counts and skip-CI decision; neither is fresh proof or current permission. UI test writer covers mock retry/key preservation/conflict/focus and lacks real backend authority proof by design. Visibility writer injects shared preview predicate in historical commerce query, actual API implementation reviewed by backend owner. No new active defect proven. Git staging script checks baseline HEAD/index then selectively merges WIP; not executed.

## Batch149
Archived production-preview app.js/fonts.css fully read for explicit all-source scope. Prototype states it has synthetic state/no API; actions display mock notices, filters are local and tabs only state styling. Its quantity/money and permissions are demonstrative and cannot be used as evidence of product behavior. Uses DOM innerHTML with controlled page/template data, query page selector resolves known DM_PAGES; no arbitrary query interpolation traced here. Historical radio name/group and tab keyboard limitations confined to prototype, not promoted as live frontend findings. Fonts referenced locally; binary existence/hash handled asset inventory separately.

## Batch150
Icons consist of static SVG path strings with aria-hidden, no script/event/remote payload. Gallery embeds only known-page local preview URLs and disables miniature interaction. Finalize exporter explicitly distinguishes DOM geometry from visual/function acceptance and preserves blocked PNG export/PENDING approval. Its source PASS calculations depend on retained historical logs, not current app results. No execution or new defect finding.

## Batch151
Index correctly labels synthetic proposed frontend, prior four reference images distinct from approval. Organize-review reads78 snapshots, safely escapes generated metadata, validates relative output/link containment and preserves unknown files; --check compares hashes without writes. Generator can overwrite generated checklist deliberately, warns personal annotations must be separate. No product API/DB calls. Historical review package requires no current generation, not run.

## Batch152
78-entry historical page registry explicitly distinguishes target/design/conditional/current snapshots; not today's route map. prepare.mjs reveals four external owner-direction originals under Desktop (Изображение Codex14Sept2026 19_23_11/19_23_04/19_22_51/19_22_42.png); actual external inventory must account for them and missing paths explicitly. Fonts copied from old buyer .next; icon markup generated from installed Fluent package. Current icons read fully in150. prepare writes obsolete nonarchive path and must not be executed to regenerate current evidence. Preview is local synthetic script host with labelled dialog/status/skip link.

## Batches153–155
153 renderedaccount full HTML read.154 static validator/localhost4327 server/viewer files fullread.155 all77 template lines read in four ranges. All69 templates use fixed synthetic values and guarded explanations; no API/credentials/remoteeffects. Old templates (payment target, topnav/no sidebar, signing absent) are historical, not currentrequirements. Validator writes78rendered HTML; do not execute original. Can reproduce its pure vm render with stub DOM and compare existing bytes read-only to classify exact generated equivalence. Serve binds loopback and denies traversal via path containment, allowedextensions/CSP restrict resources; not started.

## Batch156
Read-only original-template VM reconstruction compared78 archived renderedHTML byte-for-byte:78equal. account already fullread153, others recorded verified_generated_equivalence (not literal fullread). Original organize-review --check attempt1 FAIL on review/CHECKLIST.md hash; no regeneration. Derived diagnostic retained full comparison loop and recorded99/100 generated outputs identical afterCRLFnormalization; only checklist differs, documentation owner notified. Generator/template sources all fullread149–155. GeneratedHTML/CSS equivalence ledger retains actualSHA and evidence, no browser/visual/runtime acceptance claim. No database/network/service effects.

## Batch157
Archived style.css fullread including tablet/mobile/reducedmotion. Prototype body15/control44radius6, historical responsive table cards, fullpage layouts and iframe viewer are independent historical design, not current sharedtokens. Document preview consciously horizontal-scrolls its530px invoice onmobile. Any currentvisual acceptance remains separatelyrequired; no sourcechanges or unrelatedredesign.

## Batch158
Delivery concept HTML links3raster sheets and explanatoryspec; explicitly not operational, courier separate role and clinicQR authorized conceptual flow. PDF specimen generator only writes localreviewPDF, syntheticparties/noDB. It separates10sent/8received/2resupply, settlement/correction/return/claim/jointact, no invented signatures; legalreferences expressly need review and not independently validated by this code read. No new active applicationfinding.

## Batch159
11historical browser functions fullread. Admin access/trust/order probes click queue/reindex/recovery/sign actions; they carry no own isolatedfixture guard and must not be replayed in arbitrary livepage. Geometry/count observations do not assert complete business semantics. Cart mock fulfills all/api with controlledresponses and404fallback, usefulUIonly. full-demo check injects legacy sessionStorage identity, mountsAI/recommendations and logsPASS before finalerrorcheck; not currentauthorfunctionalproof, not executed. No active applicationfinding from historicalQA.

## Batch160
Admin/supplier mock APIs bind127.0.0.1:4012 and synthesize auth/business responses; no realpermissions/DB. Supplier stub returns200emptyarray forunknownroutes and ignoresmethod, unsuitable acceptance of errors/writecorrectness. Adminstub returns404unknown but still mocks trust/signing/publication. Public route screenshotdriver captures old3080aliases, catches missingheadings/errors and returnsresults without asserting acceptance. None executed, cannot certify current unifiedapp.

## Batches161–163
161 historical supplier HTML audit fully read; initial middle truncation recovered by explicit documents section read. Findings belong to05Oct screenshots, no current regression asserted. 162 supplier route mock blindly200s allwrites/unknownGET; inadequate real business evidence. Historical ownedPG harness asserts cluster identity and exactcleanup; Python timeout checks depend on stdout lines (silent child may hang), no current execution. 163 realPG reservation probe asserts cross-tenant/connection/write-time binding and repeatedoperations, useful prior test source but compiled inputs/currentrun unverified. Stand scripts stage/write checkpoint text with fixed oldCI claims; no execution. Local dev-gate creates predictable preview password when config absent, loopback only; real exposure/config not proven. External Caddy binary fromCRM path requires external inventory. No credentials/config read, no productchanges.

## Batches164–167
Historical cleanup/CI/seed/document probes fullyread. Cleanup fixedfixture validates DB and identity but mutates records; neverrun. Startup runner isolates auditDB/port, oldbuild inputs not certified. Dependency smoke hardcodesoldversions; no currentPASS. Fault injection overrides imported Prisma and changes exitcode only aftercleanupspecific assertions; not currentgate. Native seed attempts hardcode32migrations and public search_path; their PASS explicitly doesnotcertify Prisma deploy. Original attempt2health fetch lacks timeout, attempt3 boundsrequest. New evidence requires currentmigration/profile identity. Documentgraph JWT probe coversprivateembeddedversion andmixedorderownership with realfixture; retainedrecords explicitlynotcleanupall. Git staging and archival scripts can mutate docs/index, notexecuted. Anchor checker lacks duplicateheading suffixes, a future findingsource only after verification. No current applicationdefect inferred solely from oldtools.

## Batches168–172
All old documentation generators fullread: they rewrite30Septstatus/contracts and archive snapshots, not currentauthoritative rules. finalize-index checks semantics only after stripping linkdestinations and CRLF; limited preservation proof, not allcurrentlinks. verify-docs checks old115baseline/hash/ERmodel existence but not relations/cardinality or currentbusiness acceptance. No generatorsrun. FlowB3diagnostic can write compliance rule and startupAPI with shared.local-storage though DBauditname verified; not eligible forblindrerun. Historical SQL adds claim/workflow tables, no currentmigrationcompletenessclaim.

## Batches173–175
173 oldest schema is quotedstring-preserving token-equivalent to087 exceptallchangedhunksread:2addedlinesrestore mandatorycartItem relation, deletion oflater workflow/promotionmodels. Distinct ledgerdepth.174 old auth/catalog edit scripts fullyread; noexecution/currentclaims. diagnose-runtime startsAPI againstworkingDB, prohibited here even though requestitselfGET.175 accountprovision/finalsessioncleanup deliberatelywriteworkingDB and privatecredentialfiles; noexecution/credentialfileread. Publicationreview exactscope/secretchecks boundoldSHA; no reuse ofPASS. escapeprobe uses DOMeventsyntheticdispatch, not actualkeyboard acceptance. run-audit wrapper inherits arbitraryenv and CLIargs, relies onoldfixture; currentruntime mustusecurrentisolatedprofile.

## Batches176–178
Historical runtime-browser explicitly readsprivateJWTkey and synthesizesexpiredJWT, rerouteshostname manually; notrun andnot a permittedreplacement forblockedauthdiagnostic. Workingmigration/launcher scripts likewise notrun. Upgradefixture counts alone donotproveallfieldpreservation. Performance docchecker handlesone documentedMarkdownbreaknormalization; no currenthistoryPASS. GitHubrename mutationandstaging scripts arehistoricalonly; tokensnotread. Supplierterms auditwrapper preflight inheritsenvbefore selectedtargetsetting, so a newrunneeds explicitcurrentidentity; no runtimecertification.

## Structured data and lock review
21 catalogdata files reviewed via complete JSON parse/CSV strict parse plus all-row relaxed diagnostics, withSHA and method root/data-review-2.json; firstreport preserved.5CSV strictfail: amd45/nord50/stomir35 shortrows; media26missingtrailingrights; supplierregistry2widthmismatch. Fallbackbuilder explicitlyrepairShiftedRow164–168, so rawformatmismatch isdatahygiene, not automaticallyruntimecorruption. suppliermapping79nonURL sourcecells needcurrentcallertrace.5formula-likecells allphone +7, no exploitclaim. Archive3329producttotalmatches;1630/1671media aiGenerated+exactProductPhoto+SOURCE_UNVERIFIED mirrorsfrontendcandidate; noimageidentity/rightsassertion. Lock all1066entries:1041resolvedHTTPSnpmregistry,0missingintegrity,0workspacemanifestdependencydiff; novulnerabilityorinstalledbytescertification.22explicitclassificationsreconciled149total, root1105requiredtextallaccountedpendingfinalSHAaudit. No datarewrites.

## Registration correction cross-check
Original register-screen124 keepskey;185–190 correct-emailonly clearsresult/feedback. Onboarding115–125 throws409when samekey email/bin/capabilitydiffers. Newkeyalsohits existingPENDINGemail/BIN conflict150–163. Staticreachable correctionflow defect confirmed; noHTTP/browserreproduction. Frontendworkerownsfinalfinding.

## External sources
Exact external inventory recorded includingMISSINGoldDesktopaudit-tree and4missingoriginalPNG; no substitution with archivedfilesclaimed. JanaPostPDF1.4DEV13pages textfullread,2commercialDOCX tablesfullread, Desktop21Octregistrationpipeline fulltextread (truncatedmiddle recovered51–68). Sourcehashes/extraction metadata in root/external/extraction.json. API listsbatchmailno/clientgetorcreate/ordercreate/label/status/address/nearbranches; noquote/cancel/guaranteedfixedtariff/idempotencycontract inthese13pages. Smallparcel proposal <=20kg/limits andlargefromAlmaty>=21kg separate; volumetricdivisor notspecified and20–21roundingunclear. These are provider-preparation gaps, not newapprovedproductrequirements/currentverifiedtariffs. Noexternalrequests. ProviderPDF includescredentialfield: redacted innewextract andextractor beforepersistence, neveruse; originalunchanged. Visualrendernotperformed, no legal/layout certification. Desktoppipeline explicitlyhistorical5c152d6 andpendingstatuses, sentdocumentationworker. Externaltokensproposal fullread, not authorityforcurrentUIchanges.

## Final-input reconciliation in progress
Source drift2 checked7812baselineowntext/data/lock/assets/config/linktargets:0changes/missing. Firstattempt treated13directorylinks asfiles; correctedtooriginallinktargethash, reportretained. Filenamewalk190492nonaudit files vs190001baseline:518added27removed allbuildcache; noownsource additions/removals. Sensitive448metadata allpresent0tracked/ACLreaderrors/allinherited; localowner/admin/system andconfiguredsandbox/unresolvedSIDgrants recorded. No secretvaluesread orpermissionchanged; groupauthorization andLinux/deployedACLnotcertified. Fullsourcecoverage stillawaitsdocumentation/nativecompletion; thesechecksdoNOTacceptwholeproduct.
