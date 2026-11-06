# CHECK-ограничения складских количеств

Поручение владельца 06.11.2026: добавить CHECK для InventoryBalance,
InventoryLot и InventoryReservation; проверить миграцию и негативные сценарии
на изолированной тестовой БД, рабочую БД не менять.
Исходный HEAD: `63a80a0a384c05538190846ad5295aeff5b922b9`, main, каноническая папка.

## Граница и план проверок

Риск: отклонение допустимых складских состояний, частичное применение DDL,
невалидные старые строки, несовместимость резервирования/отзыва/возврата.
Фокус: PostgreSQL SQLSTATE 23514 на INSERT и UPDATE, rollback DDL/DML,
пустые таблицы и upgrade с данными, точные Decimal границы и старый lot race test.
Completion: prisma validate, API typecheck, scoped lint, inventory suite,
`verify:postgres`, diff hygiene. Бюджет команды 20 минут, полного gate 45 минут;
не более трёх попыток одного gate.

Новая [миграция](../../../apps/api/prisma/migrations/20261106000000_inventory_quantity_checks/migration.sql)
добавляет пять именованных ограничений. Старые миграции не изменены;
[Prisma schema](../../../apps/api/prisma/schema.prisma) содержит пояснения SQL-инвариантов.
HTTP/Zod-контракты и UI остаются прежними: базовые проверки входных количеств
уже есть, новая защита применяется к любому пути записи в БД.

| Таблица | Ограничения |
| --- | --- |
| InventoryBalance | Все четыре количества конечные и >=0; available + reserved + safetyStock <= onHand |
| InventoryLot | Три количества конечные и >=0; available + reserved <= onHand |
| InventoryReservation | quantity конечное и >0, в том числе в терминальных статусах |

`< 'Infinity'::numeric` исключает NaN и положительную бесконечность; отрицательные
значения исключены нижней границей. Numeric(24,6) также ограничивает диапазон.
Равенство доступного количества физическому остатку не вводится: отзыв партии,
блокировка продаж и импортный rollback могут удерживать доступность ниже остатка.
Нулевой остаток/партия допустимы, нулевой резерв — нет. Межстрочная сумма партий
по-прежнему защищена транзакцией создания, не подменена CHECK одной строки.

DDL выполняется в BEGIN/COMMIT: ADD CONSTRAINT NOT VALID, затем VALIDATE всех
пяти ограничений. Если старая строка нарушает правило, вся миграция откатывается;
исправления/удаления данных в SQL нет. Будущее рабочее применение потребует
отдельного разрешения и учёта блокировок/сканирования таблиц; здесь оно не выполнено.

## Реальная PostgreSQL-проверка

[Regression](../../../apps/api/src/modules/inventory/inventory-quantity-checks.postgres.spec.ts)
перед подключением требует localhost/loopback, точное имя
`dentmarket_audit_20260914` и одинаковые DATABASE_URL/POSTGRES_TEST_DATABASE_URL;
перед записью проверяет current_database(). Создаёт только собственные случайные
схемы `quantity_checks_<UUID>` внутри этой тестовой БД. Таблицы LIKE public с
реальными column types/defaults, без CHECK/FK/indexes, воспроизводят предшествующую
версию для проверки SQL-ограничений. Созданные схемы удаляются после проверки;
guard cleanup разрешает только имена из списка успешно созданных схем.

Подтверждено:

- Установка на пустых таблицах; пять validated CHECK.
- Пять грязных upgrade-сценариев: NaN/завышенная доступность остатка,
  отрицательный резерв/завышенная доступность партии, нулевой резерв.
  Каждый даёт 23514, ни одно из пяти ограничений частично не остаётся;
  старая синтетическая строка сохраняется без автоматического исправления.
- Upgrade корректных строк не меняет их содержимое.
- 24 набора невалидных значений проверены отдельно INSERT и UPDATE:
  48 отказов с SQLSTATE 23514; строка после неудачного UPDATE неизменна,
  после INSERT лишняя строка не появляется.
