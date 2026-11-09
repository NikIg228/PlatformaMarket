# Сопровождение Prisma и PostgreSQL

Структура БД задаётся совместно `schema.prisma` и SQL в `migrations/`.
Применённые миграции не редактируются. Рабочая БД меняется только по отдельному
разрешению; команды ниже используют проверенный disposable test profile.

## Объекты, которые нельзя заменить автогенерацией

- `ProductSearchDocument.searchVector`: PostgreSQL `tsvector`,
  `GENERATED ALWAYS AS (to_tsvector('simple', "normalizedText")) STORED`.
  Prisma 6 представляет выражение через `Unsupported` и `dbgenerated`, но не
  выражает признак STORED generated. Это **не обычный DEFAULT**. Колонка остаётся
  необязательной для Prisma и не передаётся в create/update; PostgreSQL пересчитывает
  её при изменении `normalizedText`.
- GIN `ProductSearchDocument_searchVector_idx`,
  `ProductSearchDocument_normalizedText_trgm_idx` и `Product_canonicalName_trgm_idx`.
  Trigram-индексы используют `pg_trgm` / `gin_trgm_ops`.
- CHECK количеств `InventoryBalance`, `InventoryLot`, `InventoryReservation`:
  Prisma diff их не проверяет. Определения и валидация находятся в SQL-миграции
  `20261106000000_inventory_quantity_checks`.
- `map:` индексов соглашений и mapping memory сохраняет существующие SQL-имена.
  MFA сохраняет серверные defaults UUID и времени; `@updatedAt` обслуживает
  последующие Prisma updates.

Не заменять SQL-историю командой `db push` или SQL, сгенерированным из пустой
Prisma-модели: такой путь не воспроизводит generated-колонку и CHECK. При создании
новой миграции проверить её SQL до применения и сохранить SQL-only объекты.

## Проверка изменения

```powershell
npm run db:test -- exec --workspace=@marketplace/api -- prisma migrate deploy
npm run db:test -- exec --workspace=@marketplace/api -- prisma validate
npm run verify:prisma-sql
node --test scripts/prisma-sql-contract.test.mjs
```

`verify:prisma-sql` самостоятельно выбирает тестовую БД через общий безопасный
resolver, ничего не записывает и требует пустой Prisma diff. Затем отдельно
проверяет тип, stored-expression `searchVector` и точные пять validated CHECK.
Команда не является полной проверкой всех PostgreSQL triggers/functions/grants.
CI запускает её после штатного `migrate deploy`.

Regression создаёт собственную случайную схему в той же тестовой БД, воспроизводит
все SQL-миграции по порядку и удаляет только эту схему в cleanup. `search_path`
включает временную схему и `public`, чтобы видеть уже установленный `pg_trgm`.
Это проверка SQL-истории без изменения применённых файлов; штатный migration
ledger отдельно проверяется через `migrate deploy` и `migrate status`.
Проверяются поисковые INSERT/UPDATE, кириллица, три валидных GIN-индекса, MFA
defaults, обновление времени, upgrade без изменения строк и обнаружение потери
индекса/generated-expression/CHECK, ослабленного и NOT VALID CHECK.

Остальные проверки выбираются по [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md).
Для изменения Prisma сохраняется обязательный `npm run verify:postgres`.
