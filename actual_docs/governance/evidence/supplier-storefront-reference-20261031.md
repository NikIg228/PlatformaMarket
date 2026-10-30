# Supplier storefront reference — 31.10.2026

## Scope and design

Owner selected generated reference `exec-63283a4a-1bb1-4007-87d2-6a4301b58ae9.png`
and authorized implementation. Base main7401d6b; canonical workspace only.
Compact supplier identity, breadcrumb, details dialog, search/filter toolbar,
five desktop product cards with direct Details links. Global BuyerContextBar
rendering removed per explicit31.10 feedback. Existing ownership/auth and checkout
contracts are unchanged; supplier purchasing and personal payer flow are not
certified by this task. Other writers' personal-cart/login/AGENTS WIP preserved.

Reference artifacts: `output/storefront-review-20261031/approved-reference.png`,
`current-storefront.png`, `implementation-desktop.png`, `implementation-mobile.png`,
`implementation-mobile-kk.png`. Raster contains illustrative data; implementation
uses actual API prices, availability, names and existing exact-identity product media.
No synthetic reference products or prices were inserted into the working database.

Contracts: market-components-v1 / platforma-semantic-light-v1. Existing public
MarketplaceHeader; no workspace sidebar. Manrope; shared DmHeading page28/35,
controls44px/radius8px, surfaces12px, spacing16/24, desktop horizontal32px.
Approved raster scale is approximate; shared contract geometry remains authoritative.
DmSearch gains opt-in fullWidth for this toolbar; default440px and other consumers
remain unchanged. Shared dialogs/focus/actions are reused, no local control copies.

## Behavior and risk checks

- Details opens supplier information without occupying the initial catalogue;
  missing fields omitted, empty profile has explicit feedback, locale fallback kept.
- Card links preserve supplier route/query/locale in returnTo; price remains exact
  sale-unit price, packaging retained, multiple offers indicated by minimum price.
- Existing `/catalog-search` composition accepts a validated storefrontSupplierId,
  forwards to the authoritative supplier-only endpoint and adds only exact-identity
  bundled photos. Invalid IDs rejected before fetch; upstream404 remains404;
  no snapshot product/offer/availability substitution. API/backend/DB unmodified.
- Generic campaigns and local preview advertisements are not inserted in this
  supplier-specific grid; normal public catalogue retains existing behavior.
- Global personal-mode strip removed; account controls remain in the shared header.

## Evidence

PASS buyer typecheck2, web typecheck2, UI typecheck1. Commands:
`npm run typecheck --workspace=@marketplace/buyer-web`, `...@marketplace/web`,
`...@marketplace/ui`. Final Next builds additionally check TypeScript.

PASS focused Vitest: initial5files13tests (normal/storefront cards, supplier links,
URL/navigation), media composition4files18tests (BFF, exact media, live search,
storefront cards), grid1test (stale/foreign campaign exclusion). Logs:
`.tmp/storefront-reference-tests-{1,2}.log`, `...grid-test-1.log`.
Tabster missing sourcemap warning is non-fatal and retained in logs.

PASS scoped ESLint1/2 and final incremental3. UI-contract3 PASS:
467 CSS/TSX files,10057 declarations,7914 JSX controls/elements.
Browser1440/390 checked real data: product/return, empty search/recovery, details
and filters keyboard/Escape/focus return; RU/KK no overflow, all5 images loaded.
Normal catalogue24cards retains24ChooseSupplier actions and440px search.
New screens do not certify full accessibility; screen-reader audit not performed.

PASS final buyer build3 and web build1. Buyer initial bundle22 files,1335009 raw /400312 gzip bytes; budgets unchanged. Commands: `npm run build --workspace=@marketplace/buyer-web` and `npm run build --workspace=@marketplace/web`.
Final screenshot/QA PASS: [visual comparison](../../../design-qa.md), same1505×1045
source/capture plus1440/390. Main KK content preserved; existing common toolbar
remains Russian. Dev restored and left running; final5photos loaded, no overflow,
heading Manrope28/35, details button44/radius8. Publication/CI tracked separately.
Backend/PostgreSQL/release suites not rerun: no core domain/auth/schema/write change.

## Preserved failed attempts

- buyer typecheck1: partial MarketplaceCatalogState passed to breadcrumb helper;
  replaced with explicit localized catalogue URL; typecheck2 PASS.
- UI-contract1: local focus outline rules; removed in favor of existing shared
  focus layer; UI-contract2/3 PASS.
- Buyer builds1/2 PASS on earlier inputs; final3 required after shared search and
  campaign-exclusion fixes. No budgets or assertions relaxed.

Practices: Development Toolkit frontend/verification, Agency Frontend Developer,
Product Design image-to-code/design QA, React best-practices review. Existing
production app, assets, Fluent adapters and tests reused; no new starter/dependency.
