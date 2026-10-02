# CORE-07 — внутренние метрики и расчёт комиссии

Статус: CI_FIX_LOCAL_PASS02.10, публикация исправления впереди. Возобновлено владельцем («продолжай») после
обновления правил соразмерной проверки. Primary01a0f302-2d38-75d1-b79c-141e7428b533, один writer.

Новый план проверки: сначала pure date test (попытка4 после явного возобновления),
целевые schema/client/confirmation regressions; API494 PASS переиспользовать
для неизменного поведения, новые backend изменения проверять сразу. Затем
Prisma validate, isolated upgrade/PG exact money/tenant/replay/rollback, core
contract/runtime composition, типы/build affected consumers и targeted browser
analytics/confirmation. Полный npm test/canonical E2E не запускать автоматически;
CORE09 комплексная приёмка остаётся позже. История прежних FAIL ниже сохранена.
AGENTS.md и Workflow — отдельные разрешённые владельцем policy WIP, сохранить,
не включать в продуктовый commit. Новых внешних интеграций/рабочих migrations нет.
Основание: действующее поручение02.10 закончить CORE06–09+итоговый аудит,
самостоятельно устраняя блокеры. CORE06 завершён4023881, CI36976595298 и
Security36976595308 SUCCESS. Требования: Product22.10/23.6, Foundation6.2.
Canonical root/main40238812d4b7b0014ec23cd50a11825cfe0b0099; пять прежних WIP
(.codex/project-session.json + четыре legacy next-env) сохранить. Собственные
незакоммиченные docs — receipt CORE06, Foundation/Matrix/Handoff/PRIMARY.

## Результат и граница

Оператор: защищённые метрики created/confirmed/received/repeat30/60,
отказы по цене/остатку, задержки, разрезы покупатель/поставщик и ссылки на заказы.
Поставщик/клиника: только собственные организационные данные в применимом UI.
Период событий, timezone, валюта/minor units и dedup определены контрактом.
Общий оборот считает сделку один раз; разрезы обеих сторон не суммируются снова.
Demo/test отделены; неполные исторические источники явно обозначаются.

Комиссия10%: предварительный расчёт при создании, начисление по фактически
полученному клиникой товару после скидок; корректировка при получении возвращённого
товара поставщиком. Доставка/переплата исключены, суммы точные, retry не начисляет
повторно. Старый PaymentAllocation.platformFeeMinor не является этим расчётом.
Поступившая комиссия/задолженность недоступны без учёта оплаты поставщиком;
не подменять их нулём и не создавать фиктивное удержание/банковское подтверждение.
Юридический счёт, НДС, договорный график, взыскание, внешние KPI/интеграции вне scope.

## Проверенная исходная реализация

LiveMetrics/workspace summary считают объекты; SearchAnalytics считает поисковые
запросы. Целевой commerce report/commission ledger отсутствует. SupplierOrder
subtotal/items изменяемы; нельзя выдать текущее значение за историческую сумму
создания. Buyer receipt — OrderWorkflowService.receive (cumulative quantities),
а не logistics transition: там получение поставщиком запрещено. Событие workflow
имеет id/time/replay, return имеет goodsReceivedAt/amount/kind. Confirmation
имеет audit/outbox и free-text reason; структурированной причины PRICE/STOCK нет.
Dataset label у организаций отсутствует. Нельзя классифицировать старые данные
как рабочие только по названию или окружению.

## Маршрут реализации

Общие query/response/event contracts → минимальное хранение immutable metric/
commission facts и dataset provenance → запись в существующих транзакциях
checkout success/confirmation/buyer receipt/goods return → protected aggregates,
OpenAPI/client → Fluent UI отчёт с filters/loading/empty/error/coverage.
Сначала сверить существующие money helpers/округление и retry boundaries.
Legacy coverage остаётся явной; не выполнять выдуманный исторический backfill.
Scope не меняет бизнес-правила оплаты/возврата ради удобства аналитики.

## Gates / evidence / остановка

