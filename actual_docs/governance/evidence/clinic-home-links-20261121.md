# CLINIC-HOME-LINKS-20261121

Scope: explain the buyer context selector and remove only the three redundant
quick links from `/clinic`. Existing shared selector, shell, sidebar, session and
organization switching remain unchanged. No new homepage content requested.

Prior result: homepage offered three quick links -> owner requests removal on
21 November -> minimal delta is a null page body inside the existing layout.
Selector comes from `workspaces/workspace.tsx` and `BuyerContextBar`: it chooses
personal purchase or an accessible BUYER organization, not the user's owner role.

Risk: local presentational deletion. Skills: market-review-frontend,
market-run-verification, antislop during (owner instruction), antislop-ui and
antislop-layoutmobile. Applied requirements: preserve shared tokens/shell; remove
the empty navigation landmark; add no filler content; verify desktop/mobile
geometry and retained navigation. Existing brand direction remains authoritative.

DoD/gates: inspect actual `/clinic` RU/KK desktop/mobile screenshots and computed
geometry; verify remaining sidebar destinations and keyboard navigation; affected
web production build/types, targeted lint and diff hygiene. No database writes,
new backend behavior, new UI controls or CSS changes; new unit tests and full E2E
not required for removal of static links. Build uses a separate output directory
to preserve the running dev server.

Baseline: main `5176aed5`, unrelated WIP retained, modified source page initially
clean. Source/profile: canonical PlatformaMarket checkout, local go_live dev.

## Results

- PASS: go_live webpack production build including TypeScript and all 50 static
  pages, exit 0. Harness: `.tmp/clinic-home-20261121/build.mjs`; full log:
  `.tmp/clinic-home-20261121/build.log`. Uses existing Next adapter output isolation,
  restores the prior next-env contents; no running dev process stopped.
- PASS: `npm exec -- eslint apps/web/app/clinic/page.tsx --max-warnings=0`.
- PASS: task diff hygiene; only the page, this evidence and the stale UI-standard
  sentence are included. Other writers' changes remain outside the task.
- PASS: Chrome extension browser inspection, RU/KK desktop and mobile screenshots
  captured and visually inspected. Artifacts in `.tmp/clinic-home-20261121/`:
  `desktop-ru.png`, `desktop-kk.png`, `mobile-ru.png`, `mobile-kk.png`.
- PASS: quick-links nav absent, sidebar retained. Real sidebar navigation reaches
  catalog (54 products), empty cart and loaded clinic order list. No write actions.
- PASS: selector opens with personal purchase and current organization options;
  Escape closes without switching organization. No owner-role change.
- PASS: mobile menu Enter opens, Escape closes and restores focus to toggle.
  Computed mobile toggle height 44px; heading 18px mobile / 20px desktop.
  Document scroll width equals viewport: 390px mobile / 1536px desktop.
  Geometry JSON retained. Browser console error capture returned an empty list.

Anti Slop scoped Delivery Gate: R-03/R-32/R-35 PASS with screenshots, geometry,
keyboard/navigation and build evidence above; R-24/R-26/R-39 PASS with remaining
real destinations and no empty navigation landmark; C-3/R-17/R-38 PASS, no filler
or invented metrics added. Shared loading/error/auth handling is unchanged;
no new data-driven state, form, modal, visual asset or theme was introduced, so
their additional gates are not applicable. Existing product direction preserved;
no new art-direction or redesign gate. This is acceptance of the static homepage
deletion, not whole-product or production certification.

Rerun triggers: page/layout/sidebar changes, relevant shared styles, session
contracts, Next/config/dependency changes. Local build includes current unrelated
working-tree changes; publication and CI are reported separately in the chat.
