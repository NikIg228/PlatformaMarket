# Audit execution ledger (in progress)

Baseline af714969 + baseline WIP; source hashes in file/review manifests.
No broad suite PASS assumed for current tree. All commands run from canonical root.

| Gate | Inputs/environment | Command | Attempt | Result | Evidence |
|---|---|---|---|---|---|
| Serverless readiness/concurrent initialization | Original api/index.js executed in VM; bootstrap/instrumentation stubs, no network/DB | `node --test .tmp/full-audit-20261104/serverless-diagnostic.test.mjs` | 1 | 2FAIL/1PASS (intentionally preserves failing expected behavior) | `.tmp/full-audit-20261104/serverless-diagnostic-1.log` |
| Stand password boundary | Original gate/page; Node24.18, ephemeral loopback servers and OS temp fixtures; no working services/DB | `node --test deploy/stand-access/gate.test.mjs` | 1 | 11PASS,4.96s | `.tmp/full-audit-20261104/stand-gate-1.log` |
| New Deep Security Scan | Current canonical target, read-only requested | plugin start_codex_security_deep_scan | 1 | BLOCKED before scan start: managed filesystem permission profile required | coverage-gaps.md |

## Inventory execution

First serial inventory stopped by root after25,000files to replace serial hashing
with bounded16-file concurrency and streaming large binaries. Only own inventory
process7968 stopped. No application/test runtime stopped. Second enumeration found
190,001files before hashing; final counters/classification still pending. Enumeration
is not a full read or review claim. Audit output dirs excluded and tracked separately.

## Existing evidence

Prior audit/repair logs remain untouched. Existing limits/rejections retained,
including MFA dynamic rejection and load/restore CREATEDB prerequisite. A new task
does not reset an exhausted gate. No new attempt on those blocked paths made.
Security scan old4543fd22 remains discovery;0 findings is not a result.

## Runtime environment

No docker/caddy/PostgreSQL clients/redis/java/adb/flutter/xcodebuild resolved by
Get-Command in current PATH. This is not proof no local binary exists: inventory
and explicit configuration references still being checked. No installations made.
Existing canonical dev remained running throughout this audit phase.

## Local runtime/config test batch

Attempt1: `node --test scripts/local-runtime.test.mjs scripts/local-development-profile.test.mjs scripts/frontend-deployment-profile.test.mjs scripts/unified-frontend.test.mjs`.
15 PASS, 0 FAIL, 46.66s. Node24.18, current source and existing schema package output;
ephemeral local mock HTTP servers; no database access, production provider calls,
build or working dev stop. Log `.tmp/full-audit-20261104/local-runtime-1.log`.
Proves host/origin checks, occupied-port preservation and profile config propagation;
does not prove production infrastructure or all browser scenarios.

## Bilateral agreement repeated expiry

Command: `npm run db:test -- exec -- node .tmp/full-audit-20261104/bilateral-expiry-probe.mjs`.
Attempt1: harness FAIL before domain behavior (fixture omitted required displayName/
bin). Transaction aborted; log bilateral-expiry-1.log retained. Corrected only
audit fixture after reading required schema fields.
Attempt2: diagnostic completed, product expected behavior FAIL / CONFIRMED_DEFECT
B-CAND012. Same supplier/buyer, first manual agreement expires successfully;
second manual agreement expiry from current() throws Prisma P2002. Real disposable
dentmarket_audit_20260914 identity checked, one transaction, all fixture rows rolled
back, organization count0 verified. Original service TS transpiled in memory with
TypeScript, real Nest/Prisma, only DI metadata omitted; no documents/external calls.
SourceSHA f02d774f31225dde50d46fd4d1142c42efcf7741bd15ae101e9cf5afb7ca49d4.
Evidence `.tmp/full-audit-20261104/bilateral-expiry-2.log` and diagnostic source.
This confirms service/schema failure, not a browser trace or live production incident.

## Quantity contract probe — attempt1
Command: node .tmp/full-audit-20261104/quantity-probe.mjs. PASS diagnostic assertions / defect REPRODUCED FE-QUANTITY-001. Exact AST-selected original frontend/backend pure functions executed, source SHA/ranges bound in root/quantity-probe-1.json. min3step2 UI initial4 true/APIfalse; no common integer1..100. Control1/1 all100accepted. No HTTP, browser, DB or working-data changes. Live affected offer availability unverified.

