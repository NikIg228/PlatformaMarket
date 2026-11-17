# ALERTS-SESSION-20261117

Owner approved17.11: implement audited session termination/redirect, shared compact
feedback variants and remaining alert placements; verify desktop/mobile. Prior audit
found the1472px unauthenticated alert → owner-approved behavior change → typed
termination and scoped shared variants, preserving transactional warnings/recovery.

Base main7d45a37d. Foreign CDEK panel/shipment/order-detail WIP preserved. No backend,
working DB, provider or deployment changes. Report/inventory input:
C:/Users/user/Documents/Codex/2026-11-17/market-alerts-audit/.

Skills: market-review-frontend, market-run-verification; antislop during (owner
setting), ui/layoutmobile/human/copywriting. Requirements: existing tokens/colors;
bounded page errors and contextual warnings; retained drafts/recovery; visible
keyboard focus and wrapping action gaps at390/1440 RU/KK. No new screen/art direction.

Risk: shared auth and feedback consumers. Preserve refresh, no write replay,
identity/generation guard, transient network recovery, access denial distinction,
locale/returnTo and protection against automatic login loops.

Gates: focused session/client/feedback tests before dependent work; affected
consumer tests/types, scoped lint, UI contract, unified go_live production build
and bundle; isolated browser fixtures for expiry/revocation/refresh/403/offline/
recovery/identity race, persistent order warnings, toast and bounded page errors,
desktop/mobile RU/KK/keyboard/screenshots/computed. No database writes required
for mocked frontend cases; live Chrome read-only supplementary inspection.
Build/test budget20min each, startup5min, probe2min; same-blocker limit3.

Completion: all authorized UI behavior and scoped gates pass, reviewed task-only
commit/push if outgoing range safe, read-back SHA and actual CI; otherwise preserve
specific blocker. No claim of backend/business release acceptance.

Implementation: protected workspace/personal boundaries navigate to login on
terminal expiry or missing login; typed organization denial stays separate.
Foreground idle/focus checks reuse the session store's single-flight refresh.
Admin expiry no longer publishes an intermediate error. URL handoff injection,
generation guards and no write replay are preserved.

Shared inline feedback is content-sized up to48rem; page failure is neutral up
to40rem; explanatory notes are transparent up to72ch. Actions wrap with gaps.
Initial section failures use page presentation; five completed-action consumers
use toast. Durable order/discrepancy/payment/publication warnings retain their
existing conditions and lifetime. Local connector failure uses the shared error
component with retry; support/import/shipment notes and integration error are
bounded. Field errors and row status labels remain local.

Inventory disposition: the audited155 inline and6 dynamic-tone placements inherit
shared geometry;19 custom candidates were reviewed (plain local text/table labels
and already bounded detail panels are retained, coloured explanatory blocks are
bounded/neutralized). Auth-form notices remain constrained by their forms.
No blanket conversion of warnings or access blockers to disappearing toast.

Verification17.11 (logs under .tmp/alerts-session; copied with screenshots to
C:/Users/user/Documents/Codex/2026-11-17/market-alerts-implementation):

- API-client:42 files,116 tests PASS; UI:26 files,120 tests PASS. Includes terminal
  classification, transient recovery, refresh/generation invariants, protected
  markup without an alert, safe return path, idle/focus cleanup and hidden-tab behavior.
- Web consumers:resource-status, workspace-locale, add-product-page and
  deferred-offer:4 files,19 tests PASS.
- Typecheck UI/API-client/buyer/supplier/admin PASS. Unified go_live webpack build
  with isolated dist and tsconfig PASS (including web TypeScript); bundle budgets PASS.
- Scoped ESLint PASS; UI contract PASS478 files/10076 declarations/8020 elements,
  policy tests5 PASS. No DB/migration/release gate: no backend/domain change.
- Chrome through CUA: production fixture on3317/4183 with synthetic identities,
  no database/provider access; existing dev3000 UI-kit for shared components.
  Guest supplier orders→login preserved lang=kk and returnTo; expiry after a loaded
  orders page caused one failing refresh then login.403 clinic stayed on access
  state.503 current-session failure stayed on route; keyboard retry recovered
  orders. Orders initial503 retained shell, page-card retry recovered empty list.
- Visual inspection and computed styles:1440 desktop page-card640px;390 mobile
  orders card356.8px and no document overflow. Gallery inline464.6px and transparent
  note426.4px on desktop; actions wrap on390. RU and KK session copy inspected.
  Draft survived failed action and retry. Dialog Escape returned focus to trigger;
  toast close returned focus; persistent warning remained after toast dismissal.
  Reduced-motion toast inspected; overrides reset, synthetic tabs closed.
- Screenshots inspected:feedback-desktop.jpg, feedback-mobile.jpg,
  session-network-desktop-kk.jpg, session-network-mobile-kk.jpg,
  access-denied-mobile.jpg, orders-error-desktop.jpg, orders-error-mobile.jpg,
  toast-mobile.jpg. Browser coverage is representative shared components and
  protected routes, not an execution of every business state in all181 candidates.
  Backend revocation semantics are unchanged; identity races/write-no-replay are
  covered by unit tests, not simulated as real business transactions in Chrome.

Attempt history: initial parallel suites had import timeouts; isolated sequential
source suites passed. A direct Vitest invocation accidentally included generated
dist tests; stopped and used each package's --dir src script. UI boundary tests
needed Fluent mocks for the Node runner. A proposed invalid-hash invalidation
failed the existing stored-credential preservation test; reverted that delta,
full client suite passed. Initial ESLint included ignored generated/CSS paths;
corrected to explicit owned TS/TSX paths. One browser fill timed out under concurrent
checks; state was unchanged, retry after checks completed passed. Background-tab
screenshots caught the first animation frame; active-tab inspection confirmed toast
visibility. These are recorded attempts, not hidden green reruns.

React review: direct subpath imports for the boundary; effects clean up timers and
listeners, network failures do not erase a valid login. Existing Fluent/tokens kept.
No art direction/assets or whole-product redesign. Publication status recorded in
the final reply after task-only diff review; no deployment requested.