Root typecheck/unit/diffcheck; schema/API build/core-contract; Prisma validate,
изолированный upgrade-path; PostgreSQL exact money/partial receipt/returns/
replay/concurrency/tenant/dataset/window; runtime split; web build/bundle,
canonical browser и targeted analytics desktop1440/mobile390/keyboard/error.
Self-review, scoped commit/push main, remote SHA и фактический CI/Security.
После green — CORE08, затем CORE09 с итоговым аудитом согласованного контура.
Попытки новых gates0; probe2m/server5m/command20m/suite45m. Не повторять без
изменения гипотезы/входов; попытки сохранять. Решение владельца о самостоятельном
устранении блокеров сохраняется, проверки не ослаблять.

DB writes только через db:test в dentmarket_audit_20260914. Рабочая БД,
новые migrations в ней и reseed не разрешены этой реализацией. Dev остановлен,
нет dev-процессов. Рабочая150000 не применена.

## Реализация и проверки02.10 — текущий checkpoint

Добавлены shared report/query contracts, OpenAPI/client, ADR016, additive150000:
dataset организаций/заказов, structured refusal reason, immutable metric facts.
Checkout/confirm/receipt/return пишут факты в исходных транзакциях; fee10%
округляется кумулятивно BigInt. Завершение после монтажа также фиксируется.
Защищённый RepeatableRead отчёт: tenant до агрегации, period/dataset/currency,
разрезы сторон, bounded events, repeat30/60, текущие просроченные поставки.
UI добавлен для оператора и своих clinic/supplier orders, без fake collection.
Реализация ещё не принята: впереди PostgreSQL/browser/self-review.

Prisma client сгенерирован; schema build1 PASS. Typecheck1 PASS13/13,
1m36.231s, `.tmp/core07-typecheck-1.log`; после него изменены fulfillment hook,
tests/cleanup — финальный typecheck будет нужен. Unit attempts:

1. `npm test` — FAIL1m9.991s, `.tmp/core07-unit-1.log`: checkout snapshot mock
   не содержит supplierOrder.findMany для ledger; также buyer UI cold import
   timeout. Mock дополнен фактическим snapshot и assertions exact amount/replay.
   Аналитика вынесена из общего barrel в отдельный UI subpath.
2. `npm test -- --concurrency=1` — CLI_ERROR, suite NOT_RUN: root alias уже
   содержит concurrency2, Turbo не принимает второй флаг. Попытка сохранена.
3. `node_modules/.bin/turbo.cmd test --concurrency=1` — FAIL59.009s,
   `.tmp/core07-unit-3.log`: API98files/494tests PASS; новый UI date test импортирует
   Fluent barrel и падает при collection на Tabster named export. Расчёт дат
   вынесен в pure commerce-analytics-date.ts, test импорт исправлен. После этого
   исправления повторный запуск NOT_RUN по лимиту AGENTS§7.1 / Workflow4.3.

Остальные07 gates NOT_RUN: Prisma validate/migration upgrade, API build/core,
PostgreSQL/runtime, webbuild/bundle/browser, final typecheck, self-review/CI.
PG fixtures расширены exact money/split receipts/returns/replay/rollback,
tenant/dataset/operator/window; browser добавлен для3 ролей1440/390/keyboard/error.
Эти новые сценарии пока не выполнены. Рабочая БД/миграция/seed не тронуты.
Собственные процессы завершены, dev остановлен как до07. Commit/push07 нет.
Следующий точный шаг после возобновления: полный unit graph последовательно
`node_modules/.bin/turbo.cmd test --concurrency=1` с pure date import, затем
оставшиеся gates CORE07. CORE08–09 не начинать до полного PASS07.

## Свежий evidence02.10, 14:15+05