## Restricted-offer comparison — attempt1
Command: node .tmp/full-audit-20261104/backend/compare-audience-probe.cjs.
Original-source pure diagnostic: public context expected0 actual1 FAIL;
authorized buyer expected1 actual1 PASS. B-CAND043 reproduced with DI fixtures,
no DB/network/server/auth changes. Original SearchService/price resolver hashes
and executed ranges in backend/compare-audience-probe-1.json. Restricted offer
price and warehouse stock returned; public HTTP delegation statically traced,
not live tested. Failure intentionally retained, no product fix or rerun.

Archived preview equivalence: template VM diagnostic1 78/78 exactbytes; packaging original --check1 FAIL CHECKLIST.md changedhash. Derived comparison1 99/100 equivalent afterCRLF normalization, same checklist mismatch retained. These are audit coverage/provenance checks only, no app acceptance. Evidence root/preview-equivalence.json and root/review-package-equivalence.json.

## Workspace automated tests — attempt1 planned
Current af714969+baseline foreignWIP, unchangedlock and inventoriedsource; npm test = turbo test concurrency2, depends only schemas build and transit (not API Prisma generate orNextbuild). Existing node_modules retained. Comprehensiveaudit explicitlyauthorizes broadtestscope.45minbudget, boundedlog; no workingDBorprovider invocation intended. Resultpending.

