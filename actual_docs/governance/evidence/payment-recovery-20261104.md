# Цикл 5 — восстановление платёжной операции B040

Статус: LOCAL_PASS после явного разрешения продолжить A05/A04 (04.11).
Предыдущий результат BLOCKED (focused PostgreSQL, лимит 3 попыток) сохраняется ниже.
Владелец04.11 явно разрешил цикл5 после цикла4 с открытой
браузерной приёмкой. Это изменение последовательности, не принятие цикла4.
Каноническая папка dentmarket-kz-main, main@b3fdb44b, ahead5; сохранить весь
предшествующий staged/unstaged WIP. Без агентов, working DB, live PSP и deploy.

## План до реализации

Существующий provider-path: успешный ответ сохранён в PaymentAttempt, локальный
commit упал, intent/payout остался PROCESSING. Повтор того же ключа/параметров
должен применить сохранённый результат без нового внешнего вызова. Scope:
authorize/capture/cancel/processPayout, существующий refund как regression.
Unknown/PENDING/FAILED не объявляются успехом; другой ключ/состав/сумма/reason/
provider/tenant не разрешают восстановление чужой операции. Конкурентное
восстановление не дублирует transaction/ledger/stock/audit/outbox.

Риск высокий: деньги, конкурентность, локальный rollback после remote success.
Сначала regression исходного authorize failure; после каждого связного перехода
focused unit tests, затем оставшиеся переходы. Completion: affected payments+
dependent tests, API types/build, focused disposable PostgreSQL с двумя
соединениями и rollback, общий verify:postgres и runtime-split, lint/diff.
Existing schemas/OpenAPI/controller permissions сохраняются; проверить API
reachability и denial. При изменении API shape — schema/client/OpenAPI first.
Бюджет: build20мин, suite45мин, probe2мин; до3 попыток на gate с сохранением FAIL.

UI не добавляется для этого backend recovery: provider endpoints уже существуют,
но в current frontend/API client не найдено вызовов authorize/capture/cancel/
payout provider-path; пользовательские кабинеты используют manual payment path.
Новая PSP/UI интеграция и live acceptance относятся к R4.2/П10, не B040.
Этот scoped ремонт не закрывает R4/производственную платёжную готовность.

Источники: original12-cycle list; audit backend batch046/conclusion и
payment-processing-retry-probe-1.json (reproduced authorize failure); текущие
PROJECT_OVERVIEW/payments.md: unknown сначала сверяется, money fact сохраняется;
Workflow §4/§5, schemas commands/payments.ts и текущий settlement service.
Development Toolkit + Backend Architect: idempotency, atomic local commit,
contract compatibility, safe external boundary. Antislop DURING — прежний выбор.

Не входит: новые способы оплаты/провайдеры, unknown-result polling, webhook lease
рефакторинг, ERP/notifications/import/checkout recovery и B041 remote parent ID.
Непринятые bank/legal/fiscal/delivery решения не меняются.

## Реализация и проверка 04.11

Добавлены payment-operation-recovery.ts, payment-recovery.spec.ts,
payout-recovery.spec.ts; изменён payment-settlement.service.ts и его spec.
Сохранённый SUCCEEDED проверяется по intent/provider/type/key/request/externalId;
authorize/capture/cancel/payout используют его без повторного provider call.
Локальные finalizers берут общий row lock intent, payout также блокирует payout.
Схема/API shape/Prisma schema не менялись. Scripts: verify-payment-recovery.mjs.

PASS до PG: исходный authorize regression воспроизвёл failure (unit-1.log),
после реализации authorize-1/2, capture-1, cancel-1 прошли; весь payments:
`npm run test --workspace=@marketplace/api -- src/modules/payments` — 39/39,
8 файлов (.tmp/payment-recovery-payments-1.log). API typecheck и
`npm run build --workspace=@marketplace/api` PASS (api-types-1/build-1.log).
`git diff --check` PASS. Это не общая приёмка B040.

Focused PG: `node scripts/verify-payment-recovery.mjs`, approved disposable
dentmarket_audit_20260914; mock provider, два реальных Prisma connections.
Попытка1: authorize rollback/recovery/race PASS; setup следующей fixture FAIL
из-за unique active cart. Исправлено CHECKED_OUT для тестовой корзины.
Попытка2: authorize/cancel PASS; cleanup FAIL: immutable financial ledger delete
запрещён БД, скрывал исходную capture exception. Cleanup исправлен без отключения
ограничений: synthetic immutable ledger сохраняется в disposable DB.
Попытка3: authorize/cancel PASS; capture race FAIL: raw SELECT FOR UPDATE при
Serializable получает SQLSTATE40001 как Prisma P2010 (meta.code=40001), тогда как
catch обрабатывает только P2002/P2034. Один capture успел commit; второй ошибся.
Это не duplicate provider effect, но параллельный replay не возвращает результат.
Логи .tmp/payment-recovery-pg-{1,2,3}.log, исходный дефект оставлен видимым.
После третьего FAIL gate остановлен по AGENTS §7.1; новых попыток не было.
Payout PG не достигнут. Общий PG, runtime, dependent suites, lint NOT_RUN.
Inventory consumption race и HTTP role/validation требуют дальнейшего evidence;
controller schema/permission decorators только просмотрены, не HTTP PASS.

