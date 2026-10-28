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

Проверенный scope подготовлен к обычному commit/push в origin/main по AGENTS §8.
Временные кластеры, локальные логи и output receipts в Git не включаются.
Фактические commit/remote SHA и CI сообщаются в отчёте публикации; pending CI
не означает PASS. Применены прочитанные Code Reviewer и Git Workflow Master:
проверка bypass/race/контрактов, состава diff и безопасного fast-forward push.
