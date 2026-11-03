# PlatformaMarket: runtime, infrastructure and mobile audit evidence

Date: 2026-11-03. Status: source review and environment inventory complete;
runtime/native acceptance remains partially NOT_RUN. This is a supporting audit
artifact, not a new roadmap or a production acceptance certificate.

## Version and scope

- Canonical root: `C:/Users/user/Desktop/dentmarket-kz-main`.
- Main revision: `4543fd22c92464bb72fe75a627bb225adb921fde`.
- Main dirty inputs: `actual_docs/governance/task-state/PRIMARY-SESSION.md`,
  `apps/web/AGENTS.md`, existing untracked `output/` materials. Preserved.
- Coordinator's new `comprehensive-audit-20261103.md` appeared during review.
- This reviewer writes only this document. No product/config/dependency changes,
  checkout, installation, test, migration, build, publication or deployment.
- Current user direction: Yandex Cloud is the target; resources and region are
  not selected by this audit. Existing Compose limits are not approved sizing.
- Source paths below are relative to the canonical root unless prefixed with a
  Git ref. Main paths refer to the revision above; mobile paths refer to the
  explicitly named branch revision below, not the current working tree.
- Owner freeze was confirmed by the coordinator during preparation. The
  coordinator subsequently reported authorized dev stop and pilot build attempt
  1 in progress. This report does not claim that build passed.

## Commands and environment evidence

Read-only probes: `git status --short --branch`, `git rev-parse HEAD`,
`git branch -a`, `git ls-tree`, `git show`, `git grep`, `rg`, `Get-Command`,
known-path `Test-Path`, `node --version`, `npm --version`, `wsl --list --quiet`,
and WSL `command -v`/`uname`. No application or diagnostic suite was run here.

| Probe | Result and limit |
| --- | --- |
| Windows Node | `v24.18.0` |
| Windows npm | `12.0.1`; package.json declares npm `11.16.0`, engines permit >=11; reproducibility difference, not proven failure |
| Windows Docker | Not in PATH; standard Docker Desktop binary path absent; `docker version` could not run |
| Android tools | adb/emulator/java not in PATH; default user Android SDK and Android Studio JBR paths absent |
| Xcode | xcodebuild not in PATH; Windows host cannot establish iOS build acceptance |
| WSL | Ubuntu registered and reachable; Linux `6.18.40.1-microsoft-standard-WSL2` |
| WSL tool PATH | `command -v docker/node/adb/java/emulator` returned no paths |
| Other installations/devices | Not exhaustively enumerated; absence from checked paths does not prove absence everywhere |

A broad recursive untracked binary search was stopped as disproportionate; it
produced no usable binary inventory. It must not be cited as proof that no APK
exists. Its owned shell ended. No persistent reviewer-owned processes remain.

## Mobile inventory

`origin/codex/mobile-max` is locally available at
`6d2e8c9a2a13816e78384468c5acedd8c2a7579c` (2026-11-02).
Merge-base with main is `ffddb740c24c140cfe8301214f741099ea2526ba`;
`git rev-list --left-right --count HEAD...origin/codex/mobile-max` returned
`87 2`. This is the local remote-tracking ref, not freshly verified remote state.
It was read without checkout or creating an alternate source copy.

| Surface | Source evidence | Acceptance status |
| --- | --- | --- |
| Main web | `apps/web`, imported buyer/supplier/admin/landing features | Adaptive browser surface exists; native equivalence not established |
| Native Expo app | Branch `mobile/market/package.json`, `index.ts`, `src/NativeMarketApp.tsx` | Source exists; package version 0.0.0, Expo58.0.21/RN0.88.1/React19.3.0; current build/install NOT_RUN |
| Android project | Branch `mobile/market/android/` including Gradle wrapper, manifest and Java/Kotlin entrypoints | Source exists; store release not ready from inspected configuration |
| iOS project | Branch `mobile/market/ios/PlatformaMarket.xcodeproj`, workspace and Podfile | Source exists; build/device/store acceptance NOT_RUN |
| Kotlin/Swift read cores | Branch `apps/market-android`, `apps/market-ios` | Projection/store/test sources, not proof of full native app behavior |
| Shared mobile contract | Branch `contracts/mobile-read/` | Fixtures, scenarios, schema/adapter/tests and source anchors |
| PWA | No dedicated main service worker/webmanifest found in scoped source-name/content inventory | PWA install/offline capability not established; adaptive web is not PWA acceptance |
| Binary packages | No APK/AAB/IPA in tracked branch inventory | Local untracked binary search incomplete; branch documentation mentions an older APK |

