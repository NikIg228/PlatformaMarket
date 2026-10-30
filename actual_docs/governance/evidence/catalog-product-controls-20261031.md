# Catalogue and product controls — 31.10.2026

Owner scope: catalogue CTA becomes Details and navigates directly to the product,
without the quick-offer modal. Keep return URL and remembered card position.
Supplier offers: compact quantity with external minus/plus, no native spin arrows;
aligned avatar/name; dropdown sorting without an external caption.
Later owner annotation sets maximum selectable quantity to100 sale units.
Minimum/order increment and existing add-to-cart authorization remain unchanged.
This is a selector limit, not a new aggregate-cart or server API restriction.

Base954ca46/main, canonical workspace. Personal-cart/auth WIP preserved, including
supplier-offers.tsx; stage only task-specific hunks. No backend, data, deploy or
dependency changes. No delegated agents. Development Toolkit frontend/verification,
Agency frontend practice and React best-practices applied within existing Fluent UI.

Design: market-components-v1 / platforma-semantic-light-v1, Manrope, controls44,
radius8. Shared opt-ins DmInput quantity and DmButton inline retain default consumers.
Quantity observed widths34.54/43.08/51.61px for1/10/100; native number semantics and
keyboard ArrowUp retained. Supplier avatars share the left edge and have8px name gap.
Sort options are unchanged; keyboard selection reverses displayed price order.

## Evidence

- PASS buyer scoped Vitest8files43tests (card navigation, identity, presentation/model),
  `npm run test --workspace=@marketplace/buyer-web -- compact-catalog.test.tsx storefront-product-card.test.tsx supplier-identity.test.tsx model.test.ts`.
- PASS quantity rules2tests:100 allowed,101 rejected; minimum/increment and fractional
  quantities preserved. `npm run test --workspace=@marketplace/buyer-web -- supplier-quantity.test.ts`.
- PASS shared control props2tests after fixture adjustment, final attempt3:
  `npm run test --workspace=@marketplace/ui -- quantity-input.test.tsx`.
- PASS UI-contract final3,468files/10077declarations/7912elements. Subsequent changes
  only pure quantity rules and spec assertions; no further control-style change.
- PASS buyer/UI typecheck1; final app builds also check transitive TypeScript.
- PASS scoped ESLint1 and incremental fixture lint2. Web/E2E types PASS;
  `npm run typecheck --workspace=@marketplace/web` and `...@marketplace/e2e`.
- PASS buyer/web final builds1: `npm run build --workspace=@marketplace/buyer-web`
  and `...@marketplace/web`; buyer initial JS400177gzip bytes, budget unchanged.
- Browser CUA on actual local dev1440/390: Details opens product without a dialog;
  return restores catalogue; +/-/manual/ArrowUp,0/100/101 validation and recovery;
  sort via keyboard, shared default catalogue controls, aligned supplier identity,
  no horizontal overflow. No cart write was submitted. Screenshots:
  `output/catalog-controls-20261031/product-desktop.png`, `product-mobile.png`.
- Existing E2E specifications adapted to the new reachable product flow; this
  entry does not claim the whole E2E suite ran. DB-dependent purchase tests are not
  rerun for selector/navigation changes. Backend/postgres/release gates not applicable.

Retained failed attempts: shared UI test1 failed at Tabster ESM import before test
execution; uses the same Fluent mock boundary as existing shared adapter unit tests,
with actual Fluent rendering checked in browser. UI-contract1 rejected an undeclared
CSS variable; removed in favor of shared computed width. Browser caught native data
attributes landing on the input instead of root; switched root styling to shared
class. Notes in quantity grid now span both columns so the hint cannot displace Buy.
Browser tab creation timed out once; reused the existing task tab successfully.
No assertions, budgets, limits of test retries or authorization guards were weakened.

Final builds complete; dev restart launched from the same owned canonical launcher.
Publication/CI are tracked separately. No full-project or release certification claim.