CI1(36989630820) FAIL в npm test: admin performance-boundaries ожидал20
dynamic panels, фактически21 с новой commerce analytics. Остальные unit suites
PASS (включая API499, buyer97, web55); PostgreSQL и оба container jobs PASS,
Security36989631017 PASS (CodeQL/dependencies). Это пропущенный локальный
consumer test, не runtime дефект. Исправлен expected inventory21 и добавлены
assertions lazy import analytics/отсутствия eager import. Целевой полный admin
suite `npm run test --workspace=@marketplace/admin-web` PASS23/23,2.55s,
`.tmp/core07-admin-ci-fix-1.log`. Runtime source, schema, dependencies и fixtures
не менялись: ранее local PG/build/browser evidence переиспользуется. Scoped
admin typecheck PASS (`npm run typecheck --workspace=@marketplace/admin-web`,
`.tmp/core07-admin-ci-types-1.log`), diff review PASS. Test-only corrective
commit/push и второй CI — следующий шаг; новые runtime проверки не нужны.

Публикация02.10: commit3f2002b6791f3ff102854791afbe136b83bacc9c,
`feat: add tenant-scoped commerce analytics and commission facts`,59files.
Fetch: origin/main совпадал с HEAD4023881 (0/0); обычный push main успешен,
`git ls-remote origin refs/heads/main` подтвердил exact3f2002b. Scoped staged
diff-check/manifest/secret-pattern review PASS. Остались только5 прежних WIP
и AGENTS/Workflow policy WIP. CI36989630820 и Security36989631017 IN_PROGRESS.
CORE08 пока только read-only подготовка, код не изменяется до CI_PASS07.

Финал local02.10 14:20+05: core-contract2 PASS46 core operations/174 components,
web build1 PASS44 routes, bundle1 PASS. Typecheck2 PASS13/13, 1m25.285s.
Browser1 PASS1/1 (13s); browser2 дополнен реальным переходом в заказ каждой роли,
PASS1/1 (19.5s), `.tmp/core07-browser-{1,2}.log`. Команда:
`npm run db:test -- run e2e --workspace=@marketplace/e2e -- commerce-analytics.spec.ts`.
JWT/pilot, собственные API4012/web3000, только isolated DB; процессы завершены,
fixtures очищены. Проверены partial confirmation/structured STOCK, три роли,
1440/390, keyboard Enter, error/retry без сброса фильтров, empty BUSINESS,
ссылки до реального заказа (operator object included). Screenshots всех3 ролей
в `apps/e2e/test-results/commerce-analytics-CORE07--5384c-analytics-at-desktop-mobile/`
прочитаны: нет overflow страницы/обрезанных controls, таблицы mobile scroll.
После typecheck изменился только browser test (добавлены переходы); scoped e2e
typecheck PASS (`npm run typecheck --workspace=@marketplace/e2e`,
`.tmp/core07-e2e-types-final.log`). Runtime inputs прежние.
Delivery manifest `.tmp/core07-delivery-files.txt`, SHA256 input snapshot
`.tmp/core07-delivery-hashes.csv`;59 scoped paths. Пять прежних WIP и чужие
policy AGENTS/Workflow исключены. Собственный generated web next-env восстановлен
к HEAD, legacy четыре next-env сохранены без записи.

Self-review по development-toolkit (backend/frontend/verification) и Agency
Code Reviewer/Git Workflow Master: tenant before aggregates, UTC boundary,
transaction/replay/money, new immutable facts vs legacy unknown coverage,
dataset snapshots, API refs, reachable role links, additive upgrade и cleanup.
Критических незакрытых дефектов в scope не найдено. Общий npm test и полный
canonical E2E после возобновления не повторялись по policy02.10: API494 baseline
и focused regressions/PG/targeted browser покрывают изменённые входы; прежние
FAIL не переписаны в PASS. Release/production suites остаются CORE09.
Далее scoped manifest/diff check, commit/push main и actual CI. Рабочая migration
не применена; analytics в рабочем dev пока не развёрнута. CORE08 не начат.

PostgreSQL3 PASS полностью, `.tmp/core07-postgres-3.log`: additive upgrade,
точные суммы >2^53, частичные receipts/returns, fulfilled installation, tenant/
dataset, repeat30/60, event pagination, inclusive/exclusive period и worker
cancel/race/replay/rollback/recovery. Профиль test, DB dentmarket_audit_20260914,
HEAD4023881 + CORE07 WIP (последний фикс transaction UTC). API/schema build
в этом прогоне PASS и переиспользован ниже без повторной сборки.

