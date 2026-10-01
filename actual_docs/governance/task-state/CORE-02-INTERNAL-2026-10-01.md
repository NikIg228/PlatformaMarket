# CORE-02-INTERNAL — ручной перевод и проверка оплаты

Обновлено:01.10.2026. LOCAL_PASS / review и публикация; CI ещё не запускался.
Владелец:primary01a0f302-2d38-75d1-b79c-141e7428b533, единственный writer.
Основание: запрос владельца01.10 идти по внутреннему списку Foundation6.2
без внешних интеграций и боевых данных. Предыдущий CORE01 CLOSED/CI_PASS
на df1f399; docs receipt9a1e978 опубликован. Checkout — canonical root,
main@9a1e9785f0e1bec6ab87b03b991404f3bf1a4ac8, origin совпадает.
Пять прежних dirty файлов сохраняются; worktrees/агенты не создаются.

Источники: [Product23.6](../../product/DENTMARKET_PRODUCT_V2.md#236-согласованные-правила-реализация-отложена--28092026)
и [Foundation6.2](../../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md).
Новое разрешение01.10 открывает внутреннюю реализацию ранее отложенных правил;
старое предложение Product9.6 про подтверждение оператором не заменяет23.6.

## Результат и ограничения

CORE02.1–02.4: ручной учёт фактически подтверждённых поставщиком сумм,
остатка и отдельной переплаты к возврату; несколько доплат без двойного учёта;
проверено/не поступило и следующая проверка, спор; согласованное обеими сторонами
уменьшение заказа с историей; внутренние события и15/30/60 рабочих минут.
Квитанция/клиника/оператор не переводят заказ в PAID. Сборка и списание резерва
только после покрытия полной текущей согласованной суммы. Нет кошелька,
переноса переплаты, PSP, банка или реальной отправки денег.
Возврат после оплаты/отправки и банковский возврат — следующий CORE03/EXT.
Рабочие часы/ответственные конфигурируются, тесты используют только synthetic
настройки; реальные дежурные/каналы и их приёмка остаются внешним долгом.

## Inventory

OrderWorkflowService уже блокирует чужую сторону, проверяет permission,
сериализует операции row lock, сохраняет version/idempotency/audit/outbox,
валидирует clean uploaded PDF и держит резерв при заявленном переводе.
REPORT_TRANSFER/CONFIRM_TRANSFER сейчас требуют полную сумму; ledger остатка,
переплаты и response statuses/timers отсутствует. Изменять schema → service →
typed client/OpenAPI → shared UI; не заменять существующий workflow.

UI contract: существующий shared OrderWorkflowWorkspace/Fluent primitives;
сверху факт оплаты/остаток/переплата, затем конкретные действия стороны и история.
Ввод сумм без Number, сохранение draft при ошибке/conflict, явное подтверждение
получения денег, keyboard/390px/desktop. Новые формы/логику вынести из крупного
компонента; без redesign и новых библиотек. Development Toolkit frontend и
UI standard прочитаны; применяются Agency Backend Architect/Frontend Developer,
на review — Code Reviewer/Git Workflow Master (без отдельных агентов).

## Gates и среда

До изменений все attempts0. Нужны schema/unit/typecheck, Prisma validate и
upgrade path на disposable test DB, API/canonical build, core-contract,
PostgreSQL money/tenant/replay/races/rollback/hold, runtime-split, browser
critical flow с keyboard/desktop/mobile, docs/diff/review, commit/push и CI.
До запуска фиксировать точные inputs и команды;3 попытки/gate,20мин command,
45мин suite,15мин blocker diagnostics. Не повторять неизменённый CORE01 отдельно.
Чужой dev3000/4012 (PID16188/8696) не останавливать. До Prisma generate/build/
browser решить конфликт ресурсов без изменения рабочей БД и чужих процессов;
тестовые API/DB используют только проверенный isolated profile.

Следующий шаг: определить минимальный общий контракт payment summary/claim
review и additive persistence; затем связанные runtime/UI изменения и gates.

## Checkpoint реализации (не PASS)

Новые schemas manual-payments + order-workflow расширены (claim review,
actual received amount, summary/остаток/переплата, обе стороны reduction,
supplier policy timezone/windows/primary/backup). Ответные поля аддитивны;
legacy CONFIRM_TRANSFER без receivedAmountMinor означает заявленную сумму.
Additive migration20261001101000 добавляет claim evidence/таймеры, policy/version
в SupplierProfile и OrderPaymentReduction с one-pending constraint;
старые confirmed суммы backfill из amountMinor. Миграция ещё НЕ запускалась.
Новая backend логика подготовлена, НЕ проверена/НЕ опубликована:
manual-payment-rules, supplier-payment-policy service/controller+OpenAPI/client,
payment-review worker Cron (IN_APP + support ticket), payment-reduction helper;
OrderWorkflowService и CommerceModule связаны. Runtime/UI пока НЕ готовы.
Typecheck/tests/generate/build attempts0 CORE02; только чтение/запись исходников.
Следующий шаг: завершить review новой серверной логики/контрактов (включая
сохранность старого invoice/order snapshot, timer dedup/fairness, tenant guards),
затем shared UI и tests. Нужно обновить старый unit на запрет частичной суммы:
правило осознанно изменено, заменить на exact underpayment/receipt validation.
Добавить fixtures/cleanup нового reduction/notifications/support в PG.
Prisma client пока прежний; до generate/build учитывать живой чужой dev и lock DLL.

## Продолжение UI / preflight01.10 (не PASS)

Добавлены exact money input и отдельные shared панели summary/claim review/
reduction, настройки рабочих часов/ответственных с version/idempotency.
Main workflow подключает новые суммы и действия; upload cache учитывает сумму
и валюту. Scheduler использует keyset rotation, полная оплата закрывает pending
reduction как SUPERSEDED. Всё это пока требует gates/review.

Владелец явно разрешил остановить dev3000/4012 и восстановить после проверок.
Проверена цепочка launcher16180 `node scripts/dev-local.mjs unified` и только
его descendants; остановлена taskkill /PID16180 /T /F. Порты освобождены.
Рабочая БД не изменена. Для восстановления обычного dev с новой Prisma schema
потребуется отдельно разрешённый upgrade рабочей локальной БД либо прежний
совместимый runtime; разрешение на остановку не является разрешением миграции.

Следующие gates: schema build/Prisma generate+validate, затем typecheck attempt1
(новые schema/backend/UI inputs;20мин). Unit и DB/browser пока NOT_RUN.

Фактические checks: schema build PASS; db:generate PASS (Prisma6.19.3);
typecheck attempt1 PASS13/13,2m10s на backend/UI initial draft.
prisma validate attempt1 CONFIG_FAIL: shell без DATABASE_URL; attempt2 через
`npm run db:test -- exec --workspace=@marketplace/api -- prisma validate` PASS,
цель127.0.0.1:5432/dentmarket_audit_20260914. Это validate, не migration.
Добавлены schema regressions после typecheck; финальный TS check учтёт их.
Далее npm test attempt1 (новые money/schema/domain regressions,20мин).

npm test attempt1 PASS12 tasks,1m22s (API90files/455tests, UI57tests).
Новый PG helper добавлен в канонический verify:postgres: отдельные synthetic
offers/actors/docs, exact>2^53 money, policy permission/CAS/replay, bilateral
reduction/history,15/30/60 dedup, support, rollback/confirm race и cleanup.
Следующий запуск verify:postgres attempt1, обязательные prerequisites alias,
disposable dentmarket_audit_20260914/public,20мин command/45мин suite.

verify:postgres attempt1 FAIL на старом DB CHECK OrderTransferClaim_status_check:
NOT_RECEIVED ещё не разрешён. Schema/API build и migration101000 PASS, прежние
PG checks до expiry PASS; manual ledger partial/overpay/reduction прошли до
ошибки RECORD_TRANSFER_CHECK. Лог `.tmp/core02-postgres-attempt1.log`.
Cleanup без ошибки, API остановлен. Применённую migration101000 не менять.
Добавлена105000 для новых статусов; добавлен isolated-schema upgrade/backfill
test с полным rollback. Attempt2 обоснован этим точным исправлением.

verify:postgres attempt2 PASS, включая upgrade/backfill и все новые сценарии;
лог `.tmp/core02-postgres-attempt2.log`, cleanup/API shutdown завершены.
Финальный typecheck после schema/browser tests PASS13/13,1m03s:
`.tmp/core02-typecheck-final.log`. API-client build PASS.
Следующий gate canonical web build attempt1 в pilot,20мин; API build из PG
переиспользуется. После build — bundle gate и verify:web attempt1 (5 новых
CORE02 UI cases + прежний canonical suite), fixtures только isolated DB.

core-contract PASS121schemas/303operations/45core checks, включая обе новые
policy operations. Команда `npm run db:test -- exec -- node
scripts/verify-pilot-backend.mjs --contract-only`, prerequisites schema/API
build reused from PG unchanged runtime sources; `.tmp/core02-core-contract.log`.
runtime-split PASS api/worker/all/schedule/entrypoint/production guard:
`node scripts/verify-runtime-split.mjs`, API build reused; `.tmp/core02-runtime.log`.
Дополнительно выбран existing checkout-snapshot browser config (2 desktop/mobile
real API cases): изменён financial confirmation UI с обязательным checkbox;
старые assertions сохраняются. Запуск только после canonical browser cleanup.

Web build1 PASS. Bundle1 FAIL: public initial JS25files/1,718,982raw/464,994gzip
при budget24/1,500,000/450,000. Причина — новый runtime-import policy Zod из
CommonJS schemas через общий UI barrel. Настройки вынесены в lazy boundary,
загружаемый только на странице заказа поставщика с правом профиля. Порог не
меняется. Web build2/bundle2 обоснованы этим изменением. Browser пока NOT_RUN.

Web build2/bundle2 PASS. Canonical browser1:41 PASS /2FAIL в новых supplier
tests1440/390: неверный selector role=region для shared Section без aria-label.
Действия, replay и точная сумма уже прошли, DOM показывает остаток0,01.
Исправлен только selector на semantic dt + dd; повтор2 только этих двух tests,
остальные41 переиспользуются (app build/fixtures неизменны). Лог
`.tmp/core02-browser-attempt1.log`; новый runtime rebuild не нужен.
Review обнаружил недостающий supplier aggregate ID в PG cleanup; исправлен
только cleanup. Финальный PG3 underlying script после browser завершения,
API/schema builds переиспользуются. Это последний PG запуск текущей задачи.

Browser2 CONFIG_FAIL до запуска Playwright: npm wrapper получил --grep как
npm flag. Лог `.tmp/core02-browser-attempt2.log`; тесты не запускались.
Попытка3 использует явный separator внутреннего npm:
`npm run db:test -- run e2e --workspace=@marketplace/e2e -- --grep 'CORE02 supplier exact'`.
Лимит не сбрасывается, при неуспехе — остановка browser фазы.

## Текущий итог локальной проверки

Browser3 PASS2/2 (8.6s), остальные41 PASS переиспользованы из browser1;
полное покрытие43/43. Дополнительный real API checkout-snapshot PASS2/2
(41.4s) при1440/390, без снижения прежних assertions. Скриншоты проверены:
exact суммы читаются, формы/feedback не переполняют страницу; keyboard consent,
сохранение ввода и idempotent retry проверены действиями, не только картинками.
Артефакты: `outputs/core-02-internal-20261001/browser-attempt1`,
`browser-attempt3`, `live-browser-attempt1`; логи `.tmp/core02-*.log`.
После lazy boundary scoped UI typecheck+57unit tests PASS; E2E typecheck PASS.
Другие TS/unit входы не изменились, полный проход переиспользован.

PG3 underlying script PASS с исправленным cleanup; API/schema build inputs
не менялись. Свои2 orphan policy events предыдущих запусков удалены только
из audit test DB: exact event type/time window и отсутствие организации проверены.
Новых процессов проверок нет, порты3000/4012 свободны. Generated web next-env
возвращён в исходный вид;5 protected WIP не менялись.

Self-review по прочитанным Agency Code Reviewer/Git Workflow Master и Toolkit:
tenant/financial authority, row locks/replay, aggregate exact limits, immutable
old/new amounts, no double consume, upload metadata, lazy loading, cleanup и
outgoing scope. Backend Architect/Frontend Developer применены при реализации;
отдельные агенты не создавались. Нет новых внешних dependencies/интеграций.
Рабочая БД read-only проверена: marketplace/public, pending только101000/105000,
OrderTransferClaim total0/confirmed0. Запрошено отдельное разрешение на эти
две локальные миграции и восстановление прежнего dev; ответ ещё ожидается.
До разрешения рабочая БД не меняется и dev не запускается с несовместимой schema.
Далее docs/diff/staged review, обычный commit/push main и проверка CI точного SHA.
