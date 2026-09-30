# CI-DATABASE — выбор изолированной тестовой БД

Дополнение01.10: dependency blocker исправлен и локально проверен в
[общем выпуске](PERFORMANCE-CI-DELIVERY-2026-09-30.md). Публикация и hosted CI
завершены:8045225/75e0e21, CI36772750254 SUCCESS. Ниже исторический checkpoint,
не повторное поручение. Итог CI-DATABASE: CLOSED / PUBLISHED / CI_PASS.

Текущий этап (новое разрешение владельца30.09): условные telemetry imports,
включая Sentry filter в AppModule. Порядок instrumentation-before-app сохраняется
синхронным CommonJS require. Product contracts, env validation, guards не меняются.
DoD: regression disabled/Sentry/OTEL/both + ordering/filter; npm run typecheck,
npm test, API build, verify:runtime-split, ранее blocked core/PG и observability
gate на audit DB, git diff --check. Предыдущие попытки сохранены; новые runtime
запуски только после изменения причины. На новое исправление до3 попыток,
20мин на build/gate,45мин full suite,15мин диагностика; без timeout inflation.

Текущий итог23:28+05:00: CI DB selection + telemetry fix LOCAL_PASS.
Обязательные локальные gates пройдены, runtime blocker устранён.
Публикация BLOCKED прежним dependency audit FAIL; commit/push NOT_RUN.
Ниже сохранена хронология прежних FAIL и попыток; не повторять уже закрытые gates.

Основание: пользователь 30.09.2026 «окей приступай» к предложенному исправлению
CI test DB contract/guard. Единственный writer: primary
01a0f302-2d38-75d1-b79c-141e7428b533, generation4/idle; UI task idle.
Canonical root C:/Users/user/Desktop/dentmarket-kz-main, main@2a816c3.

## Scope и DoD

Wrapper должен передавать одну явно заданную БД disposable GitHub-hosted CI
дочерним процессам и fixture guard. Локальный dev/test isolation сохраняется.
Не менять данные рабочей БД, зависимости, бизнес-код, UI или release pipeline.
Исходный docs WIP предыдущей задачи и пять protected dirty files сохраняются.

Изменение: scripts test DB resolver/wrapper, regression tests, CI env/test step,
соответствующий runbook. Ошибки конфигурации должны останавливать запуск до spawn.
Проверки: node --test выбранных resolver/wrapper/fixture/CI tests;
verify:core-contract и verify:postgres на ранее предназначенной audit DB после
read-only preflight; git diff --check, review scope. TS/build продукта не меняются;
build prerequisites выполняются aliases. Отдельные typecheck/full unit не нужны
для mjs wrapper; runtime PostgreSQL gate обязателен для доказательства пути.
CI после разрешённой публикации фиксируется отдельно, не выдаётся за local PASS.

Budget: probe 2 мин, build/gate 20 мин, диагностика blocker 15 мин,
до 3 попыток с учётом прежнего failed CI36737223743 (1); следующий CI — 2.
Dependency audit FAIL остаётся отдельным известным блокером, не scope этой задачи.
Новых dev-серверов/агентов/worktrees нет. Следующий шаг указан в результате ниже.

## Evidence

Preflight: root/HEAD совпадают, scripts/.github/package.json без исходного diff;
другой Market writer idle. Старый wrapper игнорирует POSTGRES_TEST_DATABASE_URL
и выбирает audit DB при подготовленной CI marketplace. Fixture guard не менять.
Использованы development-toolkit execution/verification, Agency Code Reviewer
и Git Workflow Master: изоляция, regression, проверенный атомарный scope.

## Исполнение

- Resolver реализован: explicit TEST/POSTGRES_TEST aliases; конфликт запрещён;
  hosted CI допускает только localhost:5432 marketplace/public и совпадающий
  DATABASE_URL. Local separate DB, production guard и fixture identity сохранены.
- CI verify job теперь явно передаёт POSTGRES_TEST_DATABASE_URL; regression
  запускается до DB preparation. postgres-integration уже задавал этот alias.
- `node --test scripts/local-database-profile.test.mjs scripts/test-database-profile.test.mjs scripts/lib/organization-profile-fixture.test.mjs scripts/ci-verification.test.mjs`
  PASS 14/14, попытка1. Проверен child env/exit code и отказ до spawn.
