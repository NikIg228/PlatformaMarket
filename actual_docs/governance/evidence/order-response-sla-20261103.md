# П03 — час содержательного ответа, 03.11.2026

## Scope и план до реализации

Поручение владельца: «Приступаем к п03». База main@c70beeaa, единственная
папка C:/Users/user/Desktop/dentmarket-kz-main. Чужие checkpoint hunks,
apps/web/AGENTS.md и output сохраняются; делегирование не разрешено.
П02 завершён: code92344019, CI41501353701/Security41501353652 PASS,
рабочая миграция применена, dev восстановлен. Его evidence переиспользуется
только для неизменённых входов. П03 не разрешает П04 или production deploy.

Результат: 45 рабочих минут — одно напоминание поставщику;60 — просрочка
и событие сторонам;120 — одно операторское дело. Использовать сохранённый
календарь и исходный срок. Содержательное подтверждение/конкретное предложение/
отказ с причиной прекращают дальнейшие эффекты; просмотр и обычный чат — нет.
Состояние доступно в кабинетах обеих сторон, дело — существующей поддержке.
Внешние провайдеры/доставка сообщений остаются в П27.

Риски: дубли при restart/replay/нескольких workers, гонка ответа и таймера,
изменение календаря, пересечение tenant/permissions, потеря события/дела при
rollback, смешение с действующим30-минутным резервом или payment-review15/30/60.
Существующие reserve/payment guards не расширять. Прекращённый заказ не должен
получать новые просьбы подтвердить его; эта совместимость проверяется отдельно.

Последовательность: общая схема состояния → атомарный scheduler на готовой
BackgroundQueueService с DB fallback/dedup → реальные PG проверки до зависимого
UI → client/проекции/уведомления/интерфейс → browser/evidence/публикация и CI.
Точки ответа уже существуют в CommerceService.confirmSupplierOrder;
конкретные предложения новой версии — П04, не реализуются заново здесь.

Focused: vitest новых rules/service и затронутых commerce/notification tests,
затем disposable PostgreSQL dentmarket_audit_20260914:45/60/120 границы,
перерыв/ночь/исключение/смена графика, restart/replay/concurrency, rollback,
ответ/отмена против tick, права и tenant reads, отсутствие событий старых заказов.
Completion: affected API/schemas/client/web types/build, Prisma validate и
upgrade-path при migration; core-contract/PostgreSQL/runtime-split по server
impact, targeted browser обеих сторон/оператора RU/KK1440/390 и keyboard,
loading/error/recovery, screenshot/computed styles; lint/UI-contract/diff hygiene.
Точные команды/попытки записываются по мере выбора fixtures. Не переустанавливать
dependencies. Лимит3/gate; probe2m, startup5m, command20m, suite45m, blocker15m.
Рабочая миграция/остановка текущего dev не входят в разрешение П02 автоматически;
при необходимости подготовить точную операцию и получить отдельное решение.

## Серверный блок

Подготовлены5nullable полей SupplierOrder, FK/unique операторского дела,
additive migration20261103000000_order_response_sla. Схемы response/inbox,
queue scheduler45/60/120 с row-lock/DB markers, transactional notifications/
audit/support/outbox; confirm фиксирует responseReceivedAt в той же транзакции.
Существующие reserve/payment guards сохранены. PostgreSQL script подготовлен,
подключён в focused --response-only и полный verify:postgres; ещё NOT_RUN.

PASS attempt1: `npm run build --workspace=@marketplace/schemas`;
`npm exec --workspace=@marketplace/api -- vitest run src/modules/commerce/order-response.service.spec.ts src/modules/commerce/supplier-calendar-rules.spec.ts src/modules/commerce/commerce-rules.spec.ts src/modules/notifications/notification-inbox.spec.ts`
—34tests; целевой eslint10files, `node --check` обоих PG scripts, diff hygiene.
`npm run db:test -- exec -- npm exec --workspace=@marketplace/api -- prisma validate`
—PASS, target dentmarket_audit_20260914. Логи `.tmp/p03-*-1.log`.

