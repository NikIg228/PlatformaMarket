# CATALOG-PROMOTIONS-MESSAGES — LOCAL_PASS / PUBLISHED / CI_PENDING

## Owner-reported keyboard regression — LOCAL_PASS / publication pending

Owner reports invisible keyboard input in the supplier-question modal and three
Next errors. Same authorized UI writer; primary native snapshot idle, canonical
main1774efc, only known receipt/reference dirt preserved. Plan: reproduce ordinary
keystrokes (earlier tests used fill), inspect React console, minimally repair
component identity/state; check modal desktop/mobile and shared Messages, retained
draft/focus, console errors, affected types/lint and one completion web build.
No backend/data/design-contract changes. Stop at repaired input and verified publish.

Diagnosis: inspected all three Next overlay entries in the owner's existing Chrome
product tab; all report duplicate sibling React keys at SupplierQuestion's composer.
Context and composer both used offerId; shared Messages history/composer both used
draftId. Namespaced keys by component, retaining intentional remount per offer/chat.
Before-fix regression FAIL1 on captured React console errors (keyboard text happened
to survive in the isolated fixture). After-fix targeted browser PASS8: keyboard focus/
value/close-reopen and zero console/page errors, Messages and question1440/834/390,
files/retry/role denial. Native same product tab: Cyrillic text visibly entered,
send became enabled, no Next issues; synthetic draft cleared, nothing sent.
UI/buyer-web/web/e2e types PASS; scoped ESLint PASS. Logs
`.tmp/messages-keyboard-{before,fixed,types,lint}.log`; go_live web build PASS
(`npm run build --workspace=@marketplace/web`, `.tmp/messages-keyboard-build.log`).
Verified canonical Next9060 stopped before build; launcher also shut down API.
Canonical `npm run dev` restarted afterward; no foreign app process touched.
Only four key values change in product code; prior backend evidence remains valid.

## Publication receipt14.10

