# П02 / R4.1.2 — календарь поставщика

Статус: IN_PROGRESS. Владелец02.11 после явного вопроса о незакрытом CI П01
повторил «приступай к п02»: разрешён переход кП02, FAIL П01 не переименован в PASS.
База реализации: main, e96afbece671afcf0052267194bef948755d10a8, canonical root.
Новый чужой docs commit о первых10ответах сохранён; product code не изменён.

## Scope и решения

Поставщик редактирует дни, интервалы, перерывы и исключения по датам.
Владелец02.11 выбрал fallback пн–пт09:00–18:00 по времени Казахстана.
Timezone contract: IANA Asia/Almaty по умолчанию; хранить выбранный пояс в
календаре и snapshot заказа. Праздники — только подписи, без исключения часов.
Источник2026: https://www.gov.kz/org/enbek/documents/details/1034069,
официальный календарь Минтруда, обновлён29.06.2026, проверен02.11.
Не переносить даты прошлых редакций автоматически на будущие годы.
Новые заказы получают snapshot версии календаря и неизменяемый срок ответа.
Старым заказам не назначать задним числом новую просрочку. Напоминания45/60/120
и операторское дело относятся кП03; денежные правила не менять.
Antislop: after, явный выбор владельца02.11 в этом чате. После реализации
отдельный аудит; исправления его предложений только по выбранным пользователем пунктам.

## План до реализации и проверки

1. Общие schema/request/response/errors, validation интервалов и дат.
2. Pure расчёт рабочих минут и deadline: ночь, перерыв, выходной, исключение,
   timezone, границы минут; focused tests сразу после coherent поведения.
3. Версионированное хранение, authenticated scoped read/save, CAS/idempotency,
   audit/outbox, snapshot в checkout и projection срока в заказе.
4. Typed client, редактор настроек поставщика и срок в заказе обеих сторон;
   loading/empty/error/conflict/recovery, RU/KK, keyboard/mobile.
5. Приёмка и scoped публикация только после обязательных PASS.

Риски: чужой tenant/role, пересечение интервалов, бесконечный поиск рабочего
времени, смена timezone/графика двигает старый срок, гонка save/checkout,
потеря draft, смешение календаря ответа и существующей политики проверки перевода.
Проверки: schemas/client и focused backend после каждого поведения; PG на
проверенной disposable DB (upgrade/rollback/permissions/tenant/CAS/replay);
core-contract/runtime по изменению API composition; API/web и затронутые
packages types/build, scoped lint/UI-contract, browser screenshot/computed
styles1440/390/RU-KK/keyboard и affected consumer tests. Diff hygiene.
Рабочую БД не мигрировать; dev не останавливать без необходимости/основания.
Budget: probe2m/start5m/command20m/full suite45m/blocker15m, максимум3attempts.
Все gates П02 NOT_RUN. Зелёные gates П01 не считать доказательством П02.

## Реализация и проверки02.11 — backend WIP, не ACCEPTED

Созданы supplier-calendar schemas и typed client; SupplierCalendarService/controller,
version/CAS/replay/auth/audit/outbox, pure расчёт рабочих минут. Checkout сохраняет
responseCalendar/responseStartedAt/responseDeadlineAt одной транзакцией; существующие
заказы миграцией не меняются. Миграция20261102000000_supplier_working_calendar
подготовлена, ни к рабочей, ни к disposable DB пока НЕ применялась.
Подготовлен scripts/lib/verify-supplier-calendar.mjs и --calendar-only в штатном
PostgreSQL runner (также подключён к полному gate): upgrade, HTTP права/tenant,
validation, concurrent CAS/replay, audit rollback, checkout snapshot/replay.

