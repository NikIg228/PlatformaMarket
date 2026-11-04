# Цикл 6 — надёжность существующих ERP-интеграций

Статус LOCAL_PASS; публикация/CI заблокированы прежней local-only историей.
Владелец04.11: «приступаем к циклу 6». Исходный список
подтверждён: B032/B033/B035/B044. Цикл5 BLOCKED и цикл4 BROWSER_BLOCKED сохраняются.
main@b3fdb44b, ahead5; каноническая папка dentmarket-kz-main. Предшествующий
staged/unstaged WIP сохраняется; затрагиваемые integration/suppliers файлы чистые.
Без агентов, live ERP, working DB, dev restart и deploy.

## План до реализации

- B032: передавать стабильный job idempotency key в create/release adapter,
  проверить повтор после локального completion failure, HTTP header/body и
  существующие tenant/binding guards. Это локальный контракт; реальная ERP должна
  подтвердить поддержку дедупликации отдельно, не заявлять live exactly-once.
- B033: успешная неизменная цена продлевает lastConfirmedAt/freshnessExpiresAt
  под существующей блокировкой предложения без новой цены/history/version/event.
  Manual/override protection и налоговые изменения сохраняются.
- B035: устранить тихое округление на границе adapters; сверить текущую числовую
  схему, явно отклонять непредставимые/нецелые minor units, сохранить точные
  допустимые значения. Новый денежный API не вводится без необходимости.
- B044: camelCase и массивы конфигурации проходят ту же защиту, что snake_case/
  nested objects; секреты шифруются, не попадают в response/list/audit/outbox.
  Проверить чтение legacy plaintext без изменения рабочих данных.

Риск высокий: внешние повторы, деньги, секреты. После каждого связного изменения
focused automated tests перед следующим. Completion: affected/dependent tests,
API types/build, disposable PostgreSQL rollback/concurrency/tenant checks,
runtime-split, lint и diff. Общий PG только для доказанного shared stock/price
impact; текущие payment WIP не считать принятыми его успехом. До3 попыток на gate,
build20мин/suite45мин/probe2мин, bounded logs .tmp/erp-reliability-*.

UI не меняется: ремонт уже имеющихся jobs/adapters/data-source API, не self-service
подключение и не реализация всего R3/П20/П21. Эти пункты остаются открытыми.
Источники: functional map ERP/ADR012, PROJECT_OVERVIEW integrations, roadmap R3,
audit backend B032/033/035/044 probes, Workflow proportional verification.
Development Toolkit backend/reliability; antislop DURING сохраняется, UI/assets нет.

## Результат

B032: create/release берут idempotencyKey из job, а не payload; CUSTOM_API
отправляет его в header/body. Повтор после локального completion failure
доказан на двух SQL connections и дедуплицирующем синтетическом adapter.
Два обращения adapter допустимы; один внешний эффект зависит от поддержки
дедупликации выбранным внешним сервисом. Live ERP не подключалась.

B033: неизменная нормализованная цена/налоговые условия обновляют confirmation
и expiry под row lock SupplierOffer. Время вычисляется после lock. Не создаются
новая цена/history/version/outbox; manual protection и changed-price control PASS.

B035: CUSTOM_API/MOYSKLAD/MOCK используют общий exactPriceMinor. Decimal проверяет
точное целое до преобразования в number; дробные/небезопасные/отрицательные
значения отвергаются, включая9007199254740993 и9007199254740990.1. Допустимый
MAX_SAFE_INTEGER сохраняется точно в PostgreSQL. Поддержка больших сумм не заявлена.

B044: общий рекурсивный protector для suppliers/integrations; camelCase и массивы,
отдельное шифрование, безопасные data-source/list/connection responses и audit.
Adapter registry глубоко восстанавливает секреты вместе с публичными полями;
публичное обновление не затирается сохранённым encrypted subtree. Legacy API reads
редактируются на выдаче; историческая working DB/аудит не переписывались.

Backend Architect применён: стабильная внешняя идентичность, локальные транзакции,
точные деньги и граница секретов. Source review выполнен без новых агентов.
Antislop DURING: визуальный delivery gate неприменим, UI/assets не изменялись.

## Проверки и попытки

