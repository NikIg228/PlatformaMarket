# П01 / R7.1.1 — продолжение личной корзины02.11

Статус: LOCAL_PASS (scoped П01); публикация/CI отдельно ниже. Основание: явное поручение владельца
продолжить П01 и сверить актуальность roadmap. База main@0abc588f; canonical root.
Существующий personal-cart/auth WIP принадлежит этой задаче; output и generated
apps/web/AGENTS.md сохраняются отдельно. Checkout/order/payment/reserve, рабочая
миграция и deploy не входят в пакет.

## План и риски до изменений

Результат: личный вход → каталог → server-owned личная корзина → корректировка,
reload и принятие новых условий. Сохранить клинические корзины и отсутствие
глобального переключателя в каталоге. Риски: owner/tenant/private price, auth,
конкурентные изменения, запоздалые ответы и потеря ввода.

Проверки: focused schema/API/client/auth и B2B consumers; типы затронутых
пакетов/API/buyer/landing/web; сборки API/shared и buyer/landing/web; isolated
PostgreSQL (upgrade/owner/CAS/replay/rollback/no reserve), core-contract,
runtime-split. Browser личный/B2B flow, recovery, RU/KK,1440/390,keyboard,
screenshots/computed styles. Lint/UI-contract/diff. Без общего release suite.
Прежние PASS сохраняются как история; изменения shared backend с30.10 и отсутствие
полного hash manifest требуют актуальной проверки зависимого PG gate. Новый
первый запуск на изменённых входах, не повтор прежнего неустранённого блокера.
Использовать dentmarket_audit_20260914 через db:test; только owned процессы.
Лимит3 на gate; preflight2m/start5m/command20m. После PASS scoped commit/push,
CI отдельно. Не закрывать весь R7.1.1 узкой корзиной.

## Выполнение

- Статическая сверка: orders.md содержал устаревшие API-проект/все NOT_RUN;
  обновлено до локальной реализации с незавершённой приёмкой. Roadmap П01 уточнён.
- Focused API baseline: выполняется, лог `.tmp/p01-api-focused-20261102-1.log`.

## Текущие результаты02.11

- API focused 5files/25tests PASS; schemas2/19 PASS; client4/19 PASS;
  buyer context1/6 PASS; landing auth17 PASS до нового regression.
- API build1 FAIL: Prisma generate EPERM при занятой DLL работающего dev.
  Generated schema после удаления whitespace точно равна source (проверено),
  client ранее generated; `npm exec --workspace=@marketplace/api -- nest build`
  build2 PASS без повторной генерации. Dev процессы не остановлены.
- `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` PASS,
  новый полный срез02.11 (schema/API prerequisite builds выполнены).
- `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only`
  PASS; `node scripts/verify-runtime-split.mjs` PASS с теми же API artifacts.
- Types schemas/client/API/buyer/landing/web PASS. Web isolated production build1
  PASS через штатный NEXT_ADAPTER_PATH; frontend go_live, API test, test DB only.
- Browser1 FAIL: fixture использовала старую подпись «Войти по email» вместо
  текущего «Войти»; исправлен только selector. Browser2 FAIL: настоящий личный
  login в unified app не переходит из-за new URL(target,"/"). Regression показал
  ERR_INVALID_URL; после исправления relative base через location.origin18tests PASS.
  Web build2 после auth fix выполняется; browser attempt3 ещё NOT_RUN.
- UI-contract PASS (5 policy tests,470files). Scope lint1:0errors/1warning — во
  время isolated build попал generated next-env.d.ts; повторить после build,
  исключая generated файл как предусмотрено eslint policy.
- Client/buyer builds выполняются. Landing build и финальный diff review ещё NOT_RUN.

- Сводная сверка R0–R9: R0 historical ACCEPTED; R1 active/decisions;
  R2–R6 и R8–R9 полный scope не принят; R7 partial. Исправлено конкретное
  противоречие parent R7: R7.6/R7.7 ошибочно PLANNED при подробных PARTIAL /
  OPEN_DEPENDENCIES и принятых счёте/операторских вертикалях. Чекбоксы не менялись.
- Web build2 PASS; buyer/client build PASS. Lint2 PASS после исключения
  временного generated next-env.d.ts (0 ошибок исходников в первой попытке).