PASS: schema8; calendar rules7; service7; commerce rules7; checkout snapshot10;
client3 (итого42focused tests). schemas build, API typecheck, client typecheck,
eslint обоих PG scripts, diff hygiene PASS. Команды:
- npm run test --workspace=@marketplace/schemas -- supplier-calendar.test.ts
- npm run build --workspace=@marketplace/schemas
- npm run test --workspace=@marketplace/api -- supplier-calendar-rules.spec.ts supplier-calendar.service.spec.ts checkout-snapshot.spec.ts commerce-rules.spec.ts
- npm run test --workspace=@marketplace/api -- checkout-snapshot.spec.ts
- npm run test --workspace=@marketplace/api-client -- supplier-calendar.test.ts
- npm run typecheck --workspace=@marketplace/api-client
- npm run typecheck --workspace=@marketplace/api (log .tmp/p02-api-types-1.log)
- node node_modules/eslint/bin/eslint.js scripts/lib/verify-supplier-calendar.mjs scripts/verify-postgres-integration.mjs --max-warnings=0

Сохранённые FAIL: checkout attempt1 — mock не имел supplierProfile; добавлен
scoped fixture и assertion сохранённого календаря, attempt2 PASS10.
Client types1 — в новом test constructor отсутствовал обязательный options;
исправлено на {}, types2 и tests повторно PASS3.
Prisma generate attempt1 FAIL EPERM rename query_engine-windows.dll.node:
работающий локальный API удерживает DLL. Схема/типы сгенерированы частично,
это НЕ PASS генерации. Новую генерацию пока не запускали.

Ожидается ответ на отдельный запрос: остановить локальный стенд для генерации,
а после приёмки применить добавочную миграцию к рабочей БД и восстановить стенд;
альтернатива — только остановка без рабочей миграции. Ответа ещё нет.
Read-only процессная сверка: API4012 PID19056, web3000 PID22324, общий launcher
ancestor20696; перед любой остановкой заново проверить PID/command/parent.
Остановок и рабочих DB writes не было. API build/PG/core/runtime/browser/UI
ещё NOT_RUN; редактор и показ сроков в UI НЕ реализованы. Не публиковать WIP.
Следующее: после ответа безопасно остановить только разрешённый стенд,
generate2, API build, focused PG на disposable DB; исправить по evidence,
затем UI по DESIGN_SYSTEM и совместная приёмка. Antislop after принят владельцем.

Владелец ответил: «Разрешаю остановку, миграцию после приёмки и восстановление».
Повторно проверены launcher20696 и принадлежность API19056/web22324 его дереву;
остановлен только этот стенд. PID list .tmp/p02-stopped-dev-pids.json.
Prisma generate2 PASS, лог .tmp/p02-prisma-generate-2.log. API build1 выполняется.
Рабочая миграция разрешена только ПОСЛЕ приёмки, пока не выполнялась.

## Продолжение: backend gates и паспорт UI

API build2 завершён; focused PostgreSQL attempt2 PASS, full PostgreSQL attempt3
PASS (dentmarket_audit_20260914). Логи `.tmp/p02-postgres-focused-2.log`,
`.tmp/p02-postgres-full-3.log`. Все calendar upgrade/auth/tenant/CAS/replay/
rollback/immutable checkout checks PASS. Предыдущие FAIL сохранены: focused1
ожидал401 вместо403 для authenticated пользователя без прав; full1 unique
fixture collision; full2 cached query plan после transactional upgrade probe.
Рабочая БД не мигрирована; остановленный dev ещё не восстановлен.

До UI: baseline browser на disposable fixture,1440x1000 и390x1000, scale1,
`output/playwright/supplier-calendar/baseline-settings-{1440,390}.png`.
Аналог `apps/web/app/workspaces/settings-storefront.tsx`, shared workspace shell.
HEAD e96afbe; scope calendar backend + новый settings calendar и order deadline.
JSON versions market-components-v1/platforma-semantic-light-v1. Sidebar200,
logo144, header56; контент с существующими отступами shell. Manrope body14/400/1.5,
subtitle18/600/1.25; DmField/Input/Dropdown/Button default44/radius8,
DmSurface radius12/padding24 desktop,16 mobile; gap8/12/16/24.
Цвета semantic surfaces/text/brand; feature CSS только layout, без overrides controls.
Новая вкладка календаря, weekly intervals и date exceptions; общая оболочка
сохраняется. При ошибке draft остаётся; CAS конфликт требует явной загрузки
серверной версии. RU/KK контент по lang query. Праздники2026 только отметки
по указанному источнику, без изменения рабочих часов. Antislop after.

