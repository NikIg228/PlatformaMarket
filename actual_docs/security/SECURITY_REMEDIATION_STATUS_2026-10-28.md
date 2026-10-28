# Проверка исправлений Codex Security — 28.10.2026

Текущая сводка evidence по прямому поручению владельца; не новый backlog и не
сертификат полного аудита. Заменяет текущий статус старых remediation receipts,
но сохраняет их как историю. База: main `2752c872e79be28274ef8fdf8c2cf54f1480acd5`
с проверенными локальными исправлениями; состав публикации определяется Git diff.

План этой задачи: свести результаты, проверить неизменность входов и недостающее
доказательство reset-token, review и публикация проверенного scope. Продуктовое
поведение дополнительно не меняется. Риск — ошибочно выдать старый PASS за новый
или включить посторонние файлы; gates — SHA-256, целевые регрессии, scoped lint,
типы изменённого fixture, ссылки и diff hygiene, затем remote SHA и CI.

## Подтверждённые границы

Во всех строках ниже результат **verified fixed locally**. Различие источника
сохранено: четыре finding плагина, три дополнительных remediation-пакета и три
инварианта WAVE1. Это десять границ, а не десять официальных findings плагина.

| Источник / ID | Исправление и доказательство |
| --- | --- |
| Scan `a0660fb6-e8df-45cf-b744-b2b78c837cc9`: `auth.password-reset.nonatomic-token-consumption` | Атомарный claim действующего неиспользованного токена в транзакции до изменения пароля/сессий. Существующий код; свежие [5 регрессий](../../apps/api/src/modules/identity/email-token-consumption.spec.ts) PASS. Это unit-проверка проигранного claim, не отдельный live-тест конкурентного reset. |
| Scan `c9814eae-94e9-4554-8adb-b79467d9ac9f`: `commerce.recalled-lot-consumption` | Проверяется пригодность партии при списании. Полный PostgreSQL gate PASS: recall/expiry, rollback/release/dispatch и replay. |
| Тот же scan: `commerce.checkout-unaccepted-price` | Revalidation внутри Serializable checkout; изменившаяся цена требует согласия. PostgreSQL gate PASS, включая две SQL-сессии, согласие, rollback и replay. |
| Scan `fc8b9142-3b95-42d9-895c-08db9cb23b05`: `missing-authentication.social-identity-unlink` | Отсутствующий actor отклоняется до Prisma; [13 регрессий](../../apps/api/src/modules/identity/social-unlink.spec.ts) PASS. |
| `market-price-override-inventory-permission` | PRICE create/cancel требуют `inventory.adjust` и `pricing.manage`; [23 регрессии](../../apps/api/src/modules/inventory/data-override-permissions.spec.ts) PASS. |
| `market-integration-job-foreign-reservation-record` | SELECT и UPDATE ограничены connection/supplier/reservation; worker и agent finalizer. [Регрессии](../../apps/api/src/modules/integrations/reservation-job-scope.spec.ts) и 117 реальных PostgreSQL assertions / 20 сценариев PASS, включая смену привязки между SELECT/UPDATE, retry и законные переходы. |
| `market-import-rollback-shared-catalog` | Rollback запрещает архивирование используемого вне batch каталога; adoption сериализуется через общий parent lock. [Rollback](../../apps/api/src/modules/imports/import-rollback-isolation.spec.ts) и [adoption](../../apps/api/src/modules/offers/offer-catalog-lifecycle.spec.ts): unit PASS; 74 PostgreSQL assertions / 20 сценариев PASS, 12 видов зависимостей, оба порядка row-lock race, полный rollback durable effects и replay. |
| WAVE1: ledger isolation | Query filters пересекаются с tenant visibility; поставщик видит только свою allocation. [Unit](../../apps/api/src/modules/payments/payments.ledger.spec.ts) и HTTP/PostgreSQL PASS. |
| WAVE1: signer ownership | Чтение документа не разрешает завершение чужой подписи; organization/user привязаны к actor. [Unit](../../apps/api/src/modules/documents/documents.service.spec.ts) и HTTP/PostgreSQL PASS. |
| WAVE1: agreement parties | Для связанного договора нужны EDS обеих конкретных сторон; повторные, чужие и MOCK подписи не заменяют отсутствующую сторону. Те же unit и HTTP/PostgreSQL PASS. |