- Browser3: вход без организации, пустая корзина, товар→add→корзина, keyboard
  save/reload, price diff/acceptance, network failure/draft recovery PASS.
  FAIL на mobile height: тест измерял внутренний input, стандарт44px относится
  к outer `.dm-input` (controls.tsx/styles/controls.css). Исправлен selector,
  threshold44 и radius8 сохранены; новые измерения пока NOT_RUN.
  Screenshots desktop и390KK просмотрены: reflow без видимого overflow, labels
  и состояние соответствуют scope. Это не полный computed-styles PASS.
  Browser attempt limit3 исчерпан; владелец запрошен об одном доп. запуске.
  Account-change/clinic separation/unavailable removal в этом запуске NOT_RUN.
  Все owned test процессы закрыты; dev не останавливался. Нет commit/push.

## На остановке перед дополнительным browser запуском

Landing build1 PASS, повтор landing types после auth fix PASS; Prisma validate
через db:test PASS. Scope lint2 и отдельный lint browser script PASS; diff hygiene
PASS. Всего focused schema/API/client/buyer/landing87tests PASS. Web2, buyer1,
landing1, API2, schemas1/client1 builds PASS; API prebuild FAIL сохранён выше.
Не выполнены повтор mobile computed styles и поздние browser шаги, поэтому
П01 остаётся NOT_ACCEPTED, commit/push НЕ выполнены. Рабочая БД не менялась.

Подготовленная следующая команда (только после разрешения владельца):
`npm run db:test -- exec -- node scripts/verify-personal-cart-browser.mjs`
с логом `.tmp/p01-browser-4.log`. Исправлено измерение shared outer control;
сохранены44px/radius8, добавлена проверка возврата к клинической корзине через
существующий selector кабинета. Приложение после web build2 не менялось.
После успешного запуска: просмотреть новые screenshots/styles, обновить статусы
узкого П01, review/stage собственных файлов, commit/push, проверить remote/CI.
При новом FAIL разрешённый дополнительный запуск исчерпан; не обходить лимит.

Артефакты: `.tmp/p01-*-*.log`, `output/playwright/personal-cart/`,
`.tmp/p01-inputs-20261102.json` (hash manifest source/dependencies).

## Разрешённая попытка4

Владелец: «Разрешаю, после приступай к следующим задачам». Один дополнительный
browser запуск выполнен02.11; log `.tmp/p01-browser-4.log`. Первые7шагов PASS:
вход/empty, add/keyboard/reload, price acceptance, recovery, mobileKK (outer44px,
inner42px,radius8,Manrope,no overflow), смена аккаунта, отдельная personal корзина
члена клиники. Screenshot/styles просмотрены. Остаток NOT_RUN: возврат к
клиническому контексту/add и unavailable removal/no reserve финальная сверка.
Попытка4 FAIL на тестовом `selectOption`: shared DmDropdown — Fluent button/option,
не native select. Подготовлен click combobox→option; приложение не изменялось,
скрипт lint PASS. Новый запуск не выполнялся: разрешённый дополнительный исчерпан.
Не переходить к реализации П02 до полного PASS П01 по Workflow §4.4.
Поручение следующих пакетов сохраняется: следующий П02 календарь, после него
разрешённая последовательность roadmap с соблюдением зависимостей/приёмки.

## Попытка5 и исправление возврата к клинике

Владелец отдельно разрешил5: выполнена. Первые7шагов PASS; FAIL пустой список
клиник. Причина: личный вход имеет sign-in cookie, но не capability cookie,
поэтому workspace session справедливо отсутствует; UI не давал пути handoff.
В BuyerContextBar добавлена ссылка «Войти в кабинет клиники» через существующий
login/returnTo. Не выдаём workspace bearer из personal и не ослабляем cookies.
Test теперь проходит настоящий handoff, затем выбирает клинику обычным dropdown.
Buyer types2, buyer-context6tests, scope lint и UI-contract2 PASS; web build3 PASS.
Buyer build2 выполняется. Владелец разрешил ещё до3browser запусков (6–8),
после PASS продолжение roadmap сП02. Запуск6 выполняется; счётчик сохранять.

## Итог локальной приёмки02.11 — PASS