## UI и completion gates

Editor: `settings-calendar.tsx`, `calendar-*`; order deadline: `order-response-deadline.tsx`
через существующий slot обеих ролей. Source/default/read-only, draft retention,
schema field errors, unchanged retry key, CAS explicit reload, RU/KK, holiday annotations.
Focused draft tests8 PASS. Web types1 FAIL missing required Feedback description;
исправлено, types2 PASS. Web build1 PASS; после добавления date validation рядом
с полем запущен build2. UI lint1 и UI-contract1 PASS. Client build1 PASS.
Core-contract1 PASS (71 core operations,402 exposed), runtime1 PASS. Alias prerequisite
schemas/API builds переиспользованы без изменений; выполнены underlying scripts:
`npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only`,
`node scripts/verify-runtime-split.mjs`. Prisma validate1 FAIL missing DATABASE_URL;
validate2 через db:test PASS, рабочие env не использовались.

Calendar browser1 PASS: реальный API + disposable account, default/empty,
пересечения без записи, break/holiday exception save,503 draft+same retry key,
реальный CAS/cancel reload/accepted reload, keyboard dropdown/Escape/disclosure,
390KK add/remove, revoked write permission. `.tmp/p02-browser.mjs`,
`.tmp/p02-browser-1.log`; screenshot/computed styles в `output/playwright/supplier-calendar/`.
Input actual44px/radius8/Manrope14/surface.subtle. Order browser1 FAIL до order UI:
fixture переходила сразу после return URL, до сохранения handoff session. Добавлено
ожидание реального sessionStorage (без injection); attempt2 ещё не запускался.
Не считать order flow PASS. Code Reviewer playbook прочитан и применяется к scope;
новые агенты не запускались. Рабочая миграция и dev restoration ещё не выполнены.

## Итог локальной приёмки02.11 — PASS, publication pending

Final web build2/types3 PASS; lint2 PASS. Calendar browser2 PASS после добавления
ошибок empty/duplicate date у поля и фокуса; обновлены screenshots.
Order browser2 FAIL из-за технического длинного runId в номерe fixture, который
переполнял существующий заголовок. Order3 с обычным номером: обе стороны
1440RU/390KK и неизменность срока после смены timezone PASS. Затем fixture
legacy неверно очищала только даты, оставляя snapshot; DB CHECK23514 правильно
отвергла неполный набор. Полный attempt3 не PASS. После явного разрешения
владельца один `--legacy-only` attempt4 PASS: отдельный заказ без всех трёх полей
показывает отсутствие назначенного срока. Итого order acceptance закрыта
суммой неизменённых проверенных сценариев, без сокрытия FAIL.

Antislop after: [audit](../../../anti-slop/audit-001-2026-11-02.md), новых замечаний
к scoped UI нет; Delivery Gate PASS с указанными границами. Общий приоритетный
R4.1.2 не закрыт: reminders/escalation относятся кП03. Проверено единственное
production creation место SupplierOrder — checkout в commerce.service.ts.
Права/tenant до reads/writes, transactional CAS/replay/audit/outbox и старые
immutable snapshots reviewed по Code Reviewer checklist, без новых blockers.

Изолированные browser/API процессы остановлены, тестовые сессии отозваны.
Рабочая БД прочитана только для preflight:127.0.0.1:5432/marketplace, единственная
pending migration20261102000000_supplier_working_calendar; writes пока нет.
Миграция и восстановление dev разрешены владельцем после приёмки. Следующее:
scoped commit/push, CI, затем разрешённая рабочая миграция и dev restoration.

## Публикация

