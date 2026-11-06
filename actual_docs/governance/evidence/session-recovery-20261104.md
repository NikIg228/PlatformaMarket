# Цикл 4 — сессии и восстановление входа

Статус: BROWSER_BLOCKED, реализация подготовлена, приёмка не закрыта. Владелец04.11 подтвердил исходный список циклов:
цикл4 = FE-SESSION/B029/FE-REG; платежи относятся к циклу5 и не начаты.
База main@b3fdb44b; сохранить staged/unstaged WIP циклов1/2, apps/web/AGENTS,
общие документы и output. Разрешён только этот цикл, без агентов.

## План до реализации

- FE-SESSION: проверить receipt отзыва, очищать/перенаправлять только ожидаемую
  сессию A; поздний ответ A не затрагивает B. Shared UI consumers проверить.
- B029: проверять инвариант оставшегося способа входа и удалять в одной
  транзакции с сериализацией по пользователю; не расширять политику удаления
  последнего social identity на основании наличия password.
- FE-REG: отдельный защищённый путь исправления email незавершённой заявки,
  сохранение реквизитов/consents/BIN, подтверждение нового адреса, без второй
  организации и обхода чужой/истёкшей/завершённой регистрации. Сначала общий
  API contract, затем backend/client и необходимый UI recovery.

Риск высокий: auth/session identity, присвоение регистрации, конкурентные
запросы, одноразовые письма. Проверки после каждого backend перехода: focused
tests; завершение: affected/dependent suites, types/build, isolated PG
concurrency/rollback/tenant, core-contract при новой операции, runtime-split,
целевой browser desktop/mobile/keyboard и screenshot/computed styles.
Обычные таймауты Workflow: probe2мин/start5мин/build20мин/suite45мин,
максимум3 попытки на gate с сохранением FAIL. Рабочая БД и live email/social
providers не используются, dev остаётся OFF. Новая миграция пока не требуется.

Antislop DURING — прежний выбор владельца в этой сессии. Исправление текущих
flows, без редизайна/assets; существующие shared Dm controls и tokens.
Паспорт UI и результаты будут дополнены после сверки contracts/current screen.

## UI basis and authorized browser blocker

First frontend3300 launch rejected by automatic review: `blocked by policy`,
no detailed reason. No alternate launch/retry. Owned SSR fixture14088 stopped.
Owner explicitly answered: «Да, подготовить UI; приёмку не закрывать» to request
to prepare UI from source/contracts without pre-change live screen. Thus browser
baseline and acceptance remain BLOCKED, not waived PASS.
Scope: admin settings SessionManagement, register completion and inline correction.
Basis b3fdb44b; component-contract market-components-v1, semantic-light
platforma-semantic-light-v1. Existing shared DmField/DmInput/DmButton/AuthNotice;
controls44px/radius8, Manrope14/line1.5, spacing8/16/24, semantic brand007A59,
text17201E, surface white/subtle. Existing authUtilityCard/registrationActions
and mp-stack composition; no new CSS/overrides/assets/shell geometry. Planned
viewports1440x1000 and390x844, scale1, RU and KK-route parity. ENERGY1/RHYTHM1/
MOTION1: existing calm forms with one primary send action. Runtime values are
NOT measured yet; source/token passport is not screenshot acceptance.

## Current checks

B029 focused14 PASS1. Correction-focused42 PASS1. Schemas9 PASS1/build1PASS.
API types1/build1PASS (Prisma generate; no schema change). Client6 PASS1.
All identity suites171 PASS1. New `npm run db:test -- exec -- node
scripts/verify-session-recovery.mjs` PASS1: realPG two-connection unlink, one
remaining identity, targeted session revoke/audit, rollback; realHTTP/local-mail
correction, same user/BIN/consents, old/replayed/expired proof denial, login at
new address, claim rollback, concurrent single completion, failed delivery retry,
foreign password/address denial. Mail/server fixtures cleaned; no live providers.
Core command `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs
--contract-only` PASS1:71explicit/210success/302components. Pending UI checks,
dependent builds/types, fullPG/runtime/lint/review and final status. No commit/push.

## Completion checks, 04.11

- Admin navigation/admin-auth:14 PASS; shared receipt validation:6 PASS.
- Landing correction/auth-client:21 PASS, including duplicate submit lock,
  retained email after network failure/retry and local invalid-email rejection.
  Correction tests exercise component handlers with mocked React hooks, not DOM
  or browser acceptance. `.tmp/session-landing-tests-1.log`.
- UI/admin/landing types PASS1; landing types PASS2 after adding test source.
  Client build1 and landing build1 PASS. Logs `.tmp/session-*-types-*.log`,
  `.tmp/session-client-build-1.log`, `.tmp/session-landing-build-1.log`.
- `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs`
  PASS1; unchanged schemas/API builds reused as alias prerequisites.
  `.tmp/session-postgres-1.log`. Disposable DB, no working-data writes.
- `node scripts/verify-runtime-split.mjs` PASS1 with previously built unchanged
  API artifact: roles, entrypoint guards, production-all denial.
  `.tmp/session-runtime-1.log`.
- `npm run lint` PASS1, including UI-contract:475 files, no token/style drift.
  `.tmp/session-lint-1.log`.
