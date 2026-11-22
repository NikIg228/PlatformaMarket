# AUTH-UI-FIELDS-20261122

Status: SCOPED_CHECKS_PASS / PUBLICATION_PENDING. Owner request: login without page scroll, remove pause icon,
catalog return links, verify login/registration field requirements.
Baseline main@84c8ebfa1b8ebe19bb5ab5a0bcc20c6b137ba0fe. Existing personal-mode
removal in login-screen/auth-client is preserved, as is unrelated working-tree WIP.
Prior login restoration PASS -> new browser measurement 1536x695, document height
713 -> change only auth composition/copy and frontend validation mismatches.

Brief: clinic/supplier users enter or register an organization. Preserve brand,
two-column desktop, Fluent controls, session/MFA/returnTo flow and backend rules.
Skills: market-review-frontend, Anti Slop during (UI/layoutmobile/human/copywriting).
Applied requirements: existing tokens/44px controls; no clipping form actions;
visible field errors with retained values; reduced-motion preference retained.
User explicitly removes the pause icon; no replacement decorative control.
No design generation or new shared parameters. Existing restrained green/white
brand and dynamic headline remain direction (energy1/rhythm1/motion2).

Risk: frontend auth validation and responsive layout; no API/auth policy or DB
change. Gates: schema-aligned boundary tests, login restoration/auth regressions,
landing/web types and builds, scoped lint/diff; real browser desktop/mobile,
short height, invalid form/recovery, keyboard and catalog navigation; screenshots
and computed dimensions. No real registration or password reset sent in browser.

Plan: remove root overflow via bounded viewport layout with internal form fallback;
remove pause icon; route both back links to catalog; reuse backend field schemas
for errors and normalize email before request. Record field limits and actual
verification below. Stop after this scope; prior payment visual work remains separate.

Owner follow-up: center the login form vertically in its right parent panel.
Implemented safe center alignment with 24px token padding and internal overflow
fallback; mobile decorative heading is hidden to leave room for the form.

## Field requirements checked against current API schemas/services

| Field | Existing requirement now used by the form |
| --- | --- |
| Login email | Required, shared Zod email syntax; trim/lowercase before request |
| Login password | Required, 1–128 characters; no new-registration minimum imposed on existing credentials |
| Owner name | Trimmed length 2–160 |
| Registration email | Required shared Zod email syntax; trim/lowercase; existing account rejected by server |
| New password | 12–128 characters; no invented uppercase/digit rules, not trimmed |
| Legal name | Trimmed length 2–240 |
| Workspace name | Trimmed length 2–160 |
| BIN | Exactly 12 digits; existing organization/pending intent checked by server, no checksum validation claimed |
| Consents | Terms and privacy required; marketing optional |

Frontend previously omitted maximum limits and used a different email regex.
auth-validation.ts now uses the actual shared field schemas. Invalid login and
forgot-password email are caught before request; visible inline errors preserve
input. Both return links use /catalog. API, DB and password policy unchanged.

## Evidence so far

PASS: 41 focused tests (7 field boundary tests + 34 auth/restoration regressions),
`.tmp/auth-ui-fields-tests.log`. Scoped ESLint PASS; reviewed full changed auth
diff, distinguishing earlier personal-mode removals; scoped diff --check PASS.

Desktop browser PASS: real dev /login?signedOut=1 at 1536x639, document1536x639,
right panel y0/h639.2, form y91.2/h456.8, vertical center delta0.000008px.
No pause control; catalog link resolved to http://127.0.0.1:3000/catalog. Screenshot
captured and visually inspected: `.tmp/auth-ui-fields-20261122/login-desktop.png`.
Shared input internal height42px (44px including wrapper borders), text14px.
Invalid email and empty password submitted: both inline errors appeared with
entered email retained; no authentication or reset request intentionally sent.
One getByLabel locator failed before action; observed accessible textbox role
resolved it. No real registration or new data created.

Browser BLOCKED during mobile viewport check: debugger detached from tab.
Documented troubleshooting + fresh inventory + rebind failed; new registration
tab creation timed out and reset the tool. No alternate-channel bypass. Mobile,
short-height, keyboard, actual catalog click-through and registration screenshots
remain UNVERIFIED, not PASS. Viewport set failed before result; no successful
override recorded. User asked asynchronously to restore extension access.

Anti Slop scoped gate: existing brand/controls and source-backed copy PASS;
desktop geometry/field-error feedback PASS; responsive/keyboard/full visual
acceptance BLOCKED. New assets, statistics, testimonials, themes and decorative
patterns N/A (none added). Pause-control removal is the explicit owner override;
existing reduced-motion support remains. No blanket accessibility PASS claimed.

## Recovery and final checks

User restored extension access. Old tab remained detached; a fresh tab restored
the original login checks. PASS at390x844: document390x844, panel y88/h756,
form y230.4/h471.2, center aligned. Screenshot login-mobile.png inspected.
PASS at390x500 with invalid fields: document390x500, panel client412/scroll573;
Tab from submit reaches Forgot password with visible focus and scrolls the form
to keep actions reachable. Screenshot login-short-errors.png inspected. Replacing
invalid email/password clears both errors; Enter on registration link opens it.
Registration mobile shows all six field errors and required-consent error;
correcting owner name removes only that error and retains email. Computed native
min/max lengths match the table. Viewport screenshot register-mobile-errors.png
inspected (full-page screenshot timed out; normal screenshot worked).
Registration desktop1440x900 screenshot register-desktop.png inspected. Enter on
its catalog link navigated to loaded catalog with54 products. Viewport reset.
No actual registration, valid-login request or password-reset email was sent.

During checks port3000 stopped independently; API4012 stayed available. Restart
against normal Next cache failed because another dev instance owns it on3110,
PID11348. That instance was not stopped. Started canonical apps/web on3000 with
isolated disposable Next cache and identical go_live/unified API routing;
owned exec87201, `.tmp/auth-ui-fields-20261122/dev-web-isolated.log`, verified
registration and populated catalog. Generated tsconfig additions were removed;
isolated dev adapter uses its own tsconfig. No DB changes or migrations.

Final PASS: landing-web and canonical web production build including TypeScript,
isolated output/go_live, build.mjs exit0 for both. Logs in
`.tmp/auth-ui-fields-20261122/{landing-web,web}-build.log`.41tests and scoped lint
remain valid (no source edits after their run). Anti Slop scoped responsive,
keyboard and visual checks now PASS; initial failures above retained as history.
Physical mobile keyboard/200% browser zoom and real registration delivery were
not exercised; no full accessibility or end-to-end registration certification.
No production deployment. Prior payment WIP must remain outside this task's commit.
