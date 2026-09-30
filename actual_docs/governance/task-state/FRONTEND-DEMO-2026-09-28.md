# FRONTEND-DEMO — 28.09.2026
Owner: primary01a0c957-1f23-7b70-9dc9-226afbb5c0b1, generation3/idle.
Scope: document accepted business rules, defer implementation, start all local apps.
Next frontend changes await specific user observations. No overnight backlog resumed.
Canonical checkout unchanged, main26edf45afcba07a9c67cfa951c3f322853d8ec40.
Docs Product23.6 + questions history committed/pushed; exact remote verified.
Docs consistency and scoped git diff --check PASS. Technical Writer practices applied.
Unfinished CORE02/03 and older unrelated WIP preserved, not staged or certified.
Previous typecheck3/3 block remains; dev startup is not an acceptance rerun.

Dev attempt1 stopped before startup: audit helper AUTH_MODE=development rejected
by ordinary local launcher. Attempt2 set AUTH_MODE=jwt; npm run dev:pilot PASS,
API watch compiled0errors, all4web+gateway/readiness passed. No auth bypass.
Existing disposable dentmarket_audit_20260914 DB used with compatible migration;
no workingDB migration/reseed, no source-code modification this task.
Launcher PID14008, exec session11329; API17200 port4012, admin14740 port3000,
buyer18580 port3001, supplier18564 port3002, landing18572 port3003,
gateway15920 port3080. Processes intentionally left running for demonstration.
Log outputs/internal-pilot-20260928/frontend-demo-dev-2.log (local only).
Restart: same canonical cwd, source outputs/internal-pilot-20260928/pilot-env.ps1,
set AUTH_MODE=jwt, npm run dev:pilot; first verify ports/process ownership.
Full TS/unit/DB/browser suites NOT_RUN for docs/startup; no product acceptance claim.
CI checked separately through saved ci-readback receipt; pending is not PASS.
Local folder rename and payment/promo/commission/external notifications implementation
explicitly deferred by owner. Next step: specific frontend defect from owner.

## Catalogue + header removal (current scope)
Owner request28.09: fix empty catalogue, remove public header and all its components;
replacement design is a separate next step. Authenticated workspace AppShell unchanged.
Root cause confirmed from request log/read-only API: saved dentmarket:city ID absent
from current city directory yielded0; unfiltered and current Almaty ID yield50.
Removed implicit localStorage city injection; explicit cityId remains supported.
Removed PublicHeader, CityLocation, their CSS/tests, unused popup hooks, category
rail and header-only search history. Public catalogue/about/suppliers/product use
no old header. Search via URL, filters, sorting and product actions remain.
Updated browser tests to URL-driven public queries while header search is absent;
kept authenticated search and supplier popup coverage.
Own scope: listed buyer public files, live-search regression, three E2E files
(catalog-polish, dropdown-dismissal, flow-b3-publication), this checkpoint.
No unrelated overnight WIP staged. No working data edits.
Practices: Frontend Developer (states/accessibility), Code Reviewer (scope and
regression), Git Workflow Master (selective staging); UI standard applies.
Validation budget: build20min, suite45min; max3 per blocker.
New frontend inputs26edf45 + own diff + preserved existing WIP:
- buyer unit initial79/79 PASS; orphan hook suite subsequently removed with hook.
- npm run typecheck12/12 PASS (38.5s), new frontend baseline; does not accept
  deferred order workflow or erase its historical3/3 failure record.
- npm test11/11 tasks PASS (33s), final buyer72 tests.
- git diff --check PASS.
- CUA guest catalogue50 products, old header absent, product details load PASS.
- production buyer build attempt1 running; dev launcher14008 stopped with owned
  process tree to avoid Next dev/build collision; restart after checks required.
Next: build result, browser gate and restart demo; selective review/publication.

