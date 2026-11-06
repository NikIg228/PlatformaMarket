# Catalog account entry: login flash — 06.11.2026

Owner reported a login form briefly appearing before the supplier cabinet and
requested checking clinic, supplier and personal entry. Canonical checkout:
`main@5161af7f83f909ad90901de403daa3f7fde0e928`, ahead 7. Existing WIP/index retained.

## Plan and scope

Keep the existing role-selected login continuation and verified session handoff.
Hide credential UI until automatic restoration has resolved; retain a loading
state after successful navigation issuance. Risk: premature login display,
permanent spinner on failure, lost workspace choice or social-login rendering.
Focused checks: restoration state transitions, existing header destinations and
auth-client handoff tests. Completion: affected landing/web types, scoped lint,
both builds, diff hygiene and real browser flow at desktop/mobile with keyboard.
No backend/auth contract, working data, permissions or dependencies change.

## Findings and implementation

Header links for BUYER/SUPPLIER intentionally go through `/login?returnTo=...`.
LoginPage previously rendered credentials on its initial render and while
`resumeAuthSession`, workspace lookup and handoff were pending. Busy merely
disabled the visible form. This explains the reported flash from source.

LoginPage now begins with shared LoadingState before effects run. Successful
automatic navigation retains it until departure. No session, restoration error
or handoff failure releases it; explicit signedOut bypasses restoration. Dual
roles/multiple organizations still use the choice UI, and unavailable roles
retain explicit fallback. Google initialization reruns when the form mounts
after restoration or account switching. No direct cabinet/auth bypass added.

Personal header destination remains `/personal/cart`. That page already waits
for personal session/context readiness, renders retry on failure and offers
login only after a confirmed missing session. Its `personal=1` login continuation
uses the same new loading state. Full B2C cabinet/checkout is outside this task.

UI: existing LoadingState/Fluent Spinner; no shared token changes. Layout only:
full viewport, centered content, existing space-6 padding. Contracts remain
market-components-v1/platforma-semantic-light-v1. No new assets or controls.

## Verification

- Landing `vitest run app/login/login-restoration.test.tsx app/auth-client.test.ts`:
  34 PASS (11 restoration, 23 auth-client).
- Buyer `vitest run app/features/marketplace-header/header-account.test.tsx
  app/features/marketplace-header/header-account-lifecycle.test.tsx`: 13 PASS.
- Scoped ESLint for login screen/new test: PASS.
- `npm run typecheck --workspace=@marketplace/landing-web` and web: PASS.
- `npm run build --workspace=@marketplace/landing-web` and web: PASS.
- `git diff --check`: PASS (line-ending warnings only).

Hook-harness tests assert rendered state and async transitions with mocked APIs;
they do not prove real browser hydration, network integration or focus.
Prior Chrome access error `undefined timeoutMs` remains unresolved. No additional
browser attempt or alternate access bypass; screenshot/computed/mobile/keyboard
acceptance remains OPEN. No commit/push before the required browser gate.

Own source files: landing `app/login/login-screen.tsx`,
`app/login/login-restoration.test.tsx`, `app/auth-split.module.css`.
Build logs: `.tmp/login-restoration-20261106/{landing,web}-build.log`.
Both next-env files restored byte-for-byte from pre-build snapshots. Prior owned
dev session83000 stopped for builds; `npm run dev` restarted after both builds.
New session11190 remains running (API9360, web5688). Launcher readiness HTTP200.
Initial HTTP probe ran before startup and was refused; after readiness the second
probe of `/login?returnTo=%2Fsupplier` returned200, with loading text and without
a password input in SSR HTML. This is server output, not hydrated browser proof.
