# PlatformaMarket — актуальная матрица приёмки

Маршрут с08.10: приоритет №1 — [функциональная карта](../FUNCTIONAL_AUDIT_AND_ROADMAP_2026-10-08.md),
подробные требования — [PROJECT_OVERVIEW](../PROJECT_OVERVIEW.md),
единый реестр исполнения — [Main Roadmap](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md).
Ниже evidence отдельных задач, с датами и границами версий. Это не общий PASS
текущего dirty checkout и не доказательство production. Старые карточки доступны
по совместимым адресам как архив; читать их только для нужного evidence.
Пересборка документации не переоткрывает CORE и не закрывает POST/EXT/R0–R9.

09.10 CATALOG-REFERENCE-V3 — LOCAL_PASS: каталог по утверждённому референсу,
пять desktop колонок, статичные прямоугольные акции, sticky только toolbar,
сортировка, реальные brand/parameters/price unit/supplier count/availability,
выбор поставщика через существующий modal. Unit9/browser6 PASS, buyer/web/e2e
types, scoped lint/UI-contract348, final go_live build PASS. Screenshot и computed
styles1440/390, scroll/focus, error/empty/retry/cart consumers проверены.
[Checkpoint и границы](task-state/CATALOG-REFERENCE-V3-2026-10-09.md).
Это частная приёмка R7; рабочие данные, страница товара и общий R7 не изменены.
Publication/CI receipt — в checkpoint, локальный PASS не означает CI_PASS.

08.10 STATUS-CARDS-V2 — LOCAL_PASS, baseline main b06a41e + this patch:
approved shared success/error/info and yellow warning cards; catalog add result,
unknown write outcome, pagination retry preserving products, filter/offer retry,
authoritative cart-change notices, deduplicated offline and verified recovery.
Two modal defects repaired after explicit additional cycle authorization:
portal specificity keeps close above backdrop; focus stays in the open dialog
when retry trigger unmounts. Final11 unique browser scenarios PASS (desktop/mobile,
including3 unchanged consumers with reused evidence); focused unit tests PASS,
six affected frontend workspace types PASS, scoped ESLint/UI-contract343 PASS,
go_live web build PASS. Prior failed attempts retained in
[checkpoint](task-state/PRIMARY-SESSION.md); screenshots/traces in
`output/playwright/status-cards-v2-*`, logs `.tmp/status-cards-*`.
No backend/DB/deploy changes or full release certification; R7 remains open.
08.10 R1.1 — OWNER_SCOPE_ACCEPTED / TRUST_CODE_AUDIT:
trust обязателен в пилоте, AI только для стандартизатора Excel/CSV; AI-помощники
вне текущего плана, рекомендации/подписки/реклама отложены. Реализация R3.7/R7.5
не принята. Сверка main3012394/runtime1e666ee:9-компонентный score engine,
reviews/appeals/API и часть UI существуют; автоматические producers событий
из бизнес-переходов и полный canonical apps/web путь не подтверждены.
Текущий pilot выключает trust. Точные параметры/пробелы —
[R1 checkpoint](task-state/R1-LAUNCH-SCOPE-2026-10-08.md).
Existing CI37739925051 `verify:trust-geo` PASS на synthetic fixtures переиспользован
без расширения до live/полного UI; новых app/DB/browser запусков для docs нет.

