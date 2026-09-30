# PlatformaMarket — backend и незакрытые обязательства

Сверка30.09.2026: main@2a816c337bae15f6684318cf26d21bf6f71cb3c5.
Требования — [Product V2](../product/DENTMARKET_PRODUCT_V2.md), выполнение —
[Workflow](../governance/DEVELOPMENT_WORKFLOW.md), доказательства —
[Acceptance Matrix](../governance/PROJECT_ACCEPTANCE_MATRIX.md).

Это реестр оставшихся результатов, а не разрешение выполнять весь backlog.
Последний запрос владельца: [согласованный выпуск оптимизаций и CI](../governance/task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md).
Он не открывает продуктовый backlog оплат и интеграций. При новой задаче сначала
проверять существующий код и контракт, затем закрывать только пробел.

## 1. Существующий baseline

Modular monolith, PostgreSQL/Prisma, tenant/session/permissions, каталог,
варианты/упаковки, CSV/XLSX import, matching/moderation, цены/остатки/партии,
checkout/reservation/compensation, documents/logistics/outbox, provider adapters
и optional modules имеют реализацию. Повторно создавать эти слои не нужно.

CORE-04.1–04.4 приняты на278be21, CORE-04.5 на73ac601 с успешными CI/Security
своих ревизий. Общие условия/операторский допуск ADR013, manual order workflow
и единые кабинеты также существуют; это не закрывает все CORE и Product §23.6.

A01–A18 опубликованы в2a816c3 и имеют LOCAL_PASS в согласованной границе:
цена checkout, пригодность партий, конфликт/повтор действий, склад, атомарность
предложения, свежесть, permissions, TTL резервов, дата документов, основные
cursor lists, единица продажи, mobile menu, PDF, восстановление корзины,
stale versions и их проверки. Старые задания «исправить A01–A18» не активны.
Исторический CI этого SHA красный; исправления опубликованы в8045225/75e0e21,
полный CI/Security последнего кодового снимка PASS (см. Matrix).

## 2. CORE: реализованное и точный остаток

| ID | Существующий код / результат | Незакрытое обязательство |
| --- | --- | --- |
| CORE-01.1–01.3 | agreements/onboarding, ADR013: общие версии, акцепт, отдельный допуск | Свести version/actor/organization/time, повторный акцепт/истечение и negative tenant/stale cases в scoped acceptance текущего контракта. Не возвращать две ЭЦП для нового поставщика; legal approval — EXT |
| CORE-02.1–02.4 | commerce/order-workflow и schemas/order-workflow: invoice, claim, supplier confirmation; PAID не от upload | §23.6: фактическая недоплата/остаток, переплата к возврату, сроки/адресаты и спор; money/document/tenant/replay/atomicity. Текущий контракт требует полную сумму, расширенные правила не считать реализованными |
| CORE-03.1–03.4 | logistics/inventory/order-workflow, reservation-expiry/cart-recovery: receipt, transitions/cancel/TTL/recovery | Полная multi-shipment/partial receipt матрица, отмена после оплаты/отправки, согласованный возврат; отдельная повторная закупка с текущими условиями. Recovery FAILED checkout не равно reorder завершённого заказа |
| CORE-04.1–04.5 | Ограниченные catalog/import/manual/new-product outcomes приняты | Не повторять принятые slices; live whitelist, реальные данные и media rights не подтверждены fixture |
| CORE-04.6–04.7 | Promotions module и UI есть | §23.3/23.6: discount/N+M, snapshot цены, version/moderation, gift reserve/limit, no stacking, partial cancellation,30-дневная история, блокировка обычной цены; витрина/список, supplier history/templates и условия заказа |
| CORE-05.1–05.3 | identity/access-control/organizations; registration/resume/workspace/logout/MFA slices | Общая матрица verification/reset, invites/role/disable, revoke/multi-tab и всех ролей CORE; локальный transport не внешняя доставка |
| CORE-06.1–06.6 | operations/moderation/in-app/outbox и ролевые страницы | Очередь reason/priority/owner/deadline/history; dedup CORE02/03 событий, missing external adapter без ложной доставки; guarded rollback, внутренние диалоги, operator §23.4 без SQL и обхода identity |
| CORE-07.1–07.3 | Operational/search metrics, workspace summaries | События/window/timezone: created/confirmed/received/repeat, price/stock refusals, delays; demo отдельно/dedup; защищённая аналитика организаций. Комиссия10% утверждена, целевое начисление по полученному товару не реализовано старым PSP fee |
| CORE-08.1–08.5 | Schemas/client/OpenAPI, upload bounds, security/config guards | Полнота CORE contracts; настоящий lint вместо tsc; npm-only lockfile housekeeping; body/upload/memory bounds по реальному пути; согласовать ADR009/production+pilot и Swagger policy. Не менять guards ради docs |
| CORE-09 | Единой итоговой приёмки нет | Scoped CORE01–08 outcomes, обязательные gates одной revision, отсутствие незакрытого критического риска, актуальная Matrix. Публикация и отдельные LOCAL_PASS не равны backend completion |