- Read-only preflight PASS: audit DB/public,36 applied migrations.
- `npm run verify:core-contract`, попытка1: prerequisite Prisma generate EPERM
  locked Windows DLL. Чужой dev не остановлен. Повтор generate не выполнялся.
- Reuse prerequisite: published schema/lockfile hashes совпали; generated schema
  совпала после удаления только whitespace вне строк; client/CLI6.19.3 совпали,
  native engine использован успешным DB preflight. Evidence prisma-reuse.json.
  Первичная текстовая сверка обнаружила форматирование; DMMF helper недоступен
  (пакет не установлен), без установки зависимостей применена точная сверка строк.
- schemas build PASS в alias; `npm exec --workspace=@marketplace/api -- nest build`
  PASS. Вместе с REUSED_PASS generator это prerequisites исходного alias (§4.2).
- `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only`,
  попытка2: API readiness timeout45s. Во время проверки tool session прервалась,
  затем изменился весь наблюдаемый набор node processes. Причина не доказана.
- `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs`
  попытка1 FAIL: API readiness timeout60s; тот же полный body gate,
  prerequisites выше. Миграции/test seed прошли на audit DB; transactional
  scenarios до readiness не достигнуты, PASS не заявляется.
- Logs: outputs/ci-database-20260930/. Dev PID15008/29780 видели до interruption;
  никаких stop/restart чужих процессов задача не делала.
- `git diff --check` PASS; apps/api/packages/lockfile исходники неизменны.

## Результат и остановка

Дополнение23:06+05:00: владелец отдельно разрешил диагностику startup, см. ниже.

Review resolver/wrapper/CI diff выполнен. Fixture guard и local dev protection
не ослаблены. Чужие исходные пять dirty files и docs WIP сохранены. Typecheck,
full unit, frontend/browser suites NOT_RUN: TS/UI не менялись, риск проверялся
целевыми mjs regressions и обязательными runtime gates.

Core gate:2 попытки (Prisma DLL lock; затем readiness45s), PostgreSQL:1 попытка
(readiness60s). Две одинаковые readiness ошибки без подтверждённой новой причины
→ остановка по Workflow4.3 до третьей. Environment/tool interruption наблюдался,
но не доказан причиной. Нельзя считать unit proof полноценным runtime/CI PASS.

Postgres runner завершился exit1; его cleanup прошёл без ошибок, каталог
.tmp/postgres-integration пуст, PID1868 отсутствует. Собственных фоновых операций
не осталось. Другие dev-процессы не останавливались.

Commit/push NOT_RUN: обязательные runtime gates FAIL (AGENTS8); старый CI и
dependency audit также остаются FAIL, не перезапускались. main@2a816c3.
Один следующий шаг: диагностировать bootstrap отдельного тестового API с
детализированным startup-log и фиксированным прежним timeout, установить причину
readiness до следующей попытки. Не менять рабочую БД, dependencies или таймауты
для получения зелёного результата и не начинать frontend оптимизации.

## Диагностика bootstrap по разрешению владельца

30.09 пользователь «приступай» к выделенному следующему шагу диагностики.
Scope: диагностический лог отдельного owned API, прежний timeout60s; не новая
попытка полного gate и не разрешение менять observability/product code.
Primary/UI ownership и main@2a816c3 сверены; чужой Market task idle.

Один диагностический запуск: node outputs/ci-database-20260930/diagnose-startup.mjs.
Тот же API artifact, test/pilot/PROCESS_ROLE=api, isolated audit DB, queue=false,
local storage, mock payment, LOG_LEVEL=info, свободный отдельный порт4412.
Ignored preload измеряет synchronous Module._load, не меняет результат imports.
Deadline60s сохранён. Это третий наблюдаемый startup timeout, прежние попытки
не обнулены; дополнительных запусков не было.

Факт: до deadline не завершён верхнеуровневый require('./instrumentation'):
- @sentry/nestjs 37 473ms (включая @sentry/node36 646ms);
- @opentelemetry/auto-instrumentations-node11 466ms, суммарно49 045ms;
- далее OTLP dependency graph, к60 106ms ещё @opentelemetry/core.
Nest/bootstrap import не достигнут; event-loop heartbeat не сработал, пока
идёт синхронная загрузка. У child CPU1.36s на ~38s wall time: преимущественно
ожидание, но причина задержки чтения/антивирус/диск отдельно не доказана.
Метрики получены с диагностическим preload, не считаются production benchmark.

