# AUTH-MAIL-RESEND-20261123

Owner: separate password recovery from login email validation; configure Resend
for Market and verify delivery to the privately supplied recipient. Keep CRM.
Prior logout hotfix remains deployed; unrelated mixed WIP must not be published.

Gap: login sends forgot request directly; local mail is a file; limited stand
blocks all external auth mail. Delta: standalone recovery form using shared auth
utility layout, private authenticated SMTP relay with Resend-only TLS transport,
explicit narrow auth-mail configuration, no payment/SMS/other integration enablement.

Skills frontend/integration reliability and Anti Slop during: reuse shared fields,
visible labels/focus, neutral success without account enumeration, loading/error
and retained email. No new design system or unrelated auth redesign.
Checks: form interactions and browser desktop/mobile/keyboard; mail/config/relay
invalid/auth/timeout tests before integration; API/client types and web/API builds;
production config/runtime gates; single live test mail, Resend receipt, scoped
server rollout and CRM/non-target process preservation. Secrets stay outside Git.

Provider: platformadigital account; existing CRM domain/key retained. Created
notify.platformamarket.kz. User explicitly confirmed DKIM and two CNAME DNS records.
DNS verified; enforced TLS selected. Owner approved creating the Market-only
Sending access key, stored outside the repository with an owner-only Windows ACL.
SMTP TLS/authentication passed locally and on the server. The first local test
attempt timed out. After browser recovery the Market-only Resend log showed no
accepted message. One test was then sent through the deployed server relay:
SMTP_ACCEPTED, followed by Resend Delivered. Recipient was owner-supplied; no
account, password or organization data was changed. Delivery screenshot is kept
outside Git in output/auth-mail-resend-20261123/delivered.png.

Current checks: 88 API tests, 5 relay tests and 38 auth/recovery/login tests PASS;
production-config and runtime-split PASS. Local API build, targeted ESLint PASS.
Root production dependency audit and standalone relay audit: zero vulnerabilities.
Browser: empty login email/password -> recovery link with Enter -> independent
form; empty submit gives inline validation; offline error retains email and
enables retry; online retry shows disabled controls/loading then neutral success.
390x844: no horizontal overflow, long email stays within field; keyboard focus
and action checked. Screenshots captured and visually inspected. Browser access
temporarily timed out during builds and recovered after build completion.
One copy defect found: shared network feedback said to retry login. Optional
network message now lets recovery say to retry the request; 38 tests PASS. Final
web-only build/types/deploy and browser offline recheck PASS. No shared default
or other flow changed. Temporary offline/viewport overrides were reset.
Existing global network toast clips at the right edge at 390px; the recovery form
itself fits. Shared toast layout was not changed in this task; recorded as an
adjacent UI limitation, not a claim of whole-product mobile acceptance.

Server: API/web/relay activated and ready; database schema hash unchanged, no
migrations run. CRM, Caddy and all non-target container identities preserved.
API remains on its internal network, relay has no published ports. Private mail
configuration is mode 0600. Live unknown-email recovery returned 201/PROVIDER
with an 11-second neutral time budget. Login and recovery pages returned 200.
Auth links use the correct HTTPS Market origin; local-file delivery is disabled.
Initial mail deployment images: API 10a27d333644, web 0bda67c51611, relay d320def0973d.
Final web copy correction: 93ada8870802; API/relay and other processes preserved.
Previous API/web references and configuration backup are in the private activation
receipt; rollback restores those images without touching data volumes.
Build attempt 1 selected an uncached docker-container builder and was cancelled;
attempt 2 rejected mismatched Docker context; attempt 3 used bundled buildx and
API and web image builds passed (including types and 51 pages). New private local configuration
files use an explicit owner ACL via icacls; copying ACLs with Set-Acl failed and
was not treated as success.
Build logs and provider attempt marker are in ignored .tmp/auth-mail-resend-20261123.

Local activation initially waited for owner permission to restart API 4012.
The owner subsequently approved; activation and checks are recorded below.
Do not rerun the delivered test mail. Reuse backend checks unless mail/config
inputs change; recheck only the copy correction after its web deployment.