Native entrypoint `mobile/market/index.ts` registers `NativeMarketApp`.
`src/NativeMarketApp.tsx:27-56` supplies Expo fetch, configurable normalized API
address, a session controller and AppState foreground recovery. The source is
more than an injected-session preview. `src/market-session.ts` contains
auth/current/login/MFA/handoff/workspace-context/logout and BUYER command
bindings. Credentials are held in memory; cookie transport is used for session
entry/refresh. Device cookie-jar behavior is not proven by this source review.

The branch's `BACKEND_CONNECTION.md:30` explicitly says the old APK does not
match all newer source changes and a fourth iOS attempt was not performed.
This is historical evidence of limits, not a newly executed build result.
Attempt counters and the former iOS blocker must be recovered before any retry.

### Mobile coverage and remaining checks

| Category | Source evidence / current boundary | Remaining measurable verification |
| --- | --- | --- |
| Auth and storage | Session controller; Expo cookie transport; no SecureStore/AsyncStorage references found in reviewed src/package | Device login/refresh/revoke/logout, cookie path/isolation, cold start, no plaintext credential persistence |
| Navigation and links | Native screens and recovery exist; Android Activity has launcher intent only | Inbound bank/signature callback, foreign-tenant deep link denial, back/foreground consistency |
| Keyboard/safe area/orientation | SafeAreaProvider/App, ScrollView keyboard handling; orientation default | Actual Android/iOS keyboard, rotation, large text, screen reader and safe areas |
| Network/offline/recovery | Unknown-command recovery and foreground session source exist | Disconnect before/after commit, process kill, explicit retry with same identity, no duplicate money/order |
| Push | No notification SDK/handler references found in scoped src/package search | Selected provider/device push, background routing and permission denial; requirement/provider still to reconcile |
| Files/camera/microphone | No camera/document-picker package in inspected package.json; attachment UI exists | Native file selection/access/download and denied permission behavior; distinguish metadata display from upload |
| Payments/EDS | Source binds buyer workflow/manual transfer and archived documents; no live provider acceptance | Sandbox bank return, lost callback, same session recovery, original hash/authority/replay checks |
| Locale | `src/format-wire.ts:1` defines only ru/kk | RU/KK real device and long strings; EN scope decision/coverage separately |
| API compatibility | Branch diverges from main by 87/2 commits | Reconcile source anchors with current main schemas/routes before declaring compatible |
| Stores/update | Local IDs/version0.0.0, Android debug release signing | Approved IDs, production signing, update compatibility, privacy/listing/review credentials and submission evidence |

Main specification §25 (`UNIFIED_SPEC_MARKET_REQUIREMENTS_2026-10-29.md:915-931`)
records earlier inspected revisions. Add this newly located branch as a dated
fact; do not rewrite earlier inspection history or label native work absent.
No whole CRM audit was performed.

## Findings register contribution

Severity refers to the present evidence and consequence; priority can change
after production configuration or exploitation validation. None of these rows
claims a confirmed critical/high exploitable vulnerability.

