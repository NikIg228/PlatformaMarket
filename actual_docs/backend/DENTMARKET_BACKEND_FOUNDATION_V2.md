# PlatformaMarket — backend и незакрытые обязательства

Сверка30.09.2026: main@2a816c337bae15f6684318cf26d21bf6f71cb3c5.
Требования — [Product V2](../product/DENTMARKET_PRODUCT_V2.md), выполнение —
[Workflow](../governance/DEVELOPMENT_WORKFLOW.md), доказательства —
[Acceptance Matrix](../governance/PROJECT_ACCEPTANCE_MATRIX.md).

Это реестр оставшихся результатов, а не разрешение выполнять весь backlog.
Разрешение владельца 02.10 после завершения темы: последовательно CORE-05–09,
backend/frontend, проверки, публикация после PASS и краткий итоговый аудит.
[CORE-05](../governance/task-state/CORE-05-INTERNAL-2026-10-02.md) CLOSED/CI_PASS,
0021438, CI36936601972 / Security36936601908 SUCCESS; внешняя доставка не принята.
[CORE-06](../governance/task-state/CORE-06-INTERNAL-2026-10-02.md) CLOSED/CI_PASS,4023881; CI36976595298 / Security36976595308 SUCCESS.
[CORE-07](../governance/task-state/CORE-07-INTERNAL-2026-10-02.md) LOCAL_PASS02.10; публикация и CI впереди, рабочая миграция не применена.
CORE-08 сохраняет production guards
по ответу владельца Q01; реальные сервисы/production — отдельный этап.
Последний запрос владельца01.10 после371aa9d: выполнять внутренний список6.2
по порядку без внешних интеграций и боевых данных. Первый этап —
[CORE-01-INTERNAL](../governance/task-state/CORE-01-INTERNAL-2026-10-01.md).
Каждый следующий этап — после gates/review/публикации/CI предыдущего;
нерешённые policy/legal вопросы и EXT остаются отдельными. Выпуск оптимизаций и CI закрыт:
[PERFORMANCE-CI-DELIVERY](../governance/task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md).
При новой задаче сначала проверять существующий код и контракт, затем закрывать
только пробел. Идентификаторы прежнего плана сохранены.

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
| CORE-01.1–01.3 | Внутренний scope CI_PASS01.10:831f7e0/df1f399, [evidence](../governance/task-state/CORE-01-INTERNAL-2026-10-01.md) | Legal approval/реальные организации и внешний signing остаются EXT. Внутренние version/actor/organization/time, replay/reacceptance/expiry, tenant/stale/admission и effective framework проверены; не выполнять повторно |
| CORE-02.1–02.4 | Внутренний scope CI_PASS на f893f8f: точные подтверждённые суммы/остаток/переплата, bilateral reduction/history, проверка/спор, настраиваемые15/30/60 рабочих минут; [проверки](../governance/task-state/CORE-02-INTERNAL-2026-10-01.md) | CI36852606548 и Security36852606570 SUCCESS. Банк/PSP, реальная доставка уведомлений и реальные дежурные не приняты; фактический возврат переплаты — CORE03/EXT. PAID только после подтверждения поставщиком полной текущей суммы |
| CORE-03.1–03.4 | [CI_PASS](../governance/task-state/CORE-03-INTERNAL-2026-10-01.md): aggregate multi-shipment/partial receipt, bilateral cancellation/manual returns, reorder с текущими условиями | Exact money/quantity, tenant/race/replay/upgrade и browser PASS. 1abeb4d опубликован, CI/Security SUCCESS; внешняя доставка и банковский возврат не приняты |
| CORE-04.1–04.5 | Ограниченные catalog/import/manual/new-product outcomes приняты | Не повторять принятые slices; live whitelist, реальные данные и media rights не подтверждены fixture |
| CORE-04.6–04.7 | [CI_PASS01.10](../governance/task-state/CORE-04-INTERNAL-2026-10-01.md) на f14cbe1: discount/N+M, immutable versions/price evidence, operator moderation, gift reservation/consent, storefront/history/templates и условия заказа | PG upgrade/tenant/race/replay, pilot46/46 и go_live2/2 desktop/390 PASS. CI36874461180 и Security36874461153 SUCCESS. Рабочая миграция140000 требует отдельного разрешения; dev остановлен. Реальные акции и legal launch не приняты; optional promotions остаются только go_live |
| CORE-05.1–05.3 | identity/access-control/organizations; registration/resume/workspace/logout/MFA slices | Общая матрица verification/reset, invites/role/disable, revoke/multi-tab и всех ролей CORE; локальный transport не внешняя доставка |
| CORE-06.1–06.6 | Реализованы contracts/API/UI очереди9 доменов, assignment/CAS/history, support и внутренние диалоги трёх ролей; [evidence](../governance/task-state/CORE-06-INTERNAL-2026-10-02.md) | CI_PASS4023881, CI36976595298 / Security36976595308 SUCCESS. PG/core/runtime/browser55 и targeted keyboard PASS; Внешние каналы/реальные дежурные не приняты; пропавший адаптер не означает доставку |
| CORE-07.1–07.3 | Contracts/API/UI/metric ledger: created/confirmed/received/repeat, structured refusals, delays, dataset/timezone, комиссия10% и корректировки; [checkpoint](../governance/task-state/CORE-07-INTERNAL-2026-10-02.md) | LOCAL_PASS: API494 baseline и focused backend20/schema44/client7/confirmation19/date1, PostgreSQL3, Prisma/runtime/core-contract2, typecheck2, web build/bundle, targeted browser2 PASS. Publication/CI впереди. Учёт полученной комиссии/долга и working migration не выполнялись |
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
| Unified application | Локальные scoped flows, canonical Docker builds и Compose/Caddy config приняты выпуском01.10. Открыты production operator origin, проверка ingress/streaming/uploads/external links в целевой среде, live rollout/rollback и оставшаяся полная browser matrix; legacy sources нужны |
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
PERFORMANCE-CI-DELIVERY завершён; текущая классификация остатка — раздел6.
Кандидаты не становятся автоматически начатыми фазами.

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

