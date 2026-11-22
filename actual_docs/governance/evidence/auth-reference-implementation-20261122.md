# AUTH-REFERENCE-IMPLEMENTATION-20261122

## Owner follow-up: alignment and narrower login fields

Prior cb2cba1b scoped PASS → owner requests centered form headings/actions and
registration lead, shorter login fields, BIN hint inside input → local layout/copy
delta only. Login fields max400px (previous520); parent form and vertical centering
retained. Shared typography/control heights unchanged. Reuse skills/brand direction
above; gates: landing/web build/types, scoped lint/UI-contract/diff, browser desktop
and mobile geometry, BIN placeholder entry and validation. No auth/data changes.
Status: IMPLEMENTED / scoped checks PASS; publication pending.

Owner added «Создайте профиль», reveal actions for password inputs and registration
confirmation in the same desktop row. Shared DmInput type=password now has an opt-in
by-type visibility button (default masked, type=button, disabled follows input,
accessible show/hide labels); covers login/register/reset/resume/invitation and
the existing admin secret input without per-page duplication. Registration confirm
is local state only, exact equality required before existing requests; no new API
field. Add focused shared input/confirmation tests and browser reveal/hide keyboard,
retained value, mismatched confirmation, narrow layout and representative reset
consumer checks. Earlier alignment-only builds do not certify this added behavior.

Follow-up verification (2026-11-22):
- PASS: auth tests42 (including exact confirmation, empty/mismatch/case/spaces),
  shared password/component tests5, scoped ESLint, UI contract policy5 + verifier.
  Initial shared test runner failed on Fluent/Tabster ESM; existing CJS-compatible
  test loading fixed it, subsequent run PASS. Real Fluent controls remain rendered.
- PASS: final isolated landing-web and web production builds including types,
  after all password edits. Logs `.tmp/auth-alignment-20261122/`.
- Chrome desktop login: centered heading/button; fields400px; outer control44px
  (fractional computed43.6). Synthetic password revealed then masked by keyboard,
  no submit/navigation/errors from reveal. Registration heading32/40/600 and
  centered lead/action; passwords same row; mismatch appears then clears on exact
  correction, reveal retains synthetic value. BIN hint is placeholder, hidden
  while typing. No successful account creation or credential changes performed.
- Registration390x844: passwords stack, no horizontal overflow; screenshots
  captured and visually inspected: `output/auth-alignment-20261122/` files
  `register-desktop.png`, `register-mobile.png`, `login-desktop.png`, `login-mobile.png`.
- Reset without token: both fields and both reveal actions correctly disabled;
  existing recovery error/link retained. Enabled reset submission not exercised
  (no reset token, no credential changes in scope). Login mobile repeat on127.0.0.1
  redirected to supplier after an active session appeared. Resolved by checking
  same canonical dev on localhost in a separate unauthenticated tab, preserving
  user's session. At390x844 fields342.4px, no horizontal overflow, heading/action
  centered; Tab/Enter reveal/hide retains input, focus outline visible, no submit.
  Screenshot captured and visually inspected; viewport override reset.
- Anti Slop delivery within scope: existing typography, compact actions, centered
  geometry, meaningful labels/placeholder, keyboard reveal and validation recovery
  checked; no assets/dependencies or adjacent redesign. Loading/network/backend
  states unchanged; no DB/E2E release gates for this frontend-only delta.

## Prior reference implementation (cb2cba1b)

Status: SCOPED_CHECKS_PASS / PUBLICATION_PENDING. main@64071145, canonical PlatformaMarket root. Prior auth
layout/validation PASS → owner approved references with strict numeric typography
and compact primary buttons → minimal presentation changes, no auth/API/DB change.
Existing personal-mode removal in login-screen and unrelated WIP preserved.

Audience: clinic/supplier signing in or creating a profile. Keep existing routes,
validation, MFA, returnTo, brand, motion/reduced-motion and responsive composition.
Signup refers to existing /register. Headings Manrope32/40/600, labels14/20/600,
body14/20/400, hints12/400. Buttons retain shared44px height and radius8, width by
content; login catalog return centered in its existing footer row, with left arrow.
Default DmField labels are700; introduce opt-in auth typography in shared adapter
to implement owner's explicit600 decision without changing other consumers.

Skills: market-review-frontend; Anti Slop during per saved preference, UI/layout/
human/copy. Applied: consistent token typography, real catalog navigation, visible
keyboard focus, no horizontal overflow or inaccessible actions at short heights.
Direction: existing green/white brand, energy1/rhythm1/motion2; reduced headings
prioritize form entry, compact buttons communicate a single action, arrow signals
return navigation. No assets or broad redesign.

Risk: local CSS cascade/mobile and opt-in field typography; default shared fields
must remain unchanged. Gates: targeted auth regressions, landing/web build+types,
UI contract, lint/diff; browser desktop/mobile/short height, empty-submit recovery,
keyboard/catalog links, screenshots plus computed fonts/geometry. No valid account
creation, password reset, migrations or working DB writes. Stop after scoped PASS.

## Implementation and verification

Both forms share CSS typography and opt-in DmField auth labels. Default DmField
remains14/700; no default field selector changed. Added shared inverse focus color
for the catalog link on green; other consumers retain brand focus and forced-color
Highlight. Initially local focus CSS failed UI-contract gate; moved it into shared
layer. Browser then exposed CSS optimizer specificity; resolved through shared
focus-color variable. Final focus computed white on green, default actions green.

PASS: 41 auth/validation/restoration tests; scoped ESLint; final verify:ui-contract
(5 policy tests and487 source files). Final landing-web and canonical web production
builds including TypeScript exit0. First builds also passed; repeated after the last
shared focus correction. Logs: .tmp/auth-reference-20261122/*.log.
React review: no new hooks, requests, effects, dependencies or auth state changes;
typed optional adapter prop consumed before DOM spread; native links and buttons.

Browser PASS: headings both Manrope32px/40px/600; eight field labels14px/20px/600;
inputs14px/400; hints12px/400; return links14px/20px/400; primary buttons14px/600,
44px height, widths96px and120.075px, forms520px desktop. Login1440x1000 document
equals viewport, vertical center delta0, footer horizontal center delta<0.001px.
Login390x844: center delta0, one-line40px heading;320x700 also one-line, no overflow.
Short390x500: document500px, internal panel352px/scroll513px; Tab reaches forgot
password visibly. Registration390px: no horizontal overflow; required field and
consent errors visible; correcting owner name removes its error and retains input.
Both catalog links activated with Enter; catalog loaded54 items. No valid submit.
Existing rotating text/reduced-motion and pause removal preserved. Mobile login
brand/back action stack to keep the longer label centered and avoid collision.

Screenshots captured and visually inspected in
output/auth-screen-references-20261122/implemented: login-desktop.png,
login-mobile.png, login-320.png, login-short-keyboard.png, signup-desktop.png,
signup-mobile.png and signup-mobile-errors.png. Full-page screenshot timed out;
normal viewport screenshots worked. One browser timeout required rebinding; original
focus inspection succeeded afterwards. Viewport reset. Signup retains natural page
scroll; no claim that its entire form fits every viewport. References are composition
guides; exact implemented sizes follow the passport, not raster proportions.

Anti Slop scoped gate PASS: geometry/responsiveness evidenced above; actual labels,
errors and navigation; visible keyboard focus; existing brand/composition retained.
Contrast computed: white/brand5.35, primary/white16.64, secondary/white6.83,
muted/white5.17. New assets, testimonials, statistics, dialogs and themes N/A.
No full E2E/DB suite: presentation-only scope with targeted auth regression coverage.