В разрешённых владельцем трёх запусках6–8:6 FAIL на synthetic warehouse без
cityId при переходе к городу клиники (fixture исправлена, guards сохранены);
7 FAIL на устаревшем heading assertion (unified BuyerCart имеет hideHeading,
товар и checkbox организации отображались);8 все9шагов PASS, exit0.
Тест проверяет реальные login/handoff/API/DB: личный аккаунт без membership,
пустая корзина, товар→add, keyboard save/reload, price diff/acceptance, network
failure/draft/retry,390KK44px/radius8/Manrope/no overflow, смена аккаунта,
разделение personal/org cart, возврат через login/handoff/выбор клиники,
unavailable removal/no reservation/no checkout. Desktop1440 и mobile390
screenshots просмотрены. Это scoped UI flow, не общий release E2E.

Все выбранные локальные gates PASS:87focused tests,6workspace types, schemas/
client/API/buyer/landing/web builds (final buyer2/web3), Prisma validate,
полный PostgreSQL02.11, core-contract, runtime-split, scope lint/UI-contract2,
diff hygiene. Backend inputs после PG/core/runtime не менялись. UI изменён
только ссылкой восстановления кабинета, после неё buyer tests/types/build,
web build/browser/UI-contract/lint повторно PASS. Исторические FAIL не удалены.

П01 завершает только personal session/cart. Нет личного checkout/order/payment,
резерва, live provider, deployment или рабочей миграции. R7.1.1 целиком OPEN.
Dev3000/4012 сохранён, owned API4412/web3103/browser закрыты. Следующий разрешённый
пакетП02; до его кода сверить календарные контракты/источник праздничных отметок.

## Публикация 02.11

Коммит 38ca2fe4b727fa60e035cb15281421faca9ab363 опубликован в origin/main;
remote SHA совпал. CI41481131263 и Security41481131187 пока IN_PROGRESS
(16:28UTC), не PASS. Чужие checkpoint hunks, apps/web/AGENTS.md и output сохранены.

## CI attempt1 — FAIL; scoped fixture fix, verification blocked

CI41481131263: PostgreSQL/backup, API/web containers PASS. Security41481131187
CodeQL/dependencies PASS. Verify прошёл types/lint/tests/build/contracts/runtime,
но общий pilot browser:121 PASS,2 FAIL organization-requisites.spec.ts clinic
1440/390 — unexpected GET /auth/personal-current. Приложение не падало: mock
не знал нового штатного read запроса. Добавлен точный GET handler с JSON null;
assertions unexpected/writes сохранены. Правка пока не проверена и не опубликована.
Попытка целевого Playwright запуска с отдельным сервером3103/готовым build
отклонена automatic approval review: blocked by policy, без подробной причины.
Процесс не запущен, обход не выполнялся. CI не PASS, П02 код не начинать.
Следующий шаг: разрешённый запуск целевого organization-requisites.spec.ts,
types/lint/diff review, scoped commit/push и повторная проверка CI.

После «окей, продолжаем»02.11 повторена та же команда запуска scoped Playwright:
automatic approval review вновь отклонил её до старта процесса (blocked by policy,
без пояснения). Config не создан; тест не выполнялся; обхода нет.
Независимые проверки исправления PASS: npm run typecheck --workspace=@marketplace/e2e;
node node_modules/eslint/bin/eslint.js apps/e2e/tests/organization-requisites.spec.ts
--max-warnings=0; git diff --check. Runtime/browser доказательство всё ещё отсутствует.
Commit/push исправления не выполнены; П02 остаётся подготовкой до обязательного PASS.

## Разрешённая проверка fixture02.11 — LOCAL_PASS

После отдельного согласия владельца на повторный запуск automatic review
пропустил команду. Первый новый запуск остановился до тестов: временный config
использовал import.meta при CommonJS загрузке. Исправлен root=process.cwd();
владелец явно разрешил ещё один запуск. Итог:13/13 organization-requisites
browser tests PASS, включая обе клиники1440/390, без записей в БД.
Команда: `node node_modules/@playwright/test/cli.js test --config .tmp/p02-requisites-fix.config.ts`.
Лог PASS `.tmp/p02-requisites-fix-2.log`; предыдущий FAIL сохранён.
Исправление production code не меняет; exact GET mock null handler только
синхронизирует fixture с личной сессией. Ранее прошедшие E2E types/scoped lint
переиспользованы для неизменённой строки. Scoped публикация/новый CI ещё впереди.

Fixture fix опубликован как4bc2e301a70adc0ff6d97c159fad7667c52c5aff.
CI41496811460 completed/success: прежний browser failure закрыт на GitHub.
Исторические FAIL/approval rejections выше сохранены; кП01 новых открытых
локальных или CI требований не осталось. П02 учитывается отдельно.