## 6. Разделение остатка: внутренний контур и техдолг внешней готовности

Дата:01.10.2026. Аналитический срез: main@665de61; кодовый baseline75e0e21
с успешными CI/Security. Основание — запрос владельца отделить работу без PSP,
API перевозчиков, боевых каталогов и данных поставщиков/клиник. Это уточнение
зависимостей существующих CORE/AUD/B5/POST/DEMO/EXT, без новых продуктовых функций.

### 6.1 Что означает «можно без интеграций»

Можно реализовать контракт, бизнес-переходы, хранение, UI и проверки на полностью
синтетических организациях, товарах, ценах, документах и событиях. Допустимы
собственные API приложения, disposable PostgreSQL, локальный Redis/storage,
существующие test adapters и контролируемое время. Запрет касается внешних
бизнес-систем и реальных данных, а не внутренних HTTP API и тестовой инфраструктуры.
CI/Git для проверки и публикации кода не являются подключением бизнес-провайдера.

«Можно» — техническая независимость от внешнего мира, не статус READY и не
поручение на разработку. Отложенная реализация Product§23.6 остаётся отложенной
до отдельного выбора scope. Не отключать guards, не переводить mock в live,
не выдавать test receipt за банковское зачисление, доставку или подпись.
Существующие принятые slices не переписывать; перед каждым slice сверить точный
пробел. Эта классификация основана на документах и выборочном чтении кодовых
границ, не на новом полном runtime-аудите и не на чтении рабочей БД.

### 6.2 Внутренняя работа: не требует внешних сервисов и боевых данных

