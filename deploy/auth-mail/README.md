# Market auth mail through Resend SMTP

The relay accepts authenticated JSON `{to, subject, text}` at `/send`, fixes the
sender to `Platforma Market <no-reply@notify.platformamarket.kz>` and connects only
to `smtp.resend.com:465` with certificate verification and TLS 1.2 or newer.
No attachments, HTML, arbitrary headers, host overrides or automatic retries.
SMTP acceptance is not proof of inbox delivery; verify the provider delivery log.

Create a Resend Sending access key restricted to the verified Market subdomain.
Keep `RESEND_SMTP_PASSWORD` and a separate random `AUTH_MAIL_RELAY_TOKEN` in private
runtime files, never images/Git/logs. The API receives only the relay token.
For the limited stand use `compose.auth-mail.yaml` after existing Compose overlays,
with `AUTH_MAIL_IMAGE` and `AUTH_MAIL_API_IMAGE` pinned to verified images, and private files:

- `auth-mail-relay.env`: `RESEND_SMTP_PASSWORD`, `AUTH_MAIL_RELAY_TOKEN`.
- `auth-mail-api.env`: same `AUTH_MAIL_RELAY_TOKEN`,
  `AUTH_MAIL_RELAY_URL=http://auth-mail-relay:8091/send`.

Only the relay joins the external network. API/worker and other limited-stand
outbound restrictions remain unchanged. `EMAIL_PROVIDER_*` remains forbidden on
the limited stand; the new configuration enables auth mail only. Do not enable
local-file delivery at the same time. For local testing bind the relay to loopback
with `RELAY_HOST=127.0.0.1` and use its loopback `/send` URL.

The overlay updates only the API image; workers keep their existing image. Its
command starts the API without migrations because this change has no schema delta.
Use this overlay only with the corresponding unchanged database schema.

Build with `docker build -t <tag> deploy/auth-mail`; tests:
`node --test deploy/auth-mail/relay.test.mjs`. Rollback restores the previous
API/web image references and excludes the auth-mail Compose overlay; stop only
the new relay after the application rollback. Never delete shared data volumes.
