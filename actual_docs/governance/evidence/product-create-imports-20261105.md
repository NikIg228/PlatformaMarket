# Product creation import boundary — 05.11.2026

Owner explicitly authorized implementation after the compilation analysis:
separate AddProductPage from sibling pages and use narrow UI imports. Scope is
module loading only; no redesign, admin changes, dependency upgrades or data writes.
Canonical main@5161af7, ahead7; previous staged/unstaged work preserved.
Pre-edit files and verification plan: `.tmp/product-create-split-20261105/`.

## Change and risk

`/supplier/products/new` now exports `workspaces/add-product-page.tsx` directly.
The former aggregator keeps its other pages. Existing markup, both required
permissions, current organization/API and `request=1` form selection are preserved.
PermissionBoundary, AddOfferWizard, ProductProposalForm, OfferVatEditor and VatFields
use explicit existing UI modules. Added only the `product-workflow` public export;
earlier uncommitted UI exports belong to the preceding shell optimization.
Five component bodies match their pre-edit contents after removing import lines.

Risk: client import boundaries and route selection. No lazy loading lifecycle,
hooks, business logic, CSS, design tokens or form state were changed. Shared
PermissionBoundary and supplier form consumers are covered by enclosing types/builds.

## Measured result

Same client-reference-manifest/source-map method as the preceding analysis:

| Metric | Before | After |
| --- | ---: | ---: |
| Raw dev JavaScript bytes | 13,814,381 | 11,574,823 |
| Manifest chunks | 30 | 25 |
| Source entries | 905 | 762 |
| UI source entries | 78 | 29 |

Spreadsheet import, supplier inventory/editor, proposals list, corrections panel
and the sibling page aggregator are absent from the resulting graph. About16.2%
fewer raw dev bytes. This is a manifest graph, not production size or guaranteed
initial browser transfer. After-edit compile-path4.969s, HTTP5.319s then77/82ms.
Cache invalidation and concurrent checks differ from the earlier runs; these
times do NOT prove a comparable cold-compilation speedup.

## Verification

- `npm run typecheck --workspace @marketplace/ui --workspace @marketplace/web --workspace @marketplace/supplier-web`: PASS1.
- `npm exec --workspace @marketplace/web -- vitest run app/workspaces/add-product-page.test.tsx`: PASS1,3 tests. Actual route export, wizard/API/organization, request selection and permission-denied rendering. Forms/permission hook mocked; not server authorization evidence.
- `npm exec --workspace @marketplace/supplier-web -- vitest run app/features/supplier-workspace/offer-editor-model.test.ts app/features/supplier-workspace/offer-packaging.test.ts`: PASS1,6 tests.
- Scoped ESLint on changed TSX files: PASS1.
- Five unchanged component-body comparisons and unwanted manifest module check: PASS1.
- `npm run build --workspace @marketplace/supplier-web --workspace @marketplace/web`: PASS1, including supplier bundle gate. Generated web next-env restored to clean pre-build baseline.
- `git diff --check`: PASS. React review found no new hooks, state, async or accessibility behavior changes.

Browser acceptance remains OPEN: the earlier Chrome tool blocker exhausted three
attempts before page access (`undefined timeoutMs`). No evidence of recovery;
no repeat or alternate auth/browser bypass attempted. Screenshots, computed styles,
keyboard/mobile and authenticated form interaction are NOT_RUN. Unit checks and
HTTP200 do not replace these. No overall acceptance, commit or push while this gate
is open. Next step after browser recovery: both creation modes and denied role,
representative legacy supplier consumer, keyboard/mobile, then scoped Git review.

Requested dev remains ON; ordinary launcher session34526, log
`.tmp/dev-request-resumed-20261105.log`. No API/DB suite needed for import-only work.
