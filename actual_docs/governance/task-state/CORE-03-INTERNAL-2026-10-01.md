# CORE-03-INTERNAL — исполнение, возврат и повторная закупка

Обновлено01.10.2026. CI_PASS / DEV_RESTORE_PENDING_APPROVAL.
Владелец primary01a0f302-2d38-75d1-b79c-141e7428b533, единственный writer.
Основание: разрешённая внутренняя очередь Foundation6.2 и «продолжаем» после
CORE02. CORE02 CLOSED/CI_PASS, dev восстановлен; receipt60e44a5 опубликован.
Checkout canonical root, main@60e44a578e584c3f97f801649f0267a2f7dc87ee.
Пять прежних WIP сохраняются. Другие worktrees/агенты не создаются.

## Scope / DoD

CORE03.1–03.4: несколько ручных отгрузок и частичное получение клиникой;
заявка отмены после оплаты с подтверждением остановки поставщиком;
возврат согласованных количества/состояния товара и раздельные состояния
возврата денег (согласован/отправлен/получен); отдельная повторная закупка
с revalidation текущих условий. Только внутренний учёт, synthetic fixtures.
Внешние перевозчики/банки, реальная отправка денег, комиссия и акции вне scope.
Источник — [Product23.6](../../product/DENTMARKET_PRODUCT_V2.md#236-согласованные-правила-реализация-отложена--28092026),
[Foundation6.2](../../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md).

Inventory: OrderWorkflowService уже сериализует receipt/version/replay и
считает суммарное получение; LogisticsService создаёт несколько shipments.
Обнаружен пробел: статус одной новой отгрузки может откатить общий статус
частично полученного заказа; fulfillment transitions читаются до write lock.
Refund привязан к PSP paymentIntent/allocation и не подходит ручному переводу.
Cart recovery разрешает только FAILED checkout, не повтор завершённого заказа.
Использовать эти существующие границы, не переписывать checkout/доставку.

Контракты сначала в schemas → API/client/OpenAPI → shared Fluent UI.
Денежные операции — exact minor units, order lock, tenant/party authority,
version/idempotency, audit/outbox; оператор не подтверждает чужие деньги.
Возврат не зачисляет кошелёк и не делает товар автоматически пригодным к продаже.
UI: история и понятные состояния отдельного обращения, сохранение draft/conflict,
keyboard и390px/desktop; новые компоненты вне большого route/workspace файла.

Gates: schema/unit/typecheck, API/web build + bundle, core-contract,
verify:postgres (upgrade, quantity/money, races/rollback/replay/tenant),
runtime-split, canonical browser + real API critical flow, docs/diff/review,
commit/push и фактический CI. Fixtures только disposable audit DB.
По3 попытки/gate,20мин command/45мин suite; inputs и причины rerun фиксируются.
Dev из canonical root: launcher4980, API13036/web18452 на4012/3000,
go_live. Перед generate/build/browser остановить только свой восстановленный
запуск, затем восстановить; новые рабочие миграции этим scope не разрешены.

Прочитаны Toolkit execution/backend/verification/frontend и project profile,
UI standard, Agency Backend Architect; остальные релевантные роли перед review/UI.
Следующий шаг: завершить контракт и минимальный дизайн возвратов/reorder,
исправить агрегирование shipment state и гонки, добавить targeted regressions.

## Реализация / проверки

Добавлены additive OrderManualReturn/миграция120000, schema workflow actions,
exact cumulative refund rounding, party authority и последовательность
согласован → товар отправлен/получен → деньги отправлены/получены.
Отмена до отгрузки восстанавливает только локальный резерв; возвращённый товар
после доставки не возвращается в продажу без отдельной проверки пригодности.
Reorder сохраняет historical snapshot для явного old/new diff в существующей
корзине; checkout по-прежнему требует текущих условий и согласия на изменения.
Новые Fluent панели загружаются lazy. Роль Frontend Developer прочитана полностью;
Agency Code Reviewer и Toolkit review применены при self-review.

Свой восстановленный dev остановлен: проверена ancestry4980→17992→13036/18452,
taskkill4980/T; чужие процессы не останавливались. Генерация Prisma и schema build
PASS. Рабочая БД остаётся на CORE02; миграция120000 туда не применялась.
Typecheck1 FAIL: BigInt literals в legacy ES target; заменены на BigInt(0).
Typecheck2 FAIL: неверное поле InventoryBalance.available; исправлено на
availabilityStatus по существующему stock contract. Typecheck3 PASS13/13,
1m05s, `npm run typecheck -- --continue`;11 unchanged cached tasks.
Лимит этих попыток сохранён. Логи `.tmp/core03-typecheck-attempt*.log`.
`npm test` attempt1 запущен; остальные PG/API/build/browser gates ещё NOT_RUN.

Unit1: API92files/462tests и остальные задачи PASS, buyer96/97 PASS + один
5s timeout cold import в неизменённом order-profile. После завершения общей
нагрузки targeted attempt2 того файла PASS2/2 за1.17s без изменения assertion/
timeout; остальные неизменённые результаты переиспользованы.

PG1 FAIL на прежнем60-minute escalation. Диагностика воспроизвела
`workingMinutesElapsed(11:00:00.007,12:00:00.007)` =59.99999999999999:
дробное накопление минут теряло порог. Минимальный blocking fix — целые
миллисекунды; unit regression15/30/60 ±1ms PASS5/5 (rules attempt2).
PG2 `npm run verify:postgres` PASS: общий suite + CORE03 split/receipt/install,
точные суммы/роли/стадии/повторы, отмена с восстановлением stock, race отгрузки,
reorder/current-price consent. Upgrade всех additive migrations в rollback schema
PASS; новая таблица не создаёт исторические возвраты. Cleanup завершён.

Prisma validate через db:test PASS. API build из PG2 PASS; code/type/unit inputs
учтены после timer fix. Core contract (underlying --contract-only с выполненными
prerequisites PG2), runtime-split PASS. Web pilot build1 и bundle1 PASS.
E2E scoped typecheck PASS после добавления real API refund flow.
Canonical browser1 запущен, затем отдельный real API checkout-snapshot1.
Миграция120000 подготовлена к отдельному разрешению для marketplace/public;
до ответа не применять. Собственный dev остановлен для этих проверок.

Canonical browser1 PASS46/46. Real API desktop1440 PASS24.1s; mobile390
attempt1 FAIL: auth/workspace-context429 после двух последовательных journeys
превысил20/IP/minute. Production limit не изменён; между journeys добавлено
ожидание полного окна. Teardown теперь очищает fixtures даже при закрытой page.
Оставшийся synthetic fixture удалён по точным ID с проверкой buyer/user/SKU
в disposable audit DB. Mobile attempt2 PASS19.0s; desktop неизменён REUSED_PASS.
Scoped E2E typecheck после test-only исправления PASS. Screenshots
outputs/core03-live-refund-{1440,390}.png просмотрены, overflow отсутствует.
Логи .tmp/core03-live-browser-attempt{1,2}.log; .tmp/core03-browser-attempt1.log.

Self-review по Agency Code Reviewer/Toolkit: party authority, order/inventory
locks, exact money, receipt ownership/reuse, additive migration, UI states и
current-price revalidation проверены. Новых unresolved blockers не обнаружено.
OpenAPI/client используют общий OrderWorkflowCommand; core-contract PASS
121 schemas/303 operations/45 checks подтверждает синхронность. Production
config/release не запускались: инфраструктура и release scope не менялись.

Локальные gates завершены. Pending: commit/push, фактический CI; отдельно
запрошено разрешение новой рабочей миграции120000 и восстановления dev.
До разрешения marketplace/public не менять. CORE04 ещё не начат.

Опубликован1abeb4de5c0a6a394bfbe6e0b1e063529e6d5f4c вorigin/main;
remote SHA совпал. CI36859245986 / Security36859246168 запущены, pending.
Все32 staged paths сверены с .tmp/core03-reviewed-paths.json, source hashes
сохранены .tmp/core03-source-hashes.json; diff/check и docs links PASS.
Пять прежних WIP вне commit; собственных running dev/test процессов нет.

## Итог опубликованного кода

main@1abeb4de5c0a6a394bfbe6e0b1e063529e6d5f4c: remote SHA подтверждён.
[CI36859245986](https://github.com/NikIg228/PlatformaMarket/actions/runs/36859245986)
и [Security36859246168](https://github.com/NikIg228/PlatformaMarket/actions/runs/36859246168)
SUCCESS. Оба контейнера, PostgreSQL/authority/backup-restore, полный
typecheck/unit/build/budget, core/runtime/production/config/security,
extended API и оба canonical browser gates PASS на этом кодовом SHA.
Последующая запись только docs, runtime evidence переиспользуется.

Кодовый CORE03 принят во внутреннем synthetic scope. Рабочая БД остаётся
на CORE02;120000 не применена. Вопрос владельцу о новой локальной миграции
и восстановлении dev задан, ответа пока нет. Не трактовать отсутствие ответа
как согласие. Единственный следующий шаг: после явного разрешения применить
только120000 к marketplace/public с before/after catalog guard, без seed,
и восстановить dev3000/4012 go_live из canonical root. Тогда продолжить
разрешённую очередь с CORE04 после сверки уже принятого scope; не повторять
завершённые CORE04.1–04.5 автоматически. Внешние интеграции/боевые данные вне scope.

Применены Development Toolkit execution/backend/frontend/verification/review,
Agency Backend Architect, Frontend Developer и Code Reviewer: границы данных,
существующий Fluent UI и self-review инвариантов. Отдельных агентов не запускали.