Commit `1774efc1ea6693334f1bde6587e2ef7bf8ce6c0a`
`feat: add supplier questions and conversation attachments` published to origin/main.
Fetch confirmed unchanged upstream c251bc1; staged48-path review, diff hygiene and
single outgoing commit checked. Push succeeded; git ls-remote matched exact HEAD.
[CI38306060948](https://github.com/NikIg228/PlatformaMarket/actions/runs/38306060948)
and [Security38306060933](https://github.com/NikIg228/PlatformaMarket/actions/runs/38306060933)
observed QUEUED, conclusion null. CI_PENDING, not PASS; no CI repair or new stage started.
Local implementation/verification complete, canonical dev remains available.
This post-publication receipt is local metadata; previous product-preview receipt
and three reference-image folders remain preserved and unstaged.

## 13.10 Messages and supplier-question implementation — LOCAL_PASS14.10

Owner explicitly said «приступай» on the remaining Messages/question stages.
Sole writer UI01a11795, primary01a11758 native snapshot idle; stopped side task
remains stopped. Start mainc251bc1, only prior receipts/reference folders dirty.
Use the two approved packages linked below and shared design contracts. No agents,
worktrees, working DB edits, external messages or unsolicited stages.

Plan before implementation: extend the existing conversation contract for PNG/JPG/PDF
attachments (existing infrastructure limit10MB,10 files) and authoritative pre-message
offer/order context. Reuse quarantine/scanning/storage and transactional UploadAsset
metadata claims, separating conversation files from support tickets/documents.
No Prisma schema change needed: attachment ownership/linkage lives in existing
UploadAsset metadata; replay compares the saved message's linked assets. Persist
neither private draft text nor file contents in browser storage; keep per-offer drafts
in the mounted product flow. Existing permissions/participant checks remain server-owned.
Then modal ask flow without navigation/empty conversation, retained drafts/errors/key,
confirmed success toast/link, focus return and deep catalog restoration. Shared Messages
gets two-line rows, context header/menu, independent history scroll/natural bubbles,
pinned shared composer/files and silent30s refresh preserving selection/draft/reading.

Risk: unauthorized file access, cross-context file claim, replay/rollback/races,
wrong recipient, stale reads, lost draft/scroll and shared operator/support regressions.
Focused checks after each backend transition: schemas/files/auth/lookup unit tests;
isolated PostgreSQL attachment claim/replay/denial/concurrency/rollback with fixtures;
affected dependent support/file-policy tests, API types/build/OpenAPI and runtime split.
UI: targeted refresh/list/model and browser clinic/supplier/operator, first question,
file upload/error/retry/download, unknown send retry, close/reopen focus/draft,
1440/834/390 and catalog return. Final affected types/scoped lint/UI contract,
one go_live web build, screenshots/computed styles, scoped commit/push and CI receipt.
No full release/E2E sweep. Attempts for this stage start0; older phase logs retained.
### Messages backend stage1 — LOCAL_PASS13.10

Implemented conversation-files schemas and typed API client, body-policy allowance
only on POST /conversations/attachments, protected upload/download controller and
OpenAPI schemas. ConversationAttachmentsService uses existing private quarantine/
scan/storage,10MB PNG/JPG/PDF,10 references,1h pending expiry. Conditional metadata
claim checks actor/org/offer-or-order context/CLEAN/expiry inside the message transaction;
replays compare exact linked asset IDs; cleanup cannot claim linked assets.
Context lookup now validates accessible offer/order and returns supplier/product/
variant/packaging and signed stored-photo URL without creating an empty conversation.
Conversation detail returns attachment descriptors after participant authorization.
No Prisma change/migration and no working DB write; existing storage metadata is used.

Schema unit1 PASS5; schemas build1 PASS; files unit1 PASS5; combined backend unit1
PASS12; dependents1 PASS30 (support attachments, file policy, request-body limits,
OpenAPI). PostgreSQL1 PASS on approved dentmarket_audit_20260914: real membership/
permissions, buyer/supplier reads, outsider/revoked/operator denial, operator after
escalation, actor/context/expired/wrong-purpose/quarantine denial, start/send replay,
concurrent claims, outbox rollback, sequential messages, read/resolve/reopen and cleanup.
All synthetic records cleaned up. Logs .tmp/messages-{schema,schemas-build,files-unit,
backend-unit,backend-dependents,postgres}-1.log. Initial API typecheck output tracked
in .tmp/messages-api-types-1.log; final affected checks still due after UI implementation.
Changed verification helper constructor in scripts/lib/verify-conversations.mjs because
it manually creates ConversationsService. Full commerce certification not rerun.
### Messages UI implementation and first checks13.10 — ACTIVE

Shared conversation composer/files, two-line list, independent history scroll,
context header/actions, silent refresh, per-conversation drafts and supplier-question
modal implemented. Catalog records only URL/card position in session storage and
restores after the complete requested result window loads; message drafts/files stay
in memory. Shared DmDialog adds an opt-in mobile fullscreen variant; DmTextarea adds
opt-in growth. Support picker defaults retain support formats; conversation policy
restricts PNG/JPG/PDF and supports retained failed-upload queues.

UI types1 and buyer types1 PASS; UI model/page units1 PASS5; client units1 PASS3.
Browser1:4PASS/6FAIL, 3min. Four failures were incomplete clinic profile fixture
(missing organizationId/complete); catalog browser-back restoration passed but explicit
return used obsolete test label. Mobile question had a real sizing/style priority
defect and too narrow inline text field. Fixed fixture, current return label,
shared fullscreen specificity and separate full-width question textarea; browser2 due.
API build1 FAIL at Prisma prebuild: Windows DLL locked by the owned dev API.
Stop the verified canonical dev tree for completion build, then retry once; no schema
or dependency change and no permissions workaround. Logs .tmp/messages-*-1.log.
UI screenshots/checks still incomplete; no commit/publication or completion claim.

### Completion checks in progress14.10

Browser2 PASS10: clinic/supplier1440/834/390, quiet polling/visibility, draft/read
position, explicit new-message jump, paging/filter/retry/stale selection; question
new/existing context, supplier separation, retained files/draft/focus, upload failure,
unknown-send replay, role denial and fullscreen/short viewport; deep catalog browser
Back and explicit return. A small follow-up keeps the latest message visible when
composer height changes and records quick-offer position only on actual navigation.
Affected browser PASS5, including nested question-dialog focus, plus shared support
attachment regression PASS3. Screenshots/computed styles inspected;44px actions,
Manrope/radius8, compact selected rows and no horizontal overflow.

Review found refresh could skip intervening pages after a long absence; added
completeConversationUpdate and direct200-message/stale/no-progress tests. Final
UI/model units PASS7, client units PASS3. UI contract PASS361files/4policy tests.
API build2 PASS after stopping owned dev launcher3924 (API12172/web14472);
runtime-split underlying script PASS with that exact build. Web go_live build1 PASS;
build2 PASS after the history-gap fix. Affected UI/client/API/buyer/web types PASS;
E2E types1/2 failed on one fixture normalizedPriceMinor:null; fixed to valid string,
E2E types3 PASS. Scoped lint initial PASS; completion run accidentally included
generated next-env (ignored-file warning), then new cleanup hit no-unsafe-finally.
Generated path restored and cleanup extracted; all other scoped files PASS and
the repaired test's focused lint PASS. These failures are retained in .tmp logs.

Real HTTP/browser CORE06 attempt1: upload/start/context and protected supplier
download status200+private/no-store passed, but Playwright response.body was empty.
Attempt2 verified the actual saved browser download bytes, then failed on an obsolete
alert-role assertion: an unknown result correctly uses warning/status feedback.
Updated the assertion to the visible warning without changing production behavior.
Attempt3 PASS1 (21.9s test/28.1s total): buyer first question with PDF, supplier
protected download bytes, unknown-send retry/idempotency, resolve/reopen/escalation,
and authorized operator access. Same backend/build and isolated DB. Test uses its own
.tmp/messages-e2e-storage and deletes only files uploaded by this synthetic actor,
marking those test assets deleted; sessions are revoked. Working DB untouched.
Canonical npm run dev restoration started after the isolated runtime stopped.
Publication/remote SHA/CI receipt remains pending below; LOCAL_PASS is not CI PASS.

### Final local receipt14.10 — LOCAL_PASS / publication pending

Final changed E2E types and focused lint PASS after cleanup/download assertion fixes.
After dev restoration, final question/catalog browser PASS5 (48.9s) on final fixtures:
1440/834/390, permission/lookup recovery and both deep-catalog return actions.
No product code changed after the successful API/web builds. Dev wrapper3852,
launcher6496, API6384:4012, Next8044:3000 originate from the canonical folder;
API readiness200 and browser routes verified. No working DB writes.

Reproducible commands (earlier attempts/logs above remain part of this receipt):
- `npm run test --workspace=@marketplace/schemas -- conversations.test.ts conversation-files.test.ts` — PASS5.
- `npm exec --workspace=@marketplace/api -- vitest run src/modules/support/conversations.service.spec.ts src/modules/support/conversation-attachments.service.spec.ts` — PASS12.
- `npm exec --workspace=@marketplace/api -- vitest run src/platform/http/request-body-policy.spec.ts src/platform/openapi/runtime-swagger.spec.ts src/modules/support/support-attachments.service.spec.ts src/platform/security/file-upload-policy.service.spec.ts` — PASS30.
- `npm run db:test -- exec --workspace=@marketplace/api -- vitest run src/modules/support/conversation-attachments.postgres.spec.ts` — PASS1 isolated fixture.
- `npm exec --workspace=@marketplace/ui -- vitest run src/conversation-draft.test.ts src/conversation-pages.test.ts` — PASS7; client conversation units PASS3.
- `npm exec --workspace=@marketplace/e2e -- playwright test --config playwright.messages.config.ts` — PASS10; final changed question/catalog subset PASS5.
- `npm exec -- playwright test --config apps/e2e/playwright.support.config.ts --grep "support attachments supplier|invalid input, scanner recovery|support attachments: operator"` — PASS3.
- `npm run db:test -- exec -- node scripts/run-canonical-browser.mjs --config playwright.unified.config.ts conversations.spec.ts` — PASS1 with go_live frontend and isolated API/storage.
- `npm run typecheck --workspace=<affected workspace>` — PASS ui/api-client/api/buyer-web/web/e2e; scoped ESLint exact paths in `.tmp/messages-lint-final-3.log` plus repaired CORE06 in `.tmp/messages-final-test-lint.log` PASS.
- `npm run verify:ui-contract`, `npm run build --workspace=@marketplace/api`, `node scripts/verify-runtime-split.mjs`, `npm run build --workspace=@marketplace/web` (go_live) — PASS.

Self-review: attachment authorization precedes storage; claims/replay/outbox atomic;
shared support behavior preserved; no draft/file contents persisted in browser storage;
stale selections cannot replace current detail; history bridges long polling gaps.
Scope excludes old product-preview receipt and reference-image directories.
No full release sweep, deploy or unrelated fixes; this is the selected R7 scope only.
## 13.10 approved concept implementation

Owner approved variant03 as the base with occasional photography from01 and
explicitly requested implementation. Same sole writer PlatformaMarket UI01a11795,
side task confirmed stopped, canonical main55c7d75 and reviewed WIP preserved.
Scope: catalog promotion marks, calm contextual strips and selected larger campaign
blocks; finish the already planned matching Promotions preview. Messages and question
modal remain their own pending roadmap steps, not automatically started here.
Reference output/imagegen/catalog-promotions-2026-10-13/03-product-benefits.png;
exact design passport and prompts in that directory/PASSPORT.md. Generated magnifier
and approximate controls must NOT replace existing adapters/tokens.

Behavior/risk/check plan: use existing promotion source where authoritative; keep
development examples visibly separate and never alter real card/checkout prices.
Show supplier-specific benefit and minimum quantities without claiming discounts
for every supplier. Do not invent volume tiers if absent from the API. Keep catalog
filters/return state and nonblocking campaign loading. Tests: focused mark/expiry/
preview query and production guard tests, catalog/promotions browser1440/834/390
including error/recovery/keyboard; buyer/web/e2e types, scoped lint/UI contract,
one completion go_live build, screenshots/computed styles, review+scoped publication
with actual CI receipt. Prior review/browser attempts remain preserved; modified
implementation gets its own bounded attempt log. No API/schema/working DB writes.

Artwork passport: six standalone photographic banner backgrounds, landscape2:1,
left45% quiet negative space; right product group. Mint restoration, peach gloves,
pale-blue burs, cream sterilization, mint impressions, deep-green consumables.
No text/logos/UI baked into the images; all labels/actions use DOM/shared controls.
Inspect outputs before saving optimized WebP as public artwork. Same artwork reused
on catalog and Promotions; on small screens stack art and copy to preserve contrast.

## Publication receipt13.10

Published c251bc1336712fe71ac8b16a9008ef0f1ccfdc27 to origin/main; independent
ls-remote equals local HEAD. Staged review/diff hygiene PASS,33 scoped files;
older product-preview receipt and local concept-reference folders remain untouched.
Exact-SHA snapshot: [CI38298761616](https://github.com/NikIg228/PlatformaMarket/actions/runs/38298761616)
in_progress; [Security38298761658](https://github.com/NikIg228/PlatformaMarket/actions/runs/38298761658)
queued. CI_PENDING, not CI_PASS; no automatic repair or monitor created.
Local implementation/checks complete, published; remote gates have not completed.
Commands: buyer vitest three named helper suites (11 tests); affected buyer/web/e2e
npm typecheck; scoped npm exec eslint; npm run verify:ui-contract;
npm exec playwright test --config apps/e2e/playwright.workspaces.config.ts
apps/e2e/tests/hybrid-promotions.spec.ts (final7 PASS); DEPLOYMENT_PROFILE=go_live
NEXT_PUBLIC_DEPLOYMENT_PROFILE=go_live npm run build --workspace=@marketplace/web.
No full-project/backend reruns; previous unchanged product-selection/model evidence
reused. Dev remains at http://127.0.0.1:3000; catalog and promotions ready for review.
## Implementation evidence13.10

Approved catalog composition implemented: shared StatusTag for an active, available
supplier offer with a valid API percentage/expiry; no recalculation or replacement
of catalog prices. A quiet conditions strip after two full rows, one photo module
after five full rows; no mandatory banner pair. Real campaigns retain exact product,
offer and sanitized return URL. Existing promotion filters/loading/recovery retained.
Six generated backgrounds optimized to WebP (27–57KB each), shared across local
catalog examples and Promotions mosaic. Development-only examples appear only after
successful empty API results; Promotions additionally probes the unfiltered endpoint
so a filtered empty real collection cannot be replaced with examples. No commerce
links for local examples, production/test environment guard and expiry retained.
Followed DESIGN_SYSTEM's09.10 visible-copy rule: removed the previous review's
service labels from prepared preview cards; their development-only nature is recorded
here and in delivery. They do not create live campaigns or order discounts.

Checks: mark/expiry/preview/display unit11 PASS; buyer/web/e2e types PASS.
Browser implementation1 PASS3, artwork1 PASS3. Visual inspection found an oversized
hero caused by stacked side tiles; final denser composition implementation2 PASS7
(1440/834/390 real-campaign loading/error/retry/filter/pagination/return/focus,
local image loading/modal/query restore/filter empty and mobile supplier badge expiry).
All assertions preserved. Screenshots inspected desktop/tablet/mobile; controls
computed Manrope, min44px, radius8px, no horizontal overflow. Final scoped ESLint PASS; UI contract PASS357 files +4 policy tests; go_live web build1 PASS. Canonical dev preserved (separate .next/dev output), /promotions HTTP200 after build. Shared search/API/DB unchanged. Previous review failures remain historical.
Logs .tmp/promotion-implementation-*, .tmp/promotion-artwork-browser-1.log;
final images output/playwright/promotion-implementation-2. No API/schema/DB writes,
no new Messages or supplier-question work, no additional writer/worktree.
## 12.10 owner review in PlatformaMarket UI

Owner explicitly confirmed the side conversation is stopped. Current bounded
executor is PlatformaMarket UI01a11795: inspect its existing WIP, correct demonstrated
defects, locate the three references and propose catalog promotion presentation
using WB/Ozon patterns. This is not acceptance of the whole roadmap or authorization
to silently implement every unfinished stage. Main55c7d75, canonical root, original
preview-data receipt and image-reference folders preserved. No new agents/worktrees.
Owner correction: one wide banner followed by a pair is illustrative, not a rule.
Supplier question modal and Messages requirements below are reaffirmed.

Plan before edits: fix promotions blocking product browsing, preserve catalog return
filters, suppress campaigns for unsupported delivery/stock constraints, and correct
the broken empty-state test selector. Review unfinished local-preview code for
missing images, misleading demo terms and expiry. Risks are lost selection/navigation,
misrepresented offers and UI recovery. Gates: focused helper/model regressions,
intercepted browser at1440/834/390 incl delayed/error promotions, keyboard/return,
buyer/web/e2e types, scoped lint/UI contract and one unified go_live build.
Existing browser attempts1–3 remain FAIL; owner's explicit correction request resumes
the identified fix as attempt4. No API/data/schema writes, no new Messages phase.
Do not publish the inherited feature as finished while its visual preview is incomplete.

### Review result13.10 (publication held for incomplete inherited visuals)

Confirmed and corrected:
- Slow/failed promotion GET hid the entire product grid. Products now render
  independently; loading/error/retry remain separate.
- Banner destinations hardcoded returnTo=/catalog. They now pass the caller's
  sanitized catalog URL including filters/sort/actual loaded count.
- Delivery/inStock/text-category constraints were ignored by promotion requests.
  Unsupported constraints now suppress promotional inserts rather than imply a match.
- Empty-state test searched for a heading although shared EmptyState renders strong.
  Corrected the precise accessible text assertion; no removed assertions.
- New test fixtures supplied null quantityLimit against the mandatory string contract;
  corrected both unit/browser fixtures. No schema changes.
- Development examples lacked an expiry check or visible demo distinction and
  referenced missing artwork. Added expiry/production/filter regressions, explicit
  test labeling and a nonbroken-image fallback. Artwork remains NOT_IMPLEMENTED.

Known incomplete roadmap outcomes (not accepted by tests): six artwork paths under
/images/promotion-previews/*.webp have no files; Promotions has not wired local
examples; real banners use product photos, not the approved campaign photography.
Messages source remains unchanged: reload still sets the common loading flag;
no new sidebar/composer/quiet-refresh implementation. Supplier question modal is
also outstanding. No claim of reference fidelity or full roadmap completion.

Checks: unit1 PASS46 across7 selected matching files (model.test.ts also matches
other existing view-model tests); after quantity fixture repair unit2 PASS7.
Buyer typecheck1 FAIL at inherited null quantityLimit, buyer2 PASS; web1/e2e1 PASS.
Scoped ESLint1 PASS19 changed/new TS paths. UI contract1 PASS357 files +4 tests.
Browser4 FAIL3 only at the new expected count48 vs actual loaded30; catalog correctly
normalizes return count to loaded results. Corrected expectation30 with sort retained.
Browser5 PASS3 at1440/834/390: pending API leaves30 products visible; modal/focus,
offer identity and catalog return state; pagination, error/empty/recovery; catalog
error/retry and suppression for inStock. API intercepted, no working data writes.
Logs .tmp/promotion-review-*; screenshots output/playwright/promotion-review-5.
Inspected desktop/mobile Promotions and tablet catalog screenshots: functional
composition/reflow only, fixtures intentionally have no product photos.
Native live catalog inspection at610 CSSpx: Manrope, DmButton44px/radius8,
no horizontal overflow, test labels visible and no broken image icon after fallback.
go_live unified build1 PASS (compile27.1s, TypeScript6.5s). Own generated next-env
returned to its pre-task dev baseline. git diff --check PASS. No repeat full suites
or backend checks. Main remains55c7d75; no commit/push of this incomplete inherited
feature. Corrections are local and verified; visual implementation remains partial.

Reference locations verified and images inspected:
- catalog: C:/Users/user/.codex/visualizations/2026/10/12/01a130cd-ae35-7771-a7c6-547fe0e4f59d/catalog-hybrid-approved/{desktop,mobile,tablet}.png
- Promotions: C:/Users/user/.codex/generated_images/01a130cd-ae35-7771-a7c6-547fe0e4f59d/exec-d108125b-55c8-42a6-8d85-db0672f5d9bd.png
- Messages: C:/Users/user/.codex/visualizations/2026/10/12/01a130cd-ae35-7771-a7c6-547fe0e4f59d/messages-redesign-approved/messages-desktop.png

Proposal, not implemented layout: sparse relevant catalog campaign modules with
product-level promotion markers and a persistent All promotions link; vary module
size by content/viewport rather than enforce wide+pair. WB documents catalog/banner
entry points and Ozon documents banners plus product promotion marks. Keep this
proposal within the existing roadmap; do not automatically add new ranking/ad tools.

## Prior side-conversation plan and evidence (preserved)

Owner12.10 explicitly approved phased implementation of the hybrid catalog,
separate Promotions storefront, offer-question modal/catalog return, and Messages
redesign including quiet background refresh. Scope is the accepted sequence,
not all R7. Current executor: side conversation01a130cd-ae35; existing
PlatformaMarket UI01a11795 and primary01a11758 both verified idle through task
listing before any repository write. No agents, new checkout, DB reseed or deploy.
Canonical main55c7d75fbb9714f196e75d148086855965e60f59. Preserve existing dirty
PRODUCT-PAGE-PREVIEW-DATA receipt and two untracked image-reference folders.
No global primary/generation transfer. User's current instruction assigns only
this bounded implementation; existing work remains owned by its executor.

## Accepted sequence (execution status lives in R7 roadmap)

Latest owner decision12.10 after explanation of empty API: explicitly create
test promotional banners and populate BOTH the hybrid catalog and Promotions
to make the approved appearance visible; then implement the agreed Messages
sidebar/chat changes. This resumes work with a changed plan, preserving prior
failed attempts. No permission to publish fabricated live campaigns or seed the DB.
Use development-only local preview content, same artwork/composition in both
surfaces, separate from commerce actions. Existing real promotion behavior stays.
Supplier-question modal/backend attachment expansion from the earlier sequence
is deferred behind this latest explicitly selected visible scope.

Implementation plan: six raster campaign photo backgrounds (restoration, gloves,
instruments, sterilization, impressions, consumables), DOM text/buttons using
shared controls; wide + paired catalog inserts; Promotions mosaic. Preview guard
NODE_ENV=development, no URL opt-in and no production checkout discount claims.
Then compact conversation rows, context header/menu, messages, pinned composer
and silent refresh using existing API. Risk: preview leakage, hidden real campaigns,
wrong recipient/draft/scroll after polling. Focused checks: preview guard/query,
existing conversation tests, actual desktop/tablet/mobile screenshots and keyboard;
affected types/lint/build at completion. Browser recovery continues as attempt4
after known test-selector fix; old attempts are retained, never relabelled PASS.

Artwork parameter passport before generation: photography only, no baked UI/text,
landscape2:1 source; right-side dental products, left45% quiet negative space;
mint/peach/pale-blue/cream/dark-green backgrounds echo approved references.
Natural soft studio light, no logos or fabricated certification marks. DOM overlay
keeps Manrope and existing typography tokens;44px buttons/radius8, banner radius12.
Phone composition must preserve readable copy and visible subject, not scale a
desktop screenshot. Verify every generated output before copying into project.

1. Hybrid catalog + Promotions: same published promotions; preserve product
   grid, insert one full-width banner after2rows and pair after3more, responsive
   5/3/2columns. Promotions editorial mosaic, filters and access to all campaigns.
   Real promotion data only; no fabricated inventory, dates or clickable offers.
2. Ask supplier in modal with supplier/product/variant context; existing dialog
   reuse; optional images/PDF using actual authorized file infrastructure; retain
   draft/errors, stay on product; restore deep catalog/filter state on return.
3. Messages: two-line conversation rows; compact context/status header; menu
   actions, natural-width bubbles, pinned composer with attachment/send controls;
   silent polling without loading flashes, preserved selection/draft/scroll.

## Source references and design contract

Approved packages are under
`C:/Users/user/.codex/visualizations/2026/10/12/01a130cd-ae35-7771-a7c6-547fe0e4f59d/`:
catalog-hybrid-approved, offer-question-approved, messages-redesign-approved.
Promotions concept: generated_images same task/exec-d108125b-55c8-42a6-8d85-db0672f5d9bd.png.
Treat concept figures/content as illustrative; preserve DESIGN_SYSTEM.md and both
JSON contracts, Manrope,44px controls/radius8, surfaces12; no local control overrides.
Approved image deviations: remove generated search magnifier/profile changes;
retain canonical shell dimensions and truthful sent/read status. Do not activate
demo banner links as real campaigns. R1/go_live policy unchanged.

## Risk / checks planned before implementation

Phase1: live campaign scope/expiry, query/pagination, responsive row insertion,
recovery and correct offer context; focused pure/component tests, buyer/web types,
scoped lint/UI guard, targeted browser1440/834/390 + keyboard; build at phase completion.
Phase2: first inspect conversation/files schemas/API/client. Any backend changes
start in schemas and require focused authorization/tenant/attachment/idempotency
tests after each coherent transition, disposable DB only if required. Then modal/
return-flow regressions and browser negative/recovery cases. No blind backend rewrite.
Phase3: shared conversation consumer inspection; tests of refresh/first load/filter/
pagination, pending/retry, existing operators; browser chat/layout/keyboard/mobile.
Completion: affected types/lint/build, diff review, scoped commit/push under §8,
actual exact-SHA CI status receipt. Max3 attempts per gate; track failures below.
No tests, PASS, implementation or publication claimed by this initial checkpoint.

## Current evidence / next

12.10 recovery result: phase1 browser gate BLOCKED at max3 attempts under
AGENTS7.1 / Workflow4.3. No fourth run, build, commit/push or phase2/3 writes.
Unit attempt1 PASS9 (promotion-display5 + product-detail/model4).
UI contract attempt1 PASS356 files; scoped ESLint attempt1 PASS before final
dialog lifecycle/test-selector edits. Buyer types2 PASS before offer-selection
changes; final buyer/web/e2e types and build remain pending, not certified.
git diff --check PASS. Logs .tmp/hybrid-{unit-1,ui-contract-1,lint-1,browser-1,browser-2,browser-3}.log.

Browser1 FAIL3 widths1440/834/390: Escape did not return focus from promotion
dialog to trigger. Fixed by keeping DmDialog mounted with controlled open and
returning focus in onClosed. Browser2 passed preceding layout/dialog/navigation/
pagination/overflow steps but FAIL3 at ambiguous getByRole(alert): page error and
Next route announcer both matched. Scoped test alert to main(name=Акции).
Browser3 passed that error assertion and reached recovery/empty, then FAIL3:
test expects heading(name=Действующих акций нет) whereas shared EmptyState
uses strong (packages/ui/src/index.tsx:488). This is a test-selector defect.
Next precise step after new owner decision: change only that assertion to
main(name=Акции).getByText(Действующих акций нет,{exact:true}), then one targeted
browser run. Preserve every existing assertion and prior attempts, no CSS/test
weakening. Phase1 final gates and later authorized stages still outstanding.

Screenshots in output/playwright/hybrid-promotions-{1,2,3}; inspected Promotions
1440/390 images from run2: mosaic/reflow present; fixture has no product photos,
so these do not prove final photographic fidelity. Need photo-populated visual
check and tablet/catalog image review before visual acceptance. No VISUAL_PASS.

Owner explicitly requested recovery and continuation in this same side conversation
after an erroneous context-recovery stop. This is the existing scope, not a new
handoff or competing implementation. Existing WIP/HEAD matched the checkpoint.
Buyer typecheck attempt2 PASS (metadata normalization), log .tmp/hybrid-buyer-types-2.log.
Offer deep-link now resolves the existing offer's variant/package; targeted tests
and phase1 acceptance remain pending. Prior attempts remain counted.

Baseline inspection: Promotions default route intentionally empty; dev catalog
has five noninteractive preview images. Public promotion API and filters already
exist. Messages polling30s/visibility uses common loading flag; compactList footer
renders LoadingState even when page exists. Implement phases in order.

Phase1 WIP: promotion-banner (live terms modal + lazy photo by exact product ID
through existing public search), use-promotion-page, hybrid grid, Promotions page
and responsive CSS implemented; old dev preview rail removed from public catalog.
Actual local storefront GET returns total0: no data writes; use intercepted browser
fixtures for populated state. Buyer typecheck attempt1 FAIL: public media metadata
is unknown vs narrowed local SearchMedia. Added explicit object/field normalization;
rerun pending. No pass yet. Product offer deep-link selection still needs wiring;
targeted regression/browser, styling guard and phase build remain pending.