Prisma validate1 PASS: `npm run db:test -- exec -- prisma validate --schema
apps/api/prisma/schema.prisma`, `.tmp/core07-prisma-1.log`.
Runtime1 PASS: `node scripts/verify-runtime-split.mjs`, `.tmp/core07-runtime-1.log`:
api/worker/all schedule+queue capabilities, entrypoint guards, production all denied.
Core-contract1 PASS45 operations; inspection обнаружил, что новый endpoint
ещё не был обязательным в assertOpenApiContract. Добавлены analytics response,
query и bearer assertions; core-contract2 выполняется на том же API artifact:
`npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only`,
`.tmp/core07-core-contract-2.log`. Это дополнительное покрытие, без изменения API.
Web build1 выполняется pilot (DEPLOYMENT_PROFILE/NEXT_PUBLIC_DEPLOYMENT_PROFILE):
`npm run build --workspace=@marketplace/web`, `.tmp/core07-web-build-1.log`.
Далее bundle, scoped final types и targeted canonical browser analytics (включает
supplier confirmation), без повторения полного E2E. Рабочая DB не менялась.

## История возобновления и вопросы

PG2 FAIL14:10: boundary include-start. Expiry dedup/race/rollback/recovery и
anonymous401 теперь PASS. Read-only isolated SQL probe доказал session timezone
Asia/Qyzylorda: timestamptz Date parameter сдвигал сравнение timestamp на5ч.
Исправлено SET LOCAL TIME ZONE UTC внутри report RepeatableRead transaction;
probe с тем же timestamp подтвердил inclusive start/exclusive end. PG3
по этой конкретной гипотезе, `.tmp/core07-postgres-3.log`; runtime build refreshed.
Прежние PG attempts не сброшены. Новый backend20 PASS остаётся валиден кроме
добавленной transaction timezone, которую доказывает SQL probe + PG3.

Возобновление02.10: pure date test4 PASS1/1 (1.12s), schema targeted1 PASS44/44,
client targeted1 FAIL из-за сравнения identity составного AbortSignal; тест
исправлен на фактическую отмену, targeted2 PASS7/7. Confirmation model targeted1
PASS19/19. Logs `.tmp/core07-ui-date-4.log`, `core07-schemas-targeted-1.log`,
`core07-client-targeted-{1,2}.log`, `core07-confirmation-targeted-1.log`.
PostgreSQL1 FAIL: `npm run verify:postgres`, `.tmp/core07-postgres-1.log`;
schema/API build, additive upgrade и прежние PG scenarios PASS, новый report
дошёл до anonymous assertion: сервис возвращал403 вместо ожидаемого401, данные
не раскрывались. Теперь missing actor401 отдельно от missing organization403.
Дополнительно закрыт пропуск cancellation metric у reservation expiry:
та же transaction, только новая отмена COMPLETED checkout, без FAILED/terminal.
PG assertions проверяют concurrent/replay, cancel race, rollback/recovery.
Focused backend1 PASS20/20, 4.20s: `npm run test --workspace=@marketplace/api --
src/modules/inventory/reservation-expiry-metrics.spec.ts
src/modules/inventory/reservation-lifecycle.spec.ts
src/modules/commerce/commerce-metric-facts.spec.ts`, `.tmp/core07-backend-focused-1.log`.
PostgreSQL2 запускается по изменённым inputs (auth code+expiry facts+assertions),
изолированная test DB; `.tmp/core07-postgres-2.log`. Прежний общий unit
FAIL остаётся историей; blocker pure import теперь подтверждённо устранён.

Q01 production guards сохранить (ответ владельца ранее), внешние сервисы отдельно.
НДС/график комиссии остаются вне внутреннего расчёта; повторно их не спрашивать.
Новых обязательных решений на старте нет.
