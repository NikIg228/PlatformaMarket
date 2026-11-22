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

Local API is actively owned by start-cart-delivery-api.mjs; no stop/restart was
performed. Prepared a mail bootstrap preserving that launcher and asked for
permission under AGENTS. Local SMTP activation remains pending owner response.
Do not rerun the delivered test mail. Reuse backend checks unless mail/config
inputs change; recheck only the copy correction after its web deployment.

Source scope: mail/config helper and tests, recovery route and login link,
optional recovery network message, standalone SMTP relay/Compose overlay, docs.
No Prisma or commerce changes. Mixed personal-purchase/calendar/order WIP remains
outside this task and is excluded from the commit. Stand artifacts were derived
from the previous accepted stand archive with only the task delta; they do not
publish the unrelated local UI/domain WIP. Git/CI outcome is reported separately.