| Исходный пункт | Доступный внутренний результат | Данные и достаточная граница будущей приёмки | Что остаётся снаружи |
| --- | --- | --- | --- |
| CORE-01.1–01.3 | Довести evidence версий общих условий, акцепта, повторного акцепта/истечения и допуска. Сначала проверить имеющуюся реализацию ADR013 | Синтетические buyer/supplier/operator, тестовые версии документов; tenant, полномочия, stale/replay, доступ до/после допуска | Юридическое утверждение текстов и реальная проверка организаций; квалифицированная подпись только в отдельно выбранном внешнем сценарии |
| CORE-02.1–02.4 | [CI_PASS](../governance/task-state/CORE-02-INTERNAL-2026-10-01.md): фактическая сумма/остаток/переплата, согласованное уменьшение, статусы проверки/спор, внутренние15/30/60 рабочих минут | Synthetic PG exact money/replay/concurrency/rollback/hold/upgrade и browser PASS; опубликован f893f8f, CI/Security SUCCESS. Суммы в minor units; PAID только от разрешённого подтверждения поставщика | Банк/PSP, фактическое поступление денег, внешние сообщения; квитанция сама не доказывает оплату |
| CORE-03.1–03.4 | [CI_PASS](../governance/task-state/CORE-03-INTERNAL-2026-10-01.md): частичное получение/несколько отгрузок, bilateral cancellation/return, отдельная повторная закупка | Synthetic PG и browser PASS: возврат согласован/товар отправлен/получен/деньги отправлены/получены, money/quantity/tenant/races/reprice. CI/Security SUCCESS на1abeb4d | API перевозчика, реальный трекинг/доставка и банковский возврат |
| CORE-04.6–04.7 | Довести discount/N+M, версии/модерацию, snapshot цены и30-дневную историю, gift reserve, запрет суммирования, пересчёт/согласование изменений, витрину и supplier history/templates | Искусственная история цен и остатки; цена/подарок фиксируются в заказе, частичная отмена/дефицит не меняют обещание молча; функциональные и role browser checks | Реальные акции/цены/товары поставщика и legal launch. Сохранить профильные ограничения; готовность optional-модуля не включает его в pilot |
| CORE-05.1–05.3 | Завершить матрицу регистрации/verification/reset, приглашений, ролей/disable, revoke/MFA/multi-tab на существующем identity | Синтетические пользователи, локальный контролируемый transport; expiry/replay/tenant, отзыв доступа, отсутствие утечки токенов | Доставка email/SMS, внешний identity provider при его выборе, реальные сотрудники/полномочия |
| CORE-06.1–06.6 | Операторские очереди с reason/priority/owner/deadline/history, внутренние диалоги, guarded rollback, in-app события и dedup, retry/error состояния | Фиктивные роли, outbox events и управляемые часы; полный операторский путь через штатные UI/API, права, audit, отсутствие ложного delivery status | Внешние каналы, реальные дежурные/рабочие часы и их приёмка |
| CORE-07.1–07.3 | Метрики created/confirmed/received/repeat/refusals/delays с окнами/timezone/dedup; внутренний расчёт комиссии10% по полученному товару, корректировки возвратов | Синтетические заказы/события, доставка и переплата исключены из базы; tenant isolation и повторный расчёт без двойного начисления; demo отдельно | Реальные KPI, выставление юридически действующего расчёта, взыскание/оплата комиссии, НДС и график договора. Старый PSP fee не считать целевым расчётом |
| CORE-08.1–08.5 | Закрыть найденные пробелы schemas/client/OpenAPI, lint и npm-only housekeeping, body/upload/memory limits; согласовать и проверить policy production/pilot/Swagger | Локальные payload/negative contract tests и config fixtures без реальных endpoints; миграции на disposable DB при изменении схем | Реальная конфигурация, ключи, TLS/domains и внешний аудит эксплуатации. Policy сначала согласовать, guards не ослаблять |
| ADR012 / CORE04/08 | Разработать field authority, marketplace limit, версии/UOM, переход источника и учёт ещё не отражённых ERP резервов | Синтетические снимки адаптера:10/5,3/5,0/5, reserve before/after echo, stale/duplicate/concurrent checkout. Общий контракт уточнить до реализации | Конкретная семантика полей и mapping настоящей ERP, credentials, реальный reconcile. Mock доказывает только принятый внутренний контракт |
| AUD-FIX-07 | Довести оставшиеся document relationships/amounts, permissions, missing-file/error/limits/version/history и навигацию | Синтетические документы/файлы; buyer/supplier/operator и negative access. Повторно не делать07.1/07.2 и принятые A11/A15 slices | Настоящие юридические документы, ЭДО/ЭЦП, реальные реквизиты |
| AUD-FIX-08–09; B5.1–B5.3 | Field help, достоверные состояния поиска/health/error, responsive/accessibility, targeted gaps auth/catalog/purchase/payment/docs/operator/events | Штатные компоненты, синтетический dataset и controlled failures; role routes, клавиатура/focus, mobile, draft preservation. Сначала сверить уже закрытые сценарии | Проверка с реальными пользователями/данными и внешний delivery не имитируются как production evidence |
| CATALOG-LAYOUT; FRONTEND-DEMO/header return; CATALOG-FILTERS/shared catalog | Уточнить оставшиеся сценарии clinic sticky header/mobile panel и guest/new-registration return; отображение способов оплаты в сравнении | Сопоставить прежние gaps с public-catalog/unified tests; обычный login return/filter/count уже частично закрыт выпуском01.10. Отдельно проверить вариант без явного города; найденная гонка описана в карточке выпуска | Реальные условия оплаты поставщиков; UI проверяется на синтетических условиях без PSP |
| Unified application; legacy buyer budget | Закрыть оставшуюся внутреннюю role/browser matrix; при отдельном scope устранить legacy budget превышение | Тот же canonical source, локальные builds и заданные ceilings; повторно не выполнять принятый перенос CI/Docker/ingress config | Приёмка доменов/operator origin, streaming/uploads/external links и rollout в целевой среде |
| CORE-09; POST-FULL | После зависимых slices принять согласованный внутренний цикл трёх ролей на одной revision/data manifest | Onboarding → offer/import/moderation → multi-supplier checkout → confirmation → ручная оплата → receipt/closure → docs → reorder; negative tenant/replay/races | Это LOCAL_CORE/внутренний сквозной PASS, не real pilot/LIVE_VERIFIED. Полный POST-FULL закрывать только по явно выбранной границе |