Правила оплаты, возвратов, акций, комиссии и внешних уведомлений согласованы
в Product §23.6, их реализация отложена владельцем. Не задавать эти вопросы
заново и не возобновлять старое разрешение28.09 вопреки последнему scope.
Открыты НДС комиссии/договорный график, ответственные/часы, поставщики каналов
и юридические тексты.

### Кодовые адреса и DoD

- CORE01: [agreements](../../apps/api/src/modules/agreements),
  [onboarding](../../apps/api/src/modules/onboarding), documents/commerce;
  contract + PG negative tenant/replay/version, UI допуска при его изменении.
- CORE02/03: [order workflow](../../apps/api/src/modules/commerce/order-workflow.service.ts),
  [контракт](../../packages/schemas/src/order-workflow.ts), logistics/inventory;
  exact money, locks/CAS, idempotency, audit/outbox, upgrade и browser roles.
- CORE04/06: catalog/imports/moderation/offers/promotions/operations;
  schema → API/client → UI, tenant/rollback/concurrency и critical flow.
- CORE05: negative authorization, controlled transport, revoke/MFA;
  development headers в production запрещены.
- CORE07: детерминированные aggregate fixtures/read permissions;
  без PII/high-cardinality labels и нового analytics service.
- CORE08/09: checks по Workflow, входы/evidence; отрицательный gate не
  пропускается, счётчик попыток не сбрасывается новым чатом.

## 3. Остаток прежних аудитов без повторной реализации

AUD-FIX01–06 и принятые07.1/07.2 — исторический baseline. Не повторять
логирование, logout/resume, local mail/login, исправления корзины/цены,
confirmation drafts, money formatting, выбор order/agreement в документологе.

| ID | Сохраняемый остаток |
| --- | --- |
| AUD-FIX-07 | Остальная document relationship/amount matrix, access/error/missing-file/limits/version/history, focus/navigation и permissions.07.1/07.2 не полный07; A11/A15 не все роли документолога |
| AUD-FIX-08 | Field help в инвентаризированных формах; честные admin search/health/error; responsive public navigation/hero/city, supplier documents/legal headings. Старый DOM сначала сверить с новыми компонентами |
| AUD-FIX-09 | Targeted gaps auth/catalog/purchase/payment/docs/operator/events; общий сценарий — POST-FULL. В manual payment поступление подтверждает поставщик, прежний operator decision не актуален |
| CATALOG-LAYOUT | Исторический browser5/7: два clinic sticky-header/mobile-panel cases не приняты, лимит3 попытки. Account menu позднее заменено ссылкой; при следующем scope сверить актуальные действия, не повторять старые locators |
| FRONTEND-DEMO / header return | Guest/new-registration return и сохранение catalog count/filter имели отдельные незавершённые browser проверки с лимитом3; A13–A15 не доказывают их автоматически. Сопоставить точные сценарии/входы при следующей затронутой задаче |
| CATALOG-FILTERS / shared catalog | Код compact filters, прямой HeaderAccount link и /clinic→/catalog опубликован. Полнота browser приёмки этих поздних UI slices не следует из общего unit PASS; способы оплаты в offer comparison ещё не отображаются |
| Unified application | Локальная реализация/scoped flows есть. Открыты production operator origin, Docker/ingress/streaming/uploads, external links, rollout/rollback и полная browser matrix; legacy sources нужны |
| ADR012 / CORE04/08 | Целевой authority по полям, самостоятельный marketplace limit и учёт ещё не отражённых ERP резервов не считать реализованными существующими manual overrides. Нужны отдельные schema/version/UOM/transition semantics и отрицательные/race tests; новый ERP provider остаётся EXT |
| Media pipeline | Manifest/provenance/READY/ObjectStorage требуют отдельной сверки. Derivatives, quality/duplicate QA, hardcoded external scripts и media rights — proposal/POST-BE/EXT; не запускать нормализацию автоматически |
| REBRAND | GitHub/name уже PlatformaMarket; local folder rename отложен, Windows3/3. Canonical root сохраняется; архивная команда не разрешает новый переезд |