| ID | Type / severity / status | Evidence, expected vs actual | Recommendation and acceptance |
| --- | --- | --- | --- |
| AUD-MOB-01 | Release gap / High release priority / confirmed source | Mobile branch `android/app/build.gradle:120` signs release with `signingConfigs.debug`; app.json/build.gradle use local app ID and version0.0.0. Expected an approved release identity/signing setup before publication | Keep out of store release; separately approve IDs/signing then verify signed AAB/IPA identity and upgrade installation; no signing secrets in repository |
| AUD-MOB-02 | Integration gap / Medium / confirmed Android configuration; end-to-end unverified | Android main manifest Activity has only MAIN/LAUNCHER, no VIEW/BROWSABLE callback. HTTPS queries permits external lookup, not inbound app callback | Define approved bank/EDS callback binding; test safe return, unknown outcome and foreign tenant denial on device. Do not infer iOS absence: Info.plist contains CFBundleURLTypes |
| AUD-MOB-03 | Evidence/version gap / High release priority / confirmed | Branch BACKEND_CONNECTION.md:30 says older APK differs from current sources; native paths not in main; current build/device test NOT_RUN | Versioned native build + install + API compatibility matrix required. Source/Jest/mock results cannot substitute |
| AUD-INF-01 | Build-context data exposure risk / Medium / source confirmed; image unverified | `Dockerfile:22` COPY . .; `.dockerignore:18` excludes outputs, not output. Runbook claims temporary evidence/session files excluded. Current output contains stand/audit materials | Exclude intended diagnostic trees in a later product/config task; acceptance: synthetic canary in output excluded from build context/image, required public assets retained |
| AUD-INF-02 | Hardening debt / Low / confirmed source | No USER in Dockerfile and no user in production compose; Node base default user not overridden. Existing read_only/cap_drop/no-new-privileges mitigate impact | Evaluate least-privilege runtime user and writable mount ownership; accept with image startup, storage, migrations and graceful-stop tests. Not a standalone exploit |
| AUD-INF-03 | Startup ordering hypothesis / Medium if reproduced / requires test | `compose.production.yaml:19` API migrates at startup; worker service has no migration/API dependency. `worker-bootstrap.ts:14-16` creates app/consumers before readiness snapshot | Test worker + API start against pending migration in disposable DB. Confirm no work on incompatible schema, bounded recovery, no duplicate jobs. Restart policy may mitigate; not yet a defect conclusion |
| AUD-INF-04 | Diagnostic safety limitation / Medium / confirmed source | `verify-backup-restore.mjs:31-34` falls back from test URL to DATABASE_URL/local marketplace; :455 permits default local storage source. Audit requires isolated data | Always inject verified test source and synthetic object fixture for this audit. Future script hardening proposal: reject ambiguous source. Do not execute against working DB/files |
| AUD-INF-05 | Production evidence gap / High release priority / NOT_RUN | No current Linux container, managed PITR, cloud alert/restore or native device evidence collected by this reviewer | Execute on authorized isolated targets; provider production acceptance remains open until actual target environment tested |

### Safe build-context recheck

Only filenames/counts were inspected; stand/audit payloads were not read.
`rg --files output` excluding png/jpg/jpeg/webp/zip returned 88 files (this is
an enumerated nonbinary subset, not total context size). Examples:
`output/CRM_ALERT_COMPONENTS_SPEC_2026-11-02.md`,
`output/roadmap-coverage-review-20261029.md`,
`output/stand-access-20261029/tests.txt`,
`output/stand-access-20261029/stage-market.mjs`.
These example paths match none of the inspected .dockerignore patterns; Git
untracked status does not exclude a local Docker build context. The rule
excludes `*.log`, so not every output file is necessarily included. No image
was built and no secret-bearing contents were asserted. AUD-INF-01 is an
inclusion-policy finding, not a claim of an actual leaked credential.

## Runtime and test inventory