P01 fixture fix4bc2e301a70adc0ff6d97c159fad7667c52c5aff и П02
8e6a08e311f0efae29a27ad6c842f19e9bf1971d опубликованы обычным push в origin/main;
remote SHA проверен. Staged только owned35paths и первые2hunks checkpoint;
чужие checkpoint/history, apps/web/AGENTS.md и output сохранены.
CI41497279880 и Security41497279900 IN_PROGRESS. Не PASS до результата.
Working migration ещё не применена; dev остановлен по согласованному плану.

## CI attempt1 — dependent fixture type failure

CI41497279880: PostgreSQL/authority/backup и API/web containers PASS;
Security41497279900 PASS. Verify FAIL на E2E typecheck: workspace-list-volume.spec.ts
копирует read SupplierOrder в create; новое nullable JSON responseCalendar требует
Prisma.DbNull вместо JS null. Это пропущенный dependent consumer; не baseline PASS.
Исправлено только преобразование при клонировании fixture. E2E typecheck1/scoped
eslint PASS. Дополнительно реальный rollback-probe на disposable DB подтвердил
SQL NULL и сохранение исходной записи: `.tmp/p02-volume-null-1.log`.
Полный performance/browser workload1000rows не запускался ради type/SQL-null fix.
Production behavior/gates не изменились; требуется scoped публикация и CI2.

## CI attempt2 — eager schema import regression

CI41499167088 passed E2E types/lint/PG/containers, но npm test FAIL в двух
admin-auth.test.ts: новый calendar client импортировал schemas runtime сразу,
ломая существующее deferred validation chunk поведение. Не увеличивали timeout
и не ослабляли mocks: schemas теперь загружаются внутри calendar operations.
Это исправление клиентского import graph, API/БД/компоненты UI не менялись.
Все108API-client tests и12admin-auth tests PASS; client build2/admin types1/
web build3 и повтор изменённого reachable calendar flow выполняются.
Предыдущие successful PG/API/schemas gates сохраняются для неизменённых входов.

Client build2, admin types1, web build3 PASS. Calendar browser3 PASS на новом
production artifact: те же save/recovery/CAS/keyboard/mobile/read-only и даты.
Existing admin-auth regressions12 и client suite108 дают проверку зависимых
consumers; остальные API/schema/PG/visual gates REUSED_PASS по неизменённым inputs.
Third CI будет проверять исправленный import graph; пока общего PASS нет.

## Завершение П02 — 02.11, scoped PASS

Итоговый код9234401948054f5693e5a4b07bf7a2d42bc0fc00 опубликован в origin/main.
[CI41501353701](https://github.com/NikIg228/PlatformaMarket/actions/runs/41501353701)
и [Security41501353652](https://github.com/NikIg228/PlatformaMarket/actions/runs/41501353652)
completed/success: verify, PostgreSQL/backup, оба containers, security gates.
Предыдущие FAIL выше сохранены. P01 CI41496811460 также completed/success.

После зелёного CI выполнено ранее данное разрешение владельца:
`node .tmp/p02-migration.mjs --apply` — PASS, `.tmp/p02-migration-1.log`.
На127.0.0.1:5432/marketplace применена только20261102000000_supplier_working_calendar;
32прежних заказа сохранены, ретроспективных сроков0, выдуманных графиков0.
Seed и изменение содержимого заказов не выполнялись.

Канонический `npm run dev` восстановлен с go_live-профилем: launcher21328,
dev-local13696, API10460 на4012, web15120 на3000. Проверены process ancestry,
канонические пути Next/Turbo и запуск из единственной папки. Логи
`.tmp/p02-dev-out.log`/`.tmp/p02-dev-err.log`; launcher сообщил unified ready.
GET /api/health/ready —200, database/storage ok; GET /catalog —200;
launcher read-only catalog-search —200. Стенд оставлен работающим владельцу.

П02 завершён в согласованном объёме: редактор графика/перерывов/исключений,
fallback, immutable snapshot/deadline новых заказов и отображение обеим ролям.
П03 reminders/escalation не начат, родительский R4.1.2 остаётся OPEN.
Production deployment не выполнялся. Финальная запись evidence — docs-only;
кодовые gates переиспользованы на неизменённых входах, проверяются ссылки/diff.