## 4. Инженерные ограничения текущего снимка

- CI36737223743 FAIL: wrapper выбирает audit DB, CI создаёт marketplace;
  guard также ожидает другое имя. Нужна настройка конфигурации, не обход guard.
  Исправление30.09 локально внесено в [CI-DATABASE](../governance/task-state/CI-DATABASE-2026-09-30.md):
  DB regression14/14 и conditional telemetry fix PASS; typecheck/unit/API build,
  core/PG/runtime split/observability локально PASS. Опубликовано в8045225;
  CI36772750254 на75e0e21 SUCCESS. Startup/DB fix не выполнять повторно.
- Security36737223539: dependencies FAIL (2 high/4 moderate), CodeQL PASS.
  В текущем выпуске patched dependencies установлены, локальный audit0;
  Security36772750368 dependencies/CodeQL SUCCESS. Не повторять fix по старому run.
- Legacy buyer bundle budget FAIL; canonical web build PASS его не закрывает.
- Release matrix и основной browser gate переведены на api/web; canonical budget
  PASS. Native Compose/Caddy config PASS, hosted container api/web PASS на75e0e21.
  Live production parity, operator origin и rollout/rollback остаются отдельными.

Предложения и измерения — [архитектурный аудит](../architecture/CODEBASE-AUDIT-2026-09-30.md).
Текущий разрешённый объём и результаты — PERFORMANCE-CI-DELIVERY; остальные
кандидаты не становятся автоматически начатыми фазами.

## 5. Отложенные очереди

| ID | Условия и незакрытый результат |
| --- | --- |
| POST-BE.1 | После CORE09: reproducible npm ci/build, clean DB migration/seed, data manifest, runtime, Docker/CI и release rollback |
| POST-BE.2 / B4.6 | Representative load/SQL budgets, managed Redis failover, staging soak; старый local baseline не live evidence |
| POST-BE.3 | Monitoring/alerts, storage/AV, backup/restore/PITR/retention/recovery на одной revision |
| B5.1–B5.3 | Финальные role routes/states/accessibility/responsive acceptance; принятые slices не переписывать |
| POST-FULL | Три роли на одном build/data manifest: onboarding → offer/import/moderation → multi-supplier checkout → confirmation → payment → receipt/closure → docs → reorder, operator exceptions, negative tenant/replay/races |
| DEMO-01 | Local go_live composition есть; полнота AI/trust/recommendations/promotions/billing и operator journeys не принята целиком |
| EXT | Выбранные PSP, ЭЦП/ЭДО, supplier/1C/MySklad/custom, перевозчики, email/SMS, legal, реальные org/data, managed infrastructure/live pilot — отдельный scope |
| Post-pilot | API lifecycle/versioning, event compatibility/retention, крупные migrations, worker/provider performance budgets |

Production остаётся NO-GO. Runbook, adapter или UI не заменяют реальные
provider/legal receipts. Полный архив и карта переноса — только Documentation
index; реализация использует Product/ADR/контракты и текущий реестр остатка.
