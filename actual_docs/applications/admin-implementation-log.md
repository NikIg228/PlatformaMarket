# Admin — выполненные этапы и технические решения

## 14.10 / R7.2 — fixture входа в согласование акций

CI60a9860 подтвердил canonical113/113 и full-access3/3, но promotion4tests имел
один FAIL до открытия Admin. Старая fixture с token/org не содержала sessionId
и user.id, поэтому adminAccessToken отклонял идентичность до API-запроса.
Fixture приведён к текущему контракту по образцу workspace-rebuild; production
auth не изменён. go_live build, targeted promotion4/4, E2Etypes/lint PASS.
Опубликован03828c3; CI38583712037 и Security38583712595 SUCCESS.
Promotion workspace прошёл в CI; это не приёмка всего R7.7. [Evidence](../governance/task-state/PRIMARY-SESSION.md).

Обновлено 14.10.2026. Краткий журнал результатов кабинета оператора для владельца
и разработчиков. Требования — [Admin roadmap](admin-roadmap.md), единственный
checklist — [R7.7 основного roadmap](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md#admin-rebuild).

## 14.10 / R7.7.3.1 и часть R7.7.3.3 — реестр и read-only карточка

На `main@2876648` + scoped patch реализованы `GET /operations/organizations`
и `GET /operations/organizations/:id`, общие schemas/OpenAPI/typed client и
динамически загружаемый раздел Admin. Поиск legal/display name и БИН, status,
реальные capabilities, limit1–100/offset0–1000000, стабильный createdAt/id и полный
filtered total читаются в RepeatableRead. До чтения — active platform authority
и organization.view. Unknown/duplicate/invalid/control query возвращает400,
отсутствующий detail404. DTO не содержит raw profile/address metadata; анкета
проверяется существующим tenant-safe helper, оба города явно проецируются.
Legacy `GET /organizations` и его login consumer не менялись.

UI показывает список, read-only реквизиты/контакты/адреса, фактические возможности.
Существующая готовность подключается только для SUPPLIER. Фильтры и offset
сохраняются при detail/Back/reload/login, новый target очищает прежний object.
Loading/error/empty/retry, abort/stale response и очистка при403/404 проверены.
Обновление карточки обновляет readiness даже без смены organization.version.
Новых cross-org полномочий сотрудников/приглашений/ролей/сессий нет; .3.2 и
оставшаяся .3.3 не приняты. Fixed dev-org формы исключены из реестра;
существующие attribute/category-rule формы FoundationManagement перенесены
в Catalog с catalogOnly без role/member/policy fetch.

Паспорт/аналоги — [checkpoint](../governance/task-state/PRIMARY-SESSION.md).
Shared Dm controls/surfaces, Manrope,44/8/12px и tokens сохранены.
Скриншоты list/dropdown/detail1440/390 и computed styles/keyboard:
`output/playwright/operator-organizations/operator-organizations-org-0027b-yboard-selectors-and-detail/`.
Локальные проверки на финальных runtime inputs:

- `npm run build --workspace @marketplace/schemas`; focused Vitest schema18,
  service6/controller2, profile8/authority9 PASS; client1, Admin query33/navigation2 PASS.
- `npm run typecheck --workspace @marketplace/api`, Admin typecheck,
  `npx tsc -p apps/e2e/tsconfig.json --noEmit`, scoped ESLint и
  `npm run verify:ui-contract` PASS (4 policy tests/374 files).
- `npm run build --workspace @marketplace/api --ignore-scripts` PASS: без изменения
  Prisma/model/migration переиспользован прежний client, пользовательский DLL/runtime
  не останавливался. `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs
  --contract-only` PASS344 operations/62 verified/222 schemas;
  `node scripts/verify-runtime-split.mjs` PASS.
- `npm run db:test -- exec -- playwright test --config
  apps/e2e/playwright.operator-organizations-api.config.ts` PASS16.4s:151 rows,
  tied sort/pages/full total/status/capability/BIN/denial/404/no-write/legacy plus
  непустая анкета с двумя городами и исключёнными geo metadata.
- `node .tmp/operator-organizations-2026-10-14/build.mjs admin-web 1` PASS,
  budget15files/1042473raw/317144gzip при прежних1050000/330000/20;
  тот же helper `web 1` — isolated unified build PASS. После visual review
  feature form получил width100%/min-width0, refresh-кнопки — .actions wrapper.
  Final builds `admin-web 2`/`web 2` PASS, final budget1042473raw/317140gzip.
  Зависимости не переустанавливались.
- `npx playwright test --config apps/e2e/playwright.operator-organizations.config.ts`
  aggregate7 PASS:5 initial +2 focused repeat. Includes registry/detail/recovery,
  desktop/mobile/keyboard, dependent dashboard/capabilities and catalogOnly forms.
- `npm run db:test -- exec -- playwright test --config
  apps/e2e/playwright.operator-organizations-real.config.ts` PASS1/9.4s: настоящая
  operator session, чужая анкета/два города/supplier readiness, identity сохранена,
  profile не изменён. Только disposable audit DB, fixtures очищены.

Попытки сохранены: API invocation1 — npm separator error до запуска теста;
invocation2 PASS7.6s, после расширения detail/city fixture invocation3 PASS16.4s.
Client attempt1 — повторно использованный consumed Response в mock; исправлен
fixture, attempt2 PASS. Browser attempt1:5PASS/2FAIL из-за неоднозначного Fluent
label и required marker; только role locators уточнены, affected2 PASS6.1s.
После композиционных правок только visualcase attempt3 PASS1/5.3s: шесть новых
PNG, keyboard/computed styles,1440/390. Backend/real UI/неизменённые browser
cases переиспользованы. Admin types при одновременной сборке получили TS6053
на генерируемые .next/types; после завершения build отдельный typecheck PASS.
Final scoped lint/UI-contract PASS; это runner race, не ослабление type gate.
Это не прежний запрещённый object390 harness, он не запускался.

Известное стороннее ограничение: в прежнем `FoundationManagement.submitAttribute`
`event.currentTarget.reset()` вызывается после await и может обращаться к null.
В этом read-only registry scope код сохранён; consumer check подтверждает доступность
форм/правильный контекст, не сертифицирует их write flow. Отдельное исправление
автоматически не запускается.

Read-only подготовка primary для будущего .3.2: в Admin IdentitySettings
onCurrentRevoked вызывает clearAdminSession() без captured expected session;
поздний revoke прежней текущей сессии может очистить новый сохранённый вход.
SessionManagement принимает `Promise<unknown>`, без проверки response.id/status,
которая уже есть в workspace ProfileSessions. Это проверяемый риск следующего
bounded slice, здесь код/identity suites не менялись. Готовый workspace Profile
зависит от clinic/supplier context и не переносится в Admin прямым импортом.

Source и final visual review primary READY: шесть обновлённых PNG просмотрены,
замечаний не осталось. Source manifest57 hashes MATCH:
`.tmp/operator-organizations-2026-10-14/final-source-manifest.json`.
Публикация BLOCKED прежней зависимостью R7.7.1.3, commit/push/CI NOT_RUN.
Общий Admin, production, R7.2 и общий web budget не объявляются PASS.
Owned3103/4113 остановлены; пользовательские3000 PID13588/4012 PID8200 сохранены.

## Выполненная основа

13.10 реализован штатный вход оператора по email и паролю с отдельной сессией,
проверкой operator membership, восстановлением cookie и выходом. Доработаны
обращения, очередь и уведомления; исправлены MA-01–05, включая восстановление
формы, состояние обращения после ответа и выбор актуального диалога.

Результат опубликован в `55744ff` и `1ff5d98`. Локальные проверки auth/support,
изолированного PostgreSQL, runtime, типов, сборки и целевых браузерных сценариев
имеют LOCAL_PASS в своей границе. На `1ff5d98` общий CI завершился FAILURE
(100 browser PASS, 7 FAIL); Security SUCCESS. Команды и receipts:
[Acceptance Matrix](../governance/PROJECT_ACCEPTANCE_MATRIX.md) и
[карточка](../governance/task-state/CATALOG-PROMOTIONS-MESSAGES-2026-10-12.md).
Этот результат покрывает часть R7.7.1 и R7.7.6, а не весь Admin.

13–14.10 завершены анализ десяти разделов и разложение R7.7 на восемь пакетов
с проверяемыми подшагами. Это документация требований, не реализация этих пакетов.

## Текущая подготовка

14.10 / R7.2.1: операторский вход сохраняет допустимый `section`/deep return.
Восстановление сверяет session, пользователя и организацию; при чужом cookie
показывает «Аккаунт изменён в другой вкладке» и требует явного входа. Выход
подтверждается подписанным proof конкретной сессии, не cookie нового аккаунта;
поздний ответ не очищает новый вход. Shared API и nullable origin login обслуживают
все три кабинета. Это фундамент для R7.7.1.1/3, не новая оболочка Admin.

LOCAL_PASS: Admin unit12, affected types/lint, unified production build, реальные
desktop/mobile сценарии safe return, A/B logout и changed-session notice;
общие identity/PG/runtime/core-contract gates прошли. Точные команды, остальные
сценарии и ограничения — [auth evidence](auth-session-navigation.md#реализация-и-локальная-приёмка1410).
Опубликовано37fa69a; Security/PG/containers PASS, общий CI FAILURE на неполной
session identity в Flow B3 fixture (5 PASS/2 FAIL). Исправленный fixture прошёл
E2E types/lint и два реальных CSV/Excel publication flow на audit DB;
commit4d60acb, новый CI pending. Рабочая migration и перезапуск пользовательского runtime
не выполнялись. R7.7.1 целиком остаётся открытым.

## 14.10 / R7.7.1.2 — оболочка реализована, приёмка открыта

На `main@b197d8d` + shell diff добавлен opt-in `AppShell variant="workspace"`:
фиксированный sidebar200px с собственным scroll, один заголовок, профиль/выход
в sticky header, мобильный Fluent OverlayDrawer с Escape и возвратом фокуса.
Старые consumers используют прежний default AppShell. Admin composition сохраняет
`?section`, настоящий href/открытие в новой вкладке, существующие auth/logout
и recovery; новый profile API не введён. Полная карта URL/объектов остаётся R7.7.1.3.

UI contract/theme/index8 и legacy SSR2 PASS; Admin17 unit PASS; types UI/Admin/
unified build/buyer/supplier/E2E, scoped ESLint и `verify:ui-contract`4+368files PASS.
`npm run build --workspace @marketplace/web` с isolated adapter PASS; после
исправления каскада shared navigation CSS повторная сборка PASS. Standalone
`npm run build --workspace @marketplace/admin-web` compile/types PASS, но встроенный
`verify-admin-bundle` FAIL:1811161raw/502658gzip против1050000/330000. Gate открыт;
сопоставимого pre-shell receipt на b197d8d нет, старый PASS не подставляется.

Адресный `admin-shell.spec.ts`:3 группы PASS, повтор после CSSfix3 PASS за9.6s.
Проверены короткая/длинная страница,1440/768/390 и граница760/761, профиль после
scroll, focus trap/closed tab order/resize, реальная ссылка, pending/error/retry
выхода. В отдельной disposable audit DB выполнены настоящий operator login,
переходы analytics/settings и logout с проверкой REVOKED в БД. Команда harness:
`npm run db:test -- exec -- node .tmp/admin-shell-2026-10-14/browser.mjs`.
Один повторный запуск не начался из-за ошибочного npm invocation; после исправления
команды — PASS, ошибки приложения в этом запуске не было.

Снимки12 viewport + drawer/profile и computed styles:
`output/playwright/admin-shell-2026-10-14/manifest.json`. Визуально проверены
sidebar/selected links, drawer footer, mobile header и длинная settings page.
Default AppShell дополнительно проверен в browser harness с настоящим Fluent
Provider, navigation/Escape/return focus/logout callback; это компонентная
совместимость, не повторная приёмка всего legacy приложения. Harness attempt1
FAIL из-за неоднозначного locator двух кнопок закрытия, attempt2 PASS;2 PNG +
`output/playwright/admin-shell-2026-10-14/legacy/manifest.json`.

Собственные3103/3104/4113 остановлены, пользовательские3000/4012 сохранены.
Commit/push не выполнены: требуется primary review и разбор Admin bundle FAIL.
Общий CI b197d8d38469520118 FAILURE (Flow B3 7/7PASS, verify:web95PASS/12FAIL),
Security/PG/containers SUCCESS; это receipt предыдущих inputs, не CI оболочки.
R7.7.1.2 checkbox открыт. UI не расширял scope на bundle/auth fixtures.

### 14.10 — primary review и устранение зависимого bundle gate

Shared primitives/format/actions/select вынесены в leaf modules без изменения
реализаций; старые root/controls exports сохранены. Hot Admin shell использует
узкие imports, IdentitySettings/assignment загружаются по действию. Runtime schemas
restore/logout загружаются перед прежней валидацией; generation check остаётся после
последнего await. Regression: поздняя schema не заменяет новую сессию, ошибка загрузки
сохраняет выбранную. Backend/API/данные/права не менялись.

Admin bundle attempt2 FAIL1105281/333415; attempt3 PASS1033799/314367.
Review выявил close/import race; open guard/cleanup исправлены. Final rebuild
`npm run build --workspace=@marketplace/admin-web` PASS1033817raw/314381gzip,
15files при прежних лимитах1050000/330000/20. Лимиты не менялись.
UI10, client logout/workspace28, Admin auth12, performance4 и scoped types PASS.
ESLint exact adapter allowlist обновлён для двух перенесённых implementations;
новый regression подтверждает, что feature modules по-прежнему не могут импортировать
Fluent/native controls. Scoped lint, lint-policy3, UI-contract4/371files PASS.

Final unified build с isolated adapter/INTERNAL_API_URL4113 PASS. Browser new-input
attempt1 SETUP_FAIL (DB env), attempt2: shell3/close race PASS, chunkfailure fixture
FAIL из-за automatic retry, actual login FAIL из-за baked API rewrite по умолчанию.
До attempt3 build получил явный4113; harness проверяет manifest до fixtures, test
удерживает отказ всех автоматических retry до явного действия. Attempt3 PASS5/16.5s,
включая pending close/no reopen/return focus и error/retry/same task. Настоящий
operator login/analytics/settings/logout + DB REVOKED PASS;12viewport screenshots,
drawer/profile/computed styles обновлены и просмотрены. Legacy actual Fluent harness
после leaf extraction PASS. Команда browser — та же `npm run db:test -- exec -- node
.tmp/admin-shell-2026-10-14/browser.mjs`; logs browser-perf-3/build-admin-final-race
в `.tmp/admin-shell-2026-10-14/`. Owned3103/3104/4113 остановлены; user3000/4012 intact.

Read-only UI review подтвердил сохранность shared implementations и исправление
race; primary visual review PASS. Результат LOCAL_PASS, публикация/CI ещё pending.
Прежний общий CI FAILURE и catalog BLOCKED6 не переопределены.

## 14.10 — R7.7.1.3: адресная навигация, frozen review packet

Один typed query-state связывает текущие10 разделов, объект очереди, обращение,
диалог и контекст списков. Маршруты `/admin?section=...` сохранены; standalone
Admin использует тот же query на `/`. Новые вложенные routes не вводились.

| Контекст | Контракт URL и совместимость |
| --- | --- |
| Раздел | analytics/overview/organizations/access/catalog/imports/orders/support/security/settings; по умолчанию overview |
| Объект | queueType из существующих9 типов + UUID object, обязательно парой |
| Поддержка | UUID ticketId либо conversationId при section=support; старые смешанные ссылки принимаются с приоритетом диалога, новые записи содержат один target |
| Обращения | supportMode=tickets/conversations; supportStatus из5 текущих статусов; supportQ до200 символов; supportSort=queue/recent; supportOffset0..100000 шаг50 |
| Диалоги | conversationFilter=ALL/UNREAD/ORDERS; conversationOffset0..99990 шаг30 |
| Очередь | queueKind=ALL либо текущий тип; queueOffset0..100000 шаг50 |

Старые queue href сохраняют server mapping: catalog — CATALOG_REVIEW,
PROMOTION_REVIEW, STALE_INVENTORY; organizations — COMPLIANCE_REVIEW; imports —
INTEGRATION_RECONCILIATION, IMPORT_ATTENTION; orders — ORGANIZATION_REVIEW,
AGREEMENT_SIGNATURE, SUPPLIER_CONFIRMATION. Domain actions и полномочия не менялись.
Уведомления поддержки ведут к ticketId одним history entry после успешного read;
ошибка read сохраняет адрес, поздний ответ после Back не заменяет новый переход.

Смена раздела очищает target и сохраняет list context. Direct/reload/Back/Forward
читают тот же parser. Старые ответы объекта/диалога не заменяют новый target;
pending send/action не запускает stale refresh и не показывает ошибку A в B.
Optional controlled navigation в ConversationWorkspace сохраняет drafts по id;
обычные consumers продолжают прежнее локальное управление.

Safe-return использует тот же whitelist: unknown/duplicate/authority/action keys,
чужие origins, fragment/raw backslash и decoded controls не принимаются.
Encoded # и backslash в supportQ остаются текстом. Граница URL4096 вмещает200
Unicode-символов плюс все ограниченные параметры; контрольный roundtrip добавлен.
Некорректная ссылка имеет recovery без запроса target; неверный поисковый текст —
shared field validation. Карточка объекта использует DmSurface/DmButton и существующий
toolbar; общие tokens/геометрия/тема не менялись.

Подтверждено до финального прогона: schemas parser/return84, Admin36, UI88 PASS;
initial browser9/32.5s (7 новых +2 прежних clinic/supplier conversation сценария),
actual guest → operator login → filters/reload → logout/DB REVOKED PASS.
После уточнения punctuation/notification pending и визуальной композиции выполняется
финальный affected browser; неизменённые consumers не запускаются повторно.

Зависимый CI `59d944a` (`38476309767`) и `2876648` (`38476936649`) завершился FAILURE:
FlowB3 CSV/EXCEL искал старый button вместо navigation link (5 других тестов PASS).
verify:web не достигнут. Security обоих commit, PostgreSQL и containers SUCCESS.
Общий web budget остаётся FAIL31files/2040197raw/557347gzip при прежних лимитах.
Шесть зависимых E2E файлов исправляют только Admin selectors/drawer; assertions
публикации, прав и доменных действий сохранены. Supplier legacy selector не менялся.
Целевой FlowB3 CSV/EXCEL + operator full-access выполняется отдельно в test DB.
R7.7.1.3 ещё не опубликован.

Финальные receipts: browser2 PASS7/17.8s, actual encoded-search safe-return/reload/
logout и DB REVOKED PASS. Final Admin build PASS1037463raw/315568gzip/15files;
unified isolated build PASS, BUILD_ID `Im2FXp3F-LPOljp7deTMe`, API4113.
Build/source provenance — `.tmp/admin-query-2026-10-14/final-source-manifest.json`.
FlowB3 CSV/EXCEL PASS2; full-access первый combined run FAIL из-за ошибочного
ROLE_BASED профиля до UI, второй с существующим dedicated FULL_ACCESS config
PASS1/6.7s. Types UI/Admin/buyer/supplier/E2E, lint/UI-contract/diff PASS.
Команды: `npm run db:test -- exec -- node .tmp/admin-query-2026-10-14/browser.mjs`,
`.../flow-b3.mjs`, `.../flow-b3.mjs full-access.config.ts`; builds через
`.tmp/admin-query-2026-10-14/build.mjs` (Next build + unchanged Admin budget).
Логи browser-1/2, flow-b3-1, full-access-2 и build-*-1/2/3 сохранены в той же папке.

Предел проверки: после browser2 добавлены assertions390px для самой карточки
объекта, но дополнительный запуск **NOT_RUN**. Автоматическая проверка разрешений
отклонила создание/запуск visual harness: exec_command CreateProcess,
`blocked by policy`, без подробной причины. Обходов/эквивалентного retry нет.
Скриншоты support1440/390, desktop object и shared conversation consumers проверены;
они не объявлены доказательством новых object-mobile assertions. Этот gap остаётся
для итоговой оценки достаточности evidence; полная viewport-приёмка не заявлена.
UI остановил все записи/проверки, primary получает frozen packet. Owned3103/4113
остановлены, пользовательские3000/4012 сохранены. R7.7.1.3 checkbox остаётся открыт.

## 14.10 / R7.7.2 — показатели и возможности: LOCAL_PASS, публикация BLOCKED

На `main@2876648` + scoped diff добавлены `GET /operations/dashboard` и
`GET /operations/capabilities`, общие схемы, OpenAPI и API client. Авторизация
активного оператора платформы и `organization.view` выполняется до глобальных
чтений. Totals считают все организации и карточки master-каталога во всех статусах,
а разрешения — уникальные действующие права текущего оператора. Это наблюдение
на указанное время, без вымышленного периода или атомарного снимка. Ноль означает
успешный пустой результат; недоступный источник возвращает null и явную причину.

Возможности отражают конфигурацию платформы, отдельно от прав конкретного tenant.
Пять модулей читаются из deployment policy; внешняя AI-модель отделена от
детерминированного AI fallback. Конфигурация платежей не объявляется подтверждением
живого подключения. Статусы readiness и LIVE_VERIFIED считаются по существующему
реестру и подписаны как его данные; ACTIVE providers включают тестовые записи.
Проекция не возвращает секреты/URL/произвольные payloads, не делает network probe
или default upsert. Профиль, модель БД, migration и рабочие данные не менялись.

Существующие панели Admin заменили page-length counters и статические обещания.
Они сохраняют последние данные при recoverable error с явным предупреждением,
очищают их при401/403, показывают loading/unknown/empty/retry и несовпадение
профилей frontend/API. Переходы используют typed query-state R7.7.1.3 и сохраняют
list context. DmSurface/DmButton, semantic tokens, Manrope и параметры дизайн-системы
сохранены. Новые панели проверены при1440/390px, keyboard focus видим, overflow нет.
Старый overview loader и IdentitySettings вне этой локальной visual-приёмки.

Проверки и команды:

- Schema3, initial dashboard/controller/authority/access21, capability/dashboard/
  controller18 PASS; после уточнения readinessReady повтор capability9 PASS.
  Запуски через workspace `npm test --workspace <package> -- --run <target.spec.ts>`;
  view-model3 и client abort2 PASS. API/client/Admin/E2E types, scoped ESLint,
  `npm run verify:ui-contract` (4 tests/372 files) PASS.
- `npm run verify:core-contract` attempt1 остановлен prebuild Prisma EPERM:
  DLL занята пользовательским runtime. Source schema/lock неизменны, полное
  сравнение generated schema без whitespace подтвердило эквивалентность.
  `npm run build --workspace @marketplace/api --ignore-scripts` PASS с тем же
  generated client; `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs
  --contract-only` attempt2 PASS:342 operations/62 core/219 components.
  `node scripts/verify-runtime-split.mjs` PASS на том же API build.
- `npm run db:test -- exec -- playwright test --config
  apps/e2e/playwright.operator-dashboard-api.config.ts` attempt2 PASS1/4.8s:
  151 products +151 organizations разных статусов, exact DB totals, bad query,
  supplier/role/inactive membership/org denial, spoof headers и revoked JWT.
  Attempt1 FAIL был неверным ожиданием200 для конфликтующих identity headers;
  guard правильно отверг их401, исправлен только тест. Owned fixtures удалены.
- `node .tmp/operator-dashboard-2026-10-14/build.mjs admin-web` PASS:
  15files/1041189raw/316841gzip, прежние budgets сохранены. Аналогичный `build.mjs web`
  PASS; unified BUILD_ID `8QXCrkZGjq2xJp7vC75VA`, pilot/API4113. Логи build-*-1.log
  в той же папке; source manifest фиксирует финальные входы.
- `npx playwright test --config apps/e2e/playwright.operator-projections.config.ts`
  PASS5/11.3s: три новых сценария и два dependent assignment. Real UI config
  `playwright.operator-projections-real.config.ts` под `npm run db:test -- exec --`
  PASS1/8.4s: видимые totals равны БД, settings отражают pilot, fixtures удалены.
- Только screenshot capture исправлен с locator после Tab-scroll на fullPage
  от scroll0; тот же UI config `--grep 'projection panels'` PASS1/3.5s.
  Четыре финальных PNG `output/playwright/operator-projections/` просмотрены primary
  и независимым read-only UI reviewer: замечаний к новым панелям нет.

Пользовательские3000/4012 не останавливались; owned3103/4113 завершены. Новых
зависимостей/install нет. Общий web budget FAIL и прежний R7.7.1.3 object390
NOT_RUN сохраняются: эта приёмка их не подменяет. Commit/push не выполнялись,
новый CI NOT_RUN; публикация .2 зависит от неопубликованного navigation helper.

## Как дополнять журнал

После каждого связного этапа записать дату и R-ID, изменение сценария, затронутые
UI/API и ограничения, выполненные checks с evidence, commit и отдельный статус CI.
В тот же момент обновить соответствующий пункт основного roadmap. Непрошедший
gate сохранять как FAIL/BLOCKED, вопросы — в
[журнале решений](../governance/ROADMAP-QUESTIONS-AND-DECISIONS.md).
## 16.10 — повторная приёмка текущего Admin WIP

Основание: явное поручение владельца исправить расхождение опубликованного и
локального Admin, затем продолжить R7.6.5.1–3. База `4582db1` + Admin patch;
каталог, CI workflow, чужие docs receipts и прочий WIP не входят в публикацию.

Проверено на текущем исходном коде:
- schemas114, api-client3, API26, Admin39 и shared UI90 unit PASS;
- API type/build в изолированном output с актуальным Prisma client, schemas/client
  build, Admin/UI/E2E types и единая production web build49routes PASS;
- isolated API integration2 PASS: totals >150, paging151, реальные JWT/roles,
  чужой tenant, spoof и отсутствие platform authority;
- production Admin browser15 PASS: URL/Back/Forward/reload, stale replies,
  сохранение drafts/filters, unknown/zero, 403/404/retry, реестр/detail;
- screenshot/computed styles desktop/mobile390, keyboard selectors и возврат
  фокуса проверены. Прежний NOT_RUN object390 закрыт текущим запуском;
- scoped ESLint, UI contract390files/10532declarations, core API contract69operations,
  runtime split api/worker/production guards и frontend bundle budget PASS.

Команды и изолированные конфигурации: `.tmp/roadmap-continuation-2026-10-16/`:
`admin-api.config.ts`, `admin-production.config.ts`, `admin-real.config.ts`,
`api-tsconfig.json`, `build-web.mjs`, `client-hook.cjs`; test DB только
`dentmarket_audit_20260914`, frontend3103/API4113. Пользовательские3000/4012 сохранены.
Unit команды — workspace `npm test -- --run` для новых schema/client/API specs;
Admin/UI — существующие workspace unit suites. Core-contract выполнялся через
`npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only`
после isolated build, runtime — `node scripts/verify-runtime-split.mjs`.

Попытки сохранены: API integration initial FAIL из-за отсутствующих Nest font assets,
после копирования штатных assets PASS2. Core-contract setup: direct wrapper без
npm_execpath FAIL, относительный preload path в дочернем cwd FAIL, абсолютный
preload/loader PASS на третьей попытке. Mock catalog navigation: unexpected promotions
route, затем неверная fixture array, после paginated response PASS (3 попытки).
Real UI initial FAIL: build-time rewrite оставался4012 при isolated API4113;
повтор после сборки с INTERNAL_API_URL4113 PASS2: реальный оператор читает
агрегаты и чужую разрешённую карточку без смены identity и без изменения профиля.

Расширенный browser запуск переписки остановлен после14PASS/2FAIL: обе ошибки
до открытия вопроса поставщику — карточка товара не загрузилась в mock fixture.
Сценарии самой переписки (review1440/390, attachments/retry1440/834/390,
silent refresh/filter/paging, delayed selection/drafts) PASS7; Admin navigation PASS7.
Этот запуск не объявляется общим PASS. Проблема product/question fixture вне
изменённого Admin flow сохранена здесь один раз, без расширения задачи.
На desktop screenshot очереди видны растянутые кнопки строки; CSS очереди этим
пакетом не менялся, отдельный visual defect не закрыт текущей приёмкой object card.

Пакет опубликован в `3aa1c0bcd4bfecb6da77cd9f650450866e793d03`:
[CI38801740584](https://github.com/NikIg228/PlatformaMarket/actions/runs/38801740584)
и [Security38801739921](https://github.com/NikIg228/PlatformaMarket/actions/runs/38801739921) SUCCESS.
R7.7.3.2 и полная .3.3 не реализованы;
read-only реестр не означает приёмку всего Admin.