Все логи `.tmp/erp-reliability-*`. Исходники/входы —
[SHA receipt](erp-reliability-20261104-inputs.json). База b3fdb44b + сохранённый
предыдущий WIP; dependency install/lock/schema/migration не менялись.

| Проверка | Команда/лог | Результат |
| --- | --- | --- |
| B032 regression | `npm run test --workspace=@marketplace/api -- src/modules/integrations/reservation-job-scope.spec.ts` / reservation-red | 2 expected FAIL, 53 PASS до исправления |
| B032 focused/dependent | тот же spec + integration-jobs.service.spec.ts + adapters/custom-api.adapter.spec.ts / reservation-1 | 62 PASS |
| B033 regression | integration-vat.spec.ts / freshness-red | 1 expected FAIL, 2 PASS |
| B033 dependent | integration-vat.spec.ts + integration-tax.spec.ts + integration-reconciliation.spec.ts / freshness-1 | 13 PASS |
| B035 regression | adapters/price-precision.spec.ts / money-red | 9 expected FAIL, 5 PASS |
| B035 dependent | price-precision.spec.ts + custom-api.adapter.spec.ts + integration-adapters.spec.ts / money-1 | PASS |
| B044 regression | suppliers/data-source-secrets.spec.ts / secrets-red | 2 expected FAIL, 1 PASS |
| B044 correction | source spec + warehouse-replay + integration-crypto / secrets-1,2 | attempt1 FAIL: helper extraction command unavailable Python; imports not applied. Replaced editing command with Node, attempt2 10 PASS |
| Affected/dependent | `npm run test --workspace=@marketplace/api -- src/modules/integrations src/modules/suppliers src/modules/imports src/modules/inventory/data-freshness.service.spec.ts` / dependent-1 | 203 PASS, 27 files |
| Final price/reservation | reservation-job-scope.spec.ts + integration-vat.spec.ts / final-focused | 58 PASS after timestamp/test-double adjustment |
| Final configuration consumers | configuration-secrets.spec.ts + suppliers/data-source-secrets.spec.ts + integration-adapters.spec.ts / config-consumers-1 | 22 PASS, including new public-update/array-shape regression |
| API types | `npm run typecheck --workspace=@marketplace/api` / types-1,2,3 | attempt1 test-double TS2345; fixed return type. attempt2 PASS; attempt3 PASS after deep restore change |
| API build | `npm run build --workspace=@marketplace/api` / build-1,2,3 | all PASS; build2 includes post-lock timestamp, build3 final deep restore |
| Schemas build | `npm run build --workspace=@marketplace/schemas` / schema-build-1 | PASS, unchanged contract prerequisite |
| Focused PostgreSQL | `node scripts/verify-erp-reliability.mjs` / pg-1,2 | both PASS; second checks final secret restoration/public update and exact MAX_SAFE_INTEGER |
| Full PostgreSQL | `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` / full-pg-1 | PASS; equivalent verify:postgres with prior schemas/API builds |
| Runtime split | `node scripts/verify-runtime-split.mjs` / runtime-1 | PASS with built API prerequisite |
| Lint/UI contract | `npm run lint` / lint-1 | PASS; after secret restore refinement changed-files ESLint lint-final PASS, UI inputs unchanged |
| Diff | `git diff --check` | PASS |

Full PG доказывает неизменившиеся dependent commerce/stock paths на финальных
B032/B033/B035 inputs. После него изменён только B044 restore helper/registry и
его тесты; B044 повторно принят focused PG2 + consumer22 + types3/build3/lint-final.
Runtime topology и UI не менялись, их PASS переиспользован без общего rerun.
Контроллеры/shared schema/permission decorators не изменялись: HTTP role denial
новым сервером отдельно не запускался. Tenant denial проверен реальным сервисом/SQL;
invalid money, existing reservation tenant/binding guards — automated tests.

Focused PG fixtures удалены finally, общий PG выполнил свой cleanup; все собственные
процессы завершены. Dev остаётся OFF, working DB не затронута. Циклы4/5 остаются
BROWSER_BLOCKED/BLOCKED; общий PG не закрывает их специальные незавершённые gates.
Публикация запрещена до разрешения прежней исходящей истории (fetch: ahead5 до
коммита этого цикла). Новый цикл7 не начинался.