В instrumentation.ts статические imports Sentry и OTEL стоят перед условиями
SENTRY_DSN/OTEL_EXPORTER_OTLP_ENDPOINT. В shell диагностического запуска эти
настройки отсутствуют; тестовый env их не добавляет. Тяжёлый graph загружается
даже при неактивной телеметрии. Следовательно наблюдаемый timeout находится
до соединения приложения с PostgreSQL, а не в выборе DB wrapper.

Evidence: startup.log, startup-result.json (TIMEOUT60 286ms с cleanup); exit0
диагностического harness означает только сохранение отчёта, НЕ API readiness.
Owned child PID2564 завершён, наличие процесса перепроверено; операций в полёте
нет. Исходники продукта/lockfile не изменены, git diff --check PASS. Ранее
14/14 regression PASS сохраняется; runtime/CI gates не перезапускались.

Диагностика завершена. Следующий отдельный минимальный fix: условно загружать
Sentry/OTEL только при включении соответствующей конфигурации, сохраняя запуск
инструментации до импорта приложения. Не отключать production telemetry,
не менять защиту или увеличивать timeout. Такой TS change потребует typecheck,
unit regression для disabled/enabled branches и текущих runtime gates;
до реализации нельзя обещать достаточное ускорение всего Nest bootstrap.
CI-DATABASE остаётся RUNTIME_BLOCKED, commit/push NOT_RUN.

## Исправление telemetry startup по новому разрешению

Владелец30.09 «приступай» к условной загрузке. Изменены instrumentation.ts и
необходимый безусловный SentryGlobalFilter import в app.module.ts. Синхронные
typed require выполняются только при наличии DSN/OTLP endpoint. Main и worker
сохраняют instrumentation первым импортом. Config validation не менялась.

Новый instrumentation.spec.ts исполняет CommonJS результат TS-transpile в VM:
disabled не загружает SDK, Sentry/OTEL/both сохраняют init/options/shutdown,
оба entrypoint загружают приложение после init, filter зависит от DSN.
Focused `npm exec --workspace=@marketplace/api -- vitest run src/instrumentation.spec.ts`
PASS7/7, попытка1. Fixtures/stubs не делают внешних обращений.

Typecheck RUNNING (попытка1). Full unit: попытка1 `npm test -- --concurrency=1`
отклонена Turbo до тестов из-за повторного concurrency (alias уже содержит2).
Попытка2 `npm exec -- turbo run test --concurrency=1` выполняет тот же полный
graph последовательно, без дублирования флага; RUNNING. Не считать CLI error
дефектом приложения. Logs telemetry-focused/typecheck/unit[-2].log.

Typecheck попытка1: TS1343 в новом тесте (import.meta при CommonJS). Исправлен
только путь fixture на resolve(__dirname,...). Попытка2 npm run typecheck PASS13/13.
Full unit попытка2: API437/438 PASS (85/86 files); прежний document-renderer PDF
test TIMEOUT5000ms на фоне параллельного typecheck. Остальные workspace tasks
не успели завершиться из-за fail-fast. Новая telemetry spec7/7 PASS в этом run.
Попытка3 — composition по Workflow4.2: после окончания typecheck повторить
document-renderer + instrumentation на финальном fixture path, сохранить PASS
неизменённых остальных API тестов и выполнить оставшийся graph с filter=!api.
Обоснование: изолированная проверка наблюдаемого resource/timing сбоя; timeout
и assertions неизменны. Не запускать четвёртую попытку при новом FAIL.

Composition попытка3 PASS: focused final instrumentation7 + document-renderer8
(15/15); прежний PDF test2.57s при том же лимите5s, flaky/resource-sensitive pass
явно сохранён. Остальной `npm exec -- turbo run test --concurrency=1 --filter=!@marketplace/api`
PASS11/11 tasks. Вместе с437 API successes это полное покрытие unit graph,
не единый all-green run; неизменность остальных входов доказана telemetry-inputs.json
(1504 unchanged tracked source/config,4 ожидаемых изменения + новые тесты/resolver).
API build запускается с ранее доказанным REUSED_PASS Prisma generator prerequisite;
схема/lockfile/версия клиента не менялись. Никаких повторов locked DLL rename.