- Ошибка CHECK во второй записи транзакции откатывает первую допустимую запись.
- Допустимы нули остатков/партий, 0.1+0.2=0.3, уменьшенная до нуля доступность,
  минимальный положительный резерв 0.000001 и верхняя граница Numeric(24,6).

Штатный Prisma migrate deploy отдельно применил новую миграцию к public только
в `dentmarket_audit_20260914`. До запуска проверено: единственная pending migration
— 20261106000000_inventory_quantity_checks. После: все пять CHECK validated.
Содержимое таблиц сохранено, совпали counts и MD5 упорядоченных полных строк:
675 InventoryBalance, 61 InventoryLot, 15 InventoryReservation.
Evidence без содержимого строк: `.tmp/inventory-checks-deploy-evidence.json`;
лог `.tmp/inventory-checks-deploy-1.log`. В рабочую marketplace не подключались,
миграции/seed к ней не применялись, dev-процессы не перезапускались.

## Проверки

| Gate | Результат / лог |
| --- | --- |
| Новый migration regression | PASS1; после правок test setup финальный PASS3, `.tmp/inventory-checks-postgres-3.log` |
| `npm run db:test -- exec --workspace=@marketplace/api -- vitest run --dir src src/modules/inventory` | PASS2: 62 теста/10 файлов, включая оба PG regression; `.tmp/inventory-checks-targeted-2.log` |
| `npm run db:test -- exec --workspace=@marketplace/api -- prisma validate` | PASS1; `.tmp/inventory-checks-schema-1.log` |
| API typecheck | PASS2; `.tmp/inventory-checks-types-2.log` |
| scoped ESLint нового test | PASS2; `.tmp/inventory-checks-lint-2.log` |
| `npm run verify:postgres` | Alias attempt1 остановлен EPERM генератора; эквивалентная последовательность attempt2 PASS, см. ниже |

Первый typecheck отклонил import.meta в CommonJS-конфигурации API: путь к миграции
переведён на __dirname. Первый lint отклонил throw внутри finally: проверка
принадлежности схемы перенесена в отдельный cleanup helper. После этих изменений
повторён только новый PG test; прежний PASS остальных inventory-тестов сохранён.
Первый PG test уже проходил; последующие запуски вызваны изменениями test setup
и применением миграции, а не попыткой скрыть failed gate.

Использованы практики API Tester: синтетические данные, отрицательные сценарии,
транзакционный rollback и разделение SQL-проверок от приёмки runtime.

### Prerequisites PostgreSQL gate

Первый alias собрал schemas, но остановился на Prisma generate: Windows EPERM
при замене загруженной DLL (`.tmp/inventory-checks-full-postgres-1.log`).
Запущенный API другого процесса не останавливался. Безусловного rerun нет.

Для разрешённого Workflow §4.2 запуска underlying script проверена эквивалентность:
модель текущей schema, generated schema и модели прошедшего gate f4116d3 совпадает
без комментариев; Prisma/client 6.19.3, generated engine побайтово совпадает с
installed engine. Все resolved package entries прежние; отличия lockfile только
в dev/devOptional классификации после переноса Prisma в runtime dependencies.
Проверка с полным byte diff lockfile сначала отклонила reuse; после разбора именно
этой причины отдельно проверены неизменность resolved packages и бинарного engine.
Доказательство: `.tmp/inventory-checks-client-reuse.json`.

Generated client — REUSED_PASS; schemas build — PASS из первого alias;
`npm exec --workspace=@marketplace/api -- nest build` — свежий PASS
(`.tmp/inventory-checks-api-build-2.log`). После выполнения prerequisites запущен
`npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs`
(`.tmp/inventory-checks-full-postgres-2.log`) — PASS, exit 0. Пройдены реальные
PostgreSQL/API сценарии checkout, конкурентного остатка, идемпотентности,
tenant/role denial, rollback, резерва/отзыва, допоставки и возвратов.
Исходный alias failure сохранён; PASS эквивалентного покрытия не выдаётся за
успешное выполнение исходного alias. Системный runner выполнил штатные migration
deploy/test seed только в test DB и завершил собственный временный API.

Итог: локальная реализация и обязательные проверки завершены. Применение к
рабочей БД и production readiness этим отчётом не подтверждаются.
