# Prisma ↔ SQL: устранение расхождений, 09.11.2026

Основание: явный запрос владельца сохранить `searchVector` и поисковые индексы,
исправить сопровождение схемы, проверить на изолированной БД. База исходников:
`f08ec48d`, main, каноническая папка Market. Соседние изменения admin UI,
roadmap/checkpoint, generated next-env и screenshots не входят в работу.

## План и граница

Изменить Prisma metadata под уже применённый SQL; добавить пустую reconciliation
миграцию, повторяемую проверку drift и SQL-only инвариантов, CI и runbook.
Риск: автогенерация удаляет поисковое поле/индексы, незаметная потеря CHECK,
изменение Prisma create/update MFA. UI/API-контракт не меняются, новый UI не нужен.
Focused checks: Prisma validate/generate, SQL replay, populated upgrade, поиск,
MFA, отрицательные drift-пробы и существующие quantity regressions.
Completion: API types/build, scoped lint, обязательный verify:postgres,
diff hygiene, scoped commit/push и отдельный статус CI. Не запускать deploy,
рабочие миграции или seed рабочей БД.

## Найдено и исправлено

Исходный `migrate diff --from-url <test> --to-schema-datamodel ... --exit-code`
предлагал удалить `ProductSearchDocument.searchVector` и три GIN-индекса,
переименовать пять индексов BuyerSupplierAgreement/SupplierMappingMemory,
убрать SQL defaults `UserMfaFactor.id/updatedAt`.

Prisma теперь описывает существующие имена, тип/выражение поискового поля,
операторные классы GIN и defaults. `@updatedAt` сохранён. Миграция
`20261109000000_prisma_sql_alignment` не содержит DDL; исторические миграции
не изменялись. Рабочая БД не требует DDL для этой reconciliation.

`npm run verify:prisma-sql` использует общий test-database resolver, только читает
выбранную тестовую БД и требует пустой Prisma diff. Дополнительно проверяет
STORED generated-expression и точные validated определения пяти quantity CHECK.
Это не аудит всех SQL-only объектов (triggers/functions/grants).
CI выполняет guard и regression после migrate deploy. Правила сопровождения:
[Prisma runbook](../../../apps/api/prisma/README.md).

## Изоляция и проверки

Локально использована только `dentmarket_audit_20260914`. Runtime gate выполняет
штатный seed этого disposable профиля; regression пишет в собственную случайную
`prisma_sql_*` схему и удаляет только её. Нет подключения к рабочей БД,
остановки чужих dev-процессов или изменения dependency versions.

| Проверка | Результат |
| --- | --- |
| Prisma validate | PASS, `.tmp/prisma-sql-validate-1.log` |
| Prisma generate 6.19.3 | PASS, `.tmp/prisma-sql-generate-1.log` |
| Guard существующей тестовой схемы | PASS, `.tmp/prisma-sql-contract-1.log`; diff пуст |
| Полный SQL replay + regression | PASS: 6 тестов, `.tmp/prisma-sql-regression-3.log` |
| Search/MFA/quantity suites | PASS: 8 тестов/4 файла, `.tmp/prisma-sql-focused-1.log` |
| API typecheck | PASS, `.tmp/prisma-sql-types-1.log` |
| Scoped ESLint трёх новых scripts | PASS, `.tmp/prisma-sql-lint-1.log` |
| verify:postgres с schemas/API build | PASS, exit 0, `.tmp/prisma-sql-postgres-1.log` |
| Guard после migrate deploy/runtime suite | PASS, `.tmp/prisma-sql-contract-2.log` |
| Prisma migrate status | PASS: 59 миграций, schema up to date, `.tmp/prisma-sql-status-1.log` |
| git diff --check | PASS, ошибок пробелов нет |

Regression подтверждает INSERT/UPDATE через сгенерированный Prisma Client,
пересчёт кириллического FTS, три valid/ready GIN-индекса, Prisma/SQL defaults MFA
и автоматическое updatedAt. Повторное применение metadata-миграции сохраняет
полные поисковые строки. Негативные пробы доказывают обнаружение удалённого
индекса, потери GENERATED, отсутствующего/ослабленного/NOT VALID CHECK.
Существующий quantity test проверяет реальные INSERT/UPDATE отказы и rollback.

Первая попытка regression завершилась P3018: migrate deploy в новой схеме
не видел существующий в public `gin_trgm_ops`. Это тестовая конфигурация,
не дефект SQL миграций; созданная схема удалена. У тестового пользователя нет
CREATEDB, поэтому второй запуск воспроизвёл неизменённые SQL-файлы с явным
search_path `<owned_schema>, public` и прошёл. Третий запуск обусловлен новым
Prisma Client и добавлением проверки MFA, прошёл. Исторический FAIL не скрыт.
Штатный migrate deploy нового файла также успешно выполнен runtime gate в
public только тестовой БД; SQL replay не выдаётся за migration-ledger проверку.

`verify:postgres` прошёл полностью: штатные миграции/seed тестовой БД,
tenant/role denial, transaction rollback, concurrent idempotency, scarce stock,
cart correction/checkout race и зависимые доменные сценарии. Внешний deploy
и готовность production этим результатом не подтверждаются.

Локальная реализация и обязательные gates завершены. Результат scoped commit/push
и фактический статус CI сообщаются отдельно; этот отчёт не утверждает CI PASS.
