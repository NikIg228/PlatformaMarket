# Документооборот — выполненные этапы и технические решения

Обновлено 16.10.2026. Журнал реализации полного документального процесса сделки.
Требования — [Workflow документооборота](MARKET_DOCUMENT_WORKFLOW.md), единственный
checklist — [R7.6 основного roadmap](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md#document-workflow).

## 16.10 — R7.6.5.1–3: операционный довоз — SCOPED PASS

База `main@3aa1c0b` + локальный scope довоза; Admin опубликован отдельно.
Сценарий: по согласованной недостаче 10/8 поставщик регистрирует отправку 2,
клиника подтверждает получение связанной допоставки. Исходные 10/8, накладная,
сумма продажи и оплаченный резерв сохраняются; дополнительные 2 списываются
отдельно. AGREED не означает RESOLVED, документальный комплект остаётся INCOMPLETE.
Schema/API/Prisma и UI обеих сторон прошли scoped приёмку операционного довоза.
Полный R7.6.5 не принят: формы/подписи/возвраты и другие исключения остаются открыты.

План приёмки: focused service tests, migration upgrade и изолированный PostgreSQL
10/8/2 с tenant/role/stale/stock/rollback/concurrent replay; types/build/lint,
целевой browser desktop1440/mobile390, keyboard/recovery и screenshot/computed styles.
Новые общие UI-параметры не вводились: shared adapters, Manrope14, controls44/8,
market-components-v1/platforma-semantic-light-v1. Полная приёмка R7.6.5 открыта.

Подтверждено 16.10: API build в штатном запуске dev; focused Vitest
order-resupply7 + order-workflow10 + order-fulfillment-state4 = 21 PASS;
supplier typecheck и E2E TypeScript PASS; scoped ESLint PASS.
Изолированный unified production build (49 routes) PASS, повтор после правки
validation формы также PASS. Scoped lint изменённой формы повторно PASS.
Browser: attempt1 не нашёл tests из-за относительного testDir во временном config;
attempt2 — 4 PASS/2 FAIL: native required validation скрывала русскую inline ошибку.
Форма получила noValidate с сохранением собственной проверки tracking/acknowledged.
Attempt3 — только два affected resupply сценария, 2/2 PASS; четыре неизменённых
сценария переиспользованы. Команда `npm exec -- playwright test --config
.tmp/resupply-flow/ui.config.ts --workers=1 --grep 'agreed resupply'`.
Проверены dispatch unknown-result/retry с тем же payload, замороженные8,
переход/фокус к допоставке, получение2 и документальная неполнота на mock API.
Логи browser-attempt2/3.log; четыре screenshots confirm/received1440/390
из `.tmp/resupply-flow/ui-results` просмотрены, computed44/8/Manrope и overflow PASS.
Browser mocks не заменяют незавершённую PostgreSQL-проверку.

PostgreSQL попытки сохранены, лимит не сбрасывается:

1. `.tmp/resupply-flow/run-pg.mjs`: прежний запуск без итогового receipt — INCOMPLETE,
   лог сохранён как `postgres-attempt1-incomplete.log`.
2. Тот же изолированный loader: миграции/seed PASS, тестовый API не готов за60с;
   `postgres.log` — FAIL до бизнес-проверки.
3. `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs --resupply-only`:
   штатная свежая сборка API/Prisma, DB `dentmarket_audit_20260914`; запуск API и
   additive upgrade прошли, fixture накладной отклонён `Document_file_metadata_check`.
   В `scripts/lib/verify-order-resupply.mjs` у synthetic document задан checksum,
   но отсутствует storageKey. Лог `postgres-attempt3.log`, итог FAIL/BLOCKED.

После отдельного разрешения владельца выполнен новый цикл с изменённым планом:
synthetic PDF создан через PDFKit в изолированном storageRoot; storageKey,
fileName/contentType/byteSize и SHA256 соответствуют реальному файлу. Добавлена
проверка сохранности его checksum после довоза; ограничения БД не менялись.

- `postgres-authorized-1.log`: документ создан, но cleanup нарушал FK, удаляя
  shipment раньше заявления, и скрывал исходный assertion. Порядок cleanup исправлен,
  исходная ошибка теперь сохраняется отдельно. Остатки именно этого запуска
  b04_1792133351164_16668 удалены из audit DB с проверкой identity и штатной cleanup
  функцией; итог cleanup PASS, рабочая marketplace не затронута.
- `postgres-authorized-2.log`: cross-order assertion использовал покупателя и
  ожидал404, но role denial закономерно вернул403. Fixture исправлена: отдельно
  проверяются чужой supplier tenant и законный supplier другого заказа с чужим claim.
- `postgres-authorized-3.log`: tenant/role/invalid/stale/insufficient-stock checks
  прошли; ожидание409 для «только просроченная партия» получило201. Базовая функция
  createFixtureCatalog создаёт пригодный ACTIVE lot со сроком2035-12-31, который
  resupply fixture не исключила. Отказ без пригодного lot этим запуском не проверен;
  это дефект состава fixture, не доказательство списания просроченного товара.

Этот цикл исчерпал три попытки и был остановлен. После следующего явного
разрешения владельца базовые lots только собственного тестового balance помечены
BLOCKED, добавлено явное предусловие «нет пригодных lots», затем отдельный пригодный
lot для happy path. Новый запуск1 PASS: `postgres-lots-1.log`, exit0, cleanup без ошибок.
Команда `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs --resupply-only`.
Доказаны upgrade, 10/8/2, tenant/party/foreign-claim, invalid/stale, недостаточный
остаток/просроченная партия, rollback outbox, concurrent replay, точное отдельное
списание2 с lot trace, запрет поздних10/overreceipt/приёмки поставщиком/нового счёта,
DELIVERED товара при AGREED/INCOMPLETE документов и неизменность original PDF.

Завершающие gates на неизменном runtime: `npm run db:test -- exec -- node
scripts/verify-pilot-backend.mjs --contract-only` PASS (363 operations/69 verified,
251 schemas); `node scripts/verify-runtime-split.mjs` PASS. Использована штатная
свежая API build из dev, повторная генерация DLL не нужна. Fixture lint и diff hygiene
PASS. Source schema3/client2/supplier-planning7 и Prisma validate PASS переиспользованы
с неизменными входами из предыдущих запусков задачи. Сборка/UI также переиспользованы.
НУЦ/deploy и полный release/E2E не выполнялись: вне выбранного операционного пакета.
История неудачных попыток выше сохранена; они не объявлены успешными задним числом.

Отдельное разрешение владельца16.10: применены к локальной `marketplace` миграции
20261015090000_order_invoice_preparation, 20261015170000_order_discrepancies,
20261016010000_order_resupply. `npm run dev` запущен из canonical root в go_live;
health/API, homepage и непустой catalog-search HTTP200. Это проверка запуска,
не функциональная приёмка довоза; рабочие данные не reseed.

## 15.10 — R7.6.5.1: проект контракта исключений — PROPOSED

Поручение: подготовить правила расхождений, исправлений и возвратов, затем
согласовать до реализации. База main/6b2b383; Admin/catalog WIP сохранён.
План проверки: docs-only, сверка с DWF-07/PROJECT_OVERVIEW/функциональной картой,
schema и существующим order workflow; локальные ссылки, review diff и diff hygiene.
Риски: ложная полная приёмка, смешение недостачи с возвратом, повторное изменение
денег/остатков, подмена формы и ЭЦП операционным заявлением.

[Проект §8.1](MARKET_DOCUMENT_WORKFLOW.md#exceptions-contract-proposal) содержит
сценарии 10/8, плановую частичную партию, повреждение/неполучение/излишек,
ошибку фиксации и возврат; действия сторон, версии и API/UI-state map,
связи с существующими событиями, открытые решения и будущие критерии проверки.
Использованы development-toolkit и checklist Backend Architect: границы доменов,
contract-first, tenant/transaction/idempotency и восстановление; без субагентов.

Read-only подтверждено: получение накопительное, полностью нулевое не допускается;
возврат связан с заказом, не конкретной накладной; получение возврата не пополняет
доступный остаток автоматически. Эти ограничения учтены, новый runtime не заявлен.
Решения владельца о правилах и профильные формы/подписанты ещё не утверждены.
R7.6.5.1 остаётся OPEN/PROPOSED; R7.6.5.2/3 не начаты. НУЦ на паузе.
Проверки документации: локальные ссылки и `git diff --check` PASS.
Runtime/build/DB/browser NOT_RUN, поскольку изменена только документация.

## 15.10 — R7.6.4.1: подготовка накладной партии — SCOPED PASS

Реализован [контракт предпросмотра](MARKET_DOCUMENT_WORKFLOW.md#shipment-waybill-preview-runtime).
API/schema/client → ShipmentWaybillService/rules → WaybillRendererService →
ShipmentPanel/ShipmentWaybillPanel в /supplier/orders/:id. PDF остаётся DRAFT,
не подтверждает передачу, подпись или приёмку. SDK/запрос НУЦ на паузе;
R7.6.4.2/3 открыты. Новых миграций, рабочих данных, интеграций нет.

Доказательства на main/76d5c1d + собственный diff (foreign WIP исключён):

- npm run build --workspace=@marketplace/schemas; npm run build --workspace=@marketplace/api-client — PASS.
- npm run test --workspace=@marketplace/schemas -- shipment-waybill.test.ts — 2/2;
  npm run test --workspace=@marketplace/api-client -- shipment-waybill.test.ts — 1/1.
- Из apps/api: npm exec -- vitest run --config ../../.tmp/invoice-flow/vitest.config.mts src/modules/documents — 95/95;
  после последних guards/legacy amount правок повторены documents.service.spec.ts
  и document-consolidation-security.spec.ts — 42/42 PASS.
- npm exec --workspace=@marketplace/api -- nest build --path ../../.tmp/invoice-flow/tsconfig.json --config ../../.tmp/invoice-flow/nest-cli.json — PASS;
  tsc с тем же --path config через -p и --noEmit — PASS. Изолированный generated
  Prisma client соответствует неизменённой schema, исходники не копировались.
- npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs --waybill-only — PASS;
  новый scoped flag включает invoice fixtures/dependency. Проверены partial VAT,
  tenant/role, invalid input, replay/race, stale, audit rollback, delivery links,
  запрет generic signing/старого pack. NODE_OPTIONS переключал только generated
  client/API artifacts через .tmp/invoice-flow/client-hook.cjs и client-loader.mjs.
  Использовалась штатная disposable dentmarket_audit_20260914, cleanup завершён.
- node scripts/verify-runtime-split.mjs; npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only — PASS с теми же artifacts.
- node .tmp/waybill-flow/build-web.mjs — unified web pilot build/typecheck PASS,
  отдельный distDir .tmp/waybill-flow/next; текущий dev не останавливался.
  npm run typecheck --workspace=@marketplace/e2e — PASS.
- Playwright: playwright.shipment-waybill.config.ts на canonical dev3000,
  все API замокированы, рабочие данные не затрагиваются. Основные 3/3 PASS,
  отдельный mobile PDF download/stale 1/1 PASS. Keyboard/focus/1440/390,
  Manrope14/control44/radius8 и отсутствие overflow подтверждены.
- PDF unit test и визуальная проверка Poppler: краткий1 и длинный6 страниц PASS;
  .tmp/waybill-flow/pdf, screenshots output/playwright/waybill-final и waybill-download.
- Scoped ESLint --max-warnings=0 и git diff --check — PASS. Полный release/E2E
  не запускался: task scope не является общей приёмкой или production выпуском.

Первый PG выявил nullable адрес склада: исправлен validation 409 + regression.
Browser исправления: постоянная inline ошибка в диалоге и короткая кнопка новой
версии. Финальные результаты выше; попытки/логи .tmp/waybill-flow. Commit/push
по standing permission, [skip ci] по решению владельца; публикация проверяется отдельно.

## 15.10 — R7.6.3.1: воспроизводимый пакет, внешний прогон BLOCKED

Владелец подтвердил отсутствие SDK/тестовых сертификатов. NCALayer установлен,
но локальный порт13579 не слушает; проверенная версия пока неизвестна.
Официальный [KNCA Basics protocol](https://github.com/pkigovkz/sdkinfo/wiki/KNCA-Basics-Module)
повторно сверён. SDK/мобильный доступ не получены, заявки не отправлялись.

Подготовка: npm run build --workspace=@marketplace/eds-client, затем
node scripts/prepare-nca-prototype.mjs. В .tmp/nca-prototype/packet сохраняются
оригинал без коммерческих обязательств, его однобайтовое изменение, checksums,
запрос existing client и manifest. Все реальные проверки помечены NOT_RUN.
Нет сетевой отправки, подписи, private key или подмены Kalkan mock-verifier.

Исправлена воспроизведённая ошибка NcalayerClient: мутация входного буфера во
время внешнего диалога не должна менять checksum отправленных байтов.
Client tests3/3, consumer3/3, verifier/adapters5/5, package build/types и lint PASS.
Проверки используют mocks и не доказывают валидность CMS, доверия/отзыва/TSP.

Для продолжения владельцу нужен комплект официального SDK: runtime/библиотеки,
пример проверки detached CMS, тестовые сертификаты и trust anchors, тестовые
OCSP/CRL/TSP и правила проверки. После получения передать путь к комплекту;
пароли и закрытые ключи в чат/Git не отправлять. Мобильный доступ — отдельно.
R7.6.3.1 не закрыт; подготовка не является рабочей интеграцией подписи.

## 15.10 — GENERATED-счёт R7.6.2: SCOPED PASS

Реализованы подготовка из подтверждённых реквизитов/налогового snapshot заказа,
независимая нумерация, PDF preview, отдельное подтверждение поставщиком,
неизменная история и видимость текущего счёта клинике. Контракт и права —
[DWF §17.8](MARKET_DOCUMENT_WORKFLOW.md#order-invoice-runtime).

После первоначальной остановки владелец явно поручил продолжить. Исправлены
fixtures/cleanup; полный isolated PostgreSQL, upgrade-path, core-contract,
runtime split, focused unit/client tests, API/web build/types и scoped lint PASS.
Browser3/3: supplier/clinic1440/390, keyboard, read/write retry и stale preview.
Финальные screenshots/computed styles и длинный10page PDF проверены визуально.
API/DB инварианты проверены реальным PG, браузерные состояния — API mocks.

Рабочая DB/production не менялись; НУЦ/ЭСФ/накладные не входят в пакет.
Full CI пропущен по решению владельца, feature-коммит с [skip ci].
Подробные команды, неудачные попытки, cleanup и пути evidence —
[checkpoint R7.6.2](../governance/task-state/PRIMARY-SESSION.md).

## 14.10 — подготовка налоговой цепочки R7.6.1.4

Профиль реквизитов уже реализован отдельным пакетом. Сверены существующие
коммерческие поля, формы, revalidation и writers ERP/override; повторная
реализация этой основы не нужна. В [DWF §17.6.1](MARKET_DOCUMENT_WORKFLOW.md#supplier-vat-proposal)
добавлен проект расширения режимов, точного расчёта, снимков и совместимости.
Применимость ставок, дата оборота, налоговое округление и переход старых
предложений ещё требуют решения. Продуктовый налоговый код в этом пакете
не менялся; R7.6.1.4 остаётся открытым. Проверки подготовки: source review,
согласованность документации и diff hygiene; runtime checks не требуются.

## Выполненная подготовка

13.10 зафиксирована принятая B2B-цепочка, участники и полномочия, документы,
версии, подписи, исключения, архив и отрицательные сценарии приёмки.
Спецификация опубликована в `d4e1db8`. 13–14.10 требования интегрированы в R7.6:
восемь пакетов с проверяемыми подшагами, связями с Admin и отдельной технической
проверкой НУЦ. Это завершённая подготовка требований, не приёмка полного workflow.

## Существующая основа и пробелы

В проекте есть документы заказа и механизмы подписей. Выборочная сверка,
зафиксированная в основном roadmap на `d4e1db8`, выявила два существенных разрыва:
`OrderWorkflowService.document` принимает только UPLOADED, а завершение подписи
в `DocumentsService.refreshDocumentSignatureStatus` определяется количеством
подписей. Для целевого процесса нужны выпуск генерируемых документов и проверка
обязательных сторон, исключающая ложное завершение двумя подписями одной стороны.

На 14.10 read-only инвентаризация R7.6.1.1 завершена и сверена primary.
Результат ниже — карта существующей реализации и пробелов; этот подшаг не требует
новой реализации, миграций или runtime suite. Карта входит в текущую docs-публикацию.
Mock-подпись, прототип НУЦ и прежний UI не доказывают рабочую внешнюю интеграцию.

## 14.10 — инвентаризация R7.6.1.1

Подготовка PlatformaMarket UI на `2885f6f`, review primary на `37fa69a`.
В documents module, order-workflow service/schema и просмотренных общих document
components между этими версиями изменений нет; auth migration относится к AuthSession.
Повторно сверены модели Document/Participant/Signature/Shipment, запрет GENERATED
при ISSUE_INVOICE, ограничения pack, счётчик подписей и canonical UI entry points.

Общие входы:
[Prisma](../../apps/api/prisma/schema.prisma),
[схемы документов](../../packages/schemas/src/index.ts),
[workflow schema](../../packages/schemas/src/order-workflow.ts),
[signature evidence schema](../../packages/schemas/src/commercial.ts),
[DocumentsService](../../apps/api/src/modules/documents/documents.service.ts),
[HTTP documents](../../apps/api/src/modules/documents/documents.controller.ts),
[HTTP order documents](../../apps/api/src/modules/documents/order-documents.controller.ts),
[OrderWorkflowService](../../apps/api/src/modules/commerce/order-workflow.service.ts),
[API client](../../packages/api-client/src/index.ts).

| Требование | Существующая основа | Конкретный пробел / следующий пакет |
| --- | --- | --- |
| DWF-01 модель | Document содержит source, связи заказа/партии/платежа, storage/hash/snapshots; версия — отдельный Document с previousVersionId и уникальным owner/number/version | Типизированные снимки сторон и полномочий, неизменяемый план подписей и отдельная комплектность: R7.6.1.3; не создавать вторую систему версий |
| DWF-02 цепочка | prepareOrderDocuments генерирует specification/invoice; pack добавляет waybill; ISSUE_INVOICE отдельно фиксирует счёт заказа | ISSUE_INVOICE требует UPLOADED/CLEAN даже для GENERATED. R7.6.2: source-specific проверка, актуальный snapshot и явное подтверждение поставщиком; сохранить защиту загруженных файлов |
| DWF-03 стороны | DocumentParticipant, signer org/user, tenant/reference checks и общий permissions guard; принятие supplier terms фиксирует actor/version | Утверждённое основание полномочий, повторная проверка при commit и план обязательных сторон отсутствуют; operator exception не является правом подписывать за участника |
| DWF-04 реквизиты | kind enum, template/data snapshot, renderer/hash, детерминированные номера заказа/отправления | Generic data не задаёт принятый набор банковских/налоговых/адресных реквизитов; нет согласованной маски номера и источника идентификатора ИП. Внешние решения R7.6.1.2 |
| DWF-05 версии/полнота | createVersion создаёт новую запись/файл и SUPERSEDED старую; signature связана с documentId | Нет полного expected business revision/idempotency correction контракта; refreshDocumentSignatureStatus считает SIGNED без проверки разных обязательных сторон. Отдельная completeness projection не обнаружена |
| DWF-06 подпись | NCALayer client, local session, gateway verification/callback, HMAC/replay/checksum/BIN/cert evidence checks | Реальная НУЦ-проверка не доказана; поздний expired/final результат отвергается, durable reconciliation и оригинальный CMS в архиве не обеспечены просмотренным путём. R7.6.3 |
| DWF-07 партии | Shipment/ShipmentItem, quantities/deliveredQuantity, order locking в логистике; RECEIVE_SHIPMENT отдельно меняет физическое исполнение | Pack требует уже DISPATCHED и PAID; нужна накладная до отправки, сумма частичной партии, связь документального принятия с версией и исправление10/8. Не повторять существующий возврат денег/остатков |
| DWF-08 SMS | Канал уведомлений и auth MFA существуют отдельно | Нет proof конкретного получения/версии или принятого входа личного заказа в просмотренном document contract. R7.6.6/R5.3; не добавлять B2C-checkout как побочный эффект |
| DWF-09 архив | Scoped archive list/summary/get/download, версии, checksum, accounting expectedUpdatedAt; backup restore проверяет object inventory | Не обнаружены полный signature proof/original CMS, export manifest, business completeness, согласованные retention/legal hold и access после отключения. R7.6.7 отдельно от infrastructure R8.2 |
| DWF-10 UI | Canonical workspaces/documents → DocumentRegistry/DocumentDetailPanel; order-detail → OrderWorkflowWorkspace | Счёт в canonical flow upload-only; отсутствуют generate-preview-confirm, подписание/приёмка той же версии, комплектность и документальное исправление. Legacy prepare/pack не доказывает canonical flow |
| DWF-11 evidence | Историческая приёмка реестра и целевые regression tests доступны | Нет общей приёмки generated issue → обе НУЦ стороны → correction → originals archive/restore. R7.6.8/R7.3 не закрыты |

Покрытие для последующего выбора gates: documents `document-reference-isolation`,
`document-consolidation-security`, `documents.service`, `document-renderer`;
commerce `order-workflow`; logistics `shipment-state`; agreements
`eds-signature-verification.service` и `signature-callbacks.service`;
schema `document-upload-money`, `document-archive-query`, `document-relations`;
browser `documents-registry`, `document-relations`, `document-upload`.
Наличие этих тестов не означает их новый PASS. Историческое evidence находится в
[карточке реестра](../governance/task-state/DOCUMENTS-REDESIGN-2026-10-08.md).

UI-источники:
[canonical documents](../../apps/web/app/workspaces/documents.tsx),
[canonical order](../../apps/web/app/workspaces/order-detail.tsx),
[registry](../../packages/ui/src/document-registry.tsx),
[detail](../../packages/ui/src/document-detail-panel.tsx),
[workflow](../../packages/ui/src/order-workflow-workspace.tsx).
Следующая реализация начинается с выбранного связного контракта/backend/UI,
а не с массового изменения всех одиннадцати требований. Неизвестные формы,
полномочия и внешний доступ остаются в журнале вопросов.

## 14.10 — предварительное исследование НУЦ, R7.6.3.1

Read-only сверка кода на `37fa69a` и открытых первичных источников. Продуктовый
код, зависимости, рабочие данные и внешние настройки не менялись. Это подготовка
прототипа, а не его PASS; R7.6.3.1 остаётся открытым.

Существующий [eds-client](../../packages/eds-client/src/index.ts) отправляет байты
в base64 в `kz.gov.pki.knca.basics/sign`: CMS, decode=true, encapsulate=false,
digested=false. Это соответствует описанию detached CMS в
[официальном SDK wiki](https://github.com/pkigovkz/sdkinfo/wiki/KNCA-Basics-Module).
Передаваемый `tsaProfile: {}` по этому описанию запрашивает метку времени;
фактический контейнер, доступность TSP и проверка метки ещё не доказаны.
Источник найден через [ответ на форуме НУЦ](https://forum.pki.gov.kz/t/dokumentacziya-po-kz-gov-pki-knca-basics/4251),
ссылающийся также на [пример НУЦ](https://github.com/pkigovkz/NCALayerJSExample).

[Серверная проверка](../../apps/api/src/modules/agreements/eds-signature-verification.service.ts)
делегирует криптографию в `SIGNATURE_GATEWAY_URL/verify`, затем сверяет структуру
evidence, checksum, БИН и срок сертификата. Реализация Kalkan в просмотренных
исходниках отсутствует. [Реестр адаптеров](../../apps/api/src/modules/documents/signature-adapter-registry.service.ts)
при отсутствии gateway вне production использует mock; это не доказательство
работоспособности НУЦ. Unit tests WebSocket/проверки evidence не заменяют реальный CMS.

[Страница разработчиков НУЦ](https://pki.gov.kz/ru/developers/) описывает получение
SDK с библиотеками и тестовыми сертификатами владельцем ИС/представителем через
[портал SDK](https://sdk.pki.gov.kz/). Там же опубликованы адреса TSP, OCSP и CRL.
Наличие адреса не доказывает проверку цепочки, отзыва или долгосрочную пригодность
нашего evidence. В репозитории не найдены именованные SDK/Kalkan artifacts;
наличие комплекта у владельца вне репозитория пока неизвестно.

Для мобильного пути [сообщение НУЦ от07.10.2022](https://pki.gov.kz/ru/2022/10/07/qr-подписание-посредством-egov-mobile/)
прямо указывает на [сервис Smart Bridge NITEC-S-5096](https://sb.egov.kz/smart-bridge/services/passport/NITEC-S-5096).
Паспорт сервиса не удалось прочитать используемым web-инструментом; актуальные
условия доступа, API и поддержка полномочий юридического лица не подтверждены.
Нельзя выводить их из стороннего API либо пользовательской инструкции eGov.

Следующий проверяемый результат: получить разрешённый SDK/тестовые сертификаты,
зафиксировать версии и выполнить detached CMS над известными байтами с серверной
проверкой оригинала, изменённых байтов, чужой стороны, цепочки, отзыва и TSP.
Отдельно подтвердить контракт и доступ к NITEC-S-5096, затем cancellation,
неизвестный исход, поздний результат и mobile return. Секретные ключи и пароли
не сохранять в Git/evidence. Заявки и сообщения от имени владельца не отправлялись.

## Как дополнять журнал

После каждого этапа записать R-ID, сценарий и переходы состояний, изменения
схемы/API/backend/UI, применимые права и инварианты, проверки с evidence,
commit и статус CI. Для документов указывать, чем доказаны версии, состав
обязательных сторон, идемпотентность и запрет чужого tenant, если они затронуты.
Краткое описание сопровождает обновление основного roadmap; вопросы и выбранные
варианты фиксируются в [журнале решений](../governance/ROADMAP-QUESTIONS-AND-DECISIONS.md).


<a id="discrepancy-statements"></a>
## 15.10 — R7.6.5.2: операционное заявление, ответы и история

Поручение владельца после согласования §8.1 DWF. База main/483eba1; canonical
checkout. Pipeline каталог → корзина → отдельные заказы поставщиков → состав →
счёт → оплата → партии → получение/документы описан в
[DWF §3](MARKET_DOCUMENT_WORKFLOW.md#order-pipeline).

Реализована выбранная часть R7.6.5.2, не весь документальный пакет:

- Клиника создаёт сохраняемый DRAFT по отправленной партии, указывает тип,
  обязательную причину, точные фактические/повреждённые количества и решение.
  Фото/PDF необязательны; PDF/PNG/JPEG до 5 МБ, до 10, проверка quarantine/CLEAN.
- SUBMIT сохраняет редакцию и снимок источника; дальнейшая правка заявления
  запрещена. Поставщик не видит черновик, его вложения и историю редактирования.
- Поставщик согласует предложенное клиникой решение, отклоняет с причиной или
  предлагает другой вариант. COUNTER → RESOLUTION_PROPOSED требует явного DECIDE
  клиники. После REJECTED можно создать новую связанную редакцию.
- AGREED означает согласованное решение. Нет RESOLVED, подписания, автоматического
  согласия, допоставки, изменения количества получения, денежного/складского эффекта.
  Полностью нулевое заявление разрешено; оно не подменяет RECEIVE_SHIPMENT.
- Связь с накладной допускается только для доступной клинике выпущенной версии
  этой партии с checksum. Supplier-only preview не раскрывается. При отсутствии
  выпущенной накладной источник явно null. Ошибка получения требует ссылки на
  действительное RECEIVE_SHIPMENT этой партии.

Контракт: [order-discrepancy.ts](../../packages/schemas/src/order-discrepancy.ts).
GET/POST /supplier-orders/:orderId/discrepancies; POST .../attachments;
GET .../:discrepancyId/attachments/:assetId. Zod strict, OpenAPI и api-client
согласованы. Read: участник заказа с order.create/order.confirm; write клиники —
order.approve, поставщика — order.confirm. Чужой объект — 404, неверная сторона/роль —
403, неверный payload — 400, версия/переход/ссылка — 409; стандартный error envelope.

[Сервис](../../apps/api/src/modules/commerce/order-discrepancy.service.ts) блокирует
SupplierOrder перед проверкой replay и трёх версий. Replay привязан к actor/org,
key и hash; событие, новая версия, audit и outbox атомарны. DRAFT/SAVE не создают
межсторонний outbox. История хранится в OrderDiscrepancyEvent отдельно от финансового
workflow. Миграция 20261015170000_order_discrepancies добавляет две таблицы и связи,
не переписывает старые события/документы. Рабочая БД не мигрировалась.

[UI](../../packages/ui/src/order-discrepancy-panel.tsx) в существующей вкладке
«Отгрузки» карточек clinic/supplier/orders/:id: состояние, количества, причина,
вложения и хронология. Черновик восстанавливается после перезагрузки; при отказе
ввод остаётся. Неизвестный исход повторяет ровно прежнюю команду/key; 409 требует
обновления и явной сверки. Shared DmDialog/mobileFullscreen и adapters/tokens.

Evidence (локальные ignored artifacts .tmp/discrepancy-flow и output/playwright):

| Проверка | Команда / результат |
| --- | --- |
| Схемы | schemas build; vitest src/order-discrepancy.test.ts — 2 PASS |
| Сервис/правила | API vitest с изолированным Prisma client: 5 service + 3 rules PASS; service повторён после уточнения единицы упаковки |
| API build/types | tsc -p .tmp/discrepancy-flow/tsconfig.json, отдельный api-dist — PASS; client не заменяет dev client |
| Prisma | prisma validate — PASS; generate в .tmp/discrepancy-flow/client; additive upgrade в транзакционном тестовом schema |
| PostgreSQL/API | db:test → verify-postgres-integration.mjs --discrepancy-only: две партии, дроби/zero, tenant/party/role, вложения, replay/race, rollback outbox, неизменность денег/остатков/получения — PASS |
| Core-contract | db:test → verify-pilot-backend.mjs --contract-only с актуальным isolated API: response/error validation PASS; 363 operations / 251 schemas / 69 core checks |
| Runtime split | verify-runtime-split.mjs с isolated API — API/worker/all и production guards PASS |
| Client | api-client build + vitest src/order-discrepancy.test.ts — 1 PASS |
| Frontend | ui/web typecheck; isolated Next production build (49 pages) — PASS |
| Browser | playwright.order-discrepancy.config.ts — 4 PASS: desktop1440/mobile390, read/write recovery, reload draft, stale review, both parties/counter/accept/reject/revision, denied role, keyboard/focus |
| Visual | discrepancy-before.png; discrepancy-final-1440.png / discrepancy-final-390.png просмотрены; Manrope14/control44/radius8, no viewport overflow; 2 финальные visual/keyboard проверки PASS |
| Hygiene | scoped ESLint и git diff --check; links/consistent scope |

Browser использует intercepted fixture API и не считается HTTP/DB integration:
это доказано отдельным PostgreSQL gate на dentmarket_audit_20260914.
Первый Prisma validate не получил DATABASE_URL, исправлен read-only validation URL.
Первые два запуска PG остановились до сценария из-за Windows loader URL и отсутствующих
fonts в isolated build; третий PASS. После уточнения единицы упаковки и cleanup
финальный focused PG rerun также PASS (postgres-final.log). Первый browser run выявил потерю фокуса после
смены состояния, второй — после отказа; третий все 4 PASS. После группировки блоков
и scroll-to-top выполнена только затронутая visual/keyboard сверка. Первая web build
остановлена исполнителем при UI-исправлении; финальная сборка PASS. Client-test исправлен
под фактический fetch GET (метод по умолчанию); повтор PASS.

НУЦ, подписи, формы исправления/возврата, исполнение допоставки/денежного уменьшения,
финальное закрытие и полный R7.6.5.3 NOT_RUN/вне выбранного пакета. Full release/E2E
не требуются для этого scope. CI не запускать по постоянному решению владельца [skip ci].
