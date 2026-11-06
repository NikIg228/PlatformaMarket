# Supplier product list loading — 05.11.2026

Owner explicitly approved proposed items1–3: separate navigation constants,
defer the offer panel/editors and narrow related UI imports. No data caching,
image work, backend changes or admin tuning authorized by this task.
Canonical main@5161af7 ahead7, previous staged/unstaged work preserved. Pre-edit
snapshots and plan: `.tmp/product-list-lazy-20261105/`.

## Implementation and invariants

- ProductActions imports `supplier-product-links.ts`, not the sibling page module.
- The offer panel imports on first non-null selection. Once loaded it stays
  mounted when closed, preserving Fluent exit motion and deferred navigation.
- Price, delivery and settings editors import when their mode renders. Existing
  keys, draft/lock guards, permissions, save handlers and focus restoration remain.
- Local deferred loader provides loading, cancellation/Escape and retry after
  import failure. In-flight import is shared; success is cached. A completion
  after cancellation does not reopen the panel; current props/direct-edit flag
  are forwarded on completion. No failed-import automatic retry loop.
- Seven affected consumers use explicit existing UI entrypoints. No UI package
  API, tokens, CSS, assets or dependencies changed. Five editor/VAT/navigation
  component bodies match their prior content after removing import statements.

## Measurements

Same-process A/B manifest measurement temporarily restored only captured task
files, checked their exact contents before each write, and restored the final
implementation in `finally`. No other WIP was staged or overwritten. Three HTTP
requests per variant; same route and source-map method, caches retained.

| Dev manifest graph | Before | After |
| --- | ---: | ---: |
| Raw bytes | 14,224,921 | 11,662,226 |
| Chunks | 30 | 27 |
| Source entries | 930 | 776 |
| UI source entries | 78 | 28 |

About18.0% fewer raw dev bytes. Panel/three editors, sibling page aggregator,
spreadsheet import, supplier inventory and proposals list are absent from the
after manifest source maps. Graph size is not a browser network/UX measurement.
After HTTP3171/72/66ms; before1335/256/115ms. Cache invalidation differs; these
numbers do NOT prove cold compilation speedup.

Final production manifest including bootstrap/polyfills:35JS files,
2,123,551rawbytes/576,203gzipbytes. No comparable production baseline captured;
no speedup claim or invented budget. Public catalog bundle budgets do not certify
this supplier route. Browser hydration and actual deferred network timing remain open.

## Verification

- `npm run typecheck --workspace @marketplace/web`: PASS1.
- `npm exec --workspace @marketplace/web -- vitest run app/workspaces/deferred-offer-module.test.ts app/workspaces/deferred-offer.test.tsx app/workspaces/offer-summary.test.ts app/workspaces/add-product-page.test.tsx`: PASS1,13tests.
- Tests cover no eager import, in-flight sharing, success cache, rejection/synchronous
  failure retry, closed loaded panel retention, latest props, cancellation before
  resolve, direct-edit flag and retry preserving selection. React hook harness
  and mocked controls are used; not a browser/focus/Fluent integration proof.
- Scoped ESLint, unchanged-body comparisons and `git diff --check`: PASS.
- `npm run build --workspace @marketplace/web`: PASS1.
- Existing source styles/components reused. React review: factories declared at
  module scope, stable loaders, guarded asynchronous state updates, unchanged
  editor lifecycle after load. No permission/price/data caching changes.

## Open acceptance

Browser verification remains BLOCKED by the previously exhausted three Chrome
tool failures (`undefined timeoutMs` before page access). No recovery evidence or
new attempts; no alternate-browser/auth bypass. Screenshot/computed styles,
1440RU/390KK keyboard, actual chunk failure/retry, drawer exit navigation, draft
guard and authenticated direct-link integration are NOT_RUN. Antislop visual/
interaction delivery gate remains OPEN; no overall acceptance, commit or push.

Next after browser control recovers: exercise selection → loading → panel → each
editor, direct `offer/edit` link, cancel while loading, import retry, close/navigation
and dirty/locked guards, then scoped Git review. Earlier shell/create-page work
keeps its separate browser acceptance open.

Requested dev remains ON, launcher session34526, log
`.tmp/dev-request-resumed-20261105.log`; no data mutation/deploy. Generated web
next-env imports restored to the clean pre-build baseline.
