# Создание складских партий при параллельных запросах

Поручение владельца 06.11.2026: исправить гонку создания партий и проверить
параллельные запросы на изолированной PostgreSQL БД; рабочие данные не менять.
Исходная версия: main@5161af7f83f909ad90901de403daa3f7fde0e928, каноническая папка.
Прежние staged/unstaged изменения других задач сохранены.

## Граница и проверки

Изменяется только `InventoryService.createLot`: два создания партий одного
остатка должны последовательно проверять доступную ёмкость. При остатке 10
запросы 7+7 не могут оба завершиться успешно; 4+6 должны оба пройти.
Риск: конкурентная запись, tenant isolation, откат lot/audit/outbox.
Фокус: реальная PostgreSQL-конкуренция, отказ невалидного ввода/чужой организации,
ошибка outbox и повтор после rollback. Completion: inventory suite, API types,
scoped lint, обязательный `verify:postgres` и diff hygiene.
Бюджет: команда 20 минут, полный PostgreSQL gate 45 минут; максимум 3 попытки.

Схема, миграции, формат HTTP request/response, права и UI не меняются. Сохраняется
существующий HTTP 400 при превышении количества и прежнее правило исключения
DEPLETED/EXPIRED/RECALLED из суммы. UI не требует нового действия или состояния:
исправлена атомарность существующей команды и сохранены её доменные ошибки.

## Реализация

[inventory.service.ts](../../../apps/api/src/modules/inventory/inventory.service.ts)
блокирует родительский InventoryBalance через tenant-scoped `SELECT ... FOR UPDATE`
в той же транзакции, где проверяет сумму и создаёт партию, audit и outbox.
После получения блокировки повторно читает остаток и сумму партий. Явный
ReadCommitted позволяет ожидающему запросу увидеть партию, зафиксированную
предыдущим создателем. Сумма и доступное количество вычисляются через Decimal.

Новый [PostgreSQL regression](../../../apps/api/src/modules/inventory/inventory-lot-creation.postgres.spec.ts)
использует реальные транзакции и строковую блокировку. Внешняя test-транзакция
удерживает остаток; проверка `pg_blocking_pids` подтверждает ожидание обоих
запросов до её освобождения. Это параллельные вызовы сервиса с реальной БД,
не mock и не отдельная проверка сетевого HTTP transport.

Подтверждены:

- Остаток 10, партии 7+7: одна успешная, одна с доменным 400; итог 7,
  ровно один audit и одно outbox-событие.
- Остаток 10, партии 4+6: обе успешны, итог 10.
- Остаток изменён с 10 на 6 под блокировкой: ожидающий запрос на 7 отклонён,
  побочных записей нет.
- Дробные партии 0.1+0.2 при остатке 0.3 проходят без ошибки binary float.
- Чужой actor context — 403; чужой остаток и отсутствующее предложение — 404;
  отрицательное количество отвергается существующим controller/schema до записи.
- Искусственный сбой outbox через Prisma query extension откатывает партию и
  audit; следующий обычный запрос успешно выполняется после освобождения lock.

## Изоляция данных

До запуска проверены стандартный `test-database-profile`, отдельность от dev и
фактический `current_database() = dentmarket_audit_20260914`; все 57 миграций
уже применены. Новый regression дополнительно отклоняет другие hostname/dbname
и несовпадение DATABASE_URL с POSTGRES_TEST_DATABASE_URL.
Fixtures синтетические с уникальными UUID, cleanup удаляет только их строки.
К рабочей `marketplace` в этой задаче не подключались. Dev-процессы не
останавливались и не перезапускались.

## Реестр проверок

| Проверка | Результат |
| --- | --- |
| `npm run db:test -- exec --workspace=@marketplace/api -- vitest run --dir src src/modules/inventory/inventory-lot-creation.postgres.spec.ts` | PASS, финальная попытка 2, один многошаговый PG regression; `.tmp/lot-race-postgres-2.log` |
| `npm run test --workspace=@marketplace/api -- src/modules/inventory` | PASS, 60 unit tests; новый PG test здесь пропущен без env и отдельно выполнен выше; `.tmp/lot-race-inventory-2.log` |
| `npm run typecheck --workspace=@marketplace/api` | PASS, попытка 2; `.tmp/lot-race-types-2.log` |
| scoped ESLint для двух изменённых TS файлов | PASS; `.tmp/lot-race-lint-1.log` |
| `npm run verify:postgres` | PASS, попытка 1, включая сборки schemas/API и PostgreSQL/API сценарии checkout, tenant isolation, rollback, concurrent idempotency и scarce stock; `.tmp/lot-race-verify-postgres-1.log` |
| diff hygiene | PASS; собственный scope — service, новый regression и этот отчёт |

Первый inventory-запуск напрямую через Vitest без штатного `--dir src` захватил
старые compiled `.tmp/*.spec.js` и упал на CommonJS import Vitest. Исправлена
команда, артефакты и продуктовый код ради этого не менялись. Первый typecheck
обнаружил пропущенную третью зависимость DataFreshnessService в новом test setup;
добавлен реальный AccessControlService, затем типы и PG test повторены успешно.
Первый целевой PG test уже проходил, повтор вызван изменением test setup.

Применены практики API Tester: синтетические fixtures, негативные сценарии,
контроль реальной конкуренции и транзакционного отката в пределах задачи.
Полный нагрузочный, frontend и security-аудит этим результатом не заявляются.

Полный PostgreSQL gate использовал штатные migrate deploy/test seed только в
`dentmarket_audit_20260914`; его временный API завершён штатным cleanup.
Схема/миграции исходников не менялись, рабочий dev не перезапускался.

## Git

Первый staging был остановлен существующим `.git/index.lock`. По отдельному
поручению владельца 06.11.2026 проверено: файл пуст, last-write
2026-11-05T14:31:51.5838043Z, активных Git/SSH/GPG/git-lfs процессов нет.
После повторной сверки метаданных lock открыт эксклюзивно и удалён при закрытии.
Индекс предварительно сохранён; контрольные суммы 3582 остальных файлов и
записи чужого индекса зафиксированы для проверки сохранности после коммита.
В отдельный локальный коммит входят только service, новый PG regression и этот
отчёт. Код и тест не изменились после PASS; повтор runtime-проверок для Git
операции не требуется. До задачи ветка
уже содержала семь исходящих commits и чужие staged changes. Их публикация и
приёмка не входят в исправление гонки; push этого смешанного outgoing range
не выполняется. CI не запущен, deployment не выполнялся.
