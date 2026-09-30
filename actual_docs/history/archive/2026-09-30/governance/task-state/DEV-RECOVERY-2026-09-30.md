# DEV-RECOVERY — 2026-09-30

Owner: side conversation 01a0ee6a, explicitly authorized by user annotations
to implement API stability, transient GET recovery and consistent local DB setup.
Canonical main@646dab585eda96bb21c994b92c611fbf13e56179; 138 existing dirty paths.
Other project threads inspected idle. Preserve all prior WIP. No deletion/reset
of databases, no changes to other processes, no unrelated publication.

Evidence: dev-catalog-20260929.log and Next dev log show repeated Nest watch
compilations and ECONNREFUSED:4012 around 00:30; API resumed 00:31:41.
Guest current session now HTTP200/null, public search HTTP200 total50.
Watcher trigger file not identified. Default launcher currently runs Nest watch.
Running dev uses audit DB and explicit demo buyer ID; default launcher uses
marketplace and missing hardcoded public organization ID. marketplace has505
products/510offers/14users/34migrations; audit633/633/297/36migrations.

Plan: bounded GET retries with cancellation (no write retries), clearer session
failure; stable compiled API by default with explicit watch option; local DB
configuration/readiness and repeatable non-destructive preparation using existing
seed profiles. Backup before approved local schema/data preparation. Dedicated
test DB remains separate. No production/remote DB operations.

Gates: focused GET regression, local runtime/profile checks, typecheck, unit,
affected build, read-only runtime guest/catalog/login-back smoke; test DB only
for fixture writes. Budget45min, each command20min, max3 attempts per gate.
Implementation: resilient-get + cancellation tests; header/cities/catalog use it.
Header recovery on online/BFCache, service-unavailable text. Supplier add-to-cart
guards missing organizationId (preexisting type failure in user's affected flow).
Dev builds stable API by default, --watch-api explicit. Local DB profiles,
readiness, backup/migrate/non-destructive prepare/accounts, isolated test wrapper.
Canonical postgres/pilot/core-contract/web checks now use test wrapper.

Preparation run1 PASS: readable1.47MB backup at ignored
.tmp/local-runtime/dev-before-prepare-1790711005535.dump; both pending migrations
applied to marketplace;505products preserved,3new dev users; audit untouched.
Owned API4112 launched for read-only validation (session74948, child9468).
Health200, guest200/null, catalog200 total54. Main dev3000/4012 untouched.
User approval requested before replacing the other executor's running dev.

Checks: focused GET13/13 PASS; node local profile/runtime6/6 PASS;
verify:local-profile5/5 PASS; typecheck attempt1 failed existing missing
organizationId narrowing in supplier-offers, fixed; attempt2 PASS13/13.
npm test attempt1:11/12 tasks, buyer fails tabster/createTabster import and
order-profile timeout. Focused repeat2: order-profile2/2 PASS; same tabster
import failure. Stop repeated test attempts; do not weaken or silently fix
unrelated dependency/test config. No commit/push while gates blocked.
Browser CLI owned session devrecovery; skill Playwright and Agency Frontend
Developer/Backend Architect practices applied.

Scoped browser PASS: guest catalog -> supplier modal -> login -> browser back
returned to catalog with guest login link and cards. Injected two503 auth and
two502 catalog failures recovered on exactly third GET each. No login submitted,
cart writes or user identity modifications. First run-code invocation failed due
Windows npm quoting; second selected older cached CLI (session not found); third
used the current CLI entrypoint directly and passed. No further attempts.
Read-only DB verification:505products/510offers unchanged, users14->17; all3
new accounts verified, stored passwords match hashes, active role membership.
Normal git diff --check PASS (an autocrlf=false diagnostic was invalid for this
CRLF checkout; no line-ending cleanup made). Script syntax checks PASS.
Owned browser devrecovery closed; owned API9468 stopped, port4112 released.
Existing3000/4012 remain untouched. Full build/web not run: current dev belongs
to another executor, restart approval pending, unit tabster blocker unchanged.
No commit/push; task remains PARTIAL until stable launcher switched and accepted.

## Authorized restart and credentials — 2026-09-30

User explicitly approved restarting dev and requested clinic/supplier credentials.
Verified old launcher14912 and both listener descendant trees, then stopped only
that tree (3000/4012) with taskkill/T. Other project processes untouched.
Stable startup attempt1 failed EPERM during Prisma generation: launcher had
already loaded the native DLL via readiness queries. Reordered API generation/
build before schema/data queries; no schema or business changes.
Attempt2 PASS, running exec session25156; log
outputs/unified-application-20260928/dev-stable-20260930-retry.log.
API built successfully; stable API + unified web now use marketplace and detected
demo BUYER. Runtime probes all HTTP200: health/ready, guest auth/current=null,
catalog total54/items1, login. Launcher performs real catalog readiness.
Script syntax and normal git diff --check PASS. No whole-suite rerun for this
launcher ordering fix; prior tabster unit blocker remains, no commit/push.
User-requested two synthetic account credentials supplied directly in chat,
never copied to tracked docs. Account file remains ignored local-runtime JSON.
