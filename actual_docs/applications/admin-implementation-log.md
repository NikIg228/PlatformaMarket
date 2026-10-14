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

## Как дополнять журнал

После каждого связного этапа записать дату и R-ID, изменение сценария, затронутые
UI/API и ограничения, выполненные checks с evidence, commit и отдельный статус CI.
В тот же момент обновить соответствующий пункт основного roadmap. Непрошедший
gate сохранять как FAIL/BLOCKED, вопросы — в
[журнале решений](../governance/ROADMAP-QUESTIONS-AND-DECISIONS.md).