Для CORE02/03/07 отсутствие банка не блокирует внутренние состояния и расчёты.
Оператор не подтверждает деньги на счёте поставщика, а площадка не выполняет
банковский возврат. «Подтверждён пользователем в тестовом сценарии» и «проверен
внешним провайдером» — разные доказательства. Реальных поставщиков/клиник не
нужно заводить даже для приёмки tenant boundaries: используются несколько
синтетических организаций с различными ролями и доступом.

### 6.3 Смешанные/поздние пункты: только часть доступна локально

| Исходный пункт | Без интеграции можно | Почему весь пункт пока не закрывается |
| --- | --- | --- |
| POST-BE.1 | Проверять воспроизводимость сборки/миграций на чистой disposable DB, fixture manifest и сценарий локального отката; переиспользовать уже принятые CI/build/container checks | Итоговая приёмка после CORE09 требует release candidate и целевое окружение; отсутствие Docker engine на текущей машине не внешняя бизнес-зависимость |
| POST-BE.2 / B4.6 | Профилировать SQL/нагрузку на синтетическом наборе с явно заданным масштабом, проверять локальные failure cases | Production capacity, managed Redis HA и staging soak требуют выбранной инфраструктуры и representative hardware; синтетические показатели не фактический спрос |
| POST-BE.3 | Проверить правила alerts, локальное storage/error handling, процедуры backup/restore/retention на тестовых данных. Уже зелёный CI backup/restore не повторять без новых входов | Доставка alert дежурному, реальный AV/storage service, managed PITR/failover и recovery receipts остаются внешней приёмкой |
| DEMO-01 | Проверять имеющиеся локальные trust/review/moderation, recommendations, billing entitlements и operator journeys, их права/ошибки; у AI — только доступ/контракт/существующий явно обозначенный fallback | Настоящий ответ модели, качество на реальной выборке, реальная репутация и списания требуют внешних услуг/данных. Не превращать demo-smoke в приёмку всей optional-функции и не расширять CORE |
| Media M01–M08 | После отдельного scope сверить manifest/READY/provenance на тестовом storage; derivatives320/640/1200, checksum/MIME/размеры, contain/no-crop, duplicate/quality checks на созданных или разрешённых образцах | Права и точность реальных фото, живой каталог и целевое ObjectStorage требуют внешних данных/решений. Это всё ещё proposal, не автоматически обязательная очередь |
| Post-pilot | Проектирование API/event compatibility, migration и performance budgets можно выполнять на fixtures | Планом отложено после пилота; техническая возможность не меняет фазу и приоритет |
| REBRAND/local folder | Внешние сервисы не требуются | Отложено владельцем, Windows blocker3/3; классификация не разрешает повторить переезд или сменить canonical root |

### 6.4 Техдолг внешней готовности — DEFERRED_EXTERNAL

Это реестр отложенных интеграционных, данных и эксплуатационных обязательств,
а не перечень отсутствующих с нуля модулей. Названия строк — части существующего
EXT/POST, не новые номера задач. Не копировать его в параллельный backlog.
Владелец разрешения на возобновление — владелец продукта; конкретные исполнители,
поставщики и сроки пока не назначены. Для каждой строки нужен отдельный scope.