| Area | Existing paths / prerequisites |
| --- | --- |
| Build | Root package.json, turbo.json, Dockerfile; schemas/API/client/unified web build graph |
| CI | `.github/workflows/ci.yml`: Ubuntu PG17/Redis7, unit/types/lint, pilot browser, scoped go_live, PG/security/config, API/web image build without push |
| Runtime | `compose.production.yaml`, `apps/api/src/bootstrap.ts:30`, `worker-bootstrap.ts:14-21`; role separation and shutdown hooks |
| Test DB safety | `scripts/with-test-database.mjs`, `scripts/lib/test-database-profile.mjs`; explicit local separation and constrained hosted-CI exception; E2E occupied-port rejection |
| Restore | `scripts/verify-backup-restore.mjs`; new dentmarket_restore_drill_* DB, ownership marker, checksum/data/sequences/migrations/objects/API comparison |
| Production restore tools | `backup-production.sh`, `restore-production.sh`, `verify-restore-drill.sh`; destructive restore is not a normal audit command |
| Load | `verify-load-profile.mjs:17-63,430-465`; new dentmarket_b46_* DB, migrate and synthetic seed; default300 reads/20 write flows/60s soak |
| Multi-instance | `verify-load-multi-instance.mjs`; two API processes and ephemeral RedisMemoryServer; binary availability prerequisite |
| Operations docs | `operations/production-deployment.md`, `backup-restore-runbook.md`, `production-auth-runbook.md`, `observability-runbook.md`, `b4-6-load-profile.md` |

## Remaining execution plan (coordinator owns execution)

Avoid duplicate builds hidden in npm aliases. Underlying commands are equivalent
only after all alias prerequisites are recorded as passed on unchanged inputs.
Never run Next build/typegen concurrently with dev for the same .next directory.

1. Finish shared baseline types/lint/unit and schemas/API/unified web build once.
   Coordinator reports pilot build attempt1 started; this document does not
   supply its outcome. Record profile and artifact hashes before browser reuse.
2. Run focused script contracts:
   `node --test scripts/postgres-tool-invocation.test.mjs scripts/production-readiness.test.mjs scripts/frontend-deployment-profile.test.mjs scripts/local-development-profile.test.mjs`.
   Frontend profile contracts require built schemas.
3. With built API and individually verified env/DB preflight, run
   `node scripts/verify-production-config.mjs`,
   `node scripts/verify-runtime-split.mjs`, and
   `node scripts/verify-pilot-composition.mjs`.
4. PG/core/pilot backend: use existing test DB wrapper and corresponding scripts,
   not ambient DATABASE_URL. Coordinator reports verified database identity
   `dentmarket_audit_20260914`, schema public, PG17.10, latest migration. This is
   coordinator evidence; this reviewer did not independently query the database.
5. Restore: built API, PostgreSQL client, explicit POSTGRES_TEST_DATABASE_URL,
   dedicated RESTORE_DRILL_ADMIN_DATABASE_URL and
   RESTORE_DRILL_USE_OBJECT_FIXTURE=true. Run
   `node scripts/verify-backup-restore.mjs` after tool invocation contract test.
   Source must be disposable/quiescent; never clone the working DB.
6. Load: built schemas/API, dedicated B46_ADMIN_DATABASE_URL, verified local DB
   identity and private object directory. Run `node scripts/verify-load-profile.mjs`
   with default bounded profile before larger measurements. Record hardware,
   data volume, p50/p95/errors, DB connections and query plans. Existing default
   thresholds are test criteria, not Yandex production capacity promises.
7. Multi-instance: prove ephemeral Redis binary available; then
   `node scripts/verify-load-multi-instance.mjs` against disposable DB. Record
   shared rate-limit/recovery behavior; do not alter working Redis.
8. Container/Linux: Docker availability currently blocked. When a permitted
   isolated runner is available, build API/web without publishing, validate
   compose/Caddy, run pending-migration startup race, shutdown and restore.
   Do not install cloud infrastructure or buy resources automatically.
9. Native: cannot execute branch source from absent main paths without an
   approved canonical-folder Git operation or other owner-approved setup.
   No alternate worktree/source copy, dirty checkout switch or branch merge.
   Recover earlier iOS attempts; verify actual Android/iOS build tools and
   devices, then compile/install/version-check and execute the mobile matrix.

Every run needs attempt count, exact command, revision/dirty inputs, profile,
fixture identity, duration and PASS/FAIL/NOT_RUN. Default Workflow budgets:
probe2min, startup5min, command20min, full suite45min; maximum3 attempts with
new reasons and no repeat of unchanged passing suites. Cleanup only owned
processes/test targets. Final production admission and Yandex resource sizing
remain open until the actual selected environment is measured.