## Проверки и повторное использование

- `npm run verify:postgres` — PASS: schemas/API build (включая типы), migration
  upgrade и проверки приложения. `npm_config_ignore_scripts=true` отключил
  lifecycle prebuild generation; явные build scripts выполнены. Generated Prisma
  schema сверена с source modulo whitespace; занятую DLL чужого API не заменяли.
- `node verify-owned-reservation-postgres.cjs` — 117 assertions / 20 scenarios PASS.
- `node verify-import-postgres.cjs` — 74 assertions / 20 scenarios PASS.
  Эти два самостоятельных runner сохранены в managed artifacts ниже.
- `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs --wave1-security-only`
  — 42 HTTP/PostgreSQL assertions PASS. [Harness](../../scripts/lib/verify-wave1-security.mjs)
  требует собственного disposable cluster, SQL data_directory и отдельного порта.
- `npm exec --workspace=@marketplace/api -- vitest run` с восемью файлами:
  `reservation-job-scope`, `data-override-permissions`, `data-freshness`,
  `social-unlink`, `documents.service`, `payments.ledger`,
  `import-rollback-isolation`, `offer-catalog-lifecycle` (`*.spec.ts` в соответствующих
  модулях), `--no-cache` — 150/150 PASS.
- `npm exec --workspace=@marketplace/api -- vitest run src/modules/identity/email-token-consumption.spec.ts --no-cache`
  — 5/5 PASS при консолидации.
- Scoped ESLint изменённых TS/MJS с `--max-warnings=0` — PASS.
- `npm run typecheck --workspace=@marketplace/e2e` — PASS для адаптированного fixture.
- `node scripts/verify-runtime-split.mjs` — PASS на неизменённом API build;
  роли API/worker/all и запреты entrypoint/production проверены. Сборка из
  успешного PostgreSQL gate переиспользована. `node --check` обоих изменённых
  MJS runner — PASS.

Повторная сверка всех 27 source/config/lock SHA-256 из `source-snapshot.json`
дала 0 расхождений. Полный PostgreSQL gate после неизменённых входов не повторяли.
Данные проверялись на новых task-owned PostgreSQL17.10 кластерах со случайными
SCRAM credentials, отдельными портами и SQL-подтверждением data_directory.
Рабочая БД и пользовательские процессы не использовались.

Полные receipts, точные команды, hashes, логи и история неуспешных подготовительных
попыток сохранены штатным Codex Security artifact storage. Коллекция:
`artifacts-affe45ff7ccd29c6dcc081e3663d70823b8eb944c926fa85525cc861cc3acd8e`,
каталог `artifacts/remediation-continuation-20261028-1502/`;
точки входа `FINAL-VERIFICATION.md`, `verification-summary.json`,
`source-snapshot.json`, `focused-sql-run/postgres-run.json`.
Старые `ALL-FOUR-STATUS` с двумя blocked пакетами относятся к состоянию до
успешной SQL-проверки и не определяют текущий результат.

## Что остаётся открытым

Четыре finding в трёх завершённых scans сохраняют **open / remediation idle**
в Workbench. Штатная смена remediation state требует `actionToken` отдельного
Workbench action; в текущем поручении его нет. Handoff claim token продолжения
скана не заменяет actionToken. Sealed reports не переписывались; локальный PASS
не означает синхронизацию metadata плагина.

Покрытие исходных сканов частичное. Последний scan завершил шесть пакетов review
при inventory 2813 путей; это не проверка всех файлов. Полное покрытие требует
отдельного поручения. Production exposure, deploy, внешние OAuth/ERP/payment/EDS
провайдеры и юридические полномочия подписанта не приняты этими проверками.
EDS строки WAVE1 синтетические; криптография не проверялась. Общая политика
обязательных сторон для документов вне связанных договоров остаётся отдельной
продуктовой границей, не автоматически подтверждённой новой уязвимостью.

## Публикация