08.10 R0 — ACCEPTED / CI_PASS, baseline **R0-2026-10-08**:
`1e666eef94d9012d0e7a54991e68391b677e7018`, remote SHA подтверждён.
Опубликованный patch исправляет document retry focus, обновляет устаревшие
UI assertions и проверяет promotions отдельным go_live profile после pilot.
Targeted26, full-access3, promotion4 PASS; UI/web/E2E types, lint, оба builds PASS.
Visual recovery4 PASS, desktop/mobile focus и screenshots проверены.
История attempts и точные команды — [checkpoint](task-state/R0-BASELINE-2026-10-08.md).
[CI37739925051](https://github.com/NikIg228/PlatformaMarket/actions/runs/37739925051)
и [Security37739925079](https://github.com/NikIg228/PlatformaMarket/actions/runs/37739925079)
SUCCESS: canonical browser107/107, full-access3/3, promotion4/4, import/rollback7/7;
PG, containers, lint/types/tests/build и runtime/production checks PASS.
Dev/test44/44 migrations; production UNKNOWN. Audit9 moderate OpenTelemetry
остаются при high/critical gate PASS. R0.1–3 закрыты, R1 не начат. Следующий
receipt docs-only сохраняет code/config/lock inputs; CI переиспользуется.
Ниже сохранены старые CI failures как история.

08.10 R0 repair — ORIGINAL_BLOCKERS_FIXED / BROWSER_CI_FAIL:
опубликованы2d6b749 и29ffa54435e77c796fd6dc676b438e49c1a81a93, remote SHA
подтверждены. PG3 PASS; API32tests, dependency regression3, fixture tests7,
types/lint, go_live build, production auth/runtime PASS. FlowB3 после ожидания
animation.finished PASS2 locally; в CI29ffa54 FlowB3, PG, containers и Security
PASS. CI37732546397 FAILURE: canonical browser81 PASS /25 FAIL в6 specs;
full-access SKIPPED. Security37732546407 SUCCESS. Audit high0/critical0, moderate9
OpenTelemetry остаются. Команды/attempts/границы в [checkpoint](task-state/R0-BASELINE-2026-10-08.md).
R0.2 открыт; browser failures требуют сверки с принятыми UI-контрактами,
массовая замена assertions не выполнена. Рабочая DB/R1/deploy не менялись.

08.10 R0 initial baseline — исторический BASELINE_RECORDED / CI_FAIL:
main0bd933e, runtime e68a518; исходный dirty5 — только проверенные metadata и
Next instructions. [Checkpoint](task-state/R0-BASELINE-2026-10-08.md) содержит
владение, состав публикации, маршруты, remote/CI и остаток. Dev/test44/44
миграций;4 byte differences объяснены LF/CRLF, неизвестных/незавершённых0.
Read-only10 HTTP probes200 — доступность оболочек, не бизнес/E2E приёмка.
CI37696144727 и Security37696144642 FAILURE: verify:postgres fixture контактов
и npm audit; контейнеры/CodeQL SUCCESS. Локальный UI PASS не отменяет эти FAIL.
Документирование не запускает R1, рабочие migrations или CI repair.

08.10 FUNCTIONAL-AUDIT-ROADMAP — CODE_AUDIT / TARGETED_UNIT_PASS:
функциональная карта на1fb24ca9698769c69d2c23265f6a9a7105fecd45; 24 server test
files /163 tests PASS (13/79 +11/84). Точные команды, связи API/UI и границы —
в [приоритетном документе](../FUNCTIONAL_AUDIT_AND_ROADMAP_2026-10-08.md).
Это не новый PostgreSQL/E2E/live PASS. Self-service ERP обеих ролей и совместная
реализация backend/UI — принятые требования; runtime подключения через поддержку
пока не заменён. Docs-only evidence — [checkpoint](task-state/FUNCTIONAL-AUDIT-ROADMAP-2026-10-08.md).

08.10 STATUS-TOASTS — LOCAL_PASS:
scope main1fb24ca plus reviewed action-feedback diff. Clinic, supplier and operator
action outcomes use one bottom-right card: solid brand green success/red error,
semantic icon/title/explanation, five-second timer and slide-out, manual close.
Fluent modal ownership preserves accessible feedback and focus restoration;
field validation, access conditions, business states, drafts and recovery controls
remain contextual. No API, permissions, money/stock or database contract changes.
Final shared-provider browser8 PASS; support5 PASS (compact support case rerun
after removal of its old timer). Includes both roles1440/390, operator reply,
same-error retry after expiry/dismiss, modal keyboard close, document upload and
accounting recovery, inventory, attachments and retained drafts/idempotency.
All six affected frontend workspace types, scoped ESLint, UI-contract343 sources,
go_live web build and diff hygiene PASS. White-text contrast: green5.35:1,
red6.49:1, amber5.46:1, blue6.90:1. Desktop/mobile modal captures inspected;
clock-controlled captures use disabled CSS animation for a settled visual.
Commands/attempts/publication: [checkpoint](task-state/PRIMARY-SESSION.md).
Logs `.tmp/status-toast-*`; screenshots `output/playwright/status-toasts*`.
Full E2E/release/backend/DB suites NOT_RUN: UI feedback slice with intercepted API.
This does not close R7 or certify production/CI.

08.10 DOCUMENTS-REDESIGN — LOCAL_PASS:
scope main5d24ae5 plus reviewed Documents diff. Clinic procurement/supplier sales
registry, grouped server filters, bounded counterparty search, periods, cursor
paging; desktop detail/mobile drawer with independently loaded related order
documents, downloads/signatures/versions and permission-based accounting.
Marketplace agreement/credentials moved to supplier Settings; legacy link redirects.
Schema4/client1/document-service-and-isolation55/OpenAPI3 tests PASS; nine unique
targeted fixture browser cases PASS (1440/390, keyboard/return focus, filters,
empty/error/retry, upload draft, accounting recovery/denial). Final screenshot and
computed control sizes inspected. Affected types/scoped lint/UI-contract342 sources,
schema/API builds, runtime split and go_live web build PASS. No DB writes, migration,
external signing, release certification or full E2E. Legacy entry UI preserved.
Attempts, commands, artifacts and publication status:
[checkpoint](task-state/DOCUMENTS-REDESIGN-2026-10-08.md). This slice does not close R7.

08.10 SUPPLIER-CONTACTS-SOURCES-TABS — LOCAL_PASS:
scope main@110e27b plus this task's reviewed diff. Supplier official/public contact
and exactly two reserve contacts required for completion/save; legacy profiles
remain readable. Catalog receives official fields only, order contacts are read
after permission/party checks. Existing JSON persistence, no migration or live seed.
Shared navigation tabs (Settings/Import/order), contextual help, cancel hover and
five-second bottom-right save toast; 1C/MoySklad guided request UI uses existing
support API. No live connector activation or external-service readiness claimed.
Service/profile8, projection/order12, terms15, schema3 and public render1 PASS.
Isolated DB contact persistence/replay/rollback/role/tenant/privacy proof PASS;
runtime split/OpenAPI PASS.17 unique browser cases PASS at1440/390 including
contact completion, errors/recovery, keyboard/dialog focus, import/order tabs,
touch help and toast timing. Visual captures inspected in
`output/playwright/supplier-contacts-ui-2/`, `supplier-contacts-final/` and
`supplier-toast-mobile-verified/`. Final affected types, scoped ESLint,
UI-contract337 sources, API/schema builds and go_live web build PASS.
Attempts and exact commands: [task checkpoint](task-state/PRIMARY-SESSION.md).
Logs `.tmp/supplier-contacts-*`, `.tmp/supplier-sources-*`, `.tmp/supplier-toast-*`.
Full E2E/release NOT_RUN: focused slice with isolated backend and affected UI gates.
Publication/CI recorded separately; R7 remains open.

08.10 SETTINGS-PROFILE-EDITABLE-V2 — LOCAL_PASS:
scope main@3fa9089 plus this task's reviewed diff; owner-approved Settings/Profile
for clinic and supplier, inline name/email/phone/avatar, additional work contacts.
[UI pattern](../ui-ux/DESIGN_SYSTEM.md),
[API and migration](../operations/production-auth-runbook.md),
[attempts and publication](task-state/PRIMARY-SESSION.md).
Identity/org/upload/session suites100 PASS; body-policy13 PASS; schema3/client2/
UI tokens5 PASS. Isolated migration deploy/upgrade, CAS concurrency, rollback,
role/tenant denial, contact idempotency and verified email/session transition PASS.
Actual JWT HTTP API PASS with a loopback scanner simulator and private local mail;
no external delivery certification. Targeted browser17 unique cases PASS, including
1440/390 both roles, keyboard/touch cancellation, drafts/errors/retry, contact add,
address conflict rebase, sessions pagination/revoke and existing navigation/logout.
Final screenshots inspected: `output/playwright/profile-edit-v2-final-visual/`.
Affected schemas/API/web/UI/client/e2e types, API build, go_live web build, scoped
ESLint and UI-contract PASS. Logs `.tmp/profile-edit-*`. Full E2E/release were not
run: scoped UI/auth/upload change, covered with targeted DB/HTTP/browser gates.
Owner-approved local migration20261007190000_profile_contacts applied after a
validated private backup; existing User/OrganizationProfile values unchanged.
No seed or production deployment. R7 and external production readiness remain open.

05.10 INVENTORY-EDITOR-TEMPLATES — LOCAL_PASS (CI отдельно при доставке):
[контракт](../applications/supplier-web.md),
[HTTP и проверка](../integrations/runbooks/manual-supplier.md).
Раздельные команды stock/price, права, strict payloads и отсутствие записи
другого измерения. Редактор на странице остатков; contextual link открывает
выбранный баланс с фокусом. Plain XLSX/CSV: один товар, все12 колонок заполнены.
Service8/schema8/client2 PASS; ImportFileParser14/14 PASS2 (CSV assertion corrected).
Scoped types и ESLint PASS; API build PASS2 (первый EPERM из-за DLL dev API).
Isolated PostgreSQL commercial PASS2 (первый не стартовал из-за вызова wrapper
без npm): HTTP validation/role/tenant, rollback, stock race, replay, publication
and warehouse versions; fixtures cleaned. Runtime-split и runtime OpenAPI PASS.
Browser7/7 + affected existing3/3 PASS1; desktop1440/mobile3902/2 PASS2 после
компактной ширины поля/кнопки, initial и saved снимки просмотрены.
Canonical go_live web build PASS2 (повтор после scoped CSS).
Логи `.tmp/inventory-*.log`, снимки `output/playwright/inventory-editor/`.
Применены Development Toolkit, Agency UI/Code Reviewer и Spreadsheets.
Full E2E/release не запускались: ограниченная правка, отдельные целевые UI/API/DB
проверки; рабочая БД не изменялась, миграций и новых интеграций нет.

05.10 PRODUCT-PAGES-REFINEMENT — LOCAL_PASS (CI отдельно при доставке):
[контракт](../applications/supplier-web.md), [общий поиск](../ui-ux/SHARED_SEMANTIC_THEME.md).
DmSearch440×44, inner Find/clear/Enter/IME; компактные corrections/promotions,
формы без roadmap, inventory cursor loading/retry/cancellation без нижних панелей.
Рабочий XLSX с примером/инструкцией: ImportFileParser13/13 PASS3 после исправления
XML namespace экспорта и CommonJS-пути fixture. Browser31 уникальный case PASS: supplier20, refinement4,
shared3, catalog2 и calendar2. Search PASS3 после исправления тестовых assertions;
catalog PASS2 после исправления fixture. Финальные снимки1920/390 PASS2 после
исправления mobile grid overflow в picker; manual/recovery повтор2/2 PASS.
UI/web/buyer/supplier/e2e types, scoped ESLint, canonical go_live web build PASS.
API build при восстановлении dev: FAIL1 из-за import.meta в новом spec;
CommonJS-compatible fixture path исправлен, API build PASS2, parser13/13 PASS3.
`git diff --check` PASS. Логи `.tmp/refine-*.log`; снимки
`output/playwright/product-refinement/`. Применены Development Toolkit,
Agency UI/UX/Code Reviewer/Git Workflow и Spreadsheets для XLSX.
Без full E2E/DB/release: backend бизнес-операции не менялись, API перехватывались
fixtures; проверка парсера использовала настоящий скачиваемый файл.

05.10 SHARED-FOCUS — LOCAL_PASS (CI отдельно при доставке):
[контракт](../ui-ux/SHARED_SEMANTIC_THEME.md). Единый тонкий Tab-индикатор;
клик/набор/редактирование не включают keyboard mode и не создают двойную рамку.
Modality units3/3 PASS1; browser3/3 PASS2 после уточнения outline offset:
поиск заявок1440/390, textarea, button, Dropdown/portal/Escape, forced colors,
ошибки регистрации и checkbox. UI/e2e types, scoped ESLint и canonical go_live
web build PASS; визуально проверены сохранённые desktop/mobile снимки.
Снимки `output/playwright/shared-focus/`, логи `.tmp/shared-focus-*.log`.
Без backend/DB/full E2E: изменение общего frontend focus, не release gate.

05.10 PRODUCTS-UX-V2 — LOCAL_PASS (CI проверяется отдельно при доставке):
[контракт](../applications/supplier-web.md), [checkpoint](task-state/PRIMARY-SESSION.md).
Семь согласованных поверхностей: добавление, импорт, заявки, исправления,
остатки, акции и инспектор. Desktop breadcrumbs; mobile title/back icon.
Серверный preview импорта, точная конверсия цены; резервы/страховой запас
сохраняются, недостаточный остаток и конфликт версии откатывают строку.
Focused API34/34 + stock4/4, schemas51/51, client9/9, Swagger3/3, web6/6;
20 уникальных browser cases PASS, affected7/7 после visual polish.
Scoped lint/types, canonical go_live web build, API build/runtime-split PASS.
PostgreSQL product reads и workflows PASS; stock rollback и two-connection
reservation race PASS. `verify:postgres` equivalent: reused schemas/API builds +
`npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` PASS.
Visual1440/390 всех7, inventory900 и live read-only links PASS; отсутствующие
READY фотографии показаны заглушками. Логи `.tmp/products-ux-*.log`, снимки
`output/playwright/products-ux-v2/`. Рабочая БД/production не менялись;
полные frontend/E2E/release suites не запускались вне затронутого scope.
Применены Development Toolkit, UI/UX практики, Code Reviewer и Git Workflow Master.

02.10 ROLES — CLOSED / CI_PASS: [checkpoint](task-state/CABINET-UX-2026-10-02.md),
[ADR017](../architecture/adr/017-temporary-local-full-access.md). FULL_ACCESS для clinic/supplier/admin;
роли сохранены, tenant/identity/capabilities действуют. Root и contract/PG/runtime/config PASS;
57 RBAC + 3 full-access browser PASS, local21 pages PASS. Redesign отложен.
Код4aa1e00; CI37011303819 / Security37011303920 completed/success, attempt1.

02.10 SHARED-THEME — CLOSED / CI_PASS: [checkpoint](task-state/SHARED-THEME-2026-10-02.md),
[контракт и аудит](../ui-ux/SHARED_SEMANTIC_THEME.md). Общая светлая палитра v1,
Fluent/CSS состояния, auth/public/workspace overrides, Tag tones и keyboard modality.
Typecheck13/13, unit12/12, targeted UI61/61, canonical build/budget, browser51/51,
последующая StatusTag regression2/2 PASS. Root/local gates и targeted reuse отражены
в checkpoint. Рабочая БД, deploy, внешняя identity и full dark acceptance вне scope.
Код d067809, CI36928758840 / Security36928758801 completed/success (первая попытка).

Baseline30.09.2026: main@2a816c337bae15f6684318cf26d21bf6f71cb3c5.
Обновление01.10: отдельный согласованный PERFORMANCE-CI-DELIVERY выпуск ниже.
Исторический PASS применим только к своим входам и границе.
Публикация, наличие кода и production readiness — разные состояния.

Планирование01.10: [Foundation §6](../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md#6-разделение-остатка-внутренний-контур-и-техдолг-внешней-готовности)
отделяет внутреннюю работу на synthetic fixtures от DEFERRED_EXTERNAL и
DEFERRED_DECISION. Это классификация существующих обязательств, не новый PASS
функций и не разрешение внедрять интеграции. Смешанные POST/DEMO/media этапы
не считаются принятыми по локальным тестам их частей.

## Датированные результаты и ограничения

Строки относятся к указанным в них версиям. Итог CORE09 от02.10 заменяет
прежний NOT_ACCEPTED внутреннего CORE на30.09, но не закрывает production.
Фразы «CORE08 начат», «CORE09 впереди» и DEV_PENDING в ранних receipts — история;
фактическое состояние миграций/позднего WIP сверяется в R0, не выводится из них.

| Область | Статус | Доказательство / ограничение |
| --- | --- | --- |
| CORE-09 итоговая приёмка | LOCAL_CORE_PASS | [CORE-09](task-state/CORE-09-INTERNAL-2026-10-02.md): все CORE01–08 outcomes сведены к64591bc. CI36996467232/Security36996467259 SUCCESS: root types/lint/unit/build, PG/upgrade/tenant/rollback/races, authority/restore, contracts/config/runtime, extended API4 suppliers, canonical browser57/57 и FlowB3 7/7. Дополнительно local go_live build/budget и promotion browser2/2 PASS. Self-review без новых критических findings; POST-BE/POST-FULL/production не приняты |
| CORE-08.1–08.5 внутренний контур | CLOSED / CI_PASS | [CORE-08](task-state/CORE-08-INTERNAL-2026-10-02.md):64591bc опубликован/remote verified. Shared auth/MFA/upload/operator contracts; ESLint/CI/npm-only; preallocation/route/Next proxy limits; production go_live/Swagger policy. Полный CI36996467232/Security36996467259 SUCCESS; максимальный10MB upload и oversized/chunked413 PASS.5 dev-only advisories отдельно, runtime audit0; production/working DB не затронуты |
| CORE-06.1–06.6 внутренний контур | CI_PASS | [CORE-06](task-state/CORE-06-INTERNAL-2026-10-02.md): очередь9 доменов, назначения/CAS/history, support/internal notes, текстовые buyer/supplier/operator диалоги; personal cursor, escalation, retry/draft, focus/390px. PG upgrade/tenant/replay/dedup, core-contract320, runtime, canonical browser55/55 + targeted keyboard PASS; root typecheck8/unit7/build5/bundle3 PASS. 4023881, CI36976595298 / Security36976595308 SUCCESS. Внешние каналы/production не приняты |
| CORE-07.1–07.3 внутренний контур | CLOSED / CI_PASS | [CORE-07](task-state/CORE-07-INTERNAL-2026-10-02.md):3f2002b + corrective7cec2fa опубликованы, remote verified. Typecheck2/focused regressions/PostgreSQL3/Prisma/runtime/core-contract2/webbuild/bundle/browser2 PASS. CI36990679071 и Security36990679215 SUCCESS: verify/PG/containers/CodeQL/dependencies. Исправление CI — test inventory lazy panels20→21; runtime неизменён. Точные суммы/tenant/dataset/UTC/replay/rollback и3 роли1440/390 проверены. Working150000 не применена; CORE08 начат, CORE09 впереди |
| CORE-05.1–05.3 внутренний контур | CI_PASS | [CORE-05](task-state/CORE-05-INTERNAL-2026-10-02.md): email proof CAS, безопасные приглашения/повторная доставка, сотрудник/роли/disable, отзыв сессий, MFA concurrency. Schema/client/OpenAPI; реальный browser flow BUYER/SUPPLIER/OPERATOR. 0021438, CI36936601972 / Security36936601908 SUCCESS. Root types/unit с affected reruns, PG/core/runtime/config/build/budget, canonical browser и local auth PASS. Рабочая БД, внешняя доставка/identity и реальные сотрудники вне scope |
| CORE-01.1–01.3 внутренний контур | CI_PASS | [CORE-01-INTERNAL](task-state/CORE-01-INTERNAL-2026-10-01.md),831f7e0/df1f399, CI36845016859 и Security36845016749 SUCCESS: effective framework dates, synthetic PostgreSQL lifecycle; юридические тексты/боевые организации/ЭЦП не приняты |
| CORE-02.1–02.4 внутренний контур | CI_PASS / DEV_RESTORED | [CORE-02-INTERNAL](task-state/CORE-02-INTERNAL-2026-10-01.md): exact partial/overpayment, bilateral reduction/history, review/dispute/working-hour timers. Typecheck/unit/PG upgrade+transactions/core/runtime/build/bundle, canonical browser43/43 и real API2/2 PASS; f893f8f опубликован; CI36852606548 и Security36852606570 SUCCESS. Две локальные миграции применены по отдельному разрешению; каталог505/510 сохранён, dev восстановлен; внешние деньги не менялись |
| CORE-03.1–03.4 внутренний контур | CI_PASS / DEV_RESTORED | [CORE-03-INTERNAL](task-state/CORE-03-INTERNAL-2026-10-01.md): split shipment/receipt, manual return stages, exact money/quantity, party consent, reorder/revalidation. Typecheck/unit/PG upgrade/core/runtime/build/bundle, canonical browser46/46, live API desktop+390 PASS. 1abeb4d опубликован; CI36859245986 и Security36859246168 SUCCESS. Миграция120000 применена по отдельному разрешению, каталог505/510 сохранён, dev go_live health/catalog200; внешний перевод денег не выполняется |
| CORE04.1–04.4 | ACCEPTED в ограниченном scope | 278be21; CI36127372917 и Security36127373128 SUCCESS |
| CORE04.5 | ACCEPTED в ограниченном scope | 73ac601; CI36355260705 и Security36355260722 SUCCESS |
| CORE-04.6–04.7 внутренний контур | CI_PASS / DEV_PENDING_APPROVAL | [CORE-04-INTERNAL](task-state/CORE-04-INTERNAL-2026-10-01.md): согласованные immutable версии discount/N+M, history/min30/price-lock, nonstack, atomic gift reserve/compensation, bilateral reduction, split shipment promise/reorder; supplier/operator/public/order UI. PG upgrade+transactions, core/runtime/config, typecheck/unit/build/budget, pilot46/46 и real go_live2/2 desktop/390 PASS. f14cbe1 опубликован, CI36874461180 и Security36874461153 SUCCESS. Миграция140000 только в audit DB; рабочий dev остановлен. Реальные акции/цены и production не приняты |
| A01–A18, canonical web/API/worker | LOCAL_PASS | Опубликованы в2a816c3; исправления цены/партии/offer/order/UI/TTL/read models и проверки ниже |
| Unified frontend | CI_PASS / live rollout NOT_ACCEPTED | apps/web, canonical build/browser/budget, release api/web и ingress; оба Docker targets PASS на75e0e21 |
| Полный CORE01–09 — исторический срез30.09 | NOT_ACCEPTED на30.09; заменён LOCAL_CORE_PASS02.10 | Сохранён прежний отрицательный статус; актуальная граница внутренней приёмки — строка CORE09 выше. POST-FULL/production отдельно |
| POST-BE / POST-FULL | NOT_ACCEPTED | Отдельные приёмки одной revision/data/environment; не закрываются этим аудитом |
| Optional go_live blocks | COMPOSED / PARTIAL | Локальная видимость не означает полноту продукта, LIVE_VERIFIED или production |
| Production / внешние providers | NO-GO / NOT_ACCEPTED | Требуются выбранные реальные provider/legal/infrastructure receipts |

## Выпуск PERFORMANCE-CI-DELIVERY01.10

[Карточка и журнал попыток](task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md).
Выпуск8045225 и container fix75e0e21 опубликованы в origin/main; remote SHA
подтверждён. [CI36772750254](https://github.com/NikIg228/PlatformaMarket/actions/runs/36772750254)
и [Security36772750368](https://github.com/NikIg228/PlatformaMarket/actions/runs/36772750368)
SUCCESS на75e0e21: verify, PostgreSQL/authority/backup-restore, api/web images,
dependencies/storage и CodeQL. Первый container FAIL исправлен, attempt2 PASS.
Итоговый docs-only receipt использует REUSED_PASS тех же runtime inputs;
собственные docs checks PASS. Исторические failures ниже сохранены.

| Проверка | Фактический результат |
| --- | --- |
| Production dependencies | npm audit --omit=dev --audit-level=high: PASS0; parser controls и isolated security-storage PASS |
| TypeScript / unit | typecheck13/13 PASS; API/E2E последующие typechecks PASS. Составной full unit PASS:443 API сразу, PDF target8/8 после cold-import setup fix, remaining11 package tasks PASS |
| Canonical build / JS budget | `npm run build`:7/7 PASS. public entries23JS/1,118,819raw/340,741gzip максимум; ceilings24/1,500,000/450,000 сохранены |
| Core / PostgreSQL | PASS119 schemas/43 verified operations; PG tenant/rollback/concurrency и новые supplier pages PASS. Один core startup retry с неизменным45s timeout |
| Browser | Canonical38:32 сразу +4 focused PASS после test-only исправлений +2 comparison/login/cart retry на390/1440; FlowB3 canonical7/7 PASS; финальные measurements2/2 PASS |
| Runtime / configuration | Runtime split3roles PASS; production-config и readiness8/8 PASS; Compose/Caddy native validation canonical/legacy PASS; container build локально NOT_RUN, нет Docker engine |
| Hosted full graph | typecheck13/13, npm test, build7/7 и все настроенные API/runtime gates PASS; FlowB3 7/7 и browser38/38 едиными запусками |
| Документация | Archive305 entries/hash/semantics, active/archive links; финальный diff и protected WIP review PASS |
| Legacy rollback | Admin build PASS; buyer compile PASS, прежний budget FAIL25/1,733,332raw/481,814gzip. Не основной release gate; legacy release readiness не принята |

Manifest/catalog gzip504557→340740(-32.5%); browser encoded JS466527→429517
(-7.9%). Final local cold TTFB390/1440:23.1/20.8ms против19.5/15.7ms,
ScriptDuration0.230/0.245s против0.161/0.212s: ускорение по времени не доказано.
Все12 samples сохранены; это не production SLO. Admin inventory/import/external
initial GET2→1. Supplier payload на fixture: legacy78165Б, page(limit1)707Б;
объёмы различаются, этот результат не равен latency/load benchmark.

Evidence локально ignored: outputs/performance-ci-20260930; точный состав и
команды сохраняются в карточке. Полный CORE/POST/production этим не принимается.

## A01–A18: исторические проверки

Последующее изменение30.09 — [CI-DATABASE](task-state/CI-DATABASE-2026-09-30.md):
wrapper/CI target и conditional telemetry imports исправлены локально.
PASS: regression14/14 + telemetry7/7, typecheck13/13, составной full unit graph
(один PDF flaky retry), API build, core/PG, runtime split, observability.
Прежние readiness45s/60s FAIL устранены без изменения timeout. Этот fix и
dependency remediation входят в общий выпуск01.10 выше; не выполнять их заново.

| Граница | Фактические последние проверки30.09 |
| --- | --- |
| TypeScript | npm run typecheck — PASS13/13 |
| Полный unit graph | npm exec -- turbo run test --concurrency=1 — PASS12/12; serial execution того же graph |
| Canonical web | npm exec -- turbo run build --filter=@marketplace/web — PASS; API build PASS с неизменёнными последующими входами |
| CORE contract | npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only — PASS114 schemas/38 operations |
| PostgreSQL / runtime split | Последние A12 PASS; reuse обоснован неизменёнными входами последующих A13–A15 |
| A13–A15 browser | Первый24/25; исправлен input label, финальный build3 PASS; focused second run1/1 PASS +24 REUSED_PASS. Это не новый единый25/25 run |
| Workspace volume | playwright.workspace-volume.config.ts через db:test — PASS1/1 на synthetic1000; основные bounded lists/summary, не все legacy endpoints |
| Известные старые unit blockers | Tabster/Vitest снят A18; старые «остановиться на typecheck» не действующая очередь |

Локальные ignored evidence: outputs/workspace-audit-a13-15-verified-inputs.json,
workspace-audit-a12-verified-inputs.json, workspace-audit-a13-*,
workspace-audit-a15-*, workspace-audit-a13-15-*; опубликованный состав —
outputs/publish-20260930-inputs.json и publish-20260930-receipt.json.
Это ссылки на локальные artifacts, не гарантия их наличия в другом checkout.

Измерения synthetic1000: offers68 425Б/p95 26мс; orders22 025Б/p95 22мс supplier
и15мс buyer; current cart318Б/23мс; summary49Б/15мс; render49–160мс.
Они относятся к workspace read endpoints и данной машине/fixture, не ко всему
каталогу, inventory lots, production latency или Lighthouse/Core Web Vitals.

## Опубликованный CI и ограничения

| Gate | Фактический результат на2a816c3 |
| --- | --- |
| [CI36737223743](https://github.com/NikIg228/PlatformaMarket/actions/runs/36737223743) | FAIL, первая попытка; rerun не выполнялся |
| verify109961988677 | Core-contract wrapper выбрал dentmarket_audit_20260914, CI подготовил marketplace |
| postgres-integration109961989049 | 36 migrations применены, затем organization-profile-fixture guard отказал из-за несовпадения выбранной/ожидаемой DB |
| [Security36737223539](https://github.com/NikIg228/PlatformaMarket/actions/runs/36737223539) | Dependencies109961991970 FAIL:2 high/4 moderate (brace-expansion/js-yaml/multer и dependents); CodeQL109961991908 PASS |
| Legacy buyer bundle | FAIL:25 initial JS /1 732 101 raw/481 473 gzip против24/1 500 000/450 000; canonical build не закрывает этот gate |
| CI/release topology baseline | Прежние legacy configs заменены в выпуске01.10; live production parity всё ещё не принята |
| Старый CATALOG-LAYOUT | Исторический5/7,3 попытки; два clinic sticky-header/mobile-panel cases не приняты. После смены menu на link нужны актуальные сценарии, не старые locators |
| FRONTEND-DEMO/header return | Отдельные guest/new-registration return cases были не приняты после3 попыток; новый узкий набор не означает полного PASS |
| Переименование локальной папки | Отложено владельцем, Windows3/3; canonical root не изменён |

Полный текущий остаток с сохранёнными CORE/AUD/POST/EXT IDs —
[Foundation](../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md).
Не переносить архивный следующий шаг в новую задачу. История команд/попыток и
карта архивирования доступны через [Documentation index](../DOCUMENTATION_INDEX.md).
Новые gates выше не переписывают историю прежних FAIL.