API build PASS (telemetry-api-build.log). Core contract после исправления PASS:
`LOG_LEVEL=info npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only`
(PowerShell env assignment), общий счётчик core attempt3, новые code inputs.
Readiness ready,114 schemas/38 core operations,response/error validation PASS;
исходный timeout45s не изменялся. telemetry-core-contract.log. PostgreSQL после
исправления запущен с теми же prerequisites (общий attempt2), RUNNING.

PostgreSQL attempt2 PASS: real races/rollback/tenant/permissions/stock/expiry,
schema/migrations/test fixtures на audit DB; полный body исходного gate,
telemetry-postgres.log. API readiness60s неизменён. Runtime split после единой
API build запущен direct underlying script по Workflow4.2 (attempt1), RUNNING.

## Финальный локальный результат23:28+05:00

Этот результат заменяет промежуточные RUNNING/RUNTIME_BLOCKED выше; историю
неудач и попыток не стирать. Новые реализации по завершённым пунктам не нужны.

| Gate | Результат и точная команда |
| --- | --- |
| DB resolver regression | PASS14/14 ранее, inputs неизменны, REUSED_PASS |
| TypeScript | PASS13/13, npm run typecheck, attempt2 |
| Unit graph | Полное составное PASS: API423 неизменённых теста REUSED_PASS из full run +15/15 focused final; остальные11 tasks PASS через filter=!api. Один PDF timeout5s → focused2.57s pass; flaky факт сохранён |
| API build | npm exec --workspace=@marketplace/api -- nest build — PASS; generator prerequisite REUSED_PASS, schema build PASS |
| Core contract | npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only — PASS,114 schemas/38 core operations, total attempt3 |
| PostgreSQL | npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs — PASS, total attempt2; audit DB/public |
| Runtime split | node scripts/verify-runtime-split.mjs — PASS, attempt1; all3 roles, both wrong-entrypoint guards, production-all rejection |
| Observability | node scripts/verify-observability-alerts.mjs — PASS7 rules/14 vectors; npm run db:test -- exec -- node scripts/verify-observability-integration.mjs — PASS401/200 metrics auth + PostgreSQL gauges, attempt1 |
| Diff / review | git diff --check PASS; 1504 protected source/config hashes неизменны, only4 expected tracked changes +new tests/resolver |

Все prerequisites aliases сохранены по Workflow4.2: schemas/API build общие,
Prisma generator проверенно переиспользован, observability unit tests включены
в full API graph. Нет обхода gate, timeout inflation или отключения auth/fixtures.
Runtime API/PG/observability процессы завершились exit0; fixtures cleanup без
ошибок. Собственных незавершённых операций нет. Чужие dev-процессы не трогали.

Self-review: синхронный require выбран для CommonJS, чтобы SDK init предшествовал
Nest/application imports; enabled options/shutdown/filter сохранены, production
environment validation не менялась. Контракты, tenant rules, DB schema, npm
dependencies, UI и migration source не менялись. SDK disabled mode не грузит
его dependency graph. Параметры инициализации не ослаблены ради performance.

Browser/frontend build/release/security suites NOT_RUN — scope bootstrap/API,
без UI/production rollout/dependency изменений. Реальные внешние Sentry/OTLP
не вызывались; enabled branches проверены изолированными SDK stubs.

Commit/push NOT_RUN: известный Security36737223539 dependency audit FAIL остаётся
отдельным blocker по AGENTS8. Новый CI не запускался; старый CI FAIL не превращён
в PASS локальными тестами. main@2a816c337bae15f6684318cf26d21bf6f71cb3c5, index пуст.
Сохранены весь docs WIP, registry receipt и четыре legacy next-env.d.ts.
Следующий отдельный scope — минимальное исправление dependency audit, затем
проверенная публикация и фактический CI. Не повторять API startup/DB fixes и не
начинать frontend optimization автоматически.

Практики: development-toolkit execution/backend/verification/review-cleanup;
Agency Code Reviewer и Git Workflow Master — минимальный scope, порядки init,
проверка invariants, сохранность исходного WIP и отделение local PASS от CI.