Первый проверенный scope опубликован в origin/main: `ffddb740c24c140cfe8301214f741099ea2526ba`.
Временные кластеры, локальные логи и output receipts в Git не включаются.
Фактические commit/remote SHA и CI сообщаются в отчёте публикации; pending CI
не означает PASS. Применены прочитанные Code Reviewer и Git Workflow Master:
проверка bypass/race/контрактов, состава diff и безопасного fast-forward push.

## Дополнение: зависимости и блокеры CI

После первого push [CI40717419649](https://github.com/NikIg228/PlatformaMarket/actions/runs/40717419649)
завершился FAIL на устаревшем admin-тесте (25 imports вместо 26);
PostgreSQL и контейнеры API/web прошли. [Security40717419514](https://github.com/NikIg228/PlatformaMarket/actions/runs/40717419514)
прошёл CodeQL, но production npm audit обнаружил15 записей:10 moderate,
4 high,1 critical. Владелец явно поручил исправить оба блокера.

Изменены manifests и lock: Next16.4.3 одинаков во всех6 объявлениях;
Zod4.6.7 (minimum4.6.6), Multer2.5.0 и body-parser2.4.0 через существующий
override-подход; qs6.17.0 разрешён обновлённым parser dependency tree.
OTel auto-instrumentations0.79.0 обновлён совместно с SDK/exporter0.221.0.
Nest остаётся на прежнем major11. Адресованы ranges из advisories
[Next](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[Multer](https://github.com/advisories/GHSA-q7qp-rjg7-q26m),
[body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828),
[Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[OTel](https://github.com/advisories/GHSA-qqmp-wf37-98f9) и
[qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw).
Исходный sharp override уже обеспечивал workaround для SVG; обновление Next
также устраняет остальные отмеченные audit advisories. Эксплуатация production
и достижимость каждого стороннего sink отдельно не утверждаются.

Admin-тест сохраняет точное число lazy imports и теперь явно требует
существующий `SigningAdmissions`. Два HTTP regression case проверяют gzip
и deflate с trailing bytes, отсутствие отражения мусора и нормальный запрос
после них. Gzip даёт безопасный400; zlib допускает хвост deflate с200,
при сохранении корректно разобранного тела и живого сервера.

Новые проверки после изменения lockfile:

- `npm audit --omit=dev --audit-level=high --json` — **0 уязвимостей**, exit0.
- `npm ls next zod multer body-parser qs @opentelemetry/auto-instrumentations-node @opentelemetry/sdk-node --all --omit=dev` — PASS.
- `npm test` —12 успешных workspace tasks,1832 теста PASS; API1007, schemas366,
  admin39.7 opt-in API PostgreSQL tests skipped; их skip не выдаётся за PASS.
- `npm run typecheck` —13/13 tasks PASS.
- `npm run verify:postgres` — свежий PASS вместе с schemas/API build,
  на новом task-owned PostgreSQL17.10 с SQL data_directory/port proof;
  сервер остановлен, кластер удалён. Прежний SQL PASS после смены lock не reused.
- API client build и unified web build (`next build --webpack`) на16.4.3 — PASS.
  Поддерживаемый `NEXT_ADAPTER_PATH` изолировал generated output/tsconfig в
  `.tmp/security-ci-dependencies-20261028`; точный next-env backup восстановлен,
  пользовательский dev-процесс и его `.next` сохранены.
- `node scripts/verify-runtime-split.mjs`, scoped ESLint двух изменённых test-файлов,
  `node --test scripts/dependency-security.test.mjs` (3 теста) — PASS.
- Реальные установленный OTel SDK, auto-instrumentations и HTTP exporter прошли
  start/shutdown с resourceDetectors=[], без внешнего коллектора/запросов.

Первое ожидание400 для deflate в новом тесте было неверно;16/17 PASS сохранено
как неуспешная попытка. Ожидание уточнено по нормальному поведению zlib;
финальный полный `npm test` включает17/17 parser cases. `npm install
--ignore-scripts --no-audit --no-fund` прошёл; остался cleanup warning о старой
SWC DLL, удерживаемой dev-процессом. Процесс/ACL не менялись, удаление не обходили.

Новые logs/runner/receipts сохранены в той же managed artifact collection,
`artifacts/security-ci-dependencies-20261028/`: `npm-test.log`, `typecheck.log`,
`dependency-tree.log`, `build-web.log`, `security-ci-run/postgres-run.json` и
`security-ci-run/verify-postgres.log`; исходные failed CI job logs также сохранены.
Отдельные self-review проходы проверили dependency resolution, все Next/Zod
consumers, parser bootstrap, API/worker instrumentation и окончательный diff.
Это не независимая делегация. Новая публикация и итоговый CI — в отчёте коммита;
Workbench metadata и неполное покрытие сканов остаются отдельными границами.

Публикация dependencies: `0f7bd27691bb088ad4ba8761e26101bebdddb8ce`, remote SHA
совпал. [Security40726395925](https://github.com/NikIg228/PlatformaMarket/actions/runs/40726395925)
SUCCESS (audit и CodeQL); [CI40726395894](https://github.com/NikIg228/PlatformaMarket/actions/runs/40726395894)
прошёл исходный unit blocker, types/build, containers и PostgreSQL, затем
выявил несовместимость старого `verify-document-compliance` с предыдущим actor
fix: оператор пытался создать подпись от имени supplier25 и получил403.

Verifier исправлен в том же CI compatibility scope: используется существующий
supplier20/user510 с membership и `document.sign`; session/complete идут из его
контекста. Добавлены operator impersonation403, foreign completion403 и проверки
сохранённого signer organization/user и успешной собственной подписи.
Продуктовые guards сохранены. Syntax/scoped ESLint и document unit23 PASS.
Полный исправленный verifier прошёл на новой owned PostgreSQL17.10 + реальном
API: PDF/checksum, версия2/SUPERSEDED, credentials/rule/check и SENT notifications.
Локальный профиль pilot/all с штатным inline outbox fallback; go_live/Redis
подтверждается только последующим CI. Первая подготовка через весь search-commerce
не подошла к сокращённой fixture (нужны три поставщика перчаток); вместо расширения
каталога создан только синтетический order, после SQL ownership proof. Вторая
попытка PASS; оба API/PG процесса остановлены и кластеры удалены.
Receipts/logs: `document-verifier-run/` (первая попытка) и
`document-verifier-run-2/` (PASS) в `artifacts/security-ci-dependencies-20261028/`.
Неизменённые dependency/build/types/full-unit/SQL gates не повторялись.

## Дополнение: dev/build зависимости

Предыдущий verifier опубликован в `7bd4e2db08873bce3372e8e507a3b1dd8138553a`;
[CI40729017785](https://github.com/NikIg228/PlatformaMarket/actions/runs/40729017785)
и [Security40729017814](https://github.com/NikIg228/PlatformaMarket/actions/runs/40729017814)
SUCCESS. Владелец отдельно разрешил устранить оставшиеся9 dev/build audit records
(2critical/3high/1moderate/3low), проверить совместимость и CI. Аудит кода этим
пакетом не продолжается; прежние ограничения покрытия сохраняются.

Vitest обновлён до4.1.12, Vite закреплён на7.3.7; fast-uri3.1.9 и js-yaml4.3.2
зафиксированы overrides. Nest CLI12.0.11 удаляет цепочку optional webpack checker
и deepmerge, у которого нет исправленного upstream release. Tinypool также
исключён из дерева. API использует требуемый CLI compiler TypeScript6.0.3;
runtime Nest остаётся11, frontend и остальные workspace — TypeScript5.9.3.
Chokidar5 согласован с Angular Devkit22; Prisma сохраняет свою совместимую ветку.
Существующий безопасный UUID11.1.1 закреплён через direct reference и override.

Совместимость: API больше не использует ненужный baseUrl и приватный Swagger
type import; typed renewal mock возвращает реальный `{ processed: 0 }`.
Font asset outDir адаптирован к CLI12 с сохранением прежнего runtime-пути.
Vitest discovery явно ограничен существующими src/app, без generated dist.
Два buyer profile cases сохранили assertions; холодные imports перенесены
в beforeEach без увеличения test timeout. Audit в обоих workflow теперь
включает devDependencies при прежнем пороге high.

Фактические локальные результаты на изменённом дереве:

- `npm audit --json --package-lock-only` — **0 всех severity**, exit0;
  `npm ls --all --json` — exit0, invalid/missing dependencies отсутствуют.
- `npm run typecheck -- --concurrency=2` —13/13 tasks PASS; после изменения
  buyer fixture его scoped typecheck и ESLint трёх изменённых TS/TSX PASS.
- Все1832 unit cases прошли по workspace. Общий `npm test` сначала выявил
  cold-import timeout buyer; после исправления buyer122 PASS, но общий запуск
  упёрся в5s source-scan UI при параллельном IO. Последовательное завершение
  `npm exec -- turbo test --filter=@marketplace/ui --filter=@marketplace/schemas
  --filter=@marketplace/api --concurrency=1` прошло4/4 tasks: UI90, schemas366,
  API1007 PASS;7 opt-in PostgreSQL cases skipped. Root command не объявляется
  успешным по сумме scoped проверок. Отдельная попытка с двумя concurrency flags
  была ошибкой подготовки команды и тестов не запускала.
- API build, четыре font/assets с побайтовой сверкой, runtime split и реальный
  CLI12/TS6 watch compile с0 errors PASS. Application при watch не запускался.
  Первые compiler errors и неверный asset путь исправлены; два watch setup
  отказа сохранены (absolute config path, затем output вне API). Финальный
  output находится внутри API, guard не отключён. Prisma client переиспользован
  без смены schema; clean generation остаётся в CI.
- Unified Next16.4.3 webpack build PASS с isolated generated output;
  пользовательский dev-процесс/.next и точный next-env сохранены.
- `node --test scripts/dependency-security.test.mjs scripts/ci-verification.test.mjs`
  —9/9 PASS; `git diff --check` PASS. Локальные DB для этого пакета не создавались.

Managed evidence: `artifacts/security-dev-build-20261028/` в supplemental artifact
collection проекта (audit, полное дерево resolution, build/watch/types/unit logs
и итоговый receipt). Self-review отдельно проверил удаление уязвимых цепочек,
compiler/runtime resolution, discovery и сохранность guards/assertions; делегации
не было. Изменения transitive production resolution при hoisting не выдаются
за dev-only lock diff; runtime/build PASS и clean CI проверяют совместимость.
Публикация и точные CI conclusions фиксируются в итоговом receipt этого пакета.

Первая публикация `2f473de33e10745facb0e0d49ad3edf4d0271c6c`: remote SHA совпал;
[Security40740022052](https://github.com/NikIg228/PlatformaMarket/actions/runs/40740022052)
SUCCESS (clean install, audit0, storage, CodeQL). В
[CI40740021988](https://github.com/NikIg228/PlatformaMarket/actions/runs/40740021988)
оба containers и PostgreSQL job SUCCESS, root npm test/types/lint/build PASS.
Verify остановлен на прямом Vitest вызове observability: substring filter
захватил также compiled CommonJS specs из dist. Это пропущенная совместимость
нового runner, а не падение source assertions. Во всех четырёх прямых root
Vitest verifier-командах добавлен тот же `--dir src`; filters/assertions сохранены.
Проверка выполняется при существующем dist; runtime/DB часть observability
остаётся полным CI gate, без записи в пользовательскую БД.
После исправления объединённый source-only набор четырёх verifiers прошёл
62 tests/14 files при наличии5 compiled observability specs; alert catalog7
rules/14 synthetic vectors PASS. Lockfile, types и продуктовый код не менялись;
их прежние PASS переиспользованы. Финальный CI проверяет полный orchestrated gate.

Итог проверен28.10 при актуализации документации: публикация
`5be841759b03046a6c3bb27293c93829355355ca`,
[CI40742163553](https://github.com/NikIg228/PlatformaMarket/actions/runs/40742163553)
и [Security40742163648](https://github.com/NikIg228/PlatformaMarket/actions/runs/40742163648)
completed/success. Ожидание финального CI снято; прежние ошибки выше сохранены
как история попыток. Общий code audit и production-приёмка этим не закрываются.

## Три исправления code audit — 29.10.2026

Scope: три finding завершённого scan `59e803b8-0bc7-4a64-9181-5553a2f09969`.
Medium ZIP actual expansion; Low browser handoff/login CSRF; Low billing authority
в non-production FULL_ACCESS. Исходный sealed report и severity сохранены.

- ZIP: перед ExcelJS проверяются local payload и фактический поток распаковки;
  превышение advertised/entry/total budget, alias и усечённый поток отклоняются.
  Финальная сверка JSZip обнаружила origin-shift при concatenated ZIP: неоднозначный
  gap перед EOCD и скрытый последний EOCD в comment также запрещены. Два новых
  regression cases плюс parser controls —27/27 PASS; scoped ESLint PASS.
- Handoff: одноразовый код требует capability-specific host-only HttpOnly proof
  cookie; в production используется Secure `__Host-` cookie без Domain. В БД
  хранится hash. Неверный proof не расходует код; TTL/CAS/revocation сохранены.
  Bearer credentials из URL отклоняются; восстановление sessionStorage работает.
- Billing: createPlan/subscribe/setFeature требуют MARKETPLACE_OPERATOR до чтения
  или записи, независимо от FULL_ACCESS; операторские действия сохранены.
  Prisma schema и migration не менялись. API OpenAPI описывает cookie protocol.

Совместимые synthetic fixtures перенесены из bearer URL в storage либо получают
выданный сервером proof cookie; proof не включается в navigable URL. В canonical
CI добавлены два buyer/supplier browser regression cases с отдельным browser context.

Локальные gates: focused ZIP/parser25, billing/policy13, auth13/client14 и cookie2
PASS; owning suites API1024/client96 PASS (7 opt-in PG cases skipped здесь).
`npm run typecheck -- --concurrency=1` —13/13 PASS; финальный E2E typecheck/scoped
ESLint PASS. Scoped lint всех изменённых TS/MJS, Node CI tests6/6 и node --check
fixture scripts PASS. `npm run verify:postgres` — PASS на owned disposable PG17;
27 дополнительных real HTTP/SQL assertions PASS: отсутствующий/чужой proof401,
затем нормальный exchange201/replay401; member billing403 без эффектов,
operator writes201/200 с проверкой persistence. `node scripts/verify-runtime-split.mjs`
после API build — PASS для трёх ролей и entrypoint/production guards.

История: первые API build/typecheck выявили неверный тип только нового test input,
исправлен string→number. Подготовка PG:1 — pg_ctl inherited-pipe hang,2 — штатный
dev/test alias guard;3 — исправленная подготовка, SQL gate и HTTP/SQL PASS.
Own PG/API остановлены, рабочая БД и чужие процессы не затронуты; temp cluster
не объявляется удалённым. Повторных неизменённых owning suites не требовалось.

Managed evidence: `artifacts/security-three-fixes-20261029/` standalone collection.
Отдельные security/compatibility и bypass/regression passes выполнены без агентов.
Unified Next build PASS с isolated generated output и точным восстановлением
next-env; пользовательская .next сохранена. Следующий gate — scoped commit/push и CI/Security
на точном SHA. До remote SUCCESS результат не считается полностью verified.
Workbench metadata не переводилась в verified: remediation actionToken не выдан;
прежний token другого scan не используется. Оставшийся audit кода пока не начат.

Первая публикация `8f4468a3d4a706ecde4f6a0e3d0b32636b0472c6`: remote SHA совпал;
CI40755337317 / Security40755337263 запущены. До их завершения обнаружено уточнение
ZIP parser boundary выше; финальная приёмка должна ссылаться на дополненный SHA,
а не на этот промежуточный запуск. Handoff/billing suites и PG PASS переиспользуются:
их входы не менялись; ZIP tests/types/API build проверяются после уточнения.
API typecheck PASS. Повторный обычный build остановлен в Prisma prebuild из-за
EPERM rename занятой Windows DLL; schema неизменна, ранее generated client
переиспользуется через npm_config_ignore_scripts=true, без остановки чужих процессов.
Clean install/generation остаётся обязательным CI gate.
Повторный API build с reuse generated client — PASS.