- Admin build1 (including bundle budget) and unified web build1 PASS;
  `.tmp/session-admin-build-1.log`, `.tmp/session-web-build-1.log`.
  Unified build TypeScript passed. No frontend server was launched by builds.
- Unified `npm run typecheck --workspace=@marketplace/web` PASS1;
  `.tmp/session-web-types-1.log`. Only build-generated next-env route paths were
  restored to their original development paths afterwards; no product change.
- Final `git diff --check` PASS; prior staged and unrelated changes preserved.

Separate final source review (no delegation, per owner): reconstruct proof
binding/expiry/password denial, concurrent user lock, atomic claim rollback,
receipt schema/target binding, and expected-session guard. No additional
confirmed bypass or regression found in this scope. React review: event-based
submit, ref duplicate lock, stable client, existing shared controls and labels;
no new styles or dependencies. Admin is the SessionManagement consumer; unified
web imports the same surface. This does not replace runtime UI verification.

Antislop delivery status: BLOCKED, not PASS. Source checks find no fabricated
claims/assets, dead actions, new decorative treatment or local control overrides.
Declared dials1/1/1 and existing brand tokens retained. Mobile overflow, contrast,
focus/keyboard, visual consistency and click-through cannot be certified without
browser evidence. Owner authorized preparation only, explicitly keeping acceptance
open. Automatic review rejected frontend3300 launch (`blocked by policy`, no
detailed reason); no bypass or retry. No commit/push/deploy, dev remains OFF.

### Remaining acceptance, not executed

04.11 explicit owner request «попробуй заново»: attempt2 repeated the exact
original frontend command, without alternate tool/profile/port:
`$env:INTERNAL_API_URL='http://127.0.0.1:4129/api'; npm exec --workspace=@marketplace/web -- next start --hostname 127.0.0.1 --port 3300`.
Port3300 preflight was free. Tool rejected before process creation:
`CreateProcess ... rejected: blocked by policy`. No detailed reason returned.
No frontend or fixture started, no browser run; no further retry or workaround.
This confirms two rejected launches, not a diagnosis of permanent environment
failure. Browser acceptance remains BLOCKED; previous PASS inputs unchanged.

04.11 owner «приступай» authorized Feedback submission. Sent through the desktop
app's / -> Отзыв, category «Проверка безопасности», with exact command, two
denials, environment facts and a request for the responsible policy/supported
resolution. All three attachment options (documents/diagnostic logs/browser tabs)
disabled. UI confirmed «Отзыв отправлен»; feedback ID:
`01a16825-8a4d-75a1-a457-bba2416c518f`. No response or policy resolution yet.

After the frontend launch policy block is resolved, use an approved isolated
frontend/API fixture, not the working database. Verify registration -> correction
-> local-mail proof -> same organization/BIN/consents, failed-delivery retry,
invalid/occupied/expired address feedback, cancel without losing the pending
registration, and double-submit. For admin, hold valid revoke-A response, replace
synthetic storage with B, release A: B remains and no redirect; same-A control
clears and redirects, wrong receipt leaves session intact. Check1440RU/390KK
routes, keyboard/focus, screenshots/computed tokens and absence of overflow.
No new launch attempts are authorized by this checklist itself.

## Возобновление A04 после A05 — 04.11

Владелец явно разрешил начинать A05/A04 после объяснения двух блокеров.
A05 закрыт локально, commit5161af7, прежний outgoing не опубликован. A04:
одна следующая попытка3 того же frontend command/port3300 через тот же tool.
Порты3300/4129 свободны; API/web processes предыдущих проверок завершены.
При новом отказе automatic review — остановить launch, без другого tool/port.
Source UI не менялся после build04.11 13:29; прежние types/build/component/PG
доказательства сохраняют свою границу. Новая задача — браузерная приёмка.

Plan: разрешённый isolated API fixture4129, реальные local-mail registrations
и correction в браузере; синтетические ответы для детерминированной гонки
отзыва A→B и invalid receipt. Viewports1440x1000 RU /390x844 KK-route,
keyboard/focus, screenshot/computed geometry/font/colors/overflow. API guards
не отключать, working DB и внешние каналы не использовать. В production build
browser rewrite baked4012, а INTERNAL_API_URL задаёт4129; тестовый browser
transport направит /api только в owned fixture4129, без обращения к4012.
Это граница fixture transport, не проверка production proxy-конфигурации.
Бюджет launch5мин/browser20мин, до3 попыток gate; UI redesign/новые assets вне scope.

Attempt3: повторён точный command с INTERNAL_API_URL4129 и next start3300.
Automatic review снова отказал до CreateProcess: `rejected: blocked by policy`,
без подробной причины. Процесс frontend не создан; fixture4129 не запускался.
Никаких browser runs/screenshots/computed styles и альтернативного запуска.
Три отказа сохранены; счётчик не сбрасывается сменой tool или сессии.
Статус A04 остаётся BROWSER_BLOCKED. A05/5161af7 принят отдельно.
Следующий шаг требует изменения внешнего условия: разрешённый запуск frontend
в среде Codex либо разъяснение/устранение блокирующей политики через поддержку
(Feedback уже отправлен ранее). Повторное бизнес-разрешение владельца само
по себе технический отказ среды не снимает. Весь UI WIP и прежние PASS сохранены.