| Исходный scope / долг | Чего сейчас не подключаем и каких входов нет | Условие возобновления и доказательство закрытия |
| --- | --- | --- |
| EXT/PSP; CORE02/03 | Платёжный шлюз/банк, merchant account, credentials, банковские операции и payouts | Выбранный провайдер, договор/доступ к контролируемому sandbox; capture/refund/cancel и подписанный webhook/replay с receipts. Production отдельно. Автоматические payouts вне пилота |
| EXT/delivery; CORE03 | API перевозчика, тарифы/география, live tracking и реальные отправления | Выбранный перевозчик и согласованные статусы/mapping; полный цикл заказа доставки, обновлений/повтора/отмены с внешним evidence |
| EXT/supplier; ADR012 | МойСклад/1С/custom API, настоящие базы, склады, price lists, остатки/резервы и экспорт заказа | Реальный разрешённый test tenant/база, credentials, field/UOM/version mapping; sync → reserve/order export → cancel/release → reconcile/retry без двойного резерва. Следовать connector-readiness |
| EXT/real catalog and organizations; CORE01/04 | Боевые CSV/manual каталоги тоже внешние данные, даже без API; реквизиты, сотрудники, договоры поставщиков/клиник, цены/stock и whitelist | Полученные с разрешением владельцев данные, согласованный профиль доступа и импорт/сверка качества; реальные channel scenarios. Пока только полностью синтетические fixtures, не копия production dump |
| EXT/email/SMS; CORE05/06 | Настоящие адреса/номера, сервисы доставки сообщений, delivery receipts; Telegram отложен дополнительно | Выбранный провайдер/контролируемые получатели, договор/credentials; отправка/доставка/retry/dead-letter подтверждены. In-app PASS не закрывает этот долг |
| EXT/ЭЦП/ЭДО; CORE01/AUD07 | Gateway, сертификаты, реальные полномочия подписанта, юридически действующий документооборот | Выбранный сервис, разрешённый сертификат, checksum/signer/org callback и legal sign-off. Не возвращать две ЭЦП для допуска вопреки ADR013 |
| EXT/AI; DEMO-01 | Вызовы внешней модели и оценка на реальных данных | Явно утверждённые provider/model/data boundary, credentials и сценарии качества/ошибок; fallback не evidence ответа модели |
| EXT/managed infrastructure; POST-BE/B4.6/Unified | Production domains/TLS/operator origin, managed PG/Redis, live storage/AV, внешняя telemetry/alert delivery, deploy/rollback | Выбранная среда и ответственные, secrets вне git; actual ingress/upload/streaming checks, PITR/HA/storage restore/alert/staging-soak receipts одной revision. Docker build PASS уже есть, live rollout — нет |
| EXT/media; M01–M08 | Реальные изображения/право использования, внешние каталоги и целевой storage | Подтверждённые права/provenance и проверенные реальные bytes/качество/соответствие варианту; UI-фото и READY сами этого не доказывают |
| EXT/live pilot; POST-FULL | Реальные участники, заказы, повторные закупки и эксплуатационная статистика | Явное разрешение реального пилота, готовность выбранных каналов/правовых условий; критерии Product§16–17, включая20 реальных заказов. Нельзя закрывать синтетическими заказами |

Канонические внешние критерии: [connector registry](../integrations/connector-readiness.md)
и [live readiness](../operations/live-provider-readiness.md). Наличие adapter
или успешный health check не закрывает бизнес-цикл. Даже PSP sandbox/тестовый
tenant провайдера остаются внешней интеграцией и не входят во внутренний контур.

### 6.5 Решения владельца/юриста — DEFERRED_DECISION

Эти зависимости выделены отдельно от программного техдолга:

- НДС комиссии и договорный график расчётов. Базовая ставка10% и база начисления
  утверждены; внутренние расчёты можно проверять, а НДС/график не придумывать.
- Реальные основной/резервный ответственные и рабочие часы. Механизм можно
  тестировать с фиктивным расписанием; обещать реальный SLA до назначения нельзя.
- Утверждённые политики/договоры и способ допустимой подписи. Версии/акцепт
  тестируются на обозначенных тестовых текстах; черновики не legal approval.
- Выбор конкретных каналов, провайдеров, инфраструктуры, настоящих организаций
  и разрешения на их данные. Наличие адреса/API в старом runbook не разрешение.