Владелец03.11 явно разрешил остановку, рабочую миграцию после приёмки и
восстановление dev. Проверены launcher21328/dev-local13696 и ancestry API10460/
web15120; остановлено только это дерево (список `.tmp/p03-stopped-dev-pids.json`).
`npm run db:generate` attempt1 PASS; API build1 выполняется. Рабочая БД не менялась.
UI ещё не реализован; П03 не завершён, WIP не публиковать.

API build1 PASS. Focused PG1 FAIL: Prisma nested connect выполнял запись
responseEscalatedAt и FK раздельно, CHECK правильно отклонил неполное состояние.
Исправлено на единый scalar update, CHECK сохранён. Response unit2(13tests) и
API build2 PASS. PG2 прошёл concurrency45/60/120/restart и tenant reads,
FAIL на ожидании401 anonymous: development identity guard workflow явно
возвращает403 для отсутствующего actor. Исправлен только expected status,
без изменения guard; PG3 выполняется. Первые ошибки не скрываются.

Focused PG3 PASS. Full PG1 FAIL: новый fixture index90 совпал с onboarding90;
поменян на свободный94. Full PG2 FAIL: реальная гонка confirmation/timer,
raw row-lock SQL вернул Prisma P2010/meta40001 вместо P2034. Расширен только
существующий bounded retry confirm на serialization/deadlock SQL codes.
Новый classifier2tests + response13tests PASS, API build3 PASS, full PG3 PASS.
Upgrade/rollback/real checkout+confirmation/tenant/stock/concurrency доказаны.

## UI и completion

Паспорт: market-components-v1 / platforma-semantic-light-v1, Manrope14/1.5,
controls44/radius8, FeedbackSurface padding16/gap12/radius12; существующий
order confirmation slot, calendar.module.css только композиция. Новых CSS,
shared overrides или генерации изображений нет. Сверены DESIGN_SYSTEM, оба JSON,
UI standard, local Next client docs и текущая screenshot П02. Antislop after
сохраняется из решения владельца; после browser нужен scoped аудит.
React Best Practices применён к двумTSX: без нового fetch/effect, данные и
recovery из существующего OrderWorkflowWorkspace polling5s; даты выводятся
по snapshot timezone. Операторское дело переиспользует существующий support UI.

Web types1/build1, UI state3tests, client build1, targeted eslint2 и
UI-contract1 PASS. Core-contract1 через underlying script PASS после schemas/API
build; runtime-split1 PASS с теми же API artifacts. Логи `.tmp/p03-*.log`.
Browser1 FAIL до запуска: отсутствовал POSTGRES_TEST_DATABASE_URL; browser2
через `npm run db:test -- exec -- node .tmp/p03-browser.mjs` выполняется.
Fixture synthetic только для rendering; реальный checkout/confirm доказан PG.

Browser2 PASS: оба кабинета1440RU390KK, стадии45/60/120/late response,
auto-refresh5s,503 retained state/recovery, inbox, keyboard buyer case link,
реальный operator login и просмотр того же дела со ссылкой на заказ.
Screenshots/computed styles визуально проверены; Manrope14px/600.
Antislop after [audit002](../../../anti-slop/audit-002-2026-11-03.md) scoped PASS,
без находок; calculated contrasts записаны в audit. E2E types1 PASS.
Локальные fixtures/API/web остановлены, synthetic auth sessions отозваны.

Рабочий read-only preflight `.tmp/p03-migration.mjs`: только
20261103000000_order_response_sla pending в127.0.0.1:5432/marketplace.
После публикации/зелёного CI разрешены `node .tmp/p03-migration.mjs --apply`
и канонический `npm run dev`. Скрипт сверяет digest существующих бизнес-полей
заказов до/после и отсутствие ретроспективных событий. Пока writes не выполнялись.
П03 LOCAL_PASS, публикация/CI/migration/dev restoration ещё не завершены.

Совместимость: действующий30-минутный локальный reserve может отменить заказ
раньше45рабочих минут. П03 не продлевает резерв и не напоминает об ответе на
отменённый заказ; новый P1 без доплатёжного резерва относится кП07. Это граница
поэтапного внедрения, не заявление о готовности всего согласованного lifecycle.