Gate update: buyer production build + bundle budget PASS (attempt1).
E2E typecheck PASS after public query test changes.
verify:web attempt1:39pass/38skip/7fail,5.4min. Five failures referenced removed
header controls; tests updated to remaining filter focus, direct supplier return,
and product compare/add action for login. Targeted retry of those5 now running.
Two other blockers preserved, not fixed in header scope: flow-b2 internal transfer
waits for supplier invoice upload (30s); organization-ready multi-workspace selector
has0options instead of2. No blanket retry/no weakening of those assertions.
Therefore full browser acceptance is not PASS and publication remains blocked.
CUA responsive follow-up hit cached connection-refused data URL during server
transition (2attempts); no policy bypass. Viewport override reset successfully.
Automated header regression already PASS at1280/390; CUA desktop catalogue/product
was PASS before server transition. No claim of completed manual mobile review.
Additional own E2E paths: marketplace, organization-ready, product-login-return.
Final scoped retry:5/5 PASS47.8s (marketplace keyboard/mobile, supplier session
return1280/390, product registration/login return1280/390). E2E typecheck PASS.
Combined full-suite result remains BLOCKED by the two unrelated failures above;
no commit/push/CI for this change. Existing HEAD26edf45/main unchanged.
No unrelated implementation edits; all current code remains local for demo.
Dev restart: session1259, npm run dev:pilot with AUTH_MODE=jwt from canonical root;
log outputs/internal-pilot-20260928/header-dev.log. Old test webservers cleaned up.
Next acceptance step: separately resolve the recorded order-workflow runtime and
multi-workspace login test blockers; do not resume payments without owner scope.
New header awaits user's design instructions. No other pilot backlog resumed.
Dev readiness confirmed: admin3000/buyer3001/supplier3002/landing3003 HTTP200;
buyer catalog-search total50/items24. Launcher20684/session1259 left running.
Final status: local implementation verified in scope, publication BLOCKED by full
browser gate (two unaddressed failures,1attempt each). No commit created.

## Product photo fix (28.09, subsequent owner request)
Same primary owner/root/main26edf45. Scope only missing product detail photo.
Cause: detail used static sourceUrl obtained by product ID; live UUID differs from
snapshot public ID. Public catalogue already enriches media by exact normalized
name+brand+manufacturer. Exported/reused that same resolver for product details;
no fuzzy matching, DB writes, pricing or API-contract changes.
Files: catalog-fallback.server.ts/.test.ts, products/[id]/page.tsx; marketplace
browser regression asserts same image source as listing and successful decode.
Typecheck12/12 PASS; npm test11/11 tasks PASS including new exact-identity and
negative near-name/manufacturer regression. CUA screenshot confirms real GC EQUIA
Forte HT photograph; initial API restart transient resolved on reload.
Buyer production build running, prior dev20684 stopped to avoid .next collision.
Previous full-browser two blockers remain; no commit/push until accepted.
Photo gates: buyer build/bundle PASS; targeted marketplace product transition
E2E1/1 PASS15.7s with src equality and naturalWidth>0; E2E typecheck PASS;
git diff --check PASS. No full suite retry of unrelated existing blockers.
Dev restarting with jwt, log photo-dev.log. Same Frontend Developer/review practices.
Changes remain local/uncommitted on main due prior acceptance blockers.
Photo dev readiness: all four apps HTTP200, launcher reports ready/JWT; session15889 intentionally running.

## New marketplace header — authorized implementation
Owner approved side-chat brief: logo, cancellable suggestions, validated city context
with explicit availability filter, verified organization/account and switching.
Scope catalogue/product surfaces; no payment implementation or external integration.
Read UI standard and UI Designer practices; lightweight600x200 WebP6.1KB from
owner Desktop Platforma_Market_Logo_4K.png (unchanged proportions).
Implementing independent components under features/marketplace-header. URL carries
deliveryCityId/inCity; absent/invalid city never silently injects catalogue filter.
City defaults to clinic profile, explicit preference is organization-scoped;
legacy guest city validated against live cities. Product comparison uses validated
city context; exact quantities/address still confirmed in checkout.
Current source change: header components + layout provider, catalogue/product wiring,
URL allowlist and forthcoming regressions/docs. All prior WIP preserved.
Typecheck attempt1 PASS12/12 before final context wiring. Gates planned: final
TS/unit, buyer build, targeted header browser guest/clinic/supplier/mobile/races;
full verify:web only if newly relevant blockers have a reason to rerun. Previous
unrelated payment and workspace-selection blockers remain unaccepted.
Budget defaults build20min/suite45min; max3 attempts per blocker, no new agents.

