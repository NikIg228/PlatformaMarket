# STAND-LOGOUT-20261123

Owner scope: fix logout and update the existing limited server stand, then verify
in Chrome. No schema/data migration, API rollout, CRM changes or gate exemption.

Prior logout receipt/target isolation -> live POST `/api/auth/session-logout`
returns 401 `STAND_ACCESS_REQUIRED`, no Cookie header while workspace reads are
200 -> change fetch credentials from omit to same-origin. The server still uses
the explicit signed body proof, never ambient cookies, to select the session.

Risk: authentication, cross-tab identity and shared-host deployment. Checks:
focused client/session-store/API proof tests, stand gate tests, client types,
web image build/types, browser logout receipt/redirect/reload after rollout.
Use the previously deployed source artifact plus this exact delta for the image;
do not include unrelated current WIP. Preserve API/worker/DB/CRM process identity.
Keep the previous pinned web image and configuration for rollback.

Applied incident playbook: read-only diagnosis first, scoped web-only recovery,
no protection bypass. UI appearance unchanged; visual redesign gates not applicable.
Verification so far: 32 client/session-store tests, 15 server proof tests,
11 stand-gate tests, client TypeScript and scoped ESLint PASS. The 47 auth tests
and client types also pass against the deployed-version Linux build image with
only the two changed client files mounted. No database fixtures were mutated.

Build provenance: `.tmp/stand-logout-20261123/source-manifest.json` verifies every
baseline archive file against the existing deployment manifest; exactly the
logout source and its test differ. Baseline web image is
`sha256:13d4d10678306711d7ab2bfd2c3da1a5f33293e7794c9343abfa79f290aecf2a`.
First build attempt failed before execution because Docker interpreted an
uncompressed archive as a Dockerfile. Gzip transport fixed archive detection;
the second build passed (production build, TypeScript and all 50 static pages).
The compiled browser bundle contains the same-origin logout request with both
sessionId and accessToken. No assertion or application gate was weakened.

Current server profile is the CDEK limited stand, not the older November 6 path.
Read-only preflight captured all eight Market container IDs/start times, five
CRM/Caddy service identities and the Caddy configuration hash. Rollout will change
only WEB_IMAGE using the current two Compose files and `--no-deps web`.
Deployment: web image
`sha256:b992b62cf71ac037a335aeec279767582dc7c5d849cf2cf0633f3c6867e1e237`
loaded and activated. Internal login readiness PASS. Other seven Market
containers, all five CRM/Caddy service identities and Caddy hash unchanged.
Previous pinned image/configuration retained for rollback. No migration run.

Chrome acceptance on the original failing supplier tab: refreshed to load the
candidate, clicked profile menu -> Выйти, observed POST `/api/auth/session-logout`
201 and redirect to `/login?signedOut=1`. Opening `/supplier` again redirected to
`/login?signedOut=1&returnTo=%2Fsupplier`; no restored workspace. Screenshot saved
and visually inspected at `output/stand-logout-20261123/signed-out.png`.
The response body was unavailable to CDP after navigation; do not claim a captured
receipt body. The client only redirects after validating its target receipt, and
the subsequent protected navigation also confirmed the signed-out state.

Scope acceptance PASS: the reproduced stand-gate logout failure is fixed. Tests
and browser evidence are scoped to this hotfix, not whole-product certification.
Full release suite and unrelated UI redesign/mobile matrices were not rerun for
this transport-only delta; current stand appearance and other flows are retained.