Один остаточный fixture group попытки2 очищен отдельной cleanup-операцией
в той же disposable DB; остальные fixtures очищены finally. Immutable synthetic
ledger rows намеренно оставлены; working DB/dev/livePSP не затронуты.
Никаких commit/push/deploy. Предшествующий staged/unstaged WIP сохранён.

Следующий точный шаг после разрешения продолжить заблокированный gate:
обработать именно Prisma P2010 + meta.code40001 в capture catch с lookup уже
зафиксированной matching transaction, добавить regression и повторить focused PG.
Не расширять это до blanket retry всех raw-query ошибок. Затем payout/stock/
HTTP proof и оставшиеся completion checks. Эта историческая остановка не разрешала цикл6.

## Возобновление A05/A04 — план до изменения 04.11

После обсуждения конкретных блокеров владелец: «Окей, бро, давай начинать тогда».
Разрешённое продолжение: A05, затем браузерная приёмка A04; A07–A11 не начинать.
Git main@e9431988, ahead6; предыдущие payment/session и docs изменения сохранены.
Новый цикл проверки обусловлен исправлением диагностированного P2010/40001,
а не сменой сессии. Исторические PG FAIL1–3 остаются действительными.

Изменяемое поведение: параллельный capture после сохранённого успеха провайдера
находит уже зафиксированный результат вместо необработанного serialization error.
Узкая проверка Prisma-кода и SQLSTATE; другие raw-query ошибки не поглощаются,
без завершённой транзакции успех не возвращается. API shape/schema неизменны.
Риск: деньги/stock/дубли ledger/outbox. Сначала failing regression, затем focused
payments после исправления; PG rollback/race четырёх операций и реальный stock,
HTTP validation/role/tenant, dependent payments/refund/inventory/ledger suites,
API types/build, required PG/runtime и lint/diff. Изолированная тестовая БД,
mock PSP, без working DB и внешних платежей. Бюджеты прежние; до трёх попыток
на gate возобновлённой фазы с изменённым кодом/гипотезой.

Development Toolkit (backend/execution/verification) продолжает применяться;
устаревшие ссылки его профиля не заменяют обновлённый AGENTS/roadmap.

## Итог возобновления A05

Исправлен только распознаваемый serialization conflict capture: Prisma P2010
с meta.code40001 получает тот же scoped lookup завершённой операции, что
P2002/P2034. Если транзакция не найдена, исходная ошибка сохраняется; иные
SQLSTATE не перехватываются. Повторного вызова PSP или blanket retry нет.

Новые regression до исправления: 2 FAIL/13 PASS, ожидаемо воспроизведён пропуск
P2010/40001. После исправления payments43 PASS, dependent105 PASS/17files
(payments, inventory, checkout, orders, finance, payment-captured handler).
`npm run typecheck --workspace=@marketplace/api` PASS1;
`npm run build --workspace=@marketplace/api` PASS1. API shape/Prisma schema
не менялись; применённые миграции не редактировались.

Focused `node scripts/verify-payment-recovery.mjs`: возобновлённые попытки1/2
остановились на новых stock fixtures: отсутствующий canonicalName, затем
обязательный cartItemId для негift строки. Исправлены только тестовые данные
по схеме/migration constraint. Attempt3 PASS: authorize/cancel/capture/payout,
настоящий rollback после записей, две connections, matching key, tenant denial,
один provider effect/transaction/audit/outbox. Balance/lot/reservation/order
после rollback неизменны, после race и replay потреблены ровно один раз.

`npm run db:test -- exec -- node scripts/verify-payment-recovery-http.mjs`:
attempt1 ожидал403 для подставленного tenant header, фактически ранний401;
attempt2 обнаружил отсутствие requestId у этого раннего identity rejection.
Наблюдение отдельно записано в Matrix, error-envelope в целом не сертифицируется.
Attempt3 PASS для всех четырёх HTTP-команд: реальный JWT/session, role403,
foreign tenant403, подставленный tenant401, invalid input400, другой key409,
recovery/replay201. Провайдер с уникальным тестовым кодом не имеет runtime
адаптера: успешное HTTP-восстановление читает сохранённый результат без него.

Completion PASS1: общий PostgreSQL через
`npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs`,
`node scripts/verify-runtime-split.mjs`, `npm run lint`. Schemas inputs/artifact
не изменены; готовый API build использован для обоих alias-gates без повторной
сборки. После уточнения HTTP assertion выполнен scoped ESLint этого script.
`git -c core.safecrlf=false diff --check` PASS.

Логи `.tmp/payment-recovery-resume-{regression-before,payments-1,dependent-1,
build-1,types-1,pg-1,pg-2,pg-3,http-1,http-2,http-3,postgres-1,runtime-1,lint-1}.log`.
DB identity проверена: dentmarket_audit_20260914. Транзакционные fixtures удалены,
неизменяемые synthetic ledger и отозванные HTTP fixture users остаются только
в disposable DB. HTTP/API процессы завершены; working DB/dev/live PSP не затронуты.
Source review: confirmed proof binding, process claim, общий intent lock,
payout lock, atomic stock/ledger/outbox и отсутствие широкого SQL retry.
Новых подтверждённых дефектов в recovery scope не выявлено.

A05 локально принят в границе B040; production R4/П10 и live PSP остаются открыты.
A04 выполняется следующим по текущему явному поручению. Публикация не выполнена:
предыдущие шесть outgoing commits не получают разрешения на push от этого ремонта.
