# PRODUCT-PAGE-PREVIEW-DATA — LOCAL_PASS / PUBLICATION_PENDING

Owner12.10 explicitly requested local test content for five product pages and
short catalog titles; clarified: exactly five cards in the attached screenshot,
not the different five names in voice transcription. IDs: fe626b9d / fced80c9 /
75244306 / 6daf5fd0 / 6aa0d5a6 (full IDs in fixture manifest).
Writer: PlatformaMarket UI01a11795-17a2-7f52-9e7d-b3314bf87ed7; primary01a11758
verified idle. Canonical main954be515 only. Preexisting own prior task receipt
and two untracked image-reference folders preserved. No other writers/agents.

Scope: test variants, package choices, 3–5 supplier offers per comparable package,
price/availability/delivery, attributes, descriptions and usable sample documents.
Short catalog titles preserve model/size/identifying parameters; full source names
remain intact. No new commercial claims, compliance approvals, reviews, real
certificates, production writes, purchase-policy changes or full catalog reseed.

The owner request authorizes this bounded local data preparation. Existing offers
are pilot-demo imports, but their price/stock freshness expired. Preparation must
validate exact five product identities and pilot-demo external IDs, use a local
database guard, save a local before snapshot and apply atomically/idempotently.
Do not change supplier agreements/admission, reserved stock or other products.
Additional page description/documents are local preview content only and absent
from production. Keep source media identity and existing shared UI adapters.

Risk/check plan: strict scope/target guard, repeated-run idempotence, preserved
reservations and rollback in disposable test DB before local application; focused
title/fixture unit tests; actual five pages + catalog at1440/390 incl variants,
packaging, prices, tab/download and keyboard; existing product regression with
intercepted writes. Types/lint/UI-contract and one final go_live web build,
diff/self-review, scoped commit/push only if required gates permit publication.
Prior954be51 CI failed Run npm test; Security passed. Preserve failure visibly;
read the precise failure before publication, do not silently broaden this scope.

Geometry unchanged: Manrope, H132/24, body14, controls44/radius8, surfaces12,
content max1240, semantic-light tokens. Documents reuse shared DmButton links
and existing grid/text tokens. Development Toolkit frontend/backend/verification
and Agency Frontend Developer/Code Reviewer read and applied; no delegation.

## Implementation and evidence

Local fixture manifest uses the exact five screenshot IDs/source names; existing
source names and media are preserved.16 variants, two packages each, three suppliers
per comparable package:96 fresh priced/stocked offers overall. Existing pilot
suppliers/warehouses/admission/agreements retained. No new compliance approvals,
reviews or official certificates. Existing supplier markers were not rewritten.
Catalog prices and the normal comparison API read these local DB records.
Compact titles use curated catalogName for the five; a narrow presentation helper
also removes known LM/Latelux/LUMEX import boilerplate in other catalog headings.
Sizes, shades, REF and unknown names are preserved, source identities unmodified.

Preview descriptions and ten sample PDFs are server-gated to development and
exact product identity. Dev document route has an allowlist, attachment MIME,
no-store and production404; files are outside public assets. Product UI reuses
DmButton links and shared tokens. PDFs identify themselves as educational copies,
not manufacturer instructions/certificates; no extra demo banner in the page.

Data attempt log:
- Read-only preflight1 failed on wrong warehouse property name, corrected to
  supplierOrganizationId; preflight2 PASS. No data was written.
- Isolated initial verification PASS. First local apply failed P2002 on the
  partial unique ACTIVE-price index, transaction fully rolled back.
- Reuse the existing ACTIVE price ID; add an expired active-price fixture to
  isolated verification. Verification2 PASS incl idempotence, 96 offers/16 variants/
  32 packages, reservation denial, foreign identity denial, untouched sentinel and
  full rollback of all fixtures. No third failed attempt.
- Local apply2 PASS on127.0.0.1:5432/marketplace; source dev3924/API12172 already
  canonical. Backup .tmp/product-preview-before-1791826170367.json; earlier failed
  attempt backup also retained. Freshness expires2027-01-10, no automatic refresh.
- Read-only reconciliation PASS: five original canonical names preserved;20 other
  offers with prices/inventory/publication/delivery unchanged byte-for-byte.
- Tests use127.0.0.1:5432/dentmarket_audit_20260914; never clone/reseed dev for checks.

Commands/results:
- node --test scripts/lib/product-page-preview-seed.test.mjs:2 PASS.
- node scripts/verify-product-page-preview.mjs:PASS (latest fixture includes old
  ACTIVE price). All transactional verification fixtures rolled back.
- npm run test --workspace=@marketplace/buyer-web -- app/catalog/product-title.test.ts app/features/product-detail/local-preview.test.ts app/features/catalog/compact-catalog.test.tsx:7 PASS.
- npm run test --workspace=@marketplace/web -- 'app/dev/product-documents/[productId]/[document]/route.test.ts':2 PASS (download, traversal/unknown denial, production404).
- npm run test --workspace=@marketplace/buyer-web -- app/performance-boundaries.test.ts app/features/catalog/supplier-contacts.test.tsx:4 PASS.
- npm exec -- playwright test --config apps/e2e/playwright.workspaces.config.ts product-detail.spec.ts --output output/playwright/product-preview-regression:6 PASS. After icon-only fix, affected desktop/mobile selection/purchase/zoom2 rerun PASS at product-preview-final-icons; other four unaffected behavior checks reused.
- Same runner catalog-reference.spec.ts:2 PASS at product-preview-catalog.
- npm run typecheck --workspace=@marketplace/buyer-web and @marketplace/web:PASS,
  final rerun after icon/route-test edits PASS. Scoped ESLint all changed TS/TSX/
  MJS PASS, final affected icon/route-test paths PASS.
- npm run verify:ui-contract:4 policy tests +351 files PASS.
- PDF skill/reportlab:10 PDFs,10 pages, all text extraction/render checks PASS;
  overview visually reviewed in output/playwright/product-preview-documents.
  All10 actual GET downloads200/application-pdf with %PDF signature PASS.
- Native browser: all five real pages at1440 and390 show3 suppliers, populated
  variants/attributes/description/documents, no horizontal overflow. Size and
  package changes update prices; mobile document keyboard focus visible, two
  accessible download links. Catalog short names and prices visible1440/390.
  Screenshots: output/playwright/product-preview-live. One CUA off-screen click
  landed on an adjacent link; corrected by keyboard after stable hydration.
  No messages/cart/order writes performed. Viewport reset; one deliverable tab.

Inherited CI failure954be51 was narrowed read-only to buyer performance-boundaries:
root Fluent icon imports in supplier-offers/product-gallery, both from the same
product-page slice. Replaced only those imports with existing per-icon svg entry
points; the exact failed test now PASS3 locally. No unrelated CI/config changes.
Historical CI38279333762 remains FAILURE; this does not relabel it green.

Final go_live npm run build --workspace=@marketplace/web PASS, attempt1,
log.tmp/product-preview-web-build.log; compile81s + TypeScript19.8s. Next dev
output remains isolated in.next/dev; source dev/API were not stopped. The build's
generated next-env change is restored to its exact pre-task dev baseline.
No new API contract/Prisma schema or payment/stock-reservation logic; broad backend,
release and full browser suites are not required for this bounded local preview.
Self-review complete: exact fixture/tenant ownership, preserved reservations/source
identity, decimal money, deterministic IDs, atomic failure, dev-only document paths,
responsive/focus states, unchanged controls and same-flow icon boundary checked.
Next: final diff/staged gate, commit/push and SHA CI snapshot. No next product phase.