Header progress: approved refinements applied: desktop search half-width, no city
trigger arrow, Fluent city dropdown (loaded on demand), no pointer hover/focus
outline on search; Tab retains focus indication. E2E first run5/11 PASS: four
failures were stale-city text selectors (notice adds text), clinic name locator
selected hidden menu text; assertions corrected. Actual multi-org defect: old
buyer cookie restored clinic after explicit switch to supplier; specific previous
buyer session now revoked using existing endpoint before navigation (not global
logout). Supplier1280/390 and search-race/error/keyboard scenario passed.
Build2 compiled, bundle gate failed25 initial JS files vs24. No budget weakening:
city picker lazily loaded when opened. Build3 pending. Unit2 PASS11/11, TS3 PASS12/12
before lazy picker. Full gate remains blocked by prior unrelated payment failure.
Header browser run2: authenticated clinic, supplier1280/390, multi-org switch,
revoked membership, product photo, login return and suggestions PASS. Guest city
filter exposed missing bootstrap dependency: search ran before async validated
city and never reloaded. Fixed bootstrap waits for delivery.ready and depends on
cityFilter. Third targeted guest run planned; no relaxation of assertion. Explicit
empty clinic preference no longer replaced by profile default. CUA tab remained
cached network-error data URL after server transition;2 failures, stopped retries;
repository browser screenshots remain available for visual review.
Correction to run2 checkpoint: login-return tests finished later and failed2/2;
final result18/22 PASS. Profile-derived delivery context added to product URL and
incorrectly reset restored pagination. Automatic context now preserves count;
regression still checks original filters/count exactly, separately checks real
profile city, waits for completed context navigation before opening comparison.
Run3: guest390, suggestions and existing clinic PASS. Desktop return failed only
because query parameter order changed (same names/values); corrected assertion
compares exact sorted parameter entries and waits for visible results. No fourth
browser run:3-attempt gate limit. New-registration return waits for profile city:
provider had mounted before mandatory profile completion, so it never re-read
newly saved address. DeliveryProvider moved inside OrganizationGate so it mounts
only after complete profile. This final fix needs browser acceptance; do not claim
PASS/commit/push. Existing-role switching was proven in run2. Targeted next step:
authorized browser retry of guest desktop and new-registration return. All current
visual requests implemented; demo servers will be restarted after checks.
Final receipt: canonical main@26edf45 unchanged; all source local, prior WIP preserved.
Final npm run typecheck12/12 PASS; npm test11/11 PASS; buyer build+bundle PASS;
landing build PASS (auth-client unchanged since build1); git diff --check PASS.
Evidence outputs/internal-pilot-20260928/new-header-*-receipt.log and source hashes.
Browser final run3:3/6 PASS (guest390, suggestions, existing clinic); desktop URL
ordering assertion and two new-profile return checks failed; final fixes not rerun
per3-attempt limit. Separate run2 proven: multi-org, supplier1280/390, photo/card,
revoked membership and auth isolation. No full-suite or publication PASS. No
commit/push/CI; do not repeat unrelated deferred order-workflow gate. No new agents.
Visual latest refinements: search half-width desktop, full mobile row; city arrow
removed; native select replaced by styled lazy Fluent Dropdown; mouse focus/hover
removed with Tab focus retained. Reviewed desktop/mobile screenshots from E2E.
Frontend Developer/UI Designer/Code Reviewer practices applied; no second UI stack,
no dependencies/working-data changes. Requirement captured in Product §24.
Dev restart new-header-dev.log using canonical dev:pilot with JWT, all apps.
Next scoped acceptance: authorize an additional browser run for preserved URL
parameters and city initialization immediately after new organization profile.
Dev receipt: API ready; admin3000, buyer3001, supplier3002, landing3003 all HTTP200. Session90163 left running from canonical root. Current branch main, HEAD26edf45; no commit/push.
Owner continuation after disclosed browser limit authorizes one focused additional acceptance run, cumulative run4: guest desktop and registration return1280/390 after recorded fixes. Same main26edf45/primary; no source changes or retry reset. Reuse owned dev:pilot JWT on isolated audit DB; normal auth paths, no payment backlog. Previous static/unit/build evidence retained.
Continuation run4: guest desktop PASS10.1s; new-profile return1280/390 reached
correct product/city/count, failed solely exact href string order. Corrected
registration regression to compare origin/path and complete sorted parameter
entries. No product change or weakened value/count assertion. Cumulative focused
run5 (second run in owner-authorized continuation) checks only those2 scenarios.
E2E typecheck PASS; diff-check PASS. Existing product build/unit evidence retained:
implementation untouched this continuation. Full gate still has unrelated deferred
invoice-upload blocker; do not resume payment work or publish on failed gate.
Continuation complete for header acceptance: cumulative run5 registration return
2/2 PASS50.7s at1280/390 (email verification in new tab, required clinic profile,
profile city, product comparison, return filters/count, wrong-password recovery,
correct login, reload, no accidental cart/order writes). Run4 guest desktop PASS.
All previously outstanding header-specific scenarios are now proven; no product
code change this continuation, only canonical-URL comparison in regression.
Dev apps left running. main@26edf45 unchanged; no commit/push because required
whole-project web gate still blocked by deferred order invoice-upload scenario
from previous scope. CI NOT_RUN. Do not label whole pilot accepted.