Source scope: mail/config helper and tests, recovery route and login link,
optional recovery network message, standalone SMTP relay/Compose overlay, docs.
No Prisma or commerce changes. Mixed personal-purchase/calendar/order WIP remains
outside this task and is excluded from the commit. Stand artifacts were derived
from the previous accepted stand archive with only the task delta; they do not
publish the unrelated local UI/domain WIP. Git/CI outcome is reported separately.

## Continuation: local SMTP and CI

Owner approved restarting local API 4012. Prior result: server SMTP delivered and
browser recovery accepted; new evidence: CI schema test still rejects a short
existing password although credential verification accepts any nonempty password
and checks its hash on the server. Minimal delta: correct the stale schema test,
retain empty/oversized/forged-input rejection, and activate the prepared local
SMTP runtime without running migrations or changing delivery configuration.
Checks: schemas suite, API registration-email credential tests, live local
health/options/unknown-email request, relay TLS authentication (no extra mail),
then task-only commit/push and actual CI result. Preserve existing server PASS.

Local activation PASS: API 4012 and loopback-only relay 8091 are running from
this source root with separate dev relay authentication. The ignored bootstrap
.tmp/auth-mail-resend-20261123/start-local-mail.mjs preserves the existing CDEK
sandbox profile and uses a runtime snapshot that refuses pending migrations.
Read-only preflight found zero pending migrations; no migrations or data edits.
API readiness and client options PASS (PROVIDER, local-file delivery disabled).
Unknown-email request: 201/PROVIDER in 11077 ms. Relay authentication boundary
and Resend TLS authentication PASS without sending another test message.
Browser dev recovery: loading followed by neutral success, retained input;
screenshot captured and visually inspected at
output/auth-mail-resend-20261123/dev-smtp-ready.png (outside Git).
Schemas: 60 files / 468 tests PASS; server registration-email: 17 tests PASS,
including wrong-password denial and lockout. Targeted test ESLint PASS.
Only the stale credential test changed; new-password requirements are unchanged.
No server redeploy is required for this test-only correction. The new commit's
CI result is recorded separately after publication; previous failed run is not PASS.

CI continuation: run 45121573042 passed the corrected schema test, then exposed
an existing shared password-control icon barrel import (controls.tsx), rejected
by buyer performance-boundaries.test.ts. Minimal delta: use the existing package's
svg/eye and svg/eye-off entry points for the same two icons. No markup, styles,
password policy or interaction changed. Focused boundary/password-control tests
and shared UI types validate this correction; CI validates the full consumers.
Boundary tests 3/3, password-control tests 3/3 and shared UI typecheck PASS. Rendered SVG markup is identical for both imports; component-reference identity differs because the package builds separate entry points. No visual or behavioral delta.

Run 45122948438 passed the icon boundary but then failed the older quantity-input
test: it inspected DmInput's immediate React element, which became an InputControl
wrapper when password visibility was added. Actual numeric input behavior is
unchanged. The test now renders through that wrapper and observes the underlying
input props, retaining validation, controlled value, event identity and sizing
assertions. Check all shared UI tests, types and lint before the next CI run.
Shared UI: 32 files / 144 tests PASS; final quantity mock adjustment 2 tests PASS,
ESLint PASS and shared UI types PASS. Initial native-input mock was rejected by
the lint rule and replaced by a props observer returning null.
Broader local npm test hit a module-load timeout; sequential Turbo then passed
10 workspaces but failed two admin restoration tests because unpublished
api-client/order-payment.ts imports schemas before their held/rejected mock.
That module is unrelated local WIP and absent from HEAD; do not publish or change
it for this task. Clean GitHub CI remains the acceptance check for published code.

Run 45124887682: all unit tests, types, lint, builds, JS budget, API/runtime/config,
PostgreSQL and Security PASS. Pilot browser suite: 120 passed / 3 failed due to
old registration expectations (Continue label, pale role selection, removed
newsletter checkbox). Owner-requested current form uses Create profile, strong
selection and registration terms link. Align those E2E expectations; retain
validation/focus checks, test keyboard role switching and terms link instead of
the removed checkbox. No product code change. Clean CI is the browser gate;
local canonical suite would conflict with the owner's active dev ports/profile.