Workspace test attempt1 completedPASS: exit0,12/12Turbo tasks0cache,2065 testsPASS7skipped (API1151PASS7skipped).4m57.853s. Warnings only absent configuredcoverage outputs. Log workspace-test-1.log; nofullapplication/runtimecertification.
Backend pure original-source probes attempt1: B016/B017/B027/B039 eachreproduced,6expectedFAIL6positivecontrolsPASS, no harnesserror. SHA verified, memoryDIstubs only, no DB/network/server; backend/*probe-1.json and focused-probes-verification.json. ExistingworkspacePASS doesnotcovertheseregressions.
Typecheck attempt1 planned: npm run typecheck withunchangedinputs/currentgeneratedtypes, schemasbuilddependencyonly, noNextbuild/typegen;20minbudget. Log typecheck-1.log.

Typecheck attempt1 PASS: exit0,13/13 tasks (1cached),3m0.692s; existing generated types, no browser/build acceptance. Lint attempt1 planned: npm run lint, current source, read-only eslint/UI contract checks,20min budget, lint-1.log.

Lint attempt1 PASS exit0: eslint maxwarnings0 and UI policy5PASS,474files/10061declarations/7985elements. Script tests attempt1 planned: remaining15 node-test files, excludes already passed runtime4/UIpolicy; ephemeral OS files/mockloopback only,20minbudget, scripts-tests-1.log.

Remaining script tests attempt1 PASS:69/69,0skip,8.129946s, exit0. Includes real local TLS negative/positive control with temporary certificate; no PostgreSQL connection or container runtime. Recovery original-source probes attempt1: B036/B040/B0324FAIL6controlsPASS, no harness errors; backend reports retain in-memory/real-provider limitations. Build/API/browser prerequisites currently await owner response to temporary dev stop+restore question; no processes stopped.

B036 PostgreSQL diagnostic attempt1 planned: root reviewed prepared harness F8743887..., original service SHA pin, two guarded clients to approved disposable database, synthetic fixture only, serializable original transaction, second committed update before its start, exact cleanup nine counts.2minbudget, inventory-stale-reserved-postgres-1.log. Does not require API build/dev stop or test working data.

B036 PG attempt1 harness FAIL before fixture writes: inet_server_addr()::text yielded127.0.0.1/32, strict guard expected127.0.0.1; cleanupNOT_REQUIRED. Attempt2 changes only address formatting to PostgreSQL host(inet_server_addr()), retains exact loopback/DB/schema checks. Product unchanged, same2minbudget.

Prisma validate attempt1 FAIL P1012 missing DATABASE_URL (CLI configuration, no connection/write). Attempt2 supplies canonical isolated environment through npm run db:test -- exec --workspace=@marketplace/api -- prisma validate; unchanged schema, no generation or migration,2minbudget.

B036 PG attempt2 CONFIRMED_DEFECT: real original Serializable transaction overwrote independently committed reserved5 with stale2; no-interleave controlPASS. Exit1 intentionally retains failing expectation. Exact synthetic cleanupPASS all9tables zero. Scope aggregate lost update, no fullcheckout/oversell claim. backend/inventory-stale-reserved-postgres-2.json and log retained. No repeat needed.

Prisma validate2PASS canonicaldb:test environment, no DB connect/generation/migration. Pure environment dist module verified EXACT emittedJS equal to currentTS (CRLF/sourceMapURL only ignored), compiler6.0.3; schema package current npmtest build. Production-config attempt1 now permitted on proven module without rebuilding/stoppingdev; synthetic config validation only/no providercalls,2minbudget.

Production-config1PASS exit0 synthetic valid/invalid configuration and guards; pureenvironment artifact equivalence recorded. No real provider/TLS/cloud acceptance. API artifactequivalence1 currentlyfullprogram compileinmemory, nofilesystememit, to verify reuse withoutstoppingdev;20minbudget, api-artifact-equivalence-1.log.

API artifactequivalence1PASS545source/545JS,0missing/mismatch/diagnostics; Prisma schema tokens equivalent preserving strings. No diskemit/build/regen/devstop. Current hashes pinned by PGlauncher. Original PostgreSQL suite1planned with helper-isolatedenvironment (providers excluded), verifiedtestDB and vacantownedport4419;45minbudget. Underlying official script used after proving artifacts, canonicalnpm build not claimed.

Original fullPostgreSQL1PASS exit0 withcleanup, isolatedtestDB/owned4419 API; migration/upgrades, tenancy/permissions, money/stock/concurrency/idempotency/rollback/manualpayments/promotions/documents/resupply/VAT etc in postgres-1.log. Runtime-split1PASS roles3+entrypointguards2+productionall denial; artifactproof reused. Remaining distinct official profiles wave1-security-only and discrepancy-only absent fromfullbranch; runsequentially1each withsameisolation,45minbudget; common runnerpreflight repeats bydesign. UIadminprobes1running freshbrowser/mockALLAPI/blockotherrequests; no realDB/authacceptance.

UIadmin1partial: FE-FORM002 reproduced afterone mock201POST; screenshot visuallyinspected errorCannotreadpropertiesofnull(reset). Quantitystageharnessfailed strictselector matched2inputs; no productresultthere. Attempt2 ONLYquantity stage, exactaccessiblelabel selector plusoriginalpriceinput positivecontrol; firstcompletedform notrerun. Freshcontext strictAPI mocks retained,5minbudget.

Wave1 profile1 BLOCKED/FAIL beforedomaincases:42501 data_directory; source alsoREQUIRES separatelyowneddisposablecluster onnon5432+WAVE1_OWNED_CLUSTER_DATA_DIR. Root selectedincompatibleexistingtestDB profile; noauth bypass/permissiongrant/newcluster. Commonfixtures cleanupcompletedwithoutfailurelog, port4419released. Not aproductfailure/no retryunchanged. FE-NUMBER UIattempt2 REPRODUCED:20/min0.000001/defaultstep1 stepMismatch; originalprice20/min0controlPASS. Browserclosed, noAPIrequest escapedmocks.

WorkflowUI recoveryprobe1planned: canonicaldev source/freshcontext strictALLAPI mocks; positive acknowledgedACCEPT→CANCEL then syntheticcommittedACCEPT responseabort→poll→nextCANCEL.5minbudget; noDB/authacceptance, ui-workflow-recovery-1.log. Native/productionbuild independentgapsremain.

DiscrepancyPostgreSQL1PASS exit0 includingupgrade/tenancy/role/scannedvisibility/replay/race/outboxrollback/immutablestatement andunchangedmoney/stock/receipt. WorkflowUI recovery1REPRODUCED: acknowledgedcontrol ACCEPT→CANCEL2POST PASS; lostresponsecase GETobservedCONFIRMED,acceptbuttonremoved,nextCANCEL locallyblocked withunknownpreviouserror,only1POST. Screenshotlost visuallyreviewed. AllAPImocked; unrelatedshellwidgetsdeliberately503,notproductfindings. Contextsclosed/noactivebrowser. Evidence root/ui-workflow-recovery/result-1.json/control.png/lost.png.

CSPsigning1planned: original proxy function emittedinmemory, NextResponse headerstub, productionenv; actualChromium isolatedpage enforcesCSP. Sameoriginfetch control; allWebSockets intercepted/noNCALayercontact.2minbudget. csp-signing-1.log.

CSPsigning1 harnessFAIL timeout: Playwright routeWebSocket replacesnativeWebSocket andbypassesCSP, intercepted1 preventednetwork. No productresult. Attempt2 removesinterception, waitspositivefetch then contextOFFLINE beforeoriginalWebSocket; nativeCSPevent required, no contactwithinstalled13579service.

CSP signing attempt2 REPRODUCED: native Chromium securitypolicyviolation connect-src enforce for wss127.0.0.1:13579, same-origin fetch control PASS. Offline enabled before socket; no contact or signing. Original proxy CSP, isolated synthetic page; not production deployment evidence. Both contexts/server closed. B029 original-source memory race1 FAIL leaves zero identities,5controls PASS; recovery by verified-email provider exchange remains possible.

Core contract1 planned: original verify-pilot-backend --contract-only via SHA-pinned artifact/testDB guard helper --core-contract. Existing isolated seed fixtures from successful PG suite, owned port4419, provider-free pilot env. No API build/regen/devstop. 5min budget, core-contract-1.log.

Core contract1 PASS exit0:71 explicit operations,209 operations with success schema,301 components; response/error validation PASS, isolated catalog50products/500offers. Original runner and proven emitted artifacts used; canonical npm build not run. Owned API stopped by finally.

Admin session race UI1 planned: actual current settings, every API mocked; hold revokeA, store syntheticnewB, releaseA; currentA control. Inert loginredirect. No realauth/revoke/DB.5minbudget, ui-session-race-1.log.

Admin session race UI1 completed but fixture receipt used sessionId instead of schema id. Both control removal and race removal observed; malformed receipt wrongly accepted is separate signal, not valid-receipt race evidence. Attempt2 fixes audit fixture to id and parses shared identitySessionRevokedSchema before fulfill; reruns both changed-input cases.

Admin session race UI2 REPRODUCED with shared-schema-valid receipt: currentA control clearsA PASS; pendingA then storedB ends storednull and loginredirect FAIL. Two synthetic contexts closed. No actual auth/working session. Evidence root/ui-session-race/result-2.json; malformed attempt1 retained.

Discrepancy UI1 planned: current reachable order shipment dialog, allAPI mocked and shipment schema parsed; invaliddamaged-1/actual01 feedback, valid1/0 command-schema control deliberately409. NoDB/authwrite.5minbudget, ui-discrepancy-validation-1.log.

Discrepancy UI1 REPRODUCED both invalidcases: damaged-1 and actual01 cause0POST, no changed formtext/aria-invalid/alerts, native validitytrue. Valid1/0 control emits1 schema-validCREATE and shows deliberate409. Screenshot visually inspected; unrelated mocked shell errors excluded. Allcontextsclosed. root/ui-discrepancy-validation/result-1.json.

B043 HTTP/PG1 planned: reviewed full harness and syntax PASS, root adds JSON report serialization only. Original545artifact/sourceSHA guards; exact isolatedDB identity, synthetic pilotpublication snapshot withSQLnullflags, own4419API/jwt/noauthheaders/noqanalytics, restrictive and allowed controls. Restoreexactrow+stopAPI finally.90sinternalbudget/2minouter. compare-audience-http-1.log.

B043 HTTP1 harnessFAIL beforemutation: search cards use id, harness filtered offerId. APIstopped, NO_MUTATION verified. Source search.service909 confirmsid; attempt2 fixesonlysearchselector and parsesbothresponses withsharedschemas. Same90sbudget/identityguards, no productchanges.

B043 HTTP/PG2 CONFIRMED_DEFECT: excluded public buyer compare returns target price/stock1 instead0 FAIL; same publicsearch hides0 PASS; includedbuyer compare1/search1 PASS. JWTserver, noAuthorization/contextheaders. Exact full publication snapshot restored inclSQLNULL/timestamps, ownedAPIstopped. Original current545artifactproof, isolatedDBonly. backend/compare-audience-http-probe-2.json.

Production dependency audit1 planned: npm audit --omit=dev --json, distinct production graph scope. Existing all-dependency artifact lacks exact command provenance and is not reused as current scoped evidence. Read-only registry audit, no install/fix/lock changes;2minbudget; npm-audit-production-1.json.

Production dependency audit1 exit1:10moderate dependency records,0high/critical, one distinct minimatch advisory GHSA-g3hv-75wg-m249 (<11.0.1). Includes transitive archiver/exceljs/google transport chains; not10 independent vulnerabilities and not proof of exploitable request path. No dependency changes.

Legacy minimatch production probe1 PASS boundeddiagnostic: versions3.1.5/5.1.9 lack documented two-phaseoptimization methods/options;8segments->1globParts each,normalpositive/negativecontrolsPASS. Current primary GHSA read; no broad safety/reachabilityclaim, npmaudit remains1. root/dependency-audit.json recordscommand/lock/reportSHA.

Draft UI1 planned: original /admin catalog ProductCorrectionQueue, two synthetic rows, editB then approveA mock201/reload; allAPI intercepted, no workingDB/auth writes. Control retains editedB beforedecision and validatesA payload.5minbudget, ui-draft-recovery-1.log.

Draft UI1 REPRODUCED FE-DRAFT-001: beforedecision B editedvalue confirmed; mockapproveA exactacceptedValue controlPASS; reload removesA and silently resetsB to SuggestedProductB while its comment remains.2controlsPASS1expectedFAIL, screenshot inspected, allAPI mocked/contextclosed. ui-draft-recovery/result-1.json; no actual moderation or DBwrite.

Compliance seededrules1 planned: new applicability evidence using actual3 migrationrule conditions/disclosures and originalpure evaluator, validlot syntheticfacts; each missingalternatives/presentcredential/missingcertificate controls. NoDB/network/legalclaim.2minbudget.

Compliance seededrules1 harnessFAIL syntax reservedCommonJS exports redeclaration beforeexecution. Attempt2 renames fixture moduleExports only; sameinputs/no productchanges.

Compliance seededrules2 REPRODUCED3missing-anyof FAIL/6controlsPASS with actual migratedlowrisk/implantable/equipment conditions+disclosure; validlotfacts. Underlying diagnostic sets exit1 (outer logread command exit0 not gatePASS). Actualdeployedrule/applicability notqueried, noHTTP/DB/legalassessment. root/compliance-seeded-rules-2.json.

Source drift1:7799hashes unchanged,13directorylinks produced EISDIR (harness misread link asfile). Attempt2 uses baselinehash_status link_target and hashes readlinktext per original inventory; no missing sourceclaim.12historicalmetadata classifications merged:4371requirescoverage163exclusions with preserved originalcategory provenance.

Source drift2PASS7812files/linktargets unchanged0missing0unhashed vsbaseline, mainaf714969. Includes owntext/data/lock/assets/config/schema; excludes mutablecache/sensitivevalues/newfileaddition scope. Initial13EISDIR linkharnessfail retained. integration-config pureprobes1 8expectedFAIL10controlsPASS/noharnesserror: B033unchangedpricefreshness, B035unsafeinteger2adapters, B044accessToken/arraysecretshapes; noDB/network, exactlimits backend/conclusion.md.

Inventory additions1PASS: baseline190001/current190492 nonauditfiles;518added/27removed allbuild_cache,0owntextadditions/removals,0walkerrors. Ownauditdirs excluded explicitly. Sensitive metadata1PASS448exist/0tracked/0ACLerrors, allinherited; onlyfilemetadata/ACL, no contents/valuehashes/permissionchanges. UnresolvedSID and sandboxgroup authorization not inferred; localWindows ACL not productionruntimecertification.

## Additional terminal-state diagnostics — blocked before execution

Existing backend worker was asked to confirm B037 and B046/028 with bounded original-source DI probes, no DB/network/product changes. Turn failed with: “This content was flagged for possible cybersecurity risk.” No result/attempted product behavior is claimed; no alternative execution or rephrased retry. These candidates remain source-only. Root did not run the proposed probes.

## Final source identity after exhaustive reading

`node .tmp/full-audit-20261104/verify-source-drift.mjs source-drift-3.json`: PASS,7812/7812 hashes,0drift/missing/unhashed; main af714969 unchanged. Final mandated source-boundary check after documentation/native completion, preserving attempt1 link-hash harness failure and attempt2 result; no application suite rerun. Session75377 completed exit0. Covers baseline source/data/resources/configuration/links, not mutable dependency/build caches or newly added filenames (separate inventory-additions-1).

## Report completion checks

`node .tmp/full-audit-20261104/report-final-hygiene.mjs`: PASS13 report documents,35 local links,9 JSON syntax checks,0missing/whitespace/invalid. `git diff --check`: PASS (existing CRLF conversion warnings only). These are report integrity/hygiene checks; no application suite rerun. Main/foreign dirty files preserved. Documentation source verification and1347 active-document local links are recorded in documentation/conclusion.md.