- Согласование policy production/pilot/Swagger в CORE08: это внутреннее
  архитектурное решение до правки guard, а не зависимость от платёжного API.

Текущие открытые бизнес-вопросы: [реестр](../product/PILOT-OPEN-QUESTIONS.md).
Техническая независимость не отменяет прежнюю отсрочку Product§23.6.

### 6.6 Зависимости внутренней реализации и граница завершения

Это предлагаемый порядок внутри уже существующего плана, не новое разрешение:

1. Для выбранного slice — сверка текущего кода/тестов, контракт и synthetic
   fixtures; CORE01/05/08 дают общие правила доступа/версий и доказательства.
   Не требовать полного переписывания этих модулей перед любым UI исправлением.
2. CORE02/03 — согласованные состояния ручной оплаты, исполнения и возврата.
   Изменения схемы/API предшествуют UI; действующие invariants сохраняются.
3. CORE04.6–04.7 и ADR012 — коммерческие условия/резерв и источники данных;
   проверять вместе с затронутыми checkout/returns semantics, без живой ERP.
4. CORE06/07 — события, операторские действия, расчёты и аналитика на уже
   определённых переходах. Комиссия зависит от получения/возвратов CORE03;
   UI/AUD/B5 закрываются вместе с соответствующим slice, не общей переделкой.
5. CORE09, затем POST-BE/B5 и POST-FULL по Product§19. Внутренние проверки
   отделены от внешних частей раздел6.4; DEMO/media/post-pilot не обязательные
   prerequisites CORE и не начинают выполняться из-за этой классификации.

Для каждого будущего slice задаются конкретные fixtures и gates Workflow:
TS change — typecheck/unit/diff; schema/API — core-contract; money/tenant/stock/
rollback/concurrency — PostgreSQL; runtime — runtime-split; затронутый critical
UI flow — browser; policy/config — соответствующий configuration gate.
Это матрица будущей проверки, не команды для запуска во время docs-only анализа.
Успех внутренней реализации записывать с revision/fixture/evidence и её точной
границей; DEFERRED_EXTERNAL/DECISION сохраняются до собственных подтверждений.

### 6.7 Основания анализа и checkpoint

Выборочно проверены действующие кодовые границы:

- [order-workflow contract](../../packages/schemas/src/order-workflow.ts) и
  [service](../../apps/api/src/modules/commerce/order-workflow.service.ts):
  REPORT/CONFIRM_TRANSFER уже есть; проверка равенства полной сумме показывает
  пробел недоплаты/переплаты, а не необходимость нового PSP для внутреннего учёта.
- [logistics](../../apps/api/src/modules/logistics/logistics.service.ts):
  shipment transitions/audit/outbox существуют; внутренний статус не receipt перевозчика.
- [notifications](../../apps/api/src/modules/notifications/notification-adapters.ts):
  IN_APP/mock/HTTP разделены; можно тестировать события без настоящего send.
- [integration contract](../../apps/api/src/modules/integrations/adapters/integration-adapter.ts)
  и [payment contract](../../apps/api/src/modules/payments/adapters/payment-adapter.ts):
  interfaces/mock не заменяют проверку конкретного внешнего adapter.
- Product§19/23.6, ADR012/013, разделы2–5 и Acceptance Matrix определяют исходные
  обязательства. Прежние архивные карточки не использовались как новая очередь.

Задача DEPENDENCY-SPLIT-2026-10-01: docs-only, владелец primary
01a0f302-2d38-75d1-b79c-141e7428b533, один writer. Применены прочитанные Agency
Backend Architect (границы контрактов/внешних зависимостей) и Technical Writer
(один реестр, источники, отличимые статусы). Агенты не создавались.
DoD: покрыть существующий остаток, отделить mixed/decision/live, сохранить
закрытые результаты, проверить ссылки/согласованность/diff и опубликовать docs.
Runtime/build/DB/browser/security проверки не требуются для этих docs-only inputs;
код, данные, конфигурация и пять исходных dirty файлов не меняются.
Проверено01.10:428 активных ссылок/481 архивная,305 archive entries с сохранёнными
hash/semantics,115 исходных документов и пять protected WIP — PASS; diff check
PASS. Итоговая классификация готова к публикации docs-only commit. CI кода75e0e21
не перезапускается: его входы неизменны (Workflow4.2); [skip ci] относится только
к этой записи документации, не к будущей реализации перечисленных slices.
